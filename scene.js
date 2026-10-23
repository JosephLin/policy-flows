import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { nodes, lanes, resources, state, set, initUI, activeLanes, roleOf, showTip, hideTip } from "./ui.js";

const host = document.querySelector("#world");
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const dark = matchMedia("(prefers-color-scheme: dark)");

// ---- renderer, camera, light -------------------------------------------------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  host.innerHTML = `<p class="nogl card">This browser can't run WebGL. <a href="flat.html">Open the flat map</a>.</p>`;
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ roughness: 0.35 }));
water.rotation.x = -Math.PI / 2;
water.receiveShadow = true;
scene.add(water);
const shoalMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });

// ---- materials that tint for the info view -----------------------------------
// Every island material is registered with its base color; render() sets a target and
// the frame loop eases toward it. `key` entries re-read their base from CSS on theme change.
const tints = new Map(); // island id -> [{ m, base, target, key }]
function mat(id, color, key) {
  const m = new THREE.MeshStandardMaterial({ color: key ? css(key) : color, roughness: 0.85, flatShading: true });
  const e = { m, base: m.color.clone(), target: m.color.clone(), key };
  tints.get(id).push(e);
  return m;
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  roof: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
  pine: new THREE.ConeGeometry(1, 1, 7),
  bush: new THREE.IcosahedronGeometry(1, 0),
  trunk: new THREE.CylinderGeometry(0.035, 0.045, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  dot: new THREE.SphereGeometry(0.075, 12, 8),
  arrow: new THREE.ConeGeometry(0.1, 0.26, 12),
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
function house(g, id, top, x, z, w, d, h, wall, roof, rot = 0) {
  const p = new THREE.Group();
  p.position.set(x, top, z);
  p.rotation.y = rot;
  mesh(p, G.box, mat(id, wall), 0, h / 2, 0, w, h, d);
  mesh(p, G.roof, mat(id, roof), 0, h + 0.07, 0, w * 1.12, 0.14, d * 1.12);
  g.add(p);
}
function tree(g, id, top, x, z, s, rand) {
  mesh(g, G.trunk, mat(id, "#7a5a3f"), x, top + 0.06 * s, z, s, 0.12 * s, s);
  const leaf = mat(id, LEAVES[Math.floor(rand() * LEAVES.length)]);
  if (rand() < 0.6) mesh(g, G.pine, leaf, x, top + (0.12 + 0.17) * s, z, 0.13 * s, 0.34 * s, 0.13 * s);
  else mesh(g, G.bush, leaf, x, top + 0.22 * s, z, 0.13 * s, 0.13 * s, 0.13 * s);
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

for (const n of nodes.values()) {
  tints.set(n.id, []);
  const rand = rng(n.id);
  const R = n.port ? 0.58 : 0.94, H = n.port ? 0.22 : 0.42, top = H - 0.12;
  const g = new THREE.Group();
  g.position.set(n.x - cx, 0, n.y - cz);
  world.add(g);

  const cliff = mat(n.id, null, "--cliff"), ground = mat(n.id, null, "--ground");
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.06, H, 6), [cliff, ground, cliff]);
  body.position.y = H / 2 - 0.12;
  g.add(body);
  const shoal = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.2, R * 1.2, 0.02, 6), shoalMat);
  shoal.position.y = 0.005;
  g.add(shoal);

  const accent = ROOFS[(n.n || 3) % ROOFS.length];
  const clear = LANDMARKS[n.id](g, n.id, top, accent, rand);

  if (!n.port) {
    // Plots: an inner ring facing the hex edges, an outer ring facing the corners.
    const plots = [];
    if (clear < 0.3) for (let k = 0; k < 6; k++) plots.push([0.42, (Math.PI / 3) * k + Math.PI / 6]);
    for (let k = 0; k < 6; k++) plots.push([0.66, (Math.PI / 3) * k]);
    plots.sort(() => rand() - 0.5);
    const green = n.id === "forest" || n.id === "trails";
    let houses = green ? 2 : Math.min(n.b - 1, 7);
    for (const [r, a] of plots) {
      const x = Math.sin(a) * r + (rand() - 0.5) * 0.06, z = Math.cos(a) * r + (rand() - 0.5) * 0.06;
      if (houses-- > 0) {
        const w = 0.16 + rand() * 0.08, h = 0.12 + rand() * 0.16;
        house(g, n.id, top, x, z, w, w * (0.8 + rand() * 0.4), h, WALLS[Math.floor(rand() * WALLS.length)], rand() < 0.5 ? accent : ROOFS[Math.floor(rand() * ROOFS.length)], a);
      } else if (rand() < 0.85) tree(g, n.id, top, x, z, 0.8 + rand() * 0.6, rand);
    }
  }

  g.traverse((o) => {
    o.userData.id = n.id;
    if (o.isMesh && o !== shoal) o.castShadow = o.receiveShadow = true;
  });
  shoal.receiveShadow = true;
  pickables.push(g);

  const div = document.createElement("div");
  div.className = `lbl${n.port ? " port" : ""}`;
  const used = resources.filter((r) => lanes.some((l) => l.res === r.id && (l.a === n.id || l.b === n.id)));
  div.innerHTML = `<b>${n.n || ""}</b><span class="nm">${n.en}</span><i class="rl"></i><span class="pips">${used.map((r) => `<span style="--c:var(--${r.id})"></span>`).join("")}</span>`;
  div.addEventListener("click", () => set({ focus: state.focus === n.id ? null : n.id, hoverFlow: null }));
  div.addEventListener("pointermove", (e) => showTip(n.id, e.clientX, e.clientY));
  div.addEventListener("pointerleave", hideTip);
  const label = new CSS2DObject(div);
  label.position.set(0, top + (n.port ? 0.75 : 1.05), 0);
  g.add(label);

  islands.set(n.id, { g, top, ground, label: div, roleEl: div.querySelector(".rl"), lift: 0 });
}

