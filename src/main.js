/* =====================================================================
   Deep Water Duo - input, main loop and persistence
   ===================================================================== */

const KEYS = [
  { up: 'KeyW',    down: 'KeyS',      action: 'Space',      tab: 'KeyQ',   shop: 'KeyE',
    label: { up: 'W', down: 'S', action: 'SPACE', tab: 'Q', shop: 'E' } },
  { up: 'ArrowUp', down: 'ArrowDown', action: 'Enter',      tab: 'Slash',  shop: 'ShiftRight',
    label: { up: '↑', down: '↓', action: 'ENTER', tab: '/', shop: 'R-SHIFT' } },
];

const held = new Set();
const pressed = new Set();
let game = newGame();
const shops = [makeShopState(), makeShopState()];
let started = false;

/* --------------------------------------------------------------- */
/* Input                                                            */
/* --------------------------------------------------------------- */
const WATCHED = new Set(KEYS.flatMap(k => [k.up, k.down, k.action, k.tab, k.shop]));

addEventListener('keydown', e => {
  if (WATCHED.has(e.code)) e.preventDefault();
  if (!started) { started = true; document.getElementById('splash').style.display = 'none'; }
  if (e.repeat) return;
  if (WATCHED.has(e.code)) { held.add(e.code); pressed.add(e.code); }
  if (e.code === 'KeyR' && e.shiftKey) resetGame();
});

addEventListener('keyup', e => { held.delete(e.code); });
addEventListener('blur', () => held.clear());

function readInput(i) {
  const k = KEYS[i];
  return {
    up: held.has(k.up),
    down: held.has(k.down),
    action: held.has(k.action),
    upPressed: pressed.has(k.up),
    downPressed: pressed.has(k.down),
    actionPressed: pressed.has(k.action),
    tabPressed: pressed.has(k.tab),
    shopPressed: pressed.has(k.shop),
  };
}

/* --------------------------------------------------------------- */
/* Audio - a few short synthesised blips, no asset files needed     */
/* --------------------------------------------------------------- */
let actx = null;
window.blip = function (kind) {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    const now = actx.currentTime;
    const cfg = {
      bite:   { f: 880, to: 1320, d: 0.16, v: 0.16, type: 'square'   },
      hookup: { f: 420, to:  180, d: 0.22, v: 0.18, type: 'sawtooth' },
      buy:    { f: 660, to:  990, d: 0.14, v: 0.13, type: 'triangle' },
      snap:   { f: 300, to:   60, d: 0.30, v: 0.20, type: 'sawtooth' },
    }[kind] || { f: 500, to: 500, d: 0.1, v: 0.1, type: 'sine' };
    o.type = cfg.type;
    o.frequency.setValueAtTime(cfg.f, now);
    o.frequency.exponentialRampToValueAtTime(cfg.to, now + cfg.d);
    g.gain.setValueAtTime(cfg.v, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + cfg.d);
    o.connect(g); g.connect(actx.destination);
    o.start(now); o.stop(now + cfg.d + 0.02);
  } catch (_) { /* audio is a nicety, never a crash */ }
};

/* --------------------------------------------------------------- */
/* Persistence                                                      */
/* --------------------------------------------------------------- */
const SAVE_KEY = 'deepwaterduo.v1';

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash, spot: game.spot, records: game.records,
      totalCaught: game.totalCaught, totalEarned: game.totalEarned,
      doubleHeaders: game.doubleHeaders, assists: game.assists,
      charters: game.charters, chartersDone: game.chartersDone,
      anglers: game.anglers.map(a => ({
        rod: a.rod, reel: a.reel, lure: a.lure, owned: a.owned,
        xp: a.xp, level: a.level, caught: a.caught, lost: a.lost, heaviest: a.heaviest,
      })),
    }));
  } catch (_) { /* file:// with storage disabled - just play unsaved */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    Object.assign(game, {
      cash: d.cash | 0, spot: d.spot | 0, records: d.records || {},
      totalCaught: d.totalCaught | 0, totalEarned: d.totalEarned | 0,
      doubleHeaders: d.doubleHeaders | 0, assists: d.assists | 0,
      charters: d.charters || [], chartersDone: d.chartersDone | 0,
    });
    (d.anglers || []).forEach((s, i) => {
      const a = game.anglers[i];
      if (!a) return;
      Object.assign(a, {
        rod: s.rod | 0, reel: s.reel | 0, lure: s.lure | 0,
        owned: s.owned || a.owned, xp: s.xp | 0, level: s.level || 1,
        caught: s.caught | 0, lost: s.lost | 0, heaviest: s.heaviest || 0,
      });
    });
  } catch (_) { /* corrupt save - start fresh rather than blow up */ }
}

