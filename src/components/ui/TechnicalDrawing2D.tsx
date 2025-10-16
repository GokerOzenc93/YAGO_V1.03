import React, { useRef, useEffect, useState } from 'react';
import { Shape } from '../../types/shapes';
import * as THREE from 'three';

interface TechnicalDrawing2DProps {
  shape: Shape;
  view: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
  width: number;
  height: number;
  depth: number;
  convertToDisplayUnit: (value: number) => number;
  convertToBaseUnit: (value: number) => number;
  onUpdateShape?: () => void;
}

interface ProjectedPoint {
  x: number;
  y: number;
}

interface ProjectedEdge {
  start: ProjectedPoint;
  end: ProjectedPoint;
  length: number;
  index: number;
}

const TechnicalDrawing2D: React.FC<TechnicalDrawing2DProps> = ({
  shape,
  view,
  width,
  height,
  depth,
  convertToDisplayUnit,
  convertToBaseUnit,
  onUpdateShape,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);
  const [projectedEdges, setProjectedEdges] = useState<ProjectedEdge[]>([]);
  const [editingEdgeIndex, setEditingEdgeIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const projectPoint = (point: THREE.Vector3, view: string): ProjectedPoint => {
    switch (view) {
      case 'front':
      case 'back':
        return { x: point.x, y: -point.y };
      case 'left':
        return { x: -point.z, y: -point.y };
      case 'right':
        return { x: point.z, y: -point.y };
      case 'top':
        return { x: point.x, y: -point.z };
      case 'bottom':
        return { x: point.x, y: point.z };
      default:
        return { x: point.x, y: -point.y };
    }
  };

  const getShapeEdges = (): { start: THREE.Vector3; end: THREE.Vector3 }[] => {
    const edges: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];

    if (shape.type === 'box') {
      const hw = width / 2;
      const hh = height / 2;
      const hd = depth / 2;

      const vertices = [
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd),
      ];

      const edgeIndices = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];

      edgeIndices.forEach(([i, j]) => {
        edges.push({ start: vertices[i], end: vertices[j] });
      });
    } else if (shape.originalPoints && shape.originalPoints.length > 0) {
      const points = shape.originalPoints;

      for (let i = 0; i < points.length - 1; i++) {
        edges.push({
          start: points[i].clone(),
          end: points[i + 1].clone(),
        });
      }

      if (shape.type === 'polygon2d' || shape.type === 'polygon3d') {
        edges.push({
          start: points[points.length - 1].clone(),
          end: points[0].clone(),
        });
      }
    }

    return edges;
  };

  const isEdgeVisible = (start: THREE.Vector3, end: THREE.Vector3, view: string): boolean => {
    const threshold = 0.1;

    switch (view) {
      case 'front':
        return Math.abs(start.z - end.z) < threshold;
      case 'back':
        return Math.abs(start.z - end.z) < threshold;
      case 'left':
        return Math.abs(start.x - end.x) < threshold;
      case 'right':
        return Math.abs(start.x - end.x) < threshold;
      case 'top':
        return Math.abs(start.y - end.y) < threshold;
      case 'bottom':
        return Math.abs(start.y - end.y) < threshold;
      default:
        return true;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const edges = getShapeEdges();
    const projected: ProjectedEdge[] = [];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    edges.forEach((edge, index) => {
      if (!isEdgeVisible(edge.start, edge.end, view)) return;

      const startProj = projectPoint(edge.start, view);
      const endProj = projectPoint(edge.end, view);

      minX = Math.min(minX, startProj.x, endProj.x);
      maxX = Math.max(maxX, startProj.x, endProj.x);
      minY = Math.min(minY, startProj.y, endProj.y);
      maxY = Math.max(maxY, startProj.y, endProj.y);

      const length = edge.start.distanceTo(edge.end);

      projected.push({
        start: startProj,
        end: endProj,
        length,
        index,
      });
    });

    setProjectedEdges(projected);

    if (projected.length === 0) return;

    const padding = 80;
    const shapeWidth = maxX - minX;
    const shapeHeight = maxY - minY;

    const scale = Math.min(
      (rect.width - padding * 2) / shapeWidth,
      (rect.height - padding * 2) / shapeHeight
    ) * 0.7;

    const offsetX = rect.width / 2 - ((minX + maxX) / 2) * scale;
    const offsetY = rect.height / 2 - ((minY + maxY) / 2) * scale;

    const toScreen = (p: ProjectedPoint) => ({
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY,
    });

    projected.forEach((edge) => {
      const start = toScreen(edge.start);
      const end = toScreen(edge.end);

      const isSelected = selectedEdgeIndex === edge.index;
      const isHovered = hoveredEdgeIndex === edge.index;

      ctx.strokeStyle = isSelected ? '#3b82f6' : isHovered ? '#f59e0b' : '#ef4444';
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 2;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);

      const displayValue = convertToDisplayUnit(edge.length).toFixed(1);

      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(-25, -10, 50, 16);

      ctx.fillStyle = isSelected ? '#3b82f6' : isHovered ? '#f59e0b' : '#000000';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayValue, 0, 0);

      ctx.restore();

      ctx.fillStyle = isSelected ? '#3b82f6' : isHovered ? '#f59e0b' : '#ef4444';
      ctx.beginPath();
      ctx.arc(start.x, start.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${view.toUpperCase()} VIEW`, rect.width / 2, 5);

  }, [shape, view, width, height, depth, convertToDisplayUnit, selectedEdgeIndex, hoveredEdgeIndex]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const edges = getShapeEdges();
    const projected: ProjectedEdge[] = [];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    edges.forEach((edge, index) => {
      if (!isEdgeVisible(edge.start, edge.end, view)) return;

      const startProj = projectPoint(edge.start, view);
      const endProj = projectPoint(edge.end, view);

      minX = Math.min(minX, startProj.x, endProj.x);
      maxX = Math.max(maxX, startProj.x, endProj.x);
      minY = Math.min(minY, startProj.y, endProj.y);
      maxY = Math.max(maxY, startProj.y, endProj.y);

      const length = edge.start.distanceTo(edge.end);

      projected.push({
        start: startProj,
        end: endProj,
        length,
        index,
      });
    });

    const padding = 80;
    const shapeWidth = maxX - minX;
    const shapeHeight = maxY - minY;

    const scale = Math.min(
      (rect.width - padding * 2) / shapeWidth,
      (rect.height - padding * 2) / shapeHeight
    ) * 0.7;

    const offsetX = rect.width / 2 - ((minX + maxX) / 2) * scale;
    const offsetY = rect.height / 2 - ((minY + maxY) / 2) * scale;

    const toScreen = (p: ProjectedPoint) => ({
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY,
    });

    let clickedEdge = -1;
    const clickThreshold = 10;

    for (const edge of projected) {
      const start = toScreen(edge.start);
      const end = toScreen(edge.end);

      const dist = distanceToSegment(
        { x, y },
        start,
        end
      );

      if (dist < clickThreshold) {
        clickedEdge = edge.index;
        break;
      }
    }

    if (clickedEdge !== -1) {
      setSelectedEdgeIndex(clickedEdge);
      setEditingEdgeIndex(clickedEdge);
      const edge = projected.find(e => e.index === clickedEdge);
      if (edge) {
        setEditValue(convertToDisplayUnit(edge.length).toFixed(1));
      }
      console.log(`🎯 Edge ${clickedEdge} selected`);
    } else {
      setSelectedEdgeIndex(null);
      setEditingEdgeIndex(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const edges = getShapeEdges();
    const projected: ProjectedEdge[] = [];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    edges.forEach((edge, index) => {
      if (!isEdgeVisible(edge.start, edge.end, view)) return;

      const startProj = projectPoint(edge.start, view);
      const endProj = projectPoint(edge.end, view);

      minX = Math.min(minX, startProj.x, endProj.x);
      maxX = Math.max(maxX, startProj.x, endProj.x);
      minY = Math.min(minY, startProj.y, endProj.y);
      maxY = Math.max(maxY, startProj.y, endProj.y);

      const length = edge.start.distanceTo(edge.end);

      projected.push({
        start: startProj,
        end: endProj,
        length,
        index,
      });
    });

    const padding = 80;
    const shapeWidth = maxX - minX;
    const shapeHeight = maxY - minY;

    const scale = Math.min(
      (rect.width - padding * 2) / shapeWidth,
      (rect.height - padding * 2) / shapeHeight
    ) * 0.7;

    const offsetX = rect.width / 2 - ((minX + maxX) / 2) * scale;
    const offsetY = rect.height / 2 - ((minY + maxY) / 2) * scale;

    const toScreen = (p: ProjectedPoint) => ({
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY,
    });

    let hoveredEdge = -1;
    const hoverThreshold = 10;

    for (const edge of projected) {
      const start = toScreen(edge.start);
      const end = toScreen(edge.end);

      const dist = distanceToSegment(
        { x, y },
        start,
        end
      );

      if (dist < hoverThreshold) {
        hoveredEdge = edge.index;
        break;
      }
    }

    setHoveredEdgeIndex(hoveredEdge !== -1 ? hoveredEdge : null);
    canvas.style.cursor = hoveredEdge !== -1 ? 'pointer' : 'default';
  };

  const distanceToSegment = (
    point: { x: number; y: number },
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): number => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      return Math.sqrt(
        (point.x - start.x) ** 2 + (point.y - start.y) ** 2
      );
    }

    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const projX = start.x + t * dx;
    const projY = start.y + t * dy;

    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
  };

  const handleEditSubmit = () => {
    if (editingEdgeIndex === null || !shape.originalPoints) return;

    const newLength = parseFloat(editValue);
    if (isNaN(newLength) || newLength <= 0) {
      alert('Please enter a valid positive number');
      return;
    }

    const newLengthBase = convertToBaseUnit(newLength);
    const edge = projectedEdges.find(e => e.index === editingEdgeIndex);
    if (!edge) return;

    const points = [...shape.originalPoints];
    const i = editingEdgeIndex;

    if (i >= points.length) return;

    const start = points[i];
    const end = points[(i + 1) % points.length];

    const currentLength = start.distanceTo(end);
    const scale = newLengthBase / currentLength;

    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const newEnd = start.clone().add(direction.multiplyScalar(newLengthBase));

    points[(i + 1) % points.length] = newEnd;

    console.log(`🎯 Updated edge ${i} from ${currentLength.toFixed(1)} to ${newLengthBase.toFixed(1)}`);

    setEditingEdgeIndex(null);
    setSelectedEdgeIndex(null);

    if (onUpdateShape) {
      onUpdateShape();
    }
  };

  return (
    <div className="w-full h-full min-h-[200px] bg-white rounded border border-gray-300 relative flex flex-col">
      <canvas
        ref={canvasRef}
        className="w-full flex-1 cursor-pointer"
        style={{ width: '100%', minHeight: '200px' }}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
      />

      {editingEdgeIndex !== null && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-white border-2 border-blue-500 rounded-lg shadow-lg p-3 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">Edge Length:</span>
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditSubmit();
              if (e.key === 'Escape') {
                setEditingEdgeIndex(null);
                setSelectedEdgeIndex(null);
              }
            }}
            className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handleEditSubmit}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setEditingEdgeIndex(null);
              setSelectedEdgeIndex(null);
            }}
            className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default TechnicalDrawing2D;
