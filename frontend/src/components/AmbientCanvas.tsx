import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
}

export const AmbientCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isVisible = true;

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Bokeh lights
    const colors = ['#FFF1CC', '#FF3B30', '#4FD1FF', '#7F5AF0'];
    const particles: Particle[] = Array.from({ length: 18 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 40 + Math.random() * 80,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: 0.02 + Math.random() * 0.04,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    // Rain streaks
    const rain: RainDrop[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: 12 + Math.random() * 20,
      speed: 4 + Math.random() * 6,
      alpha: 0.03 + Math.random() * 0.06,
    }));

    const render = () => {
      if (isVisible) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw slow ambient bokeh
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -p.radius) p.x = canvas.width + p.radius;
          if (p.x > canvas.width + p.radius) p.x = -p.radius;
          if (p.y < -p.radius) p.y = canvas.height + p.radius;
          if (p.y > canvas.height + p.radius) p.y = -p.radius;

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'transparent');

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 2. Draw faint drifting rain
        ctx.save();
        ctx.strokeStyle = 'rgba(236, 232, 246, 0.06)';
        ctx.lineWidth = 1;
        for (const r of rain) {
          r.y += r.speed;
          r.x += r.speed * 0.12;
          if (r.y > canvas.height) {
            r.y = -r.length;
            r.x = Math.random() * canvas.width;
          }
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x + r.length * 0.12, r.y + r.length);
          ctx.stroke();
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: 0.85 }}
      />
      {/* Soft dark vignette over the viewport background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 60%, rgba(5,6,10,0.75) 100%)',
        }}
      />
    </>
  );
};
