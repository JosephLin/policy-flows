import { islands, ports, resources, flows } from "./data.js";

const S = 56; // hex radius
const SVGNS = "http://www.w3.org/2000/svg";
const $ = (s) => document.querySelector(s);
const svg = $("#map"), tip = $("#tip"), panel = $("#panel"), bar = $("#bar");

const ICONS = {
  staff: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>',
  data: '<path d="M5 20v-8M12 20V5M19 20v-5"/>',
  knowhow: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  care: '<path d="M12 20s-7.5-4.6-7.5-10.2A4 4 0 0 1 12 7.5a4 4 0 0 1 7.5 2.3C19.5 15.4 12 20 12 20z"/>',
  access: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10.5h18M7 15h4"/>',
  supply: '<path d="M5 19C5 11 11 6 19 5c0 8-5 14-14 14zM5 19l7-7"/>',
  all: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/>',
};
const icon = (id) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;

// ---- model -------------------------------------------------------------------
const nodes = new Map();
for (const i of islands) nodes.set(i.id, { ...i, port: false });
for (const p of ports) nodes.set(p.id, { ...p, port: true });
for (const n of nodes.values()) {
  n.x = S * Math.sqrt(3) * (n.q + n.r / 2);
  n.y = S * 1.5 * n.r;
}
const resById = new Map(resources.map((r) => [r.id, r]));

// One lane per direction of travel; two-way flows get a lane each way.
const lanes = [];
for (const f of flows)
  for (const a of f.from)
    for (const b of f.to) {
      if (a === b) continue;
      lanes.push({ flow: f, res: f.res, a, b });
      if (f.two) lanes.push({ flow: f, res: f.res, a: b, b: a });
    }

function rolesFor(res) {
  const out = new Map(), inn = new Map();
  for (const l of lanes) {
    if (l.res !== res) continue;
    out.set(l.a, (out.get(l.a) || 0) + 1);
    inn.set(l.b, (inn.get(l.b) || 0) + 1);
  }
  return { out, inn };
}

const name = (id) => nodes.get(id).en;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// ---- state -------------------------------------------------------------------
const state = { res: null, focus: null, hoverFlow: null };

function set(patch) {
  Object.assign(state, patch);
  render();
}

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

const xs = [...nodes.values()].map((n) => n.x), ys = [...nodes.values()].map((n) => n.y);
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
  const g = el("g", { class: `node${n.port ? " port" : ""}`, "data-id": n.id }, landLayer);
  el("polygon", { class: "hex", points: hexPoints(n.x, n.y, n.port ? S * 0.6 : S * 0.95) }, g);
  const lg = el("g", { class: `node${n.port ? " port" : ""}`, "data-id": n.id }, labelLayer);
  const num = el("text", { class: "num", x: n.x, y: n.y - (n.port ? 2 : 6) }, lg);
  num.textContent = n.port ? "" : n.n;
  const nm = el("text", { class: "name", x: n.x, y: n.y + (n.port ? 4 : 10) }, lg);
  nm.textContent = n.en;
  const role = el("text", { class: "role", x: n.x, y: n.y + (n.port ? 18 : 26) }, lg);
  const pips = el("g", { class: "pips" }, lg);
  const used = resources.filter((r) => lanes.some((l) => l.res === r.id && (l.a === n.id || l.b === n.id)));
  used.forEach((r, k) => {
    const w = 9, x0 = n.x - ((used.length - 1) * w) / 2;
    el("circle", { class: "pip", cx: x0 + k * w, cy: n.y + (n.port ? 18 : 28), r: 3.6, style: `fill: var(--${r.id})` }, pips);
  });
  nodeEls.set(n.id, { land: g, label: lg, role });
}

