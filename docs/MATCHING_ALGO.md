# 匹配算法文档 (Matching Algorithm Documentation)

## 概述

本系统实现了增强的 JD-CV 匹配算法，整合了"鲁棒分段 + 置信度降权 + 分段混合匹配（keywords/cluster + embedding cosine）"，解决了简历分段标题不统一、JD 分类描述不统一导致的分段不准问题。

## 核心特性

1. **鲁棒分段**：即使无法可靠分段，也能稳定输出 matchScore（不会崩）
2. **置信度降权**：若分段可靠（识别到 heading），则分段权重更高；若只能 fallback 切片，则该段权重自动降低
3. **分段混合匹配**：结合 lexical（keywords/cluster）和 semantic（embedding cosine）匹配
4. **可解释性**：最终 match 仍然可解释（matched/missing keywords + matchedClusters），embedding 作为语义补偿

## 架构设计

### A. 分段器

#### 1. JD 分段器 (`app/nlp/jd_segmenter.py`)

将 JD 文本分段为：
- `requirements`: 要求/资格
- `responsibilities`: 职责/工作内容
- `nice_to_have`: 加分项/优先
- `other`: 其他

**分段策略（优先级递减）**：

1. **Strategy 1（高置信度 1.0）**：识别 heading
   - Requirements/Qualifications/What you bring/You have/要求/资格
   - Responsibilities/What you will do/Role/职责/工作内容
   - Nice to have/Preferred/Bonus/加分项/优先

2. **Strategy 2（中置信度 0.6）**：规则归类
   - 含 must/required/need/should/要求/必须/需要 → requirements
   - 含 you will/负责/你将/工作内容 → responsibilities
   - 含 preferred/bonus/nice to have/加分 → nice_to_have

3. **Strategy 3（低置信度 0.3）**：Fallback
   - requirements = 前 40% 文本
   - responsibilities = 后 60% 文本

#### 2. CV 分段器 (`app/nlp/cv_segmenter.py`)

将 CV 文本分段为：
- `skills`: 技能
- `experience`: 经历
- `projects`: 项目
- `other`: 其他（包括教育背景）

**分段策略（优先级递减）**：

1. **Priority 1（高置信度 1.0）**：使用 `resume_profiles.sections_json`（如果存在）

2. **Strategy 2（高置信度 1.0）**：识别 heading
   - Skills/Technologies/技术/技能
   - Experience/Work Experience/工作经历
   - Projects/Portfolio/项目

3. **Strategy 3（中置信度 0.6）**：特征投票
   - 技能段：逗号/分号分隔、技术词密度高
   - 经历段：日期范围、公司/岗位词、bullet 密集
   - 项目段：project/项目/tech stack/built/developed

4. **Strategy 4（低置信度 0.3）**：Fallback
   - experience = 整篇 parsed_text

### B. Embedding 生成 (`app/nlp/embeddings.py`)

- **模型**：`all-MiniLM-L6-v2` (sentence-transformers)
- **用途**：为每个分段生成语义向量
- **存储**：JSON 格式存储在数据库 TEXT 字段中

**关键函数**：
- `generate_embeddings(text)`: 生成单个文本的 embedding
- `generate_section_embeddings(sections)`: 为所有分段生成 embeddings
- `cosine_similarity(emb1, emb2)`: 计算余弦相似度
- `semantic_score_from_cosine(cosine)`: 将余弦相似度映射到 0-100 分数

### C. 数据库结构

#### `jobs` 表新增字段：
- `jd_sections_json`: JD 分段结果（JSON）
- `jd_sections_conf_json`: JD 分段置信度（JSON）
- `jd_section_keywords_json`: 每段的关键词（JSON）
- `jd_embeddings_json`: 每段的 embedding（JSON）
- `jd_sections_updated_at`: 更新时间

#### `resume_profiles` 表新增字段：
- `cv_sections_json`: CV 分段结果（JSON）
- `cv_sections_conf_json`: CV 分段置信度（JSON）
- `cv_embeddings_json`: 每段的 embedding（JSON）
- `cv_sections_updated_at`: 更新时间

### D. 匹配引擎 (`app/match/match_engine_v2.py`)

#### 分段混合匹配流程

1. **Lexical 匹配（可解释）**：
   - 对每个 JD 段（requirements/responsibilities/nice_to_have）计算：
     - `keywordScore`: 精确匹配 + 别名匹配
     - `clusterScore`: 能力簇软匹配
   - 输出：`matchedKeywords`, `missingKeywords`, `matchedClusters`

2. **Semantic 匹配（embedding cosine）**：
   - 对每个 JD 段选择最合适的 CV 段做比较：
     - `requirements` vs (`cv_skills` + `cv_experience` 拼接) 或取 max
     - `responsibilities` vs `experience`/`projects`
     - `nice_to_have` vs `skills`/`projects`
   - cosine → semanticScore 0-100 映射：`(cosine - 0.2) / 0.8`

3. **段内融合**：
   ```
   sectionScore = 0.6 * lexicalScore + 0.4 * semanticScore
   ```

