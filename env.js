// Everything around the city: sky, sea, the hills of the basin, clouds, boats and wind
// turbines. None of it is data, so none of it tints in the info views. The city sits
// at the origin, roughly within x ±4 and z ±5.5.
import * as THREE from "three";

function rng(seed) {
  let h = seed >>> 0 || 1;
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A tileable normal map, scrolled to make the sea shimmer. Many small waves across
// several scales read as choppy water; a few broad ones read as rubber. Amplitude
// falls with frequency, like real ripples.
function waterNormals(N = 256) {
  const rand = rng(7);
  const waves = [];
  for (let k = 0; k < 22; k++) {
    const f = 3 + k * 1.3, a = rand() * Math.PI * 2;
    waves.push([Math.round(Math.cos(a) * f), Math.round(Math.sin(a) * f), 1.4 / f, rand() * Math.PI * 2]);
  }
  const h = (x, y) => waves.reduce((s, [fx, fy, a, p]) => s + a * Math.sin((2 * Math.PI * (fx * x + fy * y)) / N + p), 0);
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d"), img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 14, dy = (h(x, y + 1) - h(x, y - 1)) * 14;
      const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  return tex;
}

// Lighter, greener water hugging each island's shore, fading out to the open sea.
function shallowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"), g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.75)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// A small equirectangular sky for the sea to reflect: zenith, horizon, and a dark
// band below so grazing views don't reflect empty white.
function reflectionSky(top, horizon, below) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 32;
  const ctx = c.getContext("2d"), g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, top);
  g.addColorStop(0.48, horizon);
  g.addColorStop(0.52, below);
  g.addColorStop(1, below);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A soft white ring that hugs an island's shore.
function foamTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"), g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.74, "rgba(255,255,255,0)");
  g.addColorStop(0.8, "rgba(255,255,255,0.75)");
  g.addColorStop(0.88, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// The basin: water inside an ellipse around the city, hills rising beyond it, tallest
// to the north the way the mountains rise behind Taipei.
function basin() {
  const geo = new THREE.PlaneGeometry(90, 90, 180, 180).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const sand = new THREE.Color("#d9c99e"), grass = new THREE.Color("#86ad6c"), forest = new THREE.Color("#4e7e52");
  const ridge = new THREE.Color("#6f8f7f"), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const e = Math.hypot(x / 7.1, z / 9.1);
    const north = 0.5 - 0.5 * Math.cos(Math.atan2(x, z));
    const n = 0.5 + 0.25 * (Math.sin(x * 0.55 + Math.cos(z * 0.4) * 2) + Math.sin(z * 0.7 + x * 0.25));
    const y = -0.7 + smooth(1, 1.7, e) * (1.1 + 3.4 * north + 1.6 * n) + Math.sin(x * 2.1) * Math.cos(z * 1.7) * 0.08 * smooth(1.1, 1.5, e);
    pos.setY(i, y);
    if (y < 0.12) c.copy(sand);
    else if (y < 0.9) c.copy(sand).lerp(grass, smooth(0.12, 0.5, y));
    else if (y < 2.6) c.copy(grass).lerp(forest, smooth(0.9, 2, y));
    else c.copy(forest).lerp(ridge, smooth(2.6, 4.5, y));
    c.toArray(col, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
}

const puff = new THREE.IcosahedronGeometry(1, 2);
function cloud(m, rand, size) {
  const g = new THREE.Group();
  const n = 4 + Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) {
    const o = new THREE.Mesh(puff, m);
    const s = size * (0.6 + rand() * 0.6);
    o.position.set((k - n / 2) * size * 0.7 + rand() * 0.3, rand() * size * 0.3, (rand() - 0.5) * size * 0.8);
    o.scale.set(s, s * 0.62, s * 0.9);
    g.add(o);
  }
  return g;
}

function boat(rand) {
  const g = new THREE.Group(), hull = new THREE.BoxGeometry(0.32, 0.07, 0.12);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) p.setZ(i, p.getZ(i) * 0.2);
  hull.computeVertexNormals();
  const flat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
  const sails = ["#f6f1e6", "#f2d36b", "#e9806a", "#9cc3e0"];
  const h = new THREE.Mesh(hull, flat(rand() < 0.5 ? "#f3efe6" : "#c4523f"));
  h.position.y = 0.03;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.36), flat("#6b5a48"));
  mast.position.set(-0.02, 0.24, 0);
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 0.3), new THREE.Vector2(0.17, 0)]);
  const sailMat = flat(sails[Math.floor(rand() * sails.length)]);
  sailMat.side = THREE.DoubleSide;
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), sailMat);
  sail.position.set(-0.015, 0.08, 0);
  g.add(h, mast, sail);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

function turbine() {
  const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: "#eef0ee", roughness: 0.6 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 1.1, 10), white);
  tower.position.y = 0.55;
  const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), white);
  nacelle.position.set(0, 1.1, 0);
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.1, 0.06);
  for (let k = 0; k < 3; k++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.008).translate(0, 0.21, 0), white);
    blade.rotation.z = (k * Math.PI * 2) / 3;
    rotor.add(blade);
  }
  g.add(tower, nacelle, rotor);
  g.traverse((o) => (o.castShadow = true));
  return { g, rotor };
}

