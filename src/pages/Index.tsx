import { useEffect, useRef, useState, useCallback } from 'react';

// ───────────── Types ─────────────
interface Vec2 { x: number; y: number }
interface Rect { x: number; y: number; w: number; h: number }

interface Player {
  pos: Vec2;
  vel: Vec2;
  onGround: boolean;
  facingRight: boolean;
  powered: boolean;
  starred: boolean;
  poweredTimer: number;
  starTimer: number;
  animFrame: number;
  animTick: number;
  dead: boolean;
  invincible: number;
}

interface Coin {
  x: number; y: number; collected: boolean; animY: number; phase: number;
}

interface Platform {
  x: number; y: number; w: number; h: number;
  hasCoin?: boolean; hasItem?: 'mushroom' | 'star'; hit?: boolean; hitAnim?: number;
}

interface Enemy {
  x: number; y: number; vel: number; alive: boolean; type: 'goomba' | 'koopa';
  animTick: number; animFrame: number; stomped?: boolean; stompTimer?: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
  color: string; size: number;
}

interface Item {
  x: number; y: number; vy: number; type: 'mushroom' | 'star'; collected: boolean;
  phase: number;
}

// ───────────── Constants ─────────────
const GRAVITY = 0.55;
const JUMP_FORCE = -13.5;
const MOVE_SPEED = 5;
const FRICTION = 0.82;
const GROUND_Y = 420;
const TILE = 48;

const LEVEL_PLATFORMS: Platform[] = [
  { x: 0, y: GROUND_Y, w: 4000, h: 80, },
  { x: 200, y: 320, w: 120, h: 24, hasCoin: true },
  { x: 400, y: 260, w: 96, h: 24, hasItem: 'mushroom' },
  { x: 560, y: 200, w: 96, h: 24, hasCoin: true },
  { x: 720, y: 280, w: 120, h: 24, hasCoin: true },
  { x: 900, y: 220, w: 96, h: 24, hasItem: 'star' },
  { x: 1100, y: 300, w: 144, h: 24, hasCoin: true },
  { x: 1300, y: 240, w: 96, h: 24, hasCoin: true },
  { x: 1500, y: 180, w: 120, h: 24 },
  { x: 1700, y: 260, w: 96, h: 24, hasCoin: true },
  { x: 1900, y: 320, w: 144, h: 24, hasItem: 'mushroom' },
  { x: 2100, y: 200, w: 96, h: 24, hasCoin: true },
  { x: 2300, y: 280, w: 120, h: 24 },
  { x: 2500, y: 220, w: 96, h: 24, hasCoin: true },
  { x: 2700, y: 300, w: 144, h: 24, hasItem: 'star' },
  { x: 2900, y: 240, w: 120, h: 24, hasCoin: true },
  { x: 3100, y: 180, w: 96, h: 24 },
  { x: 3300, y: 260, w: 120, h: 24, hasCoin: true },
  { x: 3500, y: 320, w: 96, h: 24 },
  { x: 3700, y: 200, w: 144, h: 24, hasCoin: true },
];

const INITIAL_ENEMIES: Enemy[] = [
  { x: 600, y: GROUND_Y - 40, vel: -1.5, alive: true, type: 'goomba', animTick: 0, animFrame: 0 },
  { x: 850, y: GROUND_Y - 40, vel: -1.2, alive: true, type: 'koopa', animTick: 0, animFrame: 0 },
  { x: 1200, y: GROUND_Y - 40, vel: -1.8, alive: true, type: 'goomba', animTick: 0, animFrame: 0 },
  { x: 1600, y: GROUND_Y - 40, vel: -1.4, alive: true, type: 'goomba', animTick: 0, animFrame: 0 },
  { x: 2000, y: GROUND_Y - 40, vel: -1.6, alive: true, type: 'koopa', animTick: 0, animFrame: 0 },
  { x: 2400, y: GROUND_Y - 40, vel: -1.5, alive: true, type: 'goomba', animTick: 0, animFrame: 0 },
  { x: 2800, y: GROUND_Y - 40, vel: -1.3, alive: true, type: 'goomba', animTick: 0, animFrame: 0 },
  { x: 3200, y: GROUND_Y - 40, vel: -1.7, alive: true, type: 'koopa', animTick: 0, animFrame: 0 },
];

function initCoins(): Coin[] {
  const coins: Coin[] = [];
  [300, 450, 650, 800, 1000, 1150, 1350, 1550, 1750, 1950, 2150, 2350, 2550, 2750, 2950, 3150, 3350, 3600, 3750].forEach(x => {
    coins.push({ x, y: GROUND_Y - 50, collected: false, animY: 0, phase: Math.random() * Math.PI * 2 });
  });
  return coins;
}

