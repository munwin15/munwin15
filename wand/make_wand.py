"""Generate a 3D-printable vine-wrapped wooden wand.

Outputs (all in millimetres, in this folder):
  vine_wand.3mf      one object, two parts: "wand" (brown) and "vine" (green)
  wand_brown.stl     the wood on its own
  vine_green.stl     the vine and leaves on its own

The two parts share an exact interface (the vine is cut out of the wood), so
they never overlap and slice cleanly as a two-colour print.

Requires: numpy, scipy, trimesh, manifold3d
"""

import os
import zipfile

import numpy as np
import trimesh
from manifold3d import Manifold, Mesh
from scipy.interpolate import PchipInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)

L = 240.0  # overall length; fits a 256 mm bed lying flat
N_AROUND = 128
DS = 0.35

# ---------------------------------------------------------------------------
# Centreline: a gently wandering branch rather than a ruler-straight rod.

def centreline(s):
    t = s / L
    y = 2.2 * np.sin(np.pi * t * 1.25 + 0.3) + 0.8 * np.sin(np.pi * t * 3.1)
    z = 0.9 * np.sin(np.pi * t * 0.9) - 0.5 * np.sin(np.pi * t * 2.3 + 1.0)
    return np.stack([s, y, z], axis=-1)


def frames(points):
    """Parallel-transport frames (tangent, normal, binormal) along a polyline."""
    tan = np.gradient(points, axis=0)
    tan /= np.linalg.norm(tan, axis=1, keepdims=True)
    n = np.zeros_like(points)
    ref = np.array([0.0, 0.0, 1.0])
    if abs(tan[0] @ ref) > 0.9:
        ref = np.array([0.0, 1.0, 0.0])
    n[0] = ref - tan[0] * (tan[0] @ ref)
    n[0] /= np.linalg.norm(n[0])
    for i in range(1, len(points)):
        v = n[i - 1] - tan[i] * (tan[i] @ n[i - 1])
        n[i] = v / np.linalg.norm(v)
    b = np.cross(tan, n)
    return tan, n, b


# ---------------------------------------------------------------------------
# Wood radius: knobbly pommel, twisted grip, collar, tapering shaft, bark
# grain and a few knots.

_prof_s = np.array([0, 6, 12, 20, 34, 60, 80, 86, 90, 96, 130, 180, 225, L])
_prof_r = np.array([10.5, 11.6, 10.6, 9.6, 10.2, 9.9, 9.4, 8.3, 8.9, 7.6, 6.6, 5.3, 4.0, 3.4])
_profile = PchipInterpolator(_prof_s, _prof_r)

# Bark grain: long shallow ridges that drift slightly around the branch.
_grain = [(k, rng.uniform(0, 2 * np.pi), rng.uniform(0.6, 1.0), rng.uniform(-0.012, 0.012))
          for k in (5, 7, 9, 11, 13, 17)]

# Knots: (s, theta, height, size). Kept off the very tip.
_knots = [(45, 2.4, 1.7, 4.2), (72, 5.6, 1.5, 3.6), (112, 0.9, 1.3, 3.2),
          (150, 3.9, 1.0, 2.8), (190, 1.8, 0.7, 2.3), (25, 4.6, 1.4, 4.0)]


def twist_phase(s):
    return 2 * np.pi * 1.6 * s / 85.0


def wood_radius(s, th, with_detail=True):
    """Radius of the wood at arc position s (mm) and angle th (rad)."""
    s = np.asarray(s, float)
    th = np.asarray(th, float)
    r = _profile(np.clip(s, 0, L))

    # Twisted, two-stranded grip that fades out past the collar.
    grip = np.clip((92 - s) / 10, 0, 1) * np.clip((s - 3) / 6, 0, 1)
    r = r * (1 + 0.11 * grip * np.cos(2 * th - twist_phase(s)))

    if with_detail:
        bark_amp = 0.30 * grip + 0.14 * (1 - grip) * (r / 6.0)
        g = 0
        for k, ph, a, drift in _grain:
            g = g + a * np.sin(k * th + ph + drift * s + 0.6 * np.sin(s / 17 + ph))
        r = r + bark_amp * g / 3.0
        # Gentle growth rings along the length.
        r = r + 0.12 * np.sin(s / 3.3) * (r / 8)
        for ks, kt, kh, ksize in _knots:
            dth = np.angle(np.exp(1j * (th - kt)))
            arc = dth * r
            d2 = ((s - ks) ** 2 + arc ** 2) / ksize ** 2
            bump = kh * np.exp(-d2) - 0.55 * kh * np.exp(-d2 * 6)  # raised rim, sunken eye
            r = r + bump
    return r


