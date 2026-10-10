// 同向和迎面的车辆，让路上不只有自己
window.ED = window.ED || {};

(function (ED) {
  const { ROAD_Y } = ED.WORLD_CONST;

  function lambert(hex) {
    return new THREE.MeshLambertMaterial({ color: hex });
  }

  const tireMat = lambert(0x1a1a1a);
  const hubMat = lambert(0xd0d0d0);

  function addWheels(g, spots, radius, width) {
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 12);
    tireGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(radius * 0.38, radius * 0.38, width * 1.12, 8);
    hubGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of spots) {
      const w = new THREE.Group();
      w.name = 'wheel';
      w.position.set(x, radius, z);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      w.add(tire, new THREE.Mesh(hubGeo, hubMat));
      g.add(w);
    }
  }

  function buildTruck() {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 2.2), lambert(0xd8d4cc));
    cab.position.set(0, 1.55, -2.3);
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.2, 5.2), lambert(0xc4552a));
    box.position.set(0, 1.8, 1.3);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.4, 7.6), lambert(0x333333));
    chassis.position.set(0, 0.55, 0);
    g.add(cab, box, chassis);
    addWheels(g, [[-1.2, -2.6], [1.2, -2.6], [-1.2, 1.2], [1.2, 1.2], [-1.2, 2.45], [1.2, 2.45]], 0.48, 0.32);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  function buildBus() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.1, 6.4), lambert(0xf0d24a));
    body.position.y = 1.55;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 6.4), lambert(0x2a6f4e));
    stripe.position.y = 1.35;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 5.6), lambert(0x1c2a33));
    glass.position.y = 2.15;
    g.add(body, stripe, glass);
    addWheels(g, [[-1.15, -2.05], [1.15, -2.05], [-1.15, 2.05], [1.15, 2.05]], 0.5, 0.34);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  function buildBike() {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 1.5), lambert(0x3a6ea5));
    frame.position.set(0, 0.85, 0);
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.4), lambert(0xf2a03d));
    rider.position.set(0, 1.45, -0.1);
    g.add(frame, rider);
    addWheels(g, [[0, -0.78], [0, 0.72]], 0.36, 0.08);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // 只有路面上的车会开。路外的车是世界里的静止景物，不进这个列表。
  const KINDS = [
    { build: buildTruck, speed: 12, lane: 2.4, oncoming: false, half: 4.4, wide: 1.15, wheelR: 0.48, colors: [0xc4552a, 0xd8d4cc, 0x333333] },
    { build: buildBus, speed: 16, lane: -2.5, oncoming: true, half: 3.6, wide: 1.15, wheelR: 0.5, colors: [0xf0d24a, 0x2a6f4e, 0x1c2a33] },
    { build: buildBike, speed: 6.5, lane: 3.35, oncoming: false, half: 1.2, wide: 0.45, wheelR: 0.36, colors: [0x3a6ea5, 0xf2a03d] },
  ];

  class Traffic {
    constructor(scene, world) {
      this.scene = scene;
      this.world = world;
      this.list = [];
      this.bits = [];
      this.cooldown = 16;
      this.protos = KINDS.map((k) => k.build());
      this.bitGeo = new THREE.BoxGeometry(0.52, 0.52, 0.52);
      this.bitMats = new Map();
      world.rebaseHooks.push((delta) => {
        for (const v of this.list) v.z += delta;
        for (const b of this.bits) b.mesh.position.z += delta;
      });
    }

    clear() {
      for (const v of this.list) this.scene.remove(v.mesh);
      this.list.length = 0;
      for (const b of this.bits) this.scene.remove(b.mesh);
      this.bits.length = 0;
      this.cooldown = 16;
    }

    bitMat(hex) {
      let m = this.bitMats.get(hex);
      if (!m) {
        m = new THREE.MeshLambertMaterial({ color: hex });
        this.bitMats.set(hex, m);
      }
      return m;
    }

    burst(v) {
      const colors = v.colors;
      const origin = v.mesh.position;
      for (let i = 0; i < 32; i++) {
        const mesh = new THREE.Mesh(this.bitGeo, this.bitMat(colors[i % colors.length]));
        mesh.position.set(
          origin.x + (Math.random() - 0.5) * 2.4,
          ROAD_Y + 0.5 + Math.random() * 2.4,
          origin.z + (Math.random() - 0.5) * Math.min(6, v.half * 1.6),
        );
        mesh.rotation.set(0, (Math.random() * 4 | 0) * Math.PI / 2, 0);
        this.scene.add(mesh);
        const life = 0.65 + Math.random() * 0.35;
        this.bits.push({
          mesh,
          vx: (Math.random() - 0.5) * 8,
          vy: 2.5 + Math.random() * 6,
          vz: (Math.random() - 0.5) * 8,
          life, max: life,
        });
      }
    }

    update(dt, carZ, carX) {
      this.cooldown -= dt;
      if (this.list.length === 0 && this.cooldown <= 0) {
        this.spawn(carZ);
        this.cooldown = 55 + Math.random() * 40;
      }
      for (let i = this.list.length - 1; i >= 0; i--) {
        const v = this.list[i];
        const rel = v.z - carZ;
        if (rel > 50 || rel < -380) {
          this.scene.remove(v.mesh);
          this.list.splice(i, 1);
          continue;
        }
        v.z += (v.oncoming ? v.speed : -v.speed) * dt;
        const spin = v.speed * dt / v.wheelR;
        for (let k = 0; k < v.wheels.length; k++) v.wheels[k].rotation.x -= spin;
        const hit = Math.abs(rel) < v.half * 0.7 + 1.8 && Math.abs(v.x - carX) < v.wide + 1.45;
        if (hit) {
          v.mesh.position.set(v.x, ROAD_Y, v.z);
          this.burst(v);
          this.scene.remove(v.mesh);
          this.list.splice(i, 1);
          continue;
        }
        v.mesh.position.set(v.x, ROAD_Y, v.z);
      }
      for (let i = this.bits.length - 1; i >= 0; i--) {
        const b = this.bits[i];
        b.life -= dt;
        if (b.life <= 0) {
          this.scene.remove(b.mesh);
          this.bits.splice(i, 1);
          continue;
        }
        b.vy -= 16 * dt;
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.y += b.vy * dt;
        b.mesh.position.z += b.vz * dt;
        const s = Math.max(0.2, b.life / b.max);
        b.mesh.scale.setScalar(s);
      }
    }

    spawn(carZ) {
      const ahead = 220 + Math.random() * 140;
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
      const i = KINDS.indexOf(kind);
      const mesh = this.protos[i].clone();
      const x = kind.lane + (Math.random() - 0.5) * 0.15;
      const v = {
        mesh,
        oncoming: kind.oncoming,
        speed: kind.speed * (0.92 + Math.random() * 0.12),
        half: kind.half,
        wide: kind.wide,
        colors: kind.colors,
        wheelR: kind.wheelR,
        wheels: [],
        homeX: x,
        x,
        z: carZ - ahead,
      };
      mesh.traverse((o) => { if (o.name === 'wheel') v.wheels.push(o); });
      if (kind.oncoming) mesh.rotation.y = Math.PI;
      mesh.position.set(v.x, ROAD_Y, v.z);
      this.scene.add(mesh);
      this.list.push(v);
    }
  }

  ED.Traffic = Traffic;
})(window.ED);
