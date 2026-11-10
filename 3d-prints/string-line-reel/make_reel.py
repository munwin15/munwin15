#!/usr/bin/env python3
"""Generate the string line reel, its clip-in handle and the level-wind parts.

  string_line_reel.stl   reel: tall end discs, 13 mm hex (bolt head) on top, snap
                         socket and a spiral "scroll" track in the bottom face
  reel_handle.stl        handle: split pin clips into the socket; carries the
                         plate, axle and posts for the level-wind
  level_wind_wheel.stl   gear driven by the scroll track, one tooth per reel turn,
                         with a crank pin
  level_wind_guide.stl   sliding string guide moved up and down by the crank pin
  retaining_clip.stl     C-clip, print 2 (plus spares): holds the guide on its posts

All dimensions in millimetres. Assembled coordinates: reel axis = Z, reel bottom
face at z = 0, the handle's printing flat at x = -FLAT, level-wind on the +Y side.
Run:  pip install manifold3d && python3 make_reel.py
"""
import math
import os
import struct

import numpy as np
from manifold3d import CrossSection, Manifold, Mesh, set_circular_segments

# ---- Reel --------------------------------------------------------------------
FLANGE_DIA = 90.0     # end disc diameter (tall discs: 30 mm above the core)
TOP_FLANGE_THK = 3.5
BOT_FLANGE_THK = 5.5  # thicker: the scroll track is cut 2.8 mm into its face
CORE_DIA = 30.0       # diameter the string winds onto
WIND_WIDTH = 40.0     # gap between the two discs
HEX_AF = 13.0         # bolt head size, across flats
HEX_HEIGHT = 10.0     # bolt head height
EDGE_CHAMFER = 0.8    # chamfer on disc rims
CORE_FILLET = 4.0     # 45 degree gusset where the core meets each disc
ANCHOR_HOLE_DIA = 3.5 # string tie-off hole through the top disc

# ---- Handle clip (socket in the reel + pin on the handle) ---------------------
PIN_DIA = 12.0        # handle pin
BORE_CLEARANCE = 0.3  # radial gap between pin and socket, so the reel spins
SOCKET_DEPTH = 36.0   # depth of the socket in the bottom of the reel
GROOVE_Z = 28.0       # height of the catch groove above the reel's bottom face
GROOVE_LEN = 4.0      # length of the groove
GROOVE_DEPTH = 1.5    # how much wider the groove is than the socket (radial)
BARB = 1.0            # how far the barbs stand out past the socket wall (radial)
SLOT_WIDTH = 4.0      # split in the pin that lets the barbs squeeze in
AXIAL_PLAY = 0.4      # up/down play of the reel on the handle

# ---- Handle --------------------------------------------------------------------
GRIP_DIA = 28.0
GRIP_LEN = 95.0
NECK_DIA = 15.0       # neck between reel and grip; keeps fingers off the gear
NECK_LEN = 50.0
SHOULDER_DIA = 23.0   # face the reel sits on
SHOULDER_THK = 3.0
FLAT = 5.0            # distance from pin axis to the flat the handle prints on
PLATE_THK = 3.0       # level-wind plate, printed on the bed with the handle

# ---- Level-wind ----------------------------------------------------------------
MODULE = 1.25         # gear tooth size; scroll pitch = pi * MODULE
TEETH = 34            # reel turns per full back-and-forth of the guide
BACKLASH = 0.3        # tooth thinning for printed fit
MESH_GAP = 0.15       # extra distance between wheel and scroll
WHEEL_Y = 30.75       # wheel axle distance from the reel axis
WHEEL_THK = 4.5
AXLE_DIA = 8.0
CRANK = 14.5          # crank pin radius: guide travel = 2 * CRANK
CRANK_PIN_DIA = 5.0
POST_DIA = 7.0        # guide posts
POST_Y = 64.5
POST_Z = (-12.0, 28.0)
EYE_Y = 52.0          # string eye distance from the reel axis
EYE_DIA = 6.0
FIT = 0.25            # running clearance (radial) on axle, posts and crank pin
# -------------------------------------------------------------------------------

set_circular_segments(144)

