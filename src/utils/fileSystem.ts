// File system utilities for user data management
import { supabase } from '../lib/supabase';

export interface SurfaceSpecification {
  id: string;
  faceIndex: number | null;
  role: string;
  formula: string;
  isActive: boolean;
  confirmed: boolean;
}

export interface VolumeData {
  id: string;
  name: string;
  type: string;
  dimensions: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
  };
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  originalPoints?: Array<{x: number, y: number, z: number}> | null; // 🎯 NEW: Original polyline points
  geometryData?: { // 🎯 NEW: Complex geometry data
    vertices: Array<{x: number, y: number, z: number}>;
    indices: number[] | null;
    vertexCount: number;
    triangleCount: number;
  } | null;
  is2DShape?: boolean; // 🎯 NEW: 2D shape flag
  parameters?: any; // 🎯 NEW: Shape parameters
  surfaceSpecifications?: SurfaceSpecification[]; // 🎯 NEW: Surface specifications
  createdAt: string;
  updatedAt: string;
}

/**
 * Save volume data to Supabase database
 */
export const saveVolumeToProject = async (volumeName: string, volumeData: VolumeData): Promise<boolean> => {
  try {
    console.log(`📁 Saving volume to database: ${volumeName}`);
    console.log(`📄 Volume data:`, volumeData);

    // Check if volume already exists
    console.log('🔍 Checking if volume exists...');
    const { data: existingVolume, error: checkError } = await supabase
      .from('volumes')
      .select('id')
      .eq('name', volumeName)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking existing volume:', checkError);
    }

    console.log('Existing volume:', existingVolume);

    let result;

    if (existingVolume) {
      // Update existing volume
      result = await supabase
        .from('volumes')
        .update({
          type: volumeData.type,
          dimensions: volumeData.dimensions,
          position: volumeData.position,
          rotation: volumeData.rotation,
          scale: volumeData.scale,
          original_points: volumeData.originalPoints,
          geometry_data: volumeData.geometryData,
          is_2d_shape: volumeData.is2DShape,
          parameters: volumeData.parameters,
          surface_specifications: volumeData.surfaceSpecifications,
          is_saved: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingVolume.id);
    } else {
      // Insert new volume
      result = await supabase
        .from('volumes')
        .insert({
          id: volumeData.id,
          name: volumeName,
          type: volumeData.type,
          dimensions: volumeData.dimensions,
          position: volumeData.position,
          rotation: volumeData.rotation,
          scale: volumeData.scale,
          original_points: volumeData.originalPoints,
          geometry_data: volumeData.geometryData,
          is_2d_shape: volumeData.is2DShape,
          parameters: volumeData.parameters,
          surface_specifications: volumeData.surfaceSpecifications,
          is_saved: true
        });
    }

    if (result.error) {
      console.error('❌ Supabase error:', result.error);
      return false;
    }

    console.log(`✅ Volume saved to database: ${volumeName}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to save volume:', error);
    return false;
  }
};

/**
 * Load volume data from Supabase database
 */
export const loadVolumeFromProject = async (volumeName: string): Promise<VolumeData> => {
  try {
    const { data, error } = await supabase
      .from('volumes')
      .select('*')
      .eq('name', volumeName)
      .eq('is_saved', true)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase error:', error);
      throw new Error('Failed to load volume from database');
    }

    if (!data) {
      throw new Error('Volume not found');
    }

    // Convert database format to VolumeData format
    const volumeData: VolumeData = {
      id: data.id,
      name: data.name,
      type: data.type,
      dimensions: data.dimensions,
      position: data.position,
      rotation: data.rotation,
      scale: data.scale,
      originalPoints: data.original_points,
      geometryData: data.geometry_data,
      is2DShape: data.is_2d_shape,
      parameters: data.parameters,
      surfaceSpecifications: data.surface_specifications,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    return volumeData;
  } catch (error) {
    console.error('❌ Failed to load volume:', error);
    throw error;
  }
};

/**
 * Get list of saved volumes from database
 */
export const getSavedVolumes = async (): Promise<string[]> => {
  try {
    console.log('🔍 Fetching saved volumes from database...');
    const { data, error } = await supabase
      .from('volumes')
      .select('name')
      .eq('is_saved', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error:', error);
      return [];
    }

    console.log('✅ Fetched volumes:', data);
    return data ? data.map(v => v.name) : [];
  } catch (error) {
    console.error('❌ Failed to get saved volumes:', error);
    return [];
  }
};

/**
 * Delete volume from database
 */
export const deleteVolumeFromProject = async (volumeName: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('volumes')
      .delete()
      .eq('name', volumeName)
      .eq('is_saved', true);

    if (error) {
      console.error('❌ Supabase error:', error);
      return false;
    }

    console.log(`✅ Volume deleted from database: ${volumeName}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete volume:', error);
    return false;
  }
};

/**
 * Create volume data from shape
 */
export const createVolumeDataFromShape = (shape: any, volumeName: string): VolumeData => {
  // Calculate actual dimensions from geometry and scale
  const geometry = shape.geometry;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  
  const actualWidth = (bbox.max.x - bbox.min.x) * shape.scale[0];
  const actualHeight = (bbox.max.y - bbox.min.y) * shape.scale[1];
  const actualDepth = (bbox.max.z - bbox.min.z) * shape.scale[2];
  
  const dimensions: any = {};
  
  if (shape.type === 'box' || shape.type.includes('rectangle') || shape.type.includes('polyline') || shape.type.includes('polygon')) {
    dimensions.width = actualWidth;
    dimensions.height = actualHeight;
    dimensions.depth = actualDepth;
  } else if (shape.type === 'cylinder' || shape.type.includes('circle')) {
    dimensions.radius = actualWidth / 2; // Assuming width is diameter
    dimensions.height = actualHeight;
  }
  
  // 🎯 COMPLEX GEOMETRY SUPPORT - Store geometry data for complex shapes
  let geometryData = null;
  let originalPoints = null;
  
  // Store original points for polyline/polygon shapes
  if (shape.originalPoints && shape.originalPoints.length > 0) {
    originalPoints = shape.originalPoints.map(point => ({
      x: point.x,
      y: point.y,
      z: point.z
    }));
    console.log(`🎯 Storing ${originalPoints.length} original points for ${shape.type}`);
  }
  
  // Store geometry vertices for complex shapes (boolean operations, etc.)
  if (geometry && geometry.attributes && geometry.attributes.position) {
    const positions = geometry.attributes.position.array;
    const vertices = [];
    
    // Convert Float32Array to regular array for JSON serialization
    for (let i = 0; i < positions.length; i += 3) {
      vertices.push({
        x: positions[i],
        y: positions[i + 1],
        z: positions[i + 2]
      });
    }
    
    // Store indices if available
    let indices = null;
    if (geometry.index) {
      indices = Array.from(geometry.index.array);
    }
    
    geometryData = {
      vertices: vertices,
      indices: indices,
      vertexCount: vertices.length,
      triangleCount: indices ? indices.length / 3 : vertices.length / 3
    };
    
    console.log(`🎯 Storing geometry data: ${vertices.length} vertices, ${geometryData.triangleCount} triangles`);
  }
  
  return {
    id: shape.id,
    name: volumeName,
    type: shape.type,
    dimensions,
    position: [...shape.position],
    rotation: [...shape.rotation],
    scale: [...shape.scale],
    originalPoints: originalPoints, // 🎯 NEW: Store original polyline points
    geometryData: geometryData, // 🎯 NEW: Store complex geometry data
    is2DShape: shape.is2DShape || false, // 🎯 NEW: Store 2D shape flag
    parameters: shape.parameters ? { ...shape.parameters } : {}, // 🎯 NEW: Store shape parameters
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};