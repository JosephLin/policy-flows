import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { nodes, lanes, resources, state, set, initUI, activeLanes, roleOf, showTip, hideTip } from "./ui.js";
import { createEnv } from "./env.js";

const host = document.querySelector("#world");
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const dark = matchMedia("(prefers-color-scheme: dark)");
// An explicit data-theme on <html> (set by the artifact viewer) wins over the OS setting.
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : dark.matches;
};

// The scene keeps its own day and night palettes, so the 夜晚 toggle works in either
// page theme; it starts out matching the theme. Resource colors still come from CSS.
const PALETTE = {
  day: { "--sky": "#eaf1ec", "--sky-top": "#9cc6dc", "--sea": "#74aebd", "--ground": "#bdd29a", "--ground-off": "#dad8d3", "--cliff": "#c8a77c", "--rock": "#9b9285" },
  night: { "--sky": "#2c3549", "--sky-top": "#0b1120", "--sea": "#2a4c5f", "--ground": "#556b48", "--ground-off": "#3b3c3f", "--cliff": "#5e4b38", "--rock": "#4b4842" },
};
state.night = isDark();
const tone = (key) => PALETTE[state.night ? "night" : "day"][key] ?? css(key);

// ---- renderer, camera, light -------------------------------------------------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  host.innerHTML = `<p class="nogl card">這個瀏覽器無法執行 WebGL，<a href="flat.html">改看平面地圖</a>。</p>`;
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Neutral tone mapping softens highlights without shifting the resource colors.
renderer.toneMapping = THREE.NeutralToneMapping;
host.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = "labels";
host.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = 1.25;
controls.minDistance = 4;
controls.maxDistance = 32;
let userMoved = false;
controls.addEventListener("start", () => (userMoved = true));

