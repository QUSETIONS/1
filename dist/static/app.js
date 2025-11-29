// Global State
let currentProject = null;
let currentImage = null;
let currentImageData = null;
let annotations = [];
let currentTool = 'pan';
let currentLabel = 'lymphocyte';
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let polygonPoints = [];

// Canvas elements
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer');
const annotationLayer = document.getElementById('annotationLayer');

// Label colors
const labelColors = {
  'lymphocyte': '#3b82f6',
  'tumor': '#ef4444',
  'stromal': '#10b981',
  'neutrophil': '#f59e0b',
  'eosinophil': '#8b5cf6',
  'other': '#6b7280'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  setupEventListeners();
  resizeCanvas();
});

// Resize canvas to fit container
function resizeCanvas() {
  const rect = canvasContainer.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  if (currentImageData) {
    drawImage();
  }
}

window.addEventListener('resize', resizeCanvas);

// Setup event listeners
function setupEventListeners() {
  // Tool buttons
  document.getElementById('pointTool').addEventListener('click', () => setTool('point'));
  document.getElementById('polygonTool').addEventListener('click', () => setTool('polygon'));
  document.getElementById('panTool').addEventListener('click', () => setTool('pan'));
  document.getElementById('zoomIn').addEventListener('click', () => zoom(1.2));
  document.getElementById('zoomOut').addEventListener('click', () => zoom(0.8));
  document.getElementById('resetView').addEventListener('click', resetView);
  document.getElementById('deleteMode').addEventListener('click', () => setTool('delete'));
  
  // Label select
  document.getElementById('labelSelect').addEventListener('change', (e) => {
    currentLabel = e.target.value;
  });
  
  // Canvas events
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  
  // New project button
  document.getElementById('newProjectBtn').addEventListener('click', createNewProject);
  
  // Export button
  document.getElementById('exportBtn').addEventListener('click', exportAnnotations);
  
  // Upload image button
  document.getElementById('uploadImageBtn').addEventListener('click', () => {
    if (!currentProject) {
      showNotification('请先选择项目', 'error');
      return;
    }
    document.getElementById('imageFileInput').click();
  });
  
  // File input change
  document.getElementById('imageFileInput').addEventListener('change', handleImageUpload);
  
  // AI analyze button
  document.getElementById('aiAnalyzeBtn').addEventListener('click', analyzeWithAI);
}

function setTool(tool) {
  currentTool = tool;
  polygonPoints = [];
  
  // Update UI
  document.querySelectorAll('.toolbar-btn').forEach(btn => btn.classList.remove('active'));
  
  if (tool === 'point') document.getElementById('pointTool').classList.add('active');
  if (tool === 'polygon') document.getElementById('polygonTool').classList.add('active');
  if (tool === 'pan') document.getElementById('panTool').classList.add('active');
  if (tool === 'delete') document.getElementById('deleteMode').classList.add('active');
  
  // Change cursor
  if (tool === 'pan') {
    canvas.style.cursor = 'grab';
  } else if (tool === 'delete') {
    canvas.style.cursor = 'not-allowed';
  } else {
    canvas.style.cursor = 'crosshair';
  }
}

// Canvas interaction handlers
function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  if (currentTool === 'pan') {
    isDragging = true;
    dragStartX = x - translateX;
    dragStartY = y - translateY;
    canvas.style.cursor = 'grabbing';
  } else if (currentTool === 'point' && currentImage) {
    addPointAnnotation(x, y);
  } else if (currentTool === 'polygon' && currentImage) {
    addPolygonPoint(x, y);
  } else if (currentTool === 'delete' && currentImage) {
    deleteAnnotationAt(x, y);
  }
}

function handleMouseMove(e) {
  if (!isDragging) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  translateX = x - dragStartX;
  translateY = y - dragStartY;
  
  drawImage();
}

function handleMouseUp(e) {
  isDragging = false;
  if (currentTool === 'pan') {
    canvas.style.cursor = 'grab';
  }
}

function handleWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  zoom(delta, e.offsetX, e.offsetY);
}

function zoom(factor, centerX, centerY) {
  const oldScale = scale;
  scale *= factor;
  scale = Math.max(0.1, Math.min(10, scale));
  
  if (centerX !== undefined && centerY !== undefined) {
    // Zoom towards mouse position
    translateX = centerX - (centerX - translateX) * (scale / oldScale);
    translateY = centerY - (centerY - translateY) * (scale / oldScale);
  }
  
  drawImage();
  document.getElementById('zoomLevel').textContent = Math.round(scale * 100) + '%';
}

