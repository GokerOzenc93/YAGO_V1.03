import React from 'react';
import * as THREE from 'three';
import { Tool } from '../../store/appStore';
import { CompletedShape } from './types';
import { convertTo3DShape } from './shapeConverter';

interface CompletedShapesRendererProps {
  completedShapes: CompletedShape[];
  hoveredShapeId: string | null;
  editingPolylineId: string | null;
  activeTool: Tool;
  gridSize: number;
  lastHoverMessageTime: number;
  setHoveredShapeId: (id: string | null) => void;
  setLastHoverMessageTime: (time: number) => void;
  setCompletedShapes: React.Dispatch<React.SetStateAction<CompletedShape[]>>;
  setEditingPolylineId: (id: string | null) => void;
  setActiveTool: (tool: Tool) => void;
  addShape: (shape: any) => void;
  selectShape: (id: string) => void;
}

export const CompletedShapesRenderer: React.FC<CompletedShapesRendererProps> = ({
  completedShapes,
  hoveredShapeId,
  editingPolylineId,
  activeTool,
  gridSize,
  lastHoverMessageTime,
  setHoveredShapeId,
  setLastHoverMessageTime,
  setCompletedShapes,
  setEditingPolylineId,
  setActiveTool,
  addShape,
  selectShape,
}) => {
  return (
    <>
      {completedShapes.map(shape => (
        <group key={shape.id}>
          <line geometry={new THREE.BufferGeometry().setFromPoints(shape.points)}>
            <lineBasicMaterial
              color={
                editingPolylineId === shape.id ? "#f59e0b" :
                hoveredShapeId === shape.id ? "#333333" : "#000000"
              }
              linewidth={2}
            />
          </line>

          {shape.points.length >= 2 && shape.points.map((point, index) => {
            if (index === shape.points.length - 1) return null;
            const nextPoint = shape.points[index + 1];
            const direction = new THREE.Vector3().subVectors(nextPoint, point);
            const length = direction.length();
            const center = new THREE.Vector3().addVectors(point, nextPoint).multiplyScalar(0.5);

            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              direction.clone().normalize()
            );

            return (
              <mesh
                key={`segment-${shape.id}-${index}`}
                position={center}
                quaternion={quaternion}
                userData={{ shapeId: shape.id, isPolylineSegment: true }}
                renderOrder={999}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredShapeId(shape.id);
                  const now = Date.now();
                  if (now - lastHoverMessageTime > 2000) {
                    console.log(`🎯 Çizgi vurgulandı - SPACE tuşuna basarak listeye ekleyin`);
                    setLastHoverMessageTime(now);
                  }
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  setHoveredShapeId(null);
                }}
                onPointerDown={async (e) => {
                  e.stopPropagation();
                  console.log(`✓ Clicked on segment ${index} of shape ${shape.id}`);
                  await convertTo3DShape(shape, addShape, selectShape, gridSize);
                  setCompletedShapes(prev => prev.filter(s => s.id !== shape.id));
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  console.log(`✓ onClick triggered on segment ${index} of shape ${shape.id}`);
                  await convertTo3DShape(shape, addShape, selectShape, gridSize);
                  setCompletedShapes(prev => prev.filter(s => s.id !== shape.id));
                }}
              >
                <cylinderGeometry args={[gridSize * 3, gridSize * 3, length, 32]} />
                <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
              </mesh>
            );
          })}

          {activeTool === Tool.POLYLINE_EDIT && (shape.type === 'polyline' || shape.type === 'polygon') && (
            <>
              {shape.points.map((point, index) => (
                <mesh
                  key={index}
                  position={point}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPolylineId(shape.id);
                    setActiveTool(Tool.POLYLINE_EDIT);
                  }}
                >
                  <sphereGeometry args={[gridSize * 1.5, 16, 16]} />
                  <meshBasicMaterial color="#3b82f6" />
                </mesh>
              ))}
            </>
          )}
        </group>
      ))}
    </>
  );
};
