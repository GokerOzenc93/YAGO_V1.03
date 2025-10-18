/*
  # Create Geometry Catalog Table

  1. New Tables
    - `geometry_catalog`
      - `id` (uuid, primary key) - Unique identifier
      - `code` (text, unique, not null) - Geometry code (e.g., CHAIR-001)
      - `description` (text) - Description of the geometry
      - `tags` (text array) - Tags for categorization
      - `geometry_data` (jsonb, not null) - Serialized geometry data
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `geometry_catalog` table
    - Add policy for public read access (no auth required for reading)
    - Add policy for public insert access (no auth required for inserting)
    - Add policy for public update access (no auth required for updating)
    - Add policy for public delete access (no auth required for deleting)

  3. Indexes
    - Index on `code` for fast lookups
    - Index on `tags` for filtering
    - Index on `created_at` for sorting
*/

CREATE TABLE IF NOT EXISTS geometry_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text DEFAULT '',
  tags text[] DEFAULT ARRAY[]::text[],
  geometry_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE geometry_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON geometry_catalog
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access"
  ON geometry_catalog
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON geometry_catalog
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access"
  ON geometry_catalog
  FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_geometry_catalog_code ON geometry_catalog(code);
CREATE INDEX IF NOT EXISTS idx_geometry_catalog_tags ON geometry_catalog USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_geometry_catalog_created_at ON geometry_catalog(created_at DESC);
