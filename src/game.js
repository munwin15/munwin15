/* =====================================================================
   Deep Water Duo - game state and simulation
   ===================================================================== */

const PHASE = {
  IDLE:    'idle',     // on the boat, nothing in the water
  AIMING:  'aiming',   // holding the action key, power meter swinging
  SINKING: 'sinking',  // lure is in the water, working the depth
  BITE:    'bite',     // a fish has it, hookset window is open
  FIGHT:   'fight',    // hooked up
  RESULT:  'result',   // showing what you caught or lost
};

function makeAngler(index, name) {
  return {
    index, name,
    rod: 0, reel: 0, lure: 0,          // indexes into RODS / REELS / LURES
    owned: { rods: ['cane'], reels: ['spincast'], lures: ['worm'] },
    phase: PHASE.IDLE,
    power: 0, powerDir: 1,             // cast meter
    castDist: 0,                       // feet from the boat
    depth: 0,                          // how deep the lure is now
    action: 0,                         // jigging energy, decays constantly
    lastJig: 0,
    biteTimer: 0, biteWindow: 0,
    fish: null,
    tension: 0, overload: 0,
    resultTimer: 0, result: null,
    assisting: false,                  // helping the partner land theirs
    hadAssist: false, hadPartnerOn: false,  // co-op bonuses latched per fight
    xp: 0, level: 1,
    caught: 0, lost: 0, heaviest: 0,
    streak: 0,
  };
}

function newGame() {
  return {
    cash: 0,
    spot: 0,
    anglers: [makeAngler(0, 'Player 1'), makeAngler(1, 'Player 2')],
    records: {},        // speciesId -> { weight, length, by, spot }
    log: [],
    totalCaught: 0,
    totalEarned: 0,
    doubleHeaders: 0,
    assists: 0,
    time: 0,
  };
}

/* --------------------------------------------------------------- */
/* Gear helpers                                                     */
/* --------------------------------------------------------------- */
const rodOf  = a => RODS[a.rod];
const reelOf = a => REELS[a.reel];
const lureOf = a => LURES[a.lure];

/* How deep this angler can physically fish right now: limited by the
   spool of line on the reel and by the lake bottom at this spot. */
function maxDepthFor(game, a) {
  return Math.min(reelOf(a).maxDepth, SPOTS[game.spot].bottom);
}

/* The deepest spot the crew can reach. Travel is shared, so the better
   equipped angler can drag the whole boat somewhere new. */
function canTravel(game, spotIndex) {
  const best = Math.max(...game.anglers.map(a => reelOf(a).maxDepth));
  return best >= SPOTS[spotIndex].needDepth;
}

function levelFor(xp) { return Math.max(1, Math.floor(Math.sqrt(xp / 55)) + 1); }
function rankName(level) { return RANKS[Math.min(RANKS.length - 1, level - 1)]; }

/* --------------------------------------------------------------- */
/* Bite model                                                       */
/* --------------------------------------------------------------- */
/* Score how interested one species is in what this angler is doing.
   Returns bites per second. Zero means it is not even a candidate. */
function biteRate(game, a, sp, atDepth) {
  const spot = SPOTS[game.spot];
  const lure = lureOf(a);
  const d = atDepth === undefined ? a.depth : atDepth;

  // The fish has to actually live at this depth, in this lake bottom.
  if (d < sp.min || d > sp.max) return 0;
  if (sp.min > spot.bottom) return 0;

  // Lure size gates. Too small and the fish ignores it, far too big and
  // the little ones cannot get their mouth around it.
  if (lure.size < sp.minLure) return 0;
  let sizeFit = 1;
  const over = lure.size - sp.minLure;
  if (over >= 3) sizeFit = 0.18;
  else if (over === 2) sizeFit = 0.55;

  // Does the lure speak this fish's language?
  const match = lure.tags.some(t => sp.tags.includes(t));
  const lureFit = match ? 1 : 0.22;

  // Presenting the lure outside its working depth kills the action.
  const inBand = d >= lure.min && d <= lure.max;
  const bandFit = inBand ? 1 : 0.3;

  // Fish hold tighter to their preferred depth than to the edges.
  const mid = (sp.min + sp.max) / 2;
  const half = Math.max(1, (sp.max - sp.min) / 2);
  const depthFit = 0.45 + 0.55 * (1 - Math.min(1, Math.abs(d - mid) / half));

  // Working the rod is what triggers the strike.
  const actionMul = 0.35 + a.action * lure.action * 1.3;

  const rarity = sp.rarity / 100;
  return 0.085 * rarity * sizeFit * lureFit * bandFit * depthFit * actionMul;
}

