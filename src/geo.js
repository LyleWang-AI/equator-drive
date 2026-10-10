// 赤道沿线地理数据：经度区间、地形类型、城市与地标
window.ED = window.ED || {};

(function (ED) {
  const M_PER_DEG = 40075016.686 / 360;
  const EQUATOR_KM = 40075.017;

  // 国家 / 海域（自西向东覆盖 -180 ~ 180）
  const AREAS = [
    [-180, -91.65, '太平洋', 'Pacific Ocean'],
    [-91.65, -91.1, '加拉帕戈斯群岛（厄瓜多尔）', 'Galápagos Islands, Ecuador'],
    [-91.1, -80.08, '太平洋', 'Pacific Ocean'],
    [-80.08, -75.35, '厄瓜多尔', 'Ecuador'],
    [-75.35, -70.05, '哥伦比亚', 'Colombia'],
    [-70.05, -49.95, '巴西', 'Brazil'],
    [-49.95, 6.45, '大西洋', 'Atlantic Ocean'],
    [6.45, 6.6, '圣多美和普林西比', 'São Tomé and Príncipe'],
    [6.6, 9.3, '几内亚湾', 'Gulf of Guinea'],
    [9.3, 13.95, '加蓬', 'Gabon'],
    [13.95, 17.75, '刚果（布）', 'Republic of the Congo'],
    [17.75, 29.7, '刚果（金）', 'DR Congo'],
    [29.7, 32.2, '乌干达', 'Uganda'],
    [32.2, 34.05, '维多利亚湖', 'Lake Victoria'],
    [34.05, 40.99, '肯尼亚', 'Kenya'],
    [40.99, 42.55, '索马里', 'Somalia'],
    [42.55, 72.9, '印度洋', 'Indian Ocean'],
    [72.9, 73.6, '马尔代夫海域', 'Maldives'],
    [73.6, 99.25, '印度洋', 'Indian Ocean'],
    [99.25, 104.0, '印度尼西亚 · 苏门答腊岛', 'Sumatra, Indonesia'],
    [104.0, 109.1, '卡里马塔海峡', 'Karimata Strait'],
    [109.1, 117.6, '印度尼西亚 · 加里曼丹岛', 'Borneo, Indonesia'],
    [117.6, 119.7, '望加锡海峡', 'Makassar Strait'],
    [119.7, 120.3, '印度尼西亚 · 苏拉威西岛', 'Sulawesi, Indonesia'],
    [120.3, 127.6, '马鲁古海', 'Molucca Sea'],
    [127.6, 128.4, '印度尼西亚 · 哈马黑拉岛', 'Halmahera, Indonesia'],
    [128.4, 173.3, '太平洋', 'Pacific Ocean'],
    [173.3, 173.7, '基里巴斯 · 吉尔伯特群岛', 'Gilbert Islands, Kiribati'],
    [173.7, 180, '太平洋', 'Pacific Ocean'],
  ];

  // 海上散布小岛（不压在路上）
  const ISLET_ZONES = [[72.9, 73.6], [173.3, 173.7], [-91.9, -90.2], [104.2, 105.0]];

  // 陆地区间及地形类型
  const LAND = [
    [-91.6, -91.15, 'volcanic'],
    [-80.08, -79.3, 'tropical'],
    [-79.3, -77.6, 'andes'],
    [-77.6, -49.95, 'rainforest'],
    [6.48, 6.57, 'tropical'],
    [9.3, 29.3, 'rainforest'],
    [29.3, 30.3, 'mountain'],
    [30.3, 32.2, 'grassland'],
    [34.05, 35.8, 'grassland'],
    [35.8, 37.9, 'highland'],
    [37.9, 42.55, 'savanna'],
    [99.25, 99.6, 'tropical'],
    [99.6, 100.6, 'mountain'],
    [100.6, 104.0, 'rainforest'],
    [109.1, 117.6, 'rainforest'],
    [119.7, 120.3, 'mountain'],
    [127.6, 128.4, 'rainforest'],
    [173.45, 173.5, 'tropical'],
  ];

  const BIOMES = {
    rainforest: { color: 0x2f6a2c, hill: 7, mount: 60, tree: 'jungle', density: 1.0 },
    tropical: { color: 0x5e9a3a, hill: 3, mount: 0, tree: 'palm', density: 0.55 },
    andes: { color: 0x7d8c4c, hill: 22, mount: 320, tree: 'conifer', density: 0.25, snow: true },
    mountain: { color: 0x3d6f34, hill: 16, mount: 240, tree: 'jungle', density: 0.6, snow: true },
    grassland: { color: 0x6fa040, hill: 6, mount: 30, tree: 'broadleaf', density: 0.35 },
    highland: { color: 0x8d9c52, hill: 12, mount: 160, tree: 'acacia', density: 0.25 },
    savanna: { color: 0xbfa25a, hill: 3, mount: 12, tree: 'acacia', density: 0.14 },
    volcanic: { color: 0x3b3531, hill: 9, mount: 180, tree: 'cactus', density: 0.12 },
  };

  // 城市：经度、纬度、中文名、英文名
  const CITIES = [
    [-78.47, -0.18, '基多', 'Quito'],
    [-77.99, 0.03, '卡扬贝', 'Cayambe'],
    [-51.07, 0.03, '马卡帕', 'Macapá'],
    [9.45, 0.39, '利伯维尔', 'Libreville'],
    [18.26, 0.05, '姆班达卡', 'Mbandaka'],
    [25.19, 0.52, '基桑加尼', 'Kisangani'],
    [32.58, 0.35, '坎帕拉', 'Kampala'],
    [34.76, -0.09, '基苏木', 'Kisumu'],
    [36.82, -1.29, '内罗毕', 'Nairobi'],
    [37.07, 0.01, '纳纽基', 'Nanyuki'],
    [42.54, -0.36, '基斯马尤', 'Kismayo'],
    [100.2, 0.0, '邦卓尔', 'Bonjol'],
    [103.82, 1.35, '新加坡', 'Singapore'],
    [109.33, -0.03, '坤甸', 'Pontianak'],
    [117.5, 0.13, '邦坦', 'Bontang'],
  ];

  // 赤道穿过的大河：经度、河面宽度（米）、中文名、英文名
  const RIVERS = [
    [-50.35, 14000, '亚马孙河', 'Amazon River'],
    [18.27, 7000, '刚果河', 'Congo River'],
    [25.02, 2200, '刚果河上游', 'Upper Congo'],
  ];

  // 可盖章的国家（海域不计入，群岛并入所属国）
  const STAMP_TOTAL = 12;
  function stampFor(areaZh) {
    if (/印度尼西亚/.test(areaZh)) return '印度尼西亚';
    if (/加拉帕戈斯/.test(areaZh)) return '厄瓜多尔';
    if (/洋|海|湾|湖|峡/.test(areaZh)) return null;
    return areaZh;
  }

  // 民居风格：按地形和经度区分安第斯、亚马孙、非洲、印尼
  function houseStyle(lon, biome) {
    if (!biome || biome === 'volcanic') return null;
    if (biome === 'andes') return 'colonial';
    if (lon > 95 && (biome === 'rainforest' || biome === 'tropical' || biome === 'mountain')) return 'stilt';
    if (lon < 0 && biome === 'rainforest') return 'maloca';
    if (biome === 'rainforest' || biome === 'savanna' || biome === 'grassland' || biome === 'highland') return 'hut';
    return null;
  }

  // 按地形和所在大陆选动物。经度用来区分亚马孙、刚果和印尼的雨林。
  function animalsFor(biome, lon) {
    if (biome === 'savanna') return ['elephant', 'giraffe', 'zebra'];
    if (biome === 'grassland') return ['zebra', 'cow', 'cow'];
    if (biome === 'highland') return ['cow', 'zebra'];
    if (biome === 'andes') return ['llama', 'llama'];
    if (biome === 'volcanic') return ['tortoise', 'iguana'];
    if (biome === 'tropical') return ['iguana', 'iguana'];
    if (biome === 'rainforest' || biome === 'mountain') {
      if (lon < -5) return ['capybara', 'tapir', 'capybara'];
      if (lon < 95) return ['gorilla', 'gorilla'];
      return ['orangutan', 'orangutan'];
    }
    return null;
  }

  // 地标：经度、类型、横向位置（负为北侧/左侧）、名称
  const LANDMARKS = [
    [-91.36, 'volcano', -200, '沃尔夫火山|Wolf Volcano'],
    [-78.456, 'mitad', 22, '赤道纪念碑|Mitad del Mundo'],
    [-77.986, 'snowpeak', -210, '卡扬贝火山|Cayambe, snow on the equator'],
    [-51.07, 'obelisk', -16, '赤道零点纪念碑|Marco Zero'],
    [29.87, 'snowpeak', -230, '鲁文佐里山|Rwenzori'],
    [32.03, 'rings', 0, '赤道环|Kayabwe Equator Monument'],
    [37.31, 'snowpeak', 220, '肯尼亚山|Mount Kenya'],
    [100.21, 'globe', 16, '邦卓尔赤道纪念碑|Bonjol Equator Monument'],
    [109.32, 'tugu', -16, '坤甸赤道纪念碑|Tugu Khatulistiwa'],
  ];

  function localName(zh, en) {
    return ED.i18n && ED.i18n.lang === 'en' ? (en || zh) : zh;
  }

  function landmarkLabel(name) {
    const i = name.indexOf('|');
    if (i < 0) return name;
    return localName(name.slice(0, i), name.slice(i + 1));
  }

  const STAMP_EN = {
    '厄瓜多尔': 'Ecuador',
    '哥伦比亚': 'Colombia',
    '巴西': 'Brazil',
    '圣多美和普林西比': 'São Tomé and Príncipe',
    '加蓬': 'Gabon',
    '刚果（布）': 'Republic of the Congo',
    '刚果（金）': 'DR Congo',
    '乌干达': 'Uganda',
    '肯尼亚': 'Kenya',
    '索马里': 'Somalia',
    '印度尼西亚': 'Indonesia',
    '基里巴斯 · 吉尔伯特群岛': 'Kiribati',
  };

  function stampLabel(name) {
    return localName(name, STAMP_EN[name] || name);
  }

  function normLon(lon) {
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return lon;
  }

  function areaIndex(lon) {
    lon = normLon(lon);
    for (let i = 0; i < AREAS.length; i++) {
      if (lon >= AREAS[i][0] && lon < AREAS[i][1]) return i;
    }
    return 0;
  }

  function inIsletZone(lon) {
    lon = normLon(lon);
    return ISLET_ZONES.some(([a, b]) => lon >= a && lon < b);
  }

  // 返回该经度处的陆地权重与混合后的地形参数。ramp 为海陆 / 地形过渡宽度（度）
  const _color = new THREE.Color();
  const _tmp = new THREE.Color();
  function sample(lon, ramp) {
    lon = normLon(lon);
    let land = 0, hill = 0, mount = 0, density = 0, snow = 0;
    let best = null, bestW = 0;
    _color.setRGB(0, 0, 0);
    for (let i = 0; i < LAND.length; i++) {
      const [a, b, type] = LAND[i];
      if (lon < a - ramp || lon > b + ramp) continue;
      const w = Math.min(1, Math.max(0, (lon - a) / ramp + 0.5)) *
        Math.min(1, Math.max(0, (b - lon) / ramp + 0.5));
      if (w <= 0) continue;
      const p = BIOMES[type];
      land += w;
      hill += p.hill * w;
      mount += p.mount * w;
      density += p.density * w;
      snow += (p.snow ? 1 : 0) * w;
      _tmp.setHex(p.color);
      _color.r += _tmp.r * w; _color.g += _tmp.g * w; _color.b += _tmp.b * w;
      if (w > bestW) { bestW = w; best = type; }
    }
    if (land > 0) {
      const k = 1 / land;
      hill *= k; mount *= k; density *= k; snow *= k;
      _color.r *= k; _color.g *= k; _color.b *= k;
    }
    return { land: Math.min(1, land), hill, mount, density, snow, color: _color, biome: best };
  }

  // 自当前经度向东，找到下一段陆地的起点
  function nextLandStart(lon) {
    lon = normLon(lon);
    let best = null, bestDelta = Infinity;
    for (const [a] of LAND) {
      let delta = a - lon;
      if (delta <= 0.05) delta += 360;
      if (delta < bestDelta) { bestDelta = delta; best = a; }
    }
    return lon + bestDelta;
  }

  function formatLon(lon) {
    lon = normLon(lon);
    const hemi = lon >= 0 ? 'E' : 'W';
    let v = Math.abs(lon);
    const d = Math.floor(v); v = (v - d) * 60;
    const m = Math.floor(v); const s = Math.floor((v - m) * 60);
    return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″ ${hemi}`;
  }

  ED.geo = {
    M_PER_DEG, EQUATOR_KM, AREAS, LAND, BIOMES, CITIES, LANDMARKS, RIVERS, STAMP_TOTAL,
    normLon, areaIndex, inIsletZone, sample, nextLandStart, formatLon, stampFor, houseStyle, animalsFor,
    localName, landmarkLabel, stampLabel,
  };
})(window.ED);
