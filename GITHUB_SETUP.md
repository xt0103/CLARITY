# GitHub 上传指南

## 当前状态
✅ Git 仓库已初始化
✅ 所有文件已添加到暂存区
✅ 初始提交已完成

## 下一步：上传到 GitHub

### 方法 1：通过 GitHub 网页创建仓库（推荐）

1. **在 GitHub 上创建新仓库**
   - 访问 https://github.com/new
   - 输入仓库名称（例如：`clarity-job-seeker`）
   - 选择 Public 或 Private
   - **不要**勾选 "Initialize this repository with a README"（因为本地已有文件）
   - 点击 "Create repository"

2. **连接本地仓库并推送**
   在终端中运行以下命令（将 `YOUR_USERNAME` 和 `YOUR_REPO_NAME` 替换为你的实际值）：

   ```bash
   cd "/Users/xiting/Desktop/nus study/semester2/CDE5301/job-seeker-coding"
   
   # 添加远程仓库
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   
   # 重命名主分支为 main（如果还没有）
   git branch -M main
   
   # 推送到 GitHub
   git push -u origin main
   ```

### 方法 2：使用 SSH（如果已配置 SSH key）

```bash
cd "/Users/xiting/Desktop/nus study/semester2/CDE5301/job-seeker-coding"
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 方法 3：使用 GitHub CLI（如果已安装 gh）

```bash
cd "/Users/xiting/Desktop/nus study/semester2/CDE5301/job-seeker-coding"
gh repo create clarity-job-seeker --public --source=. --remote=origin --push
```

## 注意事项

- 确保 `.gitignore` 文件已正确配置，避免上传敏感信息（如 `.env` 文件）
- 如果遇到认证问题，可能需要配置 GitHub Personal Access Token
- 如果仓库名称包含空格，建议使用连字符（如 `clarity-job-seeker`）

## 验证上传

上传成功后，访问你的 GitHub 仓库页面，应该能看到所有文件。