function candidateBites(game, a) {
  return SPECIES.map(sp => ({ sp, rate: biteRate(game, a, sp) }))
    .filter(c => c.rate > 0)
    .sort((x, y) => y.rate - x.rate);
}

/* Everything this rig could catch somewhere in the water column here,
   with the depth that gives the best odds. Drives the HUD readout so
   players can see why a lure or a reel upgrade matters. */
function surveySpecies(game, a) {
  const maxD = maxDepthFor(game, a);
  const step = Math.max(0.5, maxD / 80);
  const out = [];
  for (const sp of SPECIES) {
    let best = 0, bestDepth = 0;
    for (let d = 0; d <= maxD; d += step) {
      const r = biteRate(game, a, sp, d);
      if (r > best) { best = r; bestDepth = d; }
    }
    if (best > 0) out.push({ sp, rate: best, depth: bestDepth });
  }
  return out.sort((x, y) => y.rate - x.rate);
}

function rollBite(game, a, dt) {
  const cands = candidateBites(game, a);
  const total = cands.reduce((s, c) => s + c.rate, 0);
  if (total <= 0) return null;
  if (Math.random() > 1 - Math.exp(-total * dt)) return null;
  let r = Math.random() * total;
  for (const c of cands) { r -= c.rate; if (r <= 0) return c.sp; }
  return cands[cands.length - 1].sp;
}

/* --------------------------------------------------------------- */
/* Hooking a fish                                                   */
/* --------------------------------------------------------------- */
function makeFish(sp, a) {
  // Weight is skewed towards the small end, with a long tail so the
  // occasional giant shows up and tests your gear.
  const roll = Math.pow(Math.random(), 2.1);
  const weight = sp.wMin + (sp.wMax - sp.wMin) * roll;
  const sizeMul = 0.6 + 0.8 * roll;
  const stam = sp.stam * (0.75 + 0.5 * roll);
  return {
    sp, weight, sizeMul,
    length: lengthFor(sp, weight),
    stamina: stam, maxStamina: stam,
    distance: Math.max(22, a.castDist * 0.6 + a.depth * 0.55),
    startDistance: 0,
    surge: 0, surgeTimer: 1 + Math.random() * 2,
    phase: Math.random() * 6.28,
  };
}

/* Pounds of pull the fish is putting on the rod right now. */
function fishPull(f) {
  const fatigue = 0.3 + 0.7 * (f.stamina / f.maxStamina);
  const wobble = 1 + 0.18 * Math.sin(f.phase);
  return f.sp.str * f.sizeMul * fatigue * wobble * (1 + f.surge);
}

