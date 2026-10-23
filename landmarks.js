// Small models of each island's policy items, placed on corner plots in place of
// generic houses. Each builder draws into a group whose origin sits on the island
// surface, front (+z) facing the ring road, within about ±0.11 of the origin.
// Every model is an original, generic design; the item names only suggest the subject.
import * as THREE from "three";

export function createItems({ mesh, mat, G, house, tree, winMat, lampMat }) {
  const wheel = new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2);
  const dish = new THREE.SphereGeometry(0.045, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4);
  const disc = new THREE.CylinderGeometry(1, 1, 1, 24);
  const ring = new THREE.TorusGeometry(0.02, 0.004, 6, 18);
  const star = new THREE.ExtrudeGeometry(
    new THREE.Shape(Array.from({ length: 10 }, (_, k) => {
      const a = (k * Math.PI) / 5, r = k % 2 ? 0.022 : 0.05;
      return new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r);
    })),
    { depth: 0.014, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 },
  ).translate(0, 0, -0.007);
  const shield = new THREE.ExtrudeGeometry(
    new THREE.Shape([new THREE.Vector2(-0.03, 0.03), new THREE.Vector2(0.03, 0.03), new THREE.Vector2(0.03, -0.005), new THREE.Vector2(0, -0.035), new THREE.Vector2(-0.03, -0.005)]),
    { depth: 0.006, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 },
  );

  // Shared pieces --------------------------------------------------------------
  const box = (p, id, c, x, y, z, w, h, d, flat) => mesh(p, G.box, mat(id, c, null, flat), x, y, z, w, h, d);
  const post = (p, id, c, x, y0, h, z, r = 0.006) => mesh(p, G.cyl, mat(id, c), x, y0 + h / 2, z, r, h, r);
  const wheels = (p, id, xs, z, y, r) => {
    for (const x of xs) for (const s of [-1, 1]) mesh(p, wheel, mat(id, "#2f2f33"), x, y, s * z, 0.012, r, r);
  };
  function vehicle(p, id, color, z0 = 0) {
    box(p, id, color, 0, 0.05, z0, 0.2, 0.068, 0.09);
    for (const s of [-1, 1]) box(p, id, "#4a5a6c", 0.005, 0.064, z0 + s * 0.046, 0.16, 0.022, 0.004).material = winMat(id);
    box(p, id, "#fbf7ee", 0.1, 0.064, z0, 0.004, 0.026, 0.07);
    wheels(p, id, [-0.065, 0.065], z0 + 0.046, 0.017, 0.017);
  }
  function bench(p, id, x, z, rot = 0) {
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    b.rotation.y = rot;
    box(b, id, "#a8794f", 0, 0.03, 0, 0.08, 0.008, 0.026);
    box(b, id, "#a8794f", 0, 0.05, -0.012, 0.08, 0.026, 0.006);
    for (const s of [-1, 1]) box(b, id, "#5a5550", s * 0.032, 0.015, 0, 0.006, 0.03, 0.022);
    p.add(b);
  }
  const bush = (p, id, x, z, s = 1) => mesh(p, G.crown, mat(id, "#5f9a55"), x, 0.025 * s, z, 0.03 * s, 0.026 * s, 0.03 * s);
  function pavilion(p, id, roof) {
    for (const x of [-0.06, 0.06]) for (const z of [-0.05, 0.05]) post(p, id, "#efe6d6", x, 0, 0.1, z, 0.007);
    box(p, id, "#d8cdb8", 0, 0.006, 0, 0.15, 0.012, 0.13);
    mesh(p, G.roof, mat(id, roof, null, true), 0, 0.135, 0, 0.19, 0.075, 0.17);
    bench(p, id, 0, -0.02);
  }

  // Models ---------------------------------------------------------------------
  const M = {
    clockTower(p, id, rand, accent) {
      box(p, id, "#f4ede0", 0, 0.012, 0, 0.13, 0.024, 0.13);
      box(p, id, "#efe6d6", 0, 0.18, 0, 0.1, 0.32, 0.1);
      mesh(p, disc, mat(id, "#fbf7ee"), 0, 0.27, 0.052, 0.034, 0.008, 0.034).rotation.x = Math.PI / 2;
      box(p, id, "#2f2f33", 0, 0.282, 0.058, 0.004, 0.024, 0.003);
      box(p, id, "#2f2f33", 0.008, 0.27, 0.058, 0.018, 0.004, 0.003);
      mesh(p, G.roof, mat(id, accent, null, true), 0, 0.375, 0, 0.13, 0.07, 0.13);
    },
    aiBase(p, id, rand, accent) {
      house(p, id, 0, 0, -0.01, 0.16, 0.13, 0.12, "#e9eef2", accent, 0, "flat", rand);
      const d = mesh(p, dish, mat(id, "#f6f6f3"), 0.03, 0.2, -0.02, 1, 1, 1);
      d.rotation.set(-0.6, 0, 0.3);
      post(p, id, "#7d8a92", -0.05, 0.16, 0.08, -0.03, 0.004);
      mesh(p, G.lampHead, lampMat, -0.05, 0.245, -0.03, 0.6, 0.6, 0.6);
    },
    healthKiosk(p, id, rand) {
      box(p, id, "#fbfaf6", 0, 0.06, 0, 0.13, 0.12, 0.1);
      box(p, id, "#4f9c6a", 0, 0.128, 0.01, 0.15, 0.016, 0.13);
      box(p, id, "#4f9c6a", 0, 0.085, 0.052, 0.014, 0.04, 0.004);
      box(p, id, "#4f9c6a", 0, 0.085, 0.052, 0.04, 0.014, 0.004);
      box(p, id, "#4a5a6c", 0, 0.04, 0.051, 0.07, 0.03, 0.004).material = winMat(id);
    },
    childSafety(p, id, rand) {
      house(p, id, 0, 0, -0.01, 0.17, 0.13, 0.15, "#eef2f6", "#3f70b2", 0, "flat", rand);
      mesh(p, shield, mat(id, "#3f70b2"), 0, 0.13, 0.058, 1, 1, 1);
      box(p, id, "#fbf7ee", 0, 0.132, 0.068, 0.012, 0.03, 0.003);
    },
    accessible(p, id, rand, accent) {
      house(p, id, 0, 0, -0.03, 0.15, 0.1, 0.12, "#f3ece0", accent, 0, "hip", rand);
      const ramp = box(p, id, "#d8cdb8", 0.05, 0.012, 0.055, 0.04, 0.012, 0.09);
      ramp.rotation.x = 0.28;
      for (const x of [0.03, 0.07]) post(p, id, "#7d8a92", x, 0, 0.05, 0.075, 0.003);
    },
    elderPavilion(p, id, rand, accent) {
      pavilion(p, id, accent);
      bush(p, id, 0.085, 0.06);
      bush(p, id, -0.085, 0.06, 0.8);
    },
    busStop(p, id, rand, accent) {
      box(p, id, accent, 0, 0.112, -0.055, 0.13, 0.01, 0.055);
      for (const x of [-0.055, 0.055]) post(p, id, "#7d8a92", x, 0, 0.11, -0.075, 0.004);
      box(p, id, "#4a5a6c", 0, 0.06, -0.08, 0.1, 0.07, 0.004).material.opacity = 1;
      bench(p, id, 0, -0.06);
      vehicle(p, id, "#4f9c6a", 0.05);
    },
    bikeDock(p, id, rand) {
      box(p, id, "#7d8a92", 0, 0.012, -0.06, 0.15, 0.024, 0.012);
      for (const z of [-0.035, 0.005, 0.045]) {
        const b = new THREE.Group();
        b.position.set(0, 0, z);
        for (const x of [-0.03, 0.03]) mesh(b, ring, mat(id, "#2f2f33"), x, 0.024, 0, 1, 1, 1);
        box(b, id, "#e8a33a", 0, 0.04, 0, 0.06, 0.007, 0.007);
        box(b, id, "#e8a33a", -0.016, 0.036, 0, 0.007, 0.028, 0.007);
        box(b, id, "#e8a33a", 0.026, 0.044, 0, 0.007, 0.03, 0.007);
        box(b, id, "#3a3a3e", -0.016, 0.054, 0, 0.022, 0.006, 0.012);
        box(b, id, "#3a3a3e", 0.026, 0.06, 0, 0.006, 0.006, 0.03);
        p.add(b);
      }
    },
    signpost(p, id, rand) {
      post(p, id, "#8a6446", 0, 0, 0.14, 0, 0.008);
      for (const [y, rot, c] of [[0.12, 0.4, "#4f8c55"], [0.095, -0.5, "#c9930f"], [0.07, 2.4, "#3f70b2"]]) {
        const s = box(p, id, c, Math.cos(rot) * 0.025, y, -Math.sin(rot) * 0.025, 0.055, 0.016, 0.006);
        s.rotation.y = rot;
      }
      bush(p, id, 0.05, 0.04, 0.9);
      bush(p, id, -0.045, -0.03, 0.7);
    },
    playground(p, id, rand) {
      box(p, id, "#e8d9b0", 0, 0.004, 0, 0.21, 0.008, 0.19);
      // Slide: platform on posts, a ladder side and a tilted chute.
      for (const x of [-0.07, -0.03]) for (const z of [-0.05, -0.01]) post(p, id, "#3f70b2", x, 0, 0.07, z, 0.004);
      box(p, id, "#e2b23a", -0.05, 0.072, -0.03, 0.05, 0.008, 0.05);
      const chute = box(p, id, "#d65a5a", 0.0, 0.042, -0.03, 0.075, 0.006, 0.03);
      chute.rotation.z = -0.65;
      // Swing: a top bar on two posts, two seats on ropes.
      box(p, id, "#3f70b2", 0.02, 0.11, 0.06, 0.14, 0.008, 0.008);
      for (const x of [-0.05, 0.09]) post(p, id, "#3f70b2", x, 0, 0.11, 0.06, 0.004);
      for (const x of [0.0, 0.05]) {
        for (const dx of [-0.008, 0.008]) post(p, id, "#7d8a92", x + dx, 0.035, 0.075, 0.06, 0.0015);
        box(p, id, "#e2b23a", x, 0.035, 0.06, 0.026, 0.005, 0.016);
      }
    },
    raisedBeds(p, id, rand) {
      for (const z of [-0.045, 0.045]) {
        box(p, id, "#a8794f", 0, 0.014, z, 0.17, 0.028, 0.05);
        box(p, id, "#6b4a3a", 0, 0.03, z, 0.155, 0.006, 0.04);
        for (let k = 0; k < 5; k++) mesh(p, G.crown, mat(id, k % 2 ? "#6aa84f" : "#86b85a"), -0.06 + k * 0.03, 0.042, z, 0.014, 0.014, 0.014);
      }
      mesh(p, G.fruit, mat(id, "#ef8a4b"), 0.07, 0.04, 0.03, 0.9, 0.9, 0.9);
    },
    lunchCart(p, id, rand) {
      box(p, id, "#c8956a", 0, 0.05, 0, 0.13, 0.06, 0.075);
      wheels(p, id, [-0.04, 0.04], 0.04, 0.016, 0.016);
      for (let k = 0; k < 5; k++) {
        const s = box(p, id, k % 2 ? "#fbf7ee" : "#d65a5a", -0.052 + k * 0.026, 0.115, 0.01, 0.026, 0.006, 0.1);
        s.rotation.x = -0.25;
      }
      for (const x of [-0.06, 0.06]) post(p, id, "#7d8a92", x, 0.08, 0.04, -0.03, 0.003);
      for (let k = 0; k < 3; k++) mesh(p, G.fruit, mat(id, ["#f2c14e", "#6aa84f", "#e8524f"][k]), -0.03 + k * 0.03, 0.086, 0.02, 1.1, 1.1, 1.1);
    },
    hotlineBooth(p, id, rand) {
      box(p, id, "#3f8c8c", 0, 0.075, 0, 0.065, 0.15, 0.065);
      box(p, id, "#4a5a6c", 0, 0.075, 0.033, 0.045, 0.1, 0.004).material = winMat(id);
      mesh(p, disc, mat(id, "#fbf7ee"), 0, 0.172, 0, 0.026, 0.012, 0.026);
      bench(p, id, 0.06, 0.03, -Math.PI / 2);
      bush(p, id, -0.065, 0.03);
    },
    daycare(p, id, rand) {
      house(p, id, 0, 0, -0.04, 0.15, 0.1, 0.11, "#fde9d6", "#e8774f", 0, "gable", rand);
      box(p, id, "#c8956a", -0.03, 0.01, 0.06, 0.08, 0.02, 0.06);
      box(p, id, "#efe2bd", -0.03, 0.016, 0.06, 0.068, 0.01, 0.048);
      mesh(p, G.fruit, mat(id, "#d65a5a"), 0.05, 0.016, 0.06, 1.1, 1.1, 1.1);
    },
    bookshop(p, id, rand) {
      house(p, id, 0, 0, -0.02, 0.16, 0.11, 0.12, "#f4efe4", "#3f70b2", 0, "flat", rand);
      for (let k = 0; k < 5; k++) {
        const s = box(p, id, k % 2 ? "#fbf7ee" : "#3f70b2", -0.052 + k * 0.026, 0.11, 0.05, 0.026, 0.006, 0.04);
        s.rotation.x = -0.35;
      }
      for (const [x, c] of [[-0.04, "#d65a5a"], [-0.03, "#e2b23a"], [-0.02, "#4f9c6a"]]) box(p, id, c, x, 0.155, 0.04, 0.008, 0.03, 0.022);
    },
    fitness(p, id, rand) {
      box(p, id, "#d65a5a", 0, 0.003, 0, 0.18, 0.006, 0.14);
      for (const x of [-0.05, 0.05]) post(p, id, "#3f70b2", x, 0, 0.12, -0.04, 0.005);
      box(p, id, "#e2b23a", 0, 0.12, -0.04, 0.11, 0.008, 0.008);
      box(p, id, "#a8794f", 0, 0.022, 0.04, 0.14, 0.012, 0.018);
      for (const x of [-0.06, 0.06]) post(p, id, "#7d8a92", x, 0, 0.02, 0.04, 0.004);
    },
    sportsDome(p, id, rand, accent) {
      mesh(p, G.cyl, mat(id, accent), 0, 0.012, 0, 0.1, 0.024, 0.1);
      mesh(p, new THREE.SphereGeometry(0.095, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(id, "#f4f6f8"), 0, 0.024, 0, 1, 0.8, 1);
      box(p, id, "#4a5a6c", 0, 0.035, 0.095, 0.04, 0.03, 0.004).material = winMat(id);
    },
    minibus(p, id, rand, accent) {
      vehicle(p, id, accent);
      bush(p, id, -0.07, -0.07, 0.8);
    },
    schoolBus(p, id, rand) {
      vehicle(p, id, "#e2b23a");
      box(p, id, "#2f2f33", 0, 0.088, 0, 0.18, 0.004, 0.092);
    },
    trailCabin(p, id, rand) {
      house(p, id, 0, 0, -0.02, 0.15, 0.11, 0.1, "#9a6a45", "#4f7d52", 0, "gable", rand);
      post(p, id, "#8a6446", 0.08, 0, 0.09, 0.06, 0.005);
      box(p, id, "#4f8c55", 0.08, 0.085, 0.06, 0.05, 0.022, 0.006);
    },
    pocketPark(p, id, rand) {
      box(p, id, "#d8cdb8", 0, 0.004, 0, 0.2, 0.008, 0.18);
      mesh(p, G.cyl, mat(id, "#cfc5b3"), 0, 0.018, 0, 0.05, 0.028, 0.05);
      mesh(p, disc, mat(id, "#7cc4d9"), 0, 0.032, 0, 0.044, 0.004, 0.044);
      mesh(p, G.cyl, mat(id, "#cfc5b3"), 0, 0.05, 0, 0.008, 0.04, 0.008);
      bench(p, id, 0, -0.07);
      bench(p, id, 0.075, 0, -Math.PI / 2);
      bush(p, id, -0.075, 0.06);
      bush(p, id, -0.075, -0.06, 0.8);
    },
    logPile(p, id, rand) {
      const log = new THREE.CylinderGeometry(0.014, 0.014, 0.11, 10).rotateZ(Math.PI / 2);
      for (const [y, zs] of [[0.014, [-0.04, -0.012, 0.016, 0.044]], [0.038, [-0.026, 0.002, 0.03]], [0.062, [-0.012, 0.016]]])
        for (const z of zs) mesh(p, log, mat(id, "#a8794f"), 0, y, z, 1, 1, 1);
      for (const x of [-0.065, 0.065]) post(p, id, "#7d8a92", x, 0, 0.1, -0.06, 0.004);
      box(p, id, "#4f7d52", 0, 0.1, -0.01, 0.15, 0.008, 0.11, true);
    },
    sensorTree(p, id, rand) {
      tree(p, id, 0, 0, 0, 1.3, rand);
      box(p, id, "#e9eef2", 0.02, 0.08, 0.02, 0.022, 0.03, 0.016);
      mesh(p, G.lampHead, lampMat, 0.02, 0.1, 0.02, 0.4, 0.4, 0.4);
      bush(p, id, -0.06, 0.05, 0.7);
    },
    starSculpture(p, id, rand, accent) {
      mesh(p, G.cyl, mat(id, "#cfc5b3"), 0, 0.015, 0, 0.05, 0.03, 0.05);
      post(p, id, "#e9eef2", 0, 0.03, 0.09, 0, 0.005);
      mesh(p, star, mat(id, "#f2c14e"), 0, 0.15, 0, 1, 1, 1);
      bush(p, id, 0.06, 0.04, 0.8);
      bush(p, id, -0.06, 0.04, 0.8);
    },
    flagRow(p, id, rand) {
      for (const [x, c] of [[-0.06, "#3f70b2"], [0, "#e2b23a"], [0.06, "#4f9c6a"]]) {
        post(p, id, "#e9eef2", x, 0, 0.17, 0, 0.004);
        box(p, id, c, x + 0.022, 0.15, 0, 0.042, 0.028, 0.004);
      }
      box(p, id, "#cfc5b3", 0, 0.006, 0, 0.17, 0.012, 0.04);
    },
    umbrellas(p, id, rand) {
      // Oil-paper umbrellas opened to dry on a low rack.
      box(p, id, "#a8794f", 0, 0.01, 0, 0.17, 0.02, 0.07);
      for (const [x, c, tilt] of [[-0.055, "#d9573f", 0.3], [0, "#e8a33a", -0.2], [0.055, "#3f7f8c", 0.25]]) {
        const u = new THREE.Group();
        u.position.set(x, 0.02, 0);
        u.rotation.x = tilt;
        post(u, id, "#8a6446", 0, 0, 0.07, 0, 0.003);
        mesh(u, G.cone, mat(id, c), 0, 0.08, 0, 0.05, 0.026, 0.05);
        p.add(u);
      }
    },
  };

  // 2–3 items per island, in the order they claim corner plots, each with the policy
  // item it stands for (the item's short name from the source's public data).
  const it = (name, build) => ({ name, build });
  return {
    civil: [it("彈性上下班鐘塔", M.clockTower), it("AI 支援小隊基地", M.aiBase), it("健檢補助站", M.healthKiosk)],
    institute: [it("兒少安全治理中心", M.childSafety), it("無障礙城市設計中心", M.accessible), it("失智友善中心", M.elderPavilion)],
    transport: [it("公車安全改革", M.busStop), it("YouBike 2.0E 尖峰免費", M.bikeDock), it("河濱車道評分", M.signpost)],
    education: [it("小班教室", M.playground), it("AI 教學工具", M.aiBase)],
    lunch: [it("在地小農田", M.raisedBeds), it("彈性餐費機制", M.lunchCart)],
    family: [it("單一育兒專線", M.hotlineBooth), it("每週免費臨托", M.daycare)],
    card: [it("分齡閱讀禮袋", M.bookshop), it("運動幣", M.fitness)],
    welfare: [it("住宿型長照與共照據點", M.elderPavilion), it("在宅醫療", M.minibus), it("皮蛇疫苗", M.healthKiosk)],
    sport: [it("社區運動小巴", M.minibus), it("巷口運動據點", M.fitness), it("花博旗艦運動中心", M.sportsDome)],
    trails: [it("劍潭登山觀光中心", M.trailCabin), it("城市歷史記憶徑", M.signpost), it("最後一哩接駁", M.minibus)],
    forest: [it("口袋公園", M.pocketPark), it("廢木料銀行", M.logPile), it("路樹數位雙生", M.sensorTree)],
    youth: [it("台北青年圓夢計畫", M.starSculpture), it("AI 教育錢包", M.aiBase)],
    diplomacy: [it("無限城合作網絡", M.flagRow), it("基層公務員半年互換", M.minibus)],
    hakka: [it("長輩有據點", M.elderPavilion), it("兒童有互訪", M.schoolBus), it("世界有客家", M.umbrellas)],
  };
}
