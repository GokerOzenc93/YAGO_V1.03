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
export const saveVolumeToFile = async (volumeName: string, volumeData: VolumeData): Promise<boolean> => {
  try {
    const fileName = `${volumeName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filePath = `/user-files/volumes/${fileName}`;
    
    // Create the JSON content
    const jsonContent = JSON.stringify(volumeData, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    console.log(`✅ Volume saved: ${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to save volume:', error);
    return false;
  }
};

/**
 * Load volume data from JSON file
 */
export const loadVolumeFromFile = (file: File): Promise<VolumeData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const volumeData = JSON.parse(content) as VolumeData;
        resolve(volumeData);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
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