R = FLANGE_DIA / 2
rc = CORE_DIA / 2
c = EDGE_CHAMFER
f = CORE_FILLET
z1 = BOT_FLANGE_THK           # top of bottom disc
z2 = z1 + WIND_WIDTH          # underside of top disc
z3 = z2 + TOP_FLANGE_THK      # top of top disc
rp = PIN_DIA / 2
rb = rp + BORE_CLEARANCE      # socket radius
rg = rb + GROOVE_DEPTH        # groove radius
ledge = GROOVE_DEPTH * math.tan(math.radians(30))   # catch face, 30 deg off flat
g0 = GROOVE_Z
g1 = GROOVE_Z + GROOVE_LEN

PA = math.radians(20)                     # gear pressure angle
pitch = math.pi * MODULE                  # scroll pitch = advance per reel turn
r_pitch = MODULE * TEETH / 2
r_tip = r_pitch + MODULE
r_root = r_pitch - 1.25 * MODULE
WHEEL_Z = MODULE - r_pitch - MESH_GAP     # wheel axle height (below the reel)
SCROLL_DEPTH = 2.25 * MODULE
half_chord = math.sqrt(r_tip ** 2 - WHEEL_Z ** 2)
SCROLL_R0 = WHEEL_Y - half_chord - 1.3    # innermost / outermost track centreline
SCROLL_R1 = WHEEL_Y + half_chord + 1.3

# stack-up across the plate (x direction)
X_BED = -FLAT
X_PLATE = X_BED + PLATE_THK               # top of the plate
X_WHEEL0 = X_PLATE + 0.3                  # wheel faces
X_WHEEL1 = X_WHEEL0 + WHEEL_THK
X_BAND0 = X_WHEEL1 + 0.4                  # underside of the guide's yoke band
X_GUIDE0 = X_PLATE + 0.2                  # guide faces
X_GUIDE1 = X_BAND0 + 3.0
X_CLIP0 = X_GUIDE1 + 0.3                  # clip groove on the posts
CLIP_THK = 1.4
EYE_Z_OFFSET = (z1 + z2) / 2 - WHEEL_Z    # eye sits mid-way between the discs


def revolve(profile):
    """Lathe an (r, z) outline around the Z axis."""
    return Manifold.revolve(CrossSection([profile]))


def poly(points):
    """Cross-section from one outline, whichever way round it is listed."""
    area = sum(a[0] * b[1] - b[0] * a[1]
               for a, b in zip(points, points[1:] + points[:1]))
    return CrossSection([points if area > 0 else points[::-1]])


def rect(y0, y1, za, zb):
    return poly([(y0, za), (y1, za), (y1, zb), (y0, zb)])


def disc(y, z, r):
    return CrossSection.circle(r).translate((y, z))


def slab(section, x0, x1):
    """Extrude a (y, z) cross-section from x0 to x1."""
    return Manifold.extrude(section, x1 - x0).transform(
        [[0, 0, 1, x0], [1, 0, 0, 0], [0, 1, 0, 0]])


# ---- Reel ----------------------------------------------------------------------
def scroll_track():
    """Spiral rack cut into the reel's bottom face: a 20 degree trapezoid groove."""
    turns = (SCROLL_R1 - SCROLL_R0) / pitch
    steps = int(turns * 180)
    w_top = pitch / 2 + 2 * (MODULE + 0.5) * math.tan(PA)       # at z = -0.5
    w_bot = pitch / 2 - 2 * 1.25 * MODULE * math.tan(PA)        # at groove floor
    section = [(-w_top / 2, -0.5), (w_top / 2, -0.5),
               (w_bot / 2, SCROLL_DEPTH), (-w_bot / 2, SCROLL_DEPTH)]
    verts, tris = [], []
    for i in range(steps + 1):
        a = 2 * math.pi * turns * i / steps
        r = SCROLL_R0 + pitch * a / (2 * math.pi)
        for u, z in section:
            verts.append(((r + u) * math.cos(a), (r + u) * math.sin(a), z))
    for i in range(steps):
        for j in range(4):
            a, b = 4 * i + j, 4 * i + (j + 1) % 4
            tris += [(a, b, b + 4), (a, b + 4, a + 4)]
    last = 4 * steps
    tris += [(0, 2, 1), (0, 3, 2), (last, last + 1, last + 2), (last, last + 2, last + 3)]
    v = np.array(verts, dtype=np.float32)
    t = np.array(tris, dtype=np.uint32)
    solid = Manifold(Mesh(vert_properties=v, tri_verts=t))
    if solid.volume() <= 0:
        solid = Manifold(Mesh(vert_properties=v, tri_verts=t[:, ::-1].copy()))
    return solid


