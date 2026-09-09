/* =====================================================================
   Deep Water Duo - game data
   Rods, reels, lures, species and fishing spots.
   All depths are in feet, all weights in pounds.
   ===================================================================== */

/* ---------------------------------------------------------------
   RODS
   power       : pounds of pull the blank can carry before the line
                 pops. This is the single biggest gate on big fish.
   sensitivity : 0..1, widens the hookset window when a fish bites.
   cast        : how far you can throw, in feet. Longer casts reach
                 the productive water further from the boat.
   --------------------------------------------------------------- */
const RODS = [
  { id: 'cane',     name: 'Cane Pole',            price:     0, power:  8, sensitivity: 0.55, cast:  30,
    blurb: 'A stick with line tied to the end. It has caught more bluegill than every graphite rod combined.' },
  { id: 'glass',    name: 'Fiberglass Spinner',   price:   250, power: 14, sensitivity: 0.64, cast:  45,
    blurb: 'Soft, forgiving, nearly unbreakable. Bends into a horseshoe and keeps going.' },
  { id: 'graphite', name: 'Graphite Medium',      price:   900, power: 24, sensitivity: 0.78, cast:  60,
    blurb: 'Light and fast. You will feel a walleye breathe on the jig.' },
  { id: 'heavy',    name: 'Composite Heavy',      price:  2800, power: 40, sensitivity: 0.85, cast:  75,
    blurb: 'Built for pike and catfish. Lifts fish that argue.' },
  { id: 'jigging',  name: 'Deep Jigging Rod',     price:  7500, power: 62, sensitivity: 0.92, cast:  85,
    blurb: 'Short, brutal, and made to work metal a hundred feet down.' },
  { id: 'musky',    name: 'Titanium Musky Stick', price: 18000, power: 95, sensitivity: 0.97, cast: 100,
    blurb: 'The last rod you will ever need, assuming the sturgeon agrees.' },
];

/* ---------------------------------------------------------------
   REELS
   maxDepth : how much line is on the spool. This is the hard cap on
              how deep you can fish, and the gate on the deep spots.
   retrieve : feet per second of line you can pick up.
   drag     : 0..1, how smoothly the drag absorbs a surge. High drag
              means tension climbs slower and recovers faster.
   --------------------------------------------------------------- */
const REELS = [
  { id: 'spincast', name: 'Plastic Spincast',   price:     0, maxDepth:  20, retrieve: 0.9, drag: 0.50,
    blurb: 'Push the button, hope for the best. Twenty feet of line and a lot of optimism.' },
  { id: 'spin2500', name: 'Spinning Reel 2500', price:   300, maxDepth:  45, retrieve: 1.2, drag: 0.65,
    blurb: 'The reel everyone actually owns. Smooth enough for trout.' },
  { id: 'baitcast', name: 'Baitcaster Pro',     price:  1100, maxDepth:  75, retrieve: 1.5, drag: 0.75,
    blurb: 'Thumb it wrong and you get a birds nest. Thumb it right and you get a walleye.' },
  { id: 'sealed',   name: 'Sealed Drag 4000',   price:  3400, maxDepth: 110, retrieve: 1.8, drag: 0.85,
    blurb: 'Carbon washers, sealed body. Shrugs off a catfish that has decided to sulk.' },
  { id: 'winch',    name: 'Deep Winch DX',      price:  9000, maxDepth: 160, retrieve: 2.1, drag: 0.92,
    blurb: 'Geared like a boat trailer jack. Built to haul lakers off the basin floor.' },
  { id: 'abyss',    name: 'Abyss Master 9000',  price: 22000, maxDepth: 220, retrieve: 2.5, drag: 0.98,
    blurb: 'Enough braid to reach the bottom of the Trench, and the drag to survive what lives there.' },
];

/* ---------------------------------------------------------------
   LURES
   min/max  : the depth band where the lure presents properly. Fish
              it outside that window and your bites dry up.
   size     : 1..6. A fish will not eat a lure smaller than its
              minLure, and big lures stop drawing small fish.
   action   : how much bite pressure a good jigging rhythm generates.
   tags     : which species families the lure speaks to.
   --------------------------------------------------------------- */
