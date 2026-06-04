ALTER TABLE maritime_news
  ADD COLUMN IF NOT EXISTS image_source TEXT,
  ADD COLUMN IF NOT EXISTS image_credit TEXT;
