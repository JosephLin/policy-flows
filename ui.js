// Shared model, side panel, resource bar and keys. A map view (flat.js, scene.js)
// calls initUI with an onRender hook and draws from `state`.
import { islands, ports, resources, flows } from "./data.js";

export { resources, flows };
const $ = (s) => document.querySelector(s);

export const ICONS = {
  staff: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>',
  data: '<path d="M5 20v-8M12 20V5M19 20v-5"/>',
  knowhow: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  care: '<path d="M12 20s-7.5-4.6-7.5-10.2A4 4 0 0 1 12 7.5a4 4 0 0 1 7.5 2.3C19.5 15.4 12 20 12 20z"/>',
  access: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10.5h18M7 15h4"/>',
  supply: '<path d="M5 19C5 11 11 6 19 5c0 8-5 14-14 14zM5 19l7-7"/>',
  all: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/>',
};
export const icon = (id) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;

// ---- model -------------------------------------------------------------------
// x/y are pointy-top hex centers in units of hex radius.
export const nodes = new Map();
for (const i of islands) nodes.set(i.id, { ...i, port: false });
for (const p of ports) nodes.set(p.id, { ...p, port: true });
for (const n of nodes.values()) {
  n.x = Math.sqrt(3) * (n.q + n.r / 2);
  n.y = 1.5 * n.r;
}
export const resById = new Map(resources.map((r) => [r.id, r]));

// One lane per direction of travel; two-way flows get a lane each way.
export const lanes = [];
for (const f of flows)
  for (const a of f.from)
    for (const b of f.to) {
      if (a === b) continue;
      lanes.push({ flow: f, res: f.res, a, b });
      if (f.two) lanes.push({ flow: f, res: f.res, a: b, b: a });
    }

export function rolesFor(res) {
  const out = new Map(), inn = new Map();
  for (const l of lanes) {
    if (l.res !== res) continue;
    out.set(l.a, (out.get(l.a) || 0) + 1);
    inn.set(l.b, (inn.get(l.b) || 0) + 1);
  }
  return { out, inn };
}

// Lanes for the current resource: none by default, every one under 全部 ("all").
// Each carries its index among same-direction twins.
export function activeLanes() {
  const seen = new Map(), list = [];
  for (const l of lanes) {
    if (!state.res || (state.res !== "all" && l.res !== state.res)) continue;
    const key = `${l.a}>${l.b}`, nth = seen.get(key) || 0;
    seen.set(key, nth + 1);
    const hi = (state.focus && (l.a === state.focus || l.b === state.focus)) || state.hoverFlow === l.flow.id || state.hoverNode === l.a;
    list.push({ ...l, nth, hi });
  }
  return { list, dim: !!(state.focus || state.hoverFlow || state.hoverNode) };
}

export const name = (id) => nodes.get(id).zh;
export const roleOf = (id, out, inn, r) => {
  const o = out.get(id) || 0, i = inn.get(id) || 0;
  const role = !r ? "" : o && i ? "both" : o ? "src" : i ? "sink" : "off";
  const label = role === "src" ? `▲ ${o}` : role === "sink" ? `▼ ${i}` : role === "both" ? `▲${o} ▼${i}` : "";
  return { role, label };
};

// ---- state -------------------------------------------------------------------
// res: null shows no lanes, "all" shows every lane, a resource id shows one network.
// hoverFlow / hoverNode: the 流動 or 主要來源 row under the pointer, whose lanes light up.
// show (3D only): draw lanes as walking "people", "arrows" on the arcs, or "both".
export const state = { res: null, focus: null, hoverFlow: null, hoverNode: null, show: "both" };
let hooks = {};

export function set(patch) {
  Object.assign(state, patch);
  render();
}

function render() {
  const r = state.res && resById.get(state.res);
  document.body.style.setProperty("--rc", r ? `var(--${r.id})` : "var(--ink)");
  const { out, inn } = r ? rolesFor(r.id) : { out: new Map(), inn: new Map() };
  hooks.onRender?.(r, out, inn);
  for (const b of $("#bar").querySelectorAll("button")) {
    const on = b.dataset.show ? b.dataset.show === state.show : (b.dataset.res || null) === state.res;
    b.classList.toggle("on", on);
    if (b.dataset.show) b.setAttribute("aria-pressed", on);
  }
  renderPanel(r, out, inn);
}

// ---- tooltip -----------------------------------------------------------------
const tip = $("#tip");

