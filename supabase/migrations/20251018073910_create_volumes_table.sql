/*
  # Create volumes table

  ## Description
  This migration creates a comprehensive volumes table to store 3D furniture design volumes with all their properties, geometry data, and surface specifications.

  ## Tables Created
  
  ### `volumes`
  Stores complete volume data including:
  - Basic properties (id, name, type, dimensions)
  - Transform data (position, rotation, scale)
  - Geometry data (vertices, indices, original points)
  - Surface specifications (face selections, roles, formulas)
  - Metadata (created_at, updated_at, is_saved)
  
  ## Columns
  
  - `id` (uuid, primary key) - Unique identifier for the volume
  - `name` (text, not null) - Name of the volume
  - `type` (text, not null) - Type of shape (box, cylinder, polyline, etc.)
  - `dimensions` (jsonb) - Dimensions object {width, height, depth, radius}
  - `position` (jsonb, not null) - Position array [x, y, z]
  - `rotation` (jsonb, not null) - Rotation array [x, y, z]
  - `scale` (jsonb, not null) - Scale array [x, y, z]
  - `original_points` (jsonb) - Original polyline points for 2D shapes
  - `geometry_data` (jsonb) - Complex geometry data (vertices, indices)
  - `is_2d_shape` (boolean, default false) - Flag for 2D shapes
  - `parameters` (jsonb) - Shape-specific parameters
  - `surface_specifications` (jsonb) - Surface selection and role data
  - `cabinet_code` (text, default 'ad060') - Cabinet code identifier
  - `description` (text) - Volume description
  - `pose` (integer, default 1) - Pose number
  - `is_saved` (boolean, default false) - Whether volume is saved permanently
  - `created_at` (timestamptz, default now()) - Creation timestamp
  - `updated_at` (timestamptz, default now()) - Last update timestamp
  
  ## Security
  
  - Enable RLS on `volumes` table
  - Allow anonymous users to read all volumes (for demo/public access)
  - Allow anonymous users to insert volumes (for demo/public access)
  - Allow anonymous users to update their volumes (for demo/public access)
  - Allow anonymous users to delete volumes (for demo/public access)
  
  ## Notes
  
  - All JSONB fields store complex data structures efficiently
  - The table supports both temporary (unsaved) and permanently saved volumes
  - Timestamps are automatically managed
*/

-- Create volumes table
CREATE TABLE IF NOT EXISTS volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  dimensions jsonb DEFAULT '{}'::jsonb,
  position jsonb NOT NULL DEFAULT '[0, 0, 0]'::jsonb,
  rotation jsonb NOT NULL DEFAULT '[0, 0, 0]'::jsonb,
  scale jsonb NOT NULL DEFAULT '[1, 1, 1]'::jsonb,
  original_points jsonb,
  geometry_data jsonb,
  is_2d_shape boolean DEFAULT false,
  parameters jsonb DEFAULT '{}'::jsonb,
  surface_specifications jsonb DEFAULT '[]'::jsonb,
  cabinet_code text DEFAULT 'ad060',
  description text DEFAULT '',
  pose integer DEFAULT 1,
  is_saved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE volumes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (demo mode)
CREATE POLICY "Allow public read access"
  ON volumes
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access"
  ON volumes
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON volumes
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access"
  ON volumes
  FOR DELETE
  TO anon
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_volumes_name ON volumes(name);
CREATE INDEX IF NOT EXISTS idx_volumes_is_saved ON volumes(is_saved);
CREATE INDEX IF NOT EXISTS idx_volumes_created_at ON volumes(created_at DESC);