const hemi = new THREE.HemisphereLight();
const sun = new THREE.DirectionalLight(0xffffff);
sun.position.set(-6, 12, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.normalBias = 0.02;
scene.add(hemi, sun);

sun.shadow.intensity = 0.8;
const env = createEnv(scene, { css: tone, isDark: () => state.night });

// ---- materials that tint for the info view -----------------------------------
// Every island material is registered with its base color; render() sets a target and
// the frame loop eases toward it. `key` entries re-read their base from CSS on theme change.
const tints = new Map(); // island id -> [{ m, base, target, key }]
const matCache = new Map();
// Smooth-shaded by default for a soft, toy-like finish; `flat` for rock and roof
// planes that should read as facets.
function mat(id, color, key, flat = false) {
  const k = `${id}|${key || color}|${flat}`;
  if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({ color: key ? tone(key) : color, roughness: 0.8, flatShading: flat });
  tints.get(id).push({ m, base: m.color.clone(), target: m.color.clone(), key });
  matCache.set(k, m);
  return m;
}
// Windows and street lamps glow at dusk (dark theme); applyTheme sets their emissive.
const glowing = [];
const winMat = (id) => {
  const m = mat(id, "#4a5a6c");
  if (!glowing.includes(m)) glowing.push(m);
  return m;
};
const lampMat = new THREE.MeshStandardMaterial({ color: "#fff4d8", emissive: "#ffc66e", emissiveIntensity: 0 });

const G = {
  // Every box has softly rounded edges; scaled, the corners stay proportionate.
  box: new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
  roof: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
  pine: new THREE.ConeGeometry(1, 1, 7),
  bush: new THREE.IcosahedronGeometry(1, 0),
  trunk: new THREE.CylinderGeometry(0.035, 0.045, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  arrow: new THREE.ConeGeometry(0.1, 0.26, 12),
  // A triangular prism, ridge along x, base on y = 0, sized 1 × 1 × 1.
  gable: new THREE.CylinderGeometry(1, 1, 1, 3).rotateY(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.5, 0).scale(1, 1 / 1.5, 1 / Math.sqrt(3)),
  blob: new THREE.IcosahedronGeometry(1, 1),
  petal: new THREE.SphereGeometry(0.016, 6, 4),
  lampHead: new THREE.SphereGeometry(0.027, 12, 8),
  pebble: new THREE.IcosahedronGeometry(1, 0),
  crown: new THREE.SphereGeometry(1, 16, 12),
  cone: new THREE.ConeGeometry(1, 1, 12),
  fruit: new THREE.SphereGeometry(0.014, 8, 6),
  dot: new THREE.SphereGeometry(0.06, 12, 8),
};

const WALLS = ["#f4eee2", "#ebe1cf", "#f7f2e8", "#e6dccb"];
const ROOFS = ["#d9612f", "#c4523f", "#3f70b2", "#c9930f", "#4f8c55", "#8a5bb8", "#b5473f", "#2e8a8a"];
const LEAVES = ["#5d9a55", "#4c8a4a", "#73ad5f", "#3f7d4c"];

function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// ---- props -------------------------------------------------------------------
// `top` is the island's surface height; all helpers place things on it.
function mesh(g, geo, m, x, y, z, sx, sy, sz) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  g.add(o);
  return o;
}
// A chunky, toy-like building: stone plinth, rounded walls, framed windows with a
// mullion, a framed door under a small awning, and a thick hip, gable or flat roof.
// Roof planes stay flat-shaded so their slopes read; everything else is soft.
const TRIM = "#fbf7ee", STONE = "#cfc5b3", DOORS = ["#8a5a3c", "#3f7f8c", "#b5473f", "#5b6f9a"];
function windowAt(p, id, x, y, z, s, ww, wh) {
  mesh(p, G.box, mat(id, TRIM), x, y, z, ww + 0.014, wh + 0.014, 0.01);
  mesh(p, G.box, winMat(id), x, y, z + s * 0.004, ww, wh, 0.008);
  mesh(p, G.box, mat(id, TRIM), x, y, z + s * 0.007, 0.005, wh, 0.004);
  mesh(p, G.box, mat(id, TRIM), x, y - wh / 2 - 0.006, z + s * 0.008, ww + 0.02, 0.008, 0.016);
}
function house(g, id, top, x, z, w, d, h, wall, roof, rot = 0, kind = "hip", rand = Math.random) {
  const p = new THREE.Group();
  p.position.set(x, top, z);
  p.rotation.y = rot;
  g.add(p);
  const base = 0.024, roofY = base + h;
  mesh(p, G.box, mat(id, STONE), 0, base / 2, 0, w + 0.03, base, d + 0.03);
  mesh(p, G.box, mat(id, wall), 0, base + h / 2, 0, w, h, d);
  const floors = Math.max(1, Math.round(h / 0.11)), fh = h / floors, two = w > 0.15;
  const ww = Math.min(0.048, w * (two ? 0.26 : 0.4)), wh = Math.min(0.044, fh * 0.48);
  for (let f = 0; f < floors; f++)
    for (const s of [-1, 1])
      for (const k of two ? [-1, 1] : [0]) {
        if (f === 0 && s === 1 && (two ? k === 1 : true)) continue; // the door's spot
        windowAt(p, id, k * w * 0.24, base + fh * (f + 0.55), s * (d / 2 + 0.004), s, ww, wh);
      }
  // Door, frame, awning and step on the front face.
  const dx = two ? w * 0.24 : 0, dh = Math.min(0.075, fh * 0.75);
  mesh(p, G.box, mat(id, TRIM), dx, base + dh / 2, d / 2 + 0.004, 0.05, dh + 0.012, 0.01);
  mesh(p, G.box, mat(id, DOORS[Math.floor(rand() * DOORS.length)]), dx, base + dh / 2, d / 2 + 0.008, 0.036, dh, 0.006);
  mesh(p, G.box, mat(id, roof), dx, base + dh + 0.016, d / 2 + 0.02, 0.064, 0.012, 0.036);
  mesh(p, G.box, mat(id, STONE), dx, 0.008, d / 2 + 0.026, 0.06, 0.016, 0.03);
  if (kind === "flat") {
    mesh(p, G.box, mat(id, TRIM), 0, roofY + 0.014, 0, w * 1.06, 0.028, d * 1.06);
    mesh(p, G.box, mat(id, roof), w * 0.18, roofY + 0.055, -d * 0.12, w * 0.32, 0.06, d * 0.32);
    return;
  }
  const roofMat = mat(id, roof, null, true);
  if (kind === "gable") {
    mesh(p, G.box, mat(id, TRIM), 0, roofY + 0.006, 0, w * 1.04, 0.012, d * 1.04);
    mesh(p, G.gable, roofMat, 0, roofY + 0.01, 0, w * 1.2, 0.13, d * 1.26);
  } else mesh(p, G.roof, roofMat, 0, roofY + 0.085, 0, w * 1.24, 0.17, d * 1.24);
  if (rand() < 0.55) mesh(p, G.box, mat(id, "#b8664a"), -w * 0.26, roofY + 0.09, -d * 0.12, 0.032, 0.09, 0.032);
}
// Fluffy round trees (some with fruit) and stacked, rounded pines.
const FRUIT = ["#f08a4b", "#e8524f", "#f2c14e"];
function tree(g, id, top, x, z, s, rand) {
  const t = new THREE.Group();
  t.position.set(x, top, z);
  t.rotation.y = rand() * Math.PI * 2;
  g.add(t);
  mesh(t, G.cyl, mat(id, "#8a6446"), 0, 0.07 * s, 0, 0.022 * s, 0.14 * s, 0.022 * s);
  const leaf = mat(id, LEAVES[Math.floor(rand() * LEAVES.length)]);
  if (rand() < 0.4) {
    for (const [y, r, hgt] of [[0.17, 0.15, 0.17], [0.27, 0.115, 0.15], [0.36, 0.08, 0.13]]) mesh(t, G.cone, leaf, 0, y * s, 0, r * s, hgt * s, r * s);
    return;
  }
  mesh(t, G.crown, leaf, 0, 0.25 * s, 0, 0.125 * s, 0.115 * s, 0.125 * s);
  mesh(t, G.crown, leaf, 0.07 * s, 0.2 * s, 0.03 * s, 0.085 * s, 0.08 * s, 0.085 * s);
  mesh(t, G.crown, leaf, -0.06 * s, 0.21 * s, -0.04 * s, 0.085 * s, 0.078 * s, 0.085 * s);
  if (rand() < 0.35) {
    const fruit = mat(id, FRUIT[Math.floor(rand() * FRUIT.length)]);
    for (let k = 0; k < 4; k++) {
      const a = rand() * Math.PI * 2;
      mesh(t, G.fruit, fruit, Math.sin(a) * 0.12 * s, (0.2 + rand() * 0.08) * s, Math.cos(a) * 0.12 * s, s, s, s);
    }
  }
}
function lamp(g, id, top, x, z) {
  mesh(g, G.cyl, mat(id, "#7d9188"), x, top + 0.085, z, 0.009, 0.17, 0.009);
  mesh(g, G.cyl, mat(id, "#7d9188"), x, top + 0.215, z, 0.026, 0.012, 0.026);
  mesh(g, G.lampHead, lampMat, x, top + 0.19, z, 1, 1, 1);
}
const PETALS = ["#e86a8a", "#f2c14e", "#fbf6ee", "#b77fe0", "#ef8a4b"];
function flowers(g, id, top, x, z, rand) {
  mesh(g, G.blob, mat(id, "#6f9c55"), x, top + 0.01, z, 0.07, 0.02, 0.07);
  for (let k = 0; k < 6; k++)
    mesh(g, G.petal, mat(id, PETALS[Math.floor(rand() * PETALS.length)]), x + (rand() - 0.5) * 0.11, top + 0.026, z + (rand() - 0.5) * 0.11, 1, 1, 1);
}

// A landmark per island so each policy reads at a glance. Returns its footprint
// radius, which decides whether the inner ring of plots stays free.
const LANDMARKS = {
  civil(g, id, top, accent) {
    mesh(g, G.box, mat(id, "#f2ece0"), 0, top + 0.42, 0, 0.32, 0.84, 0.32);
    mesh(g, G.roof, mat(id, accent), 0, top + 0.94, 0, 0.38, 0.2, 0.38);
    mesh(g, G.cyl, mat(id, "#6b6460"), 0, top + 1.2, 0, 0.01, 0.34, 0.01);
    mesh(g, G.box, mat(id, accent), 0.07, top + 1.31, 0, 0.13, 0.08, 0.01);
    return 0.25;
  },
  institute(g, id, top) {
    mesh(g, G.cyl, mat(id, "#efe9de"), 0, top + 0.12, 0, 0.3, 0.24, 0.3);
    const dome = new THREE.SphereGeometry(0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    mesh(g, dome, mat(id, "#9cb8d6"), 0, top + 0.24, 0, 1, 1, 1);
    return 0.3;
  },
  transport(g, id, top, accent) {
    mesh(g, G.box, mat(id, "#e9e2d4"), 0, top + 0.1, 0, 0.78, 0.2, 0.26);
    mesh(g, G.box, mat(id, accent), 0, top + 0.23, 0, 0.88, 0.05, 0.36);
    mesh(g, G.box, mat(id, "#5a5550"), 0, top + 0.012, 0.3, 1.3, 0.02, 0.14);
    mesh(g, G.box, mat(id, "#e9b627"), -0.2, top + 0.08, 0.3, 0.3, 0.12, 0.1);
    return 0.5;
  },
  education(g, id, top, accent) {
    house(g, id, top, -0.12, 0, 0.62, 0.24, 0.26, "#f3ede1", accent);
    house(g, id, top, 0.22, 0.2, 0.22, 0.3, 0.22, "#f3ede1", accent);
    mesh(g, G.box, mat(id, "#efe8dc"), -0.12, top + 0.42, 0, 0.12, 0.3, 0.12);
    mesh(g, G.roof, mat(id, accent), -0.12, top + 0.62, 0, 0.16, 0.12, 0.16);
    return 0.45;
  },
  lunch(g, id, top) {
    const glass = new THREE.MeshStandardMaterial({ color: "#cfe8d4", transparent: true, opacity: 0.7, roughness: 0.2 });
    tints.get(id).push({ m: glass, base: glass.color.clone(), target: glass.color.clone() });
    mesh(g, G.box, glass, 0, top + 0.12, -0.12, 0.56, 0.24, 0.3);
    for (let k = 0; k < 3; k++) mesh(g, G.box, mat(id, "#6aa84f"), -0.2 + k * 0.2, top + 0.03, 0.22, 0.12, 0.06, 0.24);
    return 0.45;
  },
  family(g, id, top, accent) {
    house(g, id, top, 0, 0, 0.4, 0.34, 0.3, "#f6efe2", accent);
    mesh(g, G.box, mat(id, "#8a6a4a"), 0, top + 0.08, 0.175, 0.08, 0.16, 0.01);
    return 0.28;
  },
  card(g, id, top, accent) {
    mesh(g, G.box, mat(id, "#efe8dc"), -0.2, top + 0.2, 0, 0.07, 0.4, 0.07);
    mesh(g, G.box, mat(id, "#efe8dc"), 0.2, top + 0.2, 0, 0.07, 0.4, 0.07);
    mesh(g, G.box, mat(id, accent), 0, top + 0.43, 0, 0.52, 0.08, 0.1);
    return 0.26;
  },
  welfare(g, id, top, accent) {
    mesh(g, G.box, mat(id, "#f7f4ee"), 0, top + 0.17, 0, 0.5, 0.34, 0.34);
    mesh(g, G.box, mat(id, accent), 0, top + 0.36, 0, 0.18, 0.04, 0.06);
    mesh(g, G.box, mat(id, accent), 0, top + 0.36, 0, 0.06, 0.04, 0.18);
    return 0.3;
  },
  sport(g, id, top) {
    mesh(g, G.box, mat(id, "#5f9e4f"), 0, top + 0.01, 0, 0.84, 0.02, 0.52);
    const line = mat(id, "#f4f1ea");
    mesh(g, G.box, line, 0, top + 0.022, 0, 0.02, 0.005, 0.5);
    for (const s of [-1, 1]) mesh(g, G.box, line, s * 0.41, top + 0.022, 0, 0.02, 0.005, 0.5);
    for (const s of [-1, 1]) mesh(g, G.box, line, 0, top + 0.022, s * 0.25, 0.84, 0.005, 0.02);
    return 0.5;
  },
  trails(g, id, top) {
    mesh(g, G.pine, mat(id, "#7c8f6a"), -0.05, top + 0.36, -0.05, 0.5, 0.72, 0.5);
    mesh(g, G.pine, mat(id, "#f3f1ea"), -0.05, top + 0.63, -0.05, 0.16, 0.18, 0.16);
    return 0.5;
  },
  forest(g, id, top, accent, rand) {
    for (const [x, z, s] of [[0, 0, 1.9], [0.2, 0.12, 1.4], [-0.18, 0.14, 1.5], [0.02, -0.2, 1.3]]) tree(g, id, top, x, z, s, rand);
    return 0.3;
  },
  youth(g, id, top, accent) {
    mesh(g, G.box, mat(id, "#f0e9dc"), 0, top + 0.12, 0, 0.36, 0.24, 0.3);
    mesh(g, G.box, mat(id, accent), 0.05, top + 0.33, 0.03, 0.3, 0.18, 0.24);
    mesh(g, G.box, mat(id, "#f0e9dc"), -0.03, top + 0.5, -0.02, 0.22, 0.16, 0.2);
    return 0.26;
  },
  diplomacy(g, id, top) {
    mesh(g, G.cyl, mat(id, "#e9e2d6"), 0, top + 0.08, 0, 0.18, 0.16, 0.18);
    mesh(g, new THREE.IcosahedronGeometry(0.2, 1), mat(id, "#4a86c8"), 0, top + 0.36, 0, 1, 1, 1);
    const ring = mesh(g, new THREE.TorusGeometry(0.27, 0.012, 6, 32), mat(id, "#c9930f"), 0, top + 0.36, 0, 1, 1, 1);
    ring.rotation.x = 1.2;
    return 0.28;
  },
  hakka(g, id, top, accent) {
    // A round earthen house: open wall ring with a tiled roof ring on top.
    const wall = mat(id, "#d9c39a");
    wall.side = THREE.DoubleSide;
    mesh(g, new THREE.CylinderGeometry(0.36, 0.36, 0.22, 28, 1, true), wall, 0, top + 0.11, 0, 1, 1, 1);
    const roof = mesh(g, new THREE.RingGeometry(0.2, 0.41, 28), mat(id, "#6b4a3a"), 0, top + 0.23, 0, 1, 1, 1);
    roof.rotation.x = -Math.PI / 2;
    roof.material.side = THREE.DoubleSide;
    mesh(g, G.cyl, mat(id, accent), 0, top + 0.06, 0, 0.08, 0.12, 0.08);
    return 0.45;
  },
  police(g, id, top) {
    mesh(g, G.cyl, mat(id, "#e7e3dc"), 0, top + 0.25, 0, 0.06, 0.5, 0.06);
    mesh(g, new THREE.SphereGeometry(0.09, 12, 8), mat(id, "#2f74d0"), 0, top + 0.54, 0, 1, 1, 1);
    return 0.2;
  },
  community(g, id, top, accent) {
    house(g, id, top, 0, 0, 0.3, 0.3, 0.16, "#f2ebdd", accent);
    return 0.2;
  },
  farm(g, id, top) {
    for (let k = 0; k < 3; k++) mesh(g, G.box, mat(id, "#7fae4f"), -0.15 + k * 0.15, top + 0.025, 0.12, 0.09, 0.05, 0.22);
    house(g, id, top, 0, -0.18, 0.26, 0.16, 0.14, "#b5473f", "#6b4a3a");
    return 0.3;
  },
};

// ---- islands -----------------------------------------------------------------
const xs = [...nodes.values()].map((n) => n.x), zs = [...nodes.values()].map((n) => n.y);
const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
const islands = new Map(); // id -> { g, top, label, roleEl, lift }
const pickables = [];
const world = new THREE.Group();
scene.add(world);

// Hex neighbors, each tagged with the edge (0–5, clockwise from 30°) it shares.
const edgeIdx = (dx, dz) => (((Math.round(((Math.atan2(dx, dz) * 180) / Math.PI - 30) / 60) % 6) + 6) % 6);
const nbrs = new Map([...nodes.keys()].map((id) => [id, []]));
for (const A of nodes.values())
  for (const B of nodes.values()) {
    const dx = B.x - A.x, dz = B.y - A.y;
    if (A !== B && Math.abs(Math.hypot(dx, dz) - Math.sqrt(3)) < 0.01) nbrs.get(A.id).push({ id: B.id, k: edgeIdx(dx, dz) });
  }
const bridged = (id, k) => nbrs.get(id).some((e) => e.k === k);

// Each island has a ring road (12 points: corners at even indices, edge midpoints at
// odd) and spokes out to the bridges; people walk only on these.
const RING = (n) => (n.port ? 0.3 : 0.62);
const EDGE = (n) => (n.port ? 0.54 : 0.9);
const ringLocal = (n, idx) => {
  const a = (idx * Math.PI) / 6, r = idx % 2 ? RING(n) * Math.cos(Math.PI / 6) : RING(n);
  return [Math.sin(a) * r, Math.cos(a) * r];
};
const edgeLocal = (n, k) => {
  const a = (Math.PI / 3) * k + Math.PI / 6;
  return [Math.sin(a) * EDGE(n), Math.cos(a) * EDGE(n)];
};
// Merge an island's static meshes into one mesh per material: hundreds of small parts
// become a few dozen draw calls, and per-island materials keep the info-view tints.
function bake(g, id) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), byMat = new Map(), parts = [];
  g.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(geo);
    parts.push(o);
  });
  for (const o of parts) o.removeFromParent();
  for (const [m, geos] of byMat) g.add(new THREE.Mesh(mergeGeometries(geos), m));
  g.traverse((o) => {
    o.userData.id = id;
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
}

// A pointy-top hexagon in the xy plane that, after rotateX(-π/2), lines up with the
// island's hex (corner toward -z).
function hexShape(r) {
  return new THREE.Shape(Array.from({ length: 6 }, (_, k) => new THREE.Vector2(Math.sin((Math.PI / 3) * k) * r, Math.cos((Math.PI / 3) * k) * r)));
}
const CAP = { depth: 0.06, bevel: 0.035 };
function slab(parent, m, p1, p2, w, h = 0.008) {
  const o = new THREE.Mesh(G.box, m);
  o.position.copy(p1).add(p2).multiplyScalar(0.5);
  o.lookAt(p2);
  o.scale.set(w, h, p1.distanceTo(p2) + w * 0.5);
  parent.add(o);
  return o;
}

for (const n of nodes.values()) {
  tints.set(n.id, []);
  const rand = rng(n.id);
  const R = n.port ? 0.58 : 0.94, H = n.port ? 0.22 : 0.42, top = H - 0.12;
  const g = new THREE.Group();
  g.position.set(n.x - cx, 0, n.y - cz);
  world.add(g);

  // A beveled grass-and-earth cap on a rock base that tapers into the water.
  const earth = mat(n.id, null, "--cliff"), ground = mat(n.id, null, "--ground"), rock = mat(n.id, null, "--rock", true);
  const cap = new THREE.ExtrudeGeometry(hexShape(R - CAP.bevel), { depth: CAP.depth, bevelEnabled: true, bevelSize: CAP.bevel, bevelThickness: CAP.bevel, bevelSegments: 2 }).rotateX(-Math.PI / 2);
  const capMesh = new THREE.Mesh(cap, [ground, earth]);
  capMesh.position.y = top - CAP.depth - CAP.bevel;
  g.add(capMesh);
  const baseTop = top - CAP.depth - CAP.bevel * 2 + 0.01, baseH = baseTop + 0.5;
  mesh(g, new THREE.CylinderGeometry(R * 0.98, R * 0.84, baseH, 6), rock, 0, baseTop - baseH / 2, 0, 1, 1, 1);
  for (let k = 0; k < (n.port ? 2 : 4); k++) {
    const a = rand() * Math.PI * 2, rr = R * (0.92 + rand() * 0.1), s = 0.05 + rand() * 0.06;
    mesh(g, G.pebble, rock, Math.sin(a) * rr, 0.01, Math.cos(a) * rr, s, s * 0.7, s);
  }
  env.foam(g.position.x, g.position.z, R);

  const accent = ROOFS[(n.n || 3) % ROOFS.length];
  LANDMARKS[n.id](g, n.id, top, accent, rand);

  const road = mat(n.id, "#d6cdbb");
  const at = ([x, z]) => new THREE.Vector3(x, top + 0.004, z);
  for (let k = 0; k < 6; k++) slab(g, road, at(ringLocal(n, 2 * k)), at(ringLocal(n, 2 * k + 2)), 0.07);
  for (const { k } of nbrs.get(n.id)) slab(g, road, at(ringLocal(n, 2 * k + 1)), at(edgeLocal(n, k)), 0.07);
  // Street lamps just outside the ring road, stepped aside where a spoke leaves it.
  if (!n.port)
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6 + (bridged(n.id, k) ? 0.2 : 0), r = RING(n) * Math.cos(Math.PI / 6) + 0.07;
      lamp(g, n.id, top, Math.sin(a) * r, Math.cos(a) * r);
    }

  if (!n.port) {
    // Plots sit outside the ring road: houses in the corners, trees on edges without a bridge.
    const plots = [];
    for (let k = 0; k < 6; k++) plots.push([0.8, (Math.PI / 3) * k, true]);
    for (let k = 0; k < 6; k++) if (!bridged(n.id, k)) plots.push([0.72, (Math.PI / 3) * k + Math.PI / 6, false]);
    plots.sort(() => rand() - 0.5);
    const green = n.id === "forest" || n.id === "trails";
    let houses = green ? 2 : Math.min(n.b - 1, 6);
    for (const [r, a, corner] of plots) {
      const x = Math.sin(a) * r + (rand() - 0.5) * 0.04, z = Math.cos(a) * r + (rand() - 0.5) * 0.04;
      if (corner && houses-- > 0) {
        const w = 0.13 + rand() * 0.06, h = 0.12 + rand() * 0.16;
        const kind = h > 0.22 ? "flat" : rand() < 0.5 ? "gable" : "hip";
        house(g, n.id, top, x, z, w, w * (0.8 + rand() * 0.4), h, WALLS[Math.floor(rand() * WALLS.length)], rand() < 0.5 ? accent : ROOFS[Math.floor(rand() * ROOFS.length)], a, kind, rand);
      } else {
        const pick = rand();
        if (pick < 0.6) tree(g, n.id, top, x, z, 0.7 + rand() * 0.5, rand);
        else if (pick < 0.9) flowers(g, n.id, top, x, z, rand);
      }
    }
  }

  bake(g, n.id);
  pickables.push(g);

  const div = document.createElement("div");
  div.className = `lbl${n.port ? " port" : ""}`;
  const used = resources.filter((r) => lanes.some((l) => l.res === r.id && (l.a === n.id || l.b === n.id)));
  div.innerHTML = `<b>${n.n || ""}</b><span class="nm">${n.zh}</span><i class="rl"></i><span class="pips">${used.map((r) => `<span style="--c:var(--${r.id})"></span>`).join("")}</span>`;
  div.addEventListener("click", () => set({ focus: state.focus === n.id ? null : n.id, hoverFlow: null }));
  div.addEventListener("pointermove", (e) => showTip(n.id, e.clientX, e.clientY));
  div.addEventListener("pointerleave", hideTip);
  const label = new CSS2DObject(div);
  label.position.set(0, top + (n.port ? 0.75 : 1.05), 0);
  g.add(label);

  islands.set(n.id, { g, top, ground, label: div, roleEl: div.querySelector(".rl"), lift: 0 });
}