4. **段间融合（带置信度）**：
   ```
   base_weights = {
       "requirements": 0.55,
       "responsibilities": 0.30,
       "nice_to_have": 0.15
   }
   
   effective_weight = base_weight * jd_confidence[segment]
   
   # 归一化
   normalized_weight = effective_weight / sum(all_effective_weights)
   
   # 最终分数
   finalScore = Σ(normalized_weight * sectionScore)
   ```

5. **输出结构**：
   ```python
   {
       "matchScore": int,  # 0-100
       "keywordScore": int,  # 整体 lexical
       "clusterScore": int,  # 整体 cluster
       "semanticScore": int,  # 整体 semantic（可选）
       "matchedClusters": List[str],
       "matchedKeywordsByGroup": Dict,
       "missingKeywordsByGroup": Dict,
       "breakdown": {
           "requirements": {
               "lexicalScore": int,
               "semanticScore": int,
               "sectionScore": int,
               "confidence": float,
               "matchedKeywords": Dict,
               "missingKeywords": Dict
           },
           "responsibilities": {...},
           "nice_to_have": {...}
       }
   }
   ```

### E. Fallback 机制

如果分段数据不可用（sections/embeddings 缺失），系统会自动回退到原始的简单匹配算法（`app/match/match_engine.py`），确保：
- 不会因为分段失败而崩溃
- 仍然能输出基本的 matchScore
- 保持向后兼容

## 数据流

### 岗位抓取时（`app/ingest/service.py`）：
1. 抓取岗位描述
2. 调用 `segment_jd()` 分段
3. 为每段提取关键词
4. 为每段生成 embedding
5. 存储到数据库

### 简历解析时（`app/api/routes/resumes.py`）：
1. 提取简历文本
2. 调用 `segment_cv()` 分段
3. 为每段生成 embedding
4. 存储到数据库

### 匹配计算时（`app/api/routes/jobs.py`）：
1. 获取 JD 的 sections/embeddings
2. 获取 CV 的 sections/embeddings
3. 调用 `compute_match_v2()` 计算匹配
4. 返回包含 breakdown 的完整结果

## API 响应格式

### `GET /api/jobs?withMatch=true`

```json
{
  "jobs": [
    {
      "id": "...",
      "title": "...",
      "match": {
        "matchScore": 85,
        "keywordScore": 80,
        "clusterScore": 90,
        "semanticScore": 82,
        "matchedClusters": ["backend", "cloud"],
        "matchedKeywordsByGroup": {...},
        "missingKeywordsByGroup": {...},
        "breakdown": {
          "requirements": {
            "sectionName": "requirements",
            "lexicalScore": 75,
            "semanticScore": 80,
            "sectionScore": 77,
            "confidence": 1.0,
            "matchedKeywords": {...},
            "missingKeywords": {...}
          },
          "responsibilities": {...}
        }
      }
    }
  ]
}
```

## 验收用例

1. **JD 有清晰 Requirements/Responsibilities heading**：
   - `requirements.confidence` 应为 1.0
   - breakdown 权重主要来自 requirements

2. **JD 无 heading（纯长段）**：
   - `requirements/responsibilities.confidence` 应为 0.3 或 0.6
   - 算法仍输出 matchScore，且 breakdown 权重降低

3. **CV 无标准标题**：
   - `cv_segmenter` 能 fallback，confidence 降低但不崩

4. **前端仍能显示 match% + keywords + clusters**：
   - 不会出现空白/报错
   - 即使 breakdown 为空，也能显示整体匹配信息

## 文件清单

### 新增文件：
- `app/nlp/jd_segmenter.py`: JD 分段器
- `app/nlp/cv_segmenter.py`: CV 分段器
- `app/nlp/embeddings.py`: Embedding 生成和相似度计算
- `app/match/match_engine_v2.py`: 增强匹配引擎

### 修改文件：
- `app/models/job.py`: 添加 sections/embeddings 字段
- `app/models/resume_profile.py`: 添加 sections/embeddings 字段
- `app/ingest/service.py`: 在抓取时自动分段和生成 embeddings
- `app/api/routes/resumes.py`: 在解析时自动分段和生成 embeddings
- `app/api/routes/jobs.py`: 使用新的匹配引擎
- `app/schemas/job.py`: 添加 breakdown 结构

### Migration：
- `alembic/versions/6f04d0277e82_add_sections_and_embeddings_for_matching.py`

## 依赖

- `sentence-transformers==3.3.1`: Embedding 模型
- `torch==2.5.1`: PyTorch（sentence-transformers 依赖）

## 性能考虑

1. **Lazy Loading**：Embedding 模型在首次使用时才加载，避免启动延迟
2. **缓存**：分段和 embeddings 结果缓存在数据库中，避免重复计算
3. **Fallback**：如果 embedding 生成失败，自动回退到纯 lexical 匹配

## 未来改进

1. **分段质量评估**：可以添加更细粒度的置信度评估
2. **动态权重调整**：根据分段质量动态调整 lexical/semantic 权重
3. **多模型支持**：支持切换不同的 embedding 模型
4. **批量处理优化**：优化批量岗位/简历的处理性能
