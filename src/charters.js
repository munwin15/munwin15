/* =====================================================================
   Deep Water Duo - charter board
   Three shared jobs at a time, taken by the crew rather than by one
   angler. They give the boat a reason to go somewhere specific instead
   of parking on the highest paying fish, and they keep paying out after
   the last reel has been bought.
   ===================================================================== */

const CHARTER_KINDS = ['count', 'trophy', 'variety', 'spot', 'teamwork'];

/* What the crew can plausibly catch with what they own and where they
   can sail. Charters are only ever drawn from this, so the board can
   never ask for a fish that is out of reach. */
function reachableSpecies(game) {
  const reach = Math.max(...game.anglers.map(a => REELS[a.reel].maxDepth));
  const ownedLures = new Set(game.anglers.flatMap(a => a.owned.lures));
  const biggestLure = Math.max(...LURES.filter(l => ownedLures.has(l.id)).map(l => l.size));
  const deepestSpot = Math.max(...SPOTS.filter((s, i) => canTravel(game, i)).map(s => s.bottom));
  const ceiling = Math.min(reach, deepestSpot);
  return SPECIES.filter(sp => sp.min <= ceiling && sp.minLure <= biggestLure);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* The average fish the crew is actually pulling in right now, in dollars.
   Every reward is a multiple of this, so a charter is a bonus on top of
   fishing rather than a replacement for it. */
function crewUnitValue(game) {
  const pool = reachableSpecies(game);
  if (!pool.length) return 20;
  let num = 0, den = 0;
  for (const sp of pool) {
    const w = sp.wMin + (sp.wMax - sp.wMin) * 0.35;   // catches skew small
    num += sp.rarity * dockValue(sp, w);
    den += sp.rarity;
  }
  return Math.max(15, num / den);
}

function rollCharter(game, avoid) {
  const pool = reachableSpecies(game);
  if (!pool.length) return null;
  const unit = crewUnitValue(game);
  const kinds = CHARTER_KINDS.filter(k => !avoid || !avoid.includes(k));
  const kind = pick(kinds.length ? kinds : CHARTER_KINDS);

  switch (kind) {
    case 'count': {
      const sp = pick(pool);
      const n = 3 + Math.floor(Math.random() * 4);
      const each = dockValue(sp, sp.wMin + (sp.wMax - sp.wMin) * 0.35);
      return mk(kind, `Land ${n} ${sp.name}`, n, each * n * 0.6, { species: sp.id });
    }
    case 'trophy': {
      // Ask for a fish in the upper part of the species' range, so it is a
      // real hunt but not a freak.
      const sp = pick(pool);
      const target = +(sp.wMin + (sp.wMax - sp.wMin) * 0.62).toFixed(1);
      return mk(kind, `Land a ${sp.name} over ${target} lb`, 1,
                dockValue(sp, target) * 1.2, { species: sp.id, minWeight: target });
    }
    case 'variety': {
      const n = Math.min(pool.length, 3 + Math.floor(Math.random() * 3));
      return mk(kind, `Land ${n} different species`, n, unit * n * 0.8, { seen: [] });
    }
    case 'spot': {
      const options = SPOTS.map((s, i) => i).filter(i => canTravel(game, i));
      const si = pick(options);
      // This one ticks along while you fish normally, so it asks for more
      // and pays less per fish than the charters you have to aim at.
      const n = 8 + Math.floor(Math.random() * 7);
      return mk(kind, `Land ${n} fish at ${SPOTS[si].name}`, n, unit * n * 0.45, { spot: si });
    }
    case 'teamwork': {
      const double = Math.random() < 0.5;
      const n = 2 + Math.floor(Math.random() * 2);
      return double
        ? mk(kind, `Pull off ${n} double headers`, n, unit * n * 1.6, { double: true })
        : mk(kind, `Land ${n} fish with your partner on the net`, n, unit * n * 1.3, { netted: true });
    }
  }
}

function mk(kind, text, target, reward, data) {
  return { kind, text, target, progress: 0, reward: Math.max(25, Math.round(reward)), ...data,
           id: kind + '-' + Math.random().toString(36).slice(2, 8) };
}

function initCharters(game) {
  game.charters = [];
  for (let i = 0; i < 3; i++) {
    const c = rollCharter(game, game.charters.map(x => x.kind));
    if (c) game.charters.push(c);
  }
}

/* Called once for every fish that reaches the boat. */
function checkCharters(game, a, f, ctx) {
  if (!game.charters) return;
  for (let i = 0; i < game.charters.length; i++) {
    const c = game.charters[i];
    let hit = false;

    switch (c.kind) {
      case 'count':
        if (c.species === f.sp.id) hit = true;
        break;
      case 'trophy':
        if (c.species === f.sp.id && f.weight >= c.minWeight) hit = true;
        break;
      case 'variety':
        if (!c.seen.includes(f.sp.id)) { c.seen.push(f.sp.id); hit = true; }
        break;
      case 'spot':
        if (c.spot === game.spot) hit = true;
        break;
      case 'teamwork':
        if (c.double && ctx.doubleHeader) hit = true;
        if (c.netted && ctx.netted) hit = true;
        break;
    }
    if (!hit) continue;

    c.progress++;
    if (c.progress >= c.target) {
      // A charter is crew work - both anglers' catches count towards it -
      // so the fee is split down the middle rather than paid to whoever
      // happened to land the last fish.
      const share = Math.round(c.reward / game.anglers.length);
      for (const angler of game.anglers) { angler.cash += share; angler.earned += share; }
      game.totalEarned += share * game.anglers.length;
      game.chartersDone = (game.chartersDone || 0) + 1;
      logLine(game, `Charter complete: ${c.text} (+$${share} each)`, 'record');
      const fresh = rollCharter(game, game.charters.filter(x => x !== c).map(x => x.kind));
      if (fresh) game.charters[i] = fresh; else game.charters.splice(i--, 1);
      if (window.blip) window.blip('buy');
    }
  }
}

function renderCharters(el, game) {
  if (!game.charters || !game.charters.length) {
    el.innerHTML = '<div class="empty">No charters on the board.</div>';
    return;
  }
  el.innerHTML = game.charters.map(c => {
    const pct = Math.min(100, (c.progress / c.target) * 100);
    return `<div class="ch">
      <div class="chtop">
        <span class="cht">${c.text}</span>
        <span class="chp">${c.progress}/${c.target}</span>
        <span class="chr">$${c.reward}</span>
      </div>
      <div class="chbar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
}