// Wooden bridges between neighboring islands, edge to edge.
const plank = new THREE.MeshStandardMaterial({ color: "#a8865f", roughness: 0.9, flatShading: true });
function worldPt(id, [x, z]) {
  const isl = islands.get(id), v = new THREE.Vector3(isl.g.position.x + x, isl.top + 0.012, isl.g.position.z + z);
  v.id = id;
  return v;
}
for (const [id, list] of nbrs)
  for (const e of list) {
    if (id > e.id) continue;
    const back = nbrs.get(e.id).find((x) => x.id === id).k;
    const b = slab(world, plank, worldPt(id, edgeLocal(nodes.get(id), e.k)), worldPt(e.id, edgeLocal(nodes.get(e.id), back)), 0.13, 0.025);
    b.castShadow = b.receiveShadow = true;
  }

// ---- lanes -------------------------------------------------------------------
const laneGroup = new THREE.Group();
world.add(laneGroup);
const UP = new THREE.Vector3(0, 1, 0);
let movers = [];

function drawLanes() {
  for (const o of laneGroup.children) {
    if (o.geometry !== G.arrow && o.geometry !== G.dot) o.geometry.dispose();
    o.material.dispose();
  }
  laneGroup.clear();
  movers = [];
  const { list, dim } = activeLanes();
  buildPeople(list, dim);
  if (!list.length || !state.arrows) return;
  const colors = new Map(resources.map((r) => [r.id, new THREE.Color(css(`--${r.id}`))]));
  const pos = (id) => {
    const i = islands.get(id);
    return new THREE.Vector3(i.g.position.x, i.top + 0.1, i.g.position.z);
  };

  for (const l of list) {
    const A = nodes.get(l.a), B = nodes.get(l.b), a = pos(l.a), b = pos(l.b);
    const u = b.clone().sub(a).setY(0), d = u.length();
    u.normalize();
    const left = new THREE.Vector3(u.z, 0, -u.x);
    const start = a.clone().addScaledVector(u, A.port ? 0.3 : 0.34);
    const end = b.clone().addScaledVector(u, B.port ? -0.42 : -0.46);
    // Arc up and bend left of travel, so A→B and B→A ride side by side.
    const ctrl = start.clone().add(end).multiplyScalar(0.5)
      .addScaledVector(left, 0.16 + l.nth * 0.14 + d * 0.05)
      .addScaledVector(UP, 0.7 + d * 0.28);
    const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
    // Every view, the overview included, keeps each arc in its resource's color. A
    // highlight fades the other lanes to a quiet, still trace: visible, no bulbs.
    const faded = dim && !l.hi, color = colors.get(l.res);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, 0.026, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: faded ? 0.18 : 0.55, depthWrite: false, toneMapped: false }),
    );
    laneGroup.add(tube);
    const arrow = new THREE.Mesh(G.arrow, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: faded ? 0.33 : 1, toneMapped: false }));
    arrow.position.copy(end);
    arrow.quaternion.setFromUnitVectors(UP, curve.getTangentAt(1));
    laneGroup.add(arrow);

    // Bulbs travel the arc toward the arrowhead, so direction reads at a glance.
    if (faded) continue;
    const len = curve.getLength(), count = Math.max(1, Math.round(len * 1.2));
    const bulb = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    for (let k = 0; k < count; k++) {
      const m = new THREE.Mesh(G.dot, bulb);
      laneGroup.add(m);
      movers.push({ m, curve, k, count, len });
    }
  }
}