// ───────────── Drawing helpers ─────────────
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, camX: number, tick: number) {
  const sx = p.pos.x - camX;
  const sy = p.pos.y;
  const pw = p.powered ? 44 : 34;
  const ph = p.powered ? 52 : 40;

  ctx.save();
  if (!p.facingRight) {
    ctx.translate(sx + pw / 2, sy + ph / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(sx + pw / 2), -(sy + ph / 2));
  }

  if (p.starred && Math.floor(tick / 3) % 2 === 0) {
    ctx.globalAlpha = 0.7;
  }

  const squish = p.onGround && Math.abs(p.vel.x) > 0.5 ? Math.sin(tick * 0.3) * 2 : 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx + pw / 2, GROUND_Y + 4, pw / 2 + 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shoes
  ctx.fillStyle = '#3a1f00';
  drawRoundRect(ctx, sx + 2, sy + ph - 10, pw / 2 - 1, 10, 3);
  drawRoundRect(ctx, sx + pw / 2, sy + ph - 10, pw / 2 - 1, 10, 3);
  ctx.fill();

  // Overalls
  const overallColor = p.starred ? '#FFD700' : (p.powered ? '#003399' : '#0055AA');
  ctx.fillStyle = overallColor;
  drawRoundRect(ctx, sx + 4, sy + ph * 0.4, pw - 8, ph * 0.65, 4);
  ctx.fill();

  // Shirt
  const shirtColor = p.powered ? '#CC2200' : '#DD3300';
  ctx.fillStyle = shirtColor;
  drawRoundRect(ctx, sx + 3, sy + ph * 0.2, pw - 6, ph * 0.45, 5);
  ctx.fill();

  // Suspenders
  ctx.fillStyle = overallColor;
  ctx.fillRect(sx + pw * 0.3 - 3, sy + ph * 0.2, 6, ph * 0.4);
  ctx.fillRect(sx + pw * 0.7 - 3, sy + ph * 0.2, 6, ph * 0.4);

  // Head
  ctx.fillStyle = '#FFB87A';
  drawRoundRect(ctx, sx + 4 + squish / 2, sy, pw - 8 - squish, ph * 0.4, 8);
  ctx.fill();

  // Hat
  const hatColor = p.starred ? '#FFD700' : '#CC2200';
  ctx.fillStyle = hatColor;
  ctx.beginPath();
  ctx.ellipse(sx + pw / 2, sy + ph * 0.1, pw / 2, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  drawRoundRect(ctx, sx + 4, sy - 10, pw - 8, 16, 5);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(sx + pw * 0.6, sy + ph * 0.2, 5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(sx + pw * 0.62, sy + ph * 0.22, 3, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mustache
  ctx.fillStyle = '#3a1f00';
  ctx.beginPath();
  ctx.ellipse(sx + pw * 0.55, sy + ph * 0.3, 7, 3.5, -0.2, 0, Math.PI);
  ctx.fill();

  // Power star glow
  if (p.starred) {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#FFD700';
    drawRoundRect(ctx, sx, sy, pw, ph, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawPlatform(ctx: CanvasRenderingContext2D, plat: Platform, camX: number, tick: number) {
  const sx = plat.x - camX;
  const sy = plat.y;
  const hitOffset = plat.hit && plat.hitAnim ? -Math.sin((plat.hitAnim / 8) * Math.PI) * 8 : 0;

  if (plat.h > 50) {
    // Ground — tiled grass
    const tileCount = Math.ceil(plat.w / TILE);
    for (let i = 0; i < tileCount; i++) {
      const tx = sx + i * TILE;
      if (tx + TILE < 0 || tx > 900) continue;
      // Dirt block
      const grad = ctx.createLinearGradient(tx, sy, tx, sy + plat.h);
      grad.addColorStop(0, '#5D3A1A');
      grad.addColorStop(1, '#3D2010');
      ctx.fillStyle = grad;
      drawRoundRect(ctx, tx, sy, TILE - 1, plat.h, 0);
      ctx.fill();
      // Grass top
      const gGrad = ctx.createLinearGradient(tx, sy - 4, tx, sy + 14);
      gGrad.addColorStop(0, '#5DBB3F');
      gGrad.addColorStop(1, '#3A8F22');
      ctx.fillStyle = gGrad;
      drawRoundRect(ctx, tx, sy - 2, TILE - 1, 16, 3);
      ctx.fill();
      // Grid lines
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, sy, TILE - 1, plat.h);
    }
  } else {
    // Floating platform
    const isQuestion = plat.hasCoin || plat.hasItem;
    if (isQuestion && !plat.hit) {
      // ? Block — golden animated
      const pulse = Math.sin(tick * 0.08) * 0.1 + 0.9;
      const blockGrad = ctx.createLinearGradient(sx, sy + hitOffset, sx, sy + plat.h + hitOffset);
      blockGrad.addColorStop(0, '#FFD54F');
      blockGrad.addColorStop(0.5, '#FFB300');
      blockGrad.addColorStop(1, '#E65100');
      ctx.fillStyle = blockGrad;
      drawRoundRect(ctx, sx, sy + hitOffset, plat.w, plat.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#FF8F00';
      ctx.lineWidth = 2;
      drawRoundRect(ctx, sx, sy + hitOffset, plat.w, plat.h, 6);
      ctx.stroke();

      // ? symbol
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(plat.h * 0.9 * pulse)}px 'Nunito', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', sx + plat.w / 2, sy + plat.h / 2 + hitOffset);
    } else {
      // Normal brick platform
      const grad = ctx.createLinearGradient(sx, sy + hitOffset, sx, sy + plat.h + hitOffset);
      grad.addColorStop(0, '#8D6E63');
      grad.addColorStop(1, '#5D4037');
      ctx.fillStyle = grad;
      drawRoundRect(ctx, sx, sy + hitOffset, plat.w, plat.h, 5);
      ctx.fill();

      // Brick pattern
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1.5;
      const rows = 2;
      const colW = 32;
      for (let row = 0; row < rows; row++) {
        const rowY = sy + hitOffset + (row * plat.h) / rows;
        const offset = row % 2 === 0 ? 0 : colW / 2;
        for (let col = -1; col <= Math.ceil(plat.w / colW) + 1; col++) {
          const bx = sx + col * colW + offset;
          ctx.strokeRect(bx, rowY, colW, plat.h / rows);
        }
      }
    }

    // 3D depth illusion — bottom face
    ctx.fillStyle = plat.hit ? '#5D4037' : (isQuestion && !plat.hit ? '#BF360C' : '#4E342E');
    drawRoundRect(ctx, sx + 3, sy + plat.h + hitOffset, plat.w - 3, 8, 0);
    ctx.fill();
    // Right face
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(sx + plat.w, sy + hitOffset);
    ctx.lineTo(sx + plat.w + 3, sy + 4 + hitOffset);
    ctx.lineTo(sx + plat.w + 3, sy + plat.h + 8 + hitOffset);
    ctx.lineTo(sx + plat.w, sy + plat.h + hitOffset);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin, camX: number, tick: number) {
  if (coin.collected) return;
  const sx = coin.x - camX;
  const sy = coin.y + Math.sin(tick * 0.05 + coin.phase) * 6;
  const scaleX = Math.abs(Math.cos(tick * 0.08 + coin.phase));

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(scaleX, 1);

  const grad = ctx.createRadialGradient(0, -4, 2, 0, 0, 14);
  grad.addColorStop(0, '#FFF176');
  grad.addColorStop(0.5, '#FFD600');
  grad.addColorStop(1, '#FF8F00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-3, -4, 4, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Glow
  ctx.save();
  ctx.globalAlpha = 0.25 + Math.sin(tick * 0.1 + coin.phase) * 0.1;
  ctx.fillStyle = '#FFD600';
  ctx.beginPath();
  ctx.arc(sx, sy, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, camX: number, tick: number) {
  if (!e.alive) return;
  const sx = e.x - camX;
  const sy = e.y;

  ctx.save();
  if (e.type === 'goomba') {
    // Body
    const squat = e.stomped ? 0.4 : 1;
    const grad = ctx.createRadialGradient(sx, sy + 20, 4, sx, sy + 20, 22);
    grad.addColorStop(0, '#C0632A');
    grad.addColorStop(1, '#7A3800');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 20 * squat, 20, 22 * squat, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!e.stomped) {
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(sx - 7, sy + 14, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + 7, sy + 14, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(sx - 6, sy + 15, 3, 3.5, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + 8, sy + 15, 3, 3.5, -0.3, 0, Math.PI * 2); ctx.fill();
      // Angry brows
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(sx - 12, sy + 9); ctx.lineTo(sx - 2, sy + 11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 12, sy + 9); ctx.lineTo(sx + 2, sy + 11); ctx.stroke();
      // Feet
      const legOff = Math.sin(tick * 0.2) * 6;
      ctx.fillStyle = '#3a1f00';
      ctx.beginPath(); ctx.ellipse(sx - 10 + legOff, sy + 38, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + 10 - legOff, sy + 38, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // Koopa
    if (!e.stomped) {
      // Shell
      const shellGrad = ctx.createRadialGradient(sx, sy + 18, 3, sx, sy + 18, 22);
      shellGrad.addColorStop(0, '#8BC34A');
      shellGrad.addColorStop(1, '#33691E');
      ctx.fillStyle = shellGrad;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 22, 22, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // Shell pattern
      ctx.strokeStyle = '#1B5E20';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(sx, sy + 22, 14, 16, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 14, sy + 22); ctx.lineTo(sx + 14, sy + 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy + 6); ctx.lineTo(sx, sy + 38); ctx.stroke();
      // Head
      ctx.fillStyle = '#8BC34A';
      ctx.beginPath();
      ctx.ellipse(sx + (e.vel < 0 ? -14 : 14), sy + 8, 12, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#fff';
      const ex = sx + (e.vel < 0 ? -18 : 18);
      ctx.beginPath(); ctx.ellipse(ex, sy + 6, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(ex + (e.vel < 0 ? -1 : 1), sy + 6, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // Stomped shell
      const shellGrad = ctx.createRadialGradient(sx, sy + 32, 2, sx, sy + 32, 22);
      shellGrad.addColorStop(0, '#8BC34A');
      shellGrad.addColorStop(1, '#33691E');
      ctx.fillStyle = shellGrad;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 35, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, camX: number, tick: number) {
  if (item.collected) return;
  const sx = item.x - camX;
  const sy = item.y + Math.sin(tick * 0.06 + item.phase) * 4;

  ctx.save();
  if (item.type === 'mushroom') {
    // Cap
    ctx.fillStyle = '#FF1744';
    ctx.beginPath();
    ctx.arc(sx, sy + 8, 18, Math.PI, 0);
    ctx.fill();
    // Dots
    ctx.fillStyle = '#fff';
    [[sx - 7, sy + 2], [sx + 6, sy + 1], [sx, sy + 10], [sx - 12, sy + 10], [sx + 11, sy + 10]].forEach(([dx, dy]) => {
      ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, Math.PI * 2); ctx.fill();
    });
    // Stem
    const stemGrad = ctx.createLinearGradient(sx - 10, sy + 8, sx + 10, sy + 8);
    stemGrad.addColorStop(0, '#FFCC80');
    stemGrad.addColorStop(1, '#FFB300');
    ctx.fillStyle = stemGrad;
    drawRoundRect(ctx, sx - 10, sy + 8, 20, 18, 4);
    ctx.fill();
    // Face
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(sx - 4, sy + 14, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + 4, sy + 14, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(sx - 3, sy + 14, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + 5, sy + 14, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // Star
    const starPoints = 5;
    const outerR = 18;
    const innerR = 8;
    const hue = (tick * 4) % 360;
    ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
    ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    for (let i = 0; i < starPoints * 2; i++) {
      const angle = (i * Math.PI) / starPoints - Math.PI / 2 + Math.sin(tick * 0.05) * 0.3;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = sx + Math.cos(angle) * r;
      const y = sy + 12 + Math.sin(angle) * r;
      if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], camX: number) {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, camX: number, w: number, h: number, tick: number) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0D1B4A');
  sky.addColorStop(0.5, '#1A2F8A');
  sky.addColorStop(1, '#2D4FCC');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars
  ctx.fillStyle = '#fff';
  const starPositions = [
    [50, 30], [120, 60], [200, 20], [280, 80], [350, 40],
    [430, 70], [500, 25], [580, 55], [650, 35], [720, 75],
    [800, 20], [870, 60], [140, 100], [320, 115], [600, 95],
    [760, 110], [450, 10], [85, 85], [530, 50], [690, 30],
  ];
  starPositions.forEach(([sx, sy], i) => {
    const twinkle = Math.sin(tick * 0.05 + i * 0.7) * 0.5 + 0.5;
    ctx.globalAlpha = 0.4 + twinkle * 0.6;
    const r = 0.8 + twinkle * 1.2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Moon
  const moonX = 800 - (camX * 0.02) % 900;
  ctx.save();
  ctx.shadowColor = '#FFF9C4';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#FFFDE7';
  ctx.beginPath();
  ctx.arc(moonX, 80, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F0F4FF';
  ctx.beginPath();
  ctx.arc(moonX + 14, 72, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Far mountains (parallax layer 1)
  ctx.fillStyle = '#1a2a6c';
  const mOffsetFar = -(camX * 0.15) % (w + 200);
  for (let i = -1; i < 4; i++) {
    const mx = i * 300 + mOffsetFar;
    ctx.beginPath();
    ctx.moveTo(mx, h * 0.75);
    ctx.lineTo(mx + 80, h * 0.38);
    ctx.lineTo(mx + 160, h * 0.5);
    ctx.lineTo(mx + 220, h * 0.3);
    ctx.lineTo(mx + 300, h * 0.6);
    ctx.lineTo(mx + 300, h * 0.75);
    ctx.closePath();
    ctx.fill();
    // Snow caps
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(mx + 200, h * 0.38);
    ctx.lineTo(mx + 220, h * 0.3);
    ctx.lineTo(mx + 240, h * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a2a6c';
  }

  // Near mountains (parallax layer 2)
  ctx.fillStyle = '#162155';
  const mOffsetNear = -(camX * 0.3) % (w + 300);
  for (let i = -1; i < 5; i++) {
    const mx = i * 250 + mOffsetNear;
    ctx.beginPath();
    ctx.moveTo(mx, h * 0.8);
    ctx.lineTo(mx + 60, h * 0.5);
    ctx.lineTo(mx + 120, h * 0.62);
    ctx.lineTo(mx + 180, h * 0.44);
    ctx.lineTo(mx + 250, h * 0.72);
    ctx.lineTo(mx + 250, h * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  const cloudOffset = -(camX * 0.2) % (w + 300);
  [[cloudOffset + 100, 130], [cloudOffset + 350, 100], [cloudOffset + 600, 150], [cloudOffset + 200 - w, 120]].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 35, 0, Math.PI * 2);
    ctx.arc(cx + 45, cy - 10, 45, 0, Math.PI * 2);
    ctx.arc(cx + 85, cy, 30, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawHUD(ctx: CanvasRenderingContext2D, score: number, coins: number, lives: number, powered: boolean, starred: boolean, w: number) {
  ctx.save();
  ctx.font = "bold 22px 'Nunito', sans-serif";
  ctx.textBaseline = 'top';

  // HUD bar
  const hudGrad = ctx.createLinearGradient(0, 0, 0, 54);
  hudGrad.addColorStop(0, 'rgba(0,0,0,0.65)');
  hudGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hudGrad;
  ctx.fillRect(0, 0, w, 54);

  // Score
  ctx.fillStyle = '#FFD700';
  ctx.fillText('⭐', 16, 14);
  ctx.fillStyle = '#fff';
  ctx.fillText(String(score).padStart(6, '0'), 48, 16);

  // Coins
  ctx.fillStyle = '#FFD700';
  ctx.fillText('🪙', w / 2 - 60, 14);
  ctx.fillStyle = '#fff';
  ctx.fillText(`× ${coins}`, w / 2 - 30, 16);

  // Lives
  ctx.fillStyle = '#FF4444';
  ctx.fillText('❤️', w - 130, 14);
  ctx.fillStyle = '#fff';
  ctx.fillText(`× ${lives}`, w - 96, 16);

  // Power status
  if (powered || starred) {
    ctx.fillStyle = starred ? '#FFD700' : '#FF6B6B';
    ctx.font = "bold 14px 'Nunito', sans-serif";
    ctx.fillText(starred ? '⭐ ЗВЕЗДА!' : '🍄 СУПЕР!', w / 2 - 40, 36);
  }

  ctx.restore();
}

// ───────────── Main Game Component ─────────────
export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    player: Player;
    platforms: Platform[];
    coins: Coin[];
    enemies: Enemy[];
    particles: Particle[];
    items: Item[];
    camX: number;
    score: number;
    coinCount: number;
    lives: number;
    tick: number;
    keys: Record<string, boolean>;
    gameState: 'menu' | 'playing' | 'dead' | 'win';
    animId: number;
  } | null>(null);

  const [uiState, setUiState] = useState<'menu' | 'playing' | 'dead' | 'win'>('menu');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(3);

  const initGame = useCallback(() => {
    const g = gameRef.current!;
    g.player = {
      pos: { x: 100, y: GROUND_Y - 44 },
      vel: { x: 0, y: 0 },
      onGround: false,
      facingRight: true,
      powered: false,
      starred: false,
      poweredTimer: 0,
      starTimer: 0,
      animFrame: 0,
      animTick: 0,
      dead: false,
      invincible: 0,
    };
    g.platforms = LEVEL_PLATFORMS.map(p => ({ ...p, hit: false, hitAnim: 0 }));
    g.coins = initCoins();
    g.enemies = INITIAL_ENEMIES.map(e => ({ ...e }));
    g.items = [];
    g.particles = [];
    g.camX = 0;
    g.score = 0;
    g.coinCount = 0;
    g.lives = 3;
    g.tick = 0;
    g.gameState = 'playing';
    setUiState('playing');
    setScore(0);
    setCoins(0);
    setLives(3);
  }, []);

  const spawnParticles = (g: typeof gameRef.current, x: number, y: number, color: string, count = 8, speed = 4) => {
    if (!g) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      g.particles.push({
        x, y,
        vx: Math.cos(angle) * speed * (0.5 + Math.random()),
        vy: Math.sin(angle) * speed * (0.5 + Math.random()) - 2,
        life: 40 + Math.random() * 20,
        maxLife: 60,
        color,
        size: 4 + Math.random() * 4,
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const W = canvas.width;
    const H = canvas.height;

    gameRef.current = {
      player: null as unknown as Player,
      platforms: [],
      coins: [],
      enemies: [],
      particles: [],
      items: [],
      camX: 0,
      score: 0,
      coinCount: 0,
      lives: 3,
      tick: 0,
      keys: {},
      gameState: 'menu',
      animId: 0,
    };

    const g = gameRef.current;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      g.keys[e.code] = down;
      g.keys[e.key] = down;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', e => onKey(e, true));
    window.addEventListener('keyup', e => onKey(e, false));

    const loop = () => {
      g.animId = requestAnimationFrame(loop);
      g.tick++;

      ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, g.camX, W, H, g.tick);

      if (g.gameState !== 'playing') {
        // Draw static background scene
        g.platforms.forEach?.(p => drawPlatform(ctx, p, g.camX, g.tick));
        g.coins.forEach?.(c => drawCoin(ctx, c, g.camX, g.tick));
        return;
      }

      const p = g.player;

      // ── Input ──
      const left = g.keys['ArrowLeft'] || g.keys['a'] || g.keys['A'];
      const right = g.keys['ArrowRight'] || g.keys['d'] || g.keys['D'];
      const jump = g.keys['ArrowUp'] || g.keys['w'] || g.keys['W'] || g.keys[' '] || g.keys['Space'];

      if (left) { p.vel.x -= 1.2; p.facingRight = false; }
      if (right) { p.vel.x += 1.2; p.facingRight = true; }
      if (!left && !right) p.vel.x *= FRICTION;
      p.vel.x = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, p.vel.x));

      if (jump && p.onGround) {
        p.vel.y = JUMP_FORCE;
        p.onGround = false;
        spawnParticles(g, p.pos.x + 17, p.pos.y + 44, '#aaffaa', 6, 3);
      }

      // Gravity
      p.vel.y += GRAVITY;
      p.vel.y = Math.min(p.vel.y, 18);

      // Move
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.pos.x = Math.max(0, p.pos.x);

      const pw = p.powered ? 44 : 34;
      const ph = p.powered ? 52 : 40;

      // Platform collision
      p.onGround = false;
      g.platforms.forEach(plat => {
        const pRect = { x: p.pos.x, y: p.pos.y, w: pw, h: ph };
        const platRect = { x: plat.x, y: plat.y, w: plat.w, h: plat.h };

        const ol = pRect.x + pRect.w - platRect.x;
        const or2 = platRect.x + platRect.w - pRect.x;
        const ot = pRect.y + pRect.h - platRect.y;
        const ob = platRect.y + platRect.h - pRect.y;

        if (ol > 0 && or2 > 0 && ot > 0 && ob > 0) {
          const minX = Math.min(ol, or2);
          const minY = Math.min(ot, ob);
          if (minY < minX) {
            if (ot < ob) {
              // Landing on top
              p.pos.y = platRect.y - ph;
              p.vel.y = 0;
              p.onGround = true;
            } else {
              // Hitting from below — bump block
              p.pos.y = platRect.y + platRect.h;
              p.vel.y = 1;
              if (!plat.hit && (plat.hasCoin || plat.hasItem)) {
                plat.hit = true;
                plat.hitAnim = 8;
                if (plat.hasCoin) {
                  g.coinCount++;
                  g.score += 100;
                  spawnParticles(g, plat.x + plat.w / 2, plat.y, '#FFD700', 10, 5);
                  setCoins(g.coinCount);
                  setScore(g.score);
                }
                if (plat.hasItem) {
                  g.items.push({
                    x: plat.x + plat.w / 2 - 16,
                    y: plat.y - 36,
                    vy: -2,
                    type: plat.hasItem,
                    collected: false,
                    phase: g.tick * 0.06,
                  });
                }
              }
            }
          } else {
            if (ol < or2) p.pos.x = platRect.x - pw;
            else p.pos.x = platRect.x + platRect.w;
            p.vel.x = 0;
          }
        }

        if (plat.hitAnim && plat.hitAnim > 0) plat.hitAnim--;
      });

      // Animate hit blocks
      g.platforms.forEach(plat => {
        if (plat.hitAnim !== undefined && plat.hitAnim > 0) plat.hitAnim--;
      });

      // Coin collection
      g.coins.forEach(coin => {
        if (coin.collected) return;
        const dx = Math.abs(p.pos.x + pw / 2 - coin.x);
        const dy = Math.abs(p.pos.y + ph / 2 - coin.y);
        if (dx < 22 && dy < 22) {
          coin.collected = true;
          g.coinCount++;
          g.score += 200;
          spawnParticles(g, coin.x, coin.y, '#FFD700', 12, 5);
          setCoins(g.coinCount);
          setScore(g.score);
        }
      });

      // Item collection
      g.items.forEach(item => {
        if (item.collected) return;
        item.y += item.vy;
        item.vy = Math.min(item.vy + 0.2, 3);
        // Land on platforms
        g.platforms.forEach(plat => {
          if (item.x + 16 > plat.x && item.x < plat.x + plat.w &&
            item.y + 26 > plat.y && item.y + 26 < plat.y + 20 && item.vy > 0) {
            item.y = plat.y - 26;
            item.vy = 0;
          }
        });
        if (item.y > GROUND_Y) { item.y = GROUND_Y - 26; item.vy = 0; }

        const dx = Math.abs(p.pos.x + pw / 2 - (item.x + 16));
        const dy = Math.abs(p.pos.y + ph / 2 - (item.y + 13));
        if (dx < 28 && dy < 28) {
          item.collected = true;
          if (item.type === 'mushroom') {
            p.powered = true;
            p.poweredTimer = 600;
            g.score += 500;
            spawnParticles(g, item.x, item.y, '#FF1744', 16, 6);
          } else {
            p.starred = true;
            p.starTimer = 480;
            g.score += 1000;
            spawnParticles(g, item.x, item.y, '#FFD700', 20, 8);
          }
          setScore(g.score);
        }
      });

      // Power timers
      if (p.powered && p.poweredTimer > 0) p.poweredTimer--;
      if (p.powered && p.poweredTimer <= 0 && !p.starred) p.powered = false;
      if (p.starred && p.starTimer > 0) p.starTimer--;
      if (p.starred && p.starTimer <= 0) { p.starred = false; p.powered = false; }
      if (p.invincible > 0) p.invincible--;

      // Enemy update
      g.enemies.forEach(e => {
        if (!e.alive) return;
        e.x += e.vel;
        e.animTick++;
        if (e.animTick > 12) { e.animFrame = 1 - e.animFrame; e.animTick = 0; }

        // Bounce off walls and platforms
        let onGround2 = false;
        g.platforms.forEach(plat => {
          const ew = e.type === 'koopa' ? 44 : 40;
          const eh = e.type === 'koopa' ? 48 : 42;
          const ex = e.x - ew / 2;
          const ey = e.y - eh;

          if (ex + ew > plat.x && ex < plat.x + plat.w &&
            ey + eh > plat.y && ey + eh < plat.y + 14) {
            onGround2 = true;
          }
          if (ex + ew > plat.x && ex < plat.x + plat.w &&
            ey + eh > plat.y && ey + eh < plat.y + 20) {
            e.vel = -e.vel;
          }
        });
        if (e.x < 0 || e.x > 4000) e.vel = -e.vel;

        // Stomp
        if (e.stomped && e.stompTimer !== undefined) {
          e.stompTimer--;
          if (e.stompTimer <= 0) e.alive = false;
          return;
        }

        // Player-enemy collision
        if (p.invincible <= 0) {
          const ew = e.type === 'koopa' ? 44 : 40;
          const eh = e.type === 'koopa' ? 48 : 42;
          const ex = e.x - ew / 2;
          const ey = e.y - eh;

          const dx = p.pos.x + pw / 2 - e.x;
          const dy = p.pos.y + ph - e.y;

          if (Math.abs(dx) < (pw / 2 + ew / 2 - 6) && Math.abs(dy) < (ph / 2 + eh / 2 - 6)) {
            if (p.starred) {
              // Destroy!
              e.alive = false;
              g.score += 300;
              spawnParticles(g, e.x, e.y, '#FF6B6B', 14, 7);
              setScore(g.score);
            } else if (p.vel.y > 0 && p.pos.y + ph < e.y - 4) {
              // Stomp
              e.stomped = true;
              e.stompTimer = 30;
              p.vel.y = -8;
              g.score += 300;
              spawnParticles(g, e.x, e.y, '#FF6B6B', 14, 7);
              setScore(g.score);
            } else {
              // Hurt
              if (p.powered) {
                p.powered = false;
                p.powered = false;
                p.invincible = 120;
                spawnParticles(g, p.pos.x + pw / 2, p.pos.y, '#FF4444', 12, 5);
              } else {
                p.dead = true;
                p.vel.y = -10;
                g.lives--;
                setLives(g.lives);
                spawnParticles(g, p.pos.x + pw / 2, p.pos.y, '#FF4444', 16, 8);
              }
            }
          }
        }
      });

      // Particles
      g.particles.forEach(part => {
        part.x += part.vx;
        part.y += part.vy;
        part.vy += 0.15;
        part.life--;
      });
      g.particles = g.particles.filter(part => part.life > 0);

      // Death
      if (p.dead || p.pos.y > H + 100) {
        g.gameState = 'dead';
        setUiState('dead');
        return;
      }

      // Win condition
      if (p.pos.x > 3800) {
        g.gameState = 'win';
        setUiState('win');
        setScore(g.score);
        return;
      }

      // Camera
      const targetCam = p.pos.x - W * 0.35;
      g.camX += (targetCam - g.camX) * 0.1;
      g.camX = Math.max(0, g.camX);

      // ── Draw ──
      g.platforms.forEach(plat => drawPlatform(ctx, plat, g.camX, g.tick));
      drawParticles(ctx, g.particles, g.camX);
      g.coins.forEach(c => drawCoin(ctx, c, g.camX, g.tick));
      g.items.forEach(item => drawItem(ctx, item, g.camX, g.tick));
      g.enemies.forEach(e => drawEnemy(ctx, e, g.camX, g.tick));
      drawPlayer(ctx, p, g.camX, g.tick);
      drawHUD(ctx, g.score, g.coinCount, g.lives, p.powered, p.starred, W);
    };

    g.animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(g.animId);
      window.removeEventListener('keydown', e => onKey(e, true));
      window.removeEventListener('keyup', e => onKey(e, false));
    };
  }, []);

  const handleStart = () => {
    if (!gameRef.current) return;
    initGame();
  };

  const handleRestart = () => {
    if (!gameRef.current) return;
    initGame();
  };

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={900}
          height={520}
          className="block rounded-2xl shadow-2xl"
          style={{ imageRendering: 'pixelated', maxWidth: '100vw', maxHeight: '100vh' }}
        />

        {/* Menu */}
        {uiState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(180deg, rgba(13,27,74,0.92) 0%, rgba(45,79,204,0.85) 100%)' }}>
            <div className="text-center px-8">
              <div className="text-8xl mb-2" style={{ filter: 'drop-shadow(0 4px 24px #FFD700)' }}>🌟</div>
              <h1 className="text-6xl font-black text-white mb-1 tracking-tight" style={{
                fontFamily: "'Nunito', sans-serif",
                textShadow: '0 4px 32px rgba(255,215,0,0.5), 0 2px 0 #B8860B'
              }}>
                SUPER ЮРА
              </h1>
              <p className="text-yellow-300 text-xl mb-8 font-bold tracking-widest" style={{ fontFamily: "'Nunito', sans-serif" }}>
                3D ПЛАТФОРМЕР
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8 text-left max-w-xs mx-auto">
                {[
                  ['←→ / A D', 'Движение'],
                  ['↑ / W / Пробел', 'Прыжок'],
                  ['🍄', 'Гриб = сила'],
                  ['⭐', 'Звезда = неуязвимость'],
                ].map(([key, desc]) => (
                  <div key={key} className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-yellow-300 font-bold text-sm">{key}</div>
                    <div className="text-white/80 text-xs mt-1">{desc}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleStart}
                className="px-12 py-4 rounded-2xl text-2xl font-black text-white tracking-wide transition-all duration-150 active:scale-95"
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)',
                  boxShadow: '0 8px 32px rgba(255,23,68,0.5), 0 4px 0 #880E4F',
                }}
              >
                ИГРАТЬ!
              </button>
            </div>
          </div>
        )}

        {/* Dead */}
        {uiState === 'dead' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="text-7xl mb-3">💀</div>
            <h2 className="text-5xl font-black text-white mb-2" style={{ fontFamily: "'Nunito', sans-serif", textShadow: '0 2px 16px #FF1744' }}>
              ОЙ!
            </h2>
            <p className="text-white/70 text-lg mb-2">Жизней: {lives} / Очков: {score}</p>
            {lives <= 0 ? (
              <p className="text-red-400 font-bold mb-6">Жизни закончились!</p>
            ) : (
              <p className="text-yellow-300 font-bold mb-6">Пробуй ещё раз!</p>
            )}
            <button
              onClick={handleRestart}
              className="px-10 py-3 rounded-2xl text-xl font-black text-white transition-all active:scale-95"
              style={{
                fontFamily: "'Nunito', sans-serif",
                background: 'linear-gradient(135deg, #FF6B35 0%, #FF1744 100%)',
                boxShadow: '0 4px 24px rgba(255,23,68,0.4), 0 3px 0 #880E4F',
              }}
            >
              НАЧАТЬ СНОВА
            </button>
          </div>
        )}

        {/* Win */}
        {uiState === 'win' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(180deg, rgba(13,27,74,0.9) 0%, rgba(26,102,0,0.85) 100%)' }}>
            <div className="text-7xl mb-3" style={{ filter: 'drop-shadow(0 4px 24px #FFD700)' }}>🏆</div>
            <h2 className="text-5xl font-black text-yellow-300 mb-2" style={{ fontFamily: "'Nunito', sans-serif", textShadow: '0 4px 24px rgba(255,215,0,0.7)' }}>
              ПОБЕДА!
            </h2>
            <p className="text-white text-xl mb-1">Очки: <span className="text-yellow-300 font-black">{score}</span></p>
            <p className="text-white/70 mb-6">Монет собрано: {coins}</p>
            <button
              onClick={handleRestart}
              className="px-10 py-3 rounded-2xl text-xl font-black text-white transition-all active:scale-95"
              style={{
                fontFamily: "'Nunito', sans-serif",
                background: 'linear-gradient(135deg, #FFD600 0%, #FF6B35 100%)',
                boxShadow: '0 4px 24px rgba(255,214,0,0.4), 0 3px 0 #E65100',
              }}
            >
              ИГРАТЬ ЕЩЁ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}