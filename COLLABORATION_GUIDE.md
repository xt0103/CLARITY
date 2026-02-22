# 团队协作开发指南

## 📋 目录
1. [Git 工作流](#git-工作流)
2. [分支管理策略](#分支管理策略)
3. [Pull Request 流程](#pull-request-流程)
4. [代码审查规范](#代码审查规范)
5. [冲突解决](#冲突解决)
6. [日常开发流程](#日常开发流程)
7. [最佳实践](#最佳实践)

---

## Git 工作流

### 1. 克隆项目

```bash
# 克隆仓库到本地
git clone https://github.com/xt0103/CLARITY.git
cd CLARITY

# 配置用户信息（首次使用）
git config user.name "你的名字"
git config user.email "你的邮箱"
```

### 2. 保持本地代码最新

```bash
# 每次开始工作前，先拉取最新代码
git pull origin main
```

---

## 分支管理策略

### 推荐分支结构

```
main (主分支)
  ├── develop (开发分支，可选)
  ├── feature/功能名称 (功能分支)
  ├── fix/问题描述 (修复分支)
  └── hotfix/紧急修复 (紧急修复分支)
```

### 创建功能分支

```bash
# 从 main 分支创建新功能分支
git checkout main
git pull origin main
git checkout -b feature/user-profile-page

# 或者创建修复分支
git checkout -b fix/login-bug
```

### 分支命名规范

- **功能开发**: `feature/功能名称` (例如: `feature/dashboard-charts`)
- **Bug 修复**: `fix/问题描述` (例如: `fix/resume-upload-error`)
- **紧急修复**: `hotfix/问题描述` (例如: `hotfix/security-patch`)
- **重构**: `refactor/模块名称` (例如: `refactor/api-routes`)

---

## Pull Request 流程

### 1. 开发功能

```bash
# 1. 创建并切换到功能分支
git checkout -b feature/new-feature

# 2. 进行开发，多次提交
git add .
git commit -m "feat: 添加用户头像上传功能"

# 3. 继续开发...
git add .
git commit -m "fix: 修复头像上传大小限制问题"

# 4. 推送到远程仓库
git push origin feature/new-feature
```

### 2. 创建 Pull Request

1. 访问 GitHub: https://github.com/xt0103/CLARITY
2. 点击 **"Pull requests"** → **"New pull request"**
3. 选择你的分支 (`feature/new-feature`) → `main`
4. 填写 PR 信息：
   - **标题**: 清晰描述功能（例如: "添加用户头像上传功能"）
   - **描述**: 
     - 功能说明
     - 修改的文件
     - 测试情况
     - 截图（如果有 UI 改动）
5. 点击 **"Create pull request"**

### 3. 代码审查

- 团队成员审查代码
- 提出修改建议
- 作者根据反馈修改代码
- 审查通过后合并到 `main`

### 4. 合并 PR

- 审查通过后，点击 **"Merge pull request"**
- 选择合并方式：
  - **Create a merge commit** (推荐，保留完整历史)
  - **Squash and merge** (合并为单个提交)
  - **Rebase and merge** (线性历史)

---

## 代码审查规范

### 审查清单

- [ ] 代码符合项目规范
- [ ] 没有明显的 bug
- [ ] 有适当的注释
- [ ] 没有硬编码的敏感信息
- [ ] 测试通过（如果有测试）
- [ ] UI 改动有截图说明

### 审查建议格式

```markdown
**问题位置**: `apps/next-web/app/dashboard/page.tsx:123`

**问题描述**: 这里应该添加错误处理

**建议**: 
```typescript
try {
  // 代码
} catch (error) {
  // 错误处理
}
```
```

---

## 冲突解决

### 1. 预防冲突

```bash
# 开始工作前，先拉取最新代码
git checkout main
git pull origin main

# 然后创建新分支
git checkout -b feature/my-feature
```

### 2. 解决冲突

如果推送时遇到冲突：

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 如果有冲突，Git 会提示
# 3. 打开冲突文件，解决冲突标记
<<<<<<< HEAD
你的代码
=======
别人的代码
>>>>>>> origin/main

# 4. 解决后提交
git add .
git commit -m "resolve: 解决合并冲突"
git push origin feature/my-feature
```

### 3. 使用工具解决冲突

- **VS Code**: 内置冲突解决工具
- **GitHub Desktop**: 可视化解决冲突
- **命令行**: `git mergetool`

---

## 日常开发流程

### 标准工作流

```bash
# 1. 开始新功能
git checkout main
git pull origin main
git checkout -b feature/my-feature

# 2. 开发并提交
git add .
git commit -m "feat: 添加新功能"

# 3. 推送到远程
git push origin feature/my-feature

# 4. 在 GitHub 创建 PR

# 5. PR 合并后，更新本地 main
git checkout main
git pull origin main

# 6. 删除已完成的功能分支（可选）
git branch -d feature/my-feature
```

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
# 功能添加
git commit -m "feat: 添加用户登录功能"

# Bug 修复
git commit -m "fix: 修复登录页面验证错误"

# 文档更新
git commit -m "docs: 更新 API 文档"

# 代码重构
git commit -m "refactor: 重构用户认证模块"

# 样式调整
git commit -m "style: 调整按钮样式"

# 性能优化
git commit -m "perf: 优化数据库查询"

# 测试
git commit -m "test: 添加用户登录测试"
```

---

## 最佳实践

### 1. 分工建议

- **前端开发**: 负责 `apps/next-web/` 目录
- **后端开发**: 负责 `apps/fastapi-server/` 目录
- **数据库**: 负责 `alembic/versions/` 迁移文件
- **文档**: 负责 `docs/` 和 `README.md`

### 2. 代码规范

- **Python**: 遵循 PEP 8，使用 `black` 格式化
- **TypeScript/React**: 使用 ESLint 和 Prettier
- **提交前**: 确保代码可以运行，没有明显错误

### 3. 沟通协作

- **使用 Issues**: 记录 bug 和功能需求
- **使用 Projects**: 管理任务看板
- **使用 Discussions**: 讨论技术方案
- **定期同步**: 每天开始前 `git pull`

### 4. 环境配置

每个成员需要：

```bash
# 后端环境
cd apps/fastapi-server
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 前端环境
cd apps/next-web
npm install
```

### 5. 数据库迁移

```bash
# 拉取新迁移后，运行迁移
cd apps/fastapi-server
alembic upgrade head
```

---

## 常见问题

### Q: 如何查看谁修改了某行代码？

```bash
git blame 文件路径
```

### Q: 如何撤销本地未提交的更改？

```bash
# 撤销所有更改
git checkout .

# 撤销特定文件
git checkout -- 文件路径
```

### Q: 如何查看分支列表？

```bash
# 本地分支
git branch

# 远程分支
git branch -r

# 所有分支
git branch -a
```

### Q: 如何同步远程已删除的分支？

```bash
git fetch --prune
```

---

## 协作工具推荐

1. **GitHub Issues**: 任务管理
2. **GitHub Projects**: 看板管理
3. **GitHub Discussions**: 技术讨论
4. **Discord/Slack**: 实时沟通
5. **VS Code Live Share**: 实时协作编程

---

## 快速参考

```bash
# 克隆项目
git clone https://github.com/xt0103/CLARITY.git

# 创建功能分支
git checkout -b feature/功能名称

# 提交更改
git add .
git commit -m "feat: 功能描述"
git push origin feature/功能名称

# 更新主分支
git checkout main
git pull origin main

# 查看状态
git status
git log --oneline
```

---

## 团队约定

建议团队讨论并约定：

1. **代码审查**: 至少一人审查后才能合并
2. **分支保护**: 主分支需要 PR 才能合并
3. **提交频率**: 每天至少提交一次
4. **沟通时间**: 固定时间同步进度
5. **代码规范**: 统一代码风格和命名

---

祝协作愉快！🚀