// ---- people ------------------------------------------------------------------
// Carriers walk each active lane's shortest bridge route, crate in the resource's
// color; residents with no cargo stroll their island's ring road.
function bfs(a, b) {
  const prev = new Map([[a, null]]), queue = [a];
  while (queue.length) {
    const id = queue.shift();
    if (id === b) break;
    for (const e of nbrs.get(id)) if (!prev.has(e.id)) prev.set(e.id, id), queue.push(e.id);
  }
  const path = [];
  for (let id = b; id != null; id = prev.get(id)) path.unshift(id);
  return path[0] === a ? path : null;
}
const ringPt = (id, idx) => worldPt(id, ringLocal(nodes.get(id), idx));
const edgePt = (id, k) => worldPt(id, edgeLocal(nodes.get(id), k));
const edgeTo = (a, b) => nbrs.get(a).find((e) => e.id === b).k;
function walkRing(id, from, to, pts) {
  const step = (to - from + 12) % 12 <= 6 ? 1 : -1;
  for (let i = from; i !== to; ) pts.push(ringPt(id, (i = (i + step + 12) % 12)));
}
function measure(pts, loop) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { pts, cum, len: cum[cum.length - 1], loop };
}
function routeFor(a, b, rand) {
  const path = bfs(a, b);
  if (!path) return null;
  let cur = Math.floor(rand() * 12);
  const pts = [ringPt(a, cur)];
  path.forEach((id, i) => {
    if (i > 0) {
      const k = edgeTo(id, path[i - 1]);
      pts.push(edgePt(id, k), ringPt(id, (cur = 2 * k + 1)));
    }
    if (i < path.length - 1) {
      const k = edgeTo(id, path[i + 1]);
      walkRing(id, cur, 2 * k + 1, pts);
      pts.push(edgePt(id, k));
    } else walkRing(id, cur, (cur + 2 + Math.floor(rand() * 6)) % 12, pts);
  });
  return measure(pts, false);
}

