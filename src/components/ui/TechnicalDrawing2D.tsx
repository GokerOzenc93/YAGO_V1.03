import React, { useRef, useEffect } from 'react';
import { Shape } from '../../types/shapes';

interface TechnicalDrawing2DProps {
  shape: Shape;
  view: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
  width: number;
  height: number;
  depth: number;
  convertToDisplayUnit: (value: number) => number;
}

const TechnicalDrawing2D: React.FC<TechnicalDrawing2DProps> = ({
  shape,
  view,
  width,
  height,
  depth,
  convertToDisplayUnit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    let drawWidth = 0;
    let drawHeight = 0;
    let dimensionLabel1 = '';
    let dimensionLabel2 = '';
    let value1 = 0;
    let value2 = 0;

    switch (view) {
      case 'front':
        drawWidth = width;
        drawHeight = height;
        dimensionLabel1 = 'W';
        dimensionLabel2 = 'H';
        value1 = width;
        value2 = height;
        break;
      case 'back':
        drawWidth = width;
        drawHeight = height;
        dimensionLabel1 = 'W';
        dimensionLabel2 = 'H';
        value1 = width;
        value2 = height;
        break;
      case 'left':
        drawWidth = depth;
        drawHeight = height;
        dimensionLabel1 = 'D';
        dimensionLabel2 = 'H';
        value1 = depth;
        value2 = height;
        break;
      case 'right':
        drawWidth = depth;
        drawHeight = height;
        dimensionLabel1 = 'D';
        dimensionLabel2 = 'H';
        value1 = depth;
        value2 = height;
        break;
      case 'top':
        drawWidth = width;
        drawHeight = depth;
        dimensionLabel1 = 'W';
        dimensionLabel2 = 'D';
        value1 = width;
        value2 = depth;
        break;
      case 'bottom':
        drawWidth = width;
        drawHeight = depth;
        dimensionLabel1 = 'W';
        dimensionLabel2 = 'D';
        value1 = width;
        value2 = depth;
        break;
    }

    const padding = 60;
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;

    const scale = Math.min(
      availableWidth / drawWidth,
      availableHeight / drawHeight
    ) * 0.8;

    const rectWidth = drawWidth * scale;
    const rectHeight = drawHeight * scale;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const x = centerX - rectWidth / 2;
    const y = centerY - rectHeight / 2;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, rectWidth, rectHeight);

    ctx.fillStyle = '#000000';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const arrowSize = 6;
    const dimOffset = 25;

    const drawDimensionLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      label: string,
      value: number,
      isHorizontal: boolean
    ) => {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      if (isHorizontal) {
        ctx.beginPath();
        ctx.moveTo(x1, y1 - dimOffset);
        ctx.lineTo(x2, y2 - dimOffset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1 - dimOffset - arrowSize);
        ctx.lineTo(x1, y1 - dimOffset + arrowSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2, y2 - dimOffset - arrowSize);
        ctx.lineTo(x2, y2 - dimOffset + arrowSize);
        ctx.stroke();

        const midX = (x1 + x2) / 2;
        const displayValue = convertToDisplayUnit(value).toFixed(1);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${displayValue}`, midX, y1 - dimOffset - 8);
      } else {
        ctx.beginPath();
        ctx.moveTo(x1 - dimOffset, y1);
        ctx.lineTo(x2 - dimOffset, y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1 - dimOffset - arrowSize, y1);
        ctx.lineTo(x1 - dimOffset + arrowSize, y1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2 - dimOffset - arrowSize, y2);
        ctx.lineTo(x2 - dimOffset + arrowSize, y2);
        ctx.stroke();

        const midY = (y1 + y2) / 2;
        const displayValue = convertToDisplayUnit(value).toFixed(1);
        ctx.save();
        ctx.translate(x1 - dimOffset - 15, midY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${displayValue}`, 0, 0);
        ctx.restore();
      }

      ctx.setLineDash([]);
    };

    drawDimensionLine(x, y, x + rectWidth, y, dimensionLabel1, value1, true);
    drawDimensionLine(x, y, x, y + rectHeight, dimensionLabel2, value2, false);

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${view.toUpperCase()} VIEW`, centerX, 5);

  }, [shape, view, width, height, depth, convertToDisplayUnit]);

  return (
    <div className="w-full h-full min-h-[200px] bg-white rounded border border-gray-300 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default TechnicalDrawing2D;
