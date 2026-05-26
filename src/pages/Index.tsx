import { useEffect, useRef, useState, useCallback } from 'react';

// ───────────── Types ─────────────
interface Vec2 { x: number; y: number }

interface Player {
  pos: Vec2; vel: Vec2;
  onGround: boolean; facingRight: boolean;
  powered: boolean; starred: boolean;
  poweredTimer: number; starTimer: number;
  animFrame: number; animTick: number;
  dead: boolean; invincible: number;
}

interface Coin { x: number; y: number; collected: boolean; phase: number }
interface Platform { x: number; y: number; w: number; h: number; hasCoin?: boolean; hasItem?: 'mushroom' | 'star'; hit?: boolean; hitAnim?: number }
interface Enemy { x: number; y: number; vel: number; alive: boolean; type: 'goomba' | 'koopa'; animTick: number; animFrame: number; stomped?: boolean; stompTimer?: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface Item { x: number; y: number; vy: number; type: 'mushroom' | 'star'; collected: boolean; phase: number }

// ───────────── Constants ─────────────
const GRAVITY = 0.55;
const JUMP_FORCE = -13.5;
const MOVE_SPEED = 5;
const FRICTION = 0.82;
const GROUND_Y = 420;
const TILE = 48;
const W = 900;
const H = 520;

// ───────────── Level data ─────────────
const LEVEL_PLATFORMS: Platform[] = [
  { x: 0, y: GROUND_Y, w: 4000, h: 80 },
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
  return [300, 450, 650, 800, 1000, 1150, 1350, 1550, 1750, 1950, 2150, 2350, 2550, 2750, 2950, 3150, 3350, 3600, 3750]
    .map(x => ({ x, y: GROUND_Y - 52, collected: false, phase: Math.random() * Math.PI * 2 }));
}

// ───────────── Offscreen sprite cache ─────────────
// Pre-render static/semi-static assets to offscreen canvases
function makePlayerSprite(powered: boolean, starred: boolean, facingRight: boolean): HTMLCanvasElement {
  const pw = powered ? 44 : 34;
  const ph = powered ? 52 : 40;
  const oc = document.createElement('canvas');
  oc.width = pw; oc.height = ph;
  const c = oc.getContext('2d')!;

  if (!facingRight) {
    c.translate(pw, 0);
    c.scale(-1, 1);
  }

  // Shoes
  c.fillStyle = '#2a1200';
  c.fillRect(2, ph - 10, pw / 2 - 2, 10);
  c.fillRect(pw / 2 + 1, ph - 10, pw / 2 - 3, 10);

  // Overalls
  c.fillStyle = starred ? '#e6b800' : powered ? '#1144cc' : '#0044aa';
  c.fillRect(4, Math.floor(ph * 0.4), pw - 8, Math.ceil(ph * 0.65));

  // Shirt
  c.fillStyle = powered ? '#cc2200' : '#dd3300';
  c.fillRect(3, Math.floor(ph * 0.18), pw - 6, Math.ceil(ph * 0.45));

  // Head
  c.fillStyle = '#ffaa66';
  c.fillRect(4, 0, pw - 8, Math.floor(ph * 0.42));

  // Hat
  c.fillStyle = starred ? '#e6b800' : '#cc2200';
  c.fillRect(4, -10, pw - 8, 14);
  c.fillRect(1, ph * 0.06, pw - 2, 8);

  // Eye
  c.fillStyle = '#fff';
  c.fillRect(Math.floor(pw * 0.55), Math.floor(ph * 0.18), 8, 8);
  c.fillStyle = '#111';
  c.fillRect(Math.floor(pw * 0.6), Math.floor(ph * 0.21), 4, 4);

  // Mustache
  c.fillStyle = '#2a1200';
  c.fillRect(Math.floor(pw * 0.4), Math.floor(ph * 0.31), Math.floor(pw * 0.32), 4);

  // Suspenders
  c.fillStyle = starred ? '#cc9900' : powered ? '#0033aa' : '#003388';
  c.fillRect(Math.floor(pw * 0.28), Math.floor(ph * 0.18), 5, Math.floor(ph * 0.38));
  c.fillRect(Math.floor(pw * 0.62), Math.floor(ph * 0.18), 5, Math.floor(ph * 0.38));

  return oc;
}

function makeCoinSprite(): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = 28; oc.height = 32;
  const c = oc.getContext('2d')!;
  c.fillStyle = '#ffd600';
  c.fillRect(4, 0, 20, 32);
  c.fillRect(0, 6, 28, 20);
  c.fillStyle = '#ffee55';
  c.fillRect(6, 2, 12, 4);
  c.fillStyle = '#cc9900';
  c.fillRect(20, 4, 4, 24);
  c.fillRect(4, 26, 16, 4);
  c.fillStyle = '#fff8';
  c.fillRect(6, 4, 6, 12);
  return oc;
}

