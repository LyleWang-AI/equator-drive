// 声音：全部用 Web Audio 实时合成，无需音频文件
window.ED = window.ED || {};

(function (ED) {
  const CHORDS = [
    [220.0, 261.63, 329.63, 392.0],
    [174.61, 220.0, 261.63, 329.63],
    [130.81, 164.81, 196.0, 246.94],
    [146.83, 196.0, 246.94, 293.66],
  ];
  const MELODY = [440, 523.25, 587.33, 659.25, 783.99, 880];

  class AudioSys {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.musicOn = true;
      this.t = 0;
    }

    get started() { return !!this.ctx; }

    start() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      const gain = (v, dest) => { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
      const filter = (type, freq, Q, dest) => {
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
        if (Q !== undefined) f.Q.value = Q;
        if (dest) f.connect(dest);
        return f;
      };
      this.gain = gain; this.filter = filter;

      this.master = gain(this.muted ? 0 : 0.9, ctx.destination);
      this.sfx = gain(1, this.master);
      this.musicBus = gain(this.musicOn ? 0.9 : 0, this.master);

      const len = ctx.sampleRate * 3;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      this.brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const wn = this.noiseBuf.getChannelData(0), bn = this.brownBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        wn[i] = w;
        last = (last + 0.02 * w) / 1.02;
        bn[i] = last * 3.5;
      }
      const loop = (buf, dest) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
        s.loopStart = 0; s.connect(dest); s.start(0, Math.random() * 2); return s;
      };

      // 引擎
      this.engGain = gain(0, this.sfx);
      this.engFilter = filter('lowpass', 300, 1.5, this.engGain);
      this.eng1 = ctx.createOscillator(); this.eng1.type = 'sawtooth'; this.eng1.frequency.value = 40;
      this.eng2 = ctx.createOscillator(); this.eng2.type = 'square'; this.eng2.frequency.value = 20;
      const e2g = gain(0.5, this.engFilter);
      this.eng1.connect(this.engFilter); this.eng2.connect(e2g);
      this.eng1.start(); this.eng2.start();

      // 风噪 / 胎噪
      this.windGain = gain(0, this.sfx);
      this.windFilter = filter('bandpass', 600, 0.6, this.windGain);
      loop(this.noiseBuf, this.windFilter);

      // 海浪
      this.wavesGain = gain(0, this.sfx);
      loop(this.brownBuf, filter('lowpass', 700, 0.5, this.wavesGain));

      // 雨声
      this.rainGain = gain(0, this.sfx);
      loop(this.noiseBuf, filter('highpass', 1400, 0.5, filter('lowpass', 8000, 0.5, this.rainGain)));

      // 雨林虫鸣（带颤音）
      this.insectGain = gain(0, this.sfx);
      const trem = gain(0.5, this.insectGain);
      loop(this.noiseBuf, filter('bandpass', 5200, 7, trem));
      const lfo = ctx.createOscillator(); lfo.frequency.value = 23;
      lfo.connect(gain(0.5, trem.gain)); lfo.start();

      // 夜间蟋蟀
      this.cricketGain = gain(0, this.sfx);
      const gate = gain(0.5, this.cricketGain);
      const cr = ctx.createOscillator(); cr.frequency.value = 4300; cr.connect(gate); cr.start();
      const crl = ctx.createOscillator(); crl.type = 'square'; crl.frequency.value = 2.6;
      crl.connect(gain(0.5, gate.gain)); crl.start();

      // 音乐总线：低通 + 回声
      this.musicFilter = filter('lowpass', 1800, 0.4, this.musicBus);
      const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
      const fb = gain(0.38, delay);
      this.musicFilter.connect(delay); delay.connect(fb); delay.connect(gain(0.6, this.musicBus));
      this.nextChord = ctx.currentTime + 1;
      this.nextMelody = ctx.currentTime + 3;
      this.chordIdx = 0;
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
      return !this.muted;
    }

    toggleMusic() {
      this.musicOn = !this.musicOn;
      if (this.ctx) {
        this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.9 : 0, this.ctx.currentTime, 0.5);
        if (this.musicOn) { this.nextChord = this.ctx.currentTime + 0.3; this.nextMelody = this.nextChord + 2; }
      }
      return this.musicOn;
    }

    // p: { speed, vehicle, water, jungle, open, land, day, rain }
    update(dt, p) {
      if (!this.ctx) return;
      this.t += dt;
      const now = this.ctx.currentTime;
      const set = (param, v, tc = 0.25) => param.setTargetAtTime(v, now, tc);

      if (p.vehicle === 'car') {
        const f = 36 + p.speed * 2.3;
        set(this.eng1.frequency, f, 0.15);
        set(this.eng2.frequency, f * 0.5, 0.15);
        set(this.engFilter.frequency, 220 + p.speed * 14, 0.2);
        set(this.engGain.gain, 0.045 + p.speed * 0.0014);
      } else {
        set(this.engGain.gain, 0);
      }
      const ws = p.vehicle === 'car' ? p.speed / 30 : p.speed / 9;
      set(this.windGain.gain, Math.min(0.3, 0.012 + ws * ws * 0.16));
      set(this.windFilter.frequency, 400 + p.speed * 18);

      const swell = 0.55 + 0.45 * Math.sin(this.t * 0.75) * Math.sin(this.t * 0.31 + 1.3);
      set(this.wavesGain.gain, p.water * 0.2 * swell, 0.4);
      set(this.rainGain.gain, p.rain * 0.24, 0.6);
      set(this.insectGain.gain, p.jungle * p.day * (1 - p.rain) * 0.05, 1);
      set(this.cricketGain.gain, p.land * (1 - p.day) * (1 - p.rain) * 0.018, 1);

      const birdRate = p.day * (1 - p.rain) * (p.jungle * 0.5 + p.open * 0.18);
      if (Math.random() < dt * birdRate) this.chirp();

      if (this.musicOn) this.scheduleMusic(now);
    }

    chirp() {
      const ctx = this.ctx, now = ctx.currentTime;
      const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(this.sfx);
      const n = 2 + Math.floor(Math.random() * 4), base = 2000 + Math.random() * 2200;
      const vol = 0.02 + Math.random() * 0.03;
      for (let i = 0; i < n; i++) {
        const t0 = now + i * (0.1 + Math.random() * 0.06);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(base, t0);
        o.frequency.exponentialRampToValueAtTime(base * 1.45, t0 + 0.04);
        o.frequency.exponentialRampToValueAtTime(base * 0.85, t0 + 0.09);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
        o.connect(g); g.connect(pan);
        o.start(t0); o.stop(t0 + 0.12);
      }
    }

    thunder(delay, strength) {
      if (!this.ctx) return;
      const ctx = this.ctx, t0 = ctx.currentTime + delay;
      const s = ctx.createBufferSource(); s.buffer = this.brownBuf;
      const f = this.filter('lowpass', 260, 0.7);
      const g = ctx.createGain();
      const v = 0.35 + 0.65 * Math.max(0, strength);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(v, t0 + 0.08);
      g.gain.setValueAtTime(v * 0.6, t0 + 0.5);
      g.gain.linearRampToValueAtTime(v * 0.9, t0 + 0.9);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 4.5);
      f.frequency.setValueAtTime(320, t0);
      f.frequency.exponentialRampToValueAtTime(90, t0 + 4);
      s.connect(f); f.connect(g); g.connect(this.sfx);
      s.start(t0, Math.random()); s.stop(t0 + 5);
    }

    scheduleMusic(now) {
      const ctx = this.ctx;
      if (this.nextChord < now) this.nextChord = now + 0.1;
      if (this.nextMelody < now) this.nextMelody = now + 0.1;
      if (now > this.nextChord - 0.5) {
        const t0 = this.nextChord, dur = 6.5;
        for (const f of CHORDS[this.chordIdx % CHORDS.length]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.07, t0 + 2.2);
          g.gain.setTargetAtTime(0, t0 + dur, 1.2);
          o.connect(g); g.connect(this.musicFilter);
          o.start(t0); o.stop(t0 + dur + 6);
        }
        this.chordIdx++;
        this.nextChord += dur;
      }
      if (now > this.nextMelody - 0.3) {
        const t0 = this.nextMelody;
        if (Math.random() < 0.6) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = MELODY[Math.floor(Math.random() * MELODY.length)];
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
          o.connect(g); g.connect(this.musicFilter);
          o.start(t0); o.stop(t0 + 2.4);
        }
        this.nextMelody += 0.8 + Math.random() * 1.6;
      }
    }
  }

  ED.AudioSys = AudioSys;
})(window.ED);