def end_rounding(s, r):
    """Round both ends into domes so the solid closes smoothly."""
    r = np.array(r, float)
    rc0 = 9.0
    head = s < rc0
    r[head] *= np.sqrt(np.clip(1 - ((rc0 - s[head]) / rc0) ** 2, 0, 1)) ** 0.8
    rc1 = 3.4
    tail = s > L - rc1
    r[tail] *= np.sqrt(np.clip(1 - ((s[tail] - (L - rc1)) / rc1) ** 2, 0, 1))
    return r


# Sample positions along the wand, denser at both ends for clean caps.
def _wand_stations():
    core = np.arange(0.5, L - 0.5, DS)
    head = 9.0 * (1 - np.cos(np.linspace(0, np.pi / 2, 30))) ** 1.0
    tail = L - 3.4 * (1 - np.cos(np.linspace(0, np.pi / 2, 20)))
    s = np.unique(np.concatenate([head[1:], core, tail[1:]]))
    return s[(s > 0) & (s < L)]


S = _wand_stations()
C = centreline(S)
T, Nn, B = frames(C)
TH = np.linspace(0, 2 * np.pi, N_AROUND, endpoint=False)


def frame_at(s):
    """Interpolated centre and frame at arbitrary s."""
    i = np.clip(np.searchsorted(S, s), 1, len(S) - 1)
    w = (s - S[i - 1]) / (S[i] - S[i - 1])
    w = np.asarray(w)[..., None]
    lerp = lambda a: a[i - 1] * (1 - w) + a[i] * w
    c, n, b = lerp(C), lerp(Nn), lerp(B)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    b /= np.linalg.norm(b, axis=-1, keepdims=True)
    return c, n, b


def surface_point(s, th, lift):
    c, n, b = frame_at(s)
    r = end_rounding(np.atleast_1d(s), wood_radius(s, th)) if np.ndim(s) else wood_radius(s, th)
    rr = (r + lift)[..., None]
    return c + rr * (np.cos(th)[..., None] * n + np.sin(th)[..., None] * b)


# ---------------------------------------------------------------------------
# Mesh helpers

def tube_mesh(rings, start_pole, end_pole):
    """Closed mesh from a stack of rings (M x K x 3) plus two pole points."""
    m, k, _ = rings.shape
    verts = np.vstack([rings.reshape(-1, 3), start_pole, end_pole])
    p0, p1 = m * k, m * k + 1
    faces = []
    idx = np.arange(m * k).reshape(m, k)
    a = idx[:-1]
    b_ = np.roll(idx[:-1], -1, axis=1)
    c = np.roll(idx[1:], -1, axis=1)
    d = idx[1:]
    faces.append(np.stack([a, b_, c], -1).reshape(-1, 3))
    faces.append(np.stack([a, c, d], -1).reshape(-1, 3))
    first = idx[0]
    faces.append(np.stack([np.full(k, p0), np.roll(first, -1), first], -1))
    last = idx[-1]
    faces.append(np.stack([np.full(k, p1), last, np.roll(last, -1)], -1))
    faces = np.vstack(faces)
    return orient(verts, faces)


def orient(verts, faces):
    tm = trimesh.Trimesh(verts, faces, process=False)
    if tm.volume < 0:
        faces = faces[:, ::-1]
    return verts, faces


def to_manifold(verts, faces):
    m = Manifold(Mesh(vert_properties=np.asarray(verts, np.float32),
                      tri_verts=np.asarray(faces, np.uint32)))
    if m.status().name != "NoError":
        raise RuntimeError(f"non-manifold input: {m.status()}")
    return m


def from_manifold(m):
    mesh = m.to_mesh()
    tm = trimesh.Trimesh(np.asarray(mesh.vert_properties)[:, :3],
                         np.asarray(mesh.tri_verts), process=True)
    # Booleans can leave zero-volume slivers where a leaf grazes the bark.
    bodies = [b for b in tm.split(only_watertight=False) if abs(b.volume) > 1.0]
    return trimesh.util.concatenate(bodies)


