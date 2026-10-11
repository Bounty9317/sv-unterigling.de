import { isWinterModeEnabled } from '../lib/public-data';

const LIGHT_COLORS = ['#ff3b30', '#34c759', '#0a84ff', '#ffd60a', '#ff2d92', '#64d2ff', '#ff9f0a'];

function buildLights(container: HTMLElement) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 100 34');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  const wave = (x: number) => 8 + Math.sin(x * 0.25) * 5;
  let d = `M 0 ${wave(0)}`;
  for (let x = 1; x <= 100; x++) d += ` L ${x} ${wave(x).toFixed(2)}`;
  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#1b1b1b');
  path.setAttribute('stroke-width', '0.6');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(path);
  container.append(svg);

  const count = Math.max(10, Math.round(window.innerWidth / 70));
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5) * (100 / count);
    const light = document.createElement('span');
    light.className = 'xmas-light';
    light.style.left = `${x}%`;
    light.style.top = `${(wave(x) / 34) * 100 + 8}%`;
    light.style.background = LIGHT_COLORS[i % LIGHT_COLORS.length]!;
    light.style.color = LIGHT_COLORS[i % LIGHT_COLORS.length]!;
    light.style.animationDelay = `${(i % 5) * 0.3}s`;
    container.append(light);
  }
}

function startSnow(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let width = 0;
  let height = 0;
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const flakes = Array.from({ length: Math.min(90, Math.round(window.innerWidth / 14)) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 1 + Math.random() * 2.6,
    speed: 0.4 + Math.random() * 1.1,
    drift: Math.random() * Math.PI * 2,
    opacity: 0.45 + Math.random() * 0.55,
  }));

  let running = false;
  const draw = () => {
    if (document.hidden) {
      running = false;
      return;
    }
    running = true;
    ctx.clearRect(0, 0, width, height);
    for (const f of flakes) {
      f.y += f.speed;
      f.drift += 0.01;
      f.x += Math.sin(f.drift) * 0.4;
      if (f.y > height + 5) {
        f.y = -5;
        f.x = Math.random() * width;
      }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${f.opacity})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !running) requestAnimationFrame(draw);
  });
  requestAnimationFrame(draw);
}

export async function initWinterMode() {
  if (!(await isWinterModeEnabled())) return;

  document.documentElement.classList.add('winter-mode');
  document.querySelector<HTMLElement>('[data-xmas-banner]')?.removeAttribute('hidden');

  const lights = document.querySelector<HTMLElement>('[data-xmas-lights]');
  if (lights) {
    buildLights(lights);
    lights.hidden = false;
  }

  const layer = document.querySelector<HTMLElement>('[data-winter]');
  if (!layer) return;
  layer.hidden = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = layer.querySelector<HTMLCanvasElement>('[data-snow]');
  if (canvas && !reducedMotion) startSnow(canvas);
}