const MAX_PEOPLE = 800;
const SKIN = ["#f6d7bd", "#eec09a", "#d9a07a", "#b87a55", "#8d5a3b"];
const CLOTHES = ["#4f86c6", "#e8774f", "#5fae6e", "#9a6cc8", "#e2b23a", "#3aa3a0", "#d65a5a", "#f2efe6"];
const PANTS = ["#3b4a6b", "#5a4636", "#2f3a40", "#6b5b8a", "#4c6a5a"];
const HAIR = ["#3b2a20", "#6b4a2e", "#1f1b1a", "#c98f4a", "#8a5a3c", "#d9d2c5"];
const pickColor = (list, rand) => new THREE.Color(list[Math.floor(rand() * list.length)]);

// Chunky figures built from instanced parts. Feet rest on y = 0 and the figure faces
// +z; legs hang from hips and arms from shoulders so they can swing as it walks.
function crowd(geo, m) {
  const o = new THREE.InstancedMesh(geo, m, MAX_PEOPLE);
  o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  o.castShadow = true;
  o.frustumCulled = false;
  o.count = 0;
  world.add(o);
  return o;
}
const soft = () => new THREE.MeshStandardMaterial({ roughness: 0.75 });
const eyePair = mergeGeometries([-1, 1].map((x) => new THREE.SphereGeometry(0.0075, 8, 6).translate(x * 0.018, 0.192, 0.045)));
const P = {
  torso: crowd(new THREE.CapsuleGeometry(0.033, 0.036, 4, 12).translate(0, 0.09, 0), soft()),
  head: crowd(new THREE.SphereGeometry(0.05, 18, 14).translate(0, 0.188, 0), soft()),
  hair: crowd(new THREE.SphereGeometry(0.053, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52).translate(0, 0.192, -0.006), soft()),
  eyes: crowd(eyePair, new THREE.MeshBasicMaterial({ color: "#2a2522" })),
  legL: crowd(new THREE.CapsuleGeometry(0.014, 0.03, 4, 8).translate(0, -0.03, 0), soft()),
  legR: crowd(new THREE.CapsuleGeometry(0.014, 0.03, 4, 8).translate(0, -0.03, 0), soft()),
  armL: crowd(new THREE.CapsuleGeometry(0.012, 0.03, 4, 8).translate(0, -0.027, 0), soft()),
  armR: crowd(new THREE.CapsuleGeometry(0.012, 0.03, 4, 8).translate(0, -0.027, 0), soft()),
  crate: crowd(new RoundedBoxGeometry(0.065, 0.05, 0.05, 2, 0.008).translate(0, 0.105, 0.075), new THREE.MeshBasicMaterial({ toneMapped: false })),
};
const HIP = 0.06, HIP_X = 0.017, SHOULDER = 0.118, SHOULDER_X = 0.044;