# ---------------------------------------------------------------------------
# Wood

def build_wood():
    th = TH[None, :]
    r = wood_radius(S[:, None], th)
    r = end_rounding(np.repeat(S[:, None], N_AROUND, 1).ravel(), r.ravel()).reshape(r.shape)
    rings = C[:, None, :] + r[..., None] * (np.cos(th)[..., None] * Nn[:, None, :]
                                            + np.sin(th)[..., None] * B[:, None, :])
    return tube_mesh(rings, centreline(np.array([0.0]))[0], centreline(np.array([L]))[0])


# ---------------------------------------------------------------------------
# Vine: winds from the grip towards the tip, sitting partly sunk into the wood.

VINE_S0, VINE_S1 = 7.0, 222.0


def vine_radius(s):
    t = (s - VINE_S0) / (VINE_S1 - VINE_S0)
    r = 2.6 - 1.25 * t                      # thicker than before: 2.6 -> 1.35 mm
    r *= 1 + 0.06 * np.sin(s / 4.1)         # slight swelling, like a real stem
    grow_in = np.clip((s - VINE_S0) / 6, 0, 1)
    r *= 0.35 + 0.65 * np.sin(grow_in * np.pi / 2)
    return r


def vine_angle(s):
    # Turns get a little closer together towards the tip, with some wander.
    u = (s - VINE_S0) / (VINE_S1 - VINE_S0)
    turns = 5.6 * u + 1.0 * u ** 2
    return 2 * np.pi * turns + 0.9 + 0.22 * np.sin(s / 9.0) + 0.1 * np.sin(s / 3.7)


def vine_path(s):
    th = vine_angle(s)
    rv = vine_radius(s)
    lift = 0.30 * rv          # centre just above the bark: ~35% of the stem is embedded
    base = wood_radius(s, th, with_detail=False)
    c, n, b = frame_at(s)
    rr = (base + lift)[:, None]
    return c + rr * (np.cos(th)[:, None] * n + np.sin(th)[:, None] * b)


def build_vine():
    s = np.linspace(VINE_S0, VINE_S1, 1400)
    p = vine_path(s)
    tan, n, b = frames(p)
    rv = vine_radius(s)
    # Round tip.
    tip_len = 2.0
    near_tip = s > VINE_S1 - tip_len
    rv[near_tip] *= np.sqrt(np.clip(1 - ((s[near_tip] - (VINE_S1 - tip_len)) / tip_len) ** 2, 0.04, 1))
    k = 24
    a = np.linspace(0, 2 * np.pi, k, endpoint=False)
    rings = p[:, None, :] + rv[:, None, None] * (np.cos(a)[None, :, None] * n[:, None, :]
                                                 + np.sin(a)[None, :, None] * b[:, None, :])
    start_pole = p[0] - tan[0] * rv[0]
    end_pole = p[-1] + tan[-1] * 0.25
    return tube_mesh(rings, start_pole, end_pole)


# ---------------------------------------------------------------------------
# Leaves: bent to hug the wood so they print without fragile overhangs.

