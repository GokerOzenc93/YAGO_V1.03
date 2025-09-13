// File system utilities for user data management

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
  
  return {
    id: shape.id,
    name: volumeName,
    type: shape.type,
    dimensions,
    position: [...shape.position],
    rotation: [...shape.rotation],
    scale: [...shape.scale],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};