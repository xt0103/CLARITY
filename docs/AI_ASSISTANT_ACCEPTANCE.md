# AI Job Search Assistant - 验收步骤

## 前置条件

1. **后端环境变量配置**
   - 在 `apps/fastapi-server/.env` 中配置：
     ```
     OPENAI_API_KEY=sk-...  # 你的 OpenAI API Key
     OPENAI_MODEL=gpt-4o-mini
     ```

2. **数据库迁移**
   ```bash
   cd apps/fastapi-server
   alembic upgrade head
   ```

3. **确保有 jobs 数据**
   ```bash
   python -m scripts.seed_jobs
   # 或运行 ingestion
   python -m scripts.run_ingest --all
   ```

4. **启动服务**
   - 后端：`uvicorn app.main:app --reload --port 8000`
   - 前端：`npm run dev` (在 `apps/next-web`)

## 验收步骤

### 1. 登录并进入 AI Job Search

1. 访问 `http://localhost:3000/login`
2. 登录后，点击导航栏的 "AI Job Search"
3. 应该看到 AI Job Search 页面（初始显示推荐 jobs）

### 2. 测试基础对话

在聊天输入框中输入：
```
帮我找新加坡 product intern
```

**期望结果**：
- 左侧聊天区显示用户消息和助手回复
- 助手应该调用 `search_jobs` 工具
- 右侧结果栏自动更新，显示匹配的 jobs 列表
- 助手回复应该包含对结果的解释

### 3. 测试对话连续性

继续在聊天中输入：
```
这些岗位哪个更适合我？我简历偏 data/product
```

**期望结果**：
- 助手基于已返回的 jobs 进行分析
- 不编造新的岗位信息
- 提供个性化的建议

### 4. 测试 Job Detail

1. 在右侧结果列表中点击某个 job card
2. 应该跳转到 `/jobs/[jobId]` 详情页
3. 详情页显示完整的 JD、keywords、match score

### 5. 测试 Apply 流程

1. 在 job detail 页面点击 "Apply" 按钮
2. 打开外部链接（如果有）
3. 确认 "I applied"
4. 应该创建 application 记录
5. 跳转到 Tracker 页面，可以看到新创建的申请

### 6. 测试对话历史

1. 刷新页面
2. 之前的对话应该保留（从数据库加载）
3. 可以继续之前的对话

## System Prompt

```
You are a professional career and job search coach helping users find their ideal job opportunities. Your role is to:

1. **Answer career and job search questions** with helpful, personalized advice
2. **Search for real jobs** from the database when users request job searches, recommendations, or filtering
3. **Never make up or invent job listings** - all job information must come from the search_jobs or get_job_detail tools
4. **Provide clear, actionable guidance** based on the user's resume, skills, and preferences

## Rules for Job Search:

- When a user asks to:
  - "find jobs", "search for", "look for", "recommend jobs", "show me jobs"
  - "filter by location/company/type", "jobs in [location]"
  - "apply to [job]", "I want to apply"
  - "tell me about [job title/company]"
  
  You MUST call the appropriate tool:
  - `search_jobs` for searching/filtering jobs
  - `get_job_detail` for specific job information
  - `create_application` when user confirms they want to apply

- If the user's request is unclear (e.g., "find me a job"), ask 1-2 clarifying questions:
  - What location are you interested in?
  - What type of role are you looking for? (e.g., Software Engineer, Product Manager)
  - What industry or company size do you prefer?

- After calling search_jobs, analyze the results and provide:
  - A summary of what you found
  - Which jobs might be a good fit based on the user's profile
  - Key insights about the opportunities

- Always output UI actions in your response:
  - SET_SEARCH_RESULTS: When you call search_jobs, include the jobs in the UI action
  - SET_SEARCH_QUERY: Update the search query/filters shown to the user
  - HIGHLIGHT_JOB: When discussing a specific job, highlight it in the UI

## Response Format:

Your response should include:
1. Natural language explanation for the user
2. UI actions as structured JSON (see tools schema)

Remember: Be helpful, professional, and always use real data from the tools.
```

## Tools Schema

### Tool 1: search_jobs

