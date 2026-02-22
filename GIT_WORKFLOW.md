# Git 工作流指南

## ⚠️ 重要原则

**不要在 `main` 分支上直接开发！**

应该：
1. ✅ 创建功能分支（feature branch）
2. ✅ 在分支上开发
3. ✅ 通过 Pull Request 合并到 main

## 📋 标准工作流

### 1. 日常开发流程（推荐）

```bash
# 1. 确保 main 分支是最新的
git checkout main
git pull origin main

# 2. 创建新功能分支
git checkout -b feature/功能名称
# 例如：
# git checkout -b feature/add-dark-mode
# git checkout -b feature/improve-job-search
# git checkout -b fix/resume-upload-bug

# 3. 在分支上开发
# ... 编写代码 ...

# 4. 提交更改
git add .
git commit -m "feat: 添加新功能描述"

# 5. 推送到远程
git push origin feature/功能名称

# 6. 在 GitHub 创建 Pull Request
# 7. 代码审查通过后合并到 main
```

### 2. 分支命名规范

```bash
# 功能开发
feature/功能名称
# 例如：
feature/user-profile-page
feature/dashboard-charts
feature/job-matching-algorithm

# Bug 修复
fix/问题描述
# 例如：
fix/login-error
fix/resume-upload-bug

# 紧急修复
hotfix/问题描述
# 例如：
hotfix/security-patch

# 代码重构
refactor/模块名称
# 例如：
refactor/api-routes
```

### 3. 更新 main 分支

```bash
# 当你的 PR 合并到 main 后，更新本地 main
git checkout main
git pull origin main

# 删除已完成的功能分支（可选）
git branch -d feature/功能名称
```

## 🚫 不要这样做

### ❌ 错误做法

```bash
# 不要直接在 main 上开发
git checkout main
git add .
git commit -m "更新"
git push origin main  # ❌ 不推荐！
```

**为什么不推荐？**
- 没有代码审查
- 容易产生冲突
- 无法回滚
- 团队协作困难

## ✅ 正确做法

### 场景 1：开发新功能

```bash
# 1. 创建功能分支
git checkout main
git pull origin main
git checkout -b feature/new-feature

# 2. 开发
# ... 编写代码 ...

# 3. 提交
git add .
git commit -m "feat: 新功能描述"
git push origin feature/new-feature

# 4. 创建 PR，等待审查
# 5. 审查通过后合并
```

### 场景 2：修复 Bug

```bash
# 1. 创建修复分支
git checkout main
git pull origin main
git checkout -b fix/bug-description

# 2. 修复
# ... 修复代码 ...

# 3. 提交
git add .
git commit -m "fix: 修复问题描述"
git push origin fix/bug-description

# 4. 创建 PR，快速审查后合并
```

### 场景 3：小改动（可选：直接提交到 main）

**仅适用于：**
- 文档更新（README、注释）
- 小的样式调整
- 配置文件的微小改动

```bash
# 即使是小改动，也建议用分支
git checkout -b docs/update-readme
git add .
git commit -m "docs: 更新 README"
git push origin docs/update-readme
# 创建 PR（可以快速合并）
```

## 🔄 完整工作流示例

### 示例：添加新功能

```bash
# === 第 1 步：准备 ===
git checkout main
git pull origin main

# === 第 2 步：创建分支 ===
git checkout -b feature/add-job-filters

# === 第 3 步：开发 ===
# 编辑文件...
# 测试功能...

# === 第 4 步：提交 ===
git add .
git commit -m "feat: 添加职位筛选功能"
git push origin feature/add-job-filters

# === 第 5 步：创建 PR ===
# 在 GitHub 上：
# 1. 点击 "Pull requests"
# 2. 点击 "New pull request"
# 3. 选择 feature/add-job-filters → main
# 4. 填写 PR 描述
# 5. 创建 PR

# === 第 6 步：代码审查 ===
# 等待团队成员审查
# 根据反馈修改代码

# === 第 7 步：合并 ===
# 审查通过后，合并 PR

# === 第 8 步：清理 ===
git checkout main
git pull origin main
git branch -d feature/add-job-filters  # 删除本地分支
```

## 📊 分支保护（推荐设置）

在 GitHub 仓库设置中启用分支保护：

1. 访问：`https://github.com/xt0103/CLARITY/settings/branches`
2. 添加规则：`main` 分支
3. 启用：
   - ✅ Require a pull request before merging
   - ✅ Require approvals (至少 1 人)
   - ✅ Require status checks to pass

这样可以确保：
- 不能直接推送到 main
- 必须通过 PR
- 必须有人审查

## 🎯 快速参考

```bash
# 创建功能分支
git checkout -b feature/功能名称

# 提交更改
git add .
git commit -m "feat: 描述"
git push origin feature/功能名称

# 更新 main
git checkout main
git pull origin main

# 查看所有分支
git branch -a

# 删除本地分支
git branch -d 分支名称

# 删除远程分支
git push origin --delete 分支名称
```

## 💡 最佳实践总结

1. **永远在分支上开发**，不要直接在 main 上
2. **使用有意义的分支名**（feature/fix/hotfix）
3. **小改动也要用分支**，保持工作流一致
4. **定期更新 main**，保持同步
5. **通过 PR 合并**，确保代码质量
6. **及时删除已完成的分支**，保持仓库整洁

---

**记住：main 分支是稳定版本，所有更改都应该通过分支和 PR 进入！** 🚀
