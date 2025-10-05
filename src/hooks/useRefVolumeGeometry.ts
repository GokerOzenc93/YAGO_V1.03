import { useMemo } from 'react';
import { Shape } from '../types/shapes';

export function useRefVolumeGeometry(editedShape: Shape) {
  const { currentWidth, currentHeight, currentDepth } = useMemo(() => {
    if (!editedShape.geometry) {
      return { currentWidth: 500, currentHeight: 500, currentDepth: 500 };
    }

    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;
    if (!bbox) return { currentWidth: 500, currentHeight: 500, currentDepth: 500 };

    return {
      currentWidth: (bbox.max.x - bbox.min.x) * editedShape.scale[0],
      currentHeight: (bbox.max.y - bbox.min.y) * editedShape.scale[1],
      currentDepth: (bbox.max.z - bbox.min.z) * editedShape.scale[2],
    };
  }, [editedShape.geometry, editedShape.scale]);

  const canEditWidth = ['box', 'rectangle2d', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(editedShape.type);
  const canEditDepth = canEditWidth;

  return {
    currentWidth,
    currentHeight,
    currentDepth,
    canEditWidth,
    canEditDepth
  };
}