export function showTip(id, clientX, clientY) {
  const n = nodes.get(id);
  const r = state.res && resById.get(state.res);
  let body;
  if (r) {
    const mine = lanes.filter((l) => l.res === r.id);
    const sendTo = [...new Set(mine.filter((l) => l.a === n.id).map((l) => name(l.b)))];
    const getFrom = [...new Set(mine.filter((l) => l.b === n.id).map((l) => name(l.a)))];
    body = !sendTo.length && !getFrom.length
      ? `<li>不在${r.zh}網絡中</li>`
      : (sendTo.length ? `<li>▲ 送往：${sendTo.join("、")}</li>` : "") + (getFrom.length ? `<li>▼ 來自：${getFrom.join("、")}</li>` : "");
  } else {
    body = resources
      .map((x) => [x, lanes.filter((l) => l.res === x.id && (l.a === n.id || l.b === n.id)).length])
      .filter(([, k]) => k)
      .map(([x, k]) => `<li><span style="color:var(--${x.id})">●</span> ${x.zh}：${k} 條路線</li>`)
      .join("") || "<li>沒有流動</li>";
  }
  tip.innerHTML = `<b>${n.zh}</b>${n.port ? ' <span class="zh">對外連結</span>' : ""}<ul>${body}</ul>`;
  tip.hidden = false;
  const box = $("#stage").getBoundingClientRect();
  const x = clientX - box.left + 14, y = clientY - box.top + 14;
  tip.style.left = `${Math.min(x, box.width - tip.offsetWidth - 8)}px`;
  tip.style.top = `${Math.min(y, box.height - tip.offsetHeight - 8)}px`;
}
export const hideTip = () => (tip.hidden = true);

// ---- panel -------------------------------------------------------------------
// Under every panel view: this is a demo, not the campaign's site, and where the data came from.
const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const ABOUT = `<section class="about">
  <h3>關於這個原型</h3>
  <p>這是給政策團隊看的概念驗證，不是官方網站，也不代表任何候選人或政黨的立場。</p>
  <dl>
    <dt>資料來源</dt><dd>政策島、各島政策細項數量與協作關係，整理自${link("https://puma.taipei/heart-island", "HEART 政策島")}的公開資料（2026-10-22 擷取）。政策內容以 ${link("https://puma.taipei/policies", "puma.taipei 政策頁")}原文為準。</dd>
    <dt>自行整理</dt><dd>六種資源分類、流動說明文字、版面與 3D 場景皆為本原型自行設計，可能與原意有出入。</dd>
    <dt>靈感</dt><dd>資源檢視參考城市模擬遊戲 SimCity 與 Cities: Skylines 的資訊圖層。</dd>
    <dt>技術</dt><dd>3D 場景以 ${link("https://threejs.org", "Three.js")}（MIT 授權）繪製。</dd>
  </dl>
</section>`;
const panel = $("#panel");

function routeText(f) {
  const side = (ids) => (ids.length > 3 ? `${ids.length} 座島` : ids.map(name).join("、"));
  return `${side(f.from)} ${f.two ? "⇄" : "→"} ${side(f.to)}`;
}

function flowItems(list) {
  return list
    .map((f) => `<li data-flow="${f.id}" data-res="${f.res}" style="--c:var(--${f.res})">${f.text}<div class="route">${routeText(f)}</div></li>`)
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
    html += `<button class="back" data-act="unfocus">← ${r ? r.zh : state.res === "all" ? "全部資源" : "總覽"}</button>
      <h2>${focus.port ? "" : `<span>${focus.n}</span>`} ${focus.zh}</h2>
      <div class="zh">${focus.port ? "對外連結" : "政策島"}</div>
      <div class="stats"><div><b>${shown.length}</b><span>${r ? `${r.zh}流動` : "流動"}</span></div>
        <div><b>${sends}</b><span>送出</span></div><div><b>${gets}</b><span>接收</span></div></div>
      <h3>${r ? `這裡的${r.zh}` : "這裡的流動"}</h3>
      ${shown.length ? `<ul class="list">${flowItems(shown)}</ul>` : `<p class="zh">沒有${r ? r.zh : ""}流動經過這裡。</p>`}`;
    if (r && touching.length > shown.length)
      html += `<p class="note">其他資源還有 ${touching.length - shown.length} 條流動，按 0 查看全部。</p>`;
  } else if (r) {
    const fl = flows.filter((f) => f.res === r.id);
    const top = [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    html += `<h2 style="--c:var(--${r.id})">${icon(r.id)} ${r.zh}</h2>
      <p>${r.blurb}</p>
      <div class="stats"><div><b>${fl.length}</b><span>流動</span></div>
        <div><b>${out.size}</b><span>來源</span></div><div><b>${inn.size}</b><span>接收端</span></div></div>
      <h3>主要來源</h3>
      <ul class="list">${top.map(([id, n]) => `<li data-node="${id}" style="--c:var(--${r.id})">${name(id)}<div class="route">送出 ${n} 條路線</div></li>`).join("")}</ul>
      <h3>流動</h3><ul class="list">${flowItems(fl)}</ul>
      <h3>圖例</h3>${legend()}`;
  } else {
    html += state.res === "all"
      ? `<h2>全部資源</h2>
      <p class="zh">六種資源的流動疊在一起，線條顏色代表資源種類。</p>`
      : `<h2>總覽</h2>
      <p class="zh">目前沒有顯示流動。選一種資源，或選「全部」一次看六種；島旁的圓點代表它參與哪些資源。</p>`;
    html += `
      <h3>資源</h3>
      <ul class="list">${resources
        .map((x) => {
          const n = flows.filter((f) => f.res === x.id).length;
          return `<li data-res="${x.id}" style="--c:var(--${x.id})"><b>${x.zh}</b><div class="route">${n} 條流動 · 按鍵 ${x.key}</div></li>`;
        })
        .join("")}</ul>
      <p class="note">按 1–6 選資源，按 0 看全部；再點一次同一個按鈕或按鍵就關閉，Esc 也會關閉。點一座島，看它送出和接收什麼。</p>`;
  }
  html += `${hooks.footer ? `<p class="note">${hooks.footer}</p>` : ""}${ABOUT}`;
  panel.innerHTML = html;
}