// ---- lanes -------------------------------------------------------------------
function lanePath(l, nth) {
  const A = nodes.get(l.a), B = nodes.get(l.b);
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
  const ux = dx / d, uy = dy / d;
  const sa = A.port ? S * 0.45 : S * 0.42, sb = B.port ? S * 0.6 : S * 0.55;
  const x1 = A.x + ux * sa, y1 = A.y + uy * sa, x2 = B.x - ux * sb, y2 = B.y - uy * sb;
  // Bend left of travel, so A→B and B→A sit side by side like a two-lane road.
  const bend = Math.min(d * 0.16, 70) + nth * 14;
  const cx = (x1 + x2) / 2 + uy * bend, cy = (y1 + y2) / 2 - ux * bend;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function drawLanes() {
  laneLayer.replaceChildren();
  if (!state.res) return;
  const seen = new Map();
  for (const l of lanes) {
    if (l.res !== state.res) continue;
    const key = `${l.a}>${l.b}`, nth = seen.get(key) || 0;
    seen.set(key, nth + 1);
    const hi = (state.focus && (l.a === state.focus || l.b === state.focus)) || state.hoverFlow === l.flow.id;
    const g = el("g", { class: `lane${hi ? " hi" : ""}` }, laneLayer);
    const d = lanePath(l, nth);
    el("path", { class: "lane-base", d }, g);
    el("path", { class: "lane-dots", d, "marker-end": "url(#arrow)" }, g);
  }
  laneLayer.classList.toggle("dim", !!(state.focus || state.hoverFlow));
}

// ---- render ------------------------------------------------------------------
function render() {
  const r = state.res && resById.get(state.res);
  svg.classList.toggle("info", !!r);
  document.body.style.setProperty("--rc",r ? `var(--${r.id})` : "var(--ink)");
  const { out, inn } = r ? rolesFor(r.id) : { out: new Map(), inn: new Map() };

  for (const [id, e] of nodeEls) {
    const o = out.get(id) || 0, i = inn.get(id) || 0;
    const role = !r ? "" : o && i ? "both" : o ? "src" : i ? "sink" : "off";
    for (const g of [e.land, e.label]) {
      g.classList.remove("src", "sink", "both", "off");
      if (role) g.classList.add(role);
      g.classList.toggle("focus", state.focus === id);
    }
    e.role.textContent = role === "src" ? `▲ ${o}` : role === "sink" ? `▼ ${i}` : role === "both" ? `▲${o} ▼${i}` : "";
    e.role.style.fill = role === "src" ? "#fff" : "var(--ink)";
  }
  drawLanes();

  for (const b of bar.querySelectorAll("button")) b.classList.toggle("on", (b.dataset.res || null) === state.res);
  renderPanel(r, out, inn);
}

function routeText(f) {
  const side = (ids) => (ids.length > 3 ? `${ids.length} islands` : ids.map(name).join(", "));
  return `${side(f.from)} ${f.two ? "⇄" : "→"} ${side(f.to)}`;
}

function flowItems(list) {
  return list
    .map((f) => {
      const c = `var(--${f.res})`;
      return `<li data-flow="${f.id}" data-res="${f.res}" style="--c:${c}">${f.text}<div class="route">${routeText(f)}</div></li>`;
    })
    .join("");
}

function renderPanel(r, out, inn) {
  const focus = state.focus && nodes.get(state.focus);
  let html = "";

  if (focus) {
    const touching = flows.filter((f) => f.from.includes(focus.id) || f.to.includes(focus.id));
    const shown = r ? touching.filter((f) => f.res === r.id) : touching;
    const sends = shown.filter((f) => f.from.includes(focus.id) || (f.two && f.to.includes(focus.id))).length;
    const gets = shown.filter((f) => f.to.includes(focus.id) || (f.two && f.from.includes(focus.id))).length;
    html += `<button class="back" data-act="unfocus">← ${r ? r.en : "All resources"}</button>
      <h2>${focus.port ? "" : `<span>${focus.n}</span>`} ${focus.en}</h2>
      <div class="zh">${focus.zh}${focus.port ? " · outside connection" : ""}</div>
      <div class="stats"><div><b>${shown.length}</b><span>flows${r ? ` (${r.en.toLowerCase()})` : ""}</span></div>
        <div><b>${sends}</b><span>sends</span></div><div><b>${gets}</b><span>receives</span></div></div>
      <h3>${r ? `${r.en} here` : "Flows here"}</h3>
      ${shown.length ? `<ul class="list">${flowItems(shown)}</ul>` : `<p class="zh">No ${r ? r.en.toLowerCase() : ""} flows touch this island.</p>`}`;
    if (r && touching.length > shown.length)
      html += `<p class="note">${plural(touching.length - shown.length, "more flow")} in other resources. Press 0 to see them all.</p>`;
  } else if (r) {
    const fl = flows.filter((f) => f.res === r.id);
    const top = [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    html += `<h2 style="--c:var(--${r.id})">${icon(r.id)} ${r.en}</h2>
      <div class="zh">${r.zh}</div><p>${r.blurb}</p>
      <div class="stats"><div><b>${fl.length}</b><span>flows</span></div>
        <div><b>${out.size}</b><span>sources</span></div><div><b>${inn.size}</b><span>receivers</span></div></div>
      <h3>Biggest sources</h3>
      <ul class="list">${top.map(([id, n]) => `<li data-node="${id}" style="--c:var(--${r.id})">${name(id)}<div class="route">sends along ${plural(n, "lane")}</div></li>`).join("")}</ul>
      <h3>Flows</h3><ul class="list">${flowItems(fl)}</ul>
      <h3>Legend</h3>${legend()}`;
  } else {
    html += `<h2>All resources</h2>
      <p class="zh">Overview: each island's dots show which resources it trades.</p>
      <h3>Resources</h3>
      <ul class="list">${resources
        .map((x) => {
          const n = flows.filter((f) => f.res === x.id).length;
          return `<li data-res="${x.id}" style="--c:var(--${x.id})"><b>${x.en}</b> <span class="zh">${x.zh}</span><div class="route">${plural(n, "flow")} · key ${x.key}</div></li>`;
        })
        .join("")}</ul>
      <p class="note">Keys 1–6 switch views, 0 or Esc returns here. Click an island to see what it sends and receives.</p>`;
  }
  html += `<p class="note">Prototype. Data structure from puma.taipei/heart-island (2026-10-22); the six resource groups and wording are ours.</p>`;
  panel.innerHTML = html;
}

function legend() {
  return `<div class="legend">
    <div><span class="sw" style="background:color-mix(in srgb,var(--rc) 75%,var(--land))"></span>▲ Source: sends this resource</div>
    <div><span class="sw" style="background:color-mix(in srgb,var(--rc) 50%,var(--land))"></span>▲▼ Both sends and receives</div>
    <div><span class="sw" style="background:color-mix(in srgb,var(--rc) 22%,var(--land))"></span>▼ Receiver only</div>
    <div><span class="sw" style="background:var(--land-off)"></span>Not part of this network</div>
  </div>`;
}

// ---- resource bar ------------------------------------------------------------
bar.innerHTML =
  `<button data-res="" title="All resources (0)">${icon("all")}All<kbd>0</kbd></button>` +
  resources.map((r) => `<button data-res="${r.id}" style="--c:var(--${r.id})" title="${r.en} (${r.key})">${icon(r.id)}${r.en.split(" ")[0]}<kbd>${r.key}</kbd></button>`).join("");
bar.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) set({ res: b.dataset.res || null, hoverFlow: null });
});

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const r = resources.find((x) => x.key === e.key);
  if (r) set({ res: r.id === state.res ? null : r.id });
  else if (e.key === "0") set({ res: null });
  else if (e.key === "Escape") set(state.focus ? { focus: null } : { res: null });
});

