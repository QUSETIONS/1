# 病理图像标注系统 (Pathology Annotation Tool)

一个基于Web的病理图像标注系统，用于细胞核/细胞的交互式标注、分类和统计分析。采用Cloudflare Pages + Hono + D1数据库架构，支持多项目管理、多种标注工具和实时统计。

## 项目概述

- **名称**: 病理图像标注系统 (Pathology Annotation Tool)
- **目标**: 提供一个轻量级、易用的病理图像标注平台，支持细胞核识别、分类和统计分析
- **技术栈**: Hono + Cloudflare Workers + D1 Database + TailwindCSS + Canvas API
- **灵感来源**: [nuclei.io](https://github.com/huangzhii/nuclei.io) - Human-in-the-loop active learning framework

## 主要功能

### ✅ 已实现功能

### 🆕 v2.0 新增功能

1. **文件上传UI** ⭐
   - 直接从浏览器上传图像
   - 自动获取图像尺寸
   - 实时上传进度提示
   - 支持最大10MB文件

2. **R2对象存储** ⭐
   - 实际图像文件存储到Cloudflare R2
   - 自动文件管理和命名
   - 快速图像加载和缓存
   - 支持多种图像格式

3. **AI智能识别** 🤖 ⭐
   - 集成OpenAI Vision API (GPT-4o)
   - 自动识别和标注细胞
   - 支持6种细胞类型识别
   - 提供置信度评分
   - 10-30秒快速分析

### v1.0 核心功能

1. **项目管理**
   - 创建多个标注项目
   - 每个项目可包含多张图像
   - 项目描述和元数据管理

2. **图像管理**
   - ✅ 浏览器直接上传图像（新增）
   - ✅ R2对象存储支持（新增）
   - 支持多种分辨率
   - 图像预览和选择

3. **标注工具**
   - **点标注**: 快速标记单个细胞位置
   - **多边形标注**: 精确勾画细胞轮廓
   - **标签分类**: 支持6种细胞类型
     - 淋巴细胞 (Lymphocyte)
     - 肿瘤细胞 (Tumor)
     - 基质细胞 (Stromal)
     - 中性粒细胞 (Neutrophil)
     - 嗜酸性粒细胞 (Eosinophil)
     - 其他 (Other)

4. **图像查看器**
   - Canvas渲染引擎
   - 缩放功能 (滚轮/按钮)
   - 平移功能 (拖拽)
   - 重置视图

5. **标注管理**
   - 实时标注显示
   - 颜色编码标签
   - 标注列表查看
   - 删除标注

6. **统计分析**
   - 总标注数量
   - 按标签分类统计
   - 按类型统计
   - 面积计算 (多边形)

7. **数据导出**
   - JSON格式导出
   - 包含图像元数据和所有标注
   - 时间戳记录

### 🚧 功能局限和未实现部分

1. **图像处理局限**
   - ❌ **不支持WSI大图处理**: 原nuclei.io支持病理全片扫描图像(WSI)，本系统仅支持普通尺寸图像
   - ❌ **无图像金字塔**: 无法处理多分辨率图层
   - ⚠️ **AI分割算法**: 使用OpenAI Vision API（新增），未集成Stardist等专业算法
   - ✅ **图像存储**: 已支持R2存储（新增）

2. **AI/ML功能**
   - ✅ **AI识别**: 集成OpenAI Vision API自动标注（新增）
   - ✅ **置信度评估**: AI提供置信度分数（新增）
   - ❌ **主动学习**: 原系统核心的human-in-the-loop功能未实现
   - ❌ **自定义模型**: 无法导入自训练模型
   - ❌ **特征提取**: 未实现细胞特征自动计算

3. **高级标注功能**
   - ❌ **无画笔工具**: 只支持点和多边形，不支持自由绘制
   - ❌ **无协作标注**: 不支持多用户同时标注
   - ❌ **无版本控制**: 标注修改无历史记录
   - ❌ **无快捷键**: 缺少键盘快捷操作

4. **可视化局限**
   - ❌ **无虚拟流式细胞仪**: 原系统的特色功能未实现
   - ❌ **无热力图**: 无细胞密度热力图显示
   - ❌ **无3D可视化**: 仅支持2D平面显示

5. **数据处理限制**
   - ⚠️ **批量导入**: API支持但UI未实现
   - ⚠️ **格式转换**: 仅支持JSON，不支持其他格式(如COCO、YOLO等)
   - ❌ **数据增强**: 无图像预处理功能

## 数据架构

### 数据模型

#### 1. Projects (项目表)
```sql
- id: 项目ID
- name: 项目名称
- description: 项目描述
- created_at: 创建时间
- updated_at: 更新时间
```

#### 2. Images (图像表)
```sql
- id: 图像ID
- project_id: 所属项目
- filename: 文件名
- original_name: 原始文件名
- width: 图像宽度
- height: 图像高度
- file_size: 文件大小
- upload_date: 上传时间
```

#### 3. Annotations (标注表)
```sql
- id: 标注ID
- image_id: 所属图像
- annotation_type: 标注类型 (point/polygon)
- label: 细胞类型标签
- coordinates: 坐标数组 (JSON)
- area: 面积 (多边形)
- confidence: 置信度 (0-1)
- created_by: 创建者 (user/model)
- created_at: 创建时间
- updated_at: 更新时间
```

#### 4. Cell Features (细胞特征表)
```sql
- id: 特征ID
- annotation_id: 关联标注
- feature_type: 特征类型
- feature_data: 特征数据 (JSON)
- created_at: 创建时间
```

### 存储服务

- **Cloudflare D1**: SQLite数据库，存储元数据和标注信息
- **Cloudflare R2**: (规划中) 对象存储，用于存储实际图像文件

### 数据流程

```
用户上传图像 → 元数据存储到D1 → 图像文件存储到R2
用户标注 → 坐标计算 → 标注数据存储到D1
统计查询 → D1聚合查询 → 实时统计显示
数据导出 → D1查询 → JSON格式下载
```

## API接口文档

### 项目管理

#### 获取所有项目
```
GET /api/projects
响应: { success: true, data: [projects] }
```

#### 创建项目
```
POST /api/projects
Body: { name: string, description?: string }
响应: { success: true, data: project }
```

#### 获取项目详情
```
GET /api/projects/:id
响应: { success: true, data: { ...project, images: [] } }
```

### 图像管理

#### 获取项目图像列表
```
GET /api/projects/:projectId/images
响应: { success: true, data: [images] }
```

#### 上传图像元数据
```
POST /api/projects/:projectId/images
Body: { filename, original_name, width, height, file_size }
响应: { success: true, data: image }
```

#### 获取图像详情
```
GET /api/images/:id
响应: { success: true, data: { ...image, annotations: [] } }
```

### 标注管理

#### 获取图像标注
```
GET /api/images/:imageId/annotations
响应: { success: true, data: [annotations] }
```

#### 创建标注
```
POST /api/images/:imageId/annotations
Body: {
  annotation_type: 'point' | 'polygon',
  label: string,
  coordinates: [{x, y}],
  area?: number,
  confidence?: number,
  created_by?: 'user' | 'model'
}
响应: { success: true, data: annotation }
```

#### 批量创建标注
```
POST /api/images/:imageId/annotations/batch
Body: { annotations: [annotation objects] }
响应: { success: true, data: [annotations] }
```

#### 更新标注
```
PUT /api/annotations/:id
Body: { annotation_type, label, coordinates, area?, confidence? }
响应: { success: true, data: annotation }
```

#### 删除标注
```
DELETE /api/annotations/:id
响应: { success: true }
```

### 统计分析

#### 获取图像统计
```
GET /api/images/:imageId/statistics
响应: {
  success: true,
  data: {
    total: number,
    byLabel: [{label, count}],
    byType: [{annotation_type, count}]
  }
}
```

#### 导出标注数据
```
GET /api/images/:imageId/export
响应: { image, annotations: [], export_date }
```

### 文件上传和AI分析 (新增)

#### 上传图像
```
POST /api/projects/:projectId/images/upload
Content-Type: multipart/form-data
Body: file (图像文件), width, height
响应: { success: true, data: image_metadata }
```

#### 获取图像文件
```
GET /api/images/:id/file
响应: 图像文件 (二进制数据)
```

#### AI智能识别
```
POST /api/images/:imageId/analyze
响应: {
  success: true,
  data: {
    detected_count: number,
    annotations: [标注数组]
  },
  message: string
}
```

## 使用指南

### 快速开始

#### 1. 安装依赖
```bash
cd /home/user/webapp
npm install
```

#### 2. 初始化数据库
```bash
# 创建本地数据库并运行迁移
npm run db:migrate:local

# 导入测试数据
npm run db:seed
```

#### 3. 启动开发服务器
```bash
# 构建项目
npm run build

# 启动服务 (使用PM2)
pm2 start ecosystem.config.cjs

# 查看服务状态
pm2 list

# 查看日志
pm2 logs pathology-annotation --nostream
```

#### 4. 访问应用
```
本地: http://localhost:3000
```

### 基本操作流程

#### 第一步: 创建项目
1. 点击右上角 "新建项目" 按钮
2. 输入项目名称和描述
3. 项目将出现在左侧项目列表

#### 第二步: 上传图像（新增UI上传）
**方法1: 使用UI上传（推荐）**
1. 在左侧选择一个项目
2. 点击"图像列表"旁边的绿色📤上传按钮
3. 选择病理图像文件（最大10MB）
4. 等待上传完成

**方法2: 通过API上传（编程方式）**
```bash
curl -X POST http://localhost:3000/api/projects/1/images/upload \
  -F "file=@/path/to/image.jpg"
```

#### 第三步: 选择图像
1. 在左侧项目列表中点击项目
2. 查看该项目下的图像列表
3. 点击图像打开标注界面

#### 第四步: 标注细胞
1. **选择工具**:
   - 🔵 点标注: 单击标记细胞中心
   - 🟣 多边形标注: 连续点击勾画轮廓，点击起点完成
   - ✋ 平移: 拖拽移动图像
   - 🗑️ 删除: 点击标注删除

2. **选择标签**: 在下拉菜单中选择细胞类型

3. **视图控制**:
   - 🔍+ / 🔍- : 缩放
   - 滚轮: 缩放
   - ⛶ : 重置视图

#### 第五步: 查看统计
- 右侧面板实时显示标注统计
- 按细胞类型查看数量分布
- 总计显示所有标注数量

#### 第六步: 导出数据
1. 点击右侧 "导出数据" 按钮
2. 下载JSON格式的标注文件
3. 包含所有标注坐标和元数据

### 🤖 AI智能识别功能（新增）

#### 配置OpenAI API密钥

**本地开发：**
1. 编辑 `.dev.vars` 文件
2. 添加你的API密钥：
```bash
OPENAI_API_KEY=sk-your-api-key-here
```
3. 重启服务：`pm2 restart pathology-annotation`

**生产环境：**
```bash
wrangler secret put OPENAI_API_KEY
# 输入你的API密钥
```

#### 使用AI识别

1. **上传并选择图像**
2. **点击"AI智能识别"按钮** （右侧面板顶部）
3. **确认分析** （将产生API费用）
4. **等待10-30秒** AI分析图像
5. **查看结果** - AI会自动标注10-20个细胞
6. **验证和修正** - 删除错误标注，补充遗漏

#### AI识别特点
- ✅ 自动识别6种细胞类型
- ✅ 提供置信度分数（0-1）
- ✅ 10-30秒快速分析
- ✅ 批量创建标注
- ⚠️ 需要OpenAI API密钥
- ⚠️ 会产生API调用费用（约$0.01-0.05/次）

**详细AI功能文档**: 查看 `AI_FEATURES.md`

### 高级用法

#### 通过API批量导入标注
```bash
curl -X POST http://localhost:3000/api/images/1/annotations/batch \
  -H "Content-Type: application/json" \
  -d '{
    "annotations": [
      {
        "annotation_type": "point",
        "label": "lymphocyte",
        "coordinates": [{"x": 100, "y": 200}],
        "confidence": 0.95,
        "created_by": "model"
      },
      {
        "annotation_type": "polygon",
        "label": "tumor",
        "coordinates": [
          {"x": 300, "y": 400},
          {"x": 320, "y": 390},
          {"x": 330, "y": 410},
          {"x": 310, "y": 420}
        ],
        "area": 450.5,
        "confidence": 0.88,
        "created_by": "model"
      }
    ]
  }'
```

#### 数据库管理命令
```bash
# 重置数据库(清除所有数据)
npm run db:reset

# 执行SQL查询
npm run db:console:local
# 然后输入SQL命令，如:
# SELECT * FROM projects;

# 查看标注统计
npm run db:console:local
# SELECT label, COUNT(*) FROM annotations GROUP BY label;
```

## 部署指南

### 本地开发
```bash
npm run build
pm2 start ecosystem.config.cjs
```

### 生产部署到Cloudflare Pages

⚠️ **注意**: 实际图像存储需要配置R2 bucket，当前版本使用示例图像。

```bash
# 1. 创建D1数据库
npx wrangler d1 create pathology-db-production

# 2. 更新wrangler.jsonc中的database_id

# 3. 运行生产迁移
npm run db:migrate:prod

# 4. 构建和部署
npm run deploy:prod
```

## 与原nuclei.io的对比

| 功能 | nuclei.io | 本系统 | 说明 |
|------|-----------|--------|------|
| **图像支持** | WSI全片扫描 | 普通图像 | ❌ 本系统不支持大型WSI |
| **标注工具** | 多种 | 点+多边形 | ⚠️ 功能简化 |
| **细胞分割** | Stardist集成 | 手动标注 | ❌ 无自动分割 |
| **主动学习** | 完整支持 | 无 | ❌ 核心功能缺失 |
| **特征提取** | 自动计算 | 无 | ❌ 需手动标注 |
| **虚拟流式** | 支持 | 无 | ❌ 可视化功能缺失 |
| **部署方式** | 本地/服务器 | Cloudflare Edge | ✅ 更易部署 |
| **数据库** | 文件系统 | D1 SQLite | ✅ 结构化存储 |
| **协作** | 单用户 | 单用户 | ⚠️ 都不支持 |
| **API接口** | 无 | RESTful API | ✅ 易于扩展 |
| **跨平台** | Linux推荐 | Web浏览器 | ✅ 无需安装 |

## 推荐使用场景

### ✅ 适合使用本系统的场景

1. **小规模标注任务**
   - 图像数量 < 1000张
   - 单张图像 < 10MB
   - 不需要WSI支持

2. **教学和演示**
   - 病理学课程实验
   - 标注方法演示
   - 快速原型开发

3. **简单细胞计数**
   - 基本细胞分类
   - 数量统计
   - 位置记录

4. **无需AI辅助**
   - 纯人工标注
   - 小数据集
   - 简单标注任务

### ❌ 不适合的场景

1. **大规模病理分析**
   - WSI全片扫描图像
   - 需要自动分割
   - 需要主动学习

2. **生产级AI训练**
   - 需要大量标注数据
   - 需要模型集成
   - 需要特征工程

3. **高级研究项目**
   - 需要复杂可视化
   - 需要协作标注
   - 需要版本控制

## 扩展建议

如果你需要更多功能，可以考虑以下扩展：

### 1. 集成第三方AI服务
```javascript
// 调用外部API进行细胞分割
app.post('/api/images/:id/auto-segment', async (c) => {
  // 调用OpenAI Vision API或其他AI服务
  const predictions = await callAIService(imageData);
  // 批量创建标注
  await batchCreateAnnotations(predictions);
});
```

### 2. 添加图像上传UI
```javascript
// 在前端添加文件上传组件
<input type="file" accept="image/*" onChange={handleImageUpload} />
```

### 3. 支持更多标注类型
- 圆形标注
- 矩形标注
- 自由绘制画笔

### 4. 添加键盘快捷键
```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'p') setTool('point');
  if (e.key === 'g') setTool('polygon');
  if (e.key === 'Delete') deleteSelected();
});
```

## 技术细节

### 前端架构
- **Canvas渲染**: 使用HTML5 Canvas API绘制图像和标注
- **坐标转换**: Canvas坐标 ↔ 图像坐标的实时转换
- **状态管理**: 原生JavaScript管理应用状态
- **响应式设计**: TailwindCSS构建响应式UI

### 后端架构
- **Hono框架**: 轻量级Web框架
- **D1数据库**: Cloudflare的SQLite数据库
- **RESTful API**: 标准REST接口设计
- **CORS支持**: 跨域资源共享

### 性能考虑
- **索引优化**: 数据库字段建立索引
- **批量操作**: 支持批量创建标注
- **懒加载**: 按需加载图像和标注
- **缓存策略**: 统计数据可缓存

## 常见问题

### Q: 如何上传真实的病理图像？
A: 当前版本使用示例图像。要上传真实图像，需要：
1. 配置Cloudflare R2存储
2. 添加文件上传API
3. 在前端添加上传UI组件

### Q: 可以导入其他格式的标注数据吗？
A: 目前只支持JSON格式。可以通过API批量导入，格式参考API文档。

### Q: 支持多用户协作吗？
A: 当前版本不支持。需要添加：
1. 用户认证系统
2. 权限管理
3. 实时同步机制

### Q: 能否集成AI模型进行自动标注？
A: 本系统未内置AI功能，但可以通过API集成第三方AI服务：
- OpenAI Vision API
- Google Cloud Vision
- Azure Computer Vision
- 自建模型服务

### Q: 如何处理大尺寸图像？
A: 当前系统适合中小尺寸图像。大尺寸WSI图像需要：
1. 图像金字塔处理
2. 分块加载
3. 更强大的后端处理
建议使用原nuclei.io或QuPath等专业工具。

## 项目状态

- **版本**: 1.0.0
- **状态**: ✅ 基础功能完成，可用于小规模标注
- **最后更新**: 2025-11-25
- **维护状态**: 活跃开发中

## 相关资源

- **nuclei.io原项目**: https://github.com/huangzhii/nuclei.io
- **Hono文档**: https://hono.dev
- **Cloudflare D1文档**: https://developers.cloudflare.com/d1
- **QuPath** (专业病理分析工具): https://qupath.github.io

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

---

**注意**: 本系统是一个轻量级Web应用，适合小规模标注和教学演示。如需处理大规模WSI图像和AI辅助标注，建议使用原nuclei.io项目或其他专业工具。