function resetView() {
  scale = 1;
  translateX = 0;
  translateY = 0;
  drawImage();
  document.getElementById('zoomLevel').textContent = '100%';
}

// Draw image and annotations
function drawImage() {
  if (!currentImageData) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(translateX, translateY);
  ctx.scale(scale, scale);
  
  // Draw image
  const img = currentImageData;
  const imgAspect = img.width / img.height;
  const canvasAspect = canvas.width / canvas.height;
  
  let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
  
  if (imgAspect > canvasAspect) {
    drawWidth = canvas.width / scale;
    drawHeight = drawWidth / imgAspect;
    offsetY = (canvas.height / scale - drawHeight) / 2;
  } else {
    drawHeight = canvas.height / scale;
    drawWidth = drawHeight * imgAspect;
    offsetX = (canvas.width / scale - drawWidth) / 2;
  }
  
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  
  // Draw annotations
  annotations.forEach(ann => {
    drawAnnotation(ann, offsetX, offsetY, drawWidth / img.width, drawHeight / img.height);
  });
  
  // Draw polygon in progress
  if (polygonPoints.length > 0) {
    ctx.strokeStyle = labelColors[currentLabel];
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    polygonPoints.forEach((point, i) => {
      const x = offsetX + point.x * (drawWidth / img.width);
      const y = offsetY + point.y * (drawHeight / img.height);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw points
    polygonPoints.forEach(point => {
      const x = offsetX + point.x * (drawWidth / img.width);
      const y = offsetY + point.y * (drawHeight / img.height);
      ctx.fillStyle = labelColors[currentLabel];
      ctx.beginPath();
      ctx.arc(x, y, 4 / scale, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  ctx.restore();
}

function drawAnnotation(ann, offsetX, offsetY, scaleX, scaleY) {
  const coords = JSON.parse(ann.coordinates);
  const color = labelColors[ann.label] || '#6b7280';
  
  ctx.strokeStyle = color;
  ctx.fillStyle = color + '40';
  ctx.lineWidth = 2 / scale;
  
  if (ann.annotation_type === 'point') {
    const x = offsetX + coords[0].x * scaleX;
    const y = offsetY + coords[0].y * scaleY;
    ctx.beginPath();
    ctx.arc(x, y, 6 / scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
  } else if (ann.annotation_type === 'polygon') {
    ctx.beginPath();
    coords.forEach((point, i) => {
      const x = offsetX + point.x * scaleX;
      const y = offsetY + point.y * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// Annotation functions
async function addPointAnnotation(canvasX, canvasY) {
  if (!currentImage) return;
  
  // Convert canvas coordinates to image coordinates
  const rect = canvas.getBoundingClientRect();
  const imgCoords = canvasToImageCoords(canvasX, canvasY);
  
  try {
    const response = await axios.post(`/api/images/${currentImage.id}/annotations`, {
      annotation_type: 'point',
      label: currentLabel,
      coordinates: [imgCoords],
      created_by: 'user'
    });
    
    if (response.data.success) {
      await loadAnnotations(currentImage.id);
      showNotification('标注已添加', 'success');
    }
  } catch (error) {
    console.error('Error adding annotation:', error);
    showNotification('添加标注失败', 'error');
  }
}

function addPolygonPoint(canvasX, canvasY) {
  const imgCoords = canvasToImageCoords(canvasX, canvasY);
  polygonPoints.push(imgCoords);
  drawImage();
  
  // Double-click or click near first point to complete polygon
  if (polygonPoints.length >= 3) {
    // Check if clicked near first point
    const firstPoint = polygonPoints[0];
    const dist = Math.sqrt(Math.pow(imgCoords.x - firstPoint.x, 2) + Math.pow(imgCoords.y - firstPoint.y, 2));
    
    if (dist < 10) {
      completePolygon();
    }
  }
}

async function completePolygon() {
  if (polygonPoints.length < 3) return;
  
  try {
    const area = calculatePolygonArea(polygonPoints);
    
    const response = await axios.post(`/api/images/${currentImage.id}/annotations`, {
      annotation_type: 'polygon',
      label: currentLabel,
      coordinates: polygonPoints,
      area: area,
      created_by: 'user'
    });
    
    if (response.data.success) {
      polygonPoints = [];
      await loadAnnotations(currentImage.id);
      showNotification('多边形标注已添加', 'success');
    }
  } catch (error) {
    console.error('Error adding polygon:', error);
    showNotification('添加多边形失败', 'error');
  }
}

function calculatePolygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

async function deleteAnnotationAt(canvasX, canvasY) {
  const imgCoords = canvasToImageCoords(canvasX, canvasY);
  
  // Find annotation near click
  for (const ann of annotations) {
    const coords = JSON.parse(ann.coordinates);
    
    if (ann.annotation_type === 'point') {
      const dist = Math.sqrt(Math.pow(imgCoords.x - coords[0].x, 2) + Math.pow(imgCoords.y - coords[0].y, 2));
      if (dist < 15) {
        await deleteAnnotation(ann.id);
        return;
      }
    } else if (ann.annotation_type === 'polygon') {
      if (isPointInPolygon(imgCoords, coords)) {
        await deleteAnnotation(ann.id);
        return;
      }
    }
  }
}

async function deleteAnnotation(id) {
  try {
    await axios.delete(`/api/annotations/${id}`);
    await loadAnnotations(currentImage.id);
    showNotification('标注已删除', 'success');
  } catch (error) {
    console.error('Error deleting annotation:', error);
    showNotification('删除失败', 'error');
  }
}

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function canvasToImageCoords(canvasX, canvasY) {
  if (!currentImageData) return { x: 0, y: 0 };
  
  const img = currentImageData;
  const imgAspect = img.width / img.height;
  const canvasAspect = canvas.width / canvas.height;
  
  let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
  
  if (imgAspect > canvasAspect) {
    drawWidth = canvas.width / scale;
    drawHeight = drawWidth / imgAspect;
    offsetY = (canvas.height / scale - drawHeight) / 2;
  } else {
    drawHeight = canvas.height / scale;
    drawWidth = drawHeight * imgAspect;
    offsetX = (canvas.width / scale - drawWidth) / 2;
  }
  
  const x = ((canvasX - translateX) / scale - offsetX) * (img.width / drawWidth);
  const y = ((canvasY - translateY) / scale - offsetY) * (img.height / drawHeight);
  
  return { x: Math.round(x), y: Math.round(y) };
}

// API functions
async function loadProjects() {
  try {
    const response = await axios.get('/api/projects');
    if (response.data.success) {
      displayProjects(response.data.data);
    }
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

function displayProjects(projects) {
  const container = document.getElementById('projectsList');
  
  if (projects.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm">暂无项目</p>';
    return;
  }
  
  container.innerHTML = projects.map(project => `
    <div class="project-item p-3 border rounded hover:bg-gray-50 cursor-pointer" data-id="${project.id}">
      <div class="font-medium">${project.name}</div>
      <div class="text-xs text-gray-500">${project.description || '无描述'}</div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      selectProject(id);
    });
  });
}

async function selectProject(id) {
  try {
    const response = await axios.get(`/api/projects/${id}`);
    if (response.data.success) {
      currentProject = response.data.data;
      displayImages(response.data.data.images);
      
      // Highlight selected project
      document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('bg-blue-50', 'border-blue-300');
        if (item.dataset.id === id) {
          item.classList.add('bg-blue-50', 'border-blue-300');
        }
      });
    }
  } catch (error) {
    console.error('Error loading project:', error);
  }
}

function displayImages(images) {
  const container = document.getElementById('imagesList');
  
  if (images.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm">暂无图像</p>';
    return;
  }
  
  container.innerHTML = images.map(image => `
    <div class="image-item p-3 border rounded hover:bg-gray-50 cursor-pointer" data-id="${image.id}">
      <div class="font-medium text-sm">${image.original_name}</div>
      <div class="text-xs text-gray-500">${image.width} × ${image.height}</div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.image-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      selectImage(id);
    });
  });
}

async function selectImage(id) {
  try {
    const response = await axios.get(`/api/images/${id}`);
    if (response.data.success) {
      currentImage = response.data.data;
      
      // Try to load image from R2, fallback to placeholder
      await loadImageFromR2(id);
      
      // Load annotations
      await loadAnnotations(id);
      
      // Load statistics
      await loadStatistics(id);
      
      // Update UI
      document.getElementById('imageName').textContent = currentImage.original_name;
      document.getElementById('imageDimensions').textContent = `${currentImage.width} × ${currentImage.height}`;
      document.getElementById('imageInfo').classList.remove('hidden');
      document.getElementById('noImagePlaceholder').classList.add('hidden');
      
      // Highlight selected image
      document.querySelectorAll('.image-item').forEach(item => {
        item.classList.remove('bg-green-50', 'border-green-300');
        if (item.dataset.id === id) {
          item.classList.add('bg-green-50', 'border-green-300');
        }
      });
    }
  } catch (error) {
    console.error('Error loading image:', error);
  }
}

function loadImagePreview(image) {
  // Create a sample image for demo
  const img = new Image();
  img.onload = () => {
    currentImageData = img;
    resetView();
    drawImage();
  };
  
  // For demo, create a colored canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Create gradient background
  const gradient = tempCtx.createLinearGradient(0, 0, image.width, image.height);
  gradient.addColorStop(0, '#f3e8ff');
  gradient.addColorStop(1, '#dbeafe');
  tempCtx.fillStyle = gradient;
  tempCtx.fillRect(0, 0, image.width, image.height);
  
  // Add text
  tempCtx.fillStyle = '#6b7280';
  tempCtx.font = '48px Arial';
  tempCtx.textAlign = 'center';
  tempCtx.fillText(image.original_name, image.width / 2, image.height / 2);
  tempCtx.font = '24px Arial';
  tempCtx.fillText('示例病理图像', image.width / 2, image.height / 2 + 40);
  
  img.src = tempCanvas.toDataURL();
}

async function loadAnnotations(imageId) {
  try {
    const response = await axios.get(`/api/images/${imageId}/annotations`);
    if (response.data.success) {
      annotations = response.data.data;
      displayAnnotationsList(annotations);
      drawImage();
    }
  } catch (error) {
    console.error('Error loading annotations:', error);
  }
}

function displayAnnotationsList(annotations) {
  const container = document.getElementById('annotationsList');
  document.getElementById('annotationCount').textContent = annotations.length;
  
  if (annotations.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm">暂无标注</p>';
    return;
  }
  
  container.innerHTML = annotations.map((ann, index) => `
    <div class="p-2 border rounded text-sm hover:bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 rounded" style="background-color: ${labelColors[ann.label] || '#6b7280'}"></div>
          <span class="font-medium">${getLabelName(ann.label)}</span>
        </div>
        <span class="text-xs text-gray-500">${ann.annotation_type}</span>
      </div>
      ${ann.area ? `<div class="text-xs text-gray-500 mt-1">面积: ${Math.round(ann.area)} px²</div>` : ''}
    </div>
  `).join('');
}

async function loadStatistics(imageId) {
  try {
    const response = await axios.get(`/api/images/${imageId}/statistics`);
    if (response.data.success) {
      displayStatistics(response.data.data);
    }
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

function displayStatistics(stats) {
  document.getElementById('totalCount').textContent = stats.total;
  
  const container = document.getElementById('labelStats');
  
  if (stats.byLabel.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-xs">暂无统计数据</p>';
    return;
  }
  
  container.innerHTML = stats.byLabel.map(item => `
    <div class="flex items-center justify-between text-xs">
      <div class="flex items-center space-x-2">
        <div class="w-3 h-3 rounded" style="background-color: ${labelColors[item.label] || '#6b7280'}"></div>
        <span>${getLabelName(item.label)}</span>
      </div>
      <span class="font-semibold">${item.count}</span>
    </div>
  `).join('');
}

function getLabelName(label) {
  const names = {
    'lymphocyte': '淋巴细胞',
    'tumor': '肿瘤细胞',
    'stromal': '基质细胞',
    'neutrophil': '中性粒细胞',
    'eosinophil': '嗜酸性粒细胞',
    'other': '其他'
  };
  return names[label] || label;
}

async function createNewProject() {
  const name = prompt('请输入项目名称:');
  if (!name) return;
  
  const description = prompt('请输入项目描述 (可选):');
  
  try {
    const response = await axios.post('/api/projects', {
      name,
      description
    });
    
    console.log('Create project response:', response.data);
    
    if (response.data && response.data.success) {
      showNotification('项目创建成功', 'success');
      await loadProjects();
    } else {
      showNotification('创建项目失败: ' + (response.data?.error || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('Error creating project:', error);
    console.error('Error response:', error.response?.data);
    showNotification('创建项目失败: ' + (error.response?.data?.error || error.message || '网络错误'), 'error');
  }
}

async function exportAnnotations() {
  if (!currentImage) {
    showNotification('请先选择图像', 'error');
    return;
  }
  
  try {
    const response = await axios.get(`/api/images/${currentImage.id}/export`);
    
    const dataStr = JSON.stringify(response.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `annotations_${currentImage.id}_${Date.now()}.json`;
    link.click();
    
    showNotification('数据导出成功', 'success');
  } catch (error) {
    console.error('Error exporting annotations:', error);
    showNotification('导出失败', 'error');
  }
}

function showNotification(message, type = 'info') {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  };
  
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ==================== New Features ====================

// Handle image upload
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!currentProject) {
    showNotification('请先选择项目', 'error');
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showNotification('请选择图像文件', 'error');
    return;
  }
  
  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    showNotification('图像文件不能超过10MB', 'error');
    return;
  }
  
  try {
    showNotification('正在上传图像...', 'info');
    
    // Get image dimensions
    const dimensions = await getImageDimensions(file);
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('width', dimensions.width);
    formData.append('height', dimensions.height);
    
    // Upload to server
    const response = await axios.post(
      `/api/projects/${currentProject.id}/images/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    if (response.data.success) {
      showNotification('图像上传成功！', 'success');
      
      // Reload images list
      await selectProject(currentProject.id);
      
      // Clear file input
      event.target.value = '';
    } else {
      showNotification('上传失败: ' + response.data.error, 'error');
    }
  } catch (error) {
    console.error('Upload error:', error);
    showNotification('上传失败: ' + (error.response?.data?.error || error.message), 'error');
  }
}

// Get image dimensions from file
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    // Add timeout handler (5 seconds)
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      console.warn('Image dimension loading timeout, using default dimensions');
      // Don't reject, use default dimensions
      resolve({
        width: 2048,
        height: 1536
      });
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      console.log('Image dimensions loaded:', img.width, 'x', img.height);
      resolve({
        width: img.width,
        height: img.height
      });
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      console.error('Failed to load image for dimension detection, using defaults');
      // Don't reject, use default dimensions
      resolve({
        width: 2048,
        height: 1536
      });
    };
    
    img.src = url;
  });
}

// AI-powered cell detection
async function analyzeWithAI() {
  if (!currentImage) {
    showNotification('请先选择图像', 'error');
    return;
  }
  
  // Confirm with user
  const confirmed = confirm(
    'AI智能识别功能将使用OpenAI Vision API分析图像并自动标注细胞。\n\n' +
    '注意：\n' +
    '1. 需要配置OPENAI_API_KEY环境变量\n' +
    '2. 将产生API调用费用\n' +
    '3. 分析可能需要10-30秒\n\n' +
    '是否继续？'
  );
  
  if (!confirmed) return;
  
  try {
    // Disable button and show loading
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    const originalText = aiBtn.innerHTML;
    aiBtn.disabled = true;
    aiBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>AI分析中...';
    
    showNotification('AI正在分析图像，请稍候...', 'info');
    
    // Call AI analysis API
    const response = await axios.post(`/api/images/${currentImage.id}/analyze`);
    
    // Restore button
    aiBtn.disabled = false;
    aiBtn.innerHTML = originalText;
    
    if (response.data.success) {
      const count = response.data.data.detected_count;
      showNotification(`AI成功识别 ${count} 个细胞！`, 'success');
      
      // Reload annotations and statistics
      await loadAnnotations(currentImage.id);
      await loadStatistics(currentImage.id);
    } else {
      showNotification('AI分析失败: ' + response.data.error, 'error');
    }
  } catch (error) {
    // Restore button
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    aiBtn.disabled = false;
    aiBtn.innerHTML = '<i class="fas fa-robot mr-2"></i>AI智能识别';
    
    console.error('AI analysis error:', error);
    
    if (error.response?.status === 500 && error.response?.data?.error?.includes('OPENAI_API_KEY')) {
      showNotification('请先配置OpenAI API密钥', 'error');
    } else {
      showNotification('AI分析失败: ' + (error.response?.data?.error || error.message), 'error');
    }
  }
}

// Update loadImagePreview to load from R2 if available
async function loadImageFromR2(imageId) {
  try {
    const response = await axios.get(`/api/images/${imageId}/file`, {
      responseType: 'blob'
    });
    
    const blob = response.data;
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.onload = () => {
      currentImageData = img;
      resetView();
      drawImage();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback to placeholder
      loadImagePreview(currentImage);
    };
    img.src = url;
    
  } catch (error) {
    console.error('Failed to load image from R2:', error);
    // Fallback to placeholder
    loadImagePreview(currentImage);
  }
}
