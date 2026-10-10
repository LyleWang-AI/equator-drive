// 海洋生物：伴游的海豚群、远处浮出水面的鲸鱼、飞鱼
window.ED = window.ED || {};

(function (ED) {
  const geo = ED.geo;

  function mat(hex) {
    return new THREE.MeshLambertMaterial({ color: hex, flatShading: false });
  }

  function disposeObj(o) {
    o.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
  }

  function buildDolphin() {
    const g = new THREE.Group();
    const skin = mat(0x5b7184), belly = mat(0xc9d3da);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), skin);
    body.scale.set(0.42, 0.4, 1.5);
    const under = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), belly);
    under.scale.set(0.36, 0.3, 1.3); under.position.y = -0.1;
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), skin);
    snout.rotation.x = -Math.PI / 2; snout.position.set(0, -0.05, -1.65);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), skin);
    fin.position.set(0, 0.5, 0.15); fin.rotation.x = 0.5; fin.scale.z = 0.35;
    const fluke = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.3), skin);
    fluke.position.set(0, 0, 1.65);
    for (const m of [body, under, snout, fin, fluke]) { m.castShadow = true; g.add(m); }
    return g;
  }

  function buildWhale() {
    const g = new THREE.Group();
    const skin = mat(0xd2dbe3);
    const belly = mat(0x8d97a1);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), skin);
    body.scale.set(2.6, 2.5, 9.5);
    const under = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), belly);
    under.scale.set(2.4, 1.15, 8);
    under.position.y = -1.05;
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 5), skin);
    fin.position.set(0, 2.05, -1.1);
    fin.scale.set(1.2, 1, 1.8);
    const flukes = new THREE.Mesh(new THREE.BoxGeometry(6, 0.28, 1.8), skin);
    flukes.position.set(0, 0.1, 9.4);
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.4, 3.2, 8), skin);
    stock.rotation.x = Math.PI / 2;
    stock.position.set(0, 0.05, 7.6);
    g.add(body, under, fin, flukes, stock);

    const n = 90;
    const pos = new Float32Array(n * 3);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const puff = document.createElement('canvas');
    puff.width = puff.height = 64;
    const pg2 = puff.getContext('2d');
    const grd = pg2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    pg2.fillStyle = grd;
    pg2.fillRect(0, 0, 64, 64);
    const puffMap = new THREE.CanvasTexture(puff);
    const spout = new THREE.Points(pg, new THREE.PointsMaterial({
      map: puffMap, color: 0xf4f8ff, size: 2.2, sizeAttenuation: true,
      transparent: true, opacity: 0.0, depthWrite: false,
    }));
    spout.frustumCulled = false;
    spout.visible = false;
    const vel = [];
    for (let i = 0; i < n; i++) vel.push(new THREE.Vector3());
    spout.position.set(0, 1.9, -4.2);
    g.add(spout);
    return { group: g, spout, vel };
  }

  function buildFishGeo() {
    const g = new THREE.BufferGeometry();
    const body = new THREE.BoxGeometry(0.12, 0.1, 0.45).toNonIndexed();
    const wing = new THREE.BoxGeometry(0.7, 0.01, 0.18).toNonIndexed();
    wing.translate(0, 0.02, -0.05);
    const merged = [body, wing];
    let total = 0;
    for (const m of merged) total += m.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
    let o = 0;
    for (const m of merged) {
      pos.set(m.attributes.position.array, o * 3);
      nor.set(m.attributes.normal.array, o * 3);
      o += m.attributes.position.count;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return g;
  }

  class SeaLife {
    constructor(scene, world, toast) {
      this.scene = scene;
      this.world = world;
      this.toast = toast;
      this.t = 0;
      this.pod = null;
      this.whales = [];
      this.fish = [];
      this.fishGeo = buildFishGeo();
      this.fishMat = new THREE.MeshLambertMaterial({ color: 0xaab8c8, emissive: 0x111822 });
      this.cooldown = { pod: 20, whale: 25, fish: 6 };
      this.toastCooldown = { pod: 0, whale: 0 };
      world.rebaseHooks.push((delta) => this.shift(delta));
    }

    shift(delta) {
      if (this.pod) this.pod.z += delta;
      for (const w of this.whales) w.group.position.z += delta;
      for (const f of this.fish) { f.z0 += delta; f.mesh.position.z += delta; }
    }

    isOpenSea(d) {
      const ramp = this.world.rampDeg();
      return geo.sample(this.world.lonAt(d), ramp).land < 0.02 &&
        geo.sample(this.world.lonAt(d + 500), ramp).land < 0.02;
    }

    update(dt, dist, carZ, carSpeed) {
      this.t += dt;
      for (const k in this.cooldown) this.cooldown[k] -= dt;
      for (const k in this.toastCooldown) this.toastCooldown[k] -= dt;
      const sea = this.isOpenSea(dist);

      if (sea && !this.pod && this.cooldown.pod <= 0 && Math.random() < dt / 35) this.spawnPod(carZ, carSpeed);
      if (sea && this.whales.length < 1 && this.cooldown.whale <= 0 && Math.random() < dt / 28) this.spawnWhale(carZ);
      if (sea && this.cooldown.fish <= 0 && Math.random() < dt / 10) this.spawnFish(carZ);

      this.updatePod(dt, carZ, carSpeed);
      this.updateWhales(dt, carZ);
      this.updateFish(dt);
    }

    // ---- 海豚 ----
    spawnPod(carZ, carSpeed) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const n = 4 + Math.floor(Math.random() * 5);
      const members = [];
      for (let i = 0; i < n; i++) {
        const mesh = buildDolphin();
        mesh.visible = false;
        this.scene.add(mesh);
        members.push({
          mesh, dx: (Math.random() - 0.5) * 10, dz: (Math.random() - 0.5) * 24,
          phase: Math.random(), period: 2.2 + Math.random() * 1.0, wob: Math.random() * 6,
        });
      }
      this.pod = {
        members, side, x: side * (16 + Math.random() * 14),
        z: carZ - 140, speed: Math.min(carSpeed, 22), offset: -12 - Math.random() * 20,
        life: 50 + Math.random() * 30,
      };
      this.cooldown.pod = 60;
      if (this.toastCooldown.pod <= 0) {
        this.toast(
          ED.i18n.t('dolphin', { side: ED.i18n.t(side < 0 ? 'left' : 'right') }),
          ED.i18n.t('dolphinSub'),
        );
        this.toastCooldown.pod = 120;
      }
    }

    updatePod(dt, carZ, carSpeed) {
      const pod = this.pod;
      if (!pod) return;
      pod.life -= dt;
      const want = pod.life > 0 ? carSpeed + (pod.z - (carZ + pod.offset)) * 0.4 : carSpeed * 0.3;
      pod.speed += (Math.max(0, Math.min(22, want)) - pod.speed) * Math.min(1, dt * 1.5);
      pod.z -= pod.speed * dt;
      for (const m of pod.members) {
        const s = ((this.t / m.period) + m.phase) % 1;
        const mesh = m.mesh;
        if (s < 0.36) {
          const u = s / 0.36;
          mesh.visible = true;
          mesh.position.y = 2.0 * Math.sin(Math.PI * u) - 0.35;
          mesh.rotation.x = 0.85 * Math.cos(Math.PI * u);
        } else {
          mesh.visible = false;
        }
        mesh.position.x = pod.x + m.dx + Math.sin(this.t * 0.5 + m.wob) * 1.2;
        mesh.position.z = pod.z + m.dz;
      }
      const rel = pod.z - carZ;
      if (rel > 180 || rel < -320 || (pod.life < -15)) {
        for (const m of pod.members) { this.scene.remove(m.mesh); disposeObj(m.mesh); }
        this.pod = null;
      }
    }

    // ---- 鲸鱼 ----
    spawnWhale(carZ) {
      const w = buildWhale();
      const side = Math.random() < 0.5 ? -1 : 1;
      w.side = side;
      w.holdX = side * (11 + Math.random() * 0.3);
      w.group.position.set(w.holdX, -7, carZ - 26);
      w.group.rotation.order = 'YXZ';
      w.group.rotation.z = side * -0.05;
      w.t = 0;
      w.spoutT = -1;
      w.surfaceY = -0.25;
      this.scene.add(w.group);
      this.whales.push(w);
      this.cooldown.whale = 80;
      if (this.toastCooldown.whale <= 0) {
        this.toast(
          ED.i18n.t('whale', { side: ED.i18n.t(side < 0 ? 'left' : 'right') }),
          ED.i18n.t('whaleSub'),
        );
        this.toastCooldown.whale = 150;
      }
    }

    updateWhales(dt, carZ) {
      for (let i = this.whales.length - 1; i >= 0; i--) {
        const w = this.whales[i];
        w.t += dt;
        const t = w.t;
        const g = w.group;
        g.position.z = carZ - 26;
        g.position.x = w.holdX + Math.sin(t * 0.35) * 0.35 * w.side;
        if (t < 5) {
          const u = t / 5;
          const e = u * u * (3 - 2 * u);
          g.position.y = -7 + (w.surfaceY + 7) * e;
        } else if (t < 18) {
          g.position.y = w.surfaceY + Math.sin(t * 0.7) * 0.12;
        } else {
          const u = Math.min(1, (t - 18) / 5);
          g.position.y = w.surfaceY - u * u * 8;
        }
        if (t > 5.2 && w.spoutT < 0) this.startSpout(w);
        if (w.spoutT >= 0) this.updateSpout(w, dt);
        if (t > 24) {
          this.scene.remove(g);
          disposeObj(g);
          this.whales.splice(i, 1);
        }
      }
    }

    startSpout(w) {
      w.spoutT = 0;
      w.spout.visible = true;
      w.spout.material.opacity = 0.85;
      const pos = w.spout.geometry.attributes.position.array;
      w.vel.forEach((v, i) => {
        pos[i * 3] = (Math.random() - 0.5) * 0.4;
        pos[i * 3 + 1] = Math.random() * 0.6;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        v.set((Math.random() - 0.5) * 1.1, 7 + Math.random() * 6, (Math.random() - 0.5) * 1.1);
      });
    }

    updateSpout(w, dt) {
      w.spoutT += dt;
      const pos = w.spout.geometry.attributes.position.array;
      w.vel.forEach((v, i) => {
        v.y -= 5.5 * dt;
        pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt;
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3] = (Math.random() - 0.5) * 0.4;
          pos[i * 3 + 1] = Math.random() * 0.4;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
          v.set((Math.random() - 0.5) * 1.1, 7 + Math.random() * 6, (Math.random() - 0.5) * 1.1);
        }
      });
      w.spout.geometry.attributes.position.needsUpdate = true;
      const fade = w.spoutT < 6 ? 0.85 : Math.max(0, 0.85 - (w.spoutT - 6) * 0.45);
      w.spout.material.opacity = fade;
      if (fade <= 0) w.spout.visible = false;
    }

    // ---- 飞鱼 ----
    spawnFish(carZ) {
      const n = 4 + Math.floor(Math.random() * 8);
      const side = Math.random() < 0.5 ? -1 : 1;
      const cx = side * (8 + Math.random() * 30), cz = carZ - 50 - Math.random() * 70;
      const heading = (Math.random() - 0.5) * 1.2 + (Math.random() < 0.7 ? 0 : Math.PI);
      for (let i = 0; i < n; i++) {
        const mesh = new THREE.Mesh(this.fishGeo, this.fishMat);
        const h = heading + (Math.random() - 0.5) * 0.3;
        const f = {
          mesh, x0: cx + (Math.random() - 0.5) * 6, z0: cz + (Math.random() - 0.5) * 8,
          dx: -Math.sin(h), dz: -Math.cos(h), len: 25 + Math.random() * 25,
          dur: 1.6 + Math.random() * 1.0, t: -Math.random() * 0.8, height: 0.8 + Math.random() * 0.8,
        };
        mesh.rotation.order = 'YXZ';
        mesh.rotation.y = h;
        mesh.visible = false;
        this.scene.add(mesh);
        this.fish.push(f);
      }
      this.cooldown.fish = 5;
    }

    updateFish(dt) {
      for (let i = this.fish.length - 1; i >= 0; i--) {
        const f = this.fish[i];
        f.t += dt;
        if (f.t < 0) continue;
        const u = f.t / f.dur;
        if (u > 1) {
          this.scene.remove(f.mesh);
          this.fish.splice(i, 1);
          continue;
        }
        f.mesh.visible = true;
        f.mesh.position.set(f.x0 + f.dx * f.len * u, f.height * Math.sin(Math.PI * Math.min(1, u * 1.15)) + 0.05,
          f.z0 + f.dz * f.len * u);
        f.mesh.rotation.x = 0.3 * Math.cos(Math.PI * u);
      }
    }
  }

  ED.SeaLife = SeaLife;
})(window.ED);
