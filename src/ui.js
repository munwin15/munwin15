/* =====================================================================
   Deep Water Duo - HUD, shop and travel menu
   The shop is keyboard driven so both players can browse at once,
   each with their own keys, without fighting over a mouse.
   ===================================================================== */

const TABS = ['RODS', 'REELS', 'LURES', 'TRAVEL'];

function makeShopState() { return { open: false, tab: 0, index: 0, flash: '', flashT: 0 }; }

/* What is listed under the current tab for this angler. */
function shopRows(game, a, tab) {
  switch (TABS[tab]) {
    case 'RODS':  return RODS.map((r, i)  => rowGear(game, a, r, i, 'rods',  a.rod));
    case 'REELS': return REELS.map((r, i) => rowGear(game, a, r, i, 'reels', a.reel));
    case 'LURES': return LURES.map((r, i) => rowGear(game, a, r, i, 'lures', a.lure));
    case 'TRAVEL':return SPOTS.map((s, i) => {
      const reachable = canTravel(game, i);
      const here = game.spot === i;
      return {
        id: s.id, name: s.name, price: 0, obj: s, kind: 'travel', idx: i,
        state: here ? 'here' : reachable ? 'go' : 'locked',
        note: here ? 'anchored here'
            : reachable ? `${s.bottom} ft to the bottom`
            : `needs ${s.needDepth} ft of line on a reel`,
        blurb: s.blurb,
      };
    });
  }
  return [];
}

function rowGear(game, a, item, i, bucket, equippedIdx) {
  const owned = a.owned[bucket].includes(item.id);
  const equipped = equippedIdx === i;
  return {
    id: item.id, name: item.name, price: item.price, obj: item, kind: bucket, idx: i,
    state: equipped ? 'equipped' : owned ? 'owned' : (game.cash >= item.price ? 'buy' : 'poor'),
    note: gearNote(item, bucket),
    blurb: item.blurb,
  };
}

function gearNote(item, bucket) {
  if (bucket === 'rods')  return `power ${item.power} lb · sens ${(item.sensitivity * 100) | 0}% · cast ${item.cast} ft`;
  if (bucket === 'reels') return `line ${item.maxDepth} ft · retrieve ${item.retrieve.toFixed(1)} · drag ${(item.drag * 100) | 0}%`;
  return `depth ${item.min}-${item.max} ft · size ${item.size} · ${item.tags.join(', ')}`;
}

/* Act on the highlighted row. */
function shopConfirm(game, a, shop) {
  const rows = shopRows(game, a, shop.tab);
  const row = rows[shop.index];
  if (!row) return;

  if (row.kind === 'travel') {
    if (row.state === 'locked') return flash(shop, 'You need a bigger reel to reach that water.');
    if (row.state === 'here')   return flash(shop, 'Already anchored here.');
    const busy = game.anglers.find(x => x.phase !== PHASE.IDLE && x.phase !== PHASE.RESULT);
    if (busy) return flash(shop, `${busy.name} still has a line in the water.`);
    game.spot = row.idx;
    for (const x of game.anglers) { x.depth = 0; x.action = 0; }
    seedAmbient(game);
    logLine(game, `The crew moved to ${SPOTS[row.idx].name}.`, 'info');
    return flash(shop, `Anchored at ${SPOTS[row.idx].name}.`);
  }

  if (row.state === 'equipped') return;
  if (row.state === 'owned') { equip(a, row); return flash(shop, `${row.name} equipped.`); }
  if (row.state === 'poor')  return flash(shop, `Short $${row.price - game.cash}.`);

  game.cash -= row.price;
  a.owned[row.kind].push(row.id);
  equip(a, row);
  logLine(game, `${a.name} bought the ${row.name} for $${row.price}.`, 'info');
  flash(shop, `Bought ${row.name}!`);
  if (window.blip) window.blip('buy');
}

function equip(a, row) {
  if (row.kind === 'rods')  a.rod  = row.idx;
  if (row.kind === 'reels') a.reel = row.idx;
  if (row.kind === 'lures') a.lure = row.idx;
}

function flash(shop, msg) { shop.flash = msg; shop.flashT = 2.2; }

/* --------------------------------------------------------------- */
/* Rendering the shop panel                                         */
/* --------------------------------------------------------------- */
function renderShop(el, game, a, shop, keys) {
  if (!shop.open) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const rows = shopRows(game, a, shop.tab);
  shop.index = Math.max(0, Math.min(rows.length - 1, shop.index));
  const sel = rows[shop.index];

  const tabs = TABS.map((t, i) =>
    `<span class="tab ${i === shop.tab ? 'on' : ''}">${t}</span>`).join('');

  const list = rows.map((r, i) => {
    const cls = ['row', i === shop.index ? 'sel' : '', r.state].join(' ');
    let right;
    if (r.kind === 'travel') {
      right = r.state === 'here' ? 'HERE' : r.state === 'go' ? 'TRAVEL' : 'LOCKED';
    } else {
      right = r.state === 'equipped' ? 'EQUIPPED'
            : r.state === 'owned'    ? 'OWNED'
            : r.price === 0 ? 'FREE' : '$' + r.price.toLocaleString();
    }
    return `<div class="${cls}"><span class="nm">${r.name}</span><span class="rt">${right}</span></div>`;
  }).join('');

  el.innerHTML = `
    <div class="shop-head">
      <b>${a.name}</b> · ${rankName(a.level)} lvl ${a.level}
      <span class="tabs">${tabs}</span>
    </div>
    <div class="shop-list">${list}</div>
    <div class="shop-detail">
      <div class="dnote">${sel ? sel.note : ''}</div>
      <div class="dblurb">${sel ? sel.blurb : ''}</div>
      ${shop.flashT > 0 ? `<div class="dflash">${shop.flash}</div>` : ''}
    </div>
    <div class="shop-keys">${keys.up}/${keys.down} move · ${keys.tab} tab · ${keys.action} select · ${keys.shop} close</div>
  `;
}

