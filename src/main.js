// 主循环：输入、相机、HUD
(function (ED) {
  const geo = ED.geo;
  const { ROAD_Y } = ED.WORLD_CONST;
  const SCALES = [1, 20, 100, 500, 2000];
  const TIME_SPEEDS = [0, 60, 240, 1200];
  const camName = (i) => ED.i18n.t('cam' + i);
  const CAM_PRESET = [
    { yaw: 0, pitch: 0.34, dist: 9.6 },
    { yaw: 1.2, pitch: 0.28, dist: 8.4 },
    null,
    { yaw: 0.2, pitch: 1.02, dist: 46 },
  ];
  const START_LON = -80.32;
  const JUNGLE = { rainforest: 1, mountain: 1, tropical: 0.6 };
  const OPEN = { grassland: 1, savanna: 1, highland: 1, andes: 1, volcanic: 0.4 };
  const weatherToast = (state) => state === 'cloudy'
    ? [ED.i18n.t('wCloudy'), '']
    : state === 'storm'
      ? [ED.i18n.t('wStorm'), ED.i18n.t('wStormSub')]
      : [ED.i18n.t('wClear'), ''];

  const SAVE_KEY = 'equator-drive-v1';
  const state = {
    dist: 0, originDist: 0, anchorDist: 0, anchorLon: START_LON,
    scaleIdx: 2, scale: SCALES[2], timeIdx: 2,
    utc: 7 - START_LON / 15, geoKm: 0,
  };
  const stamps = new Set();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { saved = null; }
  if (saved && typeof saved.anchorLon === 'number') {
    state.dist = saved.dist || 0;
    state.anchorDist = saved.anchorDist || 0;
    state.anchorLon = saved.anchorLon;
    state.originDist = state.dist;
    const idx = SCALES.indexOf(saved.scale);
    state.scaleIdx = idx >= 0 ? idx : (saved.scaleIdx ?? 2);
    state.scale = SCALES[state.scaleIdx] || SCALES[2];
    state.utc = typeof saved.utc === 'number' ? saved.utc : state.utc;
    state.geoKm = saved.geoKm || 0;
    state.loopsCelebrated = saved.loopsCelebrated || 0;
    (saved.stamps || []).forEach((name) => stamps.add(name));
  }
  if (!state.loopsCelebrated) state.loopsCelebrated = Math.floor((state.geoKm || 0) / geo.EQUATOR_KM);
  const JOURNAL_KEY = 'equator-drive-journal';
  let photos = [];
  try { photos = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); } catch (e) { photos = []; }
  if (!Array.isArray(photos)) photos = [];
  let playing = false;
  let hold = null;

  // ---------- 渲染器与场景 ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  document.getElementById('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 6000);

  const world = new ED.World(scene, renderer, state);
  const car = new ED.Vehicle();
  if (saved && saved.vehicle) car.setType(saved.vehicle);
  if (saved && typeof saved.anchorLon === 'number') {
    car.autopilot = saved.autopilot !== false;
    car.speed = Math.min(car.spec.max, saved.speed || car.spec.cruise);
    car.cruise = car.speed;
  }
  scene.add(car.group);
  world.updateChunks(Infinity);
  const weather = new ED.Weather(scene);
  const audio = new ED.AudioSys();
  const sealife = new ED.SeaLife(scene, world, (t, s) => toast(t, s));
  const traffic = new ED.Traffic(scene, world);
  const composer = new ED.Composer(renderer);

  // ---------- 输入 ----------
  const keys = { up: false, down: false, left: false, right: false };
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  let camMode = 0, camYaw = 0, camPitch = CAM_PRESET[0].pitch, camZoom = 1, camBefore = 0;
  let hudHidden = false, photoMode = false, photoShot = false, stripMode = false;

  function startAudio() {
    audio.start();
    hudTimer = 0;
  }

  window.addEventListener('keydown', (e) => {
    if (!playing) return;
    if (e.code === 'Escape' && hold === 'journal') { closeJournal(); return; }
    if (e.code === 'Escape' && hold === 'finish') { closeFinish(); return; }
    if (e.code === 'KeyJ') { if (hold === 'journal') closeJournal(); else openJournal(); return; }
    if (hold) return;
    startAudio();
    const k = KEYMAP[e.code];
    if (k) {
      e.preventDefault();
      if (!e.repeat && (k === 'left' || k === 'right')) car.changeLane(k === 'left' ? -1 : 1);
      keys[k] = true;
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); car.toggleAutopilot(); }
    else if (e.code === 'KeyC') {
      camMode = (camMode + 1) % CAM_NAMES.length;
      const preset = CAM_PRESET[camMode];
      camYaw = preset ? preset.yaw : 0;
      camPitch = preset ? preset.pitch : 0;
      camZoom = 1;
      toast(camName(camMode), camMode === 2 ? ED.i18n.t('camFp') : ED.i18n.t('camOrbit'));
    }
    else if (e.code === 'KeyV') {
      car.toggleType();
      toast(ED.i18n.t('boarded', { name: ED.i18n.t(car.type === 'bike' ? 'vehicleBike' : 'vehicleCar') }), car.type === 'bike' ? ED.i18n.t('bikeHint') : '');
    }
    else if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5)) - 1;
      if (n >= 0 && n < SCALES.length) setScale(n);
    }
    else if (e.code === 'KeyT') {
      state.timeIdx = (state.timeIdx + 1) % TIME_SPEEDS.length;
      toast(TIME_SPEEDS[state.timeIdx] ? ED.i18n.t('timeFlow', { n: TIME_SPEEDS[state.timeIdx] }) : ED.i18n.t('timePause'));
    }
    else if (e.code === 'KeyR') { weather.cycle(); prevWeather = weather.state; toast(ED.i18n.t('weatherNow', { name: weather.name })); }
    else if (e.code === 'KeyM') toast(audio.toggleMute() ? ED.i18n.t('soundOn') : ED.i18n.t('soundOff'));
    else if (e.code === 'KeyB') toast(audio.toggleMusic() ? ED.i18n.t('musicOn') : ED.i18n.t('musicOff'));
    else if (e.code === 'KeyN') jumpToNextLand();
    else if (e.code === 'KeyP') {
      if (!photoMode) {
        photoMode = true;
        document.body.classList.add('hud-hidden');
        toast(ED.i18n.t('photo'), ED.i18n.t('photoHint'));
      } else photoShot = true;
    }
    else if (e.code === 'KeyG') setStrip(!stripMode);
    else if (e.code === 'Escape') {
      if (photoMode) { photoMode = false; if (!hudHidden) document.body.classList.remove('hud-hidden'); }
      else if (stripMode) setStrip(false);
    }
    else if (e.code === 'KeyH') {
      hudHidden = !hudHidden;
      document.body.classList.toggle('hud-hidden', hudHidden || photoMode);
    }
    else if (e.code === 'KeyF') {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });

  let dragging = false, lastX = 0, lastY = 0;
  const clampPitch = (v, a, b) => Math.min(b, Math.max(a, v));
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!playing || hold) return;
    startAudio();
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging || stripMode) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    camYaw -= dx * 0.005;
    camPitch = camMode === 2
      ? clampPitch(camPitch - dy * 0.003, -0.55, 0.7)
      : clampPitch(camPitch - dy * 0.003, 0.08, 1.2);
  });
  renderer.domElement.addEventListener('wheel', (e) => {
    camZoom = Math.min(3, Math.max(0.5, camZoom * (e.deltaY > 0 ? 1.1 : 0.9)));
  }, { passive: true });

  function resize() {
    const height = stripMode ? 220 : window.innerHeight;
    camera.aspect = window.innerWidth / height;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, height);
    composer.setSize(renderer.domElement.width, renderer.domElement.height);
    drawMinimap();
  }
  window.addEventListener('resize', resize);

  function setStrip(on) {
    stripMode = on;
    document.body.classList.toggle('strip-mode', on);
    if (on) {
      camBefore = camMode;
      camMode = 1;
      car.autopilot = true;
      toast(ED.i18n.t('stripToast'), ED.i18n.t('stripToastSub'));
    } else {
      camMode = camBefore;
    }
    resize();
  }

  function saveGame() {
    if (!playing) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        dist: state.dist, anchorDist: state.anchorDist, anchorLon: state.anchorLon,
        scale: state.scale, scaleIdx: state.scaleIdx, utc: state.utc, geoKm: state.geoKm,
        vehicle: car.type, autopilot: car.autopilot, speed: car.speed,
        stamps: [...stamps], loopsCelebrated: state.loopsCelebrated || 0,
      }));
    } catch (e) { /* 隐私模式或本地文件受限时忽略 */ }
  }
  window.addEventListener('beforeunload', saveGame);

  function reanchor() {
    state.anchorLon = world.lonAt(state.dist);
    state.anchorDist = state.dist;
  }

  function setScale(n) {
    reanchor();
    state.scaleIdx = n;
    state.scale = SCALES[n];
    world.rebuildAll();
    toast(n === 0 ? ED.i18n.t('scaleReal') : ED.i18n.t('scaleMul', { n: state.scale }),
      ED.i18n.t('scaleEta', { time: formatDuration(geo.EQUATOR_KM / state.scale / Math.max(car.speed * 3.6, 20)) }));
  }

  function jumpToNextLand() {
    const lon = world.lonAt(state.dist);
    const target = geo.nextLandStart(lon);
    state.anchorLon = target - 500 * state.scale / geo.M_PER_DEG;
    state.anchorDist = state.dist;
    world.rebuildAll();
    prevLon = world.lonAt(state.dist);
    const a = geo.AREAS[geo.areaIndex(target + 0.01)];
    toast(ED.i18n.t('jump'), ED.i18n.t('jumpSoon', { place: geo.localName(a[2], a[3]) }));
  }

  function formatDuration(hours) {
    if (hours < 1) return ED.i18n.t('durMin', { n: Math.round(hours * 60) });
    if (hours < 48) return ED.i18n.t('durHour', { n: hours.toFixed(1) });
    return ED.i18n.t('durDay', { n: (hours / 24).toFixed(1) });
  }

  // ---------- 提示 ----------
  const toastEl = document.getElementById('toast');
  const toastQueue = [];
  let toastTimer = 0;
  function toast(title, sub = '') {
    toastQueue.push({ title, sub });
    if (toastQueue.length > 4) toastQueue.splice(0, toastQueue.length - 4);
  }
  function updateToast(dt) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      if (toastQueue.length) {
        const t = toastQueue.shift();
        toastEl.innerHTML = `<div class="t">${t.title}</div>${t.sub ? `<div class="s">${t.sub}</div>` : ''}`;
        toastEl.classList.add('show');
        toastTimer = 3.4;
      } else {
        toastEl.classList.remove('show');
      }
    }
  }

  // ---------- 小地图 ----------
  const mini = document.getElementById('minimap');
  const marker = document.getElementById('marker');
  function drawMinimap() {
    const dpr = window.devicePixelRatio || 1;
    mini.width = mini.clientWidth * dpr;
    mini.height = mini.clientHeight * dpr;
    const g = mini.getContext('2d');
    const W = mini.width, H = mini.height;
    g.fillStyle = '#2a6f9e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7fbf55';
    for (const [a, b] of geo.LAND) {
      const x0 = (a + 180) / 360 * W, x1 = (b + 180) / 360 * W;
      g.fillRect(x0, 0, Math.max(1.5 * dpr, x1 - x0), H);
    }
  }
  drawMinimap();

  // ---------- HUD ----------
  const $ = (id) => document.getElementById(id);
  const hud = {
    zh: $('region-zh'), en: $('region-en'), coord: $('coord'), time: $('localtime'), next: $('nextland'),
    speed: $('speed'), mode: $('mode'), km: $('km'), pct: $('pct'), bar: $('bar'),
    scale: $('scale'), tspeed: $('tspeed'), weather: $('weather'), sound: $('sound'),
    stamps: $('stamps'), strip: $('strip-label'),
  };
  let hudTimer = 0;
  let overSea = false;
  function updateHud(lon, solar) {
    const a = geo.AREAS[geo.areaIndex(lon)];
    const enUI = ED.i18n.lang === 'en';
    hud.zh.textContent = geo.localName(a[2], a[3]);
    hud.en.textContent = enUI ? '' : a[3];
    hud.coord.textContent = `0°00′00″ · ${geo.formatLon(lon)}`;
    const hh = Math.floor(solar), mm = Math.floor((solar - hh) * 60);
    hud.time.textContent = ED.i18n.t('localTime', { hh: String(hh).padStart(2, '0'), mm: String(mm).padStart(2, '0') });
    if (overSea) {
      const target = geo.nextLandStart(lon);
      const km = Math.round((target - geo.normLon(lon)) * 111.32);
      const destA = geo.AREAS[geo.areaIndex(target + 0.01)];
      hud.next.textContent = ED.i18n.t('nextLand', { km: km.toLocaleString(), place: geo.localName(destA[2], destA[3]) });
      hud.next.style.display = '';
    } else {
      hud.next.style.display = 'none';
    }
    hud.speed.textContent = Math.round(car.speed * 3.6);
    const vehicle = ED.i18n.t(car.type === 'bike' ? 'vehicleBike' : 'vehicleCar');
    const drive = ED.i18n.t(car.type === 'bike' ? 'driveBike' : 'driveCar');
    hud.mode.textContent = car.autopilot
      ? ED.i18n.t('modeAuto', { vehicle, drive, speed: Math.round(car.cruise * 3.6) })
      : ED.i18n.t('modeManual', { vehicle, drive });
    hud.mode.classList.toggle('on', car.autopilot);
    const lap = Math.floor(state.geoKm / geo.EQUATOR_KM);
    const loopKm = state.geoKm - lap * geo.EQUATOR_KM;
    const pct = loopKm / geo.EQUATOR_KM * 100;
    hud.km.textContent = lap > 0
      ? ED.i18n.t('lap', { n: lap + 1, km: Math.round(loopKm).toLocaleString() })
      : `${Math.round(state.geoKm).toLocaleString()} km`;
    hud.pct.textContent = `${pct.toFixed(2)}%`;
    hud.bar.style.width = `${Math.min(100, pct)}%`;
    hud.scale.textContent = state.scale === 1 ? ED.i18n.t('scaleHudReal') : `×${state.scale}`;
    hud.tspeed.textContent = TIME_SPEEDS[state.timeIdx] ? `×${TIME_SPEEDS[state.timeIdx]}` : ED.i18n.t('paused');
    hud.stamps.textContent = `${stamps.size} / ${geo.STAMP_TOTAL}`;
    if (hud.strip) hud.strip.textContent = `${geo.localName(a[2], a[3])}  ·  ${Math.round(car.speed * 3.6)} km/h  ·  ${Math.round(state.geoKm).toLocaleString()} km`;
    hud.weather.textContent = weather.name;
    hud.sound.textContent = !audio.started ? ED.i18n.t('soundNeed') : audio.muted ? ED.i18n.t('soundOffShort') : (audio.musicOn ? ED.i18n.t('soundMusic') : ED.i18n.t('soundNoMusic'));
    marker.style.left = `${(geo.normLon(lon) + 180) / 360 * 100}%`;
  }

  // ---------- 相机 ----------
  const camOff = new THREE.Vector3(0, 3.1, 8.5);
  const lookOff = new THREE.Vector3(0, 1.3, -4);
  const _off = new THREE.Vector3(), _look = new THREE.Vector3(), _tmp = new THREE.Vector3();
  function rotY(v, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return v.set(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
  }
  function updateCamera(dt) {
    const z = camZoom;
    const bike = car.type === 'bike';
    let snap = false;
    if (stripMode) {
      _off.set(bike ? -9 : 15, 3.6, -2);
      _look.set(0, 1.2, -8);
    } else if (camMode === 2) {
      const eye = bike ? _tmp.set(0, 1.82, -0.3) : _tmp.set(-0.38, 1.45, 0.3);
      _off.copy(eye).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.group.rotation.y);
      _look.set(eye.x - Math.sin(camYaw) * 40, eye.y + Math.sin(camPitch) * 28, -Math.cos(camYaw) * 40);
      snap = true;
    } else {
      const preset = CAM_PRESET[camMode];
      const dist = preset.dist * (camMode === 0 && bike ? 0.68 : 1) * z;
      const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
      _off.set(Math.sin(camYaw) * cp * dist, sp * dist, Math.cos(camYaw) * cp * dist);
      _look.set(0, camMode === 3 ? 0.6 : 1.05, -1.2);
    }
    const k = snap ? 1 : 1 - Math.exp(-dt * 4);
    camOff.lerp(_off, k);
    lookOff.lerp(_look, k);
    const p = car.group.position;
    camera.position.copy(p).add(camOff);
    camera.position.y = Math.max(camera.position.y, 0.6);
    camera.lookAt(_tmp.copy(p).add(lookOff));
  }

  // ---------- 进度事件 ----------
  let prevLon = world.lonAt(state.dist);
  let prevArea = -1;
  let prevWeather = weather.state;
  function metersAhead(target, fromLon) {
    return geo.normLon(target - fromLon) * geo.M_PER_DEG / state.scale;
  }
  function crossed(T, from, to) {
    const a = geo.normLon(T - from), b = geo.normLon(T - to);
    return a > 0 && b <= 0 && a < 10;
  }
  function checkEvents(lon) {
    const ai = geo.areaIndex(lon);
    if (ai !== prevArea) {
      const a = geo.AREAS[ai];
      const prevName = prevArea >= 0 ? geo.AREAS[prevArea][2] : null;
      if (a[2] !== prevName) {
        const sea = /洋|海|湾|湖|峡/.test(a[2]);
        toast(`${sea ? ED.i18n.t('enterSea') : ED.i18n.t('enter')} ${geo.localName(a[2], a[3])}`, ED.i18n.lang === 'en' ? '' : a[3]);
        const stamp = geo.stampFor(a[2]);
        if (stamp && !stamps.has(stamp)) {
          stamps.add(stamp);
          toast(ED.i18n.t('stamp'), `${geo.stampLabel(stamp)} · ${stamps.size} / ${geo.STAMP_TOTAL}`);
          saveGame();
        }
      }
      prevArea = ai;
    }
    for (const [rlon, , rzh, ren] of geo.RIVERS) {
      if (crossed(rlon, prevLon, lon)) toast(ED.i18n.t('cross', { name: geo.localName(rzh, ren) }), ED.i18n.lang === 'en' ? '' : ren);
    }
    for (const [cl, lat, zh, en] of geo.CITIES) {
      if (!crossed(cl, prevLon, lon)) continue;
      const km = Math.round(Math.abs(lat) * 111.3);
      toast(geo.localName(zh, en), km < 3 ? ED.i18n.t('cityOnLine') : ED.i18n.t('cityOffset', { side: ED.i18n.t(lat > 0 ? 'north' : 'south'), km }));
    }
    for (const [ll, , lx, name] of geo.LANDMARKS) {
      const ahead = metersAhead(ll, lon);
      const prevAhead = metersAhead(ll, prevLon);
      const lead = Math.abs(lx) > 80 ? 480 : 200;
      if (prevAhead > lead && ahead <= lead && ahead > 30) {
        toast(geo.landmarkLabel(name), Math.abs(lx) > 80 ? ED.i18n.t('landmarkSide') : ED.i18n.t('landmarkRoad'));
      }
    }
    prevLon = lon;
    if (weather.state !== prevWeather) {
      const [t, s] = weatherToast(weather.state);
      toast(t, s);
      prevWeather = weather.state;
    }
  }

  // ---------- 出发、手册、跑完一圈 ----------
  function saveJournal() {
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(photos));
    } catch (e) {
      if (photos.length > 1) {
        photos.shift();
        try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(photos)); return; } catch (e2) { /* 下面提示 */ }
      }
      photos.pop();
      toast(ED.i18n.t('journalFull'), ED.i18n.t('journalFullSub'));
    }
  }

  function rememberPhoto(dataUrl) {
    const lon = world.lonAt(state.dist);
    const area = geo.AREAS[geo.areaIndex(lon)];
    const place = area[2];
    photos.push({ src: dataUrl, place, km: Math.round(state.geoKm), t: Date.now() });
    while (photos.length > 16) photos.shift();
    saveJournal();
  }

  function renderJournal() {
    const stampsEl = $('journal-stamps');
    const photosEl = $('journal-photos');
    stampsEl.innerHTML = stamps.size
      ? [...stamps].map((s) => `<span class="stamp">${geo.stampLabel(s)}</span>`).join('')
      : `<div class="empty">${ED.i18n.t('journalEmptyStamps')}</div>`;
    photosEl.innerHTML = photos.length
      ? photos.map((p) => {
        const row = geo.AREAS.find((a) => a[2] === p.place);
        const place = geo.localName(p.place, row ? row[3] : p.place);
        return `<figure><img src="${p.src}" alt=""><figcaption>${place} · ${Number(p.km).toLocaleString()} km</figcaption></figure>`;
      }).join('')
      : `<div class="empty">${ED.i18n.t('journalEmptyPhotos')}</div>`;
  }

  function openJournal() {
    if (!playing || hold === 'finish') return;
    hold = 'journal';
    renderJournal();
    $('journal').classList.add('show');
  }
  function closeJournal() {
    if (hold !== 'journal') return;
    hold = null;
    $('journal').classList.remove('show');
  }
  function closeFinish() {
    if (hold !== 'finish') return;
    hold = null;
    $('finish').classList.remove('show');
  }

  function checkLoop() {
    const n = Math.floor(state.geoKm / geo.EQUATOR_KM);
    if (n <= (state.loopsCelebrated || 0)) return;
    state.loopsCelebrated = n;
    hold = 'finish';
    $('finish-text').textContent = ED.i18n.t('finishBody', {
      n, km: Math.round(state.geoKm).toLocaleString(),
      stamps: `${stamps.size} / ${geo.STAMP_TOTAL}`, photos: photos.length,
    });
    $('finish').classList.add('show');
    saveGame();
  }

  function beginAt(lon) {
    state.dist = 0;
    state.originDist = 0;
    state.anchorDist = 0;
    state.anchorLon = lon;
    state.geoKm = 0;
    state.loopsCelebrated = 0;
    state.utc = ((8 - lon / 15) % 24 + 24) % 24;
    car.speed = car.spec.cruise;
    car.cruise = car.spec.cruise;
    car.x = 0;
    prevLon = lon;
    prevArea = -1;
    traffic.clear();
    world.rebuildAll();
    startPlaying(false);
  }

  function continueTrip() {
    prevLon = world.lonAt(state.dist);
    prevArea = geo.areaIndex(prevLon);
    startPlaying(true);
  }

  function startPlaying(continued) {
    playing = true;
    $('gate').classList.add('hidden');
    if (continued) {
      toast(ED.i18n.t('resume'), ED.i18n.t('resumeSub', {
        km: Math.round(state.geoKm).toLocaleString(),
        stamps: `${stamps.size} / ${geo.STAMP_TOTAL}`,
      }));
    }
    toast(ED.i18n.t('soundHint'), '');
    saveGame();
  }

  const hasSave = !!(saved && typeof saved.anchorLon === 'number');
  $('go-continue').hidden = !hasSave;
  $('go-continue').addEventListener('click', () => { startAudio(); continueTrip(); });
  document.querySelectorAll('#gate .starts button').forEach((btn) => {
    btn.addEventListener('click', () => { startAudio(); beginAt(Number(btn.dataset.lon)); });
  });
  $('journal-close').addEventListener('click', closeJournal);
  $('finish-go').addEventListener('click', closeFinish);
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.addEventListener('click', () => ED.i18n.setLang(btn.dataset.setLang));
  });
  ED.i18n.onChange(() => {
    world.rebuildAll();
    if (hold === 'journal') renderJournal();
    hudTimer = 0;
  });
  ED.i18n.applyDom();

  // ---------- 主循环 ----------
  const clock = new THREE.Clock();
  let elapsed = 0;
  let saveTimer = 0;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const simulating = playing && !hold;

    if (simulating) {
      car.update(dt, keys);
      state.dist += car.speed * dt;
      state.geoKm += car.speed * dt * state.scale / 1000;
      state.utc = (state.utc + dt * TIME_SPEEDS[state.timeIdx] / 3600) % 24;
      if (state.dist - state.originDist > 2000) world.rebase(state.dist);
    }

    const lon = world.lonAt(state.dist);
    const solar = (((state.utc + geo.normLon(lon) / 15) % 24) + 24) % 24;
    const here = geo.sample(lon, world.rampDeg());
    const land = here.land;
    const biome = here.biome;
    overSea = land < 0.02;

    const carZ = -(state.dist - state.originDist);
    car.group.position.set(car.x, ROAD_Y, carZ);
    updateCamera(simulating ? dt : 0.016);

    if (simulating) {
      const thunder = weather.update(dt, { solar, biome, camPos: camera.position, carSpeed: car.speed });
      if (thunder) audio.thunder(thunder.delay, thunder.strength);
      Object.assign(world.weather, { overcast: weather.overcast, rain: weather.rain, wet: weather.wet, flash: weather.flash });
    }
    world.update(simulating ? dt : 0, car.group.position, camera.position, solar);
    if (simulating) {
      sealife.update(dt, state.dist, carZ, car.speed);
      traffic.update(dt, carZ, car.x);
      const night = 1 - Math.min(1, Math.max(0, (world.sunDir.y + 0.04) / 0.16));
      car.setLights(Math.max(night, weather.overcast * weather.rain * 0.7));
      audio.update(dt, {
        speed: car.speed, vehicle: car.type, water: 1 - land, land,
        jungle: (JUNGLE[biome] || 0) * land, open: (OPEN[biome] || 0) * land,
        day: world.dayK, rain: weather.rain,
      });
      checkEvents(lon);
      checkLoop();
    }

    updateToast(dt);
    hudTimer -= dt;
    if (hudTimer <= 0) { updateHud(lon, solar); hudTimer = 0.12; }

    composer.render(scene, camera);
    if (photoShot) {
      photoShot = false;
      const src = renderer.domElement;
      const link = document.createElement('a');
      link.href = src.toDataURL('image/png');
      link.download = `equator-${Date.now()}.png`;
      link.click();
      const thumb = document.createElement('canvas');
      thumb.width = 360;
      thumb.height = Math.max(1, Math.round(src.height * 360 / src.width));
      thumb.getContext('2d').drawImage(src, 0, 0, thumb.width, thumb.height);
      rememberPhoto(thumb.toDataURL('image/jpeg', 0.68));
      toast(ED.i18n.t('photoSaved'), ED.i18n.t('photoSavedSub'));
    }
    if (simulating) {
      saveTimer += dt;
      if (saveTimer > 20) { saveTimer = 0; saveGame(); }
    }
  }
  frame();

  ED.debug = {
    state, world, car, camera, weather, sealife, audio, traffic, composer, setScale, jumpToNextLand,
    setCam: (m) => {
      camMode = m;
      const preset = CAM_PRESET[m];
      if (preset) { camYaw = preset.yaw; camPitch = preset.pitch; }
    },
    setStrip, saveGame, stamps, photos,
    go: (lon) => beginAt(lon),
    resume: () => continueTrip(),
    openJournal, closeJournal,
    forceLoop() {
      state.geoKm = geo.EQUATOR_KM * ((state.loopsCelebrated || 0) + 1) - 0.02;
    },
  };
})(window.ED);
