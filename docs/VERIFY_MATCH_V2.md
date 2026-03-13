# 验证新匹配算法（关键词+Embedding）检测指南

## 快速检测方法

### 方法1: 通过浏览器开发者工具（最简单）

1. **启动服务器并登录**
2. **上传/解析简历**（重要！没有简历无法看到完整效果）
3. **打开浏览器开发者工具**（F12）
4. **访问岗位搜索页面**：`http://localhost:3000/job-match`
5. **在 Network 标签查看 API 请求**：
   - 找到 `GET /api/jobs?withMatch=true` 请求
   - 点击查看 Response

6. **检查返回的数据结构**：

```json
{
  "jobs": [{
    "match": {
      "matchScore": 85,
      "keywordScore": 80,
      "clusterScore": 90,
      "semanticScore": 82,  // ✅ 新字段：语义匹配分数
      "breakdown": {        // ✅ 新字段：分段匹配详情
        "requirements": {
          "sectionName": "requirements",
          "lexicalScore": 75,      // 关键词匹配分数
          "semanticScore": 80,     // ✅ Embedding 语义匹配分数
          "sectionScore": 77,      // 综合分数
          "confidence": 1.0,       // 分段置信度
          "matchedKeywords": {...},
          "missingKeywords": {...}
        },
        "responsibilities": {...},
        "nice_to_have": {...}
      }
    }
  }]
}
```

**✅ 如果看到 `semanticScore` 和 `breakdown`，说明新算法已生效！**

---

### 方法2: 使用 Python 测试脚本

```bash
cd apps/fastapi-server
source .venv/bin/activate
python3 scripts/test_match_v2_detailed.py
```

**注意**：需要先上传简历才能看到完整效果。

---

### 方法3: 通过 API 直接测试

```bash
# 1. 获取登录 token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}' \
  | jq -r '.accessToken')

# 2. 调用岗位搜索 API
curl -X GET "http://localhost:8000/api/jobs?withMatch=true&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.jobs[0].match | {matchScore, semanticScore, breakdown}'
```

---

## 验证清单

### ✅ 岗位数据检查

- [ ] 岗位有分段数据（`jd_sections_json`）
- [ ] 岗位有 embedding 数据（`jd_embeddings_json`）
- [ ] 分段包含 requirements/responsibilities/nice_to_have

**检查命令**：
```bash
cd apps/fastapi-server
source .venv/bin/activate
python3 -c "
from app.core.db import SessionLocal
from app.models.job import Job
from sqlalchemy import select
db = SessionLocal()
job = db.scalar(select(Job).where(Job.jd_sections_json.is_not(None)).limit(1))
print(f'有分段: {bool(job.jd_sections_json)}')
print(f'有embedding: {bool(job.jd_embeddings_json)}')
"
```

### ✅ 简历数据检查

- [ ] 简历已上传
- [ ] 简历已解析（调用 `/api/resumes/{id}/parse`）
- [ ] 简历有分段数据（`cv_sections_json`）
- [ ] 简历有 embedding 数据（`cv_embeddings_json`）

**检查方法**：
- 在前端上传简历
- 或调用 `POST /api/resumes/{id}/parse` API

### ✅ API 返回检查

- [ ] `match.semanticScore` 不为 `null`（0-100 的数值）
- [ ] `match.breakdown` 不为 `null`（包含分段详情）
- [ ] `breakdown.requirements.semanticScore` 不为 `null`
- [ ] `breakdown.requirements.confidence` 有值（0.0-1.0）

---

## 关键指标说明

### 1. semanticScore（语义匹配分数）

- **含义**：基于 Embedding 余弦相似度计算的语义匹配分数
- **范围**：0-100
- **计算方式**：`(cosine_similarity - 0.2) / 0.8 * 100`
- **验证**：如果这个值存在且不为 0，说明 Embedding 匹配在工作

### 2. breakdown（分段匹配详情）