function makeMushroomSprite(): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = 36; oc.height = 38;
  const c = oc.getContext('2d')!;
  // Cap
  c.fillStyle = '#ff1744';
  c.fillRect(4, 0, 28, 20);
  c.fillRect(0, 6, 36, 14);
  // Dots
  c.fillStyle = '#fff';
  [[8, 4], [22, 2], [14, 12], [4, 14], [26, 12]].forEach(([x, y]) => {
    c.fillRect(x, y, 6, 6);
  });
  // Stem
  c.fillStyle = '#ffcc66';
  c.fillRect(6, 18, 24, 20);
  // Eyes
  c.fillStyle = '#fff';
  c.fillRect(8, 22, 7, 7);
  c.fillRect(21, 22, 7, 7);
  c.fillStyle = '#111';
  c.fillRect(10, 24, 3, 3);
  c.fillRect(23, 24, 3, 3);
  return oc;
}

function makeGroundTile(): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = TILE; oc.height = 80;
  const c = oc.getContext('2d')!;
  // Dirt
  c.fillStyle = '#5c3a1e';
  c.fillRect(0, 14, TILE, 66);
  c.fillStyle = '#4a2e10';
  c.fillRect(0, 50, TILE, 30);
  // Grid lines
  c.fillStyle = '#3a2008';
  c.fillRect(0, 14, TILE, 1);
  c.fillRect(0, 46, TILE, 1);
  c.fillRect(24, 14, 1, 66);
  // Grass top
  c.fillStyle = '#56c434';
  c.fillRect(0, 0, TILE, 14);
  c.fillStyle = '#3fa020';
  c.fillRect(0, 8, TILE, 6);
  // Grass details
  c.fillStyle = '#70e048';
  for (let i = 4; i < TILE; i += 8) {
    c.fillRect(i, 0, 3, 5);
  }
  return oc;
}

function makeBrickTile(w: number, h: number): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h + 8;
  const c = oc.getContext('2d')!;
  // Face
  c.fillStyle = '#8b5e3c';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#a06840';
  c.fillRect(0, 0, w, 3);
  c.fillStyle = '#6b4428';
  c.fillRect(0, h - 3, w, 3);
  // Brick lines H
  c.fillStyle = '#5a3318';
  c.fillRect(0, Math.floor(h / 2), w, 2);
  // Brick lines V
  for (let x = 16; x < w; x += 32) { c.fillRect(x, 0, 2, Math.floor(h / 2)); }
  for (let x = 32; x < w; x += 32) { c.fillRect(x, Math.floor(h / 2), 2, Math.ceil(h / 2)); }
  // Bottom face (3D)
  c.fillStyle = '#4a2810';
  c.fillRect(3, h, w - 3, 8);
  // Right face (3D)
  c.fillStyle = '#3a1e08';
  c.fillRect(w, 0, 3, h + 8);
  return oc;
}

function makeQuestionBlock(w: number, h: number): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = w + 3; oc.height = h + 8;
  const c = oc.getContext('2d')!;
  // Face
  c.fillStyle = '#e6a000';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffcc00';
  c.fillRect(0, 0, w, 4);
  c.fillRect(0, 0, 4, h);
  c.fillStyle = '#cc7700';
  c.fillRect(0, h - 4, w, 4);
  c.fillRect(w - 4, 0, 4, h);
  // ? symbol (pixel-art)
  c.fillStyle = '#fff';
  const qx = Math.floor(w / 2) - 5;
  const qy = Math.floor(h / 2) - 7;
  [[2,0,6,3],[0,3,2,3],[6,3,2,3],[0,6,8,3],[2,9,4,3],[2,15,4,3]].forEach(([rx,ry,rw,rh]) => {
    c.fillRect(qx+rx, qy+ry, rw, rh);
  });
  // Bottom face (3D)
  c.fillStyle = '#8b4400';
  c.fillRect(3, h, w - 3, 8);
  // Right face (3D)
  c.fillStyle = '#6b3000';
  c.fillRect(w, 0, 3, h + 8);
  return oc;
}

function makeHitBlock(w: number, h: number): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = w + 3; oc.height = h + 8;
  const c = oc.getContext('2d')!;
  c.fillStyle = '#7a5030';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#6a4020';
  c.fillRect(0, 0, w, 4);
  c.fillStyle = '#5a3010';
  c.fillRect(0, h - 2, w, 2);
  // X pattern
  c.fillStyle = '#5a3010';
  c.fillRect(Math.floor(w/2)-2, 0, 4, h);
  c.fillRect(0, Math.floor(h/2)-2, w, 4);
  c.fillStyle = '#4a2808';
  c.fillRect(3, h, w - 3, 8);
  c.fillRect(w, 0, 3, h + 8);
  return oc;
}

function makeGoombaSprite(frame: number): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = 42; oc.height = 44;
  const c = oc.getContext('2d')!;
  const legOff = frame === 0 ? -4 : 4;
  // Feet
  c.fillStyle = '#2a1200';
  c.fillRect(2 + legOff, 36, 16, 8);
  c.fillRect(24 - legOff, 36, 16, 8);
  // Body
  c.fillStyle = '#b05020';
  c.fillRect(2, 8, 38, 28);
  c.fillStyle = '#cc6030';
  c.fillRect(2, 8, 38, 8);
  // Eyes
  c.fillStyle = '#fff';
  c.fillRect(4, 14, 12, 12);
  c.fillRect(26, 14, 12, 12);
  c.fillStyle = '#111';
  c.fillRect(6, 16, 6, 6);
  c.fillRect(30, 16, 6, 6);
  // Angry brows
  c.fillStyle = '#2a1200';
  c.fillRect(2, 10, 14, 4);
  c.fillRect(26, 10, 14, 4);
  // Mouth
  c.fillStyle = '#2a1200';
  c.fillRect(10, 30, 22, 4);
  c.fillRect(10, 26, 6, 4);
  c.fillRect(26, 26, 6, 4);
  return oc;
}

