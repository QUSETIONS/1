import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database
  IMAGES: R2Bucket
  OPENAI_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// ==================== API Routes ====================

// Get all projects
app.get('/api/projects', async (c) => {
  const { DB } = c.env
  const result = await DB.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
  return c.json({ success: true, data: result.results })
})

// Create new project
app.post('/api/projects', async (c) => {
  const { DB } = c.env
  const { name, description } = await c.req.json()
  
  const result = await DB.prepare(
    'INSERT INTO projects (name, description) VALUES (?, ?) RETURNING *'
  ).bind(name, description || null).first()
  
  return c.json({ success: true, data: result })
})

// Get project by ID with images
app.get('/api/projects/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const project = await DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
  if (!project) {
    return c.json({ success: false, error: 'Project not found' }, 404)
  }
  
  const images = await DB.prepare('SELECT * FROM images WHERE project_id = ? ORDER BY upload_date DESC').bind(id).all()
  
  return c.json({ 
    success: true, 
    data: {
      ...project,
      images: images.results
    }
  })
})

// Get all images for a project
app.get('/api/projects/:projectId/images', async (c) => {
  const { DB } = c.env
  const projectId = c.req.param('projectId')
  
  const result = await DB.prepare(
    'SELECT * FROM images WHERE project_id = ? ORDER BY upload_date DESC'
  ).bind(projectId).all()
  
  return c.json({ success: true, data: result.results })
})

// Upload image with file to R2
app.post('/api/projects/:projectId/images/upload', async (c) => {
  const { DB, IMAGES } = c.env
  const projectId = c.req.param('projectId')
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400)
    }
    
    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const ext = file.name.split('.').pop()
    const filename = `${timestamp}-${random}.${ext}`
    
    // Get image dimensions from form data (sent by client)
    const width = parseInt(formData.get('width') as string) || 2048
    const height = parseInt(formData.get('height') as string) || 1536
    
    // Get file content
    const arrayBuffer = await file.arrayBuffer()
    const blob = new Blob([arrayBuffer])
    
    // Upload to R2
    await IMAGES.put(filename, blob, {
      httpMetadata: {
        contentType: file.type
      }
    })
    
    // Save metadata to database
    const result = await DB.prepare(
      'INSERT INTO images (project_id, filename, original_name, width, height, file_size) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
    ).bind(projectId, filename, file.name, width, height, file.size).first()
    
    return c.json({ success: true, data: result })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ success: false, error: 'Upload failed' }, 500)
  }
})

// Upload image metadata only (legacy endpoint)
app.post('/api/projects/:projectId/images', async (c) => {
  const { DB } = c.env
  const projectId = c.req.param('projectId')
  const { filename, original_name, width, height, file_size } = await c.req.json()
  
  const result = await DB.prepare(
    'INSERT INTO images (project_id, filename, original_name, width, height, file_size) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(projectId, filename, original_name, width, height, file_size).first()
  
  return c.json({ success: true, data: result })
})

// Get image file from R2
app.get('/api/images/:id/file', async (c) => {
  const { DB, IMAGES } = c.env
  const id = c.req.param('id')
  
  try {
    // Get image metadata
    const image = await DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first()
    if (!image) {
      return c.json({ success: false, error: 'Image not found' }, 404)
    }
    
    // Get file from R2
    const object = await IMAGES.get(image.filename as string)
    if (!object) {
      return c.json({ success: false, error: 'File not found in storage' }, 404)
    }
    
    // Return file
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch (error) {
    console.error('File retrieval error:', error)
    return c.json({ success: false, error: 'Failed to retrieve file' }, 500)
  }
})

// Get image by ID with all annotations
app.get('/api/images/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const image = await DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first()
  if (!image) {
    return c.json({ success: false, error: 'Image not found' }, 404)
  }
  
  const annotations = await DB.prepare(
    'SELECT * FROM annotations WHERE image_id = ? ORDER BY created_at DESC'
  ).bind(id).all()
  
  return c.json({ 
    success: true, 
    data: {
      ...image,
      annotations: annotations.results
    }
  })
})

// Get all annotations for an image
app.get('/api/images/:imageId/annotations', async (c) => {
  const { DB } = c.env
  const imageId = c.req.param('imageId')
  
  const result = await DB.prepare(
    'SELECT * FROM annotations WHERE image_id = ? ORDER BY created_at DESC'
  ).bind(imageId).all()
  
  return c.json({ success: true, data: result.results })
})

// Create new annotation
app.post('/api/images/:imageId/annotations', async (c) => {
  const { DB } = c.env
  const imageId = c.req.param('imageId')
  const { annotation_type, label, coordinates, area, confidence, created_by } = await c.req.json()
  
  const result = await DB.prepare(
    'INSERT INTO annotations (image_id, annotation_type, label, coordinates, area, confidence, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(
    imageId, 
    annotation_type, 
    label || null, 
    JSON.stringify(coordinates), 
    area || null, 
    confidence || null,
    created_by || 'user'
  ).first()
  
  return c.json({ success: true, data: result })
})

// Update annotation
app.put('/api/annotations/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { annotation_type, label, coordinates, area, confidence } = await c.req.json()
  
  const result = await DB.prepare(
    'UPDATE annotations SET annotation_type = ?, label = ?, coordinates = ?, area = ?, confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *'
  ).bind(
    annotation_type,
    label || null,
    JSON.stringify(coordinates),
    area || null,
    confidence || null,
    id
  ).first()
  
  return c.json({ success: true, data: result })
})

