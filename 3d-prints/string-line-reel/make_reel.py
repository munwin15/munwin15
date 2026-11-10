#!/usr/bin/env python3
"""Generate the string line reel and its clip-in handle.

  string_line_reel.stl  reel with tall end discs, a 13 mm hex (bolt head) on top
                        and a snap socket in the bottom
  reel_handle.stl       handle whose split pin clips into that socket; the reel
                        spins freely on it

All dimensions in millimetres.
Run:  pip install manifold3d && python3 make_reel.py
"""
import math
import os
import struct

from manifold3d import CrossSection, Manifold, set_circular_segments

# ---- Reel --------------------------------------------------------------------
FLANGE_DIA = 90.0     # end disc diameter (tall discs: 30 mm above the core)
FLANGE_THK = 3.5      # end disc thickness
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

# ---- Handle grip ---------------------------------------------------------------
GRIP_DIA = 28.0
GRIP_LEN = 95.0
SHOULDER_DIA = 36.0   # face the reel sits on
SHOULDER_THK = 3.0
FLAT = 5.0            # distance from pin axis to the flat the handle prints on
# -------------------------------------------------------------------------------

set_circular_segments(144)

R = FLANGE_DIA / 2
rc = CORE_DIA / 2
t = FLANGE_THK
c = EDGE_CHAMFER
f = CORE_FILLET
z1 = t                    # top of bottom disc
z2 = t + WIND_WIDTH       # underside of top disc
z3 = z2 + t               # top of top disc
rp = PIN_DIA / 2
rb = rp + BORE_CLEARANCE  # socket radius
rg = rb + GROOVE_DEPTH    # groove radius
ledge = GROOVE_DEPTH * math.tan(math.radians(30))   # catch face, 30 deg off flat
g0 = GROOVE_Z
g1 = GROOVE_Z + GROOVE_LEN


def revolve(profile):
    """Lathe an (r, z) outline around the Z axis."""
    return Manifold.revolve(CrossSection([profile]))


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
    anchor = Manifold.cylinder(t + 2, ANCHOR_HOLE_DIA / 2).translate(
        [rc + f + 3.5, 0, z2 - 1])
    return body + head - anchor


def build_handle():
    """Handle in assembled position: pin along +Z, reel sits on z = 0."""
    rbarb = rb + BARB
    # underside of the barb sits AXIAL_PLAY above the socket's catch face
    barb_hi = g0 - ledge * (rg - rbarb) / GROOVE_DEPTH + AXIAL_PLAY
    barb_lo = barb_hi - (rbarb - rp) * math.tan(math.radians(30))
    tip = SOCKET_DEPTH - 1.5
    pin = revolve([
        (0, -SHOULDER_THK), (SHOULDER_DIA / 2 - 1, -SHOULDER_THK),
        (SHOULDER_DIA / 2, -SHOULDER_THK + 1), (SHOULDER_DIA / 2, 0),
        (rp + 0.6, 0), (rp, 0.6),
        (rp, barb_lo), (rbarb, barb_hi), (rbarb, barb_hi + 1.5),
        (rp - 1.0, tip), (0, tip),
    ])
    slot_z = 5.0
    slot = (Manifold.cube([40, SLOT_WIDTH, 60]).translate([-20, -SLOT_WIDTH / 2, slot_z])
            + Manifold.cylinder(40, SLOT_WIDTH / 2).rotate([0, 90, 0])
              .translate([-20, 0, slot_z]))
    rgrip = GRIP_DIA / 2
    top, bot = -SHOULDER_THK + 0.01, -SHOULDER_THK - GRIP_LEN
    grip = revolve([
        (0, bot), (rgrip - 5, bot), (rgrip - 1.5, bot + 1.5), (rgrip, bot + 6),
        (rgrip, top - 4), (rgrip - 2, top), (0, top),
    ]).translate([rgrip - FLAT - 5, 0, 0])   # shifted so the flat is 21 mm wide
    handle = pin - slot + grip
    return handle.trim_by_plane([1, 0, 0], -FLAT)   # flat to print on


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
          f"{size} mm, status {solid.status().name}")


reel = build_reel()
handle = build_handle()

# ---- Fit checks in the assembled position -------------------------------------
seated = (reel ^ handle).volume()
slack = (reel ^ handle.translate([0, 0, -AXIAL_PLAY * 0.9])).volume()
pulled = (reel ^ handle.translate([0, 0, -AXIAL_PLAY - 0.5])).volume()
print(f"overlap seated: {seated:.3f} mm3 (want 0)")
print(f"overlap at end of play: {slack:.3f} mm3 (want 0)")
print(f"overlap when pulled out further: {pulled:.1f} mm3 (want > 0: barbs catch)")

write_stl(reel, "string_line_reel.stl")
# lay the handle on its flat, ready to print
write_stl(handle.rotate([0, -90, 0]).translate([0, 0, FLAT]), "reel_handle.stl")
