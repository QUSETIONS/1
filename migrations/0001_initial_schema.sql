-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  file_size INTEGER NOT NULL,
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Annotations table (for cells/nuclei)
CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  annotation_type TEXT NOT NULL, -- 'point', 'polygon', 'circle'
  label TEXT, -- cell type: 'lymphocyte', 'tumor', 'stromal', etc.
  coordinates TEXT NOT NULL, -- JSON array of coordinates
  area REAL, -- calculated area
  confidence REAL, -- 0-1 confidence score
  created_by TEXT, -- 'user' or 'model'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- Cell features table (for advanced analysis)
CREATE TABLE IF NOT EXISTS cell_features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annotation_id INTEGER NOT NULL,
  feature_type TEXT NOT NULL, -- 'morphology', 'intensity', 'texture'
  feature_data TEXT NOT NULL, -- JSON object with feature values
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
);

-- Statistics table (for caching computed statistics)
CREATE TABLE IF NOT EXISTS statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  stat_type TEXT NOT NULL, -- 'cell_count', 'label_distribution', etc.
  stat_data TEXT NOT NULL, -- JSON object with statistics
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_image_id ON annotations(image_id);
CREATE INDEX IF NOT EXISTS idx_annotations_label ON annotations(label);
CREATE INDEX IF NOT EXISTS idx_cell_features_annotation_id ON cell_features(annotation_id);
CREATE INDEX IF NOT EXISTS idx_statistics_image_id ON statistics(image_id);