// Delete annotation
app.delete('/api/annotations/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare('DELETE FROM annotations WHERE id = ?').bind(id).run()
  
  return c.json({ success: true })
})

// Get statistics for an image
app.get('/api/images/:imageId/statistics', async (c) => {
  const { DB } = c.env
  const imageId = c.req.param('imageId')
  
  // Get annotation counts by label
  const labelCounts = await DB.prepare(`
    SELECT label, COUNT(*) as count 
    FROM annotations 
    WHERE image_id = ? 
    GROUP BY label
  `).bind(imageId).all()
  
  // Get total annotation count
  const totalCount = await DB.prepare(`
    SELECT COUNT(*) as total FROM annotations WHERE image_id = ?
  `).bind(imageId).first()
  
  // Get annotation type distribution
  const typeCounts = await DB.prepare(`
    SELECT annotation_type, COUNT(*) as count 
    FROM annotations 
    WHERE image_id = ? 
    GROUP BY annotation_type
  `).bind(imageId).all()
  
  return c.json({ 
    success: true, 
    data: {
      total: totalCount?.total || 0,
      byLabel: labelCounts.results,
      byType: typeCounts.results
    }
  })
})

// Batch create annotations (useful for importing model predictions)
app.post('/api/images/:imageId/annotations/batch', async (c) => {
  const { DB } = c.env
  const imageId = c.req.param('imageId')
  const { annotations } = await c.req.json()
  
  const results = []
  
  for (const ann of annotations) {
    const result = await DB.prepare(
      'INSERT INTO annotations (image_id, annotation_type, label, coordinates, area, confidence, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
    ).bind(
      imageId,
      ann.annotation_type,
      ann.label || null,
      JSON.stringify(ann.coordinates),
      ann.area || null,
      ann.confidence || null,
      ann.created_by || 'model'
    ).first()
    results.push(result)
  }
  
  return c.json({ success: true, data: results })
})

// Export annotations (JSON format)
app.get('/api/images/:imageId/export', async (c) => {
  const { DB } = c.env
  const imageId = c.req.param('imageId')
  
  const image = await DB.prepare('SELECT * FROM images WHERE id = ?').bind(imageId).first()
  const annotations = await DB.prepare('SELECT * FROM annotations WHERE image_id = ?').bind(imageId).all()
  
  return c.json({
    image,
    annotations: annotations.results,
    export_date: new Date().toISOString()
  })
})

