/*
  # Add Preview Image Column to Geometry Catalog

  1. Changes
    - Add `preview_image` column to `geometry_catalog` table
      - Type: text (stores base64 encoded image data URL)
      - Nullable: true (existing records won't have preview images)
      - Description: Stores a snapshot of the 3D geometry for preview purposes

  2. Notes
    - This column stores base64 encoded PNG images captured from the 3D canvas
    - Images are stored as data URLs (e.g., data:image/png;base64,...)
    - Existing records will have NULL values for this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'geometry_catalog' AND column_name = 'preview_image'
  ) THEN
    ALTER TABLE geometry_catalog ADD COLUMN preview_image text;
  END IF;
END $$;