/* --------------------------------------------------------------- */
/* The fight                                                        */
/* --------------------------------------------------------------- */
function stepFight(game, a, dt, input, partner) {
  const f = a.fish;
  const rod = rodOf(a), reel = reelOf(a);

  f.phase += dt * 3.2;
  f.surgeTimer -= dt;
  if (f.surgeTimer <= 0) {
    // A fresh fish makes hard runs. A tired one mostly sulks.
    const energy = f.stamina / f.maxStamina;
    f.surge = Math.random() < 0.45 * energy + 0.1 ? 0.35 + Math.random() * 0.55 * energy : 0;
    f.surgeTimer = 0.8 + Math.random() * 2.2;
  }
  f.surge = Math.max(0, f.surge - dt * 0.55);

  const reeling = input.action;
  // A partner with nothing in the water can grab the net and take some
  // of the load off. This is the co-op payoff.
  const assisted = !!(partner && partner.phase === PHASE.IDLE && partner.assisting);

  // Latch both co-op states so they still count at the moment of landing,
  // even if the partner boated their own fish a second earlier.
  if (assisted) a.hadAssist = true;
  if (partner && partner.phase === PHASE.FIGHT) a.hadPartnerOn = true;

  const pull = fishPull(f);
  const load = pull + (reeling ? 1.2 + 0.5 * pull : 0);
  const target = load / rod.power;

  // Drag smooths the climb and gives it back when you stop cranking.
  const riseRate = (2.4 - reel.drag) * (assisted ? 0.6 : 1);
  const fallRate = 0.55 + reel.drag * 1.4;
  if (target > a.tension) a.tension = Math.min(target, a.tension + riseRate * dt);
  else a.tension = Math.max(target, a.tension - fallRate * dt);

  // Line management. Crank and you gain, but a hot fish takes it back.
  const speed = reel.retrieve * 6.5 * (assisted ? 1.25 : 1);
  if (reeling) f.distance -= speed * (1 - 0.55 * a.tension) * dt;
  else         f.distance += pull * 0.085 * (1 - reel.drag * 0.4) * dt;
  f.distance = Math.min(f.distance, a.castDist + a.depth + 40);

  // Fish tires from fighting the drag, plus a little just from swimming.
  const drain = (3.2 + a.tension * (reeling ? 20 : 9)) * (assisted ? 1.2 : 1);
  f.stamina = Math.max(0, f.stamina - drain * dt);

  // Too much tension for too long and the line lets go.
  if (a.tension >= 1) {
    a.overload += dt;
    if (a.overload > 0.85) { breakOff(game, a, partner, assisted); return; }
  } else {
    a.overload = Math.max(0, a.overload - dt * 1.6);
  }

  if (f.distance <= 0) land(game, a, partner, assisted);
}

function breakOff(game, a, partner, assisted) {
  const f = a.fish;
  a.phase = PHASE.RESULT;
  a.result = { ok: false, fish: f, text: 'LINE SNAPPED', sub: `${f.sp.name}, about ${f.weight.toFixed(1)} lb` };
  a.resultTimer = 2.6;
  a.lost++; a.streak = 0; a.tension = 0; a.overload = 0; a.fish = null;
  a.hadAssist = false; a.hadPartnerOn = false;
  if (partner) partner.assisting = false;
  logLine(game, `${a.name} lost a ${f.weight.toFixed(1)} lb ${f.sp.name} - line snapped.`, 'bad');
}

function land(game, a, partner, assisted) {
  const f = a.fish, sp = f.sp;

  // Both rods bent at once pays a crew bonus to both anglers, but only
  // counts as one double header on the tally.
  const doubleHeader = a.hadPartnerOn;
  const netted = assisted || a.hadAssist;
  let mult = 1;
  if (doubleHeader) { mult += 0.25; if (partner && partner.phase === PHASE.FIGHT) game.doubleHeaders++; }
  if (netted)       { mult += 0.15; game.assists++; }
  if (a.streak >= 3) mult += Math.min(0.2, 0.05 * (a.streak - 2));

  // Records pay a bounty, so chasing a personal best is worth it.
  const prev = game.records[sp.id];
  const isRecord = !prev || f.weight > prev.weight;
  // Hard-to-find fish carry a scarcity premium on top of their price per pound.
  const scarcity = sp.rarity < 10 ? 1.6 : sp.rarity < 25 ? 1.25 : 1;
  const base = f.weight * sp.ppl * scarcity;
  const value = Math.round(base * mult * (isRecord ? 1.5 : 1)) + 10;

  game.cash += value;
  game.totalEarned += value;
  game.totalCaught++;
  a.caught++; a.streak++;
  a.heaviest = Math.max(a.heaviest, f.weight);
  a.xp += Math.max(4, Math.round(value / 6));
  a.level = levelFor(a.xp);

  if (isRecord) {
    game.records[sp.id] = { weight: f.weight, length: f.length, by: a.name, spot: SPOTS[game.spot].name };
  }
  if (netted && partner) {
    const cut = Math.max(3, Math.round(value * 0.15));
    partner.xp += Math.max(2, Math.round(cut / 4));
    partner.level = levelFor(partner.xp);
    partner.assisting = false;
  }

  a.phase = PHASE.RESULT;
  a.result = {
    ok: true, fish: f, value, isRecord, doubleHeader, assisted: netted,
    text: isRecord ? 'NEW RECORD!' : 'FISH ON THE BOAT',
    sub: `${sp.name} - ${f.weight.toFixed(1)} lb, ${f.length.toFixed(0)} in`,
  };
  a.resultTimer = 3.0;
  a.tension = 0; a.overload = 0; a.fish = null;
  a.hadAssist = false; a.hadPartnerOn = false;

  let msg = `${a.name} landed a ${f.weight.toFixed(1)} lb ${sp.name} (+$${value})`;
  if (isRecord) msg += ' - lake record!';
  if (doubleHeader) msg += ' [double header]';
  if (netted) msg += ' [netted by partner]';
  logLine(game, msg, isRecord ? 'record' : 'good');
}