def build_reel():
    body = revolve([
        (rb + 0.8, 0), (R - c, 0), (R, c), (R, z1 - c), (R - c, z1),
        (rc + f, z1), (rc, z1 + f), (rc, z2 - f), (rc + f, z2),
        (R - c, z2), (R, z2 + c), (R, z3 - c), (R - c, z3), (0, z3),
        # socket, from its pointed ceiling back down to the mouth
        (0, SOCKET_DEPTH + rb), (rb, SOCKET_DEPTH),
        (rb, g1 + GROOVE_DEPTH), (rg, g1),      # 45 deg roof: prints unsupported
        (rg, g0), (rb, g0 - ledge),             # catch face for the barbs
        (rb, 0.8),
    ])
    apothem = HEX_AF / 2
    corner = apothem / math.cos(math.pi / 6)
    hexagon = Manifold.extrude(CrossSection.circle(corner, 6), HEX_HEIGHT)
    crown = revolve([(0, 0), (corner + 1, 0), (corner + 1, HEX_HEIGHT - 1.6),
                     (apothem - 0.3, HEX_HEIGHT), (0, HEX_HEIGHT)])
    head = (hexagon ^ crown).translate([0, 0, z3 - 0.01])
    anchor = Manifold.cylinder(TOP_FLANGE_THK + 2, ANCHOR_HOLE_DIA / 2).translate(
        [rc + f + 3.5, 0, z2 - 1])
    return body + head - anchor - scroll_track()


# ---- Handle --------------------------------------------------------------------
def build_handle():
    rbarb = rb + BARB
    # underside of the barb sits AXIAL_PLAY above the socket's catch face
    barb_hi = g0 - ledge * (rg - rbarb) / GROOVE_DEPTH + AXIAL_PLAY
    barb_lo = barb_hi - (rbarb - rp) * math.tan(math.radians(30))
    tip = SOCKET_DEPTH - 1.5
    rs = SHOULDER_DIA / 2
    pin = revolve([
        (0, -SHOULDER_THK), (rs - 1, -SHOULDER_THK), (rs, -SHOULDER_THK + 1), (rs, 0),
        (rp + 0.6, 0), (rp, 0.6),
        (rp, barb_lo), (rbarb, barb_hi), (rbarb, barb_hi + 1.5),
        (rp - 1.0, tip), (0, tip),
    ])
    slot_z = 5.0
    slot = (Manifold.cube([40, SLOT_WIDTH, 60]).translate([-20, -SLOT_WIDTH / 2, slot_z])
            + Manifold.cylinder(40, SLOT_WIDTH / 2).rotate([0, 90, 0])
              .translate([-20, 0, slot_z]))
    neck_bot = -SHOULDER_THK - NECK_LEN
    neck = Manifold.cylinder(NECK_LEN + 1, NECK_DIA / 2).translate([0, 0, neck_bot - 0.5])
    rgrip = GRIP_DIA / 2
    top, bot = neck_bot, neck_bot - GRIP_LEN
    grip = revolve([
        (0, bot), (rgrip - 5, bot), (rgrip - 1.5, bot + 1.5), (rgrip, bot + 6),
        (rgrip, top - 4), (rgrip - 2, top), (0, top),
    ]).translate([rgrip - FLAT - 5, 0, 0])   # shifted so the flat is 21 mm wide
    body = (pin - slot + neck + grip).trim_by_plane([1, 0, 0], X_BED)

    # level-wind plate: lies on the bed, runs under the reel and up beside it
    rib0 = POST_Y + 7.0
    plate = slab(poly([(0, -1), (47, -1), (54, 6), (54, 38), (rib0 + 3, 38),
                       (rib0 + 3, -30), (50, neck_bot + 1), (0, neck_bot + 1)]),
                 X_BED, X_PLATE)
    rib = slab(rect(rib0, rib0 + 3, -30, 38), X_BED, X_PLATE + 5)
    axle = (slab(disc(WHEEL_Y, WHEEL_Z, AXLE_DIA / 2 + 2.5), X_PLATE - 0.1, X_WHEEL0)
            + slab(disc(WHEEL_Y, WHEEL_Z, AXLE_DIA / 2), X_PLATE - 0.1, X_WHEEL1))
    posts = Manifold()
    for pz in POST_Z:
        posts += slab(disc(POST_Y, pz, POST_DIA / 2), X_PLATE - 0.1, X_CLIP0)
        posts += slab(disc(POST_Y, pz, POST_DIA / 2 - 1.2), X_CLIP0 - 0.1,
                      X_CLIP0 + CLIP_THK + 0.2)
        posts += slab(disc(POST_Y, pz, POST_DIA / 2), X_CLIP0 + CLIP_THK + 0.2,
                      X_CLIP0 + CLIP_THK + 1.4)
    return body + plate + rib + axle + posts


