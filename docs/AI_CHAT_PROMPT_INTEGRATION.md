# AI Chat Prompt 集成总结

本文档总结 CLARITY 项目中 AI Job Search 助手的 Prompt 集成方式和工作流程。

## 📁 文件结构

```
apps/fastapi-server/
├── app/
│   ├── assistant/
│   │   ├── prompt.py          # 系统 Prompt 定义
│   │   ├── tools.py           # 工具定义和执行器
│   │   └── service.py         # 对话编排服务
│   └── api/
│       └── routes/
│           └── assistant.py    # API 路由端点
```

## 🎯 核心组件

### 1. 系统 Prompt (`app/assistant/prompt.py`)

**位置**: `apps/fastapi-server/app/assistant/prompt.py`

**内容**: `SYSTEM_PROMPT` 常量，定义了 AI 助手的角色、规则和响应格式。

**关键特性**:
- **角色定位**: 专业的 AI 求职助手和职业教练
- **工具使用规则**: 明确何时使用工具，何时直接回答
- **数据真实性**: 严禁编造岗位信息，所有数据必须来自本地数据库
- **响应质量**: 要求个性化、上下文相关的回复，避免模板化回复

**主要规则**:
1. ✅ **应该使用工具的情况**:
   - 用户明确要求搜索/推荐岗位 → 调用 `search_jobs`
   - 用户询问特定岗位详情 → 调用 `get_job_detail`
   - 用户确认申请 → 调用 `create_application`

2. ❌ **不应该使用工具的情况**:
   - 一般性职业问题（面试准备、简历写作、职业建议）
   - 求职技巧咨询
   - 直接回答即可，无需调用工具

3. 🔒 **数据真实性要求**:
   - 所有岗位数据必须来自 `search_jobs` 工具
   - 禁止编造岗位标题、公司、描述
   - 如果搜索无结果，诚实告知用户

### 2. 工具定义 (`app/assistant/tools.py`)

**位置**: `apps/fastapi-server/app/assistant/tools.py`

**工具列表**:
1. **`search_jobs`**: 从本地数据库搜索岗位
   - 参数: `queryText`, `filters`, `limit`, `offset`, `sortBy`
   - 返回: 岗位列表（包含匹配分数、关键词等）

2. **`get_job_detail`**: 获取特定岗位的详细信息
   - 参数: `jobId`
   - 返回: 完整的岗位详情

3. **`create_application`**: 创建申请记录
   - 参数: `jobId`, `jobSnapshot`, `platformSource`, `dateApplied`, `status`
   - 返回: 创建的申请信息

**工具 Schema**: `TOOLS_SCHEMA` 数组，符合 OpenAI Function Calling 格式。

### 3. 对话服务 (`app/assistant/service.py`)

**位置**: `apps/fastapi-server/app/assistant/service.py`

**核心函数**: `chat_with_assistant()`

**工作流程**:

#### 步骤 1: 路由判断 (`looks_like_quick_search`)

```python
def looks_like_quick_search(text: str) -> bool:
    """
    判断输入是否为快速搜索查询
    - True: DIRECT_SEARCH 模式（直接查数据库，不调用 OpenAI）
    - False: LLM_CHAT 模式（调用 OpenAI）
    """
```

**判断规则**:
1. **聊天意图词黑名单**: 包含 "怎么"、"如何"、"建议"、"准备" 等 → 强制 `LLM_CHAT`
2. **问号检测**: 包含 `?` 或 `？` → 强制 `LLM_CHAT`
3. **明确搜索动词**: 包含 "找工作"、"search jobs" 等 → `DIRECT_SEARCH`
4. **关键词短语**: 短文本（≤30字符）、无标点、词数≤6 → `DIRECT_SEARCH`

#### 步骤 2A: DIRECT_SEARCH 路径

```python
if is_quick_search:
    # 直接查询本地数据库
    search_result = execute_search_jobs(...)
    # 返回简短回复 + UI actions
    return {
        "assistantText": "我找到了 X 个匹配的岗位...",
        "uiActions": [SET_SEARCH_RESULTS, SET_SEARCH_QUERY]
    }
```

**特点**:
- 不调用 OpenAI API（节省成本）
- 快速响应
- 适用于明确的搜索查询

#### 步骤 2B: LLM_CHAT 路径

```python
# 1. 构建消息列表
messages = [
    {"role": "system", "content": SYSTEM_PROMPT},  # 系统 Prompt
    {"role": "system", "content": context_str},    # 增强上下文
    ...conversation_history...,                     # 历史消息
    {"role": "user", "content": message}            # 当前用户消息
]

# 2. 获取用户简历关键词（用于个性化推荐）
resume_keywords = _get_resume_keywords_for_user(...)
if resume_keywords:
    enhanced_context["resume"] = {
        "hasResume": True,
        "keywords": resume_keywords,
        "skills": [...],
        "tools": [...],
        ...
    }

# 3. 调用 OpenAI API
response = client.chat.completions.create(
    model=settings.OPENAI_MODEL,
    messages=messages,
    tools=TOOLS_SCHEMA,        # 工具定义
    tool_choice="auto",         # 让模型决定是否使用工具
    temperature=0.8
)

# 4. 处理工具调用（如果有）
if assistant_message.tool_calls:
    for tool_call in assistant_message.tool_calls:
        result = execute_tool(tool_name, arguments, db, user_id)
        # 将工具结果添加回消息列表，继续对话

# 5. 生成最终回复
final_assistant_text = assistant_message.content
```

