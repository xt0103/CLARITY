# AI Job Search Assistant 实现总结

## 实现概述

实现了基于 OpenAI tool-calling 的 AI Job Search 对话助手，支持：
- 自然语言对话（求职教练角色）
- 自动调用工具搜索真实岗位
- 实时更新右侧结果栏
- 对话历史持久化

## 新增/修改文件清单

### 后端文件

#### 新增文件

1. **`apps/fastapi-server/app/models/assistant_conversation.py`**
   - `AssistantConversation` 模型：存储对话会话
   - `AssistantMessage` 模型：存储对话消息（user/assistant/system）

2. **`apps/fastapi-server/app/assistant/__init__.py`**
   - Assistant 模块初始化

3. **`apps/fastapi-server/app/assistant/prompt.py`**
   - `SYSTEM_PROMPT`：系统提示词，定义助手角色和规则

4. **`apps/fastapi-server/app/assistant/tools.py`**
   - `TOOLS_SCHEMA`：OpenAI tool calling schema（3个工具）
   - `execute_search_jobs`：执行岗位搜索
   - `execute_get_job_detail`：获取岗位详情
   - `execute_create_application`：创建申请记录
   - `execute_tool`：工具执行器入口

5. **`apps/fastapi-server/app/assistant/service.py`**
   - `chat_with_assistant`：核心对话编排逻辑
   - 处理 OpenAI API 调用
   - 处理 tool calling 循环
   - 生成 UI actions

6. **`apps/fastapi-server/app/api/routes/assistant.py`**
   - `POST /api/assistant/chat`：对话 API 端点

7. **`apps/fastapi-server/alembic/versions/08f70cad3dad_add_assistant_conversations_and_messages.py`**
   - 数据库迁移：创建 `assistant_conversations` 和 `assistant_messages` 表

#### 修改文件

1. **`apps/fastapi-server/app/models/__init__.py`**
   - 添加 `AssistantConversation` 和 `AssistantMessage` 导入

2. **`apps/fastapi-server/app/core/config.py`**
   - 添加 `OPENAI_API_KEY` 和 `OPENAI_MODEL` 配置项

3. **`apps/fastapi-server/app/main.py`**
   - 注册 `assistant_router`

4. **`apps/fastapi-server/requirements.txt`**
   - 添加 `openai==1.54.5`

5. **`apps/fastapi-server/README.md`**
   - 添加 OpenAI 配置说明

### 前端文件

#### 新增文件

1. **`apps/next-web/lib/assistantClient.ts`**
   - `assistantClient.chat`：调用 `/api/assistant/chat` API
   - TypeScript 类型定义（`ChatRequest`, `ChatResponse`, `UIAction`）

#### 修改文件

1. **`apps/next-web/app/job-match/page.tsx`**
   - 添加 `assistantMut` mutation
   - 添加 `conversationId` 和 `chatMessages` 状态
   - 修改 `doSearch` 使用 assistant API
   - 更新聊天界面显示真实消息
   - 处理 UI actions（SET_SEARCH_RESULTS, SET_SEARCH_QUERY 等）

## System Prompt

完整内容见 `apps/fastapi-server/app/assistant/prompt.py`。

核心要点：
- 角色：职业/求职教练
- 规则：必须使用工具获取真实岗位，不允许编造
- 触发条件：当用户请求搜索/岗位/申请时，必须调用相应工具
- 输出格式：自然语言 + UI actions

## Tools Schema

### Tool 1: search_jobs

**用途**：搜索岗位

**参数**：
- `queryText` (string, optional): 搜索关键词
- `filters` (object, optional): 筛选条件
  - `location` (string): 地点
  - `jobType` (string): 工作类型
  - `company` (string): 公司名
  - `tags` (array): 标签/技能
- `limit` (integer, default: 20): 结果数量
- `offset` (integer, default: 0): 分页偏移
- `sortBy` (string, enum: ["relevance", "recent", "match"], default: "relevance"): 排序方式

**返回**：
```json
{
  "jobs": [...],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### Tool 2: get_job_detail

**用途**：获取岗位详情

**参数**：
- `jobId` (string, required): 岗位 ID

**返回**：
```json
{
  "id": "...",
  "title": "...",
  "company": "...",
  "descriptionText": "...",
  "match": {...},
  ...
}
```

### Tool 3: create_application

**用途**：创建申请记录

**参数**：
- `jobId` (string, optional): 岗位 ID
- `jobSnapshot` (object, required): 岗位快照
  - `title` (string, required)
  - `company` (string, required)
  - `location` (string, optional)
  - `externalUrl` (string, optional)
- `platformSource` (string, enum, default: "OFFICIAL")
- `dateApplied` (string, optional): YYYY-MM-DD
- `status` (string, enum, default: "APPLIED")

**返回**：
```json
{
  "id": "...",
  "jobId": "...",
  "snapshotTitle": "...",
  "snapshotCompany": "...",
  "status": "APPLIED",
  "dateApplied": "2026-02-23"
}
```

## UI Actions 规范

### SET_SEARCH_RESULTS

更新右侧结果栏的 jobs 列表。

```typescript
{
  type: "SET_SEARCH_RESULTS",
  payload: {
    jobs: JobListItem[],
    total: number
  }
}
```

### SET_SEARCH_QUERY

更新搜索查询和筛选条件。

```typescript
{
  type: "SET_SEARCH_QUERY",
  payload: {
    queryText: string,
    filters: Record<string, any>
  }
}
```

### HIGHLIGHT_JOB

高亮显示某个岗位（可选）。

```typescript
{
  type: "HIGHLIGHT_JOB",
  payload: {
    jobId: string
  }
}
```

### SHOW_TOAST

显示提示消息（可选）。

```typescript
{
  type: "SHOW_TOAST",
  payload: {
    message: string,
    level: "success" | "error" | "info"
  }
}
```

## 技术实现细节

### 后端

1. **对话存储**：使用 SQLite 表存储对话历史，支持页面刷新后恢复
2. **Tool Calling 流程**：
   - 发送 system prompt + 历史消息 + 用户消息 + tools schema
   - 如果模型返回 tool calls → 执行工具 → 将结果回传
   - 再次调用模型获取最终响应
   - 最多 3 次迭代防止无限循环

3. **UI Actions 生成**：
   - 优先从模型响应中解析 JSON
   - 如果未找到，根据 tool calls 自动生成

### 前端

1. **对话管理**：
   - 使用 `conversationId` 维护对话会话
   - `chatMessages` 状态存储当前会话的消息
   - 发送消息后自动追加到消息列表

2. **UI Actions 处理**：
   - `SET_SEARCH_RESULTS` → 更新 `result` 状态
   - `SET_SEARCH_QUERY` → 更新 `queryText` 状态
   - `HIGHLIGHT_JOB` → 可跳转到详情页
   - `SHOW_TOAST` → 显示提示（当前使用 alert）

## 下一步优化建议

1. **对话历史加载**：添加 API 端点加载历史对话
2. **流式响应**：使用 SSE 或 WebSocket 实现流式输出
3. **错误处理**：更完善的错误提示和重试机制
4. **UI 优化**：更好的 loading 状态、消息动画
5. **多轮对话优化**：更好的上下文理解