// ---- lanes -------------------------------------------------------------------
const laneGroup = new THREE.Group();
world.add(laneGroup);
let movers = [];
const UP = new THREE.Vector3(0, 1, 0);

function drawLanes() {
  for (const o of laneGroup.children) {
    if (o.geometry !== G.dot && o.geometry !== G.arrow) o.geometry.dispose();
    o.material.dispose();
  }
  laneGroup.clear();
  movers = [];
  const { list, dim } = activeLanes();
  if (!list.length) return;
  const color = new THREE.Color(css(`--${state.res}`));
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
    const faded = dim && !l.hi;

    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, 0.04, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: faded ? 0.07 : 0.55, depthWrite: false }),
    );
    laneGroup.add(tube);
    const arrow = new THREE.Mesh(G.arrow, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: faded ? 0.12 : 1 }));
    arrow.position.copy(end);
    arrow.quaternion.setFromUnitVectors(UP, curve.getTangentAt(1));
    laneGroup.add(arrow);

    const len = curve.getLength(), count = Math.max(2, Math.round(len * 2.4));
    const dotMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: faded ? 0.12 : 1 });
    for (let k = 0; k < count; k++) {
      const m = new THREE.Mesh(G.dot, dotMat);
      laneGroup.add(m);
      movers.push({ m, curve, k, count, len });
    }
  }
}

// ---- info view ---------------------------------------------------------------
const GRAY = (c, off) => {
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  return new THREE.Color(l, l, l).lerp(off, 0.45);
};

function onRender(r, out, inn) {
  host.classList.toggle("info", !!r);
  const off = new THREE.Color(css("--ground-off"));
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
function applyTheme() {
  const sky = new THREE.Color(css("--sky"));
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 24, 60);
  water.material.color.set(css("--water"));
  shoalMat.color.set(css("--water")).lerp(new THREE.Color("#ffffff"), dark.matches ? 0.08 : 0.35);
  hemi.color.set(dark.matches ? "#9fb3d1" : "#ffffff");
  hemi.groundColor.set(dark.matches ? "#1b2230" : "#b9aa90");
  hemi.intensity = dark.matches ? 0.9 : 1.5;
  sun.intensity = dark.matches ? 1.3 : 2.3;
  for (const list of tints.values())
    for (const e of list)
      if (e.key) {
        e.base.set(css(e.key));
        e.m.color.copy(e.base);
      }
  set({});
}
dark.addEventListener("change", applyTheme);

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
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  for (const v of movers) {
    const u = reduced.matches ? (v.k + 0.5) / v.count : ((t * 0.6) / v.len + v.k / v.count) % 1;
    v.m.position.copy(v.curve.getPointAt(u));
  }
  for (const list of tints.values()) for (const e of list) e.m.color.lerp(e.target, 0.12);
  for (const [id, isl] of islands) {
    const goal = isl.lift + (hovered === id ? 0.05 : 0);
    isl.g.position.y += (goal - isl.g.position.y) * 0.18;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

initUI({ onRender, onHoverFlow: drawLanes, footer: '<a href="flat.html">Open the flat map</a>. ' });
applyTheme();