function makeKoopaSprite(frame: number): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = 46; oc.height = 52;
  const c = oc.getContext('2d')!;
  // Shell back
  c.fillStyle = '#2d7a00';
  c.fillRect(4, 10, 38, 36);
  c.fillStyle = '#44aa00';
  c.fillRect(4, 10, 38, 12);
  c.fillStyle = '#226600';
  c.fillRect(4, 34, 38, 12);
  // Shell hex pattern
  c.fillStyle = '#338800';
  c.fillRect(14, 14, 18, 8);
  c.fillRect(4, 22, 38, 2);
  c.fillRect(14, 30, 18, 6);
  // Rim
  c.fillStyle = '#fff8cc';
  c.fillRect(0, 22, 4, 24);
  c.fillRect(42, 22, 4, 24);
  c.fillRect(4, 44, 38, 4);
  // Head
  const hx = frame === 0 ? 28 : 4;
  c.fillStyle = '#5ac000';
  c.fillRect(hx, 0, 18, 14);
  c.fillStyle = '#fff';
  c.fillRect(frame === 0 ? 38 : 4, 2, 6, 6);
  c.fillStyle = '#111';
  c.fillRect(frame === 0 ? 40 : 5, 3, 3, 3);
  // Legs
  c.fillStyle = '#ffe87c';
  c.fillRect(6, 44, 12, 8);
  c.fillRect(28, 44, 12, 8);
  return oc;
}

// ───────────── Static bg offscreen ─────────────
let bgCanvas: HTMLCanvasElement | null = null;

function ensureBgCanvas() {
  if (bgCanvas) return bgCanvas;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = W;
  bgCanvas.height = H;
  const c = bgCanvas.getContext('2d')!;

  // Sky gradient
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#08102e');
  sky.addColorStop(0.55, '#152060');
  sky.addColorStop(1, '#1e3a8a');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);

  // Stars — fixed pixel dots
  c.fillStyle = '#fff';
  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  };
  const rand = rng(42);
  for (let i = 0; i < 120; i++) {
    const sx = rand() * W;
    const sy = rand() * H * 0.65;
    const br = rand() * 0.7 + 0.3;
    c.globalAlpha = br;
    c.fillRect(Math.floor(sx), Math.floor(sy), rand() > 0.8 ? 2 : 1, rand() > 0.8 ? 2 : 1);
  }
  c.globalAlpha = 1;

  // Moon
  c.fillStyle = '#fffde0';
  c.fillRect(760, 50, 60, 60);
  c.fillStyle = '#f0f4ff';
  c.fillRect(780, 50, 40, 40);
  c.fillStyle = '#08102e';
  c.fillRect(780, 48, 42, 42);
  c.fillStyle = '#fffde0';
  c.fillRect(760, 50, 60, 60);
  // Crescent
  c.fillStyle = '#152060';
  c.fillRect(776, 54, 44, 44);

  // Far mountains
  c.fillStyle = '#0e1c5c';
  [[0,280,160,160],[140,240,200,200],[300,260,180,190],[450,230,220,220],[640,250,170,200],[780,270,180,180]].forEach(([mx,my,mw,mh]) => {
    c.beginPath();
    c.moveTo(mx, H);
    c.lineTo(mx + mw/2, my);
    c.lineTo(mx + mw, H);
    c.closePath();
    c.fill();
    // Snow
    c.fillStyle = '#ffffff18';
    c.beginPath();
    c.moveTo(mx + mw/2 - 15, my + 18);
    c.lineTo(mx + mw/2, my);
    c.lineTo(mx + mw/2 + 15, my + 18);
    c.closePath();
    c.fill();
    c.fillStyle = '#0e1c5c';
  });

  // Near mountains
  c.fillStyle = '#0a1540';
  [[0,330,200,140],[160,300,220,160],[340,320,200,140],[500,310,230,150],[690,330,200,140],[860,315,220,155]].forEach(([mx,my,mw,mh]) => {
    c.beginPath();
    c.moveTo(mx, H);
    c.lineTo(mx + mw/2, my);
    c.lineTo(mx + mw, H);
    c.closePath();
    c.fill();
  });

  return bgCanvas;
}

// Parallax clouds offscreen
let cloudCanvas: HTMLCanvasElement | null = null;
function ensureCloudCanvas() {
  if (cloudCanvas) return cloudCanvas;
  cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = W * 2;
  cloudCanvas.height = 200;
  const c = cloudCanvas.getContext('2d')!;
  c.fillStyle = 'rgba(255,255,255,0.08)';
  [[100,60],[350,40],[580,70],[820,45],[1100,60],[1400,50],[1650,65]].forEach(([cx,cy]) => {
    c.fillRect(cx - 50, cy, 100, 30);
    c.fillRect(cx - 70, cy + 10, 140, 25);
    c.fillRect(cx - 35, cy - 14, 70, 20);
  });
  return cloudCanvas;
}