# ---- Level-wind wheel ------------------------------------------------------------
def gear_outline():
    r_base = r_pitch * math.cos(PA)
    inv = lambda a: math.tan(a) - a
    half_base = math.pi / (2 * TEETH) - BACKLASH / (2 * r_pitch) + inv(PA)
    radii = [r_base + (r_tip - r_base) * i / 12 for i in range(13)]
    flank = [(r, half_base - inv(math.acos(r_base / r))) for r in radii]
    pts = []
    for i in range(TEETH):
        mid = 2 * math.pi * i / TEETH
        side = [(r_root, mid - half_base)] + [(r, mid - h) for r, h in flank]
        side += [(r, mid + h) for r, h in reversed(flank)] + [(r_root, mid + half_base)]
        pts += [(r * math.cos(a), r * math.sin(a)) for r, a in side]
    return poly(pts)


def build_wheel(angle=0.0):
    """Wheel in assembled position; angle (degrees) turns it about its axle."""
    here = lambda s: s.rotate(angle).translate((WHEEL_Y, WHEEL_Z))
    gear = gear_outline() - CrossSection.circle(AXLE_DIA / 2 + FIT)
    crank_pin = CrossSection.circle(CRANK_PIN_DIA / 2).translate((CRANK, 0))
    return (slab(here(gear), X_WHEEL0, X_WHEEL1)
            + slab(here(crank_pin), X_WHEEL1 - 0.1, X_GUIDE1 + 0.6))


# ---- Sliding string guide ----------------------------------------------------------
def build_guide(shift=0.0):
    """Guide in assembled position; shift moves it along the reel axis."""
    zc = WHEEL_Z
    slot_half = CRANK_PIN_DIA / 2 + 0.2
    band_half = slot_half + 2.2
    post_half = POST_DIA / 2 + FIT
    bar0, bar1 = POST_Y - 6.0, POST_Y + 6.0
    band0 = WHEEL_Y - CRANK - slot_half - 2.2
    lo = [pz - zc - CRANK for pz in POST_Z]     # post travel relative to the guide
    hi = [pz - zc + CRANK for pz in POST_Z]
    eye = (EYE_Y, zc + EYE_Z_OFFSET)
    outline = (rect(band0, bar0 + 1, zc - band_half, zc + band_half)
               + rect(bar0, bar1, zc + lo[0] - post_half - 3, zc + hi[1] + post_half + 3)
               + disc(*eye, EYE_DIA / 2 + 3)
               + rect(eye[0], bar0 + 1, eye[1] - EYE_DIA / 2 - 3, eye[1] + EYE_DIA / 2 + 3))
    cuts = rect(WHEEL_Y - CRANK - slot_half, WHEEL_Y + CRANK + slot_half,
                zc - slot_half, zc + slot_half)
    for a, b in zip(lo, hi):
        cuts += rect(POST_Y - post_half, POST_Y + post_half,
                     zc + a - post_half, zc + b + post_half)
    guide = slab(outline - cuts, X_GUIDE0, X_GUIDE1)
    # clear the wheel under the yoke band
    guide -= slab(rect(0, WHEEL_Y + r_tip + 1.0, zc - 40, zc + 40), X_GUIDE0 - 1, X_BAND0)
    # string eye, flared both sides so the string runs over a smooth edge
    mid, half = (X_GUIDE0 + X_GUIDE1) / 2, (X_GUIDE1 - X_GUIDE0) / 2
    re = EYE_DIA / 2
    hole = revolve([(0, -half - 1), (re + 2.5, -half - 1), (re + 2.5, -half),
                    (re, -half + 2.5), (re, half - 2.5), (re + 2.5, half),
                    (re + 2.5, half + 1), (0, half + 1)])
    guide -= hole.rotate([0, 90, 0]).translate([mid, eye[0], eye[1]])
    return guide.translate([0, 0, shift])