const LURES = [
  { id: 'worm',     name: 'Garden Worm',      price:     0, min:   0, max:  25, size: 1, action: 0.75,
    tags: ['panfish'], blurb: 'Undefeated on bluegill since the invention of the bluegill.' },
  { id: 'spinner',  name: 'Inline Spinner',   price:   120, min:   0, max:  30, size: 2, action: 1.00,
    tags: ['panfish','bass','trout'], blurb: 'Flash and thump. Everything in the shallows takes a swing at it.' },
  { id: 'jig',      name: 'Soft Plastic Jig', price:   260, min:   5, max:  50, size: 2, action: 1.10,
    tags: ['bass','walleye','panfish'], blurb: 'The most versatile thing in the box. Hop it, drag it, dead-stick it.' },
  { id: 'crank',    name: 'Shallow Crankbait',price:   450, min:   0, max:  20, size: 3, action: 0.95,
    tags: ['bass','pike'], blurb: 'Wobbles like a wounded shad over the weed tops.' },
  { id: 'spoon',    name: 'Casting Spoon',    price:   700, min:  10, max:  60, size: 3, action: 1.05,
    tags: ['pike','trout','walleye'], blurb: 'A bent piece of metal that has been fooling pike for a century.' },
  { id: 'diver',    name: 'Deep Diver Plug',  price:  1600, min:  25, max:  90, size: 4, action: 1.15,
    tags: ['walleye','laketrout','bass'], blurb: 'Long bill, deep dive. Digs into water most lures never see.' },
  { id: 'rig',      name: 'Live Bait Rig',    price:  2400, min:  15, max:  80, size: 4, action: 0.85,
    tags: ['catfish','walleye','sturgeon'], blurb: 'Slow, smelly and devastating on anything with whiskers.' },
  { id: 'glide',    name: 'Glide Bait',       price:  5000, min:   5, max:  60, size: 5, action: 1.25,
    tags: ['musky','pike','bass'], blurb: 'A foot of hand-carved wood that swims in lazy S-turns. Musky candy.' },
  { id: 'jigspoon', name: 'Jigging Spoon XL', price:  8500, min:  60, max: 160, size: 5, action: 1.20,
    tags: ['laketrout','burbot','sturgeon','catfish'], blurb: 'Heavy enough to punch straight down to the basin.' },
  { id: 'rattler',  name: 'Abyss Rattler',    price: 16000, min: 100, max: 220, size: 6, action: 1.35,
    tags: ['sturgeon','musky','catfish','laketrout','gar'], blurb: 'Tungsten rattles you can hear through the rod. It calls up things that should stay down.' },
];

/* ---------------------------------------------------------------
   SPECIES
   min/max  : the depth band the fish holds in.
   str      : pounds of pull at average size. Compare to rod power.
   stam     : how long it fights before it gives up.
   rarity   : relative spawn weight. Higher shows up more often.
   ppl      : dollars per pound at the dock.
   minLure  : the smallest lure size this fish will commit to.
   fight    : how it behaves once hooked. See FIGHT_STYLES in game.js.
              steady/jumper/runner/bulldog/deep all need different hands
              on the reel, which is what makes each species feel distinct.
   --------------------------------------------------------------- */
