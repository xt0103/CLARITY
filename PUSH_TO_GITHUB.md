# 推送到 GitHub 仓库

## 仓库信息
- 仓库地址：https://github.com/xt0103/CLARITY
- 远程已配置：✅
- 本地提交：✅ 已完成

## 推送方法

### 方法 1：使用 Personal Access Token（推荐）

1. **创建 Personal Access Token**
   - 访问：https://github.com/settings/tokens
   - 点击 "Generate new token" → "Generate new token (classic)"
   - 输入名称（如：CLARITY Upload）
   - 选择过期时间
   - 勾选权限：`repo`（完整仓库权限）
   - 点击 "Generate token"
   - **复制生成的 token**（只显示一次！）

2. **使用 token 推送**
   在终端运行：
   ```bash
   cd "/Users/xiting/Desktop/nus study/semester2/CDE5301/job-seeker-coding"
   git push -u origin main
   ```
   
   当提示输入用户名时，输入：`xt0103`
   当提示输入密码时，**粘贴你的 Personal Access Token**（不是 GitHub 密码）

### 方法 2：使用 SSH（如果已配置 SSH key）

1. **检查是否已有 SSH key**
   ```bash
   ls -la ~/.ssh
   ```

2. **如果没有，生成 SSH key**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # 按 Enter 使用默认路径
   # 可以设置密码或直接按 Enter
   ```

3. **添加 SSH key 到 GitHub**
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # 复制输出的内容
   ```
   - 访问：https://github.com/settings/keys
   - 点击 "New SSH key"
   - 粘贴公钥内容
   - 保存

4. **更改远程地址为 SSH**
   ```bash
   cd "/Users/xiting/Desktop/nus study/semester2/CDE5301/job-seeker-coding"
   git remote set-url origin git@github.com:xt0103/CLARITY.git
   git push -u origin main
   ```

### 方法 3：使用 GitHub CLI（如果已安装 gh）

```bash
cd "/Users/xiting/Desktop/nus study/semester2/CDE5301/job-seeker-coding"
gh auth login
git push -u origin main
```

## 验证

推送成功后，访问 https://github.com/xt0103/CLARITY 应该能看到所有文件。

## 注意事项

- 如果远程仓库已有内容，可能需要先拉取：`git pull origin main --allow-unrelated-histories`
- 如果遇到冲突，需要解决后再推送
- 确保 `.gitignore` 已正确配置，避免上传敏感文件
