# OpenAI API Key 配置说明

## 设置步骤

1. 在 `apps/fastapi-server/` 目录下创建或编辑 `.env` 文件

2. 添加以下配置：

```bash
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

3. 重启后端服务器使配置生效

## 注意事项

- `.env` 文件不应提交到 Git（已在 .gitignore 中）
- API key 请妥善保管，不要泄露
- 如果 API key 失效，请到 https://platform.openai.com/api-keys 生成新的

## 功能说明

配置 OpenAI API key 后，AI Job Search 功能将支持：
- 智能聊天对话（回答职业问题、提供建议等）
- 基于用户输入智能推荐岗位
- 理解自然语言查询并转换为搜索参数

**重要**：所有岗位数据都来自本地数据库，AI 只负责理解和推荐，不会编造岗位信息。
