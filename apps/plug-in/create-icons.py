#!/usr/bin/env python3
"""
生成插件图标
创建简单的PNG图标文件
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
    
    def create_icon(size, output_path):
        """创建图标"""
        # 创建图像
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # 绘制渐变背景（简化版：使用单色）
        # 使用紫色渐变的主色调
        color1 = (102, 126, 234)  # #667eea
        color2 = (118, 75, 162)   # #764ba2
        
        # 绘制圆角矩形背景
        margin = int(size * 0.1)
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=int(size * 0.15),
            fill=color1
        )
        
        # 绘制简单的表单图标（文档和笔）
        # 文档
        doc_x = int(size * 0.25)
        doc_y = int(size * 0.2)
        doc_w = int(size * 0.5)
        doc_h = int(size * 0.6)
        
        # 文档边框
        draw.rectangle(
            [doc_x, doc_y, doc_x + doc_w, doc_y + doc_h],
            outline=(255, 255, 255, 255),
            width=max(1, int(size * 0.05))
        )
        
        # 文档中的线条
        line_spacing = doc_h // 4
        for i in range(1, 4):
            y = doc_y + line_spacing * i
            draw.line(
                [doc_x + int(size * 0.1), y, doc_x + doc_w - int(size * 0.1), y],
                fill=(255, 255, 255, 255),
                width=max(1, int(size * 0.03))
            )
        
        # 保存
        img.save(output_path, 'PNG')
        print(f'已创建: {output_path}')
    
    # 创建图标目录
    icons_dir = 'icons'
    os.makedirs(icons_dir, exist_ok=True)
    
    # 生成不同尺寸的图标
    sizes = [16, 48, 128]
    for size in sizes:
        output_path = os.path.join(icons_dir, f'icon{size}.png')
        create_icon(size, output_path)
    
    print('\n所有图标已生成完成！')
    
except ImportError:
    print('错误: 需要安装Pillow库')
    print('请运行: pip3 install Pillow')
    print('\n或者使用以下替代方法:')
    print('1. 在浏览器中打开 icons/generate-icons.html')
    print('2. 使用在线SVG转PNG工具转换 icons/icon.svg')
    exit(1)
except Exception as e:
    print(f'生成图标时出错: {e}')
    exit(1)


