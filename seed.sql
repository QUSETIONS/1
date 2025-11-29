-- Seed data for development and testing

-- Insert sample projects
INSERT OR IGNORE INTO projects (id, name, description) VALUES 
  (1, '肺癌组织分析', '肺癌病理切片的细胞核标注和分类项目'),
  (2, '乳腺癌研究', '乳腺癌组织的免疫细胞识别和统计');

-- Insert sample images
INSERT OR IGNORE INTO images (id, project_id, filename, original_name, width, height, file_size) VALUES 
  (1, 1, 'sample_lung_01.jpg', '肺癌切片-01.jpg', 2048, 1536, 524288),
  (2, 1, 'sample_lung_02.jpg', '肺癌切片-02.jpg', 2048, 1536, 512000),
  (3, 2, 'sample_breast_01.jpg', '乳腺癌切片-01.jpg', 1920, 1080, 480000);

-- Insert sample annotations (示例标注数据)
INSERT OR IGNORE INTO annotations (id, image_id, annotation_type, label, coordinates, area, confidence, created_by) VALUES 
  (1, 1, 'polygon', 'lymphocyte', '[{"x":150,"y":200},{"x":165,"y":195},{"x":175,"y":210},{"x":160,"y":220}]', 250.5, 0.95, 'user'),
  (2, 1, 'polygon', 'tumor', '[{"x":350,"y":400},{"x":380,"y":390},{"x":395,"y":420},{"x":370,"y":435}]', 680.2, 0.88, 'model'),
  (3, 1, 'point', 'lymphocyte', '[{"x":550,"y":300}]', NULL, 0.92, 'user'),
  (4, 2, 'polygon', 'stromal', '[{"x":250,"y":150},{"x":270,"y":145},{"x":285,"y":165},{"x":265,"y":175}]', 320.8, 0.85, 'model');