// Ground tile cache
let groundTileCache: HTMLCanvasElement | null = null;
// Block caches keyed by "w_h"
const blockCache = new Map<string, HTMLCanvasElement>();
const playerCache = new Map<string, HTMLCanvasElement>();
const enemyCache = new Map<string, HTMLCanvasElement>();
let coinSprite: HTMLCanvasElement | null = null;
let mushroomSprite: HTMLCanvasElement | null = null;

function getGroundTile() { return groundTileCache ??= makeGroundTile(); }
function getCoinSprite() { return coinSprite ??= makeCoinSprite(); }
function getMushroomSprite() { return mushroomSprite ??= makeMushroomSprite(); }

function getBlockSprite(w: number, h: number, type: 'brick' | 'question' | 'hit') {
  const key = `${type}_${w}_${h}`;
  if (!blockCache.has(key)) {
    if (type === 'question') blockCache.set(key, makeQuestionBlock(w, h));
    else if (type === 'hit') blockCache.set(key, makeHitBlock(w, h));
    else blockCache.set(key, makeBrickTile(w, h));
  }
  return blockCache.get(key)!;
}

function getPlayerSprite(powered: boolean, starred: boolean, facingRight: boolean) {
  const key = `${powered}_${starred}_${facingRight}`;
  if (!playerCache.has(key)) playerCache.set(key, makePlayerSprite(powered, starred, facingRight));
  return playerCache.get(key)!;
}

function getEnemySprite(type: 'goomba' | 'koopa', frame: number) {
  const key = `${type}_${frame}`;
  if (!enemyCache.has(key)) {
    if (type === 'goomba') enemyCache.set(key, makeGoombaSprite(frame));
    else enemyCache.set(key, makeKoopaSprite(frame));
  }
  return enemyCache.get(key)!;
}

// ───────────── Draw functions (fast, no gradients in loop) ─────────────
function drawBackground(ctx: CanvasRenderingContext2D, camX: number, tick: number) {
  ctx.drawImage(ensureBgCanvas(), 0, 0);

  // Twinkling stars (just flip alpha on a few)
  const starPos = [[50,30],[200,20],[430,70],[580,55],[800,20],[760,110]];
  starPos.forEach(([sx, sy], i) => {
    const on = Math.floor(tick * 0.04 + i * 1.3) % 3 !== 0;
    ctx.globalAlpha = on ? 0.9 : 0.2;
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx, sy, 2, 2);
  });
  ctx.globalAlpha = 1;

  // Scrolling clouds
  const cc = ensureCloudCanvas();
  const co = (-(camX * 0.12)) % W;
  ctx.drawImage(cc, co, 60, W, 200, 0, 60, W, 200);
  if (co > -W) ctx.drawImage(cc, co - W * 2, 60, W, 200, 0, 60, W, 200);
}

function drawPlatform(ctx: CanvasRenderingContext2D, plat: Platform, camX: number) {
  const sx = Math.floor(plat.x - camX);
  const hitOffset = plat.hit && plat.hitAnim ? -Math.sin((plat.hitAnim / 8) * Math.PI) * 8 : 0;
  const sy = Math.floor(plat.y + hitOffset);

  if (plat.h > 50) {
    // Ground
    const tile = getGroundTile();
    const count = Math.ceil(plat.w / TILE) + 1;
    for (let i = 0; i < count; i++) {
      const tx = sx + i * TILE;
      if (tx + TILE < -4 || tx > W + 4) continue;
      ctx.drawImage(tile, tx, sy);
    }
  } else {
    // Floating block
    const isQ = (plat.hasCoin || plat.hasItem) && !plat.hit;
    const isHit = plat.hit;
    const type = isHit ? 'hit' : isQ ? 'question' : 'brick';
    const sprite = getBlockSprite(plat.w, plat.h, type);
    ctx.drawImage(sprite, sx, sy);
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin, camX: number, tick: number) {
  if (coin.collected) return;
  const sx = Math.floor(coin.x - camX - 14);
  const sy = Math.floor(coin.y + Math.sin(tick * 0.05 + coin.phase) * 5) - 16;
  // Squish effect using scale
  const scaleX = Math.abs(Math.cos(tick * 0.07 + coin.phase));
  if (scaleX < 0.05) return;
  const sprite = getCoinSprite();
  const sw = sprite.width * scaleX;
  const ox = 14 * (1 - scaleX);
  ctx.drawImage(sprite, sx + ox, sy, sw, sprite.height);
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, camX: number, tick: number) {
  if (item.collected) return;
  const sx = Math.floor(item.x - camX);
  const sy = Math.floor(item.y);
  if (item.type === 'mushroom') {
    ctx.drawImage(getMushroomSprite(), sx - 2, sy);
  } else {
    // Star — drawn directly, fast pixel star
    const cx = sx + 16;
    const cy = sy + 16;
    const hue = (tick * 5) % 360;
    ctx.fillStyle = `hsl(${hue},100%,65%)`;
    // Simple star via rotated rectangles
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tick * 0.05);
    ctx.fillRect(-4, -16, 8, 32);
    ctx.rotate(Math.PI / 3);
    ctx.fillRect(-4, -16, 8, 32);
    ctx.rotate(Math.PI / 3);
    ctx.fillRect(-4, -16, 8, 32);
    ctx.restore();
    ctx.fillStyle = '#fff6';
    ctx.fillRect(cx - 6, cy - 6, 12, 12);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, camX: number) {
  if (!e.alive) return;
  const sx = Math.floor(e.x - camX);
  const sy = Math.floor(e.y);
  const frame = e.animFrame;
  if (e.stomped) {
    // Flat stomped version
    ctx.save();
    ctx.globalAlpha = 0.7;
    const sp = getEnemySprite(e.type, 0);
    ctx.drawImage(sp, sx - sp.width / 2, sy - 12, sp.width, 12);
    ctx.restore();
    return;
  }
  const sp = getEnemySprite(e.type, frame);
  ctx.drawImage(sp, sx - sp.width / 2, sy - sp.height);
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, camX: number, tick: number) {
  const pw = p.powered ? 44 : 34;
  const ph = p.powered ? 52 : 40;
  const sx = Math.floor(p.pos.x - camX);
  const sy = Math.floor(p.pos.y);

  if (p.invincible > 0 && Math.floor(tick / 3) % 2 === 1) return;

  // Star rainbow flash
  if (p.starred) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = `hsl(${tick * 8 % 360},100%,60%)`;
    ctx.fillRect(sx - 4, sy - 4, pw + 8, ph + 8);
    ctx.restore();
  }

  const sp = getPlayerSprite(p.powered, p.starred, p.facingRight);
  ctx.drawImage(sp, sx, sy);

  // Walking dust
  if (p.onGround && Math.abs(p.vel.x) > 2 && Math.floor(tick / 6) % 2 === 0) {
    ctx.fillStyle = 'rgba(180,140,80,0.5)';
    ctx.fillRect(sx + (p.facingRight ? 0 : pw - 8), sy + ph - 4, 8, 4);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], camX: number) {
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    const s = Math.ceil(p.size * (p.life / p.maxLife));
    ctx.fillRect(Math.floor(p.x - camX - s / 2), Math.floor(p.y - s / 2), s, s);
  });
  ctx.globalAlpha = 1;
}

