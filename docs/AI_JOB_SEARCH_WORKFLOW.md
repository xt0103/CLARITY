# AI Job Search 智能工作流实现说明

## 概述

实现了"本地搜索优先 + GPT 智能聊天"的混合工作流，既保证了搜索的快速响应，又提供了智能对话能力。

## 工作流设计

### 1. 智能路由判断

系统会自动判断用户输入是**搜索查询**还是**聊天问题**：

#### 搜索查询特征（直接调用本地搜索）：
- 短文本（<50字符）
- 包含岗位关键词（如：Software Engineer, Python, 前端开发）
- 不包含问号或聊天关键词
- 示例：
  - "Software Engineer"
  - "Python developer"
  - "前端工程师"
  - "Singapore remote"

#### 聊天问题特征（调用 OpenAI API）：
- 包含问号（? 或 ？）
- 包含聊天关键词（如何、怎么、为什么、建议、推荐等）
- 较长文本（>50字符）
- 示例：
  - "如何准备面试？"
  - "根据我的简历推荐岗位"
  - "我喜欢 Python 和机器学习，有什么建议吗？"

### 2. 处理流程

```
用户输入
    ↓
判断类型（isSearchQuery）
    ↓
┌─────────────┬─────────────┐
│  搜索查询   │  聊天问题   │
│  (true)     │  (false)    │
└──────┬──────┴──────┬──────┘
       │             │
       ↓             ↓
直接调用本地       调用 OpenAI API
search_jobs API     (使用工具调用)
       │             │
       │             ↓
       │        工具必须从本地
       │        DB 获取数据
       │             │
       └──────┬──────┘
              ↓
        更新右侧结果
        更新聊天记录
```

## 实现细节

### 前端实现 (`apps/next-web/app/job-match/page.tsx`)

1. **`isSearchQuery()` 函数**：
   - 分析用户输入文本
   - 检查聊天关键词、问号、长度、岗位关键词
   - 返回 `true`（搜索查询）或 `false`（聊天问题）

2. **`doSearch()` 函数**：
   - 根据 `isSearchQuery()` 的结果选择路由
   - 搜索查询 → 调用 `searchMut.mutate()`（本地搜索）
   - 聊天问题 → 调用 `assistantMut.mutate()`（OpenAI API）

3. **搜索结果处理**：
   - 本地搜索：直接更新结果，添加简单的助手回复
   - GPT 搜索：通过 UI actions 更新结果

### 后端实现

1. **System Prompt** (`apps/fastapi-server/app/assistant/prompt.py`)：
   - 强调所有岗位数据必须从本地数据库获取
   - 禁止编造岗位信息
   - 明确工具使用规则

2. **Assistant Service** (`apps/fastapi-server/app/assistant/service.py`)：
   - 自动获取用户简历信息
   - 将简历关键词添加到 context
   - 确保工具调用从本地 DB 获取数据

3. **工具实现** (`apps/fastapi-server/app/assistant/tools.py`)：
   - `search_jobs`: 从本地数据库搜索岗位
   - `get_job_detail`: 从本地数据库获取岗位详情
   - `create_application`: 创建申请记录

## 优势

1. **性能优化**：
   - 搜索查询直接本地搜索，响应速度快
   - 减少不必要的 OpenAI API 调用，降低成本

2. **智能对话**：
   - 聊天问题使用 GPT，提供智能回复
   - 理解自然语言，提取搜索意图

3. **数据准确性**：
   - 所有岗位数据来自本地数据库
   - AI 不会编造岗位信息
   - 保证数据的真实性和一致性

4. **用户体验**：
   - 快速响应搜索查询
   - 智能理解用户意图
   - 自然流畅的对话体验

## 配置要求

### OpenAI API Key

在 `apps/fastapi-server/.env` 文件中配置：

```bash
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

详细配置说明见：`apps/fastapi-server/OPENAI_SETUP.md`

## 使用示例

### 场景 1：直接搜索岗位
```
用户输入: "Software Engineer"
→ 判断：搜索查询
→ 直接调用本地搜索
→ 快速返回结果
```

### 场景 2：智能聊天
```
用户输入: "根据我的简历推荐岗位"
→ 判断：聊天问题
→ 调用 OpenAI API
→ AI 分析简历关键词
→ 调用 search_jobs 工具（从本地 DB）
→ 返回个性化推荐
```

### 场景 3：混合场景
```
用户输入: "我喜欢 Python，找新加坡的工作"
→ 判断：聊天问题（包含"喜欢"）
→ 调用 OpenAI API
→ AI 提取关键词：Python, Singapore
→ 调用 search_jobs(queryText="Python", filters={location: "Singapore"})
→ 返回匹配结果
```

## 注意事项

1. **API Key 安全**：
   - `.env` 文件不应提交到 Git
   - API key 请妥善保管

2. **成本控制**：
   - 搜索查询不调用 OpenAI，节省成本
   - 只有聊天问题才使用 GPT

3. **数据来源**：
   - 所有岗位数据必须来自本地数据库
   - AI 只负责理解和推荐，不编造数据

## 未来优化方向

1. **更智能的判断**：
   - 使用机器学习模型判断查询类型
   - 提高判断准确率

2. **语义搜索**：
   - 引入 Embeddings 进行语义匹配
   - 提供更准确的搜索结果

3. **个性化推荐**：
   - 分析用户历史搜索偏好
   - 提供更精准的推荐
