// 天气：晴 / 多云 / 雷阵雨，雨丝、闪电与路面湿润
window.ED = window.ED || {};

(function (ED) {
  const STATES = {
    clear: { name: '晴', overcast: 0.08, rain: 0 },
    cloudy: { name: '多云', overcast: 0.55, rain: 0 },
    storm: { name: '雷阵雨', overcast: 1, rain: 1 },
  };
  const DROPS = 2600;
  const BOX = { x: 45, yTop: 32, yBot: -6, zFront: -70, zBack: 25 };

  function approach(v, target, rate) {
    return v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);
  }

  class Weather {
    constructor(scene) {
      this.state = 'clear';
      this.timer = 150;
      this.overcast = STATES.clear.overcast;
      this.rain = 0;
      this.wet = 0;
      this.flash = 0;
      this.lightningTimer = 6;
      this.pendingFlicker = -1;
      Object.defineProperty(this, 'name', {
        get() { return ED.i18n.t('weather_' + this.state); },
      });

      this.drops = new Float32Array(DROPS * 3);
      this.dropSpeed = new Float32Array(DROPS);
      for (let i = 0; i < DROPS; i++) this.resetDrop(i, true);
      this.linePos = new Float32Array(DROPS * 6);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
      this.rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        color: 0xb8c8d8, transparent: true, opacity: 0, depthWrite: false,
      }));
      this.rainLines.frustumCulled = false;
      this.rainLines.visible = false;
      scene.add(this.rainLines);

      const bg = new THREE.BufferGeometry();
      this.boltPos = new Float32Array(40 * 3);
      bg.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3));
      this.bolt = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: 0xeef4ff, fog: false }));
      this.bolt.frustumCulled = false;
      this.bolt.visible = false;
      this.boltTimer = 0;
      scene.add(this.bolt);
    }

    get name() { return STATES[this.state].name; }

    resetDrop(i, anywhere) {
      const d = this.drops;
      d[i * 3] = (Math.random() * 2 - 1) * BOX.x;
      d[i * 3 + 1] = anywhere ? BOX.yBot + Math.random() * (BOX.yTop - BOX.yBot) : BOX.yTop;
      d[i * 3 + 2] = BOX.zFront + Math.random() * (BOX.zBack - BOX.zFront);
      this.dropSpeed[i] = 20 + Math.random() * 8;
    }

    // 手动切换：晴 → 多云 → 雷阵雨 → 晴
    cycle() {
      const order = ['clear', 'cloudy', 'storm'];
      this.state = order[(order.indexOf(this.state) + 1) % order.length];
      this.timer = 240;
      return this.name;
    }

    pickNext(solar, biome) {
      const afternoon = solar > 13 && solar < 19;
      const wetBiome = biome === 'rainforest' || biome === 'mountain';
      let pStorm = afternoon ? 0.45 : 0.15;
      if (wetBiome) pStorm += 0.15;
      const r = Math.random();
      if (this.state === 'storm') {
        this.state = r < 0.7 ? 'cloudy' : 'clear';
      } else if (r < pStorm) {
        this.state = this.state === 'clear' ? 'cloudy' : 'storm';
      } else if (r < pStorm + 0.3) {
        this.state = this.state === 'clear' ? 'cloudy' : 'clear';
      } else {
        this.state = 'clear';
      }
      const dur = { clear: [120, 300], cloudy: [50, 140], storm: [45, 100] }[this.state];
      this.timer = dur[0] + Math.random() * (dur[1] - dur[0]);
    }

    // 返回本帧产生的雷声事件（延迟秒数与强度），没有则为 null
    update(dt, { solar, biome, camPos, carSpeed }) {
      this.timer -= dt;
      if (this.timer <= 0) this.pickNext(solar, biome);

      const target = STATES[this.state];
      this.overcast = approach(this.overcast, target.overcast, dt / 25);
      const rainTarget = this.overcast > 0.75 ? target.rain : 0;
      this.rain = approach(this.rain, rainTarget, dt / 12);
      this.wet = this.rain > 0.3 ? approach(this.wet, 1, dt / 10) : approach(this.wet, 0, dt / 90);

      let thunder = null;
      this.flash = Math.max(0, this.flash - dt * 5);
      if (this.pendingFlicker > 0) {
        this.pendingFlicker -= dt;
        if (this.pendingFlicker <= 0) this.flash = 0.8;
      }
      if (this.rain > 0.7) {
        this.lightningTimer -= dt;
        if (this.lightningTimer <= 0) {
          this.lightningTimer = 4 + Math.random() * 12;
          const dist = 400 + Math.random() * 1100;
          this.strike(camPos, dist);
          thunder = { delay: dist / 340 * 0.6, strength: 1 - (dist - 400) / 1500 };
        }
      }
      if (this.boltTimer > 0) {
        this.boltTimer -= dt;
        if (this.boltTimer <= 0) this.bolt.visible = false;
      }

      this.updateRain(dt, camPos, carSpeed);
      return thunder;
    }

    strike(camPos, dist) {
      this.flash = 1;
      this.pendingFlicker = 0.12 + Math.random() * 0.1;
      const a = Math.random() * Math.PI * 2;
      let x = camPos.x + Math.cos(a) * dist, z = camPos.z + Math.sin(a) * dist, y = 480;
      const n = this.boltPos.length / 3;
      for (let i = 0; i < n; i++) {
        this.boltPos[i * 3] = x; this.boltPos[i * 3 + 1] = y; this.boltPos[i * 3 + 2] = z;
        y -= 480 / (n - 1);
        x += (Math.random() - 0.5) * 28;
        z += (Math.random() - 0.5) * 28;
      }
      this.bolt.geometry.attributes.position.needsUpdate = true;
      this.bolt.visible = true;
      this.boltTimer = 0.22;
    }

    updateRain(dt, camPos, carSpeed) {
      const on = this.rain > 0.02;
      this.rainLines.visible = on;
      if (!on) return;
      this.rainLines.material.opacity = 0.18 + 0.3 * this.rain;
      this.rainLines.position.copy(camPos);
      const count = Math.floor(DROPS * this.rain);
      const d = this.drops, p = this.linePos;
      for (let i = 0; i < count; i++) {
        const sp = this.dropSpeed[i];
        d[i * 3 + 1] -= sp * dt;
        d[i * 3 + 2] += carSpeed * dt;
        if (d[i * 3 + 1] < BOX.yBot || d[i * 3 + 2] > BOX.zBack) this.resetDrop(i, false);
        const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2];
        p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
        p[i * 6 + 3] = x; p[i * 6 + 4] = y + sp * 0.035; p[i * 6 + 5] = z - carSpeed * 0.035;
      }
      this.rainLines.geometry.setDrawRange(0, count * 2);
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    }
  }

  ED.Weather = Weather;
})(window.ED);