export function createEnv(scene, { css, isDark, renderer }) {
  // Sky: a vertical gradient behind everything, with haze toward its horizon color.
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 2;
  skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.Fog(0xffffff, 24, 58);

  const normals = waterNormals();
  // Glossy water that reflects the sky; the reflection is the sea's main color cue,
  // so the base color stays a little deeper than the water should look.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ roughness: 0.14, metalness: 0, normalMap: normals, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 0.65 }),
  );
  sea.receiveShadow = true;
  scene.add(sea, basin());
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  const shallowMat = new THREE.MeshBasicMaterial({ map: shallowTexture(), transparent: true, depthWrite: false, opacity: 0.45 });

  const foamMat = new THREE.MeshBasicMaterial({ map: foamTexture(), transparent: true, depthWrite: false });
  const foams = [];
  const foam = (x, z, r) => {
    const s = new THREE.Mesh(new THREE.CircleGeometry(r * 1.9, 48).rotateX(-Math.PI / 2), shallowMat);
    s.position.set(x, 0.006, z);
    scene.add(s);
    const o = new THREE.Mesh(new THREE.CircleGeometry(r * 1.32, 48).rotateX(-Math.PI / 2), foamMat);
    o.position.set(x, 0.012, z);
    o.userData.phase = foams.length * 1.7;
    scene.add(o);
    foams.push(o);
  };

  // Clouds float out over the hills, clear of the view of the islands.
  const rand = rng(20261023);
  const cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
  const clouds = [];
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI * 0.9 + rand() * Math.PI * 0.8, r = 17 + rand() * 9;
    const c = cloud(cloudMat, rand, 1 + rand() * 0.9);
    c.position.set(Math.sin(a) * r * 1.2, 5 + rand() * 2.5, -Math.abs(Math.cos(a) * r));
    scene.add(c);
    clouds.push({ o: c, speed: 0.12 + rand() * 0.1 });
  }

  // Sailboats loop the channel between the city and the shore.
  const boats = [];
  for (let k = 0; k < 6; k++) {
    const b = boat(rand);
    scene.add(b);
    boats.push({ o: b, phase: (k / 6) * Math.PI * 2 + rand() * 0.4, speed: (rand() < 0.5 ? 1 : -1) * (0.035 + rand() * 0.02), rx: 4.9 + rand() * 0.4, rz: 6.6 + rand() * 0.6 });
  }

  // A small wind farm on an islet off the west shore, outside the boats' widest loop
  // (x ≤ 5.3 at z = -1.5 plus half a hull) so no sail passes through it.
  const islet = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 9), new THREE.MeshStandardMaterial({ color: "#86ad6c", roughness: 0.95, flatShading: true }));
  islet.position.set(-6.3, -0.12, -1.5);
  islet.receiveShadow = islet.castShadow = true;
  scene.add(islet);
  const rotors = [];
  for (const [x, z] of [[-6.45, -1.7], [-6.1, -1.25]]) {
    const t = turbine();
    t.g.position.set(x, 0.13, z);
    t.rotor.rotation.z = rand() * 3;
    scene.add(t.g);
    rotors.push(t.rotor);
  }

  function applyTheme() {
    const ctx = skyCanvas.getContext("2d"), g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, css("--sky-top"));
    g.addColorStop(0.7, css("--sky"));
    g.addColorStop(1, css("--sky"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 256);
    skyTex.needsUpdate = true;
    scene.fog.color.set(css("--sky"));
    sea.material.color.set(css("--sea"));
    shallowMat.color.set(css("--shallow"));
    shallowMat.opacity = isDark() ? 0.3 : 0.45;
    envRT?.dispose();
    const refl = reflectionSky(css("--sky-top"), css("--sky"), css("--sea"));
    envRT = pmrem.fromEquirectangular(refl);
    refl.dispose();
    sea.material.envMap = envRT.texture;
    sea.material.needsUpdate = true;
    foamMat.opacity = isDark() ? 0.45 : 0.85;
    cloudMat.color.set(isDark() ? "#5d6780" : "#ffffff");
  }

  function update(t, dt) {
    normals.offset.set(t * 0.012, t * 0.007);
    for (const f of foams) f.scale.setScalar(1 + Math.sin(t * 0.9 + f.userData.phase) * 0.02);
    for (const c of clouds) {
      c.o.position.x += c.speed * dt;
      if (c.o.position.x > 30) c.o.position.x = -30;
    }
    for (const b of boats) {
      const a = b.phase + t * b.speed, x = Math.sin(a) * b.rx, z = Math.cos(a) * b.rz;
      b.o.position.set(x, Math.sin(t * 1.3 + b.phase * 3) * 0.012, z);
      b.o.rotation.set(Math.sin(t * 1.1 + b.phase) * 0.06, Math.atan2(b.speed * Math.cos(a) * b.rx, -b.speed * Math.sin(a) * b.rz) - Math.PI / 2, 0);
    }
    for (const r of rotors) r.rotation.z -= dt * 1.4;
  }

  return { foam, applyTheme, update };
}
