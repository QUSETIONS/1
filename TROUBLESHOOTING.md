# 病理图像标注系统 - 问题排查指南

## 版本信息
- **版本**: v2.1 (修复版)
- **更新日期**: 2025-11-27
- **修复内容**: R2存储配置、错误处理优化

---

## 常见问题及解决方案

### 🔴 问题1: 创建项目失败

#### 症状
- 点击"新建项目"按钮后，弹出输入框
- 输入项目名称和描述后，显示"创建项目失败"
- 但实际上项目已经在数据库中创建成功

#### 根本原因
前端JavaScript中缺少详细的错误日志，无法准确诊断问题

#### 解决方案 ✅

**已修复内容**:
```javascript
// 修复前
if (response.data.success) {
  showNotification('项目创建成功', 'success');
  await loadProjects();
}

// 修复后
console.log('Create project response:', response.data);

if (response.data && response.data.success) {
  showNotification('项目创建成功', 'success');
  await loadProjects();
} else {
  showNotification('创建项目失败: ' + (response.data?.error || '未知错误'), 'error');
}
```

**验证步骤**:
1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签
3. 点击"新建项目"按钮
4. 查看控制台日志，会显示详细的响应数据
5. 如果成功，会显示 `{success: true, data: {...}}`

**测试命令**:
```bash
# 直接测试API
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"测试项目","description":"这是一个测试"}'

# 预期响应
{"success":true,"data":{"id":6,"name":"测试项目",...}}
```

---

### 🔴 问题2: 图片无法上传

#### 症状
- 点击"上传图片"按钮后无反应
- 或显示"上传失败"错误
- 已上传的图片无法显示，显示404错误

#### 根本原因
Cloudflare R2存储绑定未正确配置到本地开发服务器

#### 解决方案 ✅

**已修复内容**:

**文件**: `ecosystem.config.cjs`
```javascript
// 修复前
args: 'wrangler pages dev dist --d1=pathology-db-production --local --ip 0.0.0.0 --port 3000'

// 修复后
args: 'wrangler pages dev dist --d1=pathology-db-production --r2=IMAGES --local --ip 0.0.0.0 --port 3000'
```

**重启服务**:
```bash
# 方法1: 使用PM2重启
cd /home/user/webapp
pm2 delete pathology-annotation
pm2 start ecosystem.config.cjs

# 方法2: 使用npm脚本
npm run clean-port
npm run build
pm2 start ecosystem.config.cjs
```

**验证R2配置**:
```bash
# 查看PM2日志，确认R2绑定
pm2 logs pathology-annotation --nostream | grep "R2 Bucket"

# 预期输出
env.IMAGES (IMAGES)    R2 Bucket    local
```

**测试图片上传**:
```bash
# 1. 创建测试图片
cd /home/user/webapp
python3 << 'EOF'
from PIL import Image, ImageDraw
img = Image.new('RGB', (800, 600), color='white')
draw = ImageDraw.Draw(img)
draw.ellipse([350, 250, 450, 350], fill='blue', outline='black')
img.save('test.jpg')
EOF

# 2. 上传测试图片
curl -X POST http://localhost:3000/api/projects/1/images/upload \
  -F "file=@test.jpg"

# 3. 获取图片ID (假设返回id=4)
# 4. 测试图片访问
curl -I http://localhost:3000/api/images/4/file

# 预期响应
HTTP/1.1 200 OK
Content-Type: image/jpeg
```

---

### 🟡 问题3: Windows系统中端口占用

#### 症状
- 启动服务时显示 "Port 3000 is already in use"
- 或者 "EADDRINUSE: address already in use"

#### 解决方案

**方法1: 查找并结束占用进程**
```cmd
# 查找占用3000端口的进程
netstat -ano | findstr :3000

# 记录PID (例如: 12345)
# 结束进程
taskkill /PID 12345 /F
```

**方法2: 使用其他端口**

修改 `ecosystem.config.cjs`:
```javascript
args: 'wrangler pages dev dist --d1=pathology-db-production --r2=IMAGES --local --ip 0.0.0.0 --port 3001',
env: {
  NODE_ENV: 'development',
  PORT: 3001
}
```

然后访问 `http://localhost:3001`

---

### 🟡 问题4: OpenAI API配置

#### 症状
- 点击"AI智能识别"按钮后，显示"API密钥未配置"
- 或显示"AI分析失败"

#### 解决方案

**步骤1: 获取OpenAI API密钥**
1. 访问 https://platform.openai.com/api-keys
2. 登录或注册账号
3. 点击"Create new secret key"
4. 复制密钥 (格式: `sk-...`)

**步骤2: 配置密钥**

**Linux/Mac**:
```bash
cd /home/user/webapp

# 创建 .dev.vars 文件
cat > .dev.vars << 'EOF'
OPENAI_API_KEY=sk-your-actual-api-key-here
EOF

# 重启服务
pm2 restart pathology-annotation
```

**Windows**:
```cmd
cd C:\pathology-annotation\webapp

# 创建 .dev.vars 文件 (使用记事本)
notepad .dev.vars

# 在记事本中输入:
OPENAI_API_KEY=sk-your-actual-api-key-here

# 保存并关闭，然后重启服务
npm run dev:sandbox
```

**步骤3: 验证配置**
```bash
# 测试AI分析API
curl -X POST http://localhost:3000/api/images/4/analyze

# 如果配置正确，会返回识别结果
# 如果密钥错误，会返回错误信息
```

**费用说明**:
- GPT-4o Vision: 约 $0.01-0.05 每次分析
- 每次分析处理10-20个细胞
- 建议设置使用限额，避免意外高额费用

---

### 🟡 问题5: 数据库迁移失败

#### 症状
- 服务启动时报错 "table not found"
- 或显示 "no such column"

