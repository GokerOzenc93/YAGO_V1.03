import React from 'react';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { SnapType } from '../../store/appStore';

export interface DimensionLine {
  id: string;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  distance: number;
  position: THREE.Vector3;
  unit: string;
}

export interface DimensionsState {
  isActive: boolean;
  firstPoint: THREE.Vector3 | null;
  secondPoint: THREE.Vector3 | null;
  previewPosition: THREE.Vector3 | null;
  isPositioning: boolean;
  completedDimensions: DimensionLine[];
}

export const INITIAL_DIMENSIONS_STATE: DimensionsState = {
  firstPoint: null,
  secondPoint: null,
  previewPosition: null,
  isPositioning: false,
  completedDimensions: []
};

interface DimensionLineComponentProps {
  dimension: DimensionLine;
  isPreview?: boolean;
}

export const DimensionLineComponent: React.FC<DimensionLineComponentProps> = ({ 
  dimension, 
  isPreview = false 
}) => {
  const midPoint = new THREE.Vector3()
    .addVectors(dimension.startPoint, dimension.endPoint)
    .multiplyScalar(0.5);
  
  const direction = new THREE.Vector3()
    .subVectors(dimension.endPoint, dimension.startPoint)
    .normalize();
  
  // Offset perpendicular to the line
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
  const offsetDistance = 50; // 50mm offset
  const textPosition = midPoint.clone().add(perpendicular.multiplyScalar(offsetDistance));
  
  return (
    <group>
      {/* Main dimension line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              dimension.startPoint.x, dimension.startPoint.y, dimension.startPoint.z,
              dimension.endPoint.x, dimension.endPoint.y, dimension.endPoint.z
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial 
          color={isPreview ? "#ff6b35" : "#2563eb"} 
          linewidth={2}
          transparent
          opacity={isPreview ? 0.8 : 1.0}
        />
      </line>
      
      {/* Extension lines */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={4}
            array={new Float32Array([
              // First extension line
              dimension.startPoint.x, dimension.startPoint.y, dimension.startPoint.z,
              textPosition.x, textPosition.y, textPosition.z,
              // Second extension line
              dimension.endPoint.x, dimension.endPoint.y, dimension.endPoint.z,
              textPosition.x + direction.x * (dimension.endPoint.x - dimension.startPoint.x), 
              textPosition.y, 
              textPosition.z + direction.z * (dimension.endPoint.z - dimension.startPoint.z)
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial 
          color={isPreview ? "#ff6b35" : "#666666"} 
          linewidth={1}
          transparent
          opacity={isPreview ? 0.6 : 0.8}
        />
      </line>
      
      {/* Start point marker */}
      <mesh position={dimension.startPoint}>
        <sphereGeometry args={[8]} />
        <meshBasicMaterial 
          color={isPreview ? "#ff6b35" : "#2563eb"}
          transparent
          opacity={isPreview ? 0.8 : 1.0}
        />
      </mesh>
      
      {/* End point marker */}
      <mesh position={dimension.endPoint}>
        <sphereGeometry args={[8]} />
        <meshBasicMaterial 
          color={isPreview ? "#ff6b35" : "#2563eb"}
          transparent
          opacity={isPreview ? 0.8 : 1.0}
        />
      </mesh>
      
      {/* Dimension text */}
      <Billboard position={textPosition}>
        <mesh>
          <planeGeometry args={[120, 30]} />
          <meshBasicMaterial 
            color="white" 
            transparent 
            opacity={isPreview ? 0.8 : 0.9}
          />
        </mesh>
        <Text
          position={[0, 0, 0.1]}
          fontSize={12}
          color={isPreview ? "#ff6b35" : "#000000"}
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-medium.woff"
        >
          {`${dimension.distance.toFixed(1)} ${dimension.unit}`}
        </Text>
      </Billboard>
    </group>
  );
};

interface DimensionsSystemProps {
  dimensionsState: DimensionsState;
  mousePosition: THREE.Vector3 | null;
}

export const DimensionsSystem: React.FC<DimensionsSystemProps> = ({
  dimensionsState,
  mousePosition
}) => {
  // Create preview dimension when positioning
  const previewDimension = React.useMemo(() => {
    if (!dimensionsState.isPositioning || 
        !dimensionsState.firstPoint || 
        !dimensionsState.secondPoint || 
        !mousePosition) {
      return null;
    }

    const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
    
    return {
      id: 'preview',
      startPoint: dimensionsState.firstPoint,
      endPoint: dimensionsState.secondPoint,
      distance,
      position: mousePosition,
      unit: 'mm'
    };
  }, [dimensionsState, mousePosition]);

  return (
    <group>
      {/* Completed dimensions */}
      {dimensionsState.completedDimensions.map(dimension => (
        <DimensionLineComponent 
          key={dimension.id} 
          dimension={dimension} 
        />
      ))}
      
      {/* Preview dimension */}
      {previewDimension && (
        <DimensionLineComponent 
          dimension={previewDimension} 
          isPreview={true}
        />
      )}
      
      {/* First point indicator */}
      {dimensionsState.firstPoint && !dimensionsState.secondPoint && (
        <mesh position={dimensionsState.firstPoint}>
          <sphereGeometry args={[12]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
};