const SPECIES = [
  { id:'bluegill', name:'Bluegill',          tags:['panfish'], min:    0, max:  15, wMin:0.2, wMax:  1.2,
    str: 2,  stam: 22,  rarity: 100, ppl:  6, minLure:1, fight:'steady', color:'#e0a13a', belly:'#f2d98a' },
  { id:'rockbass', name:'Rock Bass',         tags:['panfish'], min:    0, max:  20, wMin:0.3, wMax:  1.5,
    str: 3,  stam: 24,  rarity:  80, ppl:  7, minLure:1, fight:'steady', color:'#8a7a4a', belly:'#d8cc9a' },
  { id:'perch',    name:'Yellow Perch',      tags:['panfish'], min:    2, max:  30, wMin:0.3, wMax:  2.0,
    str: 3,  stam: 26,  rarity:  85, ppl:  8, minLure:1, fight:'steady', color:'#d9b12e', belly:'#f6e6a0' },
  { id:'crappie',  name:'Black Crappie',     tags:['panfish'], min:    3, max:  28, wMin:0.4, wMax:  3.0,
    str: 4,  stam: 30,  rarity:  70, ppl:  9, minLure:1, fight:'steady', color:'#6f7f6a', belly:'#cfd8c2' },
  { id:'largemouth',name:'Largemouth Bass',  tags:['bass'],    min:    2, max:  32, wMin:1.0, wMax: 12.0,
    str: 9,  stam: 58,  rarity:  55, ppl: 14, minLure:2, fight:'jumper', color:'#4f7a3a', belly:'#cbdda6' },
  { id:'smallmouth',name:'Smallmouth Bass',  tags:['bass'],    min:   20, max:  45, wMin:1.0, wMax:  8.0,
    str: 11, stam: 64,  rarity:  45, ppl: 16, minLure:2, fight:'jumper', color:'#8a6a3a', belly:'#e0c99a' },
  { id:'rainbow',  name:'Rainbow Trout',     tags:['trout'],   min:   22, max:  50, wMin:1.0, wMax: 14.0,
    str: 10, stam: 68,  rarity:  40, ppl: 18, minLure:2, fight:'jumper', color:'#7d8fa8', belly:'#f0d2d8' },
  { id:'walleye',  name:'Walleye',           tags:['walleye'], min:  38, max:  75, wMin:2.0, wMax: 16.0,
    str: 10, stam: 58,  rarity:  38, ppl: 22, minLure:2, fight:'steady', color:'#9a8f45', belly:'#efe3ae' },
  { id:'pike',     name:'Northern Pike',     tags:['pike'],    min:   24, max:  55, wMin:3.0, wMax: 30.0,
    str: 17, stam: 84,  rarity:  30, ppl: 20, minLure:3, fight:'runner', color:'#4a6a48', belly:'#d7e0b0' },
  { id:'brown',    name:'Brown Trout',       tags:['trout'],   min:  40, max:  72, wMin:2.0, wMax: 25.0,
    str: 14, stam: 78,  rarity:  22, ppl: 24, minLure:3, fight:'jumper', color:'#8f6a35', belly:'#efd9a4' },
  { id:'channel',  name:'Channel Catfish',   tags:['catfish'], min:  62, max:  95, wMin:3.0, wMax: 35.0,
    str: 19, stam: 98,  rarity:  30, ppl: 15, minLure:3, fight:'bulldog', color:'#6d6357', belly:'#ded3c0' },
  { id:'laketrout',name:'Lake Trout',        tags:['laketrout','trout'], min:  68, max:165, wMin:5.0, wMax: 45.0,
    str: 23, stam:112,  rarity:  26, ppl: 28, minLure:4, fight:'deep', color:'#5d6a72', belly:'#cdd7dc' },
  { id:'burbot',   name:'Burbot',            tags:['burbot'],  min: 115, max:185, wMin:2.0, wMax: 18.0,
    str: 15, stam: 88,  rarity:  22, ppl: 20, minLure:4, fight:'bulldog', color:'#7a6a4a', belly:'#d6c8a4' },
  { id:'flathead', name:'Flathead Catfish',  tags:['catfish'], min:  65, max:125, wMin:10.0,wMax: 90.0,
    str: 35, stam:152,  rarity:  14, ppl: 26, minLure:4, fight:'bulldog', color:'#7a6a3c', belly:'#e2d3a2' },
  { id:'musky',    name:'Muskellunge',       tags:['musky','pike'], min:   36, max:  62, wMin:10.0,wMax: 60.0,
    str: 31, stam:142,  rarity:   7, ppl: 40, minLure:5, fight:'runner', color:'#5a6b4a', belly:'#dfe3b8' },
  { id:'gar',      name:'Alligator Gar',     tags:['gar'],     min: 112, max: 160, wMin:20.0,wMax:140.0,
    str: 46, stam:205,  rarity:   5, ppl: 45, minLure:5, fight:'runner', color:'#5b5540', belly:'#cdc4a0' },
  { id:'sturgeon', name:'Lake Sturgeon',     tags:['sturgeon'],min: 175, max:235, wMin:30.0,wMax:220.0,
    str: 56, stam:265,  rarity:   6, ppl: 60, minLure:5, fight:'bulldog', color:'#4a5560', belly:'#c2ccd4' },
];

/* ---------------------------------------------------------------
   SPOTS
   The boat is shared, so both anglers always fish the same water.
   needDepth : the reel line capacity required to travel here. The
               deeper spots are the whole reason to upgrade.
   --------------------------------------------------------------- */
const SPOTS = [
  { id:'cove',   name:'Lily Pad Cove', top:  0, bottom:  18, needDepth:   0,
    blurb:'Warm, weedy and forgiving. Panfish everywhere and the odd bass under the pads.' },
  { id:'flats',  name:'Weed Flats',    top:  0, bottom:  35, needDepth:  30,
    blurb:'Cabbage weed out to the first break. Bass, pike and perch patrol the edge.' },
  { id:'point',  name:'Rocky Point',   top:  0, bottom:  60, needDepth:  50,
    blurb:'A boulder shelf falling away into blue water. Smallmouth stack on the rocks.' },
  { id:'drop',   name:'The Drop-Off',  top:  0, bottom: 110, needDepth:  75,
    blurb:'The old river channel. Walleye and catfish hold on the lip all day.' },
  { id:'basin',  name:'Deep Basin',    top:  0, bottom: 170, needDepth: 120,
    blurb:'Cold, dark and 40 degrees on the bottom. Lake trout country.' },
  { id:'trench', name:'The Trench',    top:  0, bottom: 240, needDepth: 190,
    blurb:'A crack in the lake floor nobody has properly mapped. Sturgeon live down here.' },
];

const RANKS = [
  'Dock Kid', 'Weekender', 'Angler', 'Sharp Hook', 'Lake Regular',
  'Guide', 'Tournament Pro', 'Deep Water Hand', 'Lake Legend',
];

/* Rough length in inches from weight, used for the record book. */
function lengthFor(species, weight) {
  const slim = species.tags.includes('pike') || species.tags.includes('musky') ||
               species.tags.includes('gar') || species.tags.includes('sturgeon') ||
               species.tags.includes('burbot');
  const k = slim ? 900 : 1600;
  return Math.cbrt(weight * k);
}
