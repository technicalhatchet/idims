-- Add dryer symptom: won't stop spinning
INSERT INTO dma_tags (slug, label, category) VALUES
  ('wont_stop_spinning', 'Won''t stop spinning', 'symptom')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category;