- **含义**：每个 JD 分段（requirements/responsibilities/nice_to_have）的详细匹配信息
- **包含**：
  - `lexicalScore`：关键词匹配分数
  - `semanticScore`：语义匹配分数（✅ 关键指标）
  - `sectionScore`：综合分数（0.6 * lexical + 0.4 * semantic）
  - `confidence`：分段置信度（1.0=高，0.6=中，0.3=低）

### 3. 最终 matchScore

- **计算方式**：加权平均各分段的 `sectionScore`
- **权重**：requirements (55%) * confidence + responsibilities (30%) * confidence + nice_to_have (15%) * confidence
- **验证**：如果 `breakdown` 存在，说明使用了分段匹配；如果 `semanticScore` 存在，说明使用了 Embedding

---

## 常见问题排查

### Q: 为什么看不到 `breakdown`？

**A**: 可能的原因：
1. **简历没有分段数据** → 重新上传/解析简历
2. **岗位没有分段数据** → 运行 `python3 scripts/update_existing_jobs_sections.py`
3. **匹配算法回退** → 检查代码是否使用了 `compute_match_v2`

### Q: `semanticScore` 是 `null`？

**A**: 可能的原因：
1. **Embedding 生成失败** → 检查日志
2. **简历或岗位没有 embeddings** → 重新解析/更新
3. **匹配算法回退** → 检查是否使用了 `match_engine_v2`

### Q: `confidence` 值很低（如 0.3）？

**A**: 这是正常的！说明：
- 分段器使用了 fallback 策略（没有找到清晰的 heading）
- 但算法仍然能正常工作
- 只是权重会降低（`effective_weight = base_weight * confidence`）

### Q: 如何确认 Embedding 真的在工作？

**A**: 检查以下几点：
1. ✅ `semanticScore` 不为 `null`
2. ✅ `breakdown[section].semanticScore` 不为 `null`
3. ✅ 不同岗位的 `semanticScore` 会变化（说明不是硬编码）
4. ✅ 相同岗位，不同简历的 `semanticScore` 会不同

---

## 完整测试流程

1. **准备数据**：
   ```bash
   # 更新岗位分段和embeddings
   cd apps/fastapi-server
   python3 scripts/update_existing_jobs_sections.py
   ```

2. **上传简历**：
   - 在前端上传简历
   - 或调用 `POST /api/resumes` API

3. **解析简历**：
   - 在前端点击"解析简历"
   - 或调用 `POST /api/resumes/{id}/parse` API

4. **测试匹配**：
   - 在前端搜索岗位
   - 或调用 `GET /api/jobs?withMatch=true` API

5. **验证结果**：
   - 检查 API 返回是否有 `semanticScore` 和 `breakdown`
   - 运行测试脚本：`python3 scripts/test_match_v2_detailed.py`

---

## 代码验证

确认代码使用了新算法：

```python
# apps/fastapi-server/app/api/routes/jobs.py
# 第 298 行应该调用 compute_match_v2
m = compute_match_v2(
    resume_keywords=resume_kws,
    job_keywords=job_kws,
    jd_sections_json=j.jd_sections_json,      # ✅ 传递分段数据
    jd_embeddings_json=j.jd_embeddings_json,  # ✅ 传递embedding数据
    cv_sections_json=...,                     # ✅ 传递简历分段
    cv_embeddings_json=...,                   # ✅ 传递简历embedding
)
```

---

## 成功标志

✅ **新算法已生效的标志**：
1. API 返回包含 `semanticScore`（不为 null）
2. API 返回包含 `breakdown` 对象
3. `breakdown` 中每个分段都有 `semanticScore`
4. 不同岗位/简历组合的分数会变化（不是固定值）

❌ **新算法未生效的标志**：
1. `semanticScore` 为 `null`
2. `breakdown` 为 `null`
3. 所有岗位的分数都一样（可能是硬编码）
