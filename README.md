# CLARITY — Job Seeker Web App

> 一个智能求职助手平台，帮助求职者管理简历、匹配职位、追踪申请进度。

[![GitHub](https://img.shields.io/github/license/xt0103/CLARITY)](https://github.com/xt0103/CLARITY)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)

## 📋 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [API 文档](#api-文档)
- [团队协作](#团队协作)
- [许可证](#许可证)

## ✨ 功能特性

### 核心功能

- **👤 用户认证**
  - 用户注册/登录
  - JWT Token 认证
  - 个人信息管理

- **📄 简历管理**
  - 上传 PDF/DOCX 简历（自动提取文本）
  - 模块化简历编辑（个人信息、工作经历、教育背景、技能、项目等）
  - 关键词自动提取
  - 多份简历管理，设置默认简历

- **🔍 智能职位匹配**
  - 职位搜索（支持关键词、地点、公司筛选）
  - 智能匹配评分（基于关键词和技能聚类）
  - 匹配详情展示（匹配/缺失的关键词）
  - 职位关键词自动提取和分类

- **📊 申请追踪**
  - 申请记录管理
  - 状态更新（Applied / Under Review / Interview / Offer / Rejected）
  - 申请阶段追踪
  - 申请链接管理

- **📈 Dashboard 统计**
  - 申请总数、面试、Offer、响应率统计
  - 申请状态分布（饼图可视化）
  - 每日推荐职位（基于匹配度）
  - 个人资料完成度

- **🛠️ AI 工具集**
  - 生产力工具箱
  - 多种 AI 辅助工具（占位，待开发）

### 技术亮点

- **智能关键词提取**：基于词典和统计方法，自动识别技能、工具、领域等
- **多层级匹配算法**：精确匹配、别名匹配、聚类匹配，提供可解释的匹配结果
- **双环境数据库支持**：SQLite（开发）和 PostgreSQL（生产）
- **实时职位数据**：支持从 Greenhouse、Lever 等平台导入职位数据

## 🛠️ 技术栈

### 后端

- **框架**: FastAPI 0.104+
- **ORM**: SQLAlchemy 2.0+
- **数据库迁移**: Alembic
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **认证**: JWT (JSON Web Tokens)
- **密码加密**: bcrypt
- **文件处理**: pypdf, python-docx
- **HTTP 客户端**: httpx, requests

### 前端

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **UI**: React 18+
- **数据获取**: React Query (TanStack Query)
- **HTTP 客户端**: Fetch API
- **样式**: CSS-in-JS (内联样式)

## 📁 项目结构

```
CLARITY/
├── apps/
│   ├── fastapi-server/          # 后端 API 服务
│   │   ├── app/
│   │   │   ├── api/routes/      # API 路由
│   │   │   ├── core/            # 核心配置和工具
│   │   │   ├── models/          # SQLAlchemy 模型
│   │   │   ├── schemas/         # Pydantic 模式
│   │   │   ├── ingest/          # 职位数据导入
│   │   │   ├── match/           # 匹配引擎
│   │   │   └── nlp/             # 自然语言处理
│   │   ├── alembic/             # 数据库迁移
│   │   ├── scripts/             # 工具脚本
│   │   └── requirements.txt
│   │
│   └── next-web/                # 前端 Web 应用
│       ├── app/                 # Next.js App Router 页面
│       ├── components/          # React 组件
│       ├── lib/                 # 工具函数和 API 客户端
│       └── public/              # 静态资源
│
├── specs/                       # 项目规范文档
│   ├── PRD.md                  # 产品需求文档
│   ├── TECH_SPEC.md            # 技术规范
│   └── API_CONTRACT.md         # API 契约
│
├── docs/                        # 文档
│   └── DATA_DICTIONARY_MIN.md  # 数据字典
│
├── data/                        # 数据文件
│   ├── seed_jobs.json          # 种子职位数据
│   └── seed_sources_sg_cn.json # 职位源配置
│
├── env/                         # 环境变量模板
│   ├── .env.dev.example        # 开发环境模板
│   └── .env.prod.example       # 生产环境模板
│
└── Rules/                       # 开发规则和提示
    └── PROMPT.md               # 开发提示词
```

## 🚀 快速开始

### 前置要求

- **Python**: 3.10+ (推荐 3.11)
- **Node.js**: 18+ (推荐 20+)
- **数据库**: SQLite (开发) 或 PostgreSQL (生产)

### 1. 克隆项目

```bash
git clone https://github.com/xt0103/CLARITY.git
cd CLARITY
```

### 2. 后端设置

```bash
cd apps/fastapi-server

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 创建环境变量文件
cp ../../env/.env.dev.example .env

# 编辑 .env 文件，设置 JWT_SECRET
# DATABASE_URL=sqlite:///./looogo_dev.db
# JWT_SECRET=your_long_random_secret_key_here

# 运行数据库迁移
alembic upgrade head

# 导入种子数据（可选）
python -m scripts.seed_jobs
python -m scripts.seed_sources

# 启动后端服务
uvicorn app.main:app --reload --port 8000
```

后端服务将在 `http://localhost:8000` 启动。

### 3. 前端设置

```bash
cd apps/next-web

# 安装依赖
npm install

# 创建环境变量文件
cp env.example .env.local

# 编辑 .env.local，确保 API 地址正确
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 启动前端服务
npm run dev
```

前端应用将在 `http://localhost:3000` 启动。

### 4. 访问应用

1. 打开浏览器访问 `http://localhost:3000`
2. 注册新账户或登录
3. 上传简历或使用模块化编辑器创建简历
4. 开始搜索和匹配职位！

## 📖 开发指南

### 数据库迁移

```bash
cd apps/fastapi-server

# 创建新迁移
alembic revision --autogenerate -m "描述"

# 应用迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 导入职位数据

```bash
cd apps/fastapi-server

# 从 Remotive API 导入职位
python -m scripts.import_jobs_remotive

# 从配置的职位源导入（Greenhouse/Lever）
python -m scripts.run_ingest --all
```

### 代码规范

- **Python**: 遵循 PEP 8，使用类型提示
- **TypeScript**: 使用 ESLint 和 Prettier
- **提交信息**: 使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范

### 环境变量

详细的环境变量配置请参考：
- `env/.env.dev.example` - 开发环境
- `env/.env.prod.example` - 生产环境
- `env/ENV_TEMPLATES.md` - 完整说明

## 📚 API 文档

### 主要端点

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/me` - 获取当前用户信息
- `GET /api/jobs` - 搜索职位
- `GET /api/jobs/{jobId}` - 获取职位详情
- `POST /api/applications` - 创建申请记录
- `GET /api/applications` - 获取申请列表
- `GET /api/metrics/dashboard` - 获取 Dashboard 统计

完整的 API 文档请参考 `specs/API_CONTRACT.md`。

### API 文档（Swagger）

启动后端服务后，访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 👥 团队协作

### 协作流程

1. **克隆项目**
   ```bash
   git clone https://github.com/xt0103/CLARITY.git
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/功能名称
   ```

3. **开发并提交**
   ```bash
   git add .
   git commit -m "feat: 功能描述"
   git push origin feature/功能名称
   ```

4. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 等待代码审查
   - 审查通过后合并

详细的协作指南请参考 `COLLABORATION_GUIDE.md`。

### 分支策略

- `main` - 主分支，稳定版本
- `feature/*` - 功能开发分支
- `fix/*` - Bug 修复分支
- `hotfix/*` - 紧急修复分支

## 🗂️ 相关文档

- [产品需求文档](./specs/PRD.md)
- [技术规范](./specs/TECH_SPEC.md)
- [API 契约](./specs/API_CONTRACT.md)
- [数据字典](./docs/DATA_DICTIONARY_MIN.md)
- [团队协作指南](./COLLABORATION_GUIDE.md)

## 🐛 问题反馈

如遇到问题，请：
1. 查看 [Issues](https://github.com/xt0103/CLARITY/issues)
2. 创建新的 Issue 描述问题
3. 或使用 Discussions 进行讨论

## 📝 许可证

本项目采用 MIT 许可证。详情请查看 [LICENSE](./LICENSE) 文件。

## 🙏 致谢

感谢所有贡献者和使用者的支持！

---

**CLARITY** - 让求职更清晰、更高效 🚀