/* --------------------------------------------------------------- */
/* Per-angler update                                                */
/* --------------------------------------------------------------- */
function stepAngler(game, a, dt, input, partner) {
  const reel = reelOf(a), rod = rodOf(a), lure = lureOf(a);
  const maxD = maxDepthFor(game, a);

  switch (a.phase) {
    case PHASE.IDLE: {
      // Idle anglers can hold their action key to net a partner's fish.
      a.assisting = input.action && partner && partner.phase === PHASE.FIGHT;
      if (input.actionPressed && !a.assisting) {
        a.phase = PHASE.AIMING; a.power = 0; a.powerDir = 1;
      }
      break;
    }

    case PHASE.AIMING: {
      a.power += a.powerDir * dt * 1.55;
      if (a.power >= 1) { a.power = 1; a.powerDir = -1; }
      if (a.power <= 0) { a.power = 0; a.powerDir = 1; }
      if (!input.action) {
        a.castDist = Math.round(6 + rod.cast * a.power);
        a.depth = 0; a.action = 0.35;
        a.phase = PHASE.SINKING;
      }
      break;
    }

    case PHASE.SINKING: {
      // Depth control. Sink with down, crank back up with up.
      // Heavier lures punch down faster - that is why the deep spots
      // want the big metal, not a worm.
      const sinkRate = 9 + lure.size * 4.5;
      if (input.down)    a.depth += sinkRate * dt;
      else if (input.up) a.depth -= reel.retrieve * 9 * dt;
      else               a.depth += sinkRate * 0.35 * dt;
      a.depth = Math.max(0, Math.min(maxD, a.depth));

      // Working the rod builds action, which is what draws strikes.
      a.action = Math.max(0, a.action - dt * 0.85);
      if (input.actionPressed) a.action = Math.min(1.6, a.action + 0.42);

      // Reel all the way back to the boat to pick a new spot or lure.
      if (a.depth <= 0 && input.up) { a.phase = PHASE.IDLE; a.action = 0; break; }

      const sp = rollBite(game, a, dt);
      if (sp) {
        a.fish = makeFish(sp, a);
        a.fish.startDistance = a.fish.distance;
        a.biteWindow = 0.42 + rod.sensitivity * 0.75;
        a.biteTimer = a.biteWindow;
        a.phase = PHASE.BITE;
        if (window.blip) window.blip('bite');
      }
      break;
    }

    case PHASE.BITE: {
      a.biteTimer -= dt;
      if (input.actionPressed) {
        a.phase = PHASE.FIGHT; a.tension = 0.25; a.overload = 0;
        a.hadAssist = false; a.hadPartnerOn = false;
        if (window.blip) window.blip('hookup');
      } else if (a.biteTimer <= 0) {
        const sp = a.fish.sp;
        a.fish = null; a.phase = PHASE.SINKING; a.action = 0.2; a.streak = 0;
        logLine(game, `${a.name} was slow on the hookset - the ${sp.name} spat it.`, 'bad');
      }
      break;
    }

    case PHASE.FIGHT:
      stepFight(game, a, dt, input, partner);
      break;

    case PHASE.RESULT: {
      a.resultTimer -= dt;
      if (a.resultTimer <= 0 || input.actionPressed) {
        a.phase = PHASE.IDLE; a.result = null; a.depth = 0; a.action = 0;
      }
      break;
    }
  }
}

function logLine(game, text, kind) {
  game.log.unshift({ text, kind, t: game.time });
  if (game.log.length > 60) game.log.pop();
}