/* --------------------------------------------------------------- */
/* HUD                                                              */
/* --------------------------------------------------------------- */
function renderHud(el, game, a, i) {
  const rod = RODS[a.rod], reel = REELS[a.reel], lure = LURES[a.lure];
  const maxD = maxDepthFor(game, a);

  let status, statusCls = '';
  switch (a.phase) {
    case PHASE.IDLE:    status = a.assisting ? 'netting for partner' : 'ready to cast'; break;
    case PHASE.AIMING:  status = 'winding up...'; break;
    case PHASE.SINKING: status = `fishing at ${a.depth.toFixed(0)} ft`; break;
    case PHASE.BITE:    status = 'FISH ON IT - SET THE HOOK'; statusCls = 'alert'; break;
    case PHASE.FIGHT:   status = `fighting a ${a.fish.sp.name}`; statusCls = 'fight'; break;
    case PHASE.RESULT:  status = a.result && a.result.ok ? 'boated it' : 'lost it'; break;
  }

  const tPct = Math.min(100, a.tension * 100);
  const tCls = a.tension > 0.82 ? 'danger' : a.tension > 0.6 ? 'warn' : 'ok';
  const stam = a.fish ? (a.fish.stamina / a.fish.maxStamina) * 100 : 0;

  el.innerHTML = `
    <div class="hud-top">
      <span class="pname p${i}">${a.name}</span>
      <span class="rank">${rankName(a.level)} · lvl ${a.level}</span>
    </div>
    <div class="status ${statusCls}">${status}</div>
    <div class="gear">
      <div><span class="gl">ROD</span> ${rod.name} <span class="gs">${rod.power} lb</span></div>
      <div><span class="gl">REEL</span> ${reel.name} <span class="gs">${reel.maxDepth} ft</span></div>
      <div><span class="gl">LURE</span> ${lure.name} <span class="gs">${lure.min}-${lure.max} ft</span></div>
    </div>
    <div class="bars">
      <div class="barlabel">line tension</div>
      <div class="bar"><i class="${tCls}" style="width:${tPct}%"></i><u style="left:82%"></u></div>
      <div class="barlabel">fish stamina</div>
      <div class="bar"><i class="stam" style="width:${stam}%"></i></div>
    </div>
    ${bitingPanel(game, a)}
    <div class="stats">
      caught <b>${a.caught}</b> · lost <b>${a.lost}</b> · best <b>${a.heaviest.toFixed(1)} lb</b><br>
      line reaches <b>${maxD} ft</b> of ${SPOTS[game.spot].bottom} ft
    </div>`;
}

/* Shows what the current rig can actually draw a strike from. While the
   lure is down it reads the current depth, otherwise it previews the
   best depth for each species so players can plan the drop. */
function bitingPanel(game, a) {
  const inWater = a.phase === PHASE.SINKING || a.phase === PHASE.BITE || a.phase === PHASE.FIGHT;
  const rows = inWater
    ? candidateBites(game, a).map(c => ({ sp: c.sp, rate: c.rate, depth: a.depth }))
    : surveySpecies(game, a);

  const title = inWater ? `interested at ${a.depth.toFixed(0)} ft` : `this rig can catch`;
  if (!rows.length) {
    return `<div class="biting"><h4>${title}</h4>
      <div class="none">${inWater
        ? 'Nothing is looking at it here. Try another depth.'
        : 'Nothing here wants this lure. Change lures or move.'}</div></div>`;
  }

  const top = rows.slice(0, 4);
  const max = top[0].rate;
  const list = top.map(r => `
    <div class="bt">
      <span class="sw" style="background:${r.sp.color}"></span>
      <span class="bn">${r.sp.name}</span>
      ${inWater ? '' : `<span class="bn" style="flex:none;color:#7f9aad">${r.depth.toFixed(0)} ft</span>`}
      <span class="bb"><i style="width:${Math.max(8, (r.rate / max) * 100)}%"></i></span>
    </div>`).join('');
  return `<div class="biting"><h4>${title}</h4>${list}</div>`;
}

function renderTopBar(el, game) {
  const spot = SPOTS[game.spot];
  el.innerHTML = `
    <span class="cash">$${game.cash.toLocaleString()}</span>
    <span class="spot">${spot.name} <em>· ${spot.bottom} ft deep</em></span>
    <span class="tally">${game.totalCaught} landed · ${game.doubleHeaders} double headers · ${game.assists} assists</span>`;
}

function renderLog(el, game) {
  el.innerHTML = game.log.slice(0, 9)
    .map(l => `<div class="l ${l.kind}">${l.text}</div>`).join('');
}

function renderRecords(el, game) {
  const ids = Object.keys(game.records);
  if (!ids.length) { el.innerHTML = '<div class="empty">No records yet. Go catch something.</div>'; return; }
  el.innerHTML = ids
    .map(id => ({ id, r: game.records[id], sp: SPECIES.find(s => s.id === id) }))
    .sort((a, b) => b.r.weight - a.r.weight)
    .map(x => `<div class="rec"><span class="rn">${x.sp.name}</span>
      <span class="rw">${x.r.weight.toFixed(1)} lb</span>
      <span class="rb">${x.r.by}</span></div>`).join('');
}