const residents = [];
for (const n of nodes.values()) {
  const rand = rng(`${n.id}-people`), pts = [];
  for (let i = 0; i <= 12; i++) pts.push(ringPt(n.id, i % 12));
  const loop = measure(pts, true);
  for (let k = 0; k < (n.port ? 1 : 4); k++)
    residents.push({
      route: loop, phase: rand(), speed: (rand() < 0.5 ? 1 : -1) * (0.12 + rand() * 0.08), off: 0.02,
      clothes: pickColor(CLOTHES, rand), skin: pickColor(SKIN, rand), pants: pickColor(PANTS, rand), hair: pickColor(HAIR, rand),
    });
}

let people = [];
function buildPeople(list, dim) {
  const rand = rng(`${state.res}-${state.focus}`), gray = new THREE.Color(tone("--ground-off"));
  const carriers = [];
  for (const l of state.people ? list : []) {
    const route = routeFor(l.a, l.b, rand);
    if (!route) continue;
    const color = new THREE.Color(css(`--${l.res}`)), count = Math.max(2, Math.min(6, Math.round(route.len / 1.1)));
    for (let k = 0; k < count; k++)
      carriers.push({
        route, phase: (k + rand() * 0.6) / count, speed: 0.26 + rand() * 0.1, off: 0.03 + rand() * 0.015,
        clothes: pickColor(CLOTHES, rand).lerp(color, 0.35), skin: pickColor(SKIN, rand), pants: pickColor(PANTS, rand), hair: pickColor(HAIR, rand),
        crate: color, hidden: dim && !l.hi,
      });
  }
  people = residents.concat(carriers).slice(0, MAX_PEOPLE);
  people.forEach((p, i) => {
    // In an info view, residents fade to gray so the carriers read as the network.
    const shirt = state.res && state.res !== "all" && !p.crate ? gray : p.clothes;
    for (const part of [P.torso, P.armL, P.armR]) part.setColorAt(i, shirt);
    for (const part of [P.legL, P.legR]) part.setColorAt(i, p.pants);
    P.head.setColorAt(i, p.skin);
    P.hair.setColorAt(i, p.hair);
    P.crate.setColorAt(i, p.crate || p.clothes);
  });
  for (const o of Object.values(P)) {
    o.count = people.length;
    if (o.instanceColor) o.instanceColor.needsUpdate = true;
  }
}