function drawHUD(ctx: CanvasRenderingContext2D, score: number, coinCount: number, lives: number, powered: boolean, starred: boolean) {
  // Semi-transparent bar
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, 50);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(0, 48, W, 2);

  ctx.font = "bold 20px 'Nunito', sans-serif";
  ctx.textBaseline = 'middle';

  // Score
  ctx.fillStyle = '#ffd700';
  ctx.fillText('★', 16, 25);
  ctx.fillStyle = '#fff';
  ctx.fillText(String(score).padStart(7, '0'), 46, 25);

  // Coins
  const cs = getCoinSprite();
  ctx.drawImage(cs, W / 2 - 60, 10, 20, 26);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`× ${coinCount}`, W / 2 - 34, 25);

  // Lives
  ctx.fillStyle = '#ff4444';
  ctx.fillText('♥', W - 120, 25);
  ctx.fillStyle = '#fff';
  ctx.fillText(`× ${lives}`, W - 96, 25);

  // Status
  if (starred || powered) {
    ctx.fillStyle = starred ? '#ffd700' : '#ff6b6b';
    ctx.font = "bold 13px 'Nunito', sans-serif";
    ctx.fillText(starred ? '⭐ ЗВЕЗДА!' : '🍄 СУПЕР!', W / 2 - 36, 37);
  }
}