def build_leaf(s0, side, length, width):
    th0 = vine_angle(np.array([s0]))[0]
    r0 = wood_radius(np.array([s0]), np.array([th0]), with_detail=False)[0]
    # Vine direction in surface coordinates (along, around-arc).
    ds = 0.5
    th1 = vine_angle(np.array([s0 + ds]))[0]
    vdir = np.array([ds, (th1 - th0) * r0])
    vdir /= np.linalg.norm(vdir)
    ang = np.radians(48) * side
    rot = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
    d = rot @ vdir
    perp = np.array([-d[1], d[0]])

    nu, nr = 40, 20
    u = (1 - np.cos(np.linspace(0, np.pi, nu))) / 2   # denser at base and tip
    u = u[1:-1]
    alpha = np.linspace(0, 2 * np.pi, nr, endpoint=False)
    w = width * np.sin(np.pi * u ** 0.75) ** 0.85 / 2
    thick = 1.5 - 0.6 * u                              # 1.5 mm at the stem, 0.9 at the tip
    U, A = np.meshgrid(u, alpha, indexing="ij")
    V = (w[:, None] * np.cos(A))
    half = (thick[:, None] / 2) * np.clip(np.abs(np.sin(A)), 0, 1) ** 0.6 * np.sign(np.sin(A))
    vn = V / np.maximum(w[:, None], 1e-6)
    # Soft midrib on the top face and a slight upward cup at the edges.
    half = half + np.where(np.sin(A) > 0, 0.25 * np.exp(-(vn / 0.2) ** 2), 0)
    curl = 0.35 * vn ** 2
    lift = -0.6 + 1.0 * U ** 1.8 + curl                 # base tucked into the vine, tip lifts ~0.4 mm
    H = lift + 0.75 + half

    along = U * length
    plane = (along[..., None] * d + V[..., None] * perp)  # (nu, nr, 2)
    s_pts = s0 + plane[..., 0]
    arc = plane[..., 1]
    th = th0 + arc / r0
    rings = surface_point(s_pts, th, H)

    def pole(uu, h):
        pp = np.array([uu * length]) * d[:, None]
        sp, ap = s0 + pp[0], th0 + pp[1] / r0
        return surface_point(sp, ap, np.array([h]))[0]

    return tube_mesh(rings, pole(0.0, -0.6 + 0.75), pole(1.0, 0.4 + 0.75))


def build_leaves():
    leaves = []
    positions = np.linspace(20, 200, 10)
    for i, s0 in enumerate(positions):
        s0 = s0 + rng.uniform(-4, 4)
        t = (s0 - 20) / 180
        length = 21 - 8 * t
        width = length * rng.uniform(0.42, 0.5)
        leaves.append(build_leaf(s0, 1 if i % 2 == 0 else -1, length, width))
    return leaves


# ---------------------------------------------------------------------------
# 3MF writer: one object made of two coloured parts.

def write_3mf(path, parts):
    """parts: list of (name, hex colour, trimesh)."""
    objs = []
    for i, (name, colour, mesh) in enumerate(parts):
        v = "".join(f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>' for x, y, z in mesh.vertices)
        t = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in mesh.faces)
        objs.append(
            f'<object id="{i + 2}" name="{name}" type="model" pid="1" pindex="{i}">'
            f'<mesh><vertices>{v}</vertices><triangles>{t}</triangles></mesh></object>')
    mats = "".join(f'<base name="{n}" displaycolor="{c}FF"/>' for n, c, _ in parts)
    comps = "".join(f'<component objectid="{i + 2}"/>' for i in range(len(parts)))
    top = len(parts) + 2
    model = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
        '<metadata name="Title">Vine Wand</metadata>'
        f'<resources><basematerials id="1">{mats}</basematerials>{"".join(objs)}'
        f'<object id="{top}" name="Vine Wand" type="model"><components>{comps}</components></object>'
        f'</resources><build><item objectid="{top}"/></build></model>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
            'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
    ctypes = ('<?xml version="1.0" encoding="UTF-8"?>\n'
              '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
              '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
              '</Types>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ctypes)
        z.writestr("_rels/.rels", rels)
        z.writestr("3D/3dmodel.model", model)


def main():
    wood = to_manifold(*build_wood())
    vine = to_manifold(*build_vine())
    for leaf in build_leaves():
        vine = vine + to_manifold(*leaf)
    wood = wood - vine

    # Sit the wand on the build plate.
    zmin = min(wood.bounding_box()[2], vine.bounding_box()[2])
    wood = wood.translate([0, 0, -zmin])
    vine = vine.translate([0, 0, -zmin])

    wood_m, vine_m = from_manifold(wood), from_manifold(vine)
    for name, m in (("wand", wood_m), ("vine", vine_m)):
        print(f"{name}: {len(m.faces)} tris, watertight={m.is_watertight}, "
              f"volume={m.volume / 1000:.1f} cm^3, bodies={len(m.split(only_watertight=False))}")
    print("size (mm):", np.round(wood_m.bounds[1] - wood_m.bounds[0], 1))

    wood_m.export(os.path.join(HERE, "wand_brown.stl"))
    vine_m.export(os.path.join(HERE, "vine_green.stl"))
    write_3mf(os.path.join(HERE, "vine_wand.3mf"),
              [("wand", "#6B3E26", wood_m), ("vine", "#3F8A3A", vine_m)])


if __name__ == "__main__":
    main()