const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _w = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function limb(part, i, x, y, angle) {
  _l.makeRotationX(angle).setPosition(x, y, 0);
  part.setMatrixAt(i, _w.multiplyMatrices(_m, _l));
}
function stepPeople(t) {
  people.forEach((w, i) => {
    const { pts, cum, len, loop } = w.route;
    const s = ((((t * w.speed) % len) + w.phase * len) % len + len) % len;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      cum[mid] <= s ? (lo = mid) : (hi = mid);
    }
    const a = pts[lo], b = pts[hi], seg = cum[hi] - cum[lo] || 1;
    _p.lerpVectors(a, b, (s - cum[lo]) / seg);
    let dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 1;
    if (w.speed < 0) (dx = -dx), (dz = -dz);
    // Keep right, so two-way traffic on a road splits into two files.
    _p.x += (-dz / d) * w.off;
    _p.z += (dx / d) * w.off;
    // Stride matches walking speed; the body bobs twice per stride.
    const stride = t * Math.abs(w.speed) * 32 + w.phase * 40, swing = Math.sin(stride) * 0.6;
    _p.y += islands.get(a.id).g.position.y + Math.abs(Math.cos(stride)) * 0.008;
    const fade = loop ? 1 : Math.min(1, s / 0.12, (len - s) / 0.12);
    _q.setFromAxisAngle(UP, Math.atan2(dx, dz));
    _s.setScalar(w.hidden ? 0 : Math.max(0, fade));
    _m.compose(_p, _q, _s);
    for (const part of [P.torso, P.head, P.hair, P.eyes]) part.setMatrixAt(i, _m);
    limb(P.legL, i, -HIP_X, HIP, swing);
    limb(P.legR, i, HIP_X, HIP, -swing);
    // Carriers hold their crate out front with both arms; others swing theirs.
    limb(P.armL, i, -SHOULDER_X, SHOULDER, w.crate ? -1.15 : -swing * 0.8);
    limb(P.armR, i, SHOULDER_X, SHOULDER, w.crate ? -1.15 : swing * 0.8);
    P.crate.setMatrixAt(i, w.crate ? _m : ZERO);
  });
  for (const o of Object.values(P)) o.instanceMatrix.needsUpdate = true;
}