def build_clip():
    """C-clip lying flat, as printed."""
    ring = CrossSection.circle(5.5) - CrossSection.circle(POST_DIA / 2 - 1.2 + 0.15)
    mouth = poly([(0, -2.0), (8, -2.0), (8, 2.0), (0, 2.0)])
    return Manifold.extrude(ring - mouth, CLIP_THK)


def clip_at(pz):
    return slab(disc(POST_Y, pz, 5.5) - disc(POST_Y, pz, POST_DIA / 2 - 1.05),
                X_CLIP0, X_CLIP0 + CLIP_THK)


# ---- Output ----------------------------------------------------------------------
def write_stl(solid, name):
    mesh = solid.to_mesh()
    verts = mesh.vert_properties[:, :3]
    tris = mesh.tri_verts
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
    with open(path, "wb") as fh:
        fh.write(name.encode().ljust(80, b" "))
        fh.write(struct.pack("<I", len(tris)))
        for tri in tris:
            p, q, r = (verts[i] for i in tri)
            u, v = q - p, r - p
            n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
                 u[0] * v[1] - u[1] * v[0])
            m = math.sqrt(sum(k * k for k in n)) or 1.0
            fh.write(struct.pack("<3f", *(k / m for k in n)))
            for pt in (p, q, r):
                fh.write(struct.pack("<3f", *pt))
            fh.write(b"\0\0")
    box = solid.bounding_box()
    size = " x ".join(f"{box[i + 3] - box[i]:.1f}" for i in range(3))
    print(f"{name}: {len(tris)} triangles, {solid.volume() / 1000:.1f} cm3, "
          f"{size} mm, {len(solid.decompose())} piece(s), status {solid.status().name}")


def overlap(a, b):
    return (a ^ b).volume()


def check():
    """Run the assembly through its motion and report any parts colliding."""
    reel, handle = build_reel(), build_handle()
    print(f"clip: seated {overlap(reel, handle):.3f} mm3 (want 0), pulled "
          f"{overlap(reel, handle.translate([0, 0, -AXIAL_PLAY - 0.5])):.1f} mm3 (want > 0)")
    tooth = 360 / TEETH
    # find how the wheel must be phased to sit in the scroll, and which way it turns
    phase = min((i * tooth / 40 for i in range(40)),
                key=lambda p: overlap(reel, build_wheel(p)))
    turns = [0.13, 0.31, 0.5, 0.77, 1.4, 2.6]
    worst = {}
    for sign in (1, -1):
        worst[sign] = max(overlap(reel.rotate([0, 0, 360 * n]),
                                  build_wheel(phase + sign * n * tooth)) for n in turns)
    sign = min(worst, key=worst.get)
    print(f"scroll/wheel mesh: worst overlap {worst[sign]:.3f} mm3 turning the right way "
          f"(want 0), {worst[-sign]:.1f} mm3 the wrong way (want > 0)")
    clips = clip_at(POST_Z[0]) + clip_at(POST_Z[1])
    worst = 0.0
    for step in range(24):
        ang = 15.0 * step
        wheel = build_wheel(ang)
        guide = build_guide(CRANK * math.sin(math.radians(ang)))
        fixed = handle + reel
        worst = max(worst, overlap(guide, fixed), overlap(guide, wheel),
                    overlap(guide, clips), overlap(wheel, handle))
    print(f"guide/wheel/handle/reel through a full cycle: worst overlap {worst:.3f} mm3 "
          f"(want 0)")
    print(f"guide travel {2 * CRANK:.0f} mm, one back-and-forth per {TEETH} reel turns")
    return reel, handle


if __name__ == "__main__":
    reel, handle = check()
    lay_flat = lambda s: s.rotate([0, -90, 0])      # assembled x -> print z
    write_stl(reel, "string_line_reel.stl")
    write_stl(lay_flat(handle).translate([0, 0, FLAT]), "reel_handle.stl")
    write_stl(lay_flat(build_wheel()).translate([0, -WHEEL_Y, -X_WHEEL0]),
              "level_wind_wheel.stl")
    # the guide prints upside down, on its flat outer face
    write_stl(lay_flat(build_guide()).rotate([180, 0, 0]).translate([0, 0, X_GUIDE1]),
              "level_wind_guide.stl")
    write_stl(build_clip(), "retaining_clip.stl")
