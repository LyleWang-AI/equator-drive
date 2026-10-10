// 场景：天空、海面、云、分块生成的地形 / 公路 / 植被 / 地标
window.ED = window.ED || {};

(function (ED) {
  const geo = ED.geo;
  const CHUNK = 100;
  const AHEAD = 28;
  const BEHIND = 3;
  const ROAD_Y = 2.0;
  const ROAD_HALF = 6.3;
  const RAIL_X = 5.15;
  const BASE_Y = 1.6;
  const SEA_FLOOR = -12;
  const FOG_NEAR = 250;
  const FOG_FAR = 4800;
  const GROUND_XS = [-3600, -3200, -2800, -2400, -2050, -1740, -1480, -1260, -1070, -900, -750, -620, -510, -420, -340, -270, -210, -155, -115, -82, -56, -40, -28, -20, -14, -9,
    9, 14, 20, 28, 40, 56, 82, 115, 155, 210, 270, 340, 420, 510, 620, 750, 900, 1070, 1260, 1480, 1740, 2050, 2400, 2800, 3200, 3600];
  const ROW_STEP = 10;

  // ---------- 噪声与随机 ----------
  function hash2(ix, iy) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function noise2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y) {
    return noise2(x, y) * 0.55 + noise2(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + noise2(x * 4.3 + 3, y * 4.3 + 41) * 0.15;
  }
  function ridge(x, y) {
    return 1 - Math.abs(fbm(x, y) * 2 - 1);
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function smooth(e0, e1, x) {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  // ---------- 几何工具 ----------
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  function M(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  }
  function colored(g, hex, matrix) {
    g = g.index ? g.toNonIndexed() : g;
    if (matrix) g.applyMatrix4(matrix);
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    return g;
  }
  function merge(list) {
    let total = 0;
    for (const g of list) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }

  // ---------- 共享材质 ----------
  const flatMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false });
  const COL = {
    sand: new THREE.Color(0xd9c58e),
    seabed: new THREE.Color(0x8a7a55),
    rock: new THREE.Color(0x6e6862),
    snow: new THREE.Color(0xf4f6f8),
    far: new THREE.Color(0x93a8ba),
    dirt: new THREE.Color(0x7a6244),
    dry: new THREE.Color(0xc6b07a),
    shoulder: new THREE.Color(0x8f825f),
  };

  // ---------- 植被模型 ----------
  function buildTreeGeos() {
    const T = {};
    T.jungle = merge([
      colored(new THREE.CylinderGeometry(0.45, 0.8, 14, 6), 0x5a4030, M(0, 7, 0)),
      colored(new THREE.IcosahedronGeometry(5, 0), 0x2c5e22, M(0, 15, 0, 0, 0, 0, 1.4, 0.75, 1.4)),
      colored(new THREE.IcosahedronGeometry(3.6, 0), 0x376d28, M(2.8, 12.5, 1, 0.3, 0.5, 0)),
      colored(new THREE.IcosahedronGeometry(3.2, 0), 0x24521d, M(-2.3, 13.5, -1.6, 0.2, 1, 0)),
    ]);
    T.broadleaf = merge([
      colored(new THREE.CylinderGeometry(0.3, 0.45, 4, 6), 0x5e4532, M(0, 2, 0)),
      colored(new THREE.IcosahedronGeometry(3.2, 0), 0x4a8a30, M(0, 6, 0, 0, 0, 0, 1.2, 0.9, 1.2)),
    ]);
    const palm = [
      colored(new THREE.CylinderGeometry(0.24, 0.32, 4, 5), 0x8a6a45, M(0, 2, 0, 0, 0, -0.06)),
      colored(new THREE.CylinderGeometry(0.2, 0.25, 4, 5), 0x8a6a45, M(0.35, 5.9, 0, 0, 0, -0.14)),
      colored(new THREE.CylinderGeometry(0.17, 0.21, 3.6, 5), 0x8a6a45, M(0.95, 9.6, 0, 0, 0, -0.24)),
    ];
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.BoxGeometry(5, 0.12, 0.9);
      leaf.translate(2.5, 0, 0);
      leaf.rotateZ(-0.38 - (i % 2) * 0.15);
      leaf.rotateY(i * Math.PI * 2 / 7);
      leaf.translate(1.4, 11.3, 0);
      palm.push(colored(leaf, i % 2 ? 0x3f8a2a : 0x4d9a33));
    }
    T.palm = merge(palm);
    T.acacia = merge([
      colored(new THREE.CylinderGeometry(0.22, 0.38, 5, 5), 0x5b4433, M(0, 2.5, 0, 0, 0, 0.12)),
      colored(new THREE.CylinderGeometry(0.15, 0.2, 2.5, 5), 0x5b4433, M(-1.0, 4.6, 0, 0, 0, 0.7)),
      colored(new THREE.CylinderGeometry(4.6, 3.6, 1.1, 7), 0x6b8a35, M(-0.4, 5.9, 0)),
    ]);
    T.conifer = merge([
      colored(new THREE.CylinderGeometry(0.22, 0.32, 2, 5), 0x4e3a2a, M(0, 1, 0)),
      colored(new THREE.ConeGeometry(2.2, 7, 6), 0x2f5530, M(0, 5.3, 0)),
    ]);
    T.cactus = merge([
      colored(new THREE.CylinderGeometry(0.45, 0.6, 4.2, 6), 0x5b7a3c, M(0, 2.1, 0)),
      colored(new THREE.CylinderGeometry(0.3, 0.35, 1.8, 6), 0x5b7a3c, M(0.8, 3.0, 0, 0, 0, -0.5)),
      colored(new THREE.CylinderGeometry(0.3, 0.35, 1.6, 6), 0x5b7a3c, M(-0.75, 2.6, 0, 0, 0, 0.55)),
    ]);
    return T;
  }

  function buildShipGeo() {
    const rng = mulberry32(7);
    const parts = [
      colored(new THREE.BoxGeometry(14, 4, 72), 0x7a2a22, M(0, 0.5, 0)),
      colored(new THREE.BoxGeometry(14.2, 1, 72.2), 0x222222, M(0, 2.8, 0)),
      colored(new THREE.BoxGeometry(12, 9, 8), 0xf0f0ea, M(0, 7.5, 29)),
      colored(new THREE.BoxGeometry(2, 5, 2), 0x333333, M(0, 13, 31)),
    ];
    const palette = [0x2f6db5, 0xc7462f, 0xe0a730, 0x3a8a4a, 0x8a8f95, 0xd8d2c4];
    for (let z = -30; z <= 18; z += 6.5) {
      for (let x = -4.5; x <= 4.5; x += 3) {
        const stack = 1 + Math.floor(rng() * 3);
        for (let s = 0; s < stack; s++) {
          parts.push(colored(new THREE.BoxGeometry(2.8, 2.5, 6.2), palette[Math.floor(rng() * palette.length)],
            M(x, 4.5 + s * 2.6, z)));
        }
      }
    }
    return merge(parts);
  }

  function buildBoatGeo() {
    return merge([
      colored(new THREE.BoxGeometry(3.2, 1.6, 11), 0x2f6db5, M(0, 0.3, 0)),
      colored(new THREE.ConeGeometry(1.6, 3, 4), 0x2f6db5, M(0, 0.3, -6.5, -Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.55)),
      colored(new THREE.BoxGeometry(3.25, 0.25, 11), 0xf0f0ea, M(0, 1.15, 0)),
      colored(new THREE.BoxGeometry(2.2, 1.8, 3), 0xf0f0ea, M(0, 2.1, 2.2)),
      colored(new THREE.CylinderGeometry(0.08, 0.08, 6, 5), 0x555555, M(0, 4, -1.5)),
      colored(new THREE.BoxGeometry(0.05, 0.05, 6), 0x555555, M(0, 5.5, 1.2, 0.5, 0, 0)),
    ]);
  }

  function buildRigGeo() {
    const parts = [];
    for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
      parts.push(colored(new THREE.CylinderGeometry(1.4, 1.6, 24, 8), 0xd9b93a, M(x, 4, z)));
    }
    parts.push(colored(new THREE.BoxGeometry(34, 4, 34), 0x8a8f95, M(0, 17, 0)));
    parts.push(colored(new THREE.BoxGeometry(14, 8, 12), 0xf0f0ea, M(-8, 23, 8)));
    parts.push(colored(new THREE.BoxGeometry(10, 1, 10), 0xc7462f, M(-8, 27.5, 8)));
    parts.push(colored(new THREE.CylinderGeometry(1.2, 5, 30, 4), 0xc7462f, M(8, 34, -6, 0, Math.PI / 4, 0)));
    parts.push(colored(new THREE.BoxGeometry(1.2, 1.2, 26), 0x8a8f95, M(16, 22, -20, 0.35, 0, 0)));
    return merge(parts);
  }

  function buildHouseGeos() {
    const colonial = merge([
      colored(new THREE.BoxGeometry(7.2, 3.6, 5.6), 0xf4f1ea, M(0, 1.8, 0)),
      colored(new THREE.BoxGeometry(7.4, 0.5, 5.8), 0xc8b48a, M(0, 0.25, 0)),
      colored(new THREE.ConeGeometry(4.6, 2.4, 4), 0xb23b2f, M(0, 4.6, 0, 0, Math.PI / 4, 0, 1.15, 1, 0.95)),
      colored(new THREE.BoxGeometry(1.1, 2.2, 0.2), 0x4a3428, M(0, 1.1, -2.85)),
      colored(new THREE.BoxGeometry(1.3, 1.5, 0.15), 0x9ec9e0, M(-2.2, 2.1, -2.85)),
      colored(new THREE.BoxGeometry(1.3, 1.5, 0.15), 0x9ec9e0, M(2.2, 2.1, -2.85)),
    ]);
    const hut = merge([
      colored(new THREE.CylinderGeometry(2.3, 2.6, 2.4, 8), 0xd7c4a3, M(0, 1.2, 0)),
      colored(new THREE.ConeGeometry(3.4, 2.2, 8), 0x8d5a2b, M(0, 3.4, 0)),
      colored(new THREE.BoxGeometry(0.9, 1.6, 0.2), 0x4a3428, M(0, 0.8, -2.5)),
    ]);
    const maloca = merge([
      colored(new THREE.BoxGeometry(14, 2.4, 5), 0x8d6a45, M(0, 1.2, 0)),
      colored(new THREE.CylinderGeometry(3.1, 3.1, 14.4, 6), 0x6d8a32, M(0, 3.2, 0, 0, 0, Math.PI / 2, 0.42, 1, 1)),
      colored(new THREE.BoxGeometry(1.4, 1.8, 0.2), 0x3a2a22, M(0, 0.9, -2.6)),
    ]);
    const stilt = merge([
      colored(new THREE.CylinderGeometry(0.14, 0.18, 3.2, 5), 0x6b4a32, M(-2.2, 1.6, -1.6)),
      colored(new THREE.CylinderGeometry(0.14, 0.18, 3.2, 5), 0x6b4a32, M(2.2, 1.6, -1.6)),
      colored(new THREE.CylinderGeometry(0.14, 0.18, 3.2, 5), 0x6b4a32, M(-2.2, 1.6, 1.6)),
      colored(new THREE.CylinderGeometry(0.14, 0.18, 3.2, 5), 0x6b4a32, M(2.2, 1.6, 1.6)),
      colored(new THREE.BoxGeometry(5.4, 0.28, 4.2), 0xc4a574, M(0, 3.3, 0)),
      colored(new THREE.BoxGeometry(5, 2.2, 3.8), 0xe8d7b0, M(0, 4.5, 0)),
      colored(new THREE.ConeGeometry(3.6, 1.8, 4), 0x9a6a3a, M(0, 6.4, 0, 0, Math.PI / 4, 0, 1.05, 1, 0.85)),
    ]);
    return { colonial, hut, maloca, stilt };
  }

  function buildClutterGeos() {
    const tufts = [];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.ConeGeometry(0.12, 0.85, 4);
      b.translate(0, 0.42, 0);
      b.rotateY(i * 0.9);
      b.translate(Math.sin(i) * 0.14, 0, Math.cos(i) * 0.1);
      tufts.push(colored(b, i % 2 ? 0x5c8a38 : 0x3e6b2c));
    }
    const dry = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.ConeGeometry(0.1, 0.7, 4);
      b.translate(0, 0.35, 0);
      b.rotateY(i);
      b.translate((i - 1) * 0.12, 0, 0);
      dry.push(colored(b, i === 1 ? 0xd2b56a : 0xb08a48));
    }
    return {
      tuft: merge(tufts),
      dry: merge(dry),
      rock: colored(new THREE.IcosahedronGeometry(0.55, 0), 0x8d8680, M(0, 0.28, 0, 0.4, 0.2, 0.3, 1.1, 0.7, 0.9)),
      bush: colored(new THREE.IcosahedronGeometry(0.65, 0), 0x2f6a30, M(0, 0.45, 0, 0.2, 0.5, 0, 1.3, 0.75, 1.1)),
    };
  }

  const legGeo = new THREE.CylinderGeometry(0.5, 0.55, 1, 5);
  const animalMat = {
    giraffe: new THREE.MeshLambertMaterial({ color: 0xe2b15a, flatShading: false }),
    spot: new THREE.MeshLambertMaterial({ color: 0x8a5a2a, flatShading: false }),
    elephant: new THREE.MeshLambertMaterial({ color: 0x8d8a86, flatShading: false }),
    tusk: new THREE.MeshLambertMaterial({ color: 0xf3efe4, flatShading: false }),
    zebra: new THREE.MeshLambertMaterial({ color: 0xf4f1ea, flatShading: false }),
    stripe: new THREE.MeshLambertMaterial({ color: 0x2a2a2a, flatShading: false }),
    cow: new THREE.MeshLambertMaterial({ color: 0xf7f4ee, flatShading: false }),
    cowSpot: new THREE.MeshLambertMaterial({ color: 0x3a3a3a, flatShading: false }),
    llama: new THREE.MeshLambertMaterial({ color: 0xe6d3b0, flatShading: false }),
    capy: new THREE.MeshLambertMaterial({ color: 0x8d6240, flatShading: false }),
    tapir: new THREE.MeshLambertMaterial({ color: 0x4a4038, flatShading: false }),
    tapirFace: new THREE.MeshLambertMaterial({ color: 0xd9d0c4, flatShading: false }),
    gorilla: new THREE.MeshLambertMaterial({ color: 0x2e2e2e, flatShading: false }),
    orang: new THREE.MeshLambertMaterial({ color: 0xc45c28, flatShading: false }),
    shell: new THREE.MeshLambertMaterial({ color: 0x6d7a3a, flatShading: false }),
    shellDark: new THREE.MeshLambertMaterial({ color: 0x3e4a28, flatShading: false }),
    iguana: new THREE.MeshLambertMaterial({ color: 0x3f7a34, flatShading: false }),
  };

  function addLeg(group, legs, mat, x, z, len, thick) {
    const pivot = new THREE.Group();
    pivot.position.set(x, len, z);
    const mesh = new THREE.Mesh(legGeo, mat);
    mesh.scale.set(thick, len, thick);
    mesh.position.y = -len / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    group.add(pivot);
    legs.push(pivot);
  }

  function buildGiraffe() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.giraffe;
    addLeg(g, legs, hide, -0.28, -0.55, 1.7, 0.16);
    addLeg(g, legs, hide, 0.28, -0.55, 1.7, 0.16);
    addLeg(g, legs, hide, -0.28, 0.55, 1.7, 0.16);
    addLeg(g, legs, hide, 0.28, 0.55, 1.7, 0.16);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 1.7), hide);
    body.position.set(0, 2.05, 0);
    body.castShadow = true;
    const spots = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.4, 1.2), animalMat.spot);
    spots.position.set(0, 2.15, 0);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.7, 0.28), hide);
    neck.position.set(0, 3.15, -0.62);
    neck.rotation.x = 0.25;
    neck.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.55), hide);
    head.position.set(0, 4.05, -1.05);
    const oss1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), animalMat.spot);
    oss1.position.set(-0.08, 4.28, -1.0);
    const oss2 = oss1.clone();
    oss2.geometry = oss1.geometry.clone();
    oss2.position.x = 0.08;
    g.add(body, spots, neck, head, oss1, oss2);
    g.traverse((o) => { if (o.isMesh && o.geometry !== legGeo) o.userData.ownGeo = true; });
    return { group: g, legs, trunk: null };
  }

  function buildElephant() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.elephant;
    const legLen = 1.45;
    addLeg(g, legs, hide, -0.45, -0.65, legLen, 0.22);
    addLeg(g, legs, hide, 0.45, -0.65, legLen, 0.22);
    addLeg(g, legs, hide, -0.45, 0.65, legLen, 0.22);
    addLeg(g, legs, hide, 0.45, 0.65, legLen, 0.22);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), hide);
    body.scale.set(0.85, 0.72, 1.25);
    body.position.set(0, legLen + 0.55, 0.05);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 7), hide);
    head.position.set(0, legLen + 0.62, -1.15);
    head.castShadow = true;
    for (const x of [-0.55, 0.55]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.42, 6, 5), hide);
      ear.scale.set(0.22, 0.85, 0.55);
      ear.position.set(x, legLen + 0.7, -1.0);
      g.add(ear);
    }
    const trunk = new THREE.Group();
    trunk.position.set(0, legLen + 0.35, -1.5);
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.7, 6), hide);
    t1.position.y = -0.35;
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.6, 6), hide);
    t2.position.y = -0.95;
    trunk.add(t1, t2);
    trunk.rotation.x = 0.35;
    for (const x of [-0.18, 0.18]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55, 5), animalMat.tusk);
      tusk.position.set(x, legLen + 0.15, -1.55);
      tusk.rotation.x = Math.PI / 2 + 0.4;
      g.add(tusk);
    }
    g.add(body, head, trunk);
    g.traverse((o) => { if (o.isMesh && o.geometry !== legGeo) o.userData.ownGeo = true; });
    return { group: g, legs, trunk };
  }

  function finishAnimal(g, legs, trunk, stepAmp) {
    g.traverse((o) => { if (o.isMesh && o.geometry !== legGeo) o.userData.ownGeo = true; });
    return { group: g, legs, trunk: trunk || null, stepAmp: stepAmp || 0.45 };
  }

  function buildZebra() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.zebra;
    addLeg(g, legs, hide, -0.22, -0.48, 1.05, 0.13);
    addLeg(g, legs, hide, 0.22, -0.48, 1.05, 0.13);
    addLeg(g, legs, hide, -0.22, 0.48, 1.05, 0.13);
    addLeg(g, legs, hide, 0.22, 0.48, 1.05, 0.13);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 1.45), hide);
    body.position.set(0, 1.35, 0);
    body.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 1.15), animalMat.stripe);
    stripe.position.set(0, 1.42, 0.02);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.32), hide);
    neck.position.set(0, 1.7, -0.72);
    neck.rotation.x = 0.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.48), hide);
    head.position.set(0, 1.85, -1.05);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.7), animalMat.stripe);
    mane.position.set(0, 1.78, -0.35);
    g.add(body, stripe, neck, head, mane);
    return finishAnimal(g, legs);
  }

  function buildCow() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.cow;
    addLeg(g, legs, animalMat.cowSpot, -0.28, -0.5, 0.85, 0.16);
    addLeg(g, legs, animalMat.cowSpot, 0.28, -0.5, 0.85, 0.16);
    addLeg(g, legs, animalMat.cowSpot, -0.28, 0.55, 0.85, 0.16);
    addLeg(g, legs, animalMat.cowSpot, 0.28, 0.55, 0.85, 0.16);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.7, 1.5), hide);
    body.position.set(0, 1.15, 0.05);
    body.castShadow = true;
    const spot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.7), animalMat.cowSpot);
    spot.position.set(0.1, 1.28, 0.1);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.4), hide);
    head.position.set(0, 1.15, -0.85);
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 4), animalMat.tusk);
    hornL.position.set(-0.16, 1.42, -0.82);
    const hornR = hornL.clone();
    hornR.geometry = hornL.geometry.clone();
    hornR.position.x = 0.16;
    g.add(body, spot, head, hornL, hornR);
    return finishAnimal(g, legs);
  }

  function buildLlama() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.llama;
    addLeg(g, legs, hide, -0.16, -0.32, 1.05, 0.1);
    addLeg(g, legs, hide, 0.16, -0.32, 1.05, 0.1);
    addLeg(g, legs, hide, -0.16, 0.32, 1.05, 0.1);
    addLeg(g, legs, hide, 0.16, 0.32, 1.05, 0.1);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.95), hide);
    body.position.set(0, 1.25, 0);
    body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), hide);
    neck.position.set(0, 1.75, -0.42);
    neck.rotation.x = 0.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.38), animalMat.tusk);
    head.position.set(0, 2.15, -0.72);
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.05), hide);
    earL.position.set(-0.1, 2.28, -0.62);
    const earR = earL.clone();
    earR.geometry = earL.geometry.clone();
    earR.position.x = 0.1;
    g.add(body, neck, head, earL, earR);
    return finishAnimal(g, legs);
  }

  function buildCapybara() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.capy;
    addLeg(g, legs, hide, -0.28, -0.4, 0.38, 0.16);
    addLeg(g, legs, hide, 0.28, -0.4, 0.38, 0.16);
    addLeg(g, legs, hide, -0.28, 0.4, 0.38, 0.16);
    addLeg(g, legs, hide, 0.28, 0.4, 0.38, 0.16);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), hide);
    body.scale.set(1.15, 0.75, 1.7);
    body.position.set(0, 0.62, 0);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.38), hide);
    head.position.set(0, 0.72, -0.72);
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), animalMat.tapirFace);
    ear.position.set(0.14, 0.92, -0.7);
    g.add(body, head, ear);
    return finishAnimal(g, legs, null, 0.28);
  }

  function buildTapir() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.tapir;
    addLeg(g, legs, hide, -0.28, -0.45, 0.62, 0.16);
    addLeg(g, legs, hide, 0.28, -0.45, 0.62, 0.16);
    addLeg(g, legs, hide, -0.28, 0.5, 0.62, 0.16);
    addLeg(g, legs, hide, 0.28, 0.5, 0.62, 0.16);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), hide);
    body.scale.set(0.95, 0.8, 1.45);
    body.position.set(0, 0.95, 0.05);
    body.castShadow = true;
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.45), animalMat.tapirFace);
    snout.position.set(0, 0.78, -0.95);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 6), hide);
    head.position.set(0, 1.05, -0.7);
    g.add(body, head, snout);
    return finishAnimal(g, legs, null, 0.32);
  }

  function buildApe(hide) {
    const g = new THREE.Group();
    const legs = [];
    addLeg(g, legs, hide, -0.28, 0.35, 0.7, 0.18);
    addLeg(g, legs, hide, 0.28, 0.35, 0.7, 0.18);
    addLeg(g, legs, hide, -0.42, -0.45, 1.05, 0.16);
    addLeg(g, legs, hide, 0.42, -0.45, 1.05, 0.16);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 6), hide);
    body.scale.set(1.15, 1.05, 0.9);
    body.position.set(0, 1.05, 0);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), hide);
    head.position.set(0, 1.62, -0.28);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.12), animalMat.tapirFace);
    face.position.set(0, 1.55, -0.52);
    g.add(body, head, face);
    return finishAnimal(g, legs, null, 0.35);
  }

  function buildTortoise() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.shell;
    addLeg(g, legs, animalMat.shellDark, -0.38, -0.4, 0.28, 0.18);
    addLeg(g, legs, animalMat.shellDark, 0.38, -0.4, 0.28, 0.18);
    addLeg(g, legs, animalMat.shellDark, -0.38, 0.4, 0.28, 0.18);
    addLeg(g, legs, animalMat.shellDark, 0.38, 0.4, 0.28, 0.18);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), animalMat.llama);
    belly.scale.set(1.15, 0.45, 1.45);
    belly.position.set(0, 0.38, 0);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), hide);
    shell.scale.set(1.2, 0.7, 1.5);
    shell.position.set(0, 0.62, 0);
    shell.castShadow = true;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.9), animalMat.shellDark);
    plate.position.set(0, 0.95, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), animalMat.shellDark);
    head.position.set(0, 0.4, -0.85);
    g.add(belly, shell, plate, head);
    return finishAnimal(g, legs, null, 0.12);
  }

  function buildIguana() {
    const g = new THREE.Group();
    const legs = [];
    const hide = animalMat.iguana;
    addLeg(g, legs, hide, -0.18, -0.35, 0.32, 0.1);
    addLeg(g, legs, hide, 0.18, -0.35, 0.32, 0.1);
    addLeg(g, legs, hide, -0.16, 0.28, 0.32, 0.1);
    addLeg(g, legs, hide, 0.16, 0.28, 0.32, 0.1);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.9), hide);
    body.position.set(0, 0.42, 0);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.32), hide);
    head.position.set(0, 0.48, -0.55);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.7), hide);
    tail.position.set(0, 0.36, 0.7);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.55), animalMat.shellDark);
    crest.position.set(0, 0.6, -0.05);
    g.add(body, head, tail, crest);
    return finishAnimal(g, legs, null, 0.22);
  }

  function parkedBox(g, w, h, d, hex, x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: hex, flatShading: false }),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData.own = true;
    mesh.userData.ownGeo = true;
    g.add(mesh);
  }

  const parkedTireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, flatShading: false });
  const parkedHubMat = new THREE.MeshLambertMaterial({ color: 0xd0d0d0, flatShading: false });
  const parkedWheelGeos = {
    truck: null,
    car: null,
    bike: null,
  };

  function parkedWheelGeo(kind, radius, width) {
    if (!parkedWheelGeos[kind]) {
      const tire = new THREE.CylinderGeometry(radius, radius, width, 12);
      tire.rotateZ(Math.PI / 2);
      const hub = new THREE.CylinderGeometry(radius * 0.38, radius * 0.38, width * 1.12, 8);
      hub.rotateZ(Math.PI / 2);
      parkedWheelGeos[kind] = { tire, hub };
    }
    return parkedWheelGeos[kind];
  }

  function addParkedWheels(g, kind, spots, radius, width) {
    const geo = parkedWheelGeo(kind, radius, width);
    for (const [x, z] of spots) {
      const tire = new THREE.Mesh(geo.tire, parkedTireMat);
      tire.position.set(x, radius, z);
      tire.castShadow = true;
      const hub = new THREE.Mesh(geo.hub, parkedHubMat);
      hub.position.set(x, radius, z);
      g.add(tire, hub);
    }
  }

  function buildParkedTruck() {
    const g = new THREE.Group();
    parkedBox(g, 2.1, 1.7, 2.2, 0xd8d4cc, 0, 1.55, -2.3);
    parkedBox(g, 2.15, 2.2, 5.2, 0xc4552a, 0, 1.8, 1.3);
    parkedBox(g, 2.05, 0.4, 7.6, 0x333333, 0, 0.55, 0);
    addParkedWheels(g, 'truck', [[-1.2, -2.6], [1.2, -2.6], [-1.2, 1.2], [1.2, 1.2], [-1.2, 2.45], [1.2, 2.45]], 0.48, 0.32);
    return g;
  }

  function buildParkedCar() {
    const g = new THREE.Group();
    parkedBox(g, 1.85, 0.6, 4.1, 0x3d7ea8, 0, 0.7, 0);
    parkedBox(g, 1.6, 0.55, 2.1, 0xd8d4cc, 0, 1.2, 0.15);
    parkedBox(g, 1.5, 0.35, 1.7, 0x1c2a33, 0, 1.25, 0.15);
    addParkedWheels(g, 'car', [[-1.02, -1.25], [1.02, -1.25], [-1.02, 1.25], [1.02, 1.25]], 0.36, 0.26);
    return g;
  }

  function buildParkedBike() {
    const g = new THREE.Group();
    parkedBox(g, 0.35, 0.7, 1.5, 0x3a6ea5, 0, 0.85, 0);
    parkedBox(g, 0.4, 0.7, 0.4, 0xf2a03d, 0, 1.45, -0.1);
    addParkedWheels(g, 'bike', [[0, -0.78], [0, 0.72]], 0.36, 0.08);
    return g;
  }

  const ANIMAL_BUILD = {
    elephant: buildElephant, giraffe: buildGiraffe, zebra: buildZebra, cow: buildCow,
    llama: buildLlama, capybara: buildCapybara, tapir: buildTapir,
    gorilla: () => buildApe(animalMat.gorilla), orangutan: () => buildApe(animalMat.orang),
    tortoise: buildTortoise, iguana: buildIguana,
  };

  function buildCableBridge(span) {
    const g = new THREE.Group();
    const concrete = new THREE.MeshLambertMaterial({ color: 0xd9d3c5, flatShading: false });
    const steel = new THREE.MeshLambertMaterial({ color: 0xdedede });
    const H = Math.min(34, 14 + span * 0.1);
    const deckY = ROAD_Y + 0.35;
    const topY = ROAD_Y + H - 1;
    for (const z of [-span / 2, span / 2]) {
      for (const x of [-6.6, 6.6]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.15, H, 1.15), concrete);
        tower.position.set(x, ROAD_Y + H / 2, z);
        tower.castShadow = true;
        tower.userData.ownGeo = true;
        g.add(tower);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(15, 0.7, 1.15), concrete);
      beam.position.set(0, topY, z);
      beam.userData.ownGeo = true;
      g.add(beam);
    }
    const up = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
    for (const x of [-6.6, 6.6]) {
      for (const end of [-1, 1]) {
        for (let i = 1; i <= 5; i++) {
          a.set(x, topY, end * span / 2);
          b.set(x * 0.92, deckY, end * span * (0.5 - i / 11));
          const cable = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07), steel);
          dir.subVectors(b, a);
          const len = dir.length();
          cable.position.copy(a).add(b).multiplyScalar(0.5);
          cable.quaternion.setFromUnitVectors(up, dir.multiplyScalar(1 / len));
          cable.scale.y = len;
          cable.userData.ownGeo = true;
          g.add(cable);
        }
      }
    }
    g.userData.mats = [concrete, steel];
    return g;
  }

  function buildLighthouseGeo() {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const r0 = 2.2 - i * 0.25, r1 = r0 - 0.25;
      parts.push(colored(new THREE.CylinderGeometry(r1, r0, 3.2, 10), i % 2 ? 0xc7362f : 0xf2f2ee, M(0, 1.6 + i * 3.2, 0)));
    }
    parts.push(colored(new THREE.CylinderGeometry(1.4, 1.4, 1.8, 10), 0xfff2b0, M(0, 17, 0)));
    parts.push(colored(new THREE.ConeGeometry(1.6, 1.6, 10), 0x333333, M(0, 18.7, 0)));
    return merge(parts);
  }

  // ---------- 公路贴图 ----------
  function makeRoadTexture(renderer) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#3b3c3f'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 1600; i++) {
      const v = 40 + Math.random() * 40;
      g.fillStyle = `rgb(${v},${v},${v + 3})`;
      g.fillRect(Math.random() * 128, Math.random() * 256, 1.5, 1.5);
    }
    const px = (x) => (x / (ROAD_HALF * 2) + 0.5) * 128;
    g.fillStyle = '#e8e8e2';
    g.fillRect(px(-(RAIL_X - 0.32)) - 1.5, 0, 3, 256);
    g.fillRect(px(RAIL_X - 0.32) - 1.5, 0, 3, 256);
    g.fillStyle = '#d23a2a';
    g.fillRect(px(0) - 2, 0, 4, 256);
    g.fillStyle = '#e8e8e2';
    g.fillRect(px(-2.5) - 1, 0, 2, 120);
    g.fillRect(px(2.5) - 1, 0, 2, 120);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, CHUNK / 20);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  function makeDetailTexture(renderer) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = 168 + Math.random() * 70 + ((x * 13 + y * 29) % 17);
        const v = Math.max(140, Math.min(245, n));
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  // ---------- 路牌 ----------
  function makeSign(lines, bg) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 236);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
    const sizes = lines.length === 3 ? [34, 64, 34] : [60, 38];
    const ys = lines.length === 3 ? [62, 132, 200] : [100, 180];
    lines.forEach((t, i) => {
      g.font = `bold ${sizes[i]}px ${font}`;
      g.fillText(t, 256, ys[i], 470);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const grp = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 3),
      new THREE.MeshLambertMaterial({ map: tex, emissive: 0x333333, emissiveMap: tex }));
    board.position.y = 4.2;
    board.userData.own = true;
    grp.add(board);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), signBackMat);
    back.rotation.y = Math.PI; back.position.set(0, 4.2, -0.02);
    grp.add(back);
    for (const px of [-2.2, 2.2]) {
      const post = new THREE.Mesh(signPostGeo, signPostMat);
      post.position.set(px, 1.4, -0.05);
      grp.add(post);
    }
    return grp;
  }
  const signBackMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const signPostMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  const signPostGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6);

  // ---------- 地标 ----------
  function stdMesh(g, hex) {
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: hex, flatShading: false }));
    m.castShadow = true; m.receiveShadow = true; m.userData.own = true;
    return m;
  }
  const LANDMARK_BUILDERS = {
    mitad() {
      const g = new THREE.Group();
      const base = stdMesh(new THREE.BoxGeometry(22, 2, 22), 0xb9a98a); base.position.y = 1; g.add(base);
      const tower = stdMesh(new THREE.CylinderGeometry(4, 6.5, 30, 4), 0xc8b894);
      tower.rotation.y = Math.PI / 4; tower.position.y = 17; g.add(tower);
      const globe = stdMesh(new THREE.SphereGeometry(4.5, 16, 12), 0x9a7440); globe.position.y = 36.5; g.add(globe);
      const ring = stdMesh(new THREE.TorusGeometry(4.8, 0.25, 6, 32), 0xd8b24a);
      ring.rotation.x = Math.PI / 2; ring.position.y = 36.5; g.add(ring);
      return g;
    },
    snowpeak() {
      const g = new THREE.Group();
      const cone = stdMesh(new THREE.ConeGeometry(130, 320, 8), 0x6b6762); cone.position.y = 160; g.add(cone);
      const cap = stdMesh(new THREE.ConeGeometry(48, 110, 8), 0xf2f4f6); cap.position.y = 320 - 55; g.add(cap);
      cone.castShadow = cap.castShadow = false;
      return g;
    },
    volcano() {
      const g = new THREE.Group();
      const c = stdMesh(new THREE.CylinderGeometry(36, 150, 240, 10), 0x4a403a); c.position.y = 120; g.add(c);
      c.castShadow = false;
      return g;
    },
    obelisk() {
      const g = new THREE.Group();
      const base = stdMesh(new THREE.BoxGeometry(9, 2, 9), 0xbdb5a5); base.position.y = 1; g.add(base);
      const ob = stdMesh(new THREE.CylinderGeometry(0.7, 2, 30, 4), 0xf0eee8);
      ob.rotation.y = Math.PI / 4; ob.position.y = 17; g.add(ob);
      const ring = stdMesh(new THREE.TorusGeometry(6, 0.45, 8, 40), 0xd8b24a);
      ring.rotation.y = Math.PI / 2; ring.position.y = 19; g.add(ring);
      return g;
    },
    rings() {
      const g = new THREE.Group();
      for (const x of [-9.5, 9.5]) {
        const ring = stdMesh(new THREE.TorusGeometry(3.2, 0.45, 8, 36), 0xe8e4da);
        ring.rotation.y = Math.PI / 2; ring.position.set(x, 3.65, 0); g.add(ring);
        const sign = makeSign(ED.i18n && ED.i18n.lang === 'en' ? ['EQUATOR'] : ['赤道', 'EQUATOR'], '#c9302c');
        sign.scale.setScalar(0.6);
        sign.position.set(x + Math.sign(x) * 5, 0, 0);
        g.add(sign);
      }
      return g;
    },
    globe() {
      const g = new THREE.Group();
      const ped = stdMesh(new THREE.CylinderGeometry(4, 5, 5, 12), 0xd8d2c4); ped.position.y = 2.5; g.add(ped);
      const globe = stdMesh(new THREE.SphereGeometry(5, 20, 14), 0x3a6ea5); globe.position.y = 10; g.add(globe);
      const ring = stdMesh(new THREE.TorusGeometry(5.4, 0.3, 6, 40), 0xd8b24a);
      ring.rotation.x = Math.PI / 2; ring.position.y = 10; g.add(ring);
      return g;
    },
    tugu() {
      const g = new THREE.Group();
      const base = stdMesh(new THREE.BoxGeometry(14, 3, 14), 0xf0eee8); base.position.y = 1.5; g.add(base);
      for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
        const p = stdMesh(new THREE.BoxGeometry(1.1, 13, 1.1), 0x4a3020); p.position.set(x, 9.5, z); g.add(p);
      }
      const top = stdMesh(new THREE.BoxGeometry(10, 0.8, 10), 0x4a3020); top.position.y = 16.4; g.add(top);
      const globe = stdMesh(new THREE.SphereGeometry(2.6, 16, 12), 0x9aa0a6); globe.position.y = 19.5; g.add(globe);
      const ring = stdMesh(new THREE.TorusGeometry(3.2, 0.2, 6, 32), 0xd8b24a); ring.position.y = 19.5;
      ring.rotation.y = Math.PI / 2; g.add(ring);
      const arrow = stdMesh(new THREE.ConeGeometry(0.6, 4, 6), 0xd8b24a);
      arrow.rotation.z = -Math.PI / 2; arrow.position.set(0, 23, 0); g.add(arrow);
      return g;
    },
  };

  // ---------- 天空 ----------
  function createSky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color(1, 1, 1) },
        night: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: `
        uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float night;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.55));
          float sd = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(sd, 1200.0) * 8.0 + pow(sd, 10.0) * 0.22);
          if (night > 0.01 && d.y > 0.02) {
            vec3 cell = floor(d * 260.0);
            float s = hash(cell);
            col += vec3(step(0.9972, s) * night * (0.4 + 0.6 * hash(cell + 3.1)));
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }

  // ---------- 海面 ----------
  function createWater() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color(1, 1, 1) },
        zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        deep: { value: new THREE.Color(0x0b4f6c) },
        dayK: { value: 1 },
        fogColor: { value: new THREE.Color() },
        fogNear: { value: FOG_NEAR },
        fogFar: { value: FOG_FAR },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform float time; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 zenith; uniform vec3 horizon;
        uniform vec3 deep; uniform float dayK; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        varying vec3 vWorld;
        void wave(vec2 p, vec2 dir, float len, float steep, inout vec2 g) {
          float k = 6.2831853 / len;
          float w = sqrt(9.8 * k);
          float c = cos(dot(dir, p) * k - time * w) * steep;
          g += dir * c;
        }
        void main() {
          vec2 p = vWorld.xz;
          float dist = length(cameraPosition - vWorld);
          vec2 g = vec2(0.0);
          wave(p, normalize(vec2(1.0, 0.3)), 41.0, 0.08, g);
          wave(p, normalize(vec2(0.6, -1.0)), 23.0, 0.07, g);
          wave(p, normalize(vec2(-0.8, 0.5)), 11.0, 0.06, g);
          float fine = 1.0 - smoothstep(60.0, 500.0, dist);
          vec2 g2 = vec2(0.0);
          wave(p, normalize(vec2(0.2, 1.0)), 5.3, 0.05, g2);
          wave(p, normalize(vec2(-1.0, -0.6)), 2.9, 0.04, g2);
          g += g2 * fine;
          g *= 1.0 - 0.6 * smoothstep(300.0, 2000.0, dist);
          vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          vec3 R = reflect(-V, n);
          vec3 refl = mix(horizon, zenith, pow(clamp(R.y, 0.0, 1.0), 0.55));
          vec3 base = deep * (0.55 + 0.45 * dayK);
          vec3 col = mix(base, refl, fres);
          vec3 H = normalize(sunDir + V);
          float spec = pow(max(dot(n, H), 0.0), 400.0) * 4.0 * step(0.0, sunDir.y);
          col += sunColor * spec;
          col = mix(col, fogColor, smoothstep(fogNear, fogFar, dist));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = false;
    return mesh;
  }

  // ---------- 云 ----------
  function createClouds(scene) {
    const parts = [];
    const rng = mulberry32(99);
    for (let i = 0; i < 7; i++) {
      parts.push(colored(new THREE.IcosahedronGeometry(1, 1), 0xffffff,
        M((rng() - 0.5) * 3.2, (rng() - 0.3) * 0.5, (rng() - 0.5) * 1.6, 0, rng() * 3, 0,
          0.8 + rng() * 0.7, 0.55 + rng() * 0.3, 0.8 + rng() * 0.6)));
    }
    const geoC = merge(parts);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false, emissive: 0x404040 });
    const list = [];
    for (let i = 0; i < 46; i++) {
      const m = new THREE.Mesh(geoC, mat);
      m.userData.base = 35 + Math.random() * 55;
      m.scale.setScalar(m.userData.base);
      m.position.set((Math.random() - 0.5) * 5000, 300 + Math.random() * 300, -Math.random() * 3600 + 600);
      m.rotation.y = Math.random() * Math.PI;
      scene.add(m);
      list.push(m);
    }
    return { list, mat };
  }

  // ---------- 世界 ----------
  class World {
    constructor(scene, renderer, state) {
      this.scene = scene;
      this.state = state;
      this.chunks = new Map();
      this.houses = buildHouseGeos();
      this.clutter = buildClutterGeos();
      this.trees = buildTreeGeos();
      this.shipGeo = buildShipGeo();
      this.boatGeo = buildBoatGeo();
      this.rigGeo = buildRigGeo();
      this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
      this.flameGeo = new THREE.ConeGeometry(1.2, 4, 6);
      this.lighthouseGeo = buildLighthouseGeo();
      this.rebaseHooks = [];
      this.weather = { overcast: 0, rain: 0, wet: 0, flash: 0 };

      this.roadMat = new THREE.MeshStandardMaterial({
        map: makeRoadTexture(renderer), roughness: 0.9, metalness: 0.02,
      });
      this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: makeDetailTexture(renderer) });
      this.foliageMat = new THREE.MeshPhongMaterial({
        vertexColors: true, shininess: 14, specular: new THREE.Color(0x1c2a16),
      });
      this.roadSideMat = new THREE.MeshLambertMaterial({ color: 0x55565a });
      const roadGeo = new THREE.BoxGeometry(ROAD_HALF * 2, 0.5, CHUNK);
      roadGeo.translate(0, ROAD_Y - 0.25, -CHUNK / 2);
      this.roadGeo = roadGeo;
      this.railGeo = merge([
        colored(new THREE.BoxGeometry(0.12, 0.3, CHUNK), 0xc8c8c8, M(-RAIL_X, ROAD_Y + 0.62, -CHUNK / 2)),
        colored(new THREE.BoxGeometry(0.12, 0.3, CHUNK), 0xc8c8c8, M(RAIL_X, ROAD_Y + 0.62, -CHUNK / 2)),
      ]);
      this.postGeo = colored(new THREE.BoxGeometry(0.14, 0.8, 0.14), 0x9a9a9a, M(0, ROAD_Y + 0.4, 0));
      this.pillarGeo = colored(new THREE.BoxGeometry(1.4, ROAD_Y - 0.5 - SEA_FLOOR, 1.4), 0xb8b4aa,
        M(0, (ROAD_Y - 0.5 + SEA_FLOOR) / 2, 0));
      this.beamGeo = colored(new THREE.BoxGeometry(ROAD_HALF * 2 - 1.2, 0.8, 1.6), 0xa8a49a, M(0, ROAD_Y - 0.9, 0));

      this.sky = createSky();
      scene.add(this.sky);
      this.water = createWater();
      scene.add(this.water);
      const clouds = createClouds(scene);
      this.clouds = clouds.list;
      this.cloudMat = clouds.mat;

      this.sun = new THREE.DirectionalLight(0xffffff, 3);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const sc = this.sun.shadow.camera;
      sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 1200;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.4;
      scene.add(this.sun);
      scene.add(this.sun.target);
      this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a3f2a, 1.2);
      scene.add(this.hemi);
      scene.fog = new THREE.Fog(0xaaccee, FOG_NEAR, FOG_FAR);

      this._zen = new THREE.Color(); this._hor = new THREE.Color(); this._sunC = new THREE.Color();
      this.sunDir = new THREE.Vector3();
      this.dayK = 1;
    }

    lonAt(d) {
      const s = this.state;
      return s.anchorLon + (d - s.anchorDist) * s.scale / geo.M_PER_DEG;
    }

    rampDeg() {
      return 70 * this.state.scale / geo.M_PER_DEG;
    }

    riverGap(d) {
      const lon = geo.normLon(this.lonAt(d));
      let gap = 0;
      for (let i = 0; i < geo.RIVERS.length; i++) {
        const deltaM = Math.abs(geo.normLon(lon - geo.RIVERS[i][0])) * geo.M_PER_DEG;
        const half = geo.RIVERS[i][1] / 2;
        const bank = 3500;
        if (deltaM < half) gap = 1;
        else if (deltaM < half + bank) gap = Math.max(gap, 1 - (deltaM - half) / bank);
      }
      return gap;
    }

    terrainHeight(x, d, s) {
      const ax = Math.abs(x);
      const near = smooth(14, 70, ax);
      const far = smooth(120, 900, ax);
      let h = BASE_Y + near * s.hill * fbm(x * 0.012, d * 0.012) +
        far * s.mount * Math.pow(ridge(x * 0.0019 + 50, d * 0.0019), 1.7);
      h = SEA_FLOOR + (h - SEA_FLOOR) * s.land;
      if (ax > 2200 && s.land > 0.45) {
        const t = smooth(2200, 3400, ax);
        const ridgeH = 30 + (40 + s.mount * 0.65) * Math.pow(ridge(d * 0.00055 + 3, 0.2), 1.5);
        h = h * (1 - t) + ridgeH * t;
      }
      const gap = s.land > 0.5 ? this.riverGap(d) : 0;
      if (gap > 0) h = h * (1 - gap) + (-4) * gap;
      return h;
    }

    // 树和动物要落在看得见的地面上。远处山坡的网格比高度函数稀，直接用高度函数会悬空。
    meshHeight(x, d) {
      const xs = GROUND_XS;
      let i = 0;
      if (x <= xs[0]) i = 0;
      else if (x >= xs[xs.length - 1]) i = xs.length - 2;
      else while (xs[i + 1] < x) i++;
      const x0 = xs[i], x1 = xs[i + 1];
      const tx = (x1 === x0) ? 0 : (x - x0) / (x1 - x0);
      const z0 = Math.floor(d / ROW_STEP) * ROW_STEP;
      const z1 = z0 + ROW_STEP;
      const tz = (d - z0) / ROW_STEP;
      const ramp = this.rampDeg();
      const hAt = (px, pd) => this.terrainHeight(px, pd, geo.sample(this.lonAt(pd), ramp));
      const h0 = hAt(x0, z0) * (1 - tx) + hAt(x1, z0) * tx;
      const h1 = hAt(x0, z1) * (1 - tx) + hAt(x1, z1) * tx;
      return h0 * (1 - tz) + h1 * tz;
    }

    terrainColor(out, h, s, x, d) {
      const ax = Math.abs(x);
      out.copy(s.color);
      out.multiplyScalar(0.7 + 0.55 * noise2(x * 0.03, d * 0.03));
      const patch = fbm(x * 0.006 + 2, d * 0.006);
      if (patch < 0.47) out.lerp(COL.dirt, Math.min(1, (0.47 - patch) * 3.2));
      else if (patch > 0.68) out.lerp(COL.dry, Math.min(1, (patch - 0.68) * 2.8));
      if (ax > 5.4 && ax < 26 && h > 0.6) out.lerp(COL.shoulder, smooth(26, 8, ax) * 0.8);
      if (h < 1.4) out.lerp(COL.sand, smooth(1.4, 0.3, h));
      if (h < -1) out.lerp(COL.seabed, smooth(-1, -6, h));
      out.lerp(COL.rock, smooth(70, 170, h) * 0.85);
      if (s.snow > 0.4) out.lerp(COL.snow, smooth(215, 265, h));
      if (ax > 2300) out.lerp(COL.far, smooth(2300, 3300, ax));
      return out;
    }

    // ---- 分块 ----
    buildChunk(i) {
      const d0 = i * CHUNK;
      const group = new THREE.Group();
      group.position.z = -(d0 - this.state.originDist);
      const ramp = this.rampDeg();
      const rng = mulberry32(i * 7919 + 13);

      // 每行采样地形参数
      const rows = [];
      let anyLand = false;
      for (let dz = 0; dz <= CHUNK; dz += ROW_STEP) {
        const s = geo.sample(this.lonAt(d0 + dz), ramp);
        rows.push({ dz, land: s.land, hill: s.hill, mount: s.mount, snow: s.snow, color: s.color.clone() });
        if (s.land > 0.001) anyLand = true;
      }

      if (anyLand) group.add(this.buildGround(d0, rows));

      const road = new THREE.Mesh(this.roadGeo, [this.roadSideMat, this.roadSideMat, this.roadMat,
        this.roadSideMat, this.roadSideMat, this.roadSideMat]);
      road.receiveShadow = true;
      group.add(road);
      group.add(new THREE.Mesh(this.railGeo, flatMat));

      const posts = new THREE.InstancedMesh(this.postGeo, flatMat, 2 * (CHUNK / 5));
      const m4 = new THREE.Matrix4();
      let k = 0;
      for (let dz = 0; dz < CHUNK; dz += 5) {
        posts.setMatrixAt(k++, m4.makeTranslation(-RAIL_X, 0, -dz));
        posts.setMatrixAt(k++, m4.makeTranslation(RAIL_X, 0, -dz));
      }
      posts.frustumCulled = false;
      posts.userData.inst = true;
      group.add(posts);

      // 桥墩：海上，以及没有斜拉桥覆盖的河面
      const piers = [];
      for (let dz = 0; dz < CHUNK; dz += 25) {
        const s = geo.sample(this.lonAt(d0 + dz), ramp);
        if (this.terrainHeight(0, d0 + dz, s) >= 1.0) continue;
        if (this.insideCableBridge(d0 + dz)) continue;
        piers.push(dz);
      }
      if (piers.length) {
        const pm = new THREE.InstancedMesh(this.pillarGeo, flatMat, piers.length * 2);
        const bm = new THREE.InstancedMesh(this.beamGeo, flatMat, piers.length);
        piers.forEach((dz, j) => {
          pm.setMatrixAt(j * 2, m4.makeTranslation(-3.2, 0, -dz));
          pm.setMatrixAt(j * 2 + 1, m4.makeTranslation(3.2, 0, -dz));
          bm.setMatrixAt(j, m4.makeTranslation(0, 0, -dz));
        });
        pm.frustumCulled = bm.frustumCulled = false;
        pm.userData.inst = bm.userData.inst = true;
        group.add(pm, bm);
      }

      const animals = [];
      if (anyLand) {
        this.addTrees(group, d0, ramp, rng);
        this.addGroundCover(group, d0, ramp, rng);
        this.addVillage(group, d0, ramp, rng);
        this.addHerd(group, d0, ramp, rng, animals);
        this.addParked(group, d0, ramp, rng);
      } else this.addSeaLife(group, d0, rng);

      this.addMarkers(group, d0);
      this.addRiverCrossing(group, d0);
      this.scene.add(group);
      return { group, animals };
    }

    buildGround(d0, rows) {
      const nx = GROUND_XS.length, nz = rows.length;
      const pos = new Float32Array(nx * nz * 3);
      const col = new Float32Array(nx * nz * 3);
      const uv = new Float32Array(nx * nz * 2);
      const c = new THREE.Color();
      let p = 0, vi = 0;
      for (const r of rows) {
        const d = d0 + r.dz;
        for (const x of GROUND_XS) {
          const h = this.terrainHeight(x, d, r);
          this.terrainColor(c, h, r, x, d);
          pos[p] = x; pos[p + 1] = h; pos[p + 2] = -r.dz;
          col[p] = c.r; col[p + 1] = c.g; col[p + 2] = c.b;
          uv[vi * 2] = x * 0.045;
          uv[vi * 2 + 1] = d * 0.045;
          p += 3;
          vi++;
        }
      }
      const idx = [];
      for (let z = 0; z < nz - 1; z++) {
        for (let x = 0; x < nx - 1; x++) {
          const a = z * nx + x, b = a + 1, cc = a + nx, dd = cc + 1;
          idx.push(a, b, cc, b, dd, cc);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.groundMat);
      mesh.receiveShadow = true;
      mesh.userData.ownGeo = true;
      return mesh;
    }

    addTrees(group, d0, ramp, rng) {
      const byType = {};
      const m4 = new THREE.Matrix4();
      for (let n = 0; n < 170; n++) {
        const dz = rng() * CHUNK;
        const d = d0 + dz;
        const s = geo.sample(this.lonAt(d), ramp);
        const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng(), r5 = rng();
        if (s.land < 0.85 || !s.biome || r1 > s.density) continue;
        if (this.riverGap(d) > 0.35) continue;
        const side = r2 < 0.5 ? -1 : 1;
        const x = side * (15 + Math.pow(r3, 1.8) * 1000);
        const h = this.meshHeight(x, d);
        const slope = Math.abs(this.meshHeight(x + side * 12, d) - h);
        if (h < 0.6 || h > 120 || slope > 10) continue;
        let type = geo.BIOMES[s.biome].tree;
        if (s.land < 0.995 && h < 2.2 && type !== 'cactus') type = 'palm';
        const sc = 0.7 + r4 * 0.7;
        m4.compose(_v.set(x, h - 0.2, -dz), _q.setFromEuler(_e.set(0, r5 * 6.28, 0)), _s.set(sc, sc, sc));
        (byType[type] = byType[type] || []).push(m4.clone());
      }
      for (const type in byType) {
        const list = byType[type];
        const im = new THREE.InstancedMesh(this.trees[type], this.foliageMat, list.length);
        list.forEach((m, j) => im.setMatrixAt(j, m));
        im.castShadow = true;
        im.frustumCulled = false;
        im.userData.inst = true;
        group.add(im);
      }
    }

    addGroundCover(group, d0, ramp, rng) {
      const buckets = { tuft: [], dry: [], rock: [], bush: [] };
      const m4 = new THREE.Matrix4();
      for (let n = 0; n < 160; n++) {
        const dz = rng() * CHUNK;
        const d = d0 + dz;
        const s = geo.sample(this.lonAt(d), ramp);
        if (s.land < 0.75 || this.riverGap(d) > 0.3) continue;
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (7.5 + Math.pow(rng(), 1.35) * 220);
        const h = this.meshHeight(x, d);
        if (h < 0.45 || h > 45) continue;
        let kind = 'tuft';
        const roll = rng();
        if (s.biome === 'savanna') kind = roll < 0.55 ? 'dry' : roll < 0.8 ? 'rock' : 'bush';
        else if (s.biome === 'andes' || s.biome === 'highland' || s.biome === 'volcanic') kind = roll < 0.55 ? 'rock' : 'dry';
        else if (s.biome === 'rainforest' || s.biome === 'mountain') kind = roll < 0.45 ? 'bush' : 'tuft';
        else kind = roll < 0.3 ? 'bush' : roll < 0.5 ? 'rock' : 'tuft';
        const sc = 0.7 + rng() * 0.9;
        m4.compose(_v.set(x, h, -dz), _q.setFromEuler(_e.set(0, rng() * 6.28, 0)), _s.set(sc, sc * (0.75 + rng() * 0.6), sc));
        buckets[kind].push(m4.clone());
      }
      for (const kind in buckets) {
        const list = buckets[kind];
        if (!list.length) continue;
        const leafy = kind === 'tuft' || kind === 'dry' || kind === 'bush';
        const im = new THREE.InstancedMesh(this.clutter[kind], leafy ? this.foliageMat : flatMat, list.length);
        list.forEach((m, j) => im.setMatrixAt(j, m));
        im.castShadow = kind !== 'tuft' && kind !== 'dry';
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.userData.inst = true;
        group.add(im);
      }
    }

    insideCableBridge(d) {
      const scale = this.state.scale;
      const lon = geo.normLon(this.lonAt(d));
      for (let i = 0; i < geo.RIVERS.length; i++) {
        const halfGame = geo.RIVERS[i][1] / 2 / scale;
        if (halfGame < 14 || halfGame > 200) continue;
        const deltaM = Math.abs(geo.normLon(lon - geo.RIVERS[i][0])) * geo.M_PER_DEG / scale;
        if (deltaM < halfGame * 0.82) return true;
      }
      return false;
    }

    addVillage(group, d0, ramp, rng) {
      if (rng() > 0.42) return;
      const dz0 = 15 + rng() * (CHUNK - 30);
      const d = d0 + dz0;
      const s = geo.sample(this.lonAt(d), ramp);
      const style = geo.houseStyle(geo.normLon(this.lonAt(d)), s.biome);
      if (!style || s.land < 0.9 || this.riverGap(d) > 0.2) return;
      const side = rng() < 0.5 ? -1 : 1;
      const cx = side * (20 + rng() * 28);
      const n = 2 + Math.floor(rng() * 3);
      const m4 = new THREE.Matrix4();
      const list = [];
      for (let i = 0; i < n; i++) {
        const x = cx + (rng() - 0.5) * 22;
        const dz = dz0 + (rng() - 0.5) * 18;
        const dd = d0 + dz;
        if (this.riverGap(dd) > 0.25) continue;
        const h = this.meshHeight(x, dd);
        if (h < 0.7 || h > 28) continue;
        const sc = 0.85 + rng() * 0.4;
        m4.compose(_v.set(x, h, -dz), _q.setFromEuler(_e.set(0, rng() * 6.28, 0)), _s.set(sc, sc, sc));
        list.push(m4.clone());
      }
      if (!list.length) return;
      const im = new THREE.InstancedMesh(this.houses[style], flatMat, list.length);
      list.forEach((m, j) => im.setMatrixAt(j, m));
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.userData.inst = true;
      group.add(im);
    }

    addHerd(group, d0, ramp, rng, animals) {
      const d = d0 + CHUNK / 2;
      const lon = geo.normLon(this.lonAt(d));
      const s = geo.sample(lon, ramp);
      const kinds = geo.animalsFor(s.biome, lon);
      if (!kinds || s.land < 0.9) return;
      const quiet = kinds[0] === 'gorilla' || kinds[0] === 'orangutan' || kinds[0] === 'tortoise';
      const chance = s.biome === 'savanna' ? 0.72 : s.biome === 'volcanic' ? 0.85 : quiet ? 0.42 : 0.55;
      if (rng() > chance) return;
      const side = rng() < 0.5 ? -1 : 1;
      const forest = s.biome === 'rainforest' || s.biome === 'mountain';
      const cx = side * (forest ? 14 + rng() * 10 : 16 + rng() * 16);
      const n = quiet ? 2 : Math.min(kinds.length, 3);
      for (let i = 0; i < n; i++) {
        const kind = kinds[i % kinds.length];
        if (rng() < 0.18) continue;
        let x = cx + (i - (n - 1) / 2) * 7 + (rng() - 0.5) * 4;
        if (Math.abs(x) < 12) x = side * 12;
        const dz = rng() * CHUNK;
        const dd = d0 + dz;
        if (this.riverGap(dd) > 0.3) continue;
        const h = this.meshHeight(x, dd);
        if (h < 0.6 || h > 22) continue;
        const built = ANIMAL_BUILD[kind]();
        built.group.position.set(x, h, -dz);
        const yaw = rng() * 6.28;
        built.group.rotation.y = yaw;
        group.add(built.group);
        const range = Math.min(4 + rng() * 5, Math.abs(x) - 10);
        animals.push({
          group: built.group, legs: built.legs, trunk: built.trunk,
          x0: x, range: Math.max(1.5, range), freq: 0.22 + rng() * 0.12,
          t: rng() * 10, baseYaw: yaw, stepAmp: built.stepAmp || 0.45,
        });
      }
    }

    addParked(group, d0, ramp, rng) {
      if (rng() > 0.55) return;
      const dz = 12 + rng() * (CHUNK - 24);
      const d = d0 + dz;
      const s = geo.sample(this.lonAt(d), ramp);
      if (s.land < 0.85 || this.riverGap(d) > 0.25) return;
      const side = rng() < 0.5 ? -1 : 1;
      const x = side * (12 + rng() * 8);
      const h = this.meshHeight(x, d);
      if (h < 0.55 || h > 14) return;
      if (Math.abs(this.meshHeight(x, d + 8) - h) > 0.7) return;
      const roll = rng();
      const mesh = (roll < 0.45 ? buildParkedTruck() : roll < 0.75 ? buildParkedCar() : buildParkedBike());
      mesh.position.set(x, h, -dz);
      mesh.rotation.y = (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.25;
      group.add(mesh);
    }

    addRiverCrossing(group, d0) {
      const spanDeg = this.state.scale * CHUNK / geo.M_PER_DEG;
      const lon0 = geo.normLon(this.lonAt(d0));
      for (let i = 0; i < geo.RIVERS.length; i++) {
        const river = geo.RIVERS[i];
        const delta = geo.normLon(river[0] - lon0);
        if (delta < 0 || delta > spanDeg) continue;
        const dz = delta / spanDeg * CHUNK;
        const halfGame = river[1] / 2 / this.state.scale;
        const sign = makeSign([river[2], river[3]], '#1a5276');
        sign.position.set(8.2, ROAD_Y - 0.1, -dz);
        group.add(sign);
        if (halfGame >= 14 && halfGame <= 200) {
          const bridge = buildCableBridge(halfGame * 1.7);
          bridge.position.set(0, 0, -dz);
          group.add(bridge);
        }
      }
    }

    addSeaLife(group, d0, rng) {
      const lon = this.lonAt(d0 + CHUNK / 2);
      if (rng() < 0.1) {
        const ship = new THREE.Mesh(this.shipGeo, flatMat);
        const side = rng() < 0.5 ? -1 : 1;
        ship.position.set(side * (220 + rng() * 1300), 0, -rng() * CHUNK);
        ship.rotation.y = (rng() - 0.5) * 1.2 + (rng() < 0.5 ? 0 : Math.PI);
        ship.castShadow = true;
        group.add(ship);
      }
      if (rng() < 0.07) {
        const boat = new THREE.Mesh(this.boatGeo, flatMat);
        const side = rng() < 0.5 ? -1 : 1;
        boat.position.set(side * (40 + rng() * 500), 0, -rng() * CHUNK);
        boat.rotation.y = rng() * 6.28;
        group.add(boat);
      }
      if (rng() < 0.012) {
        const rig = new THREE.Group();
        const side = rng() < 0.5 ? -1 : 1;
        rig.position.set(side * (350 + rng() * 1100), 0, -rng() * CHUNK);
        rig.rotation.y = rng() * 6.28;
        const body = new THREE.Mesh(this.rigGeo, flatMat);
        body.castShadow = true;
        const flame = new THREE.Mesh(this.flameGeo, this.flameMat);
        flame.position.set(16, 28.5, -32.2);
        rig.add(body, flame);
        group.add(rig);
      }
      if (geo.inIsletZone(lon) && rng() < 0.45) {
        const side = rng() < 0.5 ? -1 : 1;
        const r = 18 + rng() * 45;
        const islet = new THREE.Group();
        islet.position.set(side * (90 + rng() * 900), 0, -rng() * CHUNK);
        const sandMesh = stdMesh(new THREE.CylinderGeometry(r, r * 1.3, 3, 14), 0xe2cf98);
        sandMesh.position.y = -0.7;
        islet.add(sandMesh);
        const grass = stdMesh(new THREE.CylinderGeometry(r * 0.6, r * 0.75, 1.2, 12), 0x5e9a3a);
        grass.position.y = 1.2;
        islet.add(grass);
        const palms = 3 + Math.floor(rng() * 5);
        for (let j = 0; j < palms; j++) {
          const pm = new THREE.Mesh(this.trees.palm, flatMat);
          const a = rng() * 6.28, rr = rng() * r * 0.6;
          pm.position.set(Math.cos(a) * rr, 1.5, Math.sin(a) * rr);
          pm.rotation.y = rng() * 6.28;
          pm.scale.setScalar(0.8 + rng() * 0.5);
          pm.castShadow = true;
          islet.add(pm);
        }
        if (rng() < 0.3) {
          const lh = new THREE.Mesh(this.lighthouseGeo, flatMat);
          lh.position.set(-r * 0.4, 1.5, r * 0.3);
          lh.castShadow = true;
          islet.add(lh);
        }
        group.add(islet);
      }
    }

    // 国界 / 城市路牌与地标
    addMarkers(group, d0) {
      const lonA = this.lonAt(d0);
      const span = this.lonAt(d0 + CHUNK) - lonA;
      const dzOf = (T) => {
        const delta = geo.normLon(T - lonA);
        return delta >= 0 && delta < span ? delta / span * CHUNK : -1;
      };
      const ramp = this.rampDeg();
      const A = geo.AREAS;
      for (let i = 1; i < A.length; i++) {
        if (A[i][2] === A[i - 1][2]) continue;
        const dz = dzOf(A[i][0]);
        if (dz < 0) continue;
        const sea = /洋|海|湾|湖|峡/.test(A[i][2]);
        const head = ED.i18n.t(sea ? 'enterSea' : 'welcome');
        const sign = makeSign([head, geo.localName(A[i][2], A[i][3])], sea ? '#1f5f8b' : '#1f6b3a');
        sign.position.set(8, ROAD_Y - 0.1, -dz);
        group.add(sign);
      }
      for (const [lon, lat, zh, en] of geo.CITIES) {
        const dz = dzOf(lon);
        if (dz < 0) continue;
        const km = Math.round(Math.abs(lat) * 111.3);
        const dir = km < 3
          ? ED.i18n.t('atRoadside')
          : ED.i18n.t('cityOffset', { side: ED.i18n.t(lat > 0 ? 'north' : 'south'), km });
        const sign = makeSign([geo.localName(zh, en), dir], '#2a4f9a');
        sign.position.set(-8, ROAD_Y - 0.1, -dz);
        group.add(sign);
      }
      for (const [lon, type, x, name] of geo.LANDMARKS) {
        const dz = dzOf(lon);
        if (dz < 0) continue;
        const obj = LANDMARK_BUILDERS[type]();
        const s = geo.sample(this.lonAt(d0 + dz), ramp);
        const h = x === 0 ? BASE_Y : this.terrainHeight(x, d0 + dz, s);
        const big = type === 'snowpeak' || type === 'volcano';
        obj.position.set(x, big ? Math.min(h, 0) - 20 : h - 0.4, -dz);
        group.add(obj);
        const sign = makeSign(
          [geo.landmarkLabel(name), ED.i18n.t(big ? 'lookAhead' : 'roadsideMark')],
          big ? '#5c4a32' : '#8a3b1f',
        );
        const sx = x === 0 ? 8.2 : Math.sign(x) * Math.min(8.2, Math.abs(x) - 6);
        sign.position.set(sx, ROAD_Y - 0.1, -dz + (big ? 18 : 0));
        group.add(sign);
      }
    }

    disposeChunk(c) {
      this.scene.remove(c.group);
      c.group.traverse((o) => {
        if (o.userData.inst && typeof o.dispose === 'function') o.dispose();
        if (o.userData.mats) o.userData.mats.forEach((m) => m.dispose());
        if ((o.userData.own || o.userData.ownGeo) && o.geometry) o.geometry.dispose();
        if (o.userData.own && o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
    }

    rebuildAll() {
      for (const c of this.chunks.values()) this.disposeChunk(c);
      this.chunks.clear();
      this.updateChunks(Infinity);
    }

    rebase(newOrigin) {
      const delta = newOrigin - this.state.originDist;
      this.state.originDist = newOrigin;
      for (const c of this.chunks.values()) c.group.position.z += delta;
      for (const cl of this.clouds) cl.position.z += delta;
      for (const f of this.rebaseHooks) f(delta);
    }

    updateChunks(maxBuild = 3) {
      const ci = Math.floor(this.state.dist / CHUNK);
      for (const [i, c] of this.chunks) {
        if (i < ci - BEHIND || i > ci + AHEAD) { this.disposeChunk(c); this.chunks.delete(i); }
      }
      let built = 0;
      for (let i = ci - BEHIND; i <= ci + AHEAD && built < maxBuild; i++) {
        if (!this.chunks.has(i)) { this.chunks.set(i, this.buildChunk(i)); built++; }
      }
    }

    // ---- 每帧 ----
    updateAnimals(dt) {
      for (const c of this.chunks.values()) {
        if (!c.animals) continue;
        for (let i = 0; i < c.animals.length; i++) {
          const a = c.animals[i];
          a.t += dt;
          const forward = Math.cos(a.t * a.freq) >= 0;
          a.group.position.x = a.x0 + Math.sin(a.t * a.freq) * a.range;
          a.group.rotation.y = forward ? a.baseYaw : a.baseYaw + Math.PI;
          const step = Math.sin(a.t * 2.6) * (a.stepAmp || 0.45);
          for (let k = 0; k < a.legs.length; k++) a.legs[k].rotation.x = (k % 2 ? step : -step);
          if (a.trunk) a.trunk.rotation.x = 0.4 + Math.sin(a.t * 1.4) * 0.15;
        }
      }
    }

    update(dt, carPos, camPos, solarHours) {
      this.updateChunks();
      this.updateAnimals(dt);

      // 太阳位置：赤道上，按当地太阳时计算（十月赤纬约 -7°）
      const dec = -7 * Math.PI / 180;
      const H = (solarHours - 12) * 15 * Math.PI / 180;
      const E = -Math.cos(dec) * Math.sin(H), N = Math.sin(dec), U = Math.cos(dec) * Math.cos(H);
      this.sunDir.set(-N, U, -E).normalize();
      const sy = this.sunDir.y;
      const day = smooth(-0.12, 0.22, sy);
      const sunset = Math.exp(-Math.pow(sy / 0.14, 2)) * smooth(-0.25, -0.02, sy);
      this.dayK = day;

      this._zen.setRGB(0.05, 0.12, 0.38).lerp(_c1.setRGB(0.18, 0.45, 0.95), day);
      this._hor.setRGB(0.12, 0.24, 0.55).lerp(_c1.setRGB(0.62, 0.78, 0.98), day);
      this._hor.lerp(_c1.setRGB(1.0, 0.42, 0.18), sunset * 0.85);
      this._zen.lerp(_c1.setRGB(0.25, 0.22, 0.45), sunset * 0.4);
      this._sunC.setRGB(1, 0.95, 0.88).lerp(_c1.setRGB(1, 0.45, 0.15), 1 - smooth(0.0, 0.3, sy));

      // 阴天把天空压成灰色，下雨时雾更浓，闪电瞬间照亮
      const w = this.weather;
      const bright = 0.12 + 0.88 * day;
      this._zen.lerp(_c1.setRGB(0.3, 0.33, 0.37).multiplyScalar(bright), w.overcast * 0.85);
      this._hor.lerp(_c1.setRGB(0.45, 0.48, 0.52).multiplyScalar(bright), w.overcast * 0.8);
      if (w.flash > 0) {
        this._zen.lerp(_c1.setRGB(0.75, 0.8, 1.0), w.flash * 0.7);
        this._hor.lerp(_c1.setRGB(0.7, 0.75, 0.95), w.flash * 0.6);
      }
      const sunVis = 1 - w.overcast * 0.85;

      const su = this.sky.material.uniforms;
      su.zenith.value.copy(this._zen); su.horizon.value.copy(this._hor);
      su.sunDir.value.copy(this.sunDir); su.sunColor.value.copy(this._sunC).multiplyScalar(1 - w.overcast);
      su.night.value = (1 - smooth(-0.2, 0.05, sy)) * (1 - w.overcast);
      this.sky.position.copy(camPos);

      const fogNear = FOG_NEAR + (60 - FOG_NEAR) * w.rain;
      const fogFar = (FOG_FAR + (1800 - FOG_FAR) * w.overcast) * (1 - 0.6 * w.rain);
      this.scene.fog.color.copy(this._hor);
      this.scene.fog.near = fogNear;
      this.scene.fog.far = fogFar;

      const wu = this.water.material.uniforms;
      wu.time.value += dt;
      wu.sunDir.value.copy(this.sunDir); wu.sunColor.value.copy(this._sunC).multiplyScalar(sunVis);
      wu.zenith.value.copy(this._zen); wu.horizon.value.copy(this._hor);
      wu.dayK.value = day * (1 - 0.5 * w.overcast);
      wu.fogColor.value.copy(this._hor);
      wu.fogNear.value = fogNear;
      wu.fogFar.value = fogFar;
      this.water.position.set(camPos.x, 0, camPos.z);

      // 白天用太阳，夜里换成微弱的月光
      if (sy > -0.02) {
        this.sun.position.copy(carPos).addScaledVector(this.sunDir, 500);
        this.sun.intensity = 3.2 * smooth(-0.02, 0.2, sy) * sunVis;
        this.sun.color.copy(this._sunC);
      } else {
        this.sun.position.copy(carPos).addScaledVector(_v.copy(this.sunDir).negate(), 500);
        this.sun.intensity = 2.1 * smooth(0.02, 0.2, -sy) * sunVis;
        this.sun.color.setRGB(0.6, 0.7, 1.0);
      }
      this.sun.target.position.copy(carPos);
      this.hemi.intensity = (1.85 + 0.85 * day) * (1 - 0.1 * w.overcast) + w.flash * 2.5;
      this.hemi.color.copy(this._zen).lerp(_c1.setRGB(0.82, 0.9, 1), 0.78);

      this.roadMat.color.setScalar(1 - 0.35 * w.wet);
      this.roadMat.roughness = 0.9 - 0.55 * w.wet;
      this.cloudMat.color.setScalar(1 - 0.62 * w.overcast);
      this.cloudMat.emissive.copy(this._hor).multiplyScalar(0.35).lerp(_c1.setRGB(0.25, 0.25, 0.25), day * (1 - w.overcast));
      const puff = 1 + 1.1 * w.overcast;
      for (const cl of this.clouds) {
        cl.scale.setScalar(cl.userData.base * puff);
        cl.position.x += dt * 4;
        if (cl.position.z - carPos.z > 800) {
          cl.position.z = carPos.z - 3000 - Math.random() * 600;
          cl.position.x = carPos.x + (Math.random() - 0.5) * 5000;
        }
      }
    }
  }
  const _c1 = new THREE.Color();

  ED.World = World;
  ED.WORLD_CONST = { CHUNK, ROAD_Y };
})(window.ED);