#### 解决方案

**完全重置数据库**:
```bash
cd /home/user/webapp

# 方法1: 使用npm脚本
npm run db:reset

# 方法2: 手动重置
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
npm run db:seed

# 重启服务
pm2 restart pathology-annotation
```

**验证数据库**:
```bash
# 检查表结构
npx wrangler d1 execute pathology-db-production --local \
  --command="SELECT name FROM sqlite_master WHERE type='table'"

# 预期输出
projects, images, annotations
```

---

### 🟢 问题6: 在线演示图片上传

#### 症状
在线演示环境 (https://3000-...) 无法上传图片

#### 原因分析
在线演示环境需要真实的Cloudflare R2存储桶配置，而不是本地模拟

#### 解决方案

**生产环境部署**:

1. **创建真实R2存储桶**:
```bash
# 登录Cloudflare
npx wrangler login

# 创建R2存储桶
npx wrangler r2 bucket create pathology-images-prod

# 更新 wrangler.jsonc
{
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "pathology-images-prod"
    }
  ]
}
```

2. **部署到Cloudflare Pages**:
```bash
# 构建项目
npm run build

# 部署
npx wrangler pages deploy dist --project-name pathology-annotation
```

3. **配置环境变量** (可选 - 如果使用AI功能):
```bash
npx wrangler pages secret put OPENAI_API_KEY --project-name pathology-annotation
# 然后输入你的API密钥
```

**临时解决方案** (仅用于测试):
本地开发环境支持完整的图片上传功能，可以使用 `http://localhost:3000` 进行测试

---

## 快速诊断命令

### 检查服务状态
```bash
# PM2服务状态
pm2 status

# 查看最近日志
pm2 logs pathology-annotation --nostream --lines 20

# 查看服务绑定
pm2 logs pathology-annotation --nostream | grep "Binding"
```

### 测试所有API端点
```bash
# 1. 获取项目列表
curl http://localhost:3000/api/projects

# 2. 创建项目
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","description":"测试"}'

# 3. 上传图片 (需要先有test.jpg文件)
curl -X POST http://localhost:3000/api/projects/1/images/upload \
  -F "file=@test.jpg"

# 4. 获取图片 (假设id=1)
curl http://localhost:3000/api/images/1

# 5. 访问图片文件
curl -I http://localhost:3000/api/images/1/file

# 6. AI分析 (需要配置OpenAI API密钥)
curl -X POST http://localhost:3000/api/images/1/analyze
```

---

## 日志位置

### PM2 日志
```bash
# 标准输出
~/.pm2/logs/pathology-annotation-out-0.log

# 错误输出
~/.pm2/logs/pathology-annotation-error-0.log

# 实时查看
pm2 logs pathology-annotation
```

### Wrangler 本地状态
```bash
# D1 数据库
.wrangler/state/v3/d1/

# R2 存储
.wrangler/state/v3/r2/

# 查看R2存储的文件
ls -lh .wrangler/state/v3/r2/IMAGES/
```

---

## 性能优化建议

### 1. 图片大小限制
当前限制: 10MB

如需调整:
```javascript
// 修改 src/index.tsx
if (file.size > 20 * 1024 * 1024) { // 改为20MB
  return c.json({ success: false, error: 'File too large (max 20MB)' }, 400)
}
```

### 2. 数据库性能
```sql
-- 添加索引以提高查询速度
CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_image_id ON annotations(image_id);
CREATE INDEX IF NOT EXISTS idx_annotations_label ON annotations(label);
```

### 3. 图片缓存
浏览器自动缓存图片1年 (通过 `Cache-Control: max-age=31536000`)

如需清除缓存:
```javascript
// 在浏览器控制台执行
location.reload(true) // 强制刷新
```

---

## 联系支持

如果以上方案无法解决问题,请提供以下信息:

1. **错误信息**:
   - 浏览器控制台日志 (F12 -> Console)
   - PM2日志: `pm2 logs pathology-annotation --nostream --lines 50`

2. **环境信息**:
   - 操作系统: Windows/Linux/Mac
   - Node.js版本: `node --version`
   - Wrangler版本: `npx wrangler --version`

3. **重现步骤**:
   - 详细描述操作步骤
   - 什么时候出现问题
   - 期望的结果是什么

---

## 版本更新日志

### v2.1 (2025-11-27)
- ✅ 修复: R2存储配置问题
- ✅ 改进: 前端错误处理和日志
- ✅ 测试: 所有API端点验证通过
- ✅ 文档: 添加完整的问题排查指南

### v2.0 (2025-11-25)
- 初始版本发布
- 文件上传UI
- OpenAI Vision集成
- R2存储支持

---

## 附录: 完整配置检查清单

在部署或调试前,请确认以下配置:

### ✅ 基础配置
- [ ] Node.js已安装 (v18+)
- [ ] npm依赖已安装 (`npm install`)
- [ ] 数据库已初始化 (`npm run db:migrate:local`)
- [ ] 端口3000未被占用

### ✅ 服务配置
- [ ] `wrangler.jsonc` 中配置了D1和R2绑定
- [ ] `ecosystem.config.cjs` 包含 `--r2=IMAGES` 参数
- [ ] PM2服务正常运行 (`pm2 status`)

### ✅ 功能配置 (可选)
- [ ] `.dev.vars` 文件包含 `OPENAI_API_KEY` (如需AI功能)
- [ ] 测试图片已准备好

### ✅ 验证步骤
- [ ] 访问 http://localhost:3000 显示界面
- [ ] 可以创建项目
- [ ] 可以上传图片
- [ ] 图片可以正常显示
- [ ] (可选) AI分析功能正常

---

**最后更新**: 2025-11-27  
**作者**: AI Assistant  
**项目**: 病理图像标注系统 v2.1