// ---- info view ---------------------------------------------------------------
const GRAY = (c, off) => {
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  return new THREE.Color(l, l, l).lerp(off, 0.45);
};

function onRender(r, out, inn) {
  if (state.night !== litNight) light();
  host.classList.toggle("info", !!r);
  const off = new THREE.Color(tone("--ground-off"));
  const rc = r && new THREE.Color(css(`--${r.id}`));
  for (const [id, isl] of islands) {
    const { role, label } = roleOf(id, out, inn, r);
    for (const e of tints.get(id)) {
      if (!r) e.target.copy(e.base);
      else if (role === "off") e.target.copy(GRAY(e.base, off));
      else e.target.copy(GRAY(e.base, off)).lerp(e.base, 0.4);
    }
    if (r && role !== "off") {
      const pct = role === "src" ? 0.8 : role === "both" ? 0.55 : 0.28;
      tints.get(id).find((e) => e.m === isl.ground).target.copy(off).lerp(rc, pct);
    }
    isl.label.classList.remove("src", "sink", "both", "off");
    if (role) isl.label.classList.add(role);
    isl.label.classList.toggle("focus", state.focus === id);
    isl.roleEl.textContent = label;
    isl.lift = state.focus === id ? 0.14 : 0;
  }
  drawLanes();
}

// ---- theme -------------------------------------------------------------------
// Day is a warm afternoon; night is dusk, with windows and street lamps lit.
let litNight = null;
function light() {
  const dusk = (litNight = state.night);
  env.applyTheme();
  hemi.color.set(dusk ? "#8ea3cf" : "#fff8ee");
  hemi.groundColor.set(dusk ? "#1d2433" : "#b7a98c");
  hemi.intensity = dusk ? 0.85 : 1.45;
  sun.color.set(dusk ? "#c9b6ff" : "#fff0d8");
  sun.intensity = dusk ? 1.0 : 2.5;
  for (const m of glowing) {
    m.emissive.set("#ffcf86");
    m.emissiveIntensity = dusk ? 0.85 : 0;
  }
  lampMat.emissiveIntensity = dusk ? 2.2 : 0.15;
  for (const list of tints.values())
    for (const e of list)
      if (e.key) {
        e.base.set(tone(e.key));
        e.m.color.copy(e.base);
      }
}
// A page theme change only affects resource colors; the scene keeps its own time of day.
function applyTheme() {
  light();
  set({});
}
dark.addEventListener("change", applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ---- picking -----------------------------------------------------------------
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let hovered = null, downAt = null;

function pick(e) {
  const box = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  return ray.intersectObjects(pickables, true)[0]?.object.userData.id ?? null;
}
const canvas = renderer.domElement;
canvas.addEventListener("pointermove", (e) => {
  hovered = e.buttons ? null : pick(e);
  canvas.style.cursor = hovered ? "pointer" : "";
  hovered ? showTip(hovered, e.clientX, e.clientY) : hideTip();
});
canvas.addEventListener("pointerleave", () => ((hovered = null), hideTip()));
canvas.addEventListener("pointerdown", (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const id = pick(e);
  set({ focus: id && id !== state.focus ? id : null, hoverFlow: null });
});

// ---- size and loop -----------------------------------------------------------
function frame() {
  // Aim south of center so the cluster clears the resource bar at the bottom.
  const dist = 17.5 * Math.max(1, 1.2 / camera.aspect);
  controls.target.set(0, 0, 1.4);
  camera.position.set(dist * 0.12, dist * 0.7, 1.4 + dist * 0.7);
  controls.update();
}
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!userMoved) frame();
}
new ResizeObserver(resize).observe(host);
resize();

const clock = new THREE.Clock();
let last = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime(), dt = Math.min(0.1, t - last);
  last = t;
  env.update(reduced.matches ? 0 : t, reduced.matches ? 0 : dt);
  for (const v of movers) {
    const u = reduced.matches ? (v.k + 0.5) / v.count : ((t * 0.6) / v.len + v.k / v.count) % 1;
    v.m.position.copy(v.curve.getPointAt(u));
  }
  stepPeople(reduced.matches ? 0 : t);
  for (const list of tints.values()) for (const e of list) e.m.color.lerp(e.target, 0.12);
  for (const [id, isl] of islands) {
    const goal = isl.lift + (hovered === id ? 0.05 : 0);
    isl.g.position.y += (goal - isl.g.position.y) * 0.18;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

initUI({ onRender, onHoverFlow: drawLanes, toggles: true, footer: '<a href="flat.html">開啟平面地圖</a>。' });
applyTheme();
