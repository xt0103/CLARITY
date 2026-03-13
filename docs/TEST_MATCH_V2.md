# 测试新匹配算法指南

## 方法1: 通过浏览器开发者工具（最简单）

### 步骤：

1. **启动后端和前端服务器**

2. **登录系统并上传简历**（如果有的话）

3. **打开浏览器开发者工具**（F12 或 Cmd+Option+I）

4. **访问岗位搜索页面**：
   - 打开 `http://localhost:3000/job-match`
   - 或者打开 `http://localhost:3000/dashboard` 并点击搜索

5. **在 Network 标签页中查看 API 请求**：
   - 找到 `GET /api/jobs?withMatch=true` 请求
   - 点击查看 Response

6. **检查返回的数据结构**：

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
        "semanticScore": 82,  // ✅ 新字段
        "matchedClusters": ["backend", "cloud"],
        "breakdown": {  // ✅ 新字段
          "requirements": {
            "sectionName": "requirements",
            "lexicalScore": 75,
            "semanticScore": 80,
            "sectionScore": 77,
            "confidence": 1.0,
            "matchedKeywords": {...},
            "missingKeywords": {...}
          },
          "responsibilities": {...},
          "nice_to_have": {...}
        }
      }
    }
  ]
}
```

**✅ 如果看到 `semanticScore` 和 `breakdown` 字段，说明新算法已生效！**

---

## 方法2: 使用 curl 命令测试

### 步骤：

1. **获取登录 token**（如果还没有）：
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}'
```

2. **调用岗位搜索 API**：
```bash
curl -X GET "http://localhost:8000/api/jobs?withMatch=true&limit=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  | python3 -m json.tool
```

3. **检查返回的 JSON**，查找：
   - `semanticScore` 字段
   - `breakdown` 对象
   - `breakdown.requirements.confidence` 值

---

## 方法3: 使用 Python 测试脚本

运行测试脚本：

```bash
cd apps/fastapi-server
source .venv/bin/activate
python3 scripts/test_match_v2.py
```

**注意**：需要先上传简历才能看到完整的匹配结果。

---

## 方法4: 前端页面直接查看

### 岗位搜索页面 (`/job-match`)

1. 打开岗位搜索页面
2. 查看岗位卡片上的 Match % 数值
3. 点击岗位查看详情

### 岗位详情页面 (`/jobs/[jobId]`)

1. 打开岗位详情页
2. 查看 Match 面板
3. **新算法会显示**：
   - Match Score（整体匹配度）
   - Keyword Score（关键词匹配）
   - Cluster Score（能力簇匹配）
   - **Semantic Score（语义匹配）** ← 新字段
   - **Breakdown（分段匹配详情）** ← 新字段

---

## 验证要点

### ✅ 新算法已生效的标志：

1. **API 返回包含 `semanticScore`**（0-100 的数值）
2. **API 返回包含 `breakdown` 对象**，包含：
   - `requirements`
   - `responsibilities`
   - `nice_to_have`
3. **每个分段包含**：
   - `lexicalScore`
   - `semanticScore`
   - `sectionScore`
   - `confidence`（0.0-1.0）
   - `matchedKeywords`
   - `missingKeywords`

### ⚠️ 如果只看到旧字段：

- 可能是简历没有分段数据（需要重新解析简历）
- 可能是岗位没有分段数据（需要运行 `update_existing_jobs_sections.py`）
- 可能是 API 回退到了简单匹配算法

---

## 快速检查清单

- [ ] 岗位已分段（运行了 `update_existing_jobs_sections.py`）
- [ ] 简历已分段（上传/解析了简历）
- [ ] API 返回包含 `semanticScore`
- [ ] API 返回包含 `breakdown` 对象
- [ ] `breakdown` 中包含 `requirements`、`responsibilities`、`nice_to_have`
- [ ] 每个分段有 `confidence` 值（0.0-1.0）

---

## 常见问题

### Q: 为什么看不到 `breakdown`？

**A**: 可能的原因：
1. 简历没有分段数据 → 重新上传/解析简历
2. 岗位没有分段数据 → 运行 `update_existing_jobs_sections.py`
3. 匹配算法回退到了简单模式 → 检查数据库字段是否完整

### Q: `semanticScore` 是 `null`？

**A**: 可能的原因：
1. Embedding 生成失败（检查日志）
2. 简历或岗位没有 embeddings → 重新解析/更新
3. 匹配算法回退到了简单模式

### Q: `confidence` 值很低（如 0.3）？

**A**: 这是正常的！说明分段器使用了 fallback 策略（没有找到清晰的 heading），但算法仍然能正常工作。