**特点**:
- 调用 OpenAI API
- 支持工具调用（Tool Calling）
- 个性化推荐（基于简历关键词）
- 多轮对话支持

### 4. API 路由 (`app/api/routes/assistant.py`)

**位置**: `apps/fastapi-server/app/api/routes/assistant.py`

**端点**: `POST /api/assistant/chat`

**请求格式**:
```json
{
  "message": "找软件工程师",
  "conversationId": "optional-conversation-id",
  "context": {
    "activeJobId": "optional",
    "searchState": {}
  }
}
```

**响应格式**:
```json
{
  "conversationId": "conversation-id",
  "assistantText": "我找到了 45 个匹配的岗位...",
  "uiActions": [
    {
      "type": "SET_SEARCH_RESULTS",
      "payload": {
        "jobs": [...],
        "total": 45
      }
    },
    {
      "type": "SET_SEARCH_QUERY",
      "payload": {
        "queryText": "软件工程师",
        "filters": {}
      }
    }
  ],
  "debug": {
    "mode": "LLM_CHAT",
    "quick_search": false
  }
}
```

## 🔄 完整工作流程

### 场景 1: 快速搜索（DIRECT_SEARCH）

```
用户输入: "software engineer singapore"
    ↓
looks_like_quick_search() → True
    ↓
DIRECT_SEARCH 模式
    ↓
execute_search_jobs() → 查询本地数据库
    ↓
返回结果 + 简短回复
    ↓
前端更新右侧岗位列表
```

**日志输出**:
```
[Assistant] Mode: DIRECT_SEARCH, quick_search: True, Message: software engineer singapore
```

### 场景 2: 聊天问题（LLM_CHAT，无工具调用）

```
用户输入: "如何准备产品面试？"
    ↓
looks_like_quick_search() → False (包含"如何")
    ↓
LLM_CHAT 模式
    ↓
构建消息: [SYSTEM_PROMPT, context, history, user_message]
    ↓
调用 OpenAI API (tools=TOOLS_SCHEMA, tool_choice="auto")
    ↓
模型判断: 这是聊天问题，不调用工具
    ↓
返回: 面试准备建议（直接回答）
    ↓
前端显示在聊天区域
```

**日志输出**:
```
[Assistant] Mode: LLM_CHAT, quick_search: False, Message: 如何准备产品面试？
[Assistant] LLM_CHAT completed - mode: LLM_CHAT, assistantText_len: 245, tool_calls_count: 0
```

### 场景 3: 推荐请求（LLM_CHAT，有工具调用）

```
用户输入: "根据我的简历推荐10个岗位"
    ↓
looks_like_quick_search() → False (包含"推荐")
    ↓
LLM_CHAT 模式
    ↓
构建消息: [SYSTEM_PROMPT, resume_context, history, user_message]
    ↓
调用 OpenAI API
    ↓
模型判断: 需要调用 search_jobs 工具
    ↓
执行工具: execute_search_jobs(sortBy="match")
    ↓
工具返回: 岗位列表（已按匹配分数排序）
    ↓
将工具结果添加回消息列表
    ↓
再次调用 OpenAI API（获取最终回复）
    ↓
模型分析结果，生成个性化回复
    ↓
返回: 个性化推荐 + UI actions (SET_SEARCH_RESULTS)
    ↓
前端更新右侧岗位列表 + 显示聊天回复
```

**日志输出**:
```
[Assistant] Mode: LLM_CHAT, quick_search: False, Message: 根据我的简历推荐10个岗位
[Assistant] LLM_CHAT completed - mode: LLM_CHAT, assistantText_len: 312, tool_calls_count: 1
```

## 📊 上下文增强机制

### 简历关键词注入

```python
# 获取用户默认简历的关键词
resume_keywords = _get_resume_keywords_for_user(db, user_id, resume_id)

# 构建增强上下文
if resume_keywords:
    enhanced_context["resume"] = {
        "hasResume": True,
        "keywords": resume_keywords,
        "skills": resume_keywords.get("skills", []),
        "tools": resume_keywords.get("tools", []),
        "domain": resume_keywords.get("domain", []),
        "titles": resume_keywords.get("titles", []),
    }
```

**效果**: AI 可以根据用户的技能和经验，提供更精准的岗位推荐。

### 对话历史管理

