#!/usr/bin/env python3
"""Generate string_line_reel.stl - a string line reel with tall end discs and a
13 mm hex (bolt head) on top so it can be wound with a 13 mm socket or spanner.

Plain Python, no dependencies. All dimensions in millimetres.
Run:  python3 make_reel.py
"""
import math
import os
import struct

# ---- Dimensions (edit these and re-run) -------------------------------------
FLANGE_DIA = 90.0     # end disc diameter (tall discs: 30 mm above the core)
FLANGE_THK = 3.5      # end disc thickness
CORE_DIA = 30.0       # diameter the string winds onto
WIND_WIDTH = 40.0     # gap between the two discs
HEX_AF = 13.0         # bolt head size, across flats
HEX_HEIGHT = 10.0     # bolt head height
AXLE_DIA = 8.4        # blind axle hole in the bottom (clearance for M8 / 8 mm rod)
EDGE_CHAMFER = 0.8    # chamfer on disc rims
CORE_FILLET = 4.0     # 45 degree gusset where the core meets each disc
SEGMENTS = 144        # facets around the circle (must be divisible by 6)
# -----------------------------------------------------------------------------

N = SEGMENTS
R = FLANGE_DIA / 2
rc = CORE_DIA / 2
rh = AXLE_DIA / 2
t = FLANGE_THK
c = EDGE_CHAMFER
f = CORE_FILLET
z1 = t                    # top of bottom disc
z2 = t + WIND_WIDTH       # underside of top disc
z3 = z2 + t               # top of top disc
z4 = z3 + HEX_HEIGHT      # top of bolt head
apothem = HEX_AF / 2
axle_depth = z2           # hole stops under the top disc, leaving the hex solid


def circle(r, z):
    return [(r * math.cos(2 * math.pi * i / N), r * math.sin(2 * math.pi * i / N), z)
            for i in range(N)]


def hexagon(z):
    """N points on a hexagon perimeter (flats exactly planar, corners every 60 deg)."""
    pts = []
    for i in range(N):
        a = 2 * math.pi * i / N
        local = (a % (math.pi / 3)) - math.pi / 6
        r = apothem / math.cos(local)
        pts.append((r * math.cos(a), r * math.sin(a), z))
    return pts


# Rings from the ceiling of the axle hole, down and around the outside, up to the hex top.
rings = [
    circle(rh, axle_depth),
    circle(rh, 0.6),
    circle(rh + 0.6, 0),                 # lead-in chamfer on the axle hole
    circle(R - c, 0),
    circle(R, c),
    circle(R, z1 - c),
    circle(R - c, z1),
    circle(rc + f, z1),
    circle(rc, z1 + f),
    circle(rc, z2 - f),
    circle(rc + f, z2),
    circle(R - c, z2),
    circle(R, z2 + c),
    circle(R, z3 - c),
    circle(R - c, z3),
    hexagon(z3),
    hexagon(z4 - 1.0),
    circle(apothem - 0.4, z4),           # chamfered crown, like a real bolt head
]
start_apex = (0.0, 0.0, axle_depth)
end_apex = (0.0, 0.0, z4)

tris = []
for i in range(N):
    j = (i + 1) % N
    tris.append((start_apex, rings[0][i], rings[0][j]))
    for a, b in zip(rings, rings[1:]):
        tris.append((a[i], b[i], b[j]))
        tris.append((a[i], b[j], a[j]))
    tris.append((rings[-1][i], end_apex, rings[-1][j]))


def signed_volume(ts):
    v = 0.0
    for p, q, r in ts:
        v += (p[0] * (q[1] * r[2] - q[2] * r[1])
              - p[1] * (q[0] * r[2] - q[2] * r[0])
              + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6
    return v


if signed_volume(tris) < 0:              # make normals face outward
    tris = [(p, r, q) for p, q, r in tris]


def normal(p, q, r):
    ux, uy, uz = q[0] - p[0], q[1] - p[1], q[2] - p[2]
    vx, vy, vz = r[0] - p[0], r[1] - p[1], r[2] - p[2]
    n = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
    m = math.sqrt(sum(k * k for k in n)) or 1.0
    return tuple(k / m for k in n)


out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "string_line_reel.stl")
with open(out, "wb") as fh:
    fh.write(b"string line reel, 13 mm hex drive".ljust(80, b" "))
    fh.write(struct.pack("<I", len(tris)))
    for tri in tris:
        fh.write(struct.pack("<3f", *normal(*tri)))
        for p in tri:
            fh.write(struct.pack("<3f", *p))
        fh.write(b"\0\0")

# ---- Self-check: every edge must be shared by exactly two triangles ----------
edges = {}
for tri in tris:
    k = [tuple(round(x, 5) for x in p) for p in tri]
    for a, b in ((k[0], k[1]), (k[1], k[2]), (k[2], k[0])):
        edges[(a, b)] = edges.get((a, b), 0) + 1
watertight = all(n == 1 and edges.get((b, a)) == 1 for (a, b), n in edges.items())
print(f"wrote {out}")
print(f"triangles: {len(tris)}  watertight: {watertight}  "
      f"volume: {signed_volume(tris) / 1000:.1f} cm3")
print(f"size: {FLANGE_DIA:.0f} mm dia x {z4:.1f} mm tall")
