/* =====================================================================
   Deep Water Duo - canvas rendering
   One shared cross-section of the lake with both anglers' lines in it.
   ===================================================================== */

const LANE = [0.34, 0.66];               // where each angler's line hangs
const P_COLOR = ['#5fc9f0', '#ffb35c'];  // player 1 / player 2 accent

let ambient = [];
let ripples = [];

function seedAmbient(game) {
  const spot = SPOTS[game.spot];
  ambient = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const sp = pickAmbientSpecies(spot);
    if (!sp) continue;
    ambient.push({
      sp,
      x: Math.random(),
      depth: sp.min + Math.random() * Math.min(spot.bottom - sp.min, sp.max - sp.min),
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: 0.008 + Math.random() * 0.022,
      bob: Math.random() * 6.28,
      scale: 0.5 + Math.random() * 0.7,
    });
  }
}

function pickAmbientSpecies(spot) {
  const ok = SPECIES.filter(s => s.min < spot.bottom);
  if (!ok.length) return null;
  const total = ok.reduce((s, x) => s + x.rarity, 0);
  let r = Math.random() * total;
  for (const s of ok) { r -= s.rarity; if (r <= 0) return s; }
  return ok[0];
}

function updateAmbient(dt) {
  for (const f of ambient) {
    f.x += f.dir * f.speed * dt;
    f.bob += dt * 1.6;
    if (f.x < -0.1) { f.x = 1.1; }
    if (f.x > 1.1)  { f.x = -0.1; }
  }
  ripples = ripples.filter(r => (r.life -= dt) > 0);
}

function addRipple(x, y) { ripples.push({ x, y, life: 0.9, max: 0.9 }); }

/* --------------------------------------------------------------- */
function draw(ctx, W, H, game, t) {
  const spot = SPOTS[game.spot];
  const skyH = Math.round(H * 0.17);
  const waterTop = skyH;
  const waterH = H - skyH;

  // Feet-to-pixel mapping for this spot.
  const bottom = spot.bottom;
  const ftToY = ft => waterTop + (ft / bottom) * waterH;

  drawSky(ctx, W, skyH, t);
  drawWater(ctx, W, waterTop, waterH, bottom, t);
  drawDepthRuler(ctx, W, waterTop, waterH, bottom, game);
  drawAmbient(ctx, W, ftToY, t);
  drawBottom(ctx, W, H, waterTop, waterH, spot, t);
  drawBoat(ctx, W, skyH, t);

  for (let i = 0; i < 2; i++) drawAnglerLine(ctx, W, H, skyH, ftToY, game, game.anglers[i], i, t);
  drawRipples(ctx, waterTop);
}

function drawSky(ctx, W, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0e2338');
  g.addColorStop(1, '#2c5670');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);

  // Far treeline so the horizon is not a bare edge.
  ctx.fillStyle = '#132a20';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= W; x += 14) {
    const n = Math.sin(x * 0.031) * 6 + Math.sin(x * 0.011 + 2) * 9;
    ctx.lineTo(x, h - 16 - n);
  }
  ctx.lineTo(W, h);
  ctx.closePath();
  ctx.fill();
}

function drawWater(ctx, W, top, h, bottom, t) {
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0.00, '#1b6f8f');
  g.addColorStop(0.18, '#146079');
  g.addColorStop(0.45, '#0c4157');
  g.addColorStop(0.75, '#062a3b');
  g.addColorStop(1.00, '#02141f');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, h);

  // Surface chop.
  ctx.strokeStyle = 'rgba(190,235,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 6) {
    const y = top + Math.sin(x * 0.035 + t * 1.7) * 2.2 + Math.sin(x * 0.09 + t * 2.6) * 1.1;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Thermocline: the temperature break the deep fish sit under.
  if (bottom > 45) {
    const y = top + (Math.min(bottom * 0.42, 55) / bottom) * h;
    ctx.strokeStyle = 'rgba(160,220,255,0.13)';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Suspended particles drifting in the light.
  ctx.fillStyle = 'rgba(200,230,255,0.10)';
  for (let i = 0; i < 60; i++) {
    const px = ((i * 137.5) % W);
    const py = top + ((i * 71.3 + t * 8) % h);
    ctx.fillRect(px, py, 2, 2);
  }
}