function legend() {
  return `<div class="legend">
    <div><span class="sw" style="background:color-mix(in srgb,var(--rc) 75%,var(--land))"></span>▲ 來源：送出這項資源</div>
    <div><span class="sw" style="background:color-mix(in srgb,var(--rc) 50%,var(--land))"></span>▲▼ 同時送出與接收</div>
    <div><span class="sw" style="background:color-mix(in srgb,var(--rc) 22%,var(--land))"></span>▼ 只接收</div>
    <div><span class="sw" style="background:var(--land-off)"></span>不在這個網絡中</div>
  </div>`;
}

// ---- wiring ------------------------------------------------------------------
// onRender(r, out, inn) redraws the map; onHoverFlow() redraws lanes only.
export function initUI(h) {
  hooks = h;
  const bar = $("#bar");
  bar.innerHTML =
    `<button data-res="all" title="全部資源（0）">${icon("all")}全部<kbd>0</kbd></button>` +
    resources.map((r) => `<button data-res="${r.id}" style="--c:var(--${r.id})" title="${r.zh}（${r.key}）">${icon(r.id)}${r.short}<kbd>${r.key}</kbd></button>`).join("");
  if (hooks.showModes) {
    const modes = [["people", "人物"], ["arrows", "箭頭"], ["both", "兩者"]];
    bar.insertAdjacentHTML("beforeend", `<div class="seg" role="group" aria-label="顯示方式"><span>顯示</span><div>${modes
      .map(([id, label]) => `<button data-show="${id}" title="流動以${label}顯示">${label}</button>`)
      .join("")}</div></div>`);
  }
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b?.dataset.show) return set({ show: b.dataset.show });
    // Clicking the selected resource again turns it off, like pressing its key twice.
    if (b) set({ res: b.dataset.res !== state.res ? b.dataset.res : null, hoverFlow: null, hoverNode: null });
  });

  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const r = resources.find((x) => x.key === e.key);
    if (r) set({ res: r.id === state.res ? null : r.id });
    else if (e.key === "0") set({ res: state.res === "all" ? null : "all" });
    else if (e.key === "Escape") set(state.focus ? { focus: null } : { res: null });
  });

  panel.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act],[data-node],[data-flow],[data-res]");
    if (!t) return;
    if (t.dataset.act === "unfocus") set({ focus: null });
    else if (t.dataset.node) set({ focus: t.dataset.node });
    else if (t.dataset.flow) set({ res: t.dataset.res, hoverFlow: t.dataset.flow });
    else if (t.dataset.res) set({ res: t.dataset.res });
  });
  // Hovering a 流動 row lights that flow's lanes; a 主要來源 row lights the lanes that island sends.
  const hover = (flow, node) => {
    if (flow === state.hoverFlow && node === state.hoverNode) return;
    Object.assign(state, { hoverFlow: flow, hoverNode: node });
    hooks.onHoverFlow?.();
  };
  panel.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-flow],[data-node]");
    const flow = t?.dataset.flow && (state.res === "all" || t.dataset.res === state.res) ? t.dataset.flow : null;
    hover(flow, t?.dataset.node || null);
  });
  panel.addEventListener("pointerleave", () => hover(null, null));

  render();
}
