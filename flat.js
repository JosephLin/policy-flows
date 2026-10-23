import { nodes, lanes, resources, state, set, initUI, activeLanes, roleOf, showTip, hideTip } from "./ui.js";

const S = 56; // hex radius in px
const SVGNS = "http://www.w3.org/2000/svg";
const svg = document.querySelector("#map");
const px = (n) => ({ x: n.x * S, y: n.y * S });

// ---- static map --------------------------------------------------------------
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};
const hexPoints = (x, y, r) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 90);
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

const pts = [...nodes.values()].map(px);
const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
const pad = S * 1.6;
const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad - 30;
svg.setAttribute("viewBox", `${minX} ${minY} ${Math.max(...xs) + pad - minX} ${Math.max(...ys) + pad + 70 - minY}`);
svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

const defs = el("defs", {}, svg);
const marker = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 6, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
el("path", { d: "M0 0 10 5 0 10z", style: "fill: var(--rc)" }, marker);
el("rect", { x: minX, y: minY, width: "100%", height: "100%", fill: "transparent", class: "water" }, svg);

const landLayer = el("g", {}, svg);
const laneLayer = el("g", { class: "lanes" }, svg);
const labelLayer = el("g", {}, svg);
const nodeEls = new Map();

for (const n of nodes.values()) {
  const { x, y } = px(n);
  const g = el("g", { class: `node${n.port ? " port" : ""}`, "data-id": n.id }, landLayer);
  el("polygon", { class: "hex", points: hexPoints(x, y, n.port ? S * 0.6 : S * 0.95) }, g);
  const lg = el("g", { class: `node${n.port ? " port" : ""}`, "data-id": n.id }, labelLayer);
  const num = el("text", { class: "num", x, y: y - (n.port ? 2 : 6) }, lg);
  num.textContent = n.port ? "" : n.n;
  const nm = el("text", { class: "name", x, y: y + (n.port ? 4 : 10) }, lg);
  nm.textContent = n.en;
  const role = el("text", { class: "role", x, y: y + (n.port ? 18 : 26) }, lg);
  const pips = el("g", { class: "pips" }, lg);
  const used = resources.filter((r) => lanes.some((l) => l.res === r.id && (l.a === n.id || l.b === n.id)));
  used.forEach((r, k) => {
    const w = 9, x0 = x - ((used.length - 1) * w) / 2;
    el("circle", { class: "pip", cx: x0 + k * w, cy: y + (n.port ? 18 : 28), r: 3.6, style: `fill: var(--${r.id})` }, pips);
  });
  nodeEls.set(n.id, { land: g, label: lg, role });
}

// ---- lanes -------------------------------------------------------------------
function lanePath(l) {
  const A = nodes.get(l.a), B = nodes.get(l.b), a = px(A), b = px(B);
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const ux = dx / d, uy = dy / d;
  const sa = A.port ? S * 0.45 : S * 0.42, sb = B.port ? S * 0.6 : S * 0.55;
  const x1 = a.x + ux * sa, y1 = a.y + uy * sa, x2 = b.x - ux * sb, y2 = b.y - uy * sb;
  // Bend left of travel, so A→B and B→A sit side by side like a two-lane road.
  const bend = Math.min(d * 0.16, 70) + l.nth * 14;
  const cx = (x1 + x2) / 2 + uy * bend, cy = (y1 + y2) / 2 - ux * bend;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function drawLanes() {
  laneLayer.replaceChildren();
  const { list, dim } = activeLanes();
  for (const l of list) {
    const g = el("g", { class: `lane${l.hi ? " hi" : ""}` }, laneLayer);
    const d = lanePath(l);
    el("path", { class: "lane-base", d }, g);
    el("path", { class: "lane-dots", d, "marker-end": "url(#arrow)" }, g);
  }
  laneLayer.classList.toggle("dim", dim);
}

function onRender(r, out, inn) {
  svg.classList.toggle("info", !!r);
  for (const [id, e] of nodeEls) {
    const { role, label } = roleOf(id, out, inn, r);
    for (const g of [e.land, e.label]) {
      g.classList.remove("src", "sink", "both", "off");
      if (role) g.classList.add(role);
      g.classList.toggle("focus", state.focus === id);
    }
    e.role.textContent = label;
    e.role.style.fill = role === "src" ? "#fff" : "var(--ink)";
  }
  drawLanes();
}

// ---- map interaction ---------------------------------------------------------
svg.addEventListener("click", (e) => {
  const g = e.target.closest(".node");
  set({ focus: g && g.dataset.id !== state.focus ? g.dataset.id : null, hoverFlow: null });
});
svg.addEventListener("pointermove", (e) => {
  const g = e.target.closest(".node");
  g ? showTip(g.dataset.id, e.clientX, e.clientY) : hideTip();
});
svg.addEventListener("pointerleave", hideTip);

initUI({ onRender, onHoverFlow: drawLanes, footer: '<a href="./">Open the 3D view</a>. ' });
