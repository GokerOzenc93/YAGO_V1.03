import React, { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import * as THREE from 'three';
import { useAppStore, OrthoMode } from '../store';

interface FaceDrawingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  faceIndex: number;
  faceNormal: THREE.Vector3;
  shape: any;
}

export const FaceDrawingPanel: React.FC<FaceDrawingPanelProps> = ({
  isOpen,
  onClose,
  faceIndex,
  faceNormal,
  shape,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { polylinePoints, addPolylinePoint, orthoMode } = useAppStore();
  const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number; type: string } | null>(null);
  const [waitingForLength, setWaitingForLength] = useState(false);
  const [directionVector, setDirectionVector] = useState<{ x: number; y: number } | null>(null);

  const getFaceDimensions = () => {
    const w = shape.parameters.width;
    const h = shape.parameters.height;
    const d = shape.parameters.depth;

    if (Math.abs(faceNormal.z) > 0.9) {
      return { width: w, height: h, label: faceNormal.z > 0 ? 'Front Face (Z+)' : 'Back Face (Z-)' };
    } else if (Math.abs(faceNormal.y) > 0.9) {
      return { width: w, height: d, label: faceNormal.y > 0 ? 'Top Face (Y+)' : 'Bottom Face (Y-)' };
    } else if (Math.abs(faceNormal.x) > 0.9) {
      return { width: d, height: h, label: faceNormal.x > 0 ? 'Right Face (X+)' : 'Left Face (X-)' };
    }
    return { width: w, height: h, label: 'Face' };
  };

  const { width: faceWidth, height: faceHeight, label: faceLabel } = getFaceDimensions();

  const canvasWidth = 800;
  const canvasHeight = 600;
  const padding = 50;
  const scale = Math.min(
    (canvasWidth - 2 * padding) / faceWidth,
    (canvasHeight - 2 * padding) / faceHeight
  );

  const worldToCanvas = (x: number, y: number) => {
    return {
      x: padding + x * scale,
      y: canvasHeight - padding - y * scale,
    };
  };

  const canvasToWorld = (canvasX: number, canvasY: number) => {
    return {
      x: (canvasX - padding) / scale,
      y: (canvasHeight - padding - canvasY) / scale,
    };
  };

  const convert3DTo2D = (point3D: [number, number, number]) => {
    const w = shape.parameters.width;
    const h = shape.parameters.height;
    const d = shape.parameters.depth;

    if (Math.abs(faceNormal.z) > 0.9) {
      return { x: point3D[0], y: point3D[1] };
    } else if (Math.abs(faceNormal.y) > 0.9) {
      return { x: point3D[0], y: point3D[2] };
    } else if (Math.abs(faceNormal.x) > 0.9) {
      return { x: point3D[2], y: point3D[1] };
    }
    return { x: point3D[0], y: point3D[1] };
  };

  const convert2DTo3D = (x: number, y: number): [number, number, number] => {
    const w = shape.parameters.width;
    const h = shape.parameters.height;
    const d = shape.parameters.depth;

    if (Math.abs(faceNormal.z) > 0.9) {
      const zPos = faceNormal.z > 0 ? d : 0;
      return [x, y, zPos];
    } else if (Math.abs(faceNormal.y) > 0.9) {
      const yPos = faceNormal.y > 0 ? h : 0;
      return [x, yPos, y];
    } else if (Math.abs(faceNormal.x) > 0.9) {
      const xPos = faceNormal.x > 0 ? w : 0;
      return [xPos, y, x];
    }
    return [x, y, 0];
  };

  const findSnapPoint = (point: { x: number; y: number }, snapRadius: number = 20): { x: number; y: number; type?: string } | null => {
    const { snapSettings } = useAppStore.getState();
    const points2D = polylinePoints.map(convert3DTo2D);

    if (snapSettings.endpoint) {
      for (let i = 0; i < points2D.length; i++) {
        const canvasPoint = worldToCanvas(points2D[i].x, points2D[i].y);
        const dist = Math.sqrt(
          Math.pow(point.x - canvasPoint.x, 2) + Math.pow(point.y - canvasPoint.y, 2)
        );
        if (dist < snapRadius) {
          return { ...canvasPoint, type: 'endpoint' };
        }
      }
    }

    if (snapSettings.midpoint && points2D.length > 1) {
      for (let i = 1; i < points2D.length; i++) {
        const p1 = points2D[i - 1];
        const p2 = points2D[i];
        const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const canvasMid = worldToCanvas(midpoint.x, midpoint.y);
        const dist = Math.sqrt(
          Math.pow(point.x - canvasMid.x, 2) + Math.pow(point.y - canvasMid.y, 2)
        );
        if (dist < snapRadius) {
          return { ...canvasMid, type: 'midpoint' };
        }
      }
    }

    return null;
  };

  const snapToOrtho = (point: { x: number; y: number }, lastPoint: { x: number; y: number }) => {
    if (orthoMode === OrthoMode.OFF) {
      return point;
    }

    const dx = Math.abs(point.x - lastPoint.x);
    const dy = Math.abs(point.y - lastPoint.y);

    if (dx > dy) {
      return { x: point.x, y: lastPoint.y };
    } else {
      return { x: lastPoint.x, y: point.y };
    }
  };

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setCanvasOffset({ x: rect.left, y: rect.top });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && polylinePoints.length > 0 && directionVector && !waitingForLength) {
        e.preventDefault();
        setWaitingForLength(true);
        console.log('⌨️ Waiting for length input in terminal...');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, polylinePoints, directionVector, waitingForLength]);

  useEffect(() => {
    if (!waitingForLength) {
      delete (window as any).pendingPolylineLength;
      delete (window as any).handlePolylineLength;
      return;
    }

    (window as any).pendingPolylineLength = true;
    (window as any).handlePolylineLength = (lengthValue: number) => {
      if (polylinePoints.length > 0 && directionVector) {
        const lastPoint3D = polylinePoints[polylinePoints.length - 1];
        const lastPoint2D = convert3DTo2D(lastPoint3D);

        const dir = directionVector;
        const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        const normalized = { x: dir.x / mag, y: dir.y / mag };

        const newPoint2D = {
          x: lastPoint2D.x + normalized.x * lengthValue,
          y: lastPoint2D.y + normalized.y * lengthValue
        };

        const point3D = convert2DTo3D(newPoint2D.x, newPoint2D.y);
        addPolylinePoint(point3D);
        console.log(`✅ Polyline point added via terminal: ${lengthValue}mm`, point3D);

        setWaitingForLength(false);
        setDirectionVector(null);
      }
    };

    return () => {
      delete (window as any).pendingPolylineLength;
      delete (window as any).handlePolylineLength;
    };
  }, [waitingForLength, directionVector, polylinePoints, addPolylinePoint]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 1;
    for (let x = padding; x <= canvasWidth - padding; x += 50 * scale) {
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, canvasHeight - padding);
      ctx.stroke();
    }
    for (let y = padding; y <= canvasHeight - padding; y += 50 * scale) {
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, faceWidth * scale, faceHeight * scale);

    const points2D = polylinePoints.map(convert3DTo2D);

    if (points2D.length > 0) {
      ctx.fillStyle = '#ff0000';
      points2D.forEach((point) => {
        const canvas2D = worldToCanvas(point.x, point.y);
        ctx.beginPath();
        ctx.arc(canvas2D.x, canvas2D.y, 6, 0, 2 * Math.PI);
        ctx.fill();
      });

      if (points2D.length > 1) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const firstPoint = worldToCanvas(points2D[0].x, points2D[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < points2D.length; i++) {
          const point = worldToCanvas(points2D[i].x, points2D[i].y);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }

      if (previewPoint && points2D.length > 0) {
        ctx.fillStyle = '#ffff00';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(previewPoint.x, previewPoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        const lastPoint = worldToCanvas(points2D[points2D.length - 1].x, points2D[points2D.length - 1].y);
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(previewPoint.x, previewPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (snapIndicator) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(snapIndicator.x, snapIndicator.y, 12, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#ff6600';
      ctx.font = 'bold 12px Inter, sans-serif';
      const label = snapIndicator.type === 'endpoint' ? 'EP' : 'MP';
      ctx.fillText(label, snapIndicator.x + 18, snapIndicator.y - 8);
    }

    ctx.fillStyle = '#1a1a1a';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(`Width: ${faceWidth.toFixed(0)}mm`, padding, padding - 30);
    ctx.fillText(`Height: ${faceHeight.toFixed(0)}mm`, padding, padding - 10);

    ctx.save();
    ctx.translate(padding - 30, canvasHeight - padding);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${faceHeight.toFixed(0)}mm`, 0, 0);
    ctx.restore();

    ctx.fillText(`${faceWidth.toFixed(0)}mm`, padding + (faceWidth * scale) / 2 - 30, canvasHeight - padding + 30);
  }, [polylinePoints, previewPoint, snapIndicator, isOpen, faceWidth, faceHeight, orthoMode, scale]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || waitingForLength) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const snapPoint = findSnapPoint({ x: canvasX, y: canvasY });
    if (snapPoint) {
      setPreviewPoint({ x: snapPoint.x, y: snapPoint.y });
      setSnapIndicator({ x: snapPoint.x, y: snapPoint.y, type: snapPoint.type || 'unknown' });
      return;
    } else {
      setSnapIndicator(null);
    }

    const worldPoint = canvasToWorld(canvasX, canvasY);

    if (worldPoint.x < 0 || worldPoint.x > faceWidth || worldPoint.y < 0 || worldPoint.y > faceHeight) {
      setPreviewPoint(null);
      return;
    }

    let finalPoint = worldPoint;

    if (polylinePoints.length > 0 && orthoMode === OrthoMode.ON) {
      const lastPoint3D = polylinePoints[polylinePoints.length - 1];
      const lastPoint2D = convert3DTo2D(lastPoint3D);
      finalPoint = snapToOrtho(worldPoint, lastPoint2D);

      const dx = finalPoint.x - lastPoint2D.x;
      const dy = finalPoint.y - lastPoint2D.y;
      setDirectionVector({ x: dx, y: dy });
    } else if (polylinePoints.length > 0) {
      const lastPoint3D = polylinePoints[polylinePoints.length - 1];
      const lastPoint2D = convert3DTo2D(lastPoint3D);
      const dx = finalPoint.x - lastPoint2D.x;
      const dy = finalPoint.y - lastPoint2D.y;
      setDirectionVector({ x: dx, y: dy });
    }

    const canvas2D = worldToCanvas(finalPoint.x, finalPoint.y);
    setPreviewPoint(canvas2D);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !previewPoint) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const worldPoint = canvasToWorld(canvasX, canvasY);

    if (worldPoint.x < 0 || worldPoint.x > faceWidth || worldPoint.y < 0 || worldPoint.y > faceHeight) {
      return;
    }

    let finalPoint = worldPoint;

    if (polylinePoints.length > 0 && orthoMode === OrthoMode.ON) {
      const lastPoint3D = polylinePoints[polylinePoints.length - 1];
      const lastPoint2D = convert3DTo2D(lastPoint3D);
      finalPoint = snapToOrtho(worldPoint, lastPoint2D);
    }

    const point3D = convert2DTo3D(finalPoint.x, finalPoint.y);
    addPolylinePoint(point3D);
    console.log(`✅ Polyline point added (2D panel):`, {
      canvas: { x: canvasX, y: canvasY },
      world2D: finalPoint,
      world3D: point3D,
      faceNormal: faceNormal.toArray(),
      faceDims: { width: faceWidth, height: faceHeight }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-[900px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{faceLabel}</h2>
            <p className="text-sm text-stone-600 mt-1">
              {waitingForLength ? (
                <span className="text-orange-600 font-semibold">Enter length in terminal...</span>
              ) : (
                <>
                  Click to add points. Space to enter length. ESC to exit.
                  {orthoMode === OrthoMode.ON && (
                    <span className="ml-2 text-orange-600 font-semibold">Linear Mode: ON</span>
                  )}
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            title="Close (ESC)"
          >
            <X size={20} className="text-stone-600" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-stone-50">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseMove={handleCanvasMouseMove}
            onClick={handleCanvasClick}
            className="bg-white border-2 border-stone-300 rounded-lg shadow-md cursor-crosshair mx-auto block"
          />
        </div>

        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-stone-600">
              Points: <span className="font-semibold text-slate-800">{polylinePoints.length}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-lg text-slate-800 font-medium transition-colors"
              >
                Close (ESC)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
