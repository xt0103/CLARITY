# 图标生成说明

插件需要以下PNG图标文件：
- icons/icon16.png (16x16像素)
- icons/icon48.png (48x48像素)  
- icons/icon128.png (128x128像素)

## 生成方法

### 方法1: 使用HTML工具
在浏览器中打开 `icons/generate-icons.html`，点击下载按钮保存各个尺寸的图标。

### 方法2: 使用ImageMagick
```bash
convert -background none -resize 16x16 icons/icon.svg icons/icon16.png
convert -background none -resize 48x48 icons/icon.svg icons/icon48.png
convert -background none -resize 128x128 icons/icon.svg icons/icon128.png
```

### 方法3: 使用在线工具
访问 https://cloudconvert.com/svg-to-png 或其他SVG转PNG工具，上传 `icons/icon.svg` 并生成不同尺寸的PNG文件。

### 方法4: 手动创建
使用任何图像编辑软件创建简单的图标，保存为PNG格式。