// AI-powered cell detection using OpenAI Vision API
app.post('/api/images/:imageId/analyze', async (c) => {
  const { DB, IMAGES, OPENAI_API_KEY } = c.env
  const imageId = c.req.param('imageId')
  
  try {
    if (!OPENAI_API_KEY) {
      return c.json({ 
        success: false, 
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in .dev.vars or Cloudflare secrets.' 
      }, 500)
    }
    
    // Get image metadata
    const image = await DB.prepare('SELECT * FROM images WHERE id = ?').bind(imageId).first()
    if (!image) {
      return c.json({ success: false, error: 'Image not found' }, 404)
    }
    
    // Get image from R2
    const object = await IMAGES.get(image.filename as string)
    if (!object) {
      return c.json({ success: false, error: 'Image file not found' }, 404)
    }
    
    // Convert image to base64
    const arrayBuffer = await object.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const mimeType = object.httpMetadata?.contentType || 'image/jpeg'
    
    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this pathology image and identify cells. For each cell you detect, provide:
1. Cell type (lymphocyte, tumor, stromal, neutrophil, eosinophil, or other)
2. Approximate center coordinates as percentage of image dimensions (x%, y%)
3. Confidence score (0-1)

Please respond ONLY with a valid JSON array in this exact format:
[
  {"type": "lymphocyte", "x": 25.5, "y": 30.2, "confidence": 0.92},
  {"type": "tumor", "x": 45.3, "y": 55.8, "confidence": 0.88}
]

Identify 10-20 most prominent cells. Use percentage coordinates (0-100%).`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      return c.json({ 
        success: false, 
        error: `OpenAI API error: ${response.status} - ${error.substring(0, 200)}` 
      }, 500)
    }
    
    const data = await response.json() as any
    const content = data.choices[0].message.content
    
    // Parse AI response
    let detections: any[]
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in response')
      }
      detections = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      return c.json({ 
        success: false, 
        error: 'Failed to parse AI response. Raw response: ' + content.substring(0, 500),
        raw_response: content
      }, 500)
    }
    
    // Convert percentage coordinates to pixel coordinates
    const imageWidth = image.width as number
    const imageHeight = image.height as number
    
    const annotations = detections.map(det => ({
      annotation_type: 'point',
      label: det.type,
      coordinates: [{
        x: Math.round((det.x / 100) * imageWidth),
        y: Math.round((det.y / 100) * imageHeight)
      }],
      confidence: det.confidence,
      created_by: 'model'
    }))
    
    // Save annotations to database
    const results = []
    for (const ann of annotations) {
      const result = await DB.prepare(
        'INSERT INTO annotations (image_id, annotation_type, label, coordinates, confidence, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
      ).bind(
        imageId,
        ann.annotation_type,
        ann.label,
        JSON.stringify(ann.coordinates),
        ann.confidence,
        ann.created_by
      ).first()
      results.push(result)
    }
    
    return c.json({ 
      success: true, 
      data: {
        detected_count: results.length,
        annotations: results
      },
      message: `AI detected ${results.length} cells`
    })
    
  } catch (error) {
    console.error('AI analysis error:', error)
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'AI analysis failed' 
    }, 500)
  }
})

// ==================== Main Page ====================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>病理图像标注系统 - Pathology Annotation Tool</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .canvas-container {
            position: relative;
            overflow: hidden;
            border: 2px solid #e5e7eb;
            cursor: crosshair;
          }
          .annotation-point {
            position: absolute;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            transform: translate(-50%, -50%);
            pointer-events: none;
          }
          .toolbar-btn {
            transition: all 0.2s;
          }
          .toolbar-btn:hover {
            transform: scale(1.05);
          }
          .toolbar-btn.active {
            background-color: #3b82f6;
            color: white;
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <i class="fas fa-microscope text-3xl text-blue-600"></i>
                        <div>
                            <h1 class="text-2xl font-bold text-gray-900">病理图像标注系统</h1>
                            <p class="text-sm text-gray-600">Pathology Annotation Tool</p>
                        </div>
                    </div>
                    <button id="newProjectBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                        <i class="fas fa-plus"></i>
                        <span>新建项目</span>
                    </button>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 py-6">
            <div class="grid grid-cols-12 gap-6">
                <!-- Left Sidebar - Projects & Images -->
                <div class="col-span-3 space-y-4">
                    <div class="bg-white rounded-lg shadow p-4">
                        <h2 class="text-lg font-semibold mb-4 flex items-center">
                            <i class="fas fa-folder text-blue-600 mr-2"></i>
                            项目列表
                        </h2>
                        <div id="projectsList" class="space-y-2">
                            <!-- Projects will be loaded here -->
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-4">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-lg font-semibold flex items-center">
                                <i class="fas fa-images text-green-600 mr-2"></i>
                                图像列表
                            </h2>
                            <button id="uploadImageBtn" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm" title="上传图像">
                                <i class="fas fa-upload"></i>
                            </button>
                        </div>
                        <div id="imagesList" class="space-y-2">
                            <p class="text-gray-400 text-sm">选择一个项目查看图像</p>
                        </div>
                        <input type="file" id="imageFileInput" accept="image/*" class="hidden">
                    </div>
                </div>

                <!-- Center - Canvas -->
                <div class="col-span-6">
                    <div class="bg-white rounded-lg shadow p-4">
                        <!-- Toolbar -->
                        <div class="mb-4 flex items-center justify-between border-b pb-4">
                            <div class="flex items-center space-x-2">
                                <button id="pointTool" class="toolbar-btn px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" title="点标注">
                                    <i class="fas fa-circle"></i>
                                </button>
                                <button id="polygonTool" class="toolbar-btn px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" title="多边形标注">
                                    <i class="fas fa-draw-polygon"></i>
                                </button>
                                <button id="panTool" class="toolbar-btn px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 active" title="平移">
                                    <i class="fas fa-hand-paper"></i>
                                </button>
                                <div class="border-l h-8 mx-2"></div>
                                <button id="zoomIn" class="toolbar-btn px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" title="放大">
                                    <i class="fas fa-search-plus"></i>
                                </button>
                                <button id="zoomOut" class="toolbar-btn px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" title="缩小">
                                    <i class="fas fa-search-minus"></i>
                                </button>
                                <button id="resetView" class="toolbar-btn px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" title="重置视图">
                                    <i class="fas fa-expand"></i>
                                </button>
                            </div>
                            <div class="flex items-center space-x-2">
                                <select id="labelSelect" class="border rounded px-3 py-2">
                                    <option value="lymphocyte">淋巴细胞</option>
                                    <option value="tumor">肿瘤细胞</option>
                                    <option value="stromal">基质细胞</option>
                                    <option value="neutrophil">中性粒细胞</option>
                                    <option value="eosinophil">嗜酸性粒细胞</option>
                                    <option value="other">其他</option>
                                </select>
                                <button id="deleteMode" class="toolbar-btn px-3 py-2 rounded bg-red-100 hover:bg-red-200 text-red-600" title="删除模式">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Canvas Area -->
                        <div id="canvasContainer" class="canvas-container bg-gray-100 rounded" style="width: 100%; height: 500px;">
                            <canvas id="mainCanvas" width="800" height="500"></canvas>
                            <div id="annotationLayer" style="position: absolute; top: 0; left: 0; pointer-events: none;"></div>
                            <div id="noImagePlaceholder" class="flex items-center justify-center h-full text-gray-400">
                                <div class="text-center">
                                    <i class="fas fa-image text-6xl mb-4"></i>
                                    <p>选择图像开始标注</p>
                                </div>
                            </div>
                        </div>

                        <!-- Image Info -->
                        <div id="imageInfo" class="mt-4 text-sm text-gray-600 hidden">
                            <p><strong>图像:</strong> <span id="imageName">-</span></p>
                            <p><strong>尺寸:</strong> <span id="imageDimensions">-</span></p>
                            <p><strong>缩放:</strong> <span id="zoomLevel">100%</span></p>
                        </div>
                    </div>
                </div>

                <!-- Right Sidebar - Annotations & Statistics -->
                <div class="col-span-3 space-y-4">
                    <div class="bg-white rounded-lg shadow p-4">
                        <h2 class="text-lg font-semibold mb-4 flex items-center justify-between">
                            <span><i class="fas fa-tags text-purple-600 mr-2"></i>标注列表</span>
                            <span id="annotationCount" class="text-sm bg-purple-100 text-purple-600 px-2 py-1 rounded">0</span>
                        </h2>
                        <button id="aiAnalyzeBtn" class="w-full mb-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-all">
                            <i class="fas fa-robot"></i>
                            <span>AI智能识别</span>
                        </button>
                        <div id="annotationsList" class="space-y-2 max-h-96 overflow-y-auto">
                            <p class="text-gray-400 text-sm">暂无标注</p>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-4">
                        <h2 class="text-lg font-semibold mb-4 flex items-center">
                            <i class="fas fa-chart-pie text-orange-600 mr-2"></i>
                            统计信息
                        </h2>
                        <div id="statistics" class="space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span>总计:</span>
                                <span id="totalCount" class="font-semibold">0</span>
                            </div>
                            <div id="labelStats" class="space-y-1 mt-2">
                                <!-- Label statistics will be shown here -->
                            </div>
                            <button id="exportBtn" class="w-full mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center justify-center space-x-2">
                                <i class="fas fa-download"></i>
                                <span>导出数据</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