```python
# 从数据库加载历史消息
messages_db = db.scalars(
    select(AssistantMessage)
    .where(AssistantMessage.conversation_id == conversation_id)
    .order_by(AssistantMessage.created_at)
).all()

# 添加到消息列表（包括工具调用和结果）
for msg in messages_db:
    if msg.role == "assistant" and msg.tool_calls_json:
        # 恢复工具调用历史
        messages.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": json.loads(msg.tool_calls_json)
        })
        # 恢复工具结果
        if msg.tool_results_json:
            messages.extend(json.loads(msg.tool_results_json))
```

**效果**: 支持多轮对话，AI 可以理解上下文。

## 🎨 UI Actions 机制

**目的**: 让后端控制前端 UI 更新，实现前后端解耦。

**支持的 Action 类型**:
1. **`SET_SEARCH_RESULTS`**: 更新右侧岗位列表
   ```json
   {
     "type": "SET_SEARCH_RESULTS",
     "payload": {
       "jobs": [...],
       "total": 45
     }
   }
   ```

2. **`SET_SEARCH_QUERY`**: 更新搜索框和筛选器
   ```json
   {
     "type": "SET_SEARCH_QUERY",
     "payload": {
       "queryText": "软件工程师",
       "filters": {"location": "Singapore"}
     }
   }
   ```

3. **`HIGHLIGHT_JOB`**: 高亮特定岗位
   ```json
   {
     "type": "HIGHLIGHT_JOB",
     "payload": {
       "jobId": "job-123"
     }
   }
   ```

4. **`SHOW_TOAST`**: 显示提示消息
   ```json
   {
     "type": "SHOW_TOAST",
     "payload": {
       "message": "申请已创建",
       "level": "success"
     }
   }
   ```

## 🔍 关键设计决策

### 1. 双模式路由（DIRECT_SEARCH vs LLM_CHAT）

**原因**:
- **成本优化**: 简单搜索不调用 OpenAI，节省 API 费用
- **响应速度**: 直接查询数据库更快
- **用户体验**: 明确搜索查询立即返回结果

### 2. 工具始终可用（Tools Always On）

**原因**:
- 让 AI 自主决定何时使用工具
- 支持复杂的多步骤对话（如：先搜索，再分析，再推荐）
- 符合 OpenAI 的最佳实践

### 3. 简历关键词自动注入

**原因**:
- 提供个性化推荐
- 提高匹配准确性
- 无需用户重复输入技能信息

### 4. 禁止编造数据

**原因**:
- 保证数据真实性
- 避免误导用户
- 建立用户信任

## 📝 Prompt 优化要点

### 当前 Prompt 的关键特性

1. **明确的角色定义**: "professional AI job search assistant and career coach"
2. **清晰的工具使用规则**: 详细说明何时使用/不使用工具
3. **数据真实性要求**: 多次强调禁止编造数据
4. **响应质量要求**: 要求个性化、上下文相关的回复
5. **示例驱动**: 提供好的和坏的回复示例

### 持续优化方向

1. **更精确的工具使用规则**: 根据实际使用情况调整
2. **更丰富的上下文**: 考虑添加用户历史申请、偏好等
3. **多语言支持**: 优化中英文混合场景
4. **错误处理**: 改进工具调用失败时的回复

## 🚀 使用示例

### 后端调用

```python
from app.assistant.service import chat_with_assistant

result = chat_with_assistant(
    db=db,
    user_id="user-123",
    message="找软件工程师",
    conversation_id=None,  # 新对话
    context={}
)

print(result["assistantText"])  # "我找到了 45 个匹配的岗位..."
print(result["uiActions"])      # [SET_SEARCH_RESULTS, ...]
```

### 前端调用

```typescript
import { assistantClient } from "@/lib/assistantClient";

const response = await assistantClient.chat({
  message: "找软件工程师",
  conversationId: null,
  context: {}
});

// 处理 UI actions
for (const action of response.uiActions) {
  if (action.type === "SET_SEARCH_RESULTS") {
    setJobs(action.payload.jobs);
  }
}
```

## 📚 相关文档

- [API Contract](./API_CONTRACT.md) - API 接口规范
- [Data Dictionary](./DATA_DICTIONARY_MIN.md) - 数据字典
- [Match Engine](./MATCH_ENGINE.md) - 匹配引擎说明（如存在）

## 🔧 配置要求

### 环境变量

```bash
# .env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini  # 或其他支持的模型
```

### 依赖包

```txt
openai==1.54.5
```

## ✅ 验收标准

1. ✅ 快速搜索查询直接查数据库，不调用 OpenAI
2. ✅ 聊天问题调用 OpenAI，不触发工具
3. ✅ 推荐请求调用 OpenAI + 工具，返回真实数据
4. ✅ 所有岗位数据来自本地数据库
5. ✅ 回复个性化，不模板化
6. ✅ 支持多轮对话
7. ✅ UI actions 正确更新前端

---

**最后更新**: 2026-02-23
**维护者**: CLARITY Team
