#!/bin/bash

# 推送到 GitHub 的辅助脚本

echo "🚀 准备推送到 GitHub..."
echo "仓库: https://github.com/xt0103/CLARITY"
echo ""

# 检查远程仓库配置
git remote -v

echo ""
echo "请选择认证方式："
echo "1. 使用 Personal Access Token (推荐)"
echo "2. 使用 SSH (需要先配置 SSH key)"
echo ""
read -p "请输入选项 (1 或 2): " choice

if [ "$choice" == "1" ]; then
    echo ""
    echo "📝 使用 Personal Access Token 方式"
    echo ""
    echo "如果还没有创建 Token，请访问："
    echo "https://github.com/settings/tokens"
    echo ""
    echo "创建步骤："
    echo "1. 点击 'Generate new token' → 'Generate new token (classic)'"
    echo "2. 勾选 'repo' 权限"
    echo "3. 生成并复制 token"
    echo ""
    read -p "准备好后按 Enter 继续..."
    
    # 使用 HTTPS 方式
    git remote set-url origin https://github.com/xt0103/CLARITY.git
    echo ""
    echo "正在推送..."
    git push -u origin main
    
elif [ "$choice" == "2" ]; then
    echo ""
    echo "🔑 使用 SSH 方式"
    echo ""
    
    # 检查 SSH key
    if [ ! -f ~/.ssh/id_ed25519.pub ] && [ ! -f ~/.ssh/id_rsa.pub ]; then
        echo "未找到 SSH key，需要先创建："
        echo ""
        read -p "请输入你的邮箱地址: " email
        ssh-keygen -t ed25519 -C "$email" -f ~/.ssh/id_ed25519 -N ""
        echo ""
        echo "✅ SSH key 已创建"
        echo ""
        echo "请将以下公钥添加到 GitHub："
        echo "https://github.com/settings/keys"
        echo ""
        cat ~/.ssh/id_ed25519.pub
        echo ""
        read -p "添加完成后按 Enter 继续..."
    fi
    
    # 使用 SSH 方式
    git remote set-url origin git@github.com:xt0103/CLARITY.git
    echo ""
    echo "正在推送..."
    git push -u origin main
    
else
    echo "❌ 无效选项"
    exit 1
fi

echo ""
echo "✅ 完成！访问 https://github.com/xt0103/CLARITY 查看你的代码"