```json
{
  "type": "function",
  "function": {
    "name": "search_jobs",
    "description": "Search for jobs from the database. Use this when user asks to find, search, filter, or recommend jobs.",
    "parameters": {
      "type": "object",
      "properties": {
        "queryText": {
          "type": "string",
          "description": "Search query text (keywords, job title, skills, etc.)"
        },
        "filters": {
          "type": "object",
          "properties": {
            "location": {"type": "string"},
            "jobType": {"type": "string"},
            "company": {"type": "string"},
            "tags": {"type": "array", "items": {"type": "string"}}
          }
        },
        "limit": {"type": "integer", "default": 20},
        "offset": {"type": "integer", "default": 0},
        "sortBy": {
          "type": "string",
          "enum": ["relevance", "recent", "match"],
          "default": "relevance"
        }
      }
    }
  }
}
```

### Tool 2: get_job_detail

```json
{
  "type": "function",
  "function": {
    "name": "get_job_detail",
    "description": "Get detailed information about a specific job by ID.",
    "parameters": {
      "type": "object",
      "properties": {
        "jobId": {"type": "string"}
      },
      "required": ["jobId"]
    }
  }
}
```

### Tool 3: create_application

```json
{
  "type": "function",
  "function": {
    "name": "create_application",
    "description": "Create a job application record in the tracker.",
    "parameters": {
      "type": "object",
      "properties": {
        "jobId": {"type": "string"},
        "jobSnapshot": {
          "type": "object",
          "properties": {
            "title": {"type": "string"},
            "company": {"type": "string"},
            "location": {"type": "string"},
            "externalUrl": {"type": "string"}
          },
          "required": ["title", "company"]
        },
        "platformSource": {
          "type": "string",
          "enum": ["OFFICIAL", "LINKEDIN", "REFERRAL", "OTHER"],
          "default": "OFFICIAL"
        },
        "dateApplied": {"type": "string"},
        "status": {
          "type": "string",
          "enum": ["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"],
          "default": "APPLIED"
        }
      },
      "required": ["jobSnapshot"]
    }
  }
}
```

## 示例 Tool Call 日志

当用户输入 "帮我找新加坡 product intern" 时，模型应该：

1. **第一次调用**（tool call）：
```json
{
  "id": "call_abc123",
  "type": "function",
  "function": {
    "name": "search_jobs",
    "arguments": "{\"queryText\": \"product intern\", \"filters\": {\"location\": \"Singapore\"}, \"limit\": 20}"
  }
}
```

2. **工具执行结果**：
```json
{
  "jobs": [
    {
      "id": "job-123",
      "title": "Product Intern",
      "company": "Tech Corp",
      "location": "Singapore",
      "matchScore": 85,
      ...
    }
  ],
  "total": 5
}
```

3. **最终响应**：
- Assistant text: "我找到了 5 个新加坡的 product intern 岗位。根据你的简历，我推荐以下几个..."
- UI Actions:
  ```json
  [
    {
      "type": "SET_SEARCH_RESULTS",
      "payload": {
        "jobs": [...],
        "total": 5
      }
    },
    {
      "type": "SET_SEARCH_QUERY",
      "payload": {
        "queryText": "product intern",
        "filters": {"location": "Singapore"}
      }
    }
  ]
  ```

## 新增/修改文件清单

### 后端

**新增文件**：
- `apps/fastapi-server/app/models/assistant_conversation.py`
- `apps/fastapi-server/app/assistant/__init__.py`
- `apps/fastapi-server/app/assistant/prompt.py`
- `apps/fastapi-server/app/assistant/tools.py`
- `apps/fastapi-server/app/assistant/service.py`
- `apps/fastapi-server/app/api/routes/assistant.py`
- `apps/fastapi-server/alembic/versions/08f70cad3dad_add_assistant_conversations_and_messages.py`

**修改文件**：
- `apps/fastapi-server/app/models/__init__.py`
- `apps/fastapi-server/app/core/config.py`
- `apps/fastapi-server/app/main.py`
- `apps/fastapi-server/requirements.txt`

### 前端

**新增文件**：
- `apps/next-web/lib/assistantClient.ts`

**修改文件**：
- `apps/next-web/app/job-match/page.tsx`

## 故障排查

1. **"OpenAI API key not configured"**
   - 检查 `.env` 文件中的 `OPENAI_API_KEY` 是否设置
   - 确保 API key 有效

2. **"Assistant did not return final response"**
   - 可能是 tool calling 循环超过最大次数
   - 检查 OpenAI API 响应是否正常

3. **对话历史不保留**
   - 检查数据库迁移是否运行
   - 检查 `assistant_conversations` 和 `assistant_messages` 表是否存在

4. **UI actions 不生效**
   - 检查浏览器控制台是否有错误
   - 检查 `response.uiActions` 是否正确解析
