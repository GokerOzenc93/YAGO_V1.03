import React, { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { useAppStore } from '../store/appStore';

interface DimensionArrowsProps {
  shape: Shape;
}

const DimensionArrows: React.FC<DimensionArrowsProps> = ({ shape }) => {
  const { visibleDimensions, convertToDisplayUnit, measurementUnit } = useAppStore();

  const dimensions = useMemo(() => {
    if (!shape.geometry) return null;

    shape.geometry.computeBoundingBox();
    const bbox = shape.geometry.boundingBox;
    if (!bbox) return null;

    const width = (bbox.max.x - bbox.min.x) * shape.scale[0];
    const height = (bbox.max.y - bbox.min.y) * shape.scale[1];
    const depth = (bbox.max.z - bbox.min.z) * shape.scale[2];

    const center = new THREE.Vector3(
      (bbox.max.x + bbox.min.x) / 2 * shape.scale[0] + shape.position[0],
      (bbox.max.y + bbox.min.y) / 2 * shape.scale[1] + shape.position[1],
      (bbox.max.z + bbox.min.z) / 2 * shape.scale[2] + shape.position[2]
    );

    const min = new THREE.Vector3(
      bbox.min.x * shape.scale[0] + shape.position[0],
      bbox.min.y * shape.scale[1] + shape.position[1],
      bbox.min.z * shape.scale[2] + shape.position[2]
    );

    const max = new THREE.Vector3(
      bbox.max.x * shape.scale[0] + shape.position[0],
      bbox.max.y * shape.scale[1] + shape.position[1],
      bbox.max.z * shape.scale[2] + shape.position[2]
    );

    return { width, height, depth, center, min, max };
  }, [shape]);

  if (!dimensions) return null;

  const offset = 50;

  return (
    <group>
      {visibleDimensions.has('width') && (
        <group>
          <Line
            points={[
              [dimensions.min.x, dimensions.min.y - offset, dimensions.min.z],
              [dimensions.max.x, dimensions.min.y - offset, dimensions.min.z]
            ]}
            color="#6b7280"
            lineWidth={2}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Line
            points={[
              [dimensions.min.x, dimensions.min.y, dimensions.min.z],
              [dimensions.min.x, dimensions.min.y - offset, dimensions.min.z]
            ]}
            color="#6b7280"
            lineWidth={1}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Line
            points={[
              [dimensions.max.x, dimensions.min.y, dimensions.min.z],
              [dimensions.max.x, dimensions.min.y - offset, dimensions.min.z]
            ]}
            color="#6b7280"
            lineWidth={1}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Html
            position={[dimensions.center.x, dimensions.min.y - offset - 20, dimensions.min.z]}
            center
          >
            <div className="text-gray-800 text-sm font-semibold whitespace-nowrap bg-white px-1">
              W: {convertToDisplayUnit(dimensions.width).toFixed(2)} {measurementUnit}
            </div>
          </Html>
        </group>
      )}

      {visibleDimensions.has('height') && (
        <group>
          <Line
            points={[
              [dimensions.max.x + offset, dimensions.min.y, dimensions.min.z],
              [dimensions.max.x + offset, dimensions.max.y, dimensions.min.z]
            ]}
            color="#6b7280"
            lineWidth={2}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Line
            points={[
              [dimensions.max.x, dimensions.min.y, dimensions.min.z],
              [dimensions.max.x + offset, dimensions.min.y, dimensions.min.z]
            ]}
            color="#6b7280"
            lineWidth={1}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Line
            points={[
              [dimensions.max.x, dimensions.max.y, dimensions.min.z],
              [dimensions.max.x + offset, dimensions.max.y, dimensions.min.z]
            ]}
            color="#6b7280"
            lineWidth={1}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Html
            position={[dimensions.max.x + offset + 20, dimensions.center.y, dimensions.min.z]}
            center
          >
            <div className="text-gray-800 text-sm font-semibold whitespace-nowrap bg-white px-1">
              H: {convertToDisplayUnit(dimensions.height).toFixed(2)} {measurementUnit}
            </div>
          </Html>
        </group>
      )}

      {visibleDimensions.has('depth') && (
        <group>
          <Line
            points={[
              [dimensions.max.x + offset, dimensions.min.y, dimensions.min.z],
              [dimensions.max.x + offset, dimensions.min.y, dimensions.max.z]
            ]}
            color="#6b7280"
            lineWidth={2}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Line
            points={[
              [dimensions.max.x, dimensions.min.y, dimensions.min.z],
              [dimensions.max.x + offset, dimensions.min.y, dimensions.min.z]
            ]}
            color="#6b7280"
            lineWidth={1}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Line
            points={[
              [dimensions.max.x, dimensions.min.y, dimensions.max.z],
              [dimensions.max.x + offset, dimensions.min.y, dimensions.max.z]
            ]}
            color="#6b7280"
            lineWidth={1}
            dashed
            dashScale={1}
            dashSize={8}
            gapSize={4}
          />
          <Html
            position={[dimensions.max.x + offset + 20, dimensions.min.y, dimensions.center.z]}
            center
          >
            <div className="text-gray-800 text-sm font-semibold whitespace-nowrap bg-white px-1">
              D: {convertToDisplayUnit(dimensions.depth).toFixed(2)} {measurementUnit}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};

export default DimensionArrows;
