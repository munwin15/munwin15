# Deep Water Duo

A two-player co-op freshwater fishing game that runs locally in your browser.
No install, no build step, no server, no internet connection.

Two anglers share one boat, one lake and one wallet. You work your way from
bluegill in the lily pads down to sturgeon in the Trench by upgrading rods,
reels and lures.

## Running it

Double-click `index.html`, or open it in your browser:

```
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Chrome, Firefox, Edge and Safari all work. Progress saves automatically to
browser storage. If your browser blocks storage for local files, the game
still plays fine, it just will not remember the boat between sessions. To get
saving working in that case, serve the folder instead:

```
python3 -m http.server 8000    # then open http://localhost:8000
```

## Controls

Both players play on the same keyboard at the same time.

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Cast / set the hook / reel | `SPACE` | `ENTER` |
| Let line out (sink) | `S` | `↓` |
| Reel up | `W` | `↑` |
| Swap lure / change shop tab | `Q` | `/` |
| Open shop & travel menu | `E` | `RIGHT SHIFT` |

`SHIFT+R` wipes the save and starts a new season.

## How a fish gets caught

1. **Cast.** Hold your action key. The power meter swings; release it where
   you want. A longer cast puts you further from the boat.
2. **Find the depth.** Hold down to sink, up to reel back. Every species holds
   in its own depth band, and your HUD lists what is interested at your
   current depth. If it says nothing is looking, move.
3. **Work the lure.** Tap your action key to jig. That action is what triggers
   a strike, so a dead lure sitting still catches very little.
4. **Set the hook.** When `!` flashes, tap again before the bar runs out. A
   more sensitive rod gives you a longer window.
5. **Fight it.** Hold to reel. Cranking gains line but loads the rod, and the
   tension bar climbs. Cross the white mark for too long and the line snaps.
   Let go and the drag recovers while the fish tires itself out. Pump and
   wind: reel when it is calm, give line when it runs.

## Co-op

The two of you are not just fishing next to each other.

- **Netting.** When your partner is hooked up and your own line is in the
  boat, hold your action key to work the net. It bleeds off their tension,
  speeds their retrieve, and pays you both.
- **Double headers.** Land two fish at once for a 25% bonus on both.
- **Shared wallet.** All money is pooled, so upgrades are a joint decision.
  Two mid-tier rods, or one deep-water setup and one shallow specialist?
- **Shared boat.** Travel moves both of you. One player with a big enough reel
  can take the whole crew somewhere new, and both rods fish it.

## Progression

Three upgrade tracks, and you need all three to reach the bottom of the lake.

- **Rods** (6) set how many pounds of pull the line can carry. This is the
  hard gate on big fish: a cane pole simply cannot land a musky.
- **Reels** (6) set how much line is on the spool. This gates how deep you can
  fish, and which spots the boat can travel to at all.
- **Lures** (10) decide which species will even look at you. Each has a working
  depth band, a size class and a set of species it appeals to. A fish will not
  eat a lure smaller than its size class.

Six spots, each opening up new species:

| Spot | Depth | Needs | New fish |
| --- | --- | --- | --- |
| Lily Pad Cove | 18 ft | — | bluegill, rock bass, perch, crappie, largemouth |
| Weed Flats | 35 ft | 30 ft of line | smallmouth, rainbow trout, northern pike |
| Rocky Point | 60 ft | 50 ft | walleye, brown trout, muskellunge |
| The Drop-Off | 110 ft | 75 ft | channel cat, flathead cat, lake trout |
| Deep Basin | 170 ft | 120 ft | alligator gar, burbot |
| The Trench | 240 ft | 190 ft | lake sturgeon |

17 species in all. Every first catch of a species sets a lake record, and
records pay a 50% bounty, so it is worth hunting new fish rather than
grinding the same one.

## Files

```
index.html      page layout, styling, controls splash
src/data.js     rods, reels, lures, species and spots - tune balance here
src/game.js     state machine, bite model, fight physics
src/render.js   canvas drawing of the lake
src/ui.js       HUD, shop and travel menu
src/main.js     input, main loop, save/load
```

All balance numbers live in `src/data.js` and are commented. Change a rod's
`power` or a species' `min`/`max` depth and the whole progression shifts.
