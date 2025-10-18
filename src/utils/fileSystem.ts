// File system utilities for user data management

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
 * Save volume data to JSON file
 */
export const saveVolumeToProject = async (volumeName: string, volumeData: VolumeData): Promise<boolean> => {
  try {
    const fileName = `${volumeName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filePath = `src/data/volumes/${fileName}`;
    
    // Create the JSON content
    const jsonContent = JSON.stringify(volumeData, null, 2);
    
    // Save to project folder (simulated - in real app would use Node.js fs)
    console.log(`📁 Saving volume to: ${filePath}`);
    console.log(`📄 Volume data:`, jsonContent);
    
    // Store in localStorage as fallback for browser environment
    const storageKey = `volume_${volumeName}`;
    localStorage.setItem(storageKey, jsonContent);
    
    // Also store list of saved volumes
    const savedVolumes = JSON.parse(localStorage.getItem('saved_volumes') || '[]');
    if (!savedVolumes.includes(volumeName)) {
      savedVolumes.push(volumeName);
      localStorage.setItem('saved_volumes', JSON.stringify(savedVolumes));
    }
    
    console.log(`✅ Volume saved: ${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to save volume:', error);
    return false;
  }
};

/**
 * Load volume data from project storage
 */
export const loadVolumeFromProject = (volumeName: string): Promise<VolumeData> => {
  return new Promise((resolve, reject) => {
    try {
      const storageKey = `volume_${volumeName}`;
      const content = localStorage.getItem(storageKey);
      
      if (!content) {
        reject(new Error('Volume not found'));
        return;
      }
      
      const volumeData = JSON.parse(content) as VolumeData;
      resolve(volumeData);
    } catch (error) {
      reject(new Error('Invalid volume data'));
    }
  });
};

/**
 * Get list of saved volumes
 */
export const getSavedVolumes = (): string[] => {
  return JSON.parse(localStorage.getItem('saved_volumes') || '[]');
};

/**
 * Delete volume from project storage
 */
export const deleteVolumeFromProject = (volumeName: string): boolean => {
  try {
    const storageKey = `volume_${volumeName}`;
    localStorage.removeItem(storageKey);
    
    // Remove from saved volumes list
    const savedVolumes = getSavedVolumes();
    const updatedVolumes = savedVolumes.filter(name => name !== volumeName);
    localStorage.setItem('saved_volumes', JSON.stringify(updatedVolumes));
    
    console.log(`✅ Volume deleted: ${volumeName}`);
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