# 表单自动填写助手

一个Chrome浏览器插件，可以自动读取网页表单并填写本地CSV数据库中的信息。

## 功能特性

1. **表单字段检测**：自动检测网页中的所有表单输入字段
2. **CSV数据管理**：支持导入本地CSV文件作为数据源
3. **智能字段匹配**：自动匹配表单字段和CSV列名，支持手动调整
4. **一键填写**：快速将CSV数据填写到网页表单中

## 安装方法

1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择本项目的根目录

## 使用说明

### 1. 导入数据

**方式一：上传 PDF 简历（推荐）**

1. 点击浏览器工具栏中的插件图标
2. 点击"⚙️ 打开设置"
3. 在「上传简历」区域，点击"上传 PDF 简历"
4. 选择您的 PDF 简历文件
5. 系统将自动提取信息（需配置 AI API），您可手动补充或修改字段
6. 点击"保存简历数据"

**方式二：导入 CSV 文件**

1. 在「或导入 CSV」区域，点击"选择CSV文件"
2. 选择您的CSV文件（必须包含表头行）

**CSV格式要求：**

- 第一行必须是表头（列名）
- 使用逗号分隔
- 支持UTF-8编码

**示例CSV：**

```csv
姓名,邮箱,电话,地址
张三,zhangsan@example.com,13800138000,北京市朝阳区
李四,lisi@example.com,13900139000,上海市浦东新区
```

### 2. 检测表单字段

1. 打开需要填写表单的网页
2. 在设置页面中，点击"检测当前页面表单字段"
3. 插件会自动识别页面中的所有表单字段

### 3. 配置字段映射

1. 检测字段后，点击"自动匹配"按钮
2. 插件会根据字段名称、label、placeholder等自动匹配CSV列名
3. 您可以手动调整每个字段的映射关系
4. 点击"保存配置"保存映射设置

### 4. 一键填写

1. 在需要填写表单的网页上，点击插件图标
2. 查看检测到的表单字段数量和数据状态
3. 点击"一键填写"按钮
4. 插件会自动将CSV数据填写到表单中

## 项目结构

```
JobHunting/
├── manifest.json          # 插件配置文件
├── popup.html/js/css      # 弹出窗口界面
├── options.html/js/css    # 设置页面
├── content.js             # 内容脚本（在网页中运行）
├── background.js          # 后台脚本
├── utils/                 # 工具模块
├── icons/                 # 插件图标
├── docs/                  # 文档
│   ├── product/           # 产品文档
│   ├── development/       # 开发文档
│   ├── quickstart/        # 快速开始
│   └── reference/         # 参考材料（牛客 API、前端代码）
└── examples/              # 示例数据
```

## 技术栈

- **Manifest V3**：使用最新的Chrome扩展API
- **Chrome Storage API**：存储CSV数据和配置
- **Content Scripts**：在网页上下文中运行，检测和填写表单
- **原生JavaScript**：无外部依赖

## 支持的字段类型

- 文本输入框（text, email, tel, number等）
- 下拉选择框（select）
- 多行文本（textarea）
- 复选框（checkbox）
- 单选框（radio）

## 注意事项

1. 某些网站可能有反自动化机制，填写后请检查数据是否正确
2. 文件上传字段（file input）不支持自动填写
3. 建议在使用前先测试，确保字段映射正确
4. CSV数据存储在浏览器本地，不会上传到服务器

## 开发说明

### 生成图标

如果图标文件丢失，可以使用以下方法重新生成：

**方法1：使用Python脚本（需要Pillow库）**

```bash
pip3 install Pillow
python3 create-icons.py
```

**方法2：使用HTML工具**
在浏览器中打开 `icons/generate-icons.html`，下载生成的图标

**方法3：使用ImageMagick**

```bash
convert -background none -resize 16x16 icons/icon.svg icons/icon16.png
convert -background none -resize 48x48 icons/icon.svg icons/icon48.png
convert -background none -resize 128x128 icons/icon.svg icons/icon128.png
```

## 许可证

MIT License

## 牛客 fill-form 流程（v1.0+）

当在设置页填写并保存简历数据后，插件会优先使用牛客网申助手风格的流程：

1. **页面解析**：解析网申页面，生成 `element_dict`（id→xpath）和 `simple_fragment`（模块、字段语义）
2. **智能匹配**：将表单字段与简历数据匹配，输出 xpath→value 映射
3. **表单填充**：按 xpath 定位 DOM 元素并填入 value，支持 input/select/textarea 及自定义下拉

相关文件：
- `utils/formParser.js` - 页面解析（element_dict、simple_fragment）
- `utils/fillFormMatcher.js` - 本地匹配逻辑
- `platform-selectors.json` - 各招聘平台选择器配置（Moka、北森、ATSX 等）

## 文档索引

- [快速开始](docs/quickstart/QUICKSTART.md)
- [产品需求文档 (PRD)](docs/product/PRD.md)
- [功能实现文档](docs/development/功能实现文档.md)

## 更新日志

### v1.0.0

- 初始版本发布
- 支持CSV数据导入
- 支持表单字段自动检测
- 支持智能字段匹配
- 支持一键自动填写
- **牛客 fill-form 流程**：简历数据优先，xpath 定位填充