function resetGame() {
  if (!confirm('Wipe the boat log and start over?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  game = newGame();
  seedAmbient(game);
  initCharters(game);
  logLine(game, 'A fresh season. The cane poles are back in the boat.', 'info');
}

/* --------------------------------------------------------------- */
/* Loop                                                             */
/* --------------------------------------------------------------- */
const canvas = document.getElementById('lake');
const ctx = canvas.getContext('2d');
const el = {
  top:     document.getElementById('topbar'),
  hud:    [document.getElementById('hud0'), document.getElementById('hud1')],
  shop:   [document.getElementById('shop0'), document.getElementById('shop1')],
  log:     document.getElementById('log'),
  records: document.getElementById('records'),
  charters: document.getElementById('charters'),
};

function fit() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', fit);

let last = performance.now(), saveTimer = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(0.05, dt);          // a long tab-out must not teleport the sim
  game.time += dt;

  for (let i = 0; i < 2; i++) {
    const a = game.anglers[i], shop = shops[i], input = readInput(i);
    const partner = game.anglers[1 - i];

    if (shop.flashT > 0) shop.flashT -= dt;

    // The shop is only reachable with a slack line.
    const busy = a.phase === PHASE.FIGHT || a.phase === PHASE.BITE || a.phase === PHASE.AIMING;
    if (input.shopPressed && (!busy || shop.open)) shop.open = !shop.open;

    if (shop.open) {
      const rows = shopRows(game, a, shop.tab);
      if (input.upPressed)   shop.index = (shop.index - 1 + rows.length) % rows.length;
      if (input.downPressed) shop.index = (shop.index + 1) % rows.length;
      if (input.tabPressed)  { shop.tab = (shop.tab + 1) % TABS.length; shop.index = 0; }
      if (input.actionPressed) shopConfirm(game, a, shop);
    } else {
      // Quick lure swap from the boat without opening the shop.
      if (input.tabPressed && a.phase === PHASE.IDLE) cycleLure(a);
      const before = a.phase;
      stepAngler(game, a, dt, input, partner);
      if (before === PHASE.FIGHT && a.phase === PHASE.RESULT && a.result && !a.result.ok) window.blip('snap');
      if (before === PHASE.AIMING && a.phase === PHASE.SINKING) {
        addRipple(canvas.getBoundingClientRect().width * LANE[i], 0);
      }
    }
  }

  updateAmbient(dt);

  const r = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, r.width, r.height);
  draw(ctx, r.width, r.height, game, game.time);

  renderTopBar(el.top, game);
  for (let i = 0; i < 2; i++) {
    renderHud(el.hud[i], game, game.anglers[i], i);
    renderShop(el.shop[i], game, game.anglers[i], shops[i], KEYS[i].label);
  }
  renderLog(el.log, game);
  renderCharters(el.charters, game);
  const chc = document.getElementById('chcount');
  if (chc) chc.textContent = game.chartersDone ? `${game.chartersDone} done` : '';
  renderRecords(el.records, game);

  saveTimer += dt;
  if (saveTimer > 5) { saveTimer = 0; save(); }

  pressed.clear();
  requestAnimationFrame(frame);
}

/* Cycle only through lures the angler actually owns. */
function cycleLure(a) {
  const ownedIdx = LURES.map((l, i) => i).filter(i => a.owned.lures.includes(LURES[i].id));
  if (ownedIdx.length < 2) return;
  const at = ownedIdx.indexOf(a.lure);
  a.lure = ownedIdx[(at + 1) % ownedIdx.length];
}

/* --------------------------------------------------------------- */
load();
fit();
seedAmbient(game);
if (!game.charters || !game.charters.length) initCharters(game);
if (!game.log.length) {
  logLine(game, 'Morning on the lake. Two rods, one boat, one wallet.', 'info');
}
addEventListener('beforeunload', save);
requestAnimationFrame(frame);
