# 如何添加公司Logo

## 步骤

### 1. 准备Logo图片文件

将logo图片文件保存为以下格式之一：
- PNG (推荐)
- JPG/JPEG
- SVG
- WebP

### 2. 放置Logo文件

将logo文件放入以下目录：
```
apps/next-web/public/company-logos/
```

文件命名建议：
- 使用小写字母
- 使用下划线或连字符分隔单词
- 例如：`shein.png`, `stripe.png`, `didi.png`, `bnsf.png`

### 3. 更新映射文件

编辑 `apps/next-web/lib/companyLogoMap.ts`，添加公司名到logo文件的映射：

```typescript
export const COMPANY_LOGO_MAP: Record<string, string> = {
  "shein": "/company-logos/shein.png",
  "stripe": "/company-logos/stripe.png",
  "didi": "/company-logos/didi.png",
  "bnsf railway": "/company-logos/bnsf.png",
  "bnsf": "/company-logos/bnsf.png",
  
  // 添加更多映射
  "your-company-name": "/company-logos/your-company-name.png",
};
```

**重要**：映射中的公司名应该是**小写**的，因为系统会自动将公司名转换为小写进行匹配。

### 4. 检查公司名

如果logo没有显示，检查：
1. 打开浏览器开发者工具（F12）
2. 查看Console标签
3. 查找 `[CompanyLogo]` 开头的日志
4. 确认公司名是否匹配

### 5. 测试

刷新页面后，logo应该会显示。如果还是显示首字母：
- 检查文件路径是否正确
- 检查文件名是否匹配
- 检查浏览器控制台是否有404错误

## 当前数据库中的公司名

运行以下命令查看数据库中的公司名：
```bash
cd apps/fastapi-server
source .venv/bin/activate
python3 -c "
from app.core.db import SessionLocal
from app.models.job import Job
from sqlalchemy import select, distinct
db = SessionLocal()
companies = db.scalars(select(Job.company).distinct().where(Job.is_active == True)).all()
for c in sorted(set(companies)):
    print(f\"'{c.lower()}' -> '/company-logos/{c.lower().replace(' ', '-')}.png'\")
db.close()
"
```

## Logo优先级

系统按以下顺序查找logo：
1. **API返回的logoUrl**（如果后端提供了）
2. **本地logo文件**（`public/company-logos/`）
3. **Clearbit API**（自动回退）