// ---- map interaction ---------------------------------------------------------
svg.addEventListener("click", (e) => {
  const g = e.target.closest(".node");
  set({ focus: g && g.dataset.id !== state.focus ? g.dataset.id : null, hoverFlow: null });
});

svg.addEventListener("pointermove", (e) => {
  const g = e.target.closest(".node");
  if (!g) return (tip.hidden = true);
  const n = nodes.get(g.dataset.id);
  const r = state.res && resById.get(state.res);
  let body;
  if (r) {
    const mine = lanes.filter((l) => l.res === r.id);
    const sendTo = [...new Set(mine.filter((l) => l.a === n.id).map((l) => name(l.b)))];
    const getFrom = [...new Set(mine.filter((l) => l.b === n.id).map((l) => name(l.a)))];
    body = !sendTo.length && !getFrom.length
      ? `<li>Not part of the ${r.en.toLowerCase()} network</li>`
      : (sendTo.length ? `<li>▲ Sends to ${sendTo.join(", ")}</li>` : "") + (getFrom.length ? `<li>▼ Receives from ${getFrom.join(", ")}</li>` : "");
  } else {
    body = resources
      .map((x) => [x, lanes.filter((l) => l.res === x.id && (l.a === n.id || l.b === n.id)).length])
      .filter(([, k]) => k)
      .map(([x, k]) => `<li><span style="color:var(--${x.id})">●</span> ${x.en}: ${plural(k, "lane")}</li>`)
      .join("") || "<li>No flows</li>";
  }
  tip.innerHTML = `<b>${n.en}</b> <span class="zh">${n.zh}</span><ul>${body}</ul>`;
  tip.hidden = false;
  const box = svg.parentElement.getBoundingClientRect();
  const x = e.clientX - box.left + 14, y = e.clientY - box.top + 14;
  tip.style.left = `${Math.min(x, box.width - tip.offsetWidth - 8)}px`;
  tip.style.top = `${Math.min(y, box.height - tip.offsetHeight - 8)}px`;
});
svg.addEventListener("pointerleave", () => (tip.hidden = true));

// ---- panel interaction -------------------------------------------------------
panel.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act],[data-node],[data-flow],[data-res]");
  if (!t) return;
  if (t.dataset.act === "unfocus") set({ focus: null });
  else if (t.dataset.node) set({ focus: t.dataset.node });
  else if (t.dataset.flow) set({ res: t.dataset.res, hoverFlow: t.dataset.flow });
  else if (t.dataset.res) set({ res: t.dataset.res });
});
panel.addEventListener("pointerover", (e) => {
  const t = e.target.closest("[data-flow]");
  const id = t && t.dataset.res === state.res ? t.dataset.flow : null;
  if (id !== state.hoverFlow) {
    state.hoverFlow = id;
    drawLanes();
  }
});

render();
