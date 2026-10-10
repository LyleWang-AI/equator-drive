// 界面语言。存档里的护照名仍用中文，显示时再翻译。
window.ED = window.ED || {};

(function (ED) {
  const KEY = 'equator-drive-lang';
  const DICT = {
    zh: {
      title: '赤道公路',
      lead: '沿着赤道向东开。海洋占了大部分，陆地上会经过十一个国家。',
      continue: '继续上次的旅程',
      startEc: '厄瓜多尔', startEcSub: '从海岸进城',
      startKe: '肯尼亚', startKeSub: '高原和草原',
      startId: '印度尼西亚', startIdSub: '坤甸，赤道线上',
      journalTitle: '旅行手册',
      journalLead: '盖过的章和拍过的照片会留在这台浏览器里。',
      journalEmptyStamps: '还没有盖章。开进一个国家就会盖上。',
      journalEmptyPhotos: '还没有照片。按 P 进入拍照，再按一次保存。',
      close: '关闭',
      finishTitle: '绕赤道回到了起点',
      finishGo: '继续开',
      finishBody: '第 {n} 圈走完了。这一程 {km} km，护照 {stamps}，照片 {photos} 张。路还在，可以接着开。',
      stripTitle: '底部窄条',
      stripBody: '公路收在屏幕最底下，自己往前开。上面这块空出来，是让你一边做事、一边瞟风景。画面变窄是故意的，不是故障。',
      stripHint: '按 G 或 Esc 回到全屏',
      progTrip: '环赤道里程', progScale: '地理倍率', progTime: '时间流速',
      progPassport: '护照', progWeather: '天气', progSound: '声音',
      help: '<div><b>W / S</b>加速 / 减速（自动驾驶时调巡航速度）</div><div><b>A / D</b>转向 / 换车道</div><div><b>空格</b>自动驾驶 开 / 关　<b>V</b>汽车 / 自行车</div><div><b>C</b>切换视角　拖动鼠标绕着车转，滚轮远近</div><div><b>1 – 5</b>地理倍率 ×1 / 20 / 100 / 500 / 2000</div><div><b>T</b>时间流速　<b>R</b>切换天气</div><div><b>M</b>声音开关　<b>B</b>背景音乐开关</div><div><b>N</b>跳到下一段陆地　<b>P</b>拍照　<b>J</b>旅行手册</div><div><b>G</b>底部窄条</div><div><b>H</b>隐藏界面　<b>F</b>全屏　Esc 退出拍照 / 窄条 / 手册</div>',
      cam0: '追尾视角', cam1: '侧面视角', cam2: '第一人称视角', cam3: '航拍视角',
      camFp: '拖动鼠标左右转头、上下抬头', camOrbit: '拖动鼠标绕着车旋转',
      boarded: '换乘{name}', bikeHint: '慢下来，好好看看风景',
      timeFlow: '时间流速 ×{n}', timePause: '时间暂停',
      weatherNow: '天气：{name}',
      soundOn: '声音 开', soundOff: '声音 关',
      musicOn: '背景音乐 开', musicOff: '背景音乐 关',
      photo: '拍照', photoHint: '再按 P 保存到下载文件夹，Esc 退出',
      photoSaved: '照片已保存', photoSavedSub: '原图在下载文件夹，缩略图进了旅行手册',
      stripToast: '底部窄条', stripToastSub: '公路留在屏幕最底下。上面的空位是留给你做事的，不是故障',
      scaleReal: '地理倍率 ×1（真实距离）', scaleMul: '地理倍率 ×{n}',
      scaleHudReal: '×1 真实',
      scaleEta: '环赤道一周约需 {time}（按当前车速）',
      jump: '跳转', jumpSoon: '即将抵达 {place}',
      durMin: '{n} 分钟', durHour: '{n} 小时', durDay: '{n} 天',
      localTime: '当地太阳时 {hh}:{mm}',
      nextLand: '距离下一片陆地 {km} km · {place}',
      modeAuto: '{vehicle} · 自动{drive} · 巡航 {speed} km/h',
      modeManual: '{vehicle} · 手动{drive}',
      driveCar: '驾驶', driveBike: '骑行',
      vehicleCar: '汽车', vehicleBike: '自行车',
      lap: '第 {n} 圈 · {km} km',
      soundNeed: '点击画面开启', soundOffShort: '关',
      soundMusic: '开 · 音乐开', soundNoMusic: '开 · 音乐关',
      paused: '暂停',
      enter: '进入', enterSea: '驶入',
      stamp: '护照盖章',
      cross: '跨越 {name}',
      cityOnLine: '城市就在赤道线上',
      cityOffset: '位于赤道以{side} {km} km',
      north: '北', south: '南',
      landmarkSide: '就在侧前方，抬头能看见', landmarkRoad: '就在前方路边',
      journalFull: '旅行手册装不下了', journalFullSub: '这张缩略图没有留下',
      resume: '继续上次的旅程', resumeSub: '已行驶 {km} km · 护照 {stamps}',
      soundHint: '点击画面或按任意键开启声音',
      welcome: '欢迎来到', atRoadside: '就在路边', lookAhead: '看向侧前方', roadsideMark: '路边地标',
      weather_clear: '晴', weather_cloudy: '多云', weather_storm: '雷阵雨',
      wCloudy: '云层渐渐厚了起来', wStorm: '雷阵雨来了', wStormSub: '赤道午后常见的对流雷暴', wClear: '天放晴了',
      dolphin: '一群海豚出现在{side}侧', dolphinSub: '车速低于 80 km/h 时它们能跟上你',
      whale: '{side}侧海面浮起一只鲸鱼', whaleSub: '背部就在路旁边',
      left: '左', right: '右',
    },
    en: {
      title: 'Equator Drive',
      lead: 'Drive east along the equator. Most of the way is ocean. The land passes through eleven countries.',
      continue: 'Continue the last trip',
      startEc: 'Ecuador', startEcSub: 'In from the coast',
      startKe: 'Kenya', startKeSub: 'Highlands and savanna',
      startId: 'Indonesia', startIdSub: 'Pontianak, on the line',
      journalTitle: 'Travel journal',
      journalLead: 'Stamps and photos stay in this browser.',
      journalEmptyStamps: 'No stamps yet. Drive into a country and one is added.',
      journalEmptyPhotos: 'No photos yet. Press P to frame a shot, then P again to save it.',
      close: 'Close',
      finishTitle: 'Back around the equator',
      finishGo: 'Keep driving',
      finishBody: 'Loop {n} is complete. {km} km this trip, passport {stamps}, {photos} photos. The road continues.',
      stripTitle: 'Bottom strip',
      stripBody: 'The road sits along the bottom and drives itself. The space above is left open on purpose, so you can work and glance at the view. The short picture is not a glitch.',
      stripHint: 'Press G or Esc for the full view',
      progTrip: 'Loop distance', progScale: 'Distance scale', progTime: 'Time speed',
      progPassport: 'Passport', progWeather: 'Weather', progSound: 'Sound',
      help: '<div><b>W / S</b> Accelerate / brake (cruise speed while on autopilot)</div><div><b>A / D</b> Steer / change lane</div><div><b>Space</b> Autopilot　<b>V</b> Car / bicycle</div><div><b>C</b> Camera. Drag to look around, wheel to zoom</div><div><b>1 – 5</b> Distance scale ×1 / 20 / 100 / 500 / 2000</div><div><b>T</b> Time speed　<b>R</b> Weather</div><div><b>M</b> Mute　<b>B</b> Music</div><div><b>N</b> Next land　<b>P</b> Photo　<b>J</b> Journal</div><div><b>G</b> Bottom strip</div><div><b>H</b> Hide the HUD　<b>F</b> Full screen　Esc leaves photo, strip, or journal</div>',
      cam0: 'Chase view', cam1: 'Side view', cam2: 'First person', cam3: 'Aerial view',
      camFp: 'Drag to look left, right, up, and down', camOrbit: 'Drag to orbit the vehicle',
      boarded: 'Now on the {name}', bikeHint: 'Slow down and look around',
      timeFlow: 'Time speed ×{n}', timePause: 'Time paused',
      weatherNow: 'Weather: {name}',
      soundOn: 'Sound on', soundOff: 'Sound off',
      musicOn: 'Music on', musicOff: 'Music off',
      photo: 'Photo', photoHint: 'Press P again to download it. Esc cancels',
      photoSaved: 'Photo saved', photoSavedSub: 'The full image is in your downloads. A small copy is in the journal.',
      stripToast: 'Bottom strip', stripToastSub: 'The road stays at the bottom. The empty area above is there for you to work. It is not a glitch.',
      scaleReal: 'Distance scale ×1 (true distance)', scaleMul: 'Distance scale ×{n}',
      scaleHudReal: '×1 true',
      scaleEta: 'One loop takes about {time} at this speed',
      jump: 'Skip ahead', jumpSoon: 'Approaching {place}',
      durMin: '{n} min', durHour: '{n} h', durDay: '{n} days',
      localTime: 'Local solar time {hh}:{mm}',
      nextLand: 'Next land in {km} km · {place}',
      modeAuto: '{vehicle} · auto {drive} · cruise {speed} km/h',
      modeManual: '{vehicle} · manual {drive}',
      driveCar: 'drive', driveBike: 'ride',
      vehicleCar: 'Car', vehicleBike: 'Bicycle',
      lap: 'Loop {n} · {km} km',
      soundNeed: 'Click to enable sound', soundOffShort: 'Off',
      soundMusic: 'On · music on', soundNoMusic: 'On · music off',
      paused: 'Paused',
      enter: 'Entering', enterSea: 'Entering',
      stamp: 'Passport stamp',
      cross: 'Crossing the {name}',
      cityOnLine: 'The city sits on the equator',
      cityOffset: '{km} km {side} of the equator',
      north: 'north', south: 'south',
      landmarkSide: 'Ahead and off to the side. Look up', landmarkRoad: 'Just ahead, beside the road',
      journalFull: 'The journal is full', journalFullSub: 'This thumbnail was not kept',
      resume: 'Continuing the last trip', resumeSub: '{km} km driven · passport {stamps}',
      soundHint: 'Click or press any key to enable sound',
      welcome: 'Welcome to', atRoadside: 'Beside the road', lookAhead: 'Look ahead, off to the side', roadsideMark: 'Roadside landmark',
      weather_clear: 'Clear', weather_cloudy: 'Cloudy', weather_storm: 'Thunderstorm',
      wCloudy: 'The cloud is thickening', wStorm: 'A thunderstorm', wStormSub: 'Afternoon storms are common on the equator', wClear: 'The sky is clearing',
      dolphin: 'Dolphins on the {side}', dolphinSub: 'They can keep up below 80 km/h',
      whale: 'A whale surfaces on the {side}', whaleSub: 'Its back is right beside the road',
      left: 'left', right: 'right',
    },
  };

  let lang = 'zh';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh') lang = saved;
    else lang = (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch (e) { /* 隐私模式 */ }

  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) || DICT.zh[key] || key;
    if (vars) {
      Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(String(vars[k])); });
    }
    return s;
  }

  const listeners = [];
  function setLang(next) {
    if (next !== 'zh' && next !== 'en' || next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (e) { /* 忽略 */ }
    applyDom();
    listeners.forEach((fn) => fn(lang));
  }

  function applyDom() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = lang === 'zh' ? '赤道公路 Equator Drive' : 'Equator Drive';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-set-lang]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.setLang === lang);
    });
  }

  ED.i18n = {
    get lang() { return lang; },
    t, setLang, applyDom,
    onChange(fn) { listeners.push(fn); },
  };
})(window.ED);