function drawDepthRuler(ctx, W, top, h, bottom, game) {
  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  const step = bottom <= 40 ? 5 : bottom <= 120 ? 20 : 40;
  for (let ft = 0; ft <= bottom; ft += step) {
    const y = top + (ft / bottom) * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.fillStyle = 'rgba(200,225,240,0.45)';
    ctx.fillText(ft + ' ft', 6, y - 3);
  }

  // Mark where each angler runs out of line.
  for (let i = 0; i < 2; i++) {
    const a = game.anglers[i];
    const cap = REELS[a.reel].maxDepth;
    if (cap >= bottom) continue;
    const y = top + (cap / bottom) * h;
    ctx.strokeStyle = P_COLOR[i] + '55';
    ctx.setLineDash([7, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = P_COLOR[i] + 'aa';
    ctx.textAlign = 'right';
    ctx.fillText(`P${i + 1} line ends`, W - 8, y - 4);
    ctx.textAlign = 'left';
  }
}

function drawBottom(ctx, W, H, top, h, spot, t) {
  const baseY = top + h;
  ctx.fillStyle = '#06141c';
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let x = 0; x <= W; x += 10) {
    const n = Math.sin(x * 0.017) * 7 + Math.sin(x * 0.006 + 1.3) * 11;
    ctx.lineTo(x, baseY - 14 - n);
  }
  ctx.lineTo(W, baseY);
  ctx.closePath();
  ctx.fill();

  // A little structure so each spot reads differently.
  ctx.fillStyle = 'rgba(20,60,40,0.55)';
  if (spot.id === 'cove' || spot.id === 'flats') {
    for (let i = 0; i < 22; i++) {
      const x = (i * 61 + 30) % W;
      const hgt = 30 + ((i * 37) % 55);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + Math.sin(t + i) * 10, baseY - hgt / 2, x + Math.sin(t * 0.7 + i) * 6, baseY - hgt);
      ctx.lineTo(x + 5, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawAmbient(ctx, W, ftToY, t) {
  for (const f of ambient) {
    const x = f.x * W;
    const y = ftToY(f.depth) + Math.sin(f.bob) * 3;
    drawFish(ctx, x, y, 14 * f.scale, f.dir, f.sp, 0.32);
  }
}

/* A simple stylised fish: body, tail, fin, eye. */
function drawFish(ctx, x, y, len, dir, sp, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const hgt = len * 0.42;

  ctx.fillStyle = sp.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.5, hgt * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = sp.belly;
  ctx.beginPath();
  ctx.ellipse(0, hgt * 0.14, len * 0.42, hgt * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = sp.color;
  ctx.beginPath();
  ctx.moveTo(-len * 0.46, 0);
  ctx.lineTo(-len * 0.72, -hgt * 0.55);
  ctx.lineTo(-len * 0.72, hgt * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-len * 0.1, -hgt * 0.42);
  ctx.lineTo(len * 0.12, -hgt * 0.85);
  ctx.lineTo(len * 0.2, -hgt * 0.35);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#04121a';
  ctx.beginPath();
  ctx.arc(len * 0.3, -hgt * 0.12, Math.max(1, len * 0.045), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoat(ctx, W, skyH, t) {
  const cx = W * 0.5;
  const y = skyH + Math.sin(t * 1.4) * 2;

  ctx.fillStyle = '#2b2018';
  ctx.beginPath();
  ctx.moveTo(cx - 120, y - 14);
  ctx.lineTo(cx + 120, y - 14);
  ctx.lineTo(cx + 96, y + 6);
  ctx.lineTo(cx - 96, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3c2d21';
  ctx.fillRect(cx - 120, y - 18, 240, 5);

  // Two anglers, one at each gunwale, rods out over their own lane.
  for (let i = 0; i < 2; i++) {
    const px = i === 0 ? cx - 62 : cx + 62;
    ctx.fillStyle = P_COLOR[i];
    ctx.beginPath();
    ctx.arc(px, y - 42, 7, 0, Math.PI * 2);   // head
    ctx.fill();
    ctx.fillRect(px - 7, y - 34, 14, 20);      // body
    // Rod pointing towards the lane.
    const dir = i === 0 ? -1 : 1;
    ctx.strokeStyle = '#d8c9a8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, y - 30);
    ctx.quadraticCurveTo(px + dir * 40, y - 62, px + dir * 92, y - 52);
    ctx.stroke();
  }
}

function rodTip(W, skyH, i) {
  const cx = W * 0.5;
  const px = i === 0 ? cx - 62 : cx + 62;
  const dir = i === 0 ? -1 : 1;
  return { x: px + dir * 92, y: skyH - 52 };
}

function drawAnglerLine(ctx, W, H, skyH, ftToY, game, a, i, t) {
  const tip = rodTip(W, skyH, i);
  const laneX = W * LANE[i];
  const col = P_COLOR[i];

  if (a.phase === PHASE.IDLE || a.phase === PHASE.RESULT) {
    // Slack line hanging off the tip.
    ctx.strokeStyle = 'rgba(230,245,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.quadraticCurveTo(tip.x + (i ? 8 : -8), tip.y + 22, tip.x + (i ? 14 : -14), tip.y + 34);
    ctx.stroke();
    if (a.phase === PHASE.RESULT && a.result) drawResultCard(ctx, laneX, skyH + 90, a, col);
    if (a.assisting) drawAssist(ctx, laneX, skyH + 60, col);
    return;
  }

  if (a.phase === PHASE.AIMING) {
    drawCastMeter(ctx, laneX, skyH + 50, a, col);
    ctx.strokeStyle = 'rgba(230,245,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + (i ? 12 : -12), tip.y + 30); ctx.stroke();
    return;
  }

  // Lure position: cast distance pushes it out towards its lane.
  const lureY = ftToY(a.depth);
  const lureX = laneX;

  // Line from rod tip, with a bend proportional to load.
  const bend = a.phase === PHASE.FIGHT ? a.tension * 46 : 6;
  ctx.strokeStyle = a.phase === PHASE.FIGHT
    ? (a.tension > 0.82 ? '#ff6b5c' : a.tension > 0.6 ? '#ffd166' : 'rgba(235,250,255,0.8)')
    : 'rgba(235,250,255,0.6)';
  ctx.lineWidth = a.phase === PHASE.FIGHT ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  const midX = (tip.x + lureX) / 2 + (i ? bend : -bend) * 0.35;
  const midY = (tip.y + lureY) / 2;
  ctx.quadraticCurveTo(midX, midY, lureX, lureY);
  ctx.stroke();

  if (a.phase === PHASE.FIGHT && a.fish) {
    const f = a.fish;
    const size = 16 + Math.min(70, f.weight * 1.5);
    const shake = a.tension * 6;
    drawFish(ctx,
      lureX + Math.sin(t * 9) * shake,
      lureY + Math.cos(t * 7) * shake * 0.6,
      size, i ? 1 : -1, f.sp, 0.95);
    drawFightGauge(ctx, lureX, lureY - size * 0.5 - 26, a, col);
  } else {
    // The lure itself.
    const lure = LURES[a.lure];
    ctx.fillStyle = '#f2e6c8';
    ctx.strokeStyle = '#8f7a45';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(lureX, lureY, 3 + lure.size, 2 + lure.size * 0.6, 0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Action halo: the harder you work it, the more it calls fish in.
    if (a.action > 0.05) {
      ctx.strokeStyle = col + Math.round(Math.min(0.55, a.action * 0.4) * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 2;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(lureX, lureY, 8 + r * 9 * a.action, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (a.phase === PHASE.BITE) drawBiteAlert(ctx, lureX, lureY, a, col, t);
  }

  // Depth readout beside the lure.
  ctx.font = 'bold 12px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = col;
  ctx.textAlign = i ? 'left' : 'right';
  ctx.fillText(`${a.depth.toFixed(0)} ft`, lureX + (i ? 22 : -22), lureY + 4);
  ctx.textAlign = 'left';
}

function drawCastMeter(ctx, x, y, a, col) {
  const w = 150, h = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - w / 2 - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y, w * a.power, h);
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('RELEASE TO CAST', x, y - 8);
  ctx.textAlign = 'left';
}

function drawBiteAlert(ctx, x, y, a, col, t) {
  const pulse = 1 + Math.sin(t * 22) * 0.18;
  ctx.save();
  ctx.translate(x, y - 42);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', 0, 0);
  ctx.restore();

  const frac = Math.max(0, a.biteTimer / a.biteWindow);
  const w = 70;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - w / 2, y - 34, w, 6);
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(x - w / 2, y - 34, w * frac, 6);
  ctx.textAlign = 'left';
}

function drawFightGauge(ctx, x, y, a, col) {
  const f = a.fish;
  const w = 120;

  // Tension bar - the thing that will cost you the fish.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 27);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x - w / 2, y, w, 8);
  const tc = a.tension > 0.82 ? '#ff5c4d' : a.tension > 0.6 ? '#ffd166' : '#5ddc8a';
  ctx.fillStyle = tc;
  ctx.fillRect(x - w / 2, y, w * Math.min(1, a.tension), 8);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x - w / 2 + w * SAFE_TENSION, y - 2, 1.5, 12);

  // Line wear: damage already done, and it does not heal.
  const wear = Math.min(1, a.wear || 0);
  if (wear > 0.01) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x - w / 2, y + 9, w, 4);
    ctx.fillStyle = wear > 0.66 ? '#ff5c4d' : '#ffd166';
    ctx.fillRect(x - w / 2, y + 9, w * wear, 4);
  }

  // Remaining line to the boat.
  const prog = 1 - Math.min(1, f.distance / Math.max(1, f.startDistance));
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x - w / 2, y + 15, w, 6);
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y + 15, w * prog, 6);

  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.fillStyle = '#e8f4ff';
  ctx.textAlign = 'center';
  ctx.fillText(`${f.distance.toFixed(0)} ft out`, x, y - 6);
  ctx.textAlign = 'left';
}

function drawResultCard(ctx, x, y, a, col) {
  const r = a.result;
  const w = 220, h = 58;
  ctx.fillStyle = r.ok ? 'rgba(10,40,25,0.9)' : 'rgba(50,14,14,0.9)';
  ctx.strokeStyle = r.ok ? (r.isRecord ? '#ffd166' : '#5ddc8a') : '#ff5c4d';
  ctx.lineWidth = 2;
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.strokeRect(x - w / 2, y, w, h);
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = r.ok ? (r.isRecord ? '#ffd166' : '#8df0b0') : '#ff8f85';
  ctx.fillText(r.text, x, y + 22);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#dbe8f0';
  ctx.fillText(r.sub, x, y + 40);
  if (r.ok) {
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillStyle = '#8df0b0';
    ctx.fillText(`+$${r.value}`, x, y + 54);
  }
  ctx.textAlign = 'left';
}

function drawAssist(ctx, x, y, col) {
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = col;
  ctx.textAlign = 'center';
  ctx.fillText('NETTING FOR PARTNER', x, y);
  ctx.textAlign = 'left';
}

function drawRipples(ctx, top) {
  for (const r of ripples) {
    const k = 1 - r.life / r.max;
    ctx.strokeStyle = `rgba(220,245,255,${(1 - k) * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(r.x, top, 6 + k * 45, 2 + k * 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}
