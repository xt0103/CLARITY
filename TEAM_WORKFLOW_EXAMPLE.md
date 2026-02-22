# 团队协作工作流示例

## 👥 多人协作流程

### 场景：你和同学同时开发不同功能

---

## 📝 示例场景

假设：
- **你（xiting）**：开发 "用户头像上传" 功能
- **同学 A（alice）**：开发 "职位收藏" 功能
- **同学 B（bob）**：修复 "登录 Bug"

---

## 🔄 完整工作流

### 第 1 步：所有人同步 main 分支

**你、同学 A、同学 B 都执行：**

```bash
# 确保本地 main 是最新的
git checkout main
git pull origin main
```

### 第 2 步：各自创建自己的分支

**你（xiting）执行：**

```bash
git checkout -b feature/user-avatar-upload
# 或者用你的名字标识
git checkout -b feature/xiting-avatar-upload
```

**同学 A（alice）执行：**

```bash
git checkout -b feature/job-favorites
# 或者
git checkout -b feature/alice-job-favorites
```

**同学 B（bob）执行：**

```bash
git checkout -b fix/login-bug
# 或者
git checkout -b fix/bob-login-bug
```

### 第 3 步：各自在自己的分支上开发

**你（xiting）开发：**

```bash
# 在你的分支上
git checkout feature/user-avatar-upload

# 编写代码...
# 编辑 apps/next-web/app/settings/page.tsx
# 编辑 apps/fastapi-server/app/api/routes/auth.py

# 提交
git add .
git commit -m "feat: 添加用户头像上传功能"
git push origin feature/user-avatar-upload
```

**同学 A（alice）开发：**

```bash
# 在同学 A 的分支上
git checkout feature/job-favorites

# 编写代码...
# 编辑 apps/next-web/app/jobs/[jobId]/page.tsx
# 编辑 apps/fastapi-server/app/api/routes/jobs.py

# 提交
git add .
git commit -m "feat: 添加职位收藏功能"
git push origin feature/job-favorites
```

**同学 B（bob）开发：**

```bash
# 在同学 B 的分支上
git checkout fix/login-bug

# 修复代码...
# 编辑 apps/fastapi-server/app/api/routes/auth.py

# 提交
git add .
git commit -m "fix: 修复登录验证错误"
git push origin fix/login-bug
```

### 第 4 步：各自创建 Pull Request

**你（xiting）在 GitHub：**

1. 访问：https://github.com/xt0103/CLARITY
2. 点击 "Pull requests" → "New pull request"
3. 选择：`feature/user-avatar-upload` → `main`
4. 填写 PR 标题：`feat: 添加用户头像上传功能`
5. 填写描述：
   ```
   ## 功能说明
   - 支持用户上传头像
   - 头像显示在 Dashboard 和 Profile 页面
   
   ## 修改文件
   - apps/next-web/app/settings/page.tsx
   - apps/fastapi-server/app/api/routes/auth.py
   
   ## 测试
   - [x] 本地测试通过
   - [x] 上传功能正常
   ```
6. 点击 "Create pull request"
7. 等待审查

**同学 A（alice）在 GitHub：**

1. 同样创建 PR：`feature/job-favorites` → `main`
2. 填写 PR 信息
3. 等待审查

**同学 B（bob）在 GitHub：**

1. 同样创建 PR：`fix/login-bug` → `main`
2. 填写 PR 信息
3. 等待审查

### 第 5 步：代码审查

**审查流程：**

1. **你审查同学 A 的 PR**
   - 查看代码
   - 提出建议（如果有）
   - 批准或请求修改

2. **同学 A 审查你的 PR**
   - 查看代码
   - 提出建议
   - 批准或请求修改

3. **所有人审查同学 B 的 PR**（Bug 修复需要快速审查）

### 第 6 步：合并 PR

**审查通过后：**

1. 点击 "Merge pull request"
2. 选择合并方式（推荐：Create a merge commit）
3. 确认合并