// ───────────── Main Component ─────────────
export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    player: Player;
    platforms: Platform[];
    coins: Coin[];
    enemies: Enemy[];
    particles: Particle[];
    items: Item[];
    camX: number; score: number; coinCount: number; lives: number;
    tick: number; keys: Record<string, boolean>; gameState: 'menu' | 'playing' | 'dead' | 'win'; animId: number;
  } | null>(null);

  const [uiState, setUiState] = useState<'menu' | 'playing' | 'dead' | 'win'>('menu');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(3);
  const touchRef = useRef<{ left: boolean; right: boolean; jump: boolean }>({ left: false, right: false, jump: false });

  const spawnParticles = useCallback((x: number, y: number, color: string, count = 8, speed = 4) => {
    const g = gameRef.current;
    if (!g) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      g.particles.push({
        x, y,
        vx: Math.cos(angle) * speed * (0.5 + Math.random()),
        vy: Math.sin(angle) * speed * (0.5 + Math.random()) - 2,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color,
        size: 5 + Math.random() * 4,
      });
    }
  }, []);

  const initGame = useCallback(() => {
    const g = gameRef.current!;
    g.player = {
      pos: { x: 100, y: GROUND_Y - 44 }, vel: { x: 0, y: 0 },
      onGround: false, facingRight: true,
      powered: false, starred: false,
      poweredTimer: 0, starTimer: 0,
      animFrame: 0, animTick: 0,
      dead: false, invincible: 0,
    };
    g.platforms = LEVEL_PLATFORMS.map(p => ({ ...p, hit: false, hitAnim: 0 }));
    g.coins = initCoins();
    g.enemies = INITIAL_ENEMIES.map(e => ({ ...e }));
    g.items = []; g.particles = [];
    g.camX = 0; g.score = 0; g.coinCount = 0; g.lives = 3; g.tick = 0;
    g.gameState = 'playing';
    setUiState('playing'); setScore(0); setCoins(0); setLives(3);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.imageSmoothingEnabled = false;

    // Warm up caches
    ensureBgCanvas(); ensureCloudCanvas(); getGroundTile(); getCoinSprite();
    getEnemySprite('goomba', 0); getEnemySprite('goomba', 1);
    getEnemySprite('koopa', 0); getEnemySprite('koopa', 1);
    getPlayerSprite(false, false, true); getPlayerSprite(false, false, false);
    getPlayerSprite(true, false, true); getPlayerSprite(true, false, false);
    getPlayerSprite(false, true, true); getPlayerSprite(false, true, false);
    getBlockSprite(96, 24, 'question'); getBlockSprite(96, 24, 'brick'); getBlockSprite(96, 24, 'hit');

    gameRef.current = {
      player: null as unknown as Player,
      platforms: [], coins: [], enemies: [], particles: [], items: [],
      camX: 0, score: 0, coinCount: 0, lives: 3, tick: 0,
      keys: {}, gameState: 'menu', animId: 0,
    };

    const g = gameRef.current;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      g.keys[e.code] = down;
      g.keys[e.key] = down;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    };
    window.addEventListener('keydown', e => onKey(e, true));
    window.addEventListener('keyup', e => onKey(e, false));

    let lastTime = 0;
    const loop = (time: number) => {
      g.animId = requestAnimationFrame(loop);

      // Fixed timestep — skip if tab is hidden / too slow
      const dt = time - lastTime;
      lastTime = time;
      if (dt > 100) return; // tab was hidden

      g.tick++;

      drawBackground(ctx, g.camX, g.tick);

      if (g.gameState !== 'playing') {
        g.platforms.forEach?.(p => drawPlatform(ctx, p, g.camX));
        return;
      }

      const p = g.player;
      const touch = touchRef.current;

      const left = g.keys['ArrowLeft'] || g.keys['a'] || g.keys['A'] || touch.left;
      const right = g.keys['ArrowRight'] || g.keys['d'] || g.keys['D'] || touch.right;
      const jump = g.keys['ArrowUp'] || g.keys['w'] || g.keys['W'] || g.keys[' '] || g.keys['Space'] || touch.jump;

      if (left) { p.vel.x -= 1.2; p.facingRight = false; }
      if (right) { p.vel.x += 1.2; p.facingRight = true; }
      if (!left && !right) p.vel.x *= FRICTION;
      p.vel.x = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, p.vel.x));

      if (jump && p.onGround) {
        p.vel.y = JUMP_FORCE;
        p.onGround = false;
        spawnParticles(p.pos.x + 17, p.pos.y + 44, '#aaffaa', 5, 3);
      }

      p.vel.y = Math.min(p.vel.y + GRAVITY, 18);
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.pos.x = Math.max(0, p.pos.x);

      const pw = p.powered ? 44 : 34;
      const ph = p.powered ? 52 : 40;

      p.onGround = false;
      g.platforms.forEach(plat => {
        const ol = p.pos.x + pw - plat.x;
        const or2 = plat.x + plat.w - p.pos.x;
        const ot = p.pos.y + ph - plat.y;
        const ob = plat.y + plat.h - p.pos.y;
        if (ol > 0 && or2 > 0 && ot > 0 && ob > 0) {
          const minX = Math.min(ol, or2);
          const minY = Math.min(ot, ob);
          if (minY < minX) {
            if (ot < ob) {
              p.pos.y = plat.y - ph; p.vel.y = 0; p.onGround = true;
            } else {
              p.pos.y = plat.y + plat.h; p.vel.y = 1;
              if (!plat.hit && (plat.hasCoin || plat.hasItem)) {
                plat.hit = true; plat.hitAnim = 8;
                if (plat.hasCoin) {
                  g.coinCount++; g.score += 100;
                  spawnParticles(plat.x + plat.w / 2, plat.y, '#ffd700', 10, 5);
                  setCoins(g.coinCount); setScore(g.score);
                }
                if (plat.hasItem) {
                  g.items.push({ x: plat.x + plat.w / 2 - 18, y: plat.y - 38, vy: -2, type: plat.hasItem, collected: false, phase: g.tick * 0.06 });
                }
              }
            }
          } else {
            if (ol < or2) p.pos.x = plat.x - pw;
            else p.pos.x = plat.x + plat.w;
            p.vel.x = 0;
          }
        }
        if (plat.hitAnim !== undefined && plat.hitAnim > 0) plat.hitAnim--;
      });

      // Coins
      g.coins.forEach(coin => {
        if (coin.collected) return;
        if (Math.abs(p.pos.x + pw / 2 - coin.x) < 22 && Math.abs(p.pos.y + ph / 2 - coin.y) < 22) {
          coin.collected = true; g.coinCount++; g.score += 200;
          spawnParticles(coin.x, coin.y, '#ffd700', 10, 5);
          setCoins(g.coinCount); setScore(g.score);
        }
      });

      // Items
      g.items.forEach(item => {
        if (item.collected) return;
        item.y += item.vy;
        item.vy = Math.min(item.vy + 0.2, 3);
        g.platforms.forEach(plat => {
          if (item.x + 18 > plat.x && item.x < plat.x + plat.w &&
            item.y + 36 > plat.y && item.y + 36 < plat.y + 18 && item.vy > 0) {
            item.y = plat.y - 36; item.vy = 0;
          }
        });
        if (item.y > GROUND_Y) { item.y = GROUND_Y - 36; item.vy = 0; }
        if (Math.abs(p.pos.x + pw / 2 - (item.x + 18)) < 30 && Math.abs(p.pos.y + ph / 2 - (item.y + 18)) < 30) {
          item.collected = true;
          if (item.type === 'mushroom') { p.powered = true; p.poweredTimer = 600; g.score += 500; spawnParticles(item.x, item.y, '#ff1744', 14, 6); }
          else { p.starred = true; p.starTimer = 480; g.score += 1000; spawnParticles(item.x, item.y, '#ffd700', 18, 8); }
          setScore(g.score);
        }
      });

      if (p.powered && !p.starred) { p.poweredTimer--; if (p.poweredTimer <= 0) p.powered = false; }
      if (p.starred) { p.starTimer--; if (p.starTimer <= 0) { p.starred = false; p.powered = false; } }
      if (p.invincible > 0) p.invincible--;

      // Enemies
      g.enemies.forEach(e => {
        if (!e.alive) return;
        e.x += e.vel;
        e.animTick++;
        if (e.animTick > 14) { e.animFrame = 1 - e.animFrame; e.animTick = 0; }
        if (e.stomped) {
          if (e.stompTimer !== undefined) { e.stompTimer--; if (e.stompTimer <= 0) e.alive = false; }
          return;
        }
        if (e.x < 0 || e.x > 4000) e.vel = -e.vel;
        // Bounce off platforms edges
        g.platforms.forEach(plat => {
          if (plat.h > 50) return;
          if ((e.x + 20 > plat.x && e.x < plat.x + plat.w) && Math.abs(e.y - plat.y) < 8) {
            e.vel = -e.vel;
          }
        });
        // Collision with player
        if (p.invincible <= 0) {
          const ew = e.type === 'koopa' ? 40 : 38;
          const eh = e.type === 'koopa' ? 48 : 42;
          const dx = p.pos.x + pw / 2 - e.x;
          const dy = p.pos.y + ph - e.y;
          if (Math.abs(dx) < (pw / 2 + ew / 2 - 6) && Math.abs(dy) < (ph / 2 + eh / 2 - 4)) {
            if (p.starred) {
              e.alive = false; g.score += 300;
              spawnParticles(e.x, e.y, '#ff6b6b', 12, 7);
              setScore(g.score);
            } else if (p.vel.y > 0 && p.pos.y + ph < e.y - 2) {
              e.stomped = true; e.stompTimer = 28;
              p.vel.y = -8; g.score += 300;
              spawnParticles(e.x, e.y, '#ff6b6b', 12, 7);
              setScore(g.score);
            } else {
              if (p.powered) { p.powered = false; p.invincible = 120; spawnParticles(p.pos.x + pw / 2, p.pos.y, '#ff4444', 10, 5); }
              else { p.dead = true; p.vel.y = -10; g.lives--; setLives(g.lives); spawnParticles(p.pos.x + pw / 2, p.pos.y, '#ff4444', 16, 8); }
            }
          }
        }
      });

      // Particles
      g.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life--; });
      g.particles = g.particles.filter(pt => pt.life > 0);

      if (p.dead || p.pos.y > H + 80) { g.gameState = 'dead'; setUiState('dead'); return; }
      if (p.pos.x > 3850) { g.gameState = 'win'; setUiState('win'); setScore(g.score); return; }

      // Camera — smooth lerp
      g.camX += (p.pos.x - W * 0.35 - g.camX) * 0.1;
      g.camX = Math.max(0, g.camX);

      // ── Draw ──
      g.platforms.forEach(plat => drawPlatform(ctx, plat, g.camX));
      drawParticles(ctx, g.particles, g.camX);
      g.coins.forEach(c => drawCoin(ctx, c, g.camX, g.tick));
      g.items.forEach(item => drawItem(ctx, item, g.camX, g.tick));
      g.enemies.forEach(e => drawEnemy(ctx, e, g.camX));
      drawPlayer(ctx, p, g.camX, g.tick);
      drawHUD(ctx, g.score, g.coinCount, g.lives, p.powered, p.starred);
    };

    g.animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(g.animId);
  }, [spawnParticles]);

  return (
    <div className="relative w-full h-screen bg-[#04081a] flex items-center justify-center overflow-hidden">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block rounded-2xl"
          style={{
            imageRendering: 'pixelated',
            maxWidth: '100vw',
            maxHeight: '100vh',
            boxShadow: '0 0 60px rgba(30,60,180,0.6), 0 0 0 3px rgba(255,255,255,0.08)',
          }}
        />

        {/* Menu */}
        {uiState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(180deg, rgba(4,8,26,0.94) 0%, rgba(14,28,92,0.88) 100%)', backdropFilter: 'blur(2px)' }}>
            <div className="text-center px-8">
              <div className="text-7xl mb-3" style={{ filter: 'drop-shadow(0 0 20px #ffd700)' }}>🌟</div>
              <h1 className="font-black text-white mb-1 tracking-tight"
                style={{ fontFamily: "'Nunito', sans-serif", fontSize: 'clamp(2.5rem, 7vw, 4rem)', textShadow: '0 4px 24px rgba(255,215,0,0.6), 0 2px 0 #7a5000' }}>
                SUPER ЮРА
              </h1>
              <p className="text-yellow-400 font-black tracking-widest mb-7" style={{ fontFamily: "'Nunito', sans-serif", fontSize: '1rem' }}>
                PIXEL PLATFORMER
              </p>
              <div className="grid grid-cols-2 gap-3 mb-7 max-w-xs mx-auto">
                {[['←→ / A D','Движение'],['↑ / Пробел','Прыжок'],['🍄','Гриб — сила'],['⭐','Звезда — броня']].map(([k, d]) => (
                  <div key={k} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} className="rounded-xl p-3 text-center">
                    <div className="text-yellow-300 font-black text-sm" style={{ fontFamily: "'Nunito', sans-serif" }}>{k}</div>
                    <div className="text-white/60 text-xs mt-0.5">{d}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => { if (gameRef.current) initGame(); }}
                className="px-12 py-4 rounded-2xl text-2xl font-black text-white tracking-wide transition-transform active:scale-95"
                style={{ fontFamily: "'Nunito', sans-serif", background: 'linear-gradient(135deg,#ff6b35,#ff1744)', boxShadow: '0 6px 28px rgba(255,23,68,0.55), 0 4px 0 #7a0020' }}>
                ИГРАТЬ!
              </button>
            </div>
          </div>
        )}

        {/* Dead */}
        {uiState === 'dead' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}>
            <div className="text-6xl mb-3">💀</div>
            <h2 className="text-5xl font-black text-white mb-2" style={{ fontFamily: "'Nunito', sans-serif", textShadow: '0 2px 16px #ff1744' }}>ОЙ!</h2>
            <p className="text-white/60 mb-1">Жизней: {lives} · Очков: {score}</p>
            <p className={`font-black mb-6 ${lives <= 0 ? 'text-red-400' : 'text-yellow-300'}`} style={{ fontFamily: "'Nunito', sans-serif" }}>
              {lives <= 0 ? 'Жизни закончились!' : 'Ещё раз!'}
            </p>
            <button onClick={() => { if (gameRef.current) initGame(); }}
              className="px-10 py-3 rounded-2xl text-xl font-black text-white active:scale-95 transition-transform"
              style={{ fontFamily: "'Nunito', sans-serif", background: 'linear-gradient(135deg,#ff6b35,#ff1744)', boxShadow: '0 4px 24px rgba(255,23,68,0.4),0 3px 0 #7a0020' }}>
              ЗАНОВО
            </button>
          </div>
        )}

        {/* Win */}
        {uiState === 'win' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(180deg, rgba(4,8,26,0.92) 0%, rgba(0,60,0,0.88) 100%)', backdropFilter: 'blur(4px)' }}>
            <div className="text-6xl mb-3" style={{ filter: 'drop-shadow(0 4px 20px #ffd700)' }}>🏆</div>
            <h2 className="text-5xl font-black text-yellow-300 mb-2" style={{ fontFamily: "'Nunito', sans-serif", textShadow: '0 4px 20px rgba(255,215,0,0.7)' }}>ПОБЕДА!</h2>
            <p className="text-white text-xl mb-1">Очки: <span className="text-yellow-300 font-black">{score}</span></p>
            <p className="text-white/50 mb-6">Монет: {coins}</p>
            <button onClick={() => { if (gameRef.current) initGame(); }}
              className="px-10 py-3 rounded-2xl text-xl font-black text-white active:scale-95 transition-transform"
              style={{ fontFamily: "'Nunito', sans-serif", background: 'linear-gradient(135deg,#ffd600,#ff6b35)', boxShadow: '0 4px 24px rgba(255,214,0,0.4),0 3px 0 #8b3a00' }}>
              ЕЩЁ РАЗ
            </button>
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      {uiState === 'playing' && (
        <div className="fixed bottom-0 left-0 right-0 flex justify-between items-end px-6 pb-6 pointer-events-none md:hidden" style={{ zIndex: 50 }}>
          <div className="flex gap-3 pointer-events-auto">
            {[['left','◀'] as const, ['right','▶'] as const].map(([dir, label]) => (
              <button key={dir}
                onTouchStart={e => { e.preventDefault(); touchRef.current[dir] = true; }}
                onTouchEnd={e => { e.preventDefault(); touchRef.current[dir] = false; }}
                onMouseDown={() => { touchRef.current[dir] = true; }}
                onMouseUp={() => { touchRef.current[dir] = false; }}
                onMouseLeave={() => { touchRef.current[dir] = false; }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl select-none active:scale-90 transition-transform"
                style={{ background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(8px)', border: '2px solid rgba(255,255,255,0.2)', touchAction: 'none', userSelect: 'none' }}>
                {label}
              </button>
            ))}
          </div>
          <button
            onTouchStart={e => { e.preventDefault(); touchRef.current.jump = true; }}
            onTouchEnd={e => { e.preventDefault(); touchRef.current.jump = false; }}
            onMouseDown={() => { touchRef.current.jump = true; }}
            onMouseUp={() => { touchRef.current.jump = false; }}
            onMouseLeave={() => { touchRef.current.jump = false; }}
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black select-none active:scale-90 transition-transform pointer-events-auto text-white"
            style={{ background: 'linear-gradient(135deg,#ff6b35,#ff1744)', boxShadow: '0 6px 20px rgba(255,23,68,0.5),0 4px 0 #7a0020', touchAction: 'none', userSelect: 'none', fontFamily: "'Nunito', sans-serif" }}>
            A
          </button>
        </div>
      )}
    </div>
  );
}
