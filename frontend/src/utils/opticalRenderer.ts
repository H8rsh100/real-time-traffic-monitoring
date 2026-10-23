/**
 * Optical Canvas Rendering Helpers for Long Exposure Surveillance Viewport.
 */

export function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  size: number = 16,
  margin: number = 12,
  color: string = 'rgba(236, 232, 246, 0.4)'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(margin, margin + size);
  ctx.lineTo(margin, margin);
  ctx.lineTo(margin + size, margin);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(width - margin - size, margin);
  ctx.lineTo(width - margin, margin);
  ctx.lineTo(width - margin, margin + size);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(margin, height - margin - size);
  ctx.lineTo(margin, height - margin);
  ctx.lineTo(margin + size, height - margin);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(width - margin - size, height - margin);
  ctx.lineTo(width - margin, height - margin);
  ctx.lineTo(width - margin, height - margin - size);
  ctx.stroke();

  ctx.restore();
}

export function drawAnamorphicStreak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  flareWidth: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;

  const grad = ctx.createLinearGradient(
    x - flareWidth / 2,
    y,
    x + flareWidth / 2,
    y
  );
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.3, color);
  grad.addColorStop(0.5, '#FFFFFF');
  grad.addColorStop(0.7, color);
  grad.addColorStop(1, 'transparent');

  ctx.strokeStyle = grad;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - flareWidth / 2, y);
  ctx.lineTo(x + flareWidth / 2, y);
  ctx.stroke();

  ctx.restore();
}