### 第 7 步：更新本地 main 分支

**所有人执行：**

```bash
# 切换到 main
git checkout main

# 拉取最新的 main（包含所有合并的 PR）
git pull origin main

# 删除已完成的分支（可选）
git branch -d feature/user-avatar-upload
git branch -d feature/job-favorites
git branch -d fix/login-bug
```

---

## 🎯 关键要点

### ✅ 正确做法

1. **每个人有自己的分支**
   ```bash
   # 你
   feature/xiting-avatar-upload
   
   # 同学 A
   feature/alice-job-favorites
   
   # 同学 B
   fix/bob-login-bug
   ```

2. **互不干扰**
   - 各自在自己的分支上开发
   - 不会产生冲突
   - 可以随时推送

3. **通过 PR 合并**
   - 所有代码都经过审查
   - 保证代码质量
   - 记录变更历史

### ❌ 错误做法

```bash
# ❌ 不要所有人都在 main 上开发
git checkout main
git add .
git commit -m "我的修改"
git push origin main  # 会产生冲突！

# ❌ 不要共用同一个分支
git checkout -b feature/shared-branch  # 多人共用会冲突
```

---

## 🔀 如果遇到冲突

### 场景：你和同学修改了同一个文件

**解决方法：**

```bash
# 1. 确保你的分支是最新的
git checkout feature/user-avatar-upload
git pull origin main  # 拉取最新的 main

# 2. 如果有冲突，Git 会提示
# 3. 解决冲突后
git add .
git commit -m "resolve: 解决合并冲突"
git push origin feature/user-avatar-upload

# 4. PR 会自动更新
```

---

## 📊 分支状态示例

```
main (主分支)
  ├── feature/xiting-avatar-upload (你的分支)
  │   └── [你的提交]
  │
  ├── feature/alice-job-favorites (同学 A 的分支)
  │   └── [同学 A 的提交]
  │
  └── fix/bob-login-bug (同学 B 的分支)
      └── [同学 B 的提交]
```

**合并后：**

```
main (主分支)
  ├── [你的提交] ← 通过 PR 合并
  ├── [同学 A 的提交] ← 通过 PR 合并
  └── [同学 B 的提交] ← 通过 PR 合并
```

---

## 🚀 快速命令参考

### 开始新功能

```bash
git checkout main
git pull origin main
git checkout -b feature/你的功能名称
```

### 开发过程中

```bash
# 多次提交
git add .
git commit -m "feat: 描述"
git push origin feature/你的功能名称
```

### 完成功能后

```bash
# 1. 在 GitHub 创建 PR
# 2. 等待审查和合并
# 3. 合并后更新本地
git checkout main
git pull origin main
git branch -d feature/你的功能名称
```

---

## 💡 最佳实践

1. **分支命名包含你的名字**（可选但推荐）
   ```bash
   feature/xiting-avatar-upload
   feature/alice-job-favorites
   ```

2. **小步提交，频繁推送**
   ```bash
   # 不要等到全部完成才提交
   # 每完成一个小功能就提交一次
   git commit -m "feat: 添加头像上传按钮"
   git commit -m "feat: 实现头像上传 API"
   git commit -m "feat: 添加头像显示功能"
   ```

3. **PR 描述要清晰**
   - 说明做了什么
   - 列出修改的文件
   - 提供截图（如果有 UI 改动）

4. **及时审查 PR**
   - 不要堆积太多 PR
   - 审查通过后及时合并

---

## 🎓 总结

**你的理解完全正确！**

1. ✅ 各自创建自己的分支
2. ✅ 各自在自己的分支上开发
3. ✅ 各自推送到远程
4. ✅ 各自创建 Pull Request
5. ✅ 互相审查代码
6. ✅ 审查通过后合并到 main

这样每个人都可以独立工作，互不干扰，最后通过 PR 统一合并！🚀
