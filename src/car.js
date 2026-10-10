// 载具：汽车与自行车的模型、手动驾驶与自动驾驶
window.ED = window.ED || {};

(function (ED) {
  const SPECS = {
    car: { name: '汽车', max: 50, accel: 6.5, brake: 14, autoAccel: 4, cruise: 25, steer: 5, lane: 2.5, wheelR: 0.36, light: 400 },
    bike: { name: '自行车', max: 14, accel: 1.4, brake: 6, autoAccel: 1.2, cruise: 6.1, steer: 2.2, lane: 3.6, wheelR: 0.34, light: 160 },
  };

  function lambert(hex, extra) {
    return new THREE.MeshLambertMaterial(Object.assign({ color: hex, flatShading: false }, extra));
  }

  function buildCar() {
    const g = new THREE.Group();
    const paint = lambert(0x2aa198);
    const cream = lambert(0xf2ead8);
    const glass = lambert(0x1c2a33);
    const dark = lambert(0x222222);
    const add = (geom, mat, x, y, z) => {
      const m = new THREE.Mesh(geom, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(1.9, 0.62, 4.3), paint, 0, 0.68, 0);
    add(new THREE.BoxGeometry(1.92, 0.12, 4.32), cream, 0, 0.42, 0);
    add(new THREE.BoxGeometry(1.7, 0.62, 2.3), cream, 0, 1.3, 0.35);
    add(new THREE.BoxGeometry(1.72, 0.42, 2.0), glass, 0, 1.3, 0.35).scale.set(1.0, 1, 1.02);
    add(new THREE.BoxGeometry(1.76, 0.08, 2.4), paint, 0, 1.64, 0.35);
    const board = add(new THREE.BoxGeometry(0.55, 0.08, 2.9), lambert(0xf0a830), 0, 1.76, 0.3);
    board.rotation.y = 0.04;
    add(new THREE.BoxGeometry(1.5, 0.06, 0.08), dark, 0, 1.7, -0.5);
    add(new THREE.BoxGeometry(1.5, 0.06, 0.08), dark, 0, 1.7, 1.1);
    add(new THREE.BoxGeometry(1.8, 0.18, 0.15), dark, 0, 0.45, -2.2);
    add(new THREE.BoxGeometry(1.8, 0.18, 0.15), dark, 0, 0.45, 2.2);

    const headMat = lambert(0xfff6d0, { emissive: 0x000000 });
    const tailMat = lambert(0xaa1a1a, { emissive: 0x330000 });
    for (const x of [-0.65, 0.65]) {
      add(new THREE.BoxGeometry(0.34, 0.2, 0.06), headMat, x, 0.75, -2.16);
      add(new THREE.BoxGeometry(0.3, 0.16, 0.06), tailMat, x, 0.75, 2.16);
    }

    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.BoxGeometry(0.3, 0.14, 0.14);
    for (const [x, z] of [[-0.86, -1.4], [0.86, -1.4], [-0.86, 1.4], [0.86, 1.4]]) {
      const w = new THREE.Group();
      w.position.set(x, 0.36, z);
      const tire = new THREE.Mesh(wheelGeo, dark);
      tire.castShadow = true;
      w.add(tire, new THREE.Mesh(hubGeo, cream));
      g.add(w);
      wheels.push(w);
    }
    return { group: g, wheels, headMat, tailMat, lightPos: new THREE.Vector3(0, 0.8, -2.2), animate() {} };
  }

  // 用单位圆柱拼出连接两点的杆件
  const rodGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
  function setRod(mesh, a, b, r) {
    _d.subVectors(b, a);
    const len = _d.length();
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / len));
    mesh.scale.set(r, len, r);
  }

  function buildBike() {
    const g = new THREE.Group();
    const frameMat = lambert(0xd0452f);
    const dark = lambert(0x1e1e1e);
    const metal = lambert(0xb0b0b0);
    const jersey = lambert(0xf2a03d);
    const shorts = lambert(0x2a2a2e);
    const skin = lambert(0xd9a77c);
    const helmet = lambert(0xf4f4f4);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const rod = (a, b, r, mat) => {
      const m = new THREE.Mesh(rodGeo, mat);
      m.castShadow = true;
      setRod(m, a, b, r);
      g.add(m);
      return m;
    };

    const R = V(0, 0.34, 0.5), F = V(0, 0.34, -0.52), BB = V(0, 0.3, 0.02);
    const S = V(0, 0.9, 0.17), H = V(0, 0.88, -0.42), Hb = V(0, 0.72, -0.45);
    rod(BB, S, 0.022, frameMat);
    rod(S, H, 0.02, frameMat);
    rod(BB, Hb, 0.025, frameMat);
    rod(Hb, H, 0.024, frameMat);
    for (const x of [-0.05, 0.05]) {
      rod(V(x, BB.y, BB.z), V(x, R.y, R.z), 0.012, frameMat);
      rod(V(x, 0.84, 0.15), V(x, R.y, R.z), 0.011, frameMat);
      rod(V(x, Hb.y, Hb.z), V(x, F.y, F.z), 0.013, metal);
    }
    rod(H, V(0, 0.97, -0.48), 0.015, metal);
    rod(V(-0.22, 0.97, -0.48), V(0.22, 0.97, -0.48), 0.014, dark);
    rod(V(0, 0.9, 0.17), V(0, 0.96, 0.19), 0.015, metal);
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.26), dark);
    saddle.position.set(0, 0.98, 0.18);
    g.add(saddle);

    const wheels = [];
    const tireGeo = new THREE.TorusGeometry(0.32, 0.028, 6, 28);
    tireGeo.rotateY(Math.PI / 2);
    const spokeGeo = new THREE.BoxGeometry(0.012, 0.62, 0.012);
    for (const p of [R, F]) {
      const w = new THREE.Group();
      w.position.copy(p);
      const tire = new THREE.Mesh(tireGeo, dark);
      tire.castShadow = true;
      w.add(tire);
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(spokeGeo, metal);
        s.rotation.x = i * Math.PI / 3;
        w.add(s);
      }
      g.add(w);
      wheels.push(w);
    }

    // 骑手
    const pelvis = V(0, 1.02, 0.2), chest = V(0, 1.48, -0.17);
    rod(pelvis, chest, 0.15, jersey);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), skin);
    head.position.set(0, 1.66, -0.3);
    head.castShadow = true;
    g.add(head);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), helmet);
    hat.position.set(0, 1.69, -0.29);
    hat.scale.y = 0.85;
    g.add(hat);
    for (const x of [-0.17, 0.17]) {
      rod(V(x, 1.46, -0.16), V(x * 1.15, 1.2, -0.36), 0.045, jersey);
      rod(V(x * 1.15, 1.2, -0.36), V(x * 1.25, 0.98, -0.48), 0.038, skin);
    }

    const legs = [];
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(rodGeo, shorts);
      const shin = new THREE.Mesh(rodGeo, skin);
      const crank = new THREE.Mesh(rodGeo, metal);
      thigh.castShadow = shin.castShadow = true;
      g.add(thigh, shin, crank);
      legs.push({ side, thigh, shin, crank, hip: V(side * 0.1, 1.0, 0.2) });
    }

    const headMat = lambert(0xfff6d0, { emissive: 0x000000 });
    const tailMat = lambert(0xaa1a1a, { emissive: 0x330000 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.05), headMat);
    lamp.position.set(0, 0.92, -0.5);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03), tailMat);
    tail.position.set(0, 0.86, 0.3);
    g.add(lamp, tail);

    const L1 = 0.47, L2 = 0.47, CRANK = 0.17;
    const foot = new THREE.Vector3(), knee = new THREE.Vector3(), bbSide = new THREE.Vector3();
    function animate(wheelAngle) {
      const theta = wheelAngle / 2.6;
      for (const leg of legs) {
        const a = theta + (leg.side > 0 ? 0 : Math.PI);
        const x = leg.side * 0.13;
        foot.set(x, BB.y + CRANK * Math.sin(a), BB.z - CRANK * Math.cos(a));
        bbSide.set(x, BB.y, BB.z);
        setRod(leg.crank, bbSide, foot, 0.012);
        // 两段式反向运动学，膝盖朝前
        const hz = leg.hip.z, hy = leg.hip.y;
        const dz = foot.z - hz, dy = foot.y - hy;
        const D = Math.min(Math.hypot(dz, dy), L1 + L2 - 0.001);
        const phi = Math.atan2(dy, dz);
        const alpha = Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D));
        const z1 = hz + L1 * Math.cos(phi + alpha), z2 = hz + L1 * Math.cos(phi - alpha);
        const ang = z1 < z2 ? phi + alpha : phi - alpha;
        knee.set((leg.hip.x + x) / 2, hy + L1 * Math.sin(ang), hz + L1 * Math.cos(ang));
        setRod(leg.thigh, leg.hip, knee, 0.06);
        setRod(leg.shin, knee, foot, 0.045);
      }
    }
    animate(0);
    return { group: g, wheels, headMat, tailMat, lightPos: new THREE.Vector3(0, 0.95, -0.55), animate };
  }

  class Vehicle {
    constructor() {
      this.group = new THREE.Group();
      this.models = { car: buildCar(), bike: buildBike() };
      for (const k in this.models) this.group.add(this.models[k].group);
      this.spot = new THREE.SpotLight(0xfff2cc, 0, 140, 0.45, 0.5, 1);
      this.spotTarget = new THREE.Object3D();
      this.group.add(this.spot, this.spotTarget);
      this.spot.target = this.spotTarget;
      this.speed = 0;
      this.vx = 0;
      this.autopilot = true;
      this.wheelAngle = 0;
      this.setType('car');
      this.x = this.lane;
    }

    get spec() { return SPECS[this.type]; }
    get model() { return this.models[this.type]; }

    setType(type) {
      this.type = type;
      for (const k in this.models) this.models[k].group.visible = k === type;
      const s = this.spec;
      this.cruise = s.cruise;
      this.speed = Math.min(this.speed, s.max);
      this.lane = (this.x !== undefined && this.x < 0) ? -s.lane : s.lane;
      this.spot.position.copy(this.model.lightPos);
      this.spotTarget.position.set(0, 0, -40);
    }

    toggleType() {
      this.setType(this.type === 'car' ? 'bike' : 'car');
    }

    toggleAutopilot() {
      this.autopilot = !this.autopilot;
      if (this.autopilot) {
        const kmh = Math.round(this.speed * 3.6);
        this.cruise = kmh >= 5 ? kmh / 3.6 : this.spec.cruise;
        this.lane = this.x < 0 ? -this.spec.lane : this.spec.lane;
      }
    }

    changeLane(dir) {
      if (this.autopilot) this.lane = dir < 0 ? -this.spec.lane : this.spec.lane;
    }

    update(dt, keys) {
      const s = this.spec;
      if (this.autopilot) {
        const rate = s.max * 0.25;
        if (keys.up) this.cruise += rate * dt;
        if (keys.down) this.cruise -= rate * dt;
        this.cruise = Math.min(s.max, Math.max(1.5, this.cruise));
        const diff = this.cruise - this.speed;
        this.speed += Math.max(-s.brake * 0.7 * dt, Math.min(s.autoAccel * dt, diff));
        const target = Math.max(-3, Math.min(3, (this.lane - this.x) * 1.4));
        this.vx += (target - this.vx) * Math.min(1, dt * 3);
      } else {
        if (keys.up) this.speed += s.accel * dt * (1 - this.speed / (s.max * 1.1));
        else if (keys.down) this.speed -= s.brake * dt;
        else this.speed -= (0.3 + this.speed * 0.012) * dt;
        this.speed = Math.max(0, Math.min(s.max, this.speed));
        const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        const target = steer * s.steer * Math.min(1, this.speed / 5);
        this.vx += (target - this.vx) * Math.min(1, dt * 5);
      }
      this.x += this.vx * dt;
      if (Math.abs(this.x) > 4.0) { this.x = Math.sign(this.x) * 4.0; this.vx *= 0.3; }

      this.wheelAngle -= this.speed * dt / s.wheelR;
      const m = this.model;
      for (const w of m.wheels) w.rotation.x = this.wheelAngle;
      m.animate(this.wheelAngle);
      this.group.rotation.y = -Math.atan2(this.vx, Math.max(this.speed, 3));
      this.group.rotation.z = this.type === 'bike' ? -this.vx * 0.12 : this.vx * 0.012;
    }

    setLights(night) {
      this.spot.intensity = night * this.spec.light;
      for (const k in this.models) {
        const m = this.models[k];
        m.headMat.emissive.setRGB(night, night * 0.95, night * 0.8);
        m.tailMat.emissive.setRGB(0.2 + night * 0.8, 0, 0);
      }
    }
  }

  ED.Vehicle = Vehicle;
})(window.ED);
