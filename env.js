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

// Signed distance from (x, z) to a pointy-top hexagon (corners toward ±z) with corner
// radius R centered at (cx, cz). Negative inside.
function hexDist(x, z, cx, cz, R) {
  const k = [-0.866025404, 0.5, 0.577350269], r = R * 0.866025404;
  // In this frame the flat sides face ±x, so x plays the role of "y" in the usual formula.
  let px = Math.abs(z - cz), py = Math.abs(x - cx);
  const d = 2 * Math.min(k[0] * px + k[1] * py, 0);
  px -= d * k[0];
  py -= d * k[1];
  px -= Math.min(Math.max(px, -k[2] * r), k[2] * r);
  py -= r;
  return Math.hypot(px, py) * Math.sign(py);
}

// The sea is shaded live: ripples come from overlapping waves evaluated per pixel, so
// the surface moves instead of sliding. A baked distance-to-shore field drives the
// shallow-to-deep color and the lapping foam. It extends MeshStandardMaterial, so
// lighting, shadows, fog and the sky reflection still apply.
const SEA_UNIFORMS = `
uniform float uTime;
uniform sampler2D uShore;
uniform vec4 uShoreBox; // min x, min z, size, max distance
uniform vec3 uShallow, uDeep, uFoam, uSkyTint;
uniform float uFoamAmt, uRipple;
varying vec3 vSeaPos;
float shoreDist(vec2 p) {
  vec2 uv = (p - uShoreBox.xy) / uShoreBox.z;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return uShoreBox.w;
  return texture2D(uShore, uv).r * uShoreBox.w;
}
// Gradient of a sum of directional waves. Directions fan around a prevailing wind,
// speeds follow deep-water dispersion (slower for longer waves), and a slow warp
// bends the crests so no two patches repeat.
vec2 rippleGrad(vec2 p, float t) {
  p += 0.35 * vec2(sin(p.y * 0.45 + t * 0.21), cos(p.x * 0.38 - t * 0.17));
  float gust = 0.65 + 0.35 * sin(p.x * 0.23 + t * 0.11) * sin(p.y * 0.19 - t * 0.09);
  vec2 g = vec2(0.0);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float ang = 0.6 + fi * 2.39996;              // golden-angle spread of directions
    vec2 dir = vec2(cos(ang), sin(ang));
    float k = 2.2 + fi * 1.55;                   // wavenumber: long swells to small chop
    float w = sqrt(9.8 * k) * 0.42;              // dispersion, slowed for a calm bay
    float a = 0.11 / k;                           // smaller waves are lower
    float ph = dot(dir, p) * k + t * w + fi * 1.7;
    g += dir * (a * k * cos(ph));
  }
  return g * gust;
}
`;

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

  // Distance to the nearest island edge, baked once into a texture the shader samples.
  const SHORE = { n: 512, min: -12, size: 24, max: 3 };
  const shoreTex = new THREE.DataTexture(new Uint8Array(SHORE.n * SHORE.n), SHORE.n, SHORE.n, THREE.RedFormat);
  shoreTex.magFilter = shoreTex.minFilter = THREE.LinearFilter;
  const shores = [];
  let shoreDirty = true;
  function bakeShore() {
    const { n, min, size, max } = SHORE, data = shoreTex.image.data;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = min + ((i + 0.5) / n) * size, z = min + ((j + 0.5) / n) * size;
        let d = max;
        for (const [cx, cz, R] of shores) d = Math.min(d, hexDist(x, z, cx, cz, R));
        data[j * n + i] = Math.round((Math.max(0, d) / max) * 255);
      }
    shoreTex.needsUpdate = true;
    shoreDirty = false;
  }
  // Each island registers its shoreline; the hex's waterline sits just inside its
  // corner radius because the rock base tapers.
  const foam = (x, z, r) => {
    shores.push([x, z, r * 0.97]);
    shoreDirty = true;
  };

  const SEA_SPEED = 0.5;
  const seaUniforms = {
    uTime: { value: 0 },
    uShore: { value: shoreTex },
    uShoreBox: { value: new THREE.Vector4(SHORE.min, SHORE.min, SHORE.size, SHORE.max) },
    uShallow: { value: new THREE.Color() },
    uDeep: { value: new THREE.Color() },
    uFoam: { value: new THREE.Color("#ffffff") },
    uSkyTint: { value: new THREE.Color() },
    uFoamAmt: { value: 0.9 },
    uRipple: { value: 2.6 },
  };
  const seaMat = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0, envMapIntensity: 0.55 });
  seaMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, seaUniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeaPos;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvSeaPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + SEA_UNIFORMS)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float seaD = shoreDist(vSeaPos.xz);
        diffuseColor.rgb = mix(uShallow, uDeep, smoothstep(0.0, 1.0, seaD));
        // Ripple slopes tint the water too, lighter on the crests: a clear sky
        // reflects almost evenly, so shading alone barely shows small waves.
        float seaFade = clamp(1.0 - length(vViewPosition) / 60.0, 0.4, 1.0);
        vec2 seaG = rippleGrad(vSeaPos.xz, uTime) * uRipple * seaFade;
        diffuseColor.rgb = mix(diffuseColor.rgb, uShallow * 1.25, clamp(dot(seaG, vec2(0.6, 0.8)) * 0.9, 0.0, 0.35));`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `// Ripples fade with distance so far water stays calm instead of shimmering.
        normal = normalize((viewMatrix * vec4(normalize(vec3(-seaG.x, 1.0, -seaG.y)), 0.0)).xyz);`,
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        // Fresnel: grazing views pick up more of the sky.
        float seaFr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 5.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uSkyTint, seaFr * 0.3);
        // Lapping foam: an edge that swells and recedes along the shore, plus broken
        // bands rolling in toward it.
        vec2 sp = vSeaPos.xz;
        float lap = 0.08 + 0.045 * sin(uTime * 1.25 + sp.x * 1.9 + sp.y * 1.3);
        float edge = 1.0 - smoothstep(lap * 0.45, lap, seaD);
        float roll = fract(seaD * 2.6 + uTime * 0.32);
        float band = smoothstep(0.0, 0.05, roll) * (1.0 - smoothstep(0.05, 0.15, roll));
        float breakup = smoothstep(0.2, 0.75, 0.5 + 0.5 * sin(sp.x * 7.3 + sin(sp.y * 5.1 + uTime * 0.6) * 2.0) * sin(sp.y * 6.7 - uTime * 0.45));
        band *= breakup * (1.0 - smoothstep(0.15, 0.5, seaD));
        float seaFoam = max(edge, band * 0.75) * uFoamAmt;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFoam, seaFoam);`,
      );
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), seaMat);
  sea.receiveShadow = true;
  scene.add(sea, basin());
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

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
  foam(-6.3, -1.5, 0.64); // round, but the hex shoreline is close enough for foam
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
    seaUniforms.uDeep.value.set(css("--sea"));
    seaUniforms.uShallow.value.set(css("--shallow"));
    seaUniforms.uSkyTint.value.set(css("--sky"));
    seaUniforms.uFoamAmt.value = isDark() ? 0.55 : 0.9;
    envRT?.dispose();
    const refl = reflectionSky(css("--sky-top"), css("--sky"), css("--sea"));
    envRT = pmrem.fromEquirectangular(refl);
    refl.dispose();
    sea.material.envMap = envRT.texture;
    sea.material.needsUpdate = true;
    cloudMat.color.set(isDark() ? "#5d6780" : "#ffffff");
  }

  function update(t, dt) {
    if (shoreDirty) bakeShore();
    // Water runs on half-speed time: at full speed the ripples and foam read as busy.
    seaUniforms.uTime.value = t * SEA_SPEED;
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
