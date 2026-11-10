'use strict';
/* 侍無双 — 奥から押し寄せる大軍を、門で仲間を増やして なぎ倒す合戦ゲーム
   ・画面は「後ろから見た立体」: 遠くは小さく、近づくと大きく(z = 前への距離)
   ・道は3列。門は3つ並ぶ(数の門・武器の門)
   ・指(またはキーの ← →)で 左右に動かすだけ。仲間は自動で撃つ
   絵は art.js(window.ART)、音は audio.js(window.SND)。 */
(function () {
var cv = document.getElementById('game'), ctx = cv.getContext('2d');
var W = 360, H = 640, SC = 1, OX = 0, OY = 0, DPR = 1, SAFE_T = 0, SAFE_B = 0;
var CX = 180, HY = 140, SY = 500;               // 画面のまん中・地平線の高さ・仲間のいる高さ
var DT = 1 / 60;
var ROAD = 172, LANE = ROAD * 2 / 3, KX = 1.07, D0 = 320, SPAWN = 1650;
var JF = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",system-ui,sans-serif';
var NUMF = 'Dela,' + JF, BRUSH = 'Yuji,' + JF;
var SAVE_KEY = 'musou-save-v2';
var MAXSHOW = 150, MAX_SHOOT = 16;

/* ---------------- 保存 ---------------- */
var SAVE = { stage: 1, best: 0, bestStage: 0, mute: false };
try { var sv = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (sv) for (var k0 in sv) SAVE[k0] = sv[k0]; } catch (e) {}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }

/* ---------------- 小さな道具 ---------------- */
var seed = 1;
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
function rr(a, b) { return a + (b - a) * rnd(); }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function hash(k, salt) { var x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function nice(v) {
  v = Math.max(1, v);
  if (v < 20) return Math.round(v);
  if (v < 100) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 10) * 10;
  return Math.round(v / 50) * 50;
}
function fmt(n) { n = Math.floor(n); return n >= 10000 ? (Math.floor(n / 1000) / 10) + '万' : String(n); }
var KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function kan(n) {   // 1〜99 を漢数字に(第十二陣 など)
  if (n >= 100) return String(n);
  var t = Math.floor(n / 10), o = n % 10;
  return (t ? (t > 1 ? KANJI[t] : '') + '十' : '') + KANJI[o];
}
function sfx(n, v) { if (window.SND && G.timeScale <= 1) SND.sfx(n, v); }
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function rr2(a) { return (Math.random() - 0.5) * 2 * a; }

/* ---------------- 立体の計算(z は前への距離) ---------------- */
function sOf(z) { return D0 / Math.max(25, z + D0); }
function px(x, z) { return CX + x * KX * sOf(z); }
function py(z) { return HY + (SY - HY) * sOf(z); }
function fogA(z) { return clamp(1 - (z - 1050) / 600, 0, 1); }
function laneX(i) { return (i - 1) * LANE; }
function laneOf(x) { return x < -LANE / 2 ? 0 : x > LANE / 2 ? 2 : 1; }

/* ---------------- 画面の大きさ ---------------- */
var probe = document.getElementById('safe');
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  var cw = Math.max(1, Math.round(innerWidth * DPR)), ch = Math.max(1, Math.round(innerHeight * DPR));
  cv.width = cw; cv.height = ch;
  var s = cw / W, hh = ch / s;
  if (hh < 600) { s = ch / 600; H = 600; } else if (hh > 860) { H = 860; } else H = hh;
  SC = s; OX = (cw - W * s) / 2; OY = (ch - H * s) / 2;
  try {
    var cs = getComputedStyle(probe);
    SAFE_T = (parseFloat(cs.paddingTop) || 0) * DPR / s;
    SAFE_B = (parseFloat(cs.paddingBottom) || 0) * DPR / s;
  } catch (e) {}
  if (OY > 0) { SAFE_T = Math.max(0, SAFE_T - OY / s); SAFE_B = Math.max(0, SAFE_B - OY / s); }
  HY = Math.round(H * 0.2 + SAFE_T * 0.5); SY = Math.round(H * 0.79 - SAFE_B * 0.5);
  skyFor = -1;
}

/* ---------------- データ ---------------- */
// 主の武器(1つだけ持つ。同じ門をくぐると Lv が上がる)
var MAIN = {
  yumi:     { name: '弓矢',   dmg: 1.0, rate: 3.0, spd: 1100, pierce: 0, spread: 0,    splash: 0,  kind: 'arrow', shoot: 16, tier: 0 },
  shuriken: { name: '手裏剣', dmg: 1.0, rate: 4.0, spd: 950,  pierce: 1, spread: 0.07, splash: 0,  kind: 'star',  shoot: 16, tier: 1 },
  kunai:    { name: 'クナイ', dmg: 1.3, rate: 4.4, spd: 1400, pierce: 2, spread: 0.02, splash: 0,  kind: 'kunai', shoot: 16, tier: 2 },
  hiya:     { name: '火矢',   dmg: 2.0, rate: 3.0, spd: 1100, pierce: 1, spread: 0.02, splash: 20, kind: 'fire',  shoot: 14, tier: 3 },
  teppo:    { name: '火縄銃', dmg: 3.6, rate: 1.8, spd: 1800, pierce: 1, spread: 0.01, splash: 0,  kind: 'ball',  shoot: 14, tier: 4 },
  ozutsu:   { name: '大筒',   dmg: 7.0, rate: 0.85, spd: 820, pierce: 0, spread: 0.03, splash: 52, kind: 'shell', shoot: 8,  tier: 5 }
};
var MAIN_KEYS = ['yumi', 'shuriken', 'kunai', 'hiya', 'teppo', 'ozutsu'];
// 助っ人の武器(いくつでも持てる。Lv1〜3)
var SPEC = {
  bakuchiku: { name: '爆竹' }, horoku: { name: '焙烙玉' }, hanabi: { name: '花火' }, kaminari: { name: '雷' },
  fuma: { name: '風魔手裏剣' }, yoto: { name: '妖刀' }, kusarigama: { name: '鎖鎌' }
};
var SPEC_KEYS = ['bakuchiku', 'horoku', 'hanabi', 'kaminari', 'fuma', 'yoto', 'kusarigama'];
function wname(k) { return MAIN[k] ? MAIN[k].name : SPEC[k].name; }
var LVMUL = [1, 1, 1.35, 1.75];

// 敵(hb = ふつうの1発で 何発ぶんの強さか)
var ET = {
  ashigaru: { name: '足軽',     px: 50,  r: 10, hb: 1.0, spd: 32,  pow: 1, sc: 10,  steer: 40 },
  ninja:    { name: '忍',       px: 46,  r: 9,  hb: 0.8, spd: 62,  pow: 1, sc: 12,  steer: 80, weave: 1 },
  gaikotsu: { name: '骸骨武者', px: 52,  r: 10, hb: 1.6, spd: 26,  pow: 1, sc: 12,  steer: 34 },
  yurei:    { name: '怨霊',     px: 54,  r: 10, hb: 1.4, spd: 44,  pow: 1, sc: 14,  steer: 50, weave: 2, ghost: 1 },
  teppo:    { name: '鉄砲足軽', px: 50,  r: 10, hb: 1.4, spd: 24,  pow: 1, sc: 14,  steer: 0, hold: 640, gun: 1 },
  yumi:     { name: '弓足軽',   px: 50,  r: 10, hb: 1.4, spd: 24,  pow: 1, sc: 14,  steer: 0, hold: 760, bow: 1 },
  kiba:     { name: '騎馬武者', px: 80,  r: 15, hb: 4.0, spd: 250, pow: 3, sc: 30,  steer: 0 },
  oni:      { name: '赤鬼',     px: 84,  r: 17, hb: 12,  spd: 30,  pow: 4, sc: 60,  steer: 30, big: 1 },
  tengu:    { name: '天狗',     px: 80,  r: 16, hb: 16,  spd: 36,  pow: 4, sc: 70,  steer: 36, big: 1 },
  aooni:    { name: '青鬼',     px: 100, r: 21, hb: 30,  spd: 24,  pow: 8, sc: 120, steer: 26, big: 1 }
};
var BOSSES = [
  { k: 'akaoni',      n: '赤鬼',         atk: ['slam', 'sweep', 'summon', 'charge'], minion: ['oni', 'ashigaru', 'ashigaru'] },
  { k: 'gashadokuro', n: 'がしゃどくろ', atk: ['slam', 'rain', 'summon', 'sweep'],   minion: ['gaikotsu', 'gaikotsu', 'yurei'] },
  { k: 'tsuchigumo',  n: '土蜘蛛',       atk: ['rain', 'charge', 'summon', 'sweep'], minion: ['ninja', 'ninja', 'ashigaru'] },
  { k: 'orochi',      n: '八岐大蛇',     atk: ['breath', 'rain', 'sweep', 'summon'], minion: ['yurei', 'gaikotsu', 'oni'] },
  { k: 'onimusha',    n: '鬼武者',       atk: ['sweep', 'charge', 'summon', 'slam'], minion: ['kiba', 'ashigaru', 'teppo'] },
  { k: 'ryujin',      n: '龍神',         atk: ['breath', 'rain', 'sweep', 'charge', 'summon'], minion: ['tengu', 'yurei', 'ninja'] }
];
var THEMES = [
  { name: '夕暮れの桜街道', sky: ['#2a1640', '#a63a3a', '#f39a4a'], sun: '#ffd27a', mt: ['#5a2a44', '#3a1a30'], fog: '#e08a5a',
    grass: '#3f5a2a', road: ['#9a7650', '#8a6844'], edge: '#5a4228', deco: ['sakura', 'sakura', 'lantern', 'sakura', 'rock'], amb: 'petal', castle: 0 },
  { name: '霧の竹林', sky: ['#13261c', '#3f6a52', '#9cc0a4'], sun: '#e8f0d8', mt: ['#2a4a38', '#1c3428'], fog: '#9cbfa6',
    grass: '#24402a', road: ['#7f7258', '#71654d'], edge: '#463e2c', deco: ['bamboo', 'bamboo', 'bamboo', 'jizo', 'bamboo'], amb: 'leaf', castle: 0 },
  { name: '月夜の城下町', sky: ['#05070f', '#141a3c', '#2c3566'], moon: '#f4ecd0', mt: ['#10142a', '#0a0d1c'], fog: '#2c3566',
    grass: '#151a2c', road: ['#3f3b4c', '#363243'], edge: '#221f2c', deco: ['house', 'lantern', 'house', 'torii', 'house'], amb: 'firefly', castle: 1 },
  { name: '吹雪の峠', sky: ['#4a5466', '#8a96a8', '#c8d0dc'], sun: '#f0f4f8', mt: ['#6a7688', '#525c6e'], fog: '#c8d0dc',
    grass: '#d4dbe4', road: ['#8e8c8a', '#7f7d7b'], edge: '#5e5c5a', deco: ['pine', 'pine', 'jizo', 'pine', 'rock'], amb: 'snow', castle: 0 },
  { name: '炎上する合戦場', sky: ['#1a0604', '#6a1a0c', '#d04a1a'], sun: '#ff9a4a', mt: ['#3a0e08', '#240804'], fog: '#a83a18',
    grass: '#3a2418', road: ['#6e5038', '#614630'], edge: '#3a2818', deco: ['flag', 'fire', 'flag', 'flag', 'rock'], amb: 'ember', castle: 2 },
  { name: '黄泉の道', sky: ['#0a0414', '#3a1240', '#8a2a5a'], moon: '#ff8a8a', mt: ['#1c0a24', '#120616'], fog: '#5a1a4a',
    grass: '#1c0e1c', road: ['#3a2c34', '#31252c'], edge: '#1e161c', deco: ['higan', 'torii', 'higan', 'higan', 'jizo'], amb: 'soul', castle: 0 }
];

/* ---------------- 仲間の並び ---------------- */
var FORM = [];
for (var fi = 0; fi < MAXSHOW; fi++) {
  var fr = 7.4 * Math.sqrt(fi + 0.35), fa = fi * 2.39996;
  FORM.push({ x: Math.cos(fa) * fr, z: Math.sin(fa) * fr * 0.8, k: fi % 4 === 3 ? 'nin' : 'sam', ph: Math.random() * 6.283 });
}

/* ---------------- 状態 ---------------- */
var G = {
  state: 'title', paused: false, t: 0, stage: 1, n: 10, nShow: 10, sx: 0, tx: 0, dist: 0, speed: 120,
  main: 'yumi', mainLv: 1, spec: {}, specT: {}, power: 1, fireT: 0, score: 0, kills: 0, stageKills: 0, maxN: 10, milestone: 0,
  bullets: [], enemies: [], gates: [], props: [], fx: [], texts: [], ebul: [], warns: [], fumas: [], waves: [], queue: [], amb: [],
  boss: null, events: [], evi: 0, bossAt: 1, clearT: 0, overT: 0, shake: 0, flash: 0, slow: 0, theme: 0, rushT: 0,
  banner: null, nFlash: 0, nFlashCol: '#fff', danger: 0, dmgAcc: 0, dpsAvg: 0, dpsT: 0, lossE: 0, lossB: 0,
  auto: false, timeScale: 1, music: 'off'
};
function n0(s) { return Math.min(30, 10 + 2 * (s - 1)); }
function D(s) { return 1 + 0.13 * (s - 1); }
function expN(s, p) { var a = n0(s), e = 220 * (1 + 0.12 * (s - 1)); return a * Math.pow(e / a, p); }
function unitDps(p) { return 3 + 3 * p; }
function expDPS(s, p) { return expN(s, p) * unitDps(p); }
function mainUnitDps() { var w = MAIN[G.main]; return w.dmg * w.rate * LVMUL[G.mainLv] * G.power; }
function P() { return Math.max(1, G.n) * mainUnitDps(); }                                  // いまの攻撃の強さ(1秒あたり)
function bulletDmgExp(s, p) { return expN(s, p) * (1 + 0.8 * p) / MAX_SHOOT; }            // ふつうの1発の強さ
function actBulletDmg() { return Math.max(1, G.n) * MAIN[G.main].dmg * LVMUL[G.mainLv] * G.power / Math.min(G.n || 1, MAX_SHOOT); }
function hpUnit(s, p) { return (0.6 * bulletDmgExp(s, p) + 0.4 * Math.min(actBulletDmg(), bulletDmgExp(s, p) * 3)) * D(s); }
function powUnit(s, p) { return Math.max(1, Math.round(expN(s, p) * 0.022 * Math.sqrt(D(s)))); }
function squadR() { return 7.4 * Math.sqrt(Math.max(1, Math.min(G.nShow, MAXSHOW))) + 10; }

/* ---------------- 陣を組み立てる ---------------- */
function buildStage(s) {
  seed = (s * 7919 + 101) >>> 0;
  var plan;
  if (s === 1) plan = ['G', 'W', 'X', 'W', 'G', 'K', 'R', 'X', 'W', 'A', 'G', 'L', 'X', 'R'];
  else {
    plan = ['G', 'W', 'X', 'W', 'G', 'K', 'R', 'X', 'A', 'W', 'G', 'L', 'X', 'R'];
    if (s >= 3) plan.splice(9, 0, 'K');
    if (s >= 4) plan.splice(5, 0, 'W');
    if (s >= 6) plan.splice(12, 0, 'A');
    if (rnd() < 0.5) { var t = plan[3]; plan[3] = plan[9]; plan[9] = t; }
  }
  var ev = [], at = 250;
  for (var k = 0; k < plan.length; k++) {
    ev.push({ at: at, type: plan[k], p: k / (plan.length - 1), first: k === 0 });
    at += plan[k] === 'R' ? 760 : plan[k] === 'W' ? 600 : 520;
  }
  G.events = ev; G.evi = 0; G.bossAt = at + 200;
}
function startStage(s) {
  G.stage = s; G.theme = (s - 1) % THEMES.length; skyFor = -1;
  G.n = n0(s); G.nShow = G.n; G.maxN = G.n; G.sx = G.tx = 0; G.dist = 0; G.main = 'yumi'; G.mainLv = 1; G.spec = {}; G.specT = {}; G.power = 1; G.fireT = 0;
  G.bullets = []; G.enemies = []; G.gates = []; G.props = []; G.fx = []; G.texts = []; G.ebul = []; G.warns = []; G.fumas = []; G.waves = []; G.queue = []; G.amb = [];
  G.boss = null; G.clearT = 0; G.overT = 0; G.shake = 0; G.flash = 0; G.slow = 0; G.stageKills = 0; G.milestone = 0; G.danger = 0; G.rushT = 0;
  G.dmgAcc = 0; G.dpsAvg = expDPS(s, 0); G.dpsT = 0; G.lossE = 0; G.lossB = 0;
  buildStage(s);
  G.banner = { big: '第' + kan(s) + '陣', small: THEMES[G.theme].name, t: 2.6, col: '#ffd34d' };
  setMusic('battle');
}
function setMusic(m) { G.music = m; if (window.SND) SND.music(m); }

function spawnEvent(e) {
  switch (e.type) {
    case 'G': spawnNumGates(e); break;
    case 'X': spawnWeaponGates(e); break;
    case 'W': spawnWave(e); break;
    case 'R': spawnRush(e); break;
    case 'K': spawnCavalry(e); break;
    case 'A': spawnArchers(e); break;
    case 'L': spawnLog(e); break;
  }
}
function numGate(op, v) { return { kind: 'num', op: op, v: v, charge: 0, flash: 0 }; }
function spawnNumGates(e) {
  var s = G.stage, p = e.p, base = expN(s, p);
  var good = Math.max(4, nice(base * rr(0.5, 0.9))), good2 = Math.max(3, nice(base * rr(0.25, 0.45)));
  var bad = Math.max(3, nice(base * rr(0.3, 0.6))), bad2 = Math.max(2, nice(base * rr(0.15, 0.3)));
  var list, r = rnd();
  if (e.first) list = [numGate('add', nice(base * 1.4)), numGate('add', -bad), numGate('add', good2)];
  else if (r < 0.3) list = [numGate('add', good), numGate('mul', 1), numGate('add', -bad)];
  else if (r < 0.5) list = [numGate('add', -bad), numGate('add', good), numGate('mul', -1)];
  else if (r < 0.7) list = [numGate('mul', p > 0.55 && rnd() < 0.4 ? 2 : 1), numGate('add', -bad), numGate('add', good2)];
  else if (r < 0.86) list = [numGate('add', -bad), numGate('add', -bad2), numGate('add', good)];
  else list = [numGate('mul', -1), numGate('add', -bad2), numGate('mul', 1)];
  addGateRow(shuffle(list), base);
}
function offerWeapons(count) {
  var c = [], cur = MAIN[G.main].tier;
  MAIN_KEYS.forEach(function (k) { var t = MAIN[k].tier; if (t > cur && t <= cur + 2) c.push(k); else if (k === G.main && G.mainLv < 3) c.push(k); });
  SPEC_KEYS.forEach(function (k) { if ((G.spec[k] || 0) < 3) { c.push(k); if (!G.spec[k]) c.push(k); } });
  var out = [];
  for (var i = 0; i < 40 && out.length < count && c.length; i++) { var k = pick(c); if (out.indexOf(k) < 0) out.push(k); }
  return out;
}
function spawnWeaponGates(e) {
  var s = G.stage, p = e.p, base = expN(s, p), ws = offerWeapons(2), list;
  var wg = function (k) { return { kind: 'wpn', w: k, lv: 1, charge: 0, flash: 0 }; };
  if (ws.length < 2) { spawnNumGates(e); return; }
  if (rnd() < 0.55) list = [wg(ws[0]), wg(ws[1]), numGate('add', Math.max(4, nice(base * rr(0.5, 0.8))))];
  else list = [wg(ws[0]), numGate('add', -Math.max(3, nice(base * rr(0.3, 0.5)))), wg(ws[1])];
  addGateRow(shuffle(list), base);
}
function addGateRow(list, base) {
  for (var i = 0; i < list.length; i++) { list[i].x0 = laneX(i) - LANE / 2 + 7; list[i].x1 = laneX(i) + LANE / 2 - 7; }
  G.gates.push({ z: SPAWN, list: list, passed: false, fade: 1, step: Math.max(1, nice(base * 0.07)) });
}
function avail(s) {
  var pool = ['ashigaru', 'ninja'];
  if (s >= 2) pool.push('gaikotsu');
  if (s >= 3) pool.push('yurei');
  return pool;
}
function bigPool(s) { var b = ['oni']; if (s >= 2) b.push('tengu'); if (s >= 4) b.push('aooni'); return b; }
function addEnemy(type, x, z, p, hpMul, powMul) {
  var T = ET[type], s = G.stage;
  var hp = T.hb * hpUnit(s, p) * (hpMul || 1);
  G.enemies.push({ type: type, T: T, x: clamp(x, -ROAD + 8, ROAD - 8), z: z, r: T.r, hp: hp, hpMax: hp,
    pow: Math.max(1, Math.round(T.pow * powUnit(s, p) * (powMul || 1))), spd: T.spd, ph: Math.random() * 6.283, flash: 0,
    sc: T.sc, hold: T.hold || 0, shootT: 1 + Math.random() * 2, kb: 0 });
}
function spawnWave(e) {
  var s = G.stage, p = e.p, pool = avail(s), main = pick(pool);
  var count = Math.round(24 + 34 * p + s * 3), cols = 9, sp = (ROAD * 2 - 30) / (cols - 1);
  for (var i = 0; i < count; i++) {
    var c = i % cols, row = Math.floor(i / cols), t = rnd() < 0.7 ? main : pick(pool);
    addEnemy(t, -ROAD + 15 + c * sp + rr(-7, 7) + (row % 2) * sp * 0.5, SPAWN + row * 30 + rr(0, 10), p);
  }
  var bigs = p > 0.25 ? 1 + Math.floor(p * 2 + s * 0.25) : 0;
  for (var b = 0; b < bigs; b++) addEnemy(pick(bigPool(s)), rr(-ROAD + 40, ROAD - 40), SPAWN + Math.ceil(count / cols) * 30 + 30 + b * 40, p);
}
function spawnRush(e) {
  var s = G.stage, p = e.p, pool = avail(s);
  var total = Math.min(240, Math.round(100 + 70 * p + s * 8)), ranks = Math.ceil(total / 11);
  for (var r = 0; r < ranks; r++) G.queue.push({ t: r * 0.22, f: (function (rk) { return function () {
    for (var c = 0; c < 11; c++) addEnemy(rk % 3 === 0 ? pick(pool) : pool[0], -ROAD + 12 + c * (ROAD * 2 - 24) / 10 + rr(-8, 8), SPAWN + rr(0, 20), p, 0.85);
  }; })(r) });
  var bigs = 2 + Math.floor(s / 2);
  for (var b = 0; b < bigs; b++) G.queue.push({ t: 1 + b * 0.9, f: function () { addEnemy(pick(bigPool(s)), rr(-ROAD + 40, ROAD - 40), SPAWN, p); } });
  G.banner = { big: '敵の大軍 来襲!', small: '押し寄せる軍勢を なぎ倒せ', t: 2.4, col: '#ff5a4a' };
  sfx('horn'); setMusic('rush'); G.rushT = 16;
}
function spawnCavalry(e) {
  var s = G.stage, p = e.p, lanes = s >= 3 && rnd() < 0.5 ? shuffle([0, 1, 2]).slice(0, 2) : [laneOf(G.sx)];
  lanes.forEach(function (ln) {
    G.warns.push({ k: 'lane', lane: ln, t: 1.9, max: 1.9, cav: true, label: '騎馬隊' });
    G.queue.push({ t: 1.4, f: function () {
      var n = 6 + Math.min(6, s);
      for (var i = 0; i < n; i++) addEnemy('kiba', laneX(ln) + rr(-26, 26), SPAWN + i * 60, p);
    } });
  });
  G.banner = { big: '騎馬隊 突撃!', small: '赤い列から よけろ!', t: 1.8, col: '#ff7a3a' };
  sfx('gallop'); sfx('warn');
}
function spawnArchers(e) {
  var s = G.stage, p = e.p, n = 7 + Math.min(5, s), useGun = s >= 4 && rnd() < 0.5;
  for (var i = 0; i < n; i++) addEnemy(useGun && i % 2 ? 'teppo' : 'yumi', -ROAD + 20 + i * (ROAD * 2 - 40) / (n - 1), SPAWN + rr(0, 30), p, 1.2);
  for (var j = 0; j < 14 + s * 2; j++) addEnemy(pick(avail(s)), rr(-ROAD + 15, ROAD - 15), SPAWN + 60 + rr(0, 120), p);
  G.banner = { big: '弓隊 出現!', small: '矢の雨に気をつけろ', t: 1.8, col: '#ffb347' };
  sfx('warn');
}
function spawnLog(e) {
  var s = G.stage, p = e.p, ln = laneOf(G.sx), w = s >= 5 && rnd() < 0.5 ? 2 : 1;
  var x0 = laneX(ln) - LANE / 2, x1 = laneX(ln) + LANE / 2;
  if (w === 2) { if (ln === 2) x0 -= LANE; else x1 += LANE; }
  var hp = expDPS(s, p) * 3.2 * D(s);
  G.props.push({ k: 'log', x0: x0 + 6, x1: x1 - 6, z: SPAWN, hp: hp, hpMax: hp, rot: 0, flash: 0, spd: 70 });
  G.banner = { big: '大丸太が来る!', small: '撃ち壊すか よけろ', t: 1.6, col: '#ffb347' };
  sfx('warn');
}
function spawnBoss() {
  var s = G.stage, def = BOSSES[(s - 1) % BOSSES.length];
  var est = 0.55 * expDPS(s, 1) * 1.8 + 0.45 * G.dpsAvg;
  var hp = 30 * est * Math.sqrt(D(s));
  G.boss = { def: def, x: 0, z: 1500, hp: hp, hpMax: hp, phase: 'enter', atkT: 3.2, crushT: 1.2, flash: 0, deadT: 0, t: 0, dash: null, ai: 0, rage: 0 };
  G.banner = { big: def.n, small: '大将 見参', t: 3.0, col: '#ff4a3a', boss: true };
  G.flash = 0.6; sfx('roar'); setMusic('boss');
}

/* ---------------- 入力 ---------------- */
var keys = {}, drag = null;
function toLogical(ev) {
  var r = cv.getBoundingClientRect(), k = cv.width / r.width;
  return { x: ((ev.clientX - r.left) * k - OX) / SC, y: ((ev.clientY - r.top) * k - OY) / SC };
}
cv.addEventListener('pointerdown', function (ev) {
  if (G.state !== 'play') return;
  if (window.SND) SND.start();
  var p = toLogical(ev); drag = { id: ev.pointerId, x: p.x, tx: G.tx };
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
});
cv.addEventListener('pointermove', function (ev) {
  if (!drag || drag.id !== ev.pointerId || G.state !== 'play') return;
  var p = toLogical(ev); G.tx = clamp(drag.tx + (p.x - drag.x) * 1.25 / KX, -ROAD + 12, ROAD - 12);
});
function endDrag(ev) { if (drag && drag.id === ev.pointerId) drag = null; }
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
addEventListener('keydown', function (ev) {
  if (ev.key === 'ArrowLeft' || ev.key === 'a') keys.l = 1;
  if (ev.key === 'ArrowRight' || ev.key === 'd') keys.r = 1;
  if (ev.key === 'm' || ev.key === 'M') toggleMute();
  if ((ev.key === 'p' || ev.key === 'Escape') && G.state === 'play') setPause(!G.paused);
});
addEventListener('keyup', function (ev) {
  if (ev.key === 'ArrowLeft' || ev.key === 'a') keys.l = 0;
  if (ev.key === 'ArrowRight' || ev.key === 'd') keys.r = 0;
});

/* ---------------- 更新 ---------------- */
var BUCK = 18, BW = (ROAD * 2 + 40) / BUCK, buckets = [];
for (var bi = 0; bi < BUCK; bi++) buckets.push([]);
function bucketOf(x) { return clamp(Math.floor((x + ROAD + 20) / BW), 0, BUCK - 1); }
function worldSpeed() { return G.boss ? G.speed * 0.35 : G.speed; }

function update(dt) {
  G.t += dt;
  if (G.auto) bot();
  if (keys.l) G.tx -= 300 * dt;
  if (keys.r) G.tx += 300 * dt;
  G.tx = clamp(G.tx, -ROAD + 12, ROAD - 12);
  G.sx += (G.tx - G.sx) * Math.min(1, dt * 13);
  var target = Math.min(G.n, MAXSHOW);
  if (G.nShow < target) G.nShow = Math.min(target, G.nShow + Math.max(4, (target - G.nShow) * 6) * dt); else G.nShow = target;
  G.dist += worldSpeed() * dt;

  while (G.evi < G.events.length && G.dist >= G.events[G.evi].at) spawnEvent(G.events[G.evi++]);
  if (!G.boss && G.evi >= G.events.length && G.dist >= G.bossAt) spawnBoss();
  for (var q = G.queue.length - 1; q >= 0; q--) { if (!G.queue[q]) continue; G.queue[q].t -= dt; if (G.queue[q].t <= 0) { var f = G.queue[q].f; G.queue.splice(q, 1); f(); } }
  if (G.rushT > 0) { G.rushT -= dt; if (G.rushT <= 0 && G.music === 'rush') setMusic('battle'); }

  // 敵を列ごとに分けておく(当たり判定を速くする)
  for (var b = 0; b < BUCK; b++) buckets[b].length = 0;
  for (var i = 0; i < G.enemies.length; i++) buckets[bucketOf(G.enemies[i].x)].push(G.enemies[i]);

  if (G.n > 0 && G.overT <= 0 && G.clearT <= 0) { fire(dt); specials(dt); }
  updBullets(dt); updGates(dt); updProps(dt); updEnemies(dt); updBoss(dt); updEbul(dt); updWarns(dt); updFuma(dt);
  updFx(dt);
  // 1秒あたりの攻撃の強さを はかる(大将の体力を決めるのに使う)
  G.dpsT += dt; if (G.dpsT >= 1) { G.dpsAvg = G.dpsAvg * 0.8 + (G.dmgAcc / G.dpsT) * 0.2; G.dmgAcc = 0; G.dpsT = 0; }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 1.6);
  if (G.nFlash > 0) G.nFlash -= dt;
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  if (G.n > G.maxN) G.maxN = G.n;
  var dangerNow = G.n > 0 && G.clearT <= 0 && (G.n < Math.max(8, G.maxN * 0.28) || (G.boss && G.boss.phase === 'crush'));
  G.danger += ((dangerNow ? 1 : 0) - G.danger) * Math.min(1, dt * 3);
  if (window.SND) SND.heart(dangerNow && G.state === 'play');
  checkMilestone();

  if (G.n <= 0 && G.overT <= 0 && G.clearT <= 0) { G.overT = 1.6; sfx('dead'); setMusic('off'); G.flash = 0.4; }
  if (G.overT > 0) { G.overT -= dt; if (G.overT <= 0) showOver(); }
  if (G.clearT > 0) { G.clearT -= dt; if (G.clearT <= 0) showClear(); }
}
var MILES = [[100, '百人斬り'], [300, '三百人斬り'], [500, '五百人斬り'], [1000, '千人斬り'], [2000, '二千人斬り'], [3000, '三千人斬り'], [5000, '五千人斬り']];
function checkMilestone() {
  var m = MILES[G.milestone];
  if (m && G.stageKills >= m[0]) {
    G.milestone++;
    if (!G.banner || !G.banner.boss) G.banner = { big: m[1] + '!', small: '無双の勢い', t: 1.6, col: '#ffe9a0', mile: true };
    sfx('gong');
  }
}

/* ---- 撃つ ---- */
function fire(dt) {
  var w = MAIN[G.main]; G.fireT -= dt * w.rate;
  var guard = 0;
  while (G.fireT <= 0 && guard++ < 4) { G.fireT += 1; volley(w); }
}
function volley(w) {
  if (G.bullets.length > 340) return;
  var m = Math.max(1, Math.floor(G.nShow)), S = Math.max(1, Math.min(G.n, m, w.shoot));
  var dmg = w.dmg * LVMUL[G.mainLv] * G.power * G.n / S;
  for (var j = 0; j < S; j++) {
    var u = FORM[Math.min(m - 1, Math.floor((j + Math.random()) * m / S))];
    var vx = (Math.random() - 0.5) * 2 * w.spread * w.spd;
    G.bullets.push({ x: G.sx + u.x, z: u.z + 4, z0: u.z, h: 16, vx: vx, vz: w.spd * (0.95 + Math.random() * 0.1), dmg: dmg,
      pierce: w.pierce, splash: w.splash, kind: w.kind, rot: Math.random() * 6, last: null });
  }
  sfx(w.kind === 'ball' ? 'gun' : w.kind === 'shell' ? 'cannon' : 'shot');
}
function updBullets(dt) {
  var bs = G.bullets;
  for (var i = bs.length - 1; i >= 0; i--) {
    var b = bs[i]; b.z0 = b.z; b.x += b.vx * dt; b.z += b.vz * dt; b.rot += dt * 20;
    if (b.kind === 'shell') b.h = 16 + Math.sin(Math.min(1, b.z / 900) * Math.PI) * 60;
    if (b.z > SPAWN + 50 || b.x < -ROAD - 40 || b.x > ROAD + 40) { bs.splice(i, 1); continue; }
    if (hitStuff(b)) bs.splice(i, 1);
  }
}
function hitStuff(b) {
  var j, k;
  for (j = 0; j < G.gates.length; j++) {
    var row = G.gates[j];
    if (row.passed || row.z > b.z + 4 || row.z < b.z0 - 4) continue;
    for (k = 0; k < row.list.length; k++) {
      var g = row.list[k];
      if (b.x >= g.x0 && b.x <= g.x1) { chargeGate(row, g, b.dmg); return true; }
    }
  }
  for (j = 0; j < G.props.length; j++) {
    var pr = G.props[j];
    if (pr.dead || pr.z > b.z + 20 || pr.z < b.z0 - 20) continue;
    if (b.x >= pr.x0 && b.x <= pr.x1) {
      pr.hp -= b.dmg; pr.flash = 0.06; G.dmgAcc += b.dmg; sfx('wood');
      if (b.splash) explode(b.x, pr.z, b.splash, b.dmg * 0.6, b.kind === 'shell');
      if (pr.hp <= 0) breakProp(pr);
      return true;
    }
  }
  var bo = G.boss;
  if (bo && (bo.phase === 'fight' || bo.phase === 'crush') && Math.abs(b.x - bo.x) < 95 && bo.z <= b.z + 20 && bo.z >= b.z0 - 20) {
    hurtBoss(b.dmg);
    if (b.splash) explode(b.x, bo.z - 10, b.splash, b.dmg * 0.4, b.kind === 'shell');
    if (Math.random() < 0.35) sparkAt(b.x, bo.z - 20, 30 + Math.random() * 70, '#ffe9a0', 2);
    return true;
  }
  var c0 = bucketOf(b.x - 22), c1 = bucketOf(b.x + 22);
  for (var c = c0; c <= c1; c++) {
    var list = buckets[c];
    for (j = 0; j < list.length; j++) {
      var e = list[j];
      if (e.dead || e === b.last) continue;
      if (e.z < b.z0 - e.r - 6 || e.z > b.z + e.r + 6 || Math.abs(b.x - e.x) > e.r + 4) continue;
      hurtEnemy(e, b.dmg, b.kind === 'ball' || b.kind === 'shell' ? 14 : 4);
      if (b.splash) explode(b.x, e.z, b.splash, b.dmg * 0.6, b.kind === 'shell');
      if (b.pierce > 0) { b.pierce--; b.last = e; b.dmg *= 0.85; return false; }
      return true;
    }
  }
  return false;
}
function bossHittable() { var b = G.boss; return b && (b.phase === 'fight' || b.phase === 'crush'); }
function explode(x, z, r, dmg, big) {
  if (dmg > 0) areaDmg(x, z, r, dmg);
  if (dmg > 0 && bossHittable() && Math.abs(G.boss.x - x) < 95 + r && Math.abs(G.boss.z - z) < r + 30) hurtBoss(dmg * 0.5);
  fx('glow', x, z, 10, 0, 0, 0, big ? 0.4 : 0.25, big ? '#ffb347' : '#ff9a4a', r * 2.4);
  fx('ring', x, z, 4, 0, 0, 0, 0.3, '#ffd27a', r);
  for (var i = 0; i < (big ? 8 : 3); i++) fx('smoke', x + rr2(r * 0.6), z + rr2(r * 0.5), 10, rr2(30), rr2(20), 30 + Math.random() * 30, 0.7 + Math.random() * 0.4, '#3a2a22', 26 + Math.random() * 20);
  if (big) { G.shake = Math.max(G.shake, 4); sfx('boom'); } else sfx('pop');
}
function areaDmg(x, z, r, dmg) {
  var c0 = bucketOf(x - r - 20), c1 = bucketOf(x + r + 20);
  for (var c = c0; c <= c1; c++) {
    var list = buckets[c];
    for (var j = 0; j < list.length; j++) {
      var e = list[j]; if (e.dead) continue;
      var dx = e.x - x, dz = (e.z - z) * 0.8;
      if (dx * dx + dz * dz < (r + e.r) * (r + e.r)) hurtEnemy(e, dmg, 10);
    }
  }
}
function hurtEnemy(e, dmg, kb) {
  if (e.dead) return;
  G.dmgAcc += Math.min(dmg, e.hp);
  e.hp -= dmg; e.flash = 0.07;
  if (kb && !e.T.big) e.kb = Math.max(e.kb, kb);
  if (e.hp <= 0) killEnemy(e, true); else if (e.T.big) sfx('clang'); else sfx('hit');
}
function killEnemy(e, byShot) {
  e.hp = 0; e.dead = true;
  if (byShot) { G.score += Math.round(e.sc * (1 + G.stage * 0.2)); G.kills++; G.stageKills++; }
  var big = e.T.big || e.type === 'kiba';
  if (G.fx.length < 420) {
    fx('ink', e.x, e.z, 6, 0, 0, 0, 0.6, '#5a0a0a', big ? 70 : 34);
    fx('glow', e.x, e.z, 16, 0, 0, 0, 0.18, e.T.ghost ? '#9fe8ff' : '#ff6a4a', big ? 90 : 40);
    for (var i = 0; i < (big ? 12 : 3); i++) fx('spark', e.x, e.z, 18, rr2(140), rr2(80) + 60, 60 + Math.random() * 120, 0.45, big ? '#ffd27a' : '#ffb08a', 8);
    if (big) for (var k = 0; k < 5; k++) fx('smoke', e.x + rr2(14), e.z, 20, rr2(30), rr2(20), 40, 0.9, '#2a1a1a', 40);
  }
  if (big) { sfx('bigkill'); G.shake = Math.max(G.shake, 3); } else sfx('kill');
}
function hurtBoss(dmg) {
  var b = G.boss; if (!bossHittable()) return;
  b.hp -= dmg; b.flash = 0.06; G.dmgAcc += dmg;
  if (b.hp <= 0) killBoss(); else sfx('hit');
}

/* ---- 助っ人の武器 ---- */
function nearestEnemies(maxZ, n) {
  var out = [];
  for (var i = 0; i < G.enemies.length; i++) { var e = G.enemies[i]; if (!e.dead && e.z < maxZ && e.z > 20) out.push(e); }
  out.sort(function (a, b) { return a.z - b.z; });
  return out.slice(0, n);
}
function denseSpot() {
  var best = null, bv = -1;
  for (var t = 0; t < 8; t++) {
    var e = G.enemies[Math.floor(Math.random() * G.enemies.length)]; if (!e || e.dead || e.z > 1100 || e.z < 60) continue;
    var c = 0; for (var j = 0; j < G.enemies.length; j += 2) { var o = G.enemies[j]; if (Math.abs(o.x - e.x) < 60 && Math.abs(o.z - e.z) < 60) c++; }
    if (c > bv) { bv = c; best = e; }
  }
  if (!best && bossHittable()) return { x: G.boss.x + rr2(60), z: G.boss.z };
  return best ? { x: best.x, z: best.z } : null;
}
function specials(dt) {
  for (var key in G.spec) {
    var L = G.spec[key]; if (!L) continue;
    G.specT[key] = (G.specT[key] || 0) - dt;
    if (key === 'kusarigama') { kusari(dt, L); continue; }
    if (key === 'fuma') { while (G.fumas.length < L) G.fumas.push({ x: G.sx, z: 0, out: true, tx: rr2(ROAD * 0.7), rot: 0 }); continue; }
    if (G.specT[key] > 0) continue;
    var p = P(), i, sp;
    if (key === 'bakuchiku') {
      G.specT[key] = 1.5;
      for (i = 0; i < 2 + L; i++) { sp = denseSpot(); if (!sp) break; throwObj('crack', sp.x + rr2(40), sp.z + rr2(40), 0.55, 0.05 * p); }
    } else if (key === 'horoku') {
      G.specT[key] = 2.4;
      for (i = 0; i < L; i++) { sp = denseSpot(); if (!sp) break; throwObj('bomb', sp.x, sp.z, 0.8, 0.55 * p); }
    } else if (key === 'hanabi') {
      G.specT[key] = 3.2;
      for (i = 0; i < L; i++) { sp = denseSpot(); if (!sp) break; throwObj('shell', sp.x, sp.z, 1.0, 0.11 * p); }
    } else if (key === 'kaminari') {
      G.specT[key] = 1.8;
      var tg = nearestEnemies(1100, 20), hit = false;
      for (i = 0; i < 1 + L && tg.length; i++) {
        var e = tg.splice(Math.floor(Math.random() * Math.min(tg.length, 8)), 1)[0];
        bolt(e.x, e.z); hurtEnemy(e, 0.4 * p, 0); areaDmg(e.x, e.z, 50, 0.2 * p); hit = true;
      }
      if (bossHittable() && (!hit || Math.random() < 0.5)) { bolt(G.boss.x + rr2(50), G.boss.z); hurtBoss(0.35 * p * L); hit = true; }
      if (hit) { sfx('zap'); G.flash = Math.max(G.flash, 0.1); }
    } else if (key === 'yoto') {
      G.specT[key] = 1.6;
      G.waves.push({ x: G.sx, z: 20, hw: 50 + 26 * L, dmg: 0.35 * p, hit: [], boss: false });
      sfx('slash');
    }
  }
}
function throwObj(k, x, z, time, dmg) {
  G.ebul.push({ mine: true, k: k, x0: G.sx, z0: 10, x: G.sx, z: 10, tx: x, tz: z, t: 0, max: time, dmg: dmg, h: 0 });
}
function bolt(x, z) {
  G.fx.push({ k: 'bolt', x: x, z: z, h: 0, vx: 0, vz: 0, vh: 0, life: 0.22, max: 0.22, seed: Math.random() * 1000, rot: 0 });
  fx('glow', x, z, 0, 0, 0, 0, 0.3, '#bff3ff', 90);
}
function kusari(dt, L) {
  var R = squadR() + 22, now = G.t;
  for (var i = 0; i < L; i++) {
    var a = now * 5 + i * Math.PI * 2 / L, sx = G.sx + Math.cos(a) * R, sz = Math.sin(a) * R * 0.8;
    var list = buckets[bucketOf(sx)];
    for (var j = 0; j < list.length; j++) {
      var e = list[j]; if (e.dead) continue;
      if (Math.abs(e.x - sx) < 22 + e.r && Math.abs(e.z - sz) < 22 + e.r && (!e.kt || e.kt < now)) { e.kt = now + 0.3; hurtEnemy(e, 0.28 * P(), 20); sfx('clang'); }
    }
  }
}
function updFuma(dt) {
  var L = G.spec.fuma || 0, now = G.t, p = P();
  for (var i = G.fumas.length - 1; i >= 0; i--) {
    var f = G.fumas[i]; f.rot += dt * 18;
    if (f.out) { f.z += 620 * dt; f.x += (f.tx - f.x) * Math.min(1, dt * 2); if (f.z > 950) f.out = false; }
    else {
      f.z -= 760 * dt; f.x += (G.sx - f.x) * Math.min(1, dt * 3);
      if (f.z <= 0) { if (G.fumas.length > L || G.n <= 0) { G.fumas.splice(i, 1); continue; } f.out = true; f.tx = rr2(ROAD * 0.75); f.z = 0; }
    }
    var c0 = bucketOf(f.x - 30), c1 = bucketOf(f.x + 30);
    for (var c = c0; c <= c1; c++) for (var j = 0; j < buckets[c].length; j++) {
      var e = buckets[c][j]; if (e.dead) continue;
      if (Math.abs(e.x - f.x) < 26 + e.r && Math.abs(e.z - f.z) < 26 + e.r && (!e.ft || e.ft < now)) { e.ft = now + 0.25; hurtEnemy(e, 0.09 * p, 6); }
    }
    var b = G.boss; if (bossHittable() && Math.abs(b.x - f.x) < 100 && Math.abs(b.z - f.z) < 40 && (!b.ft || b.ft < now)) { b.ft = now + 0.25; hurtBoss(0.09 * p); }
  }
  for (var w = G.waves.length - 1; w >= 0; w--) {
    var v = G.waves[w]; v.z += 720 * dt;
    if (v.z > 1250) { G.waves.splice(w, 1); continue; }
    var a0 = bucketOf(v.x - v.hw), a1 = bucketOf(v.x + v.hw);
    for (var cc = a0; cc <= a1; cc++) for (var jj = 0; jj < buckets[cc].length; jj++) {
      var en = buckets[cc][jj]; if (en.dead || v.hit.indexOf(en) >= 0) continue;
      if (Math.abs(en.x - v.x) < v.hw + en.r && Math.abs(en.z - v.z) < 22 + en.r) { v.hit.push(en); hurtEnemy(en, v.dmg, 16); }
    }
    if (!v.boss && bossHittable() && Math.abs(G.boss.z - v.z) < 30) { v.boss = true; hurtBoss(v.dmg); }
  }
}

/* ---- 門 ---- */
function chargeGate(row, g, dmg) {
  g.charge += dmg; g.flash = 0.06;
  var unit = Math.max(1, P());
  var thr = unit * (g.kind === 'wpn' ? 1.1 : g.op === 'mul' ? 0.9 : 0.45), n = 0;
  while (g.charge >= thr && n++ < 3) {
    g.charge -= thr;
    if (g.kind === 'wpn') { if (g.lv < 3) { g.lv++; g.flash = 0.3; sfx('flip'); } else g.charge = 0; }
    else if (g.op === 'add') { var was = g.v; g.v += row.step; if (was < 0 && g.v >= 0) { g.flash = 0.3; sfx('flip'); } else sfx('tick'); }
    else if (g.v < 1) { g.v += 1; g.flash = 0.3; sfx('flip'); } else g.charge = 0;
  }
}
function gateResult(g, n) {
  if (g.kind === 'wpn') return n;
  var r = g.op === 'add' ? n + g.v : g.v >= 0 ? n * (g.v + 1) : Math.ceil(n / (1 - g.v));
  return clamp(Math.round(r), 0, 99999);
}
function gateLabel(g) {
  if (g.op === 'add') return (g.v >= 0 ? '+' : '−') + fmt(Math.abs(g.v));
  return g.v >= 0 ? '×' + (g.v + 1) : '÷' + (1 - g.v);
}
function gateGood(g) { return g.kind === 'wpn' || (g.op === 'add' ? g.v > 0 : g.v >= 1); }
function takeWeapon(g) {
  var k = g.w;
  if (MAIN[k]) {
    if (k === G.main) G.mainLv = Math.min(3, Math.max(G.mainLv + 1, g.lv));
    else { G.main = k; G.mainLv = Math.max(1, g.lv); G.fireT = 0; }
    addText(MAIN[k].name + ' Lv' + G.mainLv, 0, 40, '#ffd34d', 26, true);
  } else {
    G.spec[k] = Math.min(3, Math.max((G.spec[k] || 0) + 1, g.lv));
    addText(SPEC[k].name + ' Lv' + G.spec[k], 0, 40, '#ffb0ff', 26, true);
  }
  sfx('power'); G.flash = Math.max(G.flash, 0.2);
}
function updGates(dt) {
  var sp = worldSpeed();
  for (var i = G.gates.length - 1; i >= 0; i--) {
    var row = G.gates[i]; row.z -= sp * dt;
    for (var k = 0; k < row.list.length; k++) if (row.list[k].flash > 0) row.list[k].flash -= dt;
    if (!row.passed && row.z <= 2 && G.n > 0) {
      row.passed = true;
      var g = row.list[laneOf(G.sx)];
      if (g) {
        g.chosen = true;
        if (g.kind === 'wpn') takeWeapon(g);
        else {
          var before = G.n, after = gateResult(g, G.n);
          G.n = after;
          if (after >= before) {
            addText('+' + fmt(after - before), G.sx, 60, '#8fe0ff', 34);
            G.nFlash = 0.5; G.nFlashCol = '#8fe0ff'; sfx('good');
            for (var q = 0; q < 18; q++) fx('spark', G.sx + rr2(80), rr2(30), 10, rr2(40), rr2(20), 120 + Math.random() * 120, 0.8, '#bff3ff', 8);
          } else {
            addText('−' + fmt(before - after), G.sx, 60, '#ff6b6b', 34);
            G.nFlash = 0.5; G.nFlashCol = '#ff6b6b'; sfx('bad'); G.shake = 7;
            lostFx(before - after);
          }
        }
      }
    }
    if (row.passed) { row.fade -= dt * 2.4; if (row.fade <= 0) G.gates.splice(i, 1); }
  }
}
function breakProp(pr) {
  pr.dead = true; pr.fade = 1; sfx('crate'); G.shake = Math.max(G.shake, 6);
  for (var i = 0; i < 18; i++) fx('plank', (pr.x0 + pr.x1) / 2 + rr2((pr.x1 - pr.x0) / 2), pr.z, 20, rr2(160), rr2(60), 80 + Math.random() * 160, 0.9, '#8a5a2a', 10);
  addText('粉砕!', (pr.x0 + pr.x1) / 2, pr.z, '#ffd34d', 26);
  G.score += 200 * G.stage;
}
function updProps(dt) {
  var R = squadR(), sp = worldSpeed();
  for (var i = G.props.length - 1; i >= 0; i--) {
    var pr = G.props[i]; if (pr.flash > 0) pr.flash -= dt;
    if (pr.dead) { pr.fade -= dt * 4; if (pr.fade <= 0) G.props.splice(i, 1); continue; }
    pr.z -= (sp + pr.spd) * dt; pr.rot += dt * 6;
    if (pr.z < R * 0.8 && pr.z > -R && G.n > 0 && !pr.hitDone) {
      var ov = overlap(pr.x0, pr.x1, R);
      if (ov > 0) {
        pr.hitDone = true;
        var lost = Math.min(G.n, Math.max(1, Math.ceil(G.n * ov * 0.32)));
        G.n -= lost; G.lossB += lost; lostFx(lost); addText('−' + fmt(lost), G.sx, 30, '#ff6b6b', 30);
        G.nFlash = 0.5; G.nFlashCol = '#ff6b6b'; G.shake = 12; sfx('slam');
      }
    }
    if (pr.z < -200) G.props.splice(i, 1);
  }
}

/* ---- 敵 ---- */
function updEnemies(dt) {
  var R = squadR(), es = G.enemies, sp = worldSpeed();
  for (var i = es.length - 1; i >= 0; i--) {
    var e = es[i];
    if (e.dead) { es.splice(i, 1); continue; }
    if (e.flash > 0) e.flash -= dt;
    e.ph += dt;
    var adv = sp + e.spd;
    if (e.hold && e.z <= e.hold) { if (G.boss) e.hold = 0; else { adv = 0; enemyShoot(e, dt); } }
    if (e.kb > 0) { e.z += e.kb * 6 * dt; e.kb = Math.max(0, e.kb - dt * 60); }
    e.z -= adv * dt;
    var dx = G.sx - e.x;
    if (G.n > 0 && e.z < 520 && e.T.steer) e.x += clamp(dx, -e.T.steer * dt, e.T.steer * dt);
    if (e.T.weave) e.x += Math.sin(e.ph * (e.T.weave === 2 ? 2.4 : 5)) * (e.T.weave === 2 ? 50 : 40) * dt;
    e.x = clamp(e.x, -ROAD + 6, ROAD - 6);
    if (G.n > 0 && e.z < R * 0.82 + e.r && e.z > -R * 0.8 && Math.abs(dx) < R + e.r * 0.6) {
      var lost = Math.min(G.n, e.pow);
      G.n -= lost; G.lossE += lost; lostFx(lost); killEnemy(e, false); es.splice(i, 1);
      if (lost >= 3 || Math.random() < 0.3) addText('−' + lost, e.x, 20, '#ff6b6b', 20);
      G.nFlash = 0.35; G.nFlashCol = '#ff6b6b'; G.shake = Math.max(G.shake, e.T.big ? 8 : 3);
      continue;
    }
    if (e.z < -120) es.splice(i, 1);
  }
}
function enemyShoot(e, dt) {
  e.shootT -= dt; if (e.shootT > 0 || G.n <= 0) return;
  if (e.T.bow) {   // 弓隊: まとまって 矢の雨
    e.shootT = 3.2 + Math.random();
    if (Math.random() < 0.45) {
      G.warns.push({ k: 'circle', x: G.sx + rr2(squadR() + 40), z: rr2(30), r: 30, t: 1.3, max: 1.3, frac: 0.14, arrows: true });
      sfx('arrows');
    }
  } else if (e.T.gun) {
    e.shootT = 2.6 + Math.random() * 1.2;
    G.ebul.push({ k: 'gunshot', x: e.x, z: e.z, vx: (G.sx - e.x) / Math.max(0.3, e.z / 700), vz: -700, r: 8, h: 16 });
    sfx('gun', 0.6);
  }
}
function lostFx(n) {
  var R = squadR();
  for (var i = 0; i < Math.min(14, n); i++) fx('soul', G.sx + rr2(R), rr2(R * 0.7), 14, rr2(20), 0, 50 + Math.random() * 40, 0.9, '#dfefff', 5);
  sfx('lose');
}

/* ---- 大将 ---- */
function updBoss(dt) {
  var b = G.boss; if (!b) return;
  b.t += dt; if (b.flash > 0) b.flash -= dt;
  if (b.phase === 'dead') {
    b.deadT += dt;
    if (Math.random() < 0.6 && b.deadT < 1.6) explode(b.x + rr2(110), b.z + rr2(40), 50, 0, true);
    return;
  }
  if (b.phase === 'enter') { b.z -= 300 * dt; if (b.z <= 620) { b.z = 620; b.phase = 'fight'; } return; }
  if (b.dash) {      // 突進
    var d = b.dash; d.t += dt;
    if (d.t < 0.45) { b.x += (laneX(d.lane) - b.x) * Math.min(1, dt * 10); b.z += (40 - b.z) * Math.min(1, dt * 7); }
    else if (d.t < 1.3) { b.z += (d.z - b.z) * Math.min(1, dt * 3); }
    else { b.dash = null; }
    if (d.t >= 0.3 && !d.hit) {
      d.hit = true;
      var ov = overlap(laneX(d.lane) - LANE / 2, laneX(d.lane) + LANE / 2, squadR());
      if (ov > 0) bossHurtsSquad(ov * 0.45);
      G.shake = 16; sfx('slam');
    }
    return;
  }
  var hpR = b.hp / b.hpMax;
  b.rage = hpR < 0.25 ? 2 : hpR < 0.6 ? 1 : 0;
  if (b.phase === 'fight') {      // じりじり迫ってくる
    b.z -= (9 + b.rage * 4) * dt;
    b.x += (Math.sin(b.t * 0.5) * 60 - b.x) * Math.min(1, dt * 0.8);
    if (b.z <= 170) { b.z = 170; b.phase = 'crush'; G.banner = { big: '大将が目の前に!', small: '急いで倒せ!', t: 1.8, col: '#ff3a2a' }; sfx('roar'); }
  }
  if (b.phase === 'crush') {
    b.crushT -= dt;
    if (b.crushT <= 0) { b.crushT = 1.1; bossHurtsSquad(0.09); G.shake = 14; sfx('slam'); G.warns.push({ k: 'flashring', x: G.sx, z: 0, t: 0.3, max: 0.3 }); }
  }
  b.atkT -= dt;
  if (b.atkT <= 0 && G.n > 0) {
    b.atkT = [3.0, 2.2, 1.6][b.rage];
    var atk = b.def.atk[b.ai++ % b.def.atk.length];
    if (b.rage === 2 && Math.random() < 0.4) atk = pick(b.def.atk);
    bossAttack(b, atk);
  }
}
function overlap(x0, x1, R) { return Math.max(0, Math.min(G.sx + R, x1) - Math.max(G.sx - R, x0)) / (2 * R); }
function bossHurtsSquad(frac) {
  if (G.n <= 0) return;
  var lost = Math.min(G.n, Math.max(1, Math.ceil(G.n * frac)));
  G.n -= lost; G.lossB += lost; lostFx(lost);
  addText('−' + fmt(lost), G.sx, 40, '#ff4a3a', 32);
  G.nFlash = 0.5; G.nFlashCol = '#ff4a3a';
}
function bossAttack(b, atk) {
  var R = squadR(), s = G.stage;
  if (atk === 'slam') {
    G.warns.push({ k: 'circle', x: clamp(G.sx, -ROAD + 60, ROAD - 60), z: 0, r: 72, t: 1.15, max: 1.15, frac: 0.42, big: true });
    sfx('warn');
  } else if (atk === 'sweep') {
    G.warns.push({ k: 'sweep', safe: Math.floor(Math.random() * 3), t: 1.45, max: 1.45, frac: 0.45 });
    addText('なぎ払い!', 0, 200, '#ff6a4a', 26, true); sfx('warn');
  } else if (atk === 'charge') {
    G.warns.push({ k: 'lane', lane: laneOf(G.sx), t: 1.25, max: 1.25, charge: true, label: '突進' });
    sfx('warn');
  } else if (atk === 'rain') {
    for (var i = 0; i < 5 + b.rage; i++) G.warns.push({ k: 'circle', x: clamp(G.sx + rr2(R + 60), -ROAD + 30, ROAD - 30), z: rr2(40), r: 34, t: 1.0 + i * 0.12, max: 1.0 + i * 0.12, frac: 0.16, rocks: true });
    sfx('warn');
  } else if (atk === 'breath') {
    shuffle([0, 1, 2]).slice(0, 2).forEach(function (l, k) { G.warns.push({ k: 'lane', lane: l, t: 1.1 + k * 0.7, max: 1.1 + k * 0.7, fire: true, label: '炎' }); });
    sfx('warn');
  } else if (atk === 'summon') {
    var cnt = Math.min(70, 26 + s * 4 + b.rage * 10), m = b.def.minion;
    for (var j = 0; j < cnt; j++) addEnemy(pick(m), b.x + rr2(150), b.z - 40 + rr2(40) + Math.floor(j / 10) * 30, 0.9, 0.9, 0.8);
    addText('手下を呼んだ!', 0, 220, '#ffb347', 22, true); sfx('roar');
  }
}
function killBoss() {
  var b = G.boss; b.phase = 'dead'; b.hp = 0;
  G.score += 3000 * G.stage + G.n * 10; G.kills++; G.stageKills++;
  G.enemies.forEach(function (e) { if (!e.dead) killEnemy(e, true); }); G.warns = []; G.ebul = [];
  G.shake = 18; G.flash = 1; G.slow = 1.4; G.clearT = 2.6; sfx('bossdown'); setMusic('off');
  G.banner = { big: '討ち取ったり!', small: '大将 ' + b.def.n + ' を倒した', t: 2.6, col: '#ffd34d', boss: true };
}
function updEbul(dt) {
  var R = squadR();
  for (var i = G.ebul.length - 1; i >= 0; i--) {
    var f = G.ebul[i];
    if (f.mine) {     // こちらが投げた物(爆竹・焙烙玉・花火)
      f.t += dt; var u = Math.min(1, f.t / f.max);
      f.x = f.x0 + (f.tx - f.x0) * u; f.z = f.z0 + (f.tz - f.z0) * u; f.h = Math.sin(u * Math.PI) * (f.k === 'shell' ? 260 : 120);
      if (u >= 1) {
        if (f.k === 'bomb') explode(f.tx, f.tz, 64, f.dmg, true);
        else if (f.k === 'crack') { for (var c = 0; c < 4; c++) G.queue.push({ t: c * 0.09, f: (function (x, z, d) { return function () { explode(x, z, 26, d, false); }; })(f.tx + rr2(30), f.tz + rr2(30), f.dmg) }); sfx('crackle'); }
        else if (f.k === 'shell') firework(f.tx, f.tz, f.dmg);
        G.ebul.splice(i, 1);
      }
      continue;
    }
    f.x += f.vx * dt; f.z += f.vz * dt;
    if (G.n > 0 && Math.abs(f.x - G.sx) < R * 0.9 + f.r && Math.abs(f.z) < R * 0.7 + f.r) {
      var lost = Math.min(G.n, Math.max(1, Math.ceil(G.n * 0.03)));
      G.n -= lost; G.lossB += lost; lostFx(lost); fx('glow', f.x, f.z, 10, 0, 0, 0, 0.2, '#ffb347', 40);
      G.ebul.splice(i, 1); continue;
    }
    if (f.z < -100) G.ebul.splice(i, 1);
  }
}
var HANABI_COL = ['#ff5a7a', '#ffd34d', '#7fd8ff', '#b48cff', '#7dff9a'];
function firework(x, z, dmg) {
  var col = HANABI_COL[Math.floor(Math.random() * HANABI_COL.length)];
  fx('glow', x, z, 200, 0, 0, 0, 0.5, col, 260);
  for (var i = 0; i < 26; i++) { var a = i / 26 * 6.283; fx('spark', x, z, 200, Math.cos(a) * 120, Math.sin(a) * 60, Math.sin(a * 2) * 40, 1.1, col, 12); }
  for (var k = 0; k < 14; k++) G.queue.push({ t: 0.25 + Math.random() * 0.5, f: (function (xx, zz) { return function () { areaDmg(xx, zz, 24, dmg); fx('glow', xx, zz, 6, 0, 0, 0, 0.2, col, 50); }; })(x + rr2(90), z + rr2(70)) });
  if (bossHittable() && Math.abs(G.boss.x - x) < 160) hurtBoss(dmg * 5);
  sfx('firework');
}
function updWarns(dt) {
  var R = squadR();
  for (var i = G.warns.length - 1; i >= 0; i--) {
    var w = G.warns[i]; w.t -= dt;
    if (w.t > 0) continue;
    G.warns.splice(i, 1);
    if (w.k === 'flashring') continue;
    if (w.k === 'circle') {
      var ov = Math.abs(w.z) < w.r + R * 0.8 ? overlap(w.x - w.r, w.x + w.r, R) : 0;
      if (ov > 0) bossHurtsSquad(ov * w.frac);
      fx('ring', w.x, w.z, 2, 0, 0, 0, 0.35, w.arrows ? '#ffe0a0' : '#ff5a4a', w.r * 1.3);
      for (var k = 0; k < (w.big ? 14 : 5); k++) fx('smoke', w.x + rr2(w.r), w.z + rr2(w.r * 0.6), 6, rr2(40), rr2(20), 30 + Math.random() * 40, 0.6, '#6a5a4a', 30);
      if (w.big) { G.shake = 14; sfx('slam'); } else sfx(w.arrows ? 'hit' : 'boom', 0.6);
    } else if (w.k === 'sweep') {
      var safeOv = overlap(laneX(w.safe) - LANE / 2, laneX(w.safe) + LANE / 2, R);
      if (safeOv < 0.999) bossHurtsSquad((1 - safeOv) * w.frac);
      G.shake = 14; sfx('slash'); G.flash = Math.max(G.flash, 0.25);
      for (var j = 0; j < 3; j++) if (j !== w.safe) fx('slashfx', laneX(j), 0, 30, 0, 0, 0, 0.35, '#ffd0c0', LANE);
    } else if (w.k === 'lane') {
      if (w.cav) continue;
      if (w.charge && G.boss && G.boss.phase !== 'dead') { G.boss.dash = { lane: w.lane, t: 0, z: G.boss.z }; continue; }
      if (w.fire) {
        var ovl = overlap(laneX(w.lane) - LANE / 2, laneX(w.lane) + LANE / 2, R);
        if (ovl > 0) bossHurtsSquad(ovl * 0.35);
        for (var q = 0; q < 12; q++) fx('glow', laneX(w.lane) + rr2(LANE / 2), q * 50 - 40, 10, 0, 0, 30, 0.6, '#ff7a2a', 70);
        sfx('boom'); G.shake = 8;
      }
    }
  }
}

/* ---- 効果 ---- */
function fx(k, x, z, h, vx, vz, vh, life, col, size) {
  if (G.fx.length > 440) return;
  G.fx.push({ k: k, x: x, z: z, h: h, vx: vx, vz: vz, vh: vh, life: life, max: life, col: col, size: size, rot: Math.random() * 6 });
}
function sparkAt(x, z, h, col, n) { for (var i = 0; i < n; i++) fx('spark', x, z, h, rr2(120), rr2(60), rr2(100), 0.3, col, 7); }
function addText(txt, x, z, col, size, screen) {
  if (G.texts.length < 30) G.texts.push({ txt: txt, x: x, z: z, col: col, size: size, life: 1.2, max: 1.2, screen: !!screen, dy: 0 });
}
function updFx(dt) {
  var i, f, sp = worldSpeed();
  for (i = G.fx.length - 1; i >= 0; i--) {
    f = G.fx[i]; f.life -= dt; if (f.life <= 0) { G.fx.splice(i, 1); continue; }
    f.x += f.vx * dt; f.z += f.vz * dt; f.h += f.vh * dt;
    if (f.k === 'spark' || f.k === 'plank') { f.vh -= 260 * dt; if (f.h < 0) { f.h = 0; f.vh *= -0.3; } }
    if (f.k === 'smoke') f.vh *= 0.97;
    f.z -= sp * dt * (f.k === 'ink' ? 1 : 0.5);
    f.rot += dt * 8;
  }
  for (i = G.texts.length - 1; i >= 0; i--) { f = G.texts[i]; f.life -= dt; f.dy += 38 * dt; if (f.life <= 0) G.texts.splice(i, 1); }
}
function updAmb(dt) {
  var kind = THEMES[G.theme].amb, want = kind === 'snow' ? 60 : 30;
  while (G.amb.length < want) G.amb.push({ x: Math.random() * W, y: Math.random() * H, s: 1.5 + Math.random() * 3, v: 30 + Math.random() * 60, ph: Math.random() * 6 });
  for (var i = 0; i < G.amb.length; i++) {
    var a = G.amb[i]; a.ph += dt;
    if (kind === 'ember' || kind === 'soul') { a.y -= a.v * dt; a.x += Math.sin(a.ph * 2) * 20 * dt; if (a.y < -10) { a.y = H + 10; a.x = Math.random() * W; } }
    else if (kind === 'firefly') { a.x += Math.sin(a.ph * 0.9) * 14 * dt; a.y += Math.cos(a.ph) * 10 * dt + 8 * dt; if (a.y > H + 10) { a.y = -10; a.x = Math.random() * W; } }
    else { a.y += (a.v + 40) * dt; a.x += (Math.sin(a.ph * 1.5) * 26 + (kind === 'snow' ? -30 : 10)) * dt; if (a.y > H + 10) { a.y = -10; a.x = Math.random() * W; } if (a.x < -10) a.x = W + 10; }
  }
}

/* ---------------- おまかせ操作(確認用: #auto) ---------------- */
function bot() {
  var tgt = null, i, row = null;
  for (i = 0; i < G.gates.length; i++) { var r = G.gates[i]; if (!r.passed && r.z > 0 && r.z < 700 && (!row || r.z < row.z)) row = r; }
  if (row) {
    var best = 1, bv = -1;
    row.list.forEach(function (g, li) { var v = g.kind === 'wpn' ? G.n * 1.45 : gateResult(g, G.n); if (v > bv) { bv = v; best = li; } });
    tgt = laneX(best);
  } else {
    var sx = 0, cnt = 0;
    G.enemies.forEach(function (e) { if (e.z > 0 && e.z < 600) { sx += e.x; cnt++; } });
    if (cnt) tgt = sx / cnt * 0.6; else if (G.boss) tgt = G.boss.x; else tgt = 0;
  }
  var danger = [0, 0, 0];      // 危ない所をよける
  G.warns.forEach(function (w) {
    if (w.k === 'lane') danger[w.lane] += 3;
    else if (w.k === 'sweep') { for (var j = 0; j < 3; j++) if (j !== w.safe) danger[j] += 3; }
    else if (w.k === 'circle') danger[laneOf(w.x)] += w.big ? 2 : 0.6;
  });
  G.props.forEach(function (p) { if (!p.dead && p.z < 500) { for (var j = 0; j < 3; j++) if (laneX(j) > p.x0 && laneX(j) < p.x1) danger[j] += 2; } });
  if (tgt !== null && danger[laneOf(tgt)] > 0) {
    var bl = 0; for (var j = 1; j < 3; j++) if (danger[j] < danger[bl] || (danger[j] === danger[bl] && Math.abs(laneX(j) - G.sx) < Math.abs(laneX(bl) - G.sx))) bl = j;
    if (danger[bl] < danger[laneOf(tgt)]) tgt = laneX(bl);
  }
  if (tgt !== null) G.tx = clamp(tgt, -ROAD + 12, ROAD - 12);
}

/* ================= 描く ================= */
var skyCv = null, skyFor = -1, decoCache = {}, vigCv = null, glowTints = {};
function art(group, key, frame) {
  var A = window.ART, g = A && A[group], v = g && g[key];
  if (!v) return null;
  return v.length ? (v[frame] || v[0]) : v;
}
function tintGlow(col) {
  if (glowTints[col]) return glowTints[col];
  var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
  var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  var w = g.createRadialGradient(32, 32, 0, 32, 32, 10); w.addColorStop(0, 'rgba(255,255,255,.9)'); w.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = w; g.fillRect(0, 0, 64, 64);
  glowTints[col] = c; return c;
}
function buildSky() {
  var th = THEMES[G.theme], w = Math.round(W * SC), h = Math.round((HY + 40) * SC);
  skyCv = document.createElement('canvas'); skyCv.width = Math.max(1, w); skyCv.height = Math.max(1, h);
  var g = skyCv.getContext('2d'); g.scale(SC, SC);
  var gr = g.createLinearGradient(0, 0, 0, HY + 40);
  gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.6, th.sky[1]); gr.addColorStop(1, th.sky[2]);
  g.fillStyle = gr; g.fillRect(0, 0, W, HY + 40);
  if (th.moon) { g.fillStyle = 'rgba(255,255,255,.8)'; for (var i = 0; i < 40; i++) g.fillRect(hash(i, 3) * W, hash(i, 4) * HY * 0.7, 1, 1); }
  var orb = th.sun || th.moon, ox = W * 0.68, oy = HY * (th.moon ? 0.42 : 0.78), orr = th.moon ? 24 : 36;
  var og = g.createRadialGradient(ox, oy, 0, ox, oy, orr * 3.2);
  og.addColorStop(0, orb); og.addColorStop(0.3, orb + '99'); og.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = og; g.fillRect(ox - orr * 4, oy - orr * 4, orr * 8, orr * 8);
  g.fillStyle = orb; g.beginPath(); g.arc(ox, oy, orr, 0, 6.283); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)';
  for (var c = 0; c < 4; c++) { g.beginPath(); g.ellipse(hash(c, 9) * W, HY * (0.2 + c * 0.15), 90 + hash(c, 8) * 60, 6, 0, 0, 6.283); g.fill(); }
  for (var layer = 0; layer < 2; layer++) {
    g.fillStyle = th.mt[layer]; g.beginPath(); g.moveTo(0, HY + 40);
    for (var x = 0; x <= W; x += 12) g.lineTo(x, HY - (layer ? 12 : 30) - Math.abs(Math.sin(x * 0.013 + layer * 2.1)) * (layer ? 18 : 34) - Math.sin(x * 0.041 + layer) * 6);
    g.lineTo(W, HY + 40); g.closePath(); g.fill();
  }
  if (th.castle) {      // お城のかげ
    var cx = W * 0.3, cy = HY - 14;
    g.fillStyle = th.castle === 2 ? '#1a0604' : '#06080f';
    g.fillRect(cx - 34, cy - 6, 68, 10); g.fillRect(cx - 24, cy - 18, 48, 12); g.fillRect(cx - 16, cy - 30, 32, 12); g.fillRect(cx - 9, cy - 40, 18, 10);
    for (var r = 0; r < 4; r++) { var ww = 46 - r * 11; g.beginPath(); g.moveTo(cx - ww, cy - 6 - r * 12); g.lineTo(cx + ww, cy - 6 - r * 12); g.lineTo(cx + ww - 8, cy - 12 - r * 12); g.lineTo(cx - ww + 8, cy - 12 - r * 12); g.closePath(); g.fill(); }
    if (th.castle === 2) { var fg = g.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 70); fg.addColorStop(0, 'rgba(255,120,40,.6)'); fg.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = fg; g.fillRect(cx - 80, cy - 90, 160, 110); }
    else { g.fillStyle = '#ffcf6a'; g.fillRect(cx - 4, cy - 24, 3, 3); g.fillRect(cx + 6, cy - 12, 3, 3); }
  }
  var hz = g.createLinearGradient(0, HY - 30, 0, HY + 40);
  hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.6, th.fog); hz.addColorStop(1, th.fog);
  g.fillStyle = hz; g.fillRect(0, HY - 30, W, 70);
  skyFor = G.theme;
  vigCv = document.createElement('canvas'); vigCv.width = Math.max(1, Math.round(W * SC / 2)); vigCv.height = Math.max(1, Math.round(H * SC / 2));
  var v = vigCv.getContext('2d'); v.scale(SC / 2, SC / 2);
  var vg = v.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  v.fillStyle = vg; v.fillRect(0, 0, W, H);
}
function decoSprite(type) {
  var key = type + G.theme; if (decoCache[key]) return decoCache[key];
  var c = document.createElement('canvas'); c.width = 128; c.height = 192; var g = c.getContext('2d');
  var snow = G.theme === 3, i;
  g.translate(64, 186);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 0, 40, 9, 0, 0, 6.283); g.fill();
  if (type === 'sakura') {
    g.fillStyle = '#3a2416'; g.beginPath(); g.moveTo(-7, 0); g.lineTo(-4, -70); g.lineTo(-22, -110); g.lineTo(-16, -112); g.lineTo(0, -82); g.lineTo(14, -116); g.lineTo(20, -112); g.lineTo(6, -70); g.lineTo(8, 0); g.closePath(); g.fill();
    var cols = ['#c25a84', '#e88ab0', '#f7b6cf', '#ffd6e5'];
    for (i = 0; i < 26; i++) { g.fillStyle = cols[Math.min(3, Math.floor(hash(i, 1) * 4))]; g.beginPath(); g.arc((hash(i, 2) - 0.5) * 100, -110 - hash(i, 3) * 60 + Math.abs(hash(i, 2) - 0.5) * 40, 14 + hash(i, 4) * 12, 0, 6.283); g.fill(); }
  } else if (type === 'bamboo') {
    for (i = -2; i <= 2; i++) {
      var bx = i * 18 + (hash(i, 5) - 0.5) * 8, gr2 = g.createLinearGradient(bx - 6, 0, bx + 6, 0);
      gr2.addColorStop(0, '#2f5a22'); gr2.addColorStop(0.5, '#7fb24a'); gr2.addColorStop(1, '#2f5a22');
      g.fillStyle = gr2; g.fillRect(bx - 5, -186, 10, 186);
      g.fillStyle = '#244a1a'; for (var s2 = 1; s2 < 6; s2++) g.fillRect(bx - 6, -s2 * 34, 12, 3);
    }
    g.fillStyle = '#5a8a3a'; for (i = 0; i < 14; i++) { g.beginPath(); g.ellipse((hash(i, 6) - 0.5) * 110, -120 - hash(i, 7) * 60, 18, 4, (hash(i, 8) - 0.5) * 1.6, 0, 6.283); g.fill(); }
  } else if (type === 'lantern') {
    g.fillStyle = '#7d7a74'; g.fillRect(-6, -40, 12, 40); g.fillRect(-22, -6, 44, 8); g.fillRect(-16, -64, 32, 24);
    g.fillStyle = '#ffcf6a'; g.fillRect(-9, -58, 18, 12);
    g.fillStyle = '#5a5852'; g.beginPath(); g.moveTo(-28, -64); g.lineTo(28, -64); g.lineTo(0, -86); g.closePath(); g.fill();
    var lg = g.createRadialGradient(0, -52, 0, 0, -52, 50); lg.addColorStop(0, 'rgba(255,200,90,.45)'); lg.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = lg; g.fillRect(-50, -102, 100, 100);
  } else if (type === 'rock') {
    g.fillStyle = '#5a5856'; g.beginPath(); g.ellipse(0, -14, 30, 20, 0, 0, 6.283); g.fill();
    g.fillStyle = '#7a7874'; g.beginPath(); g.ellipse(-8, -22, 14, 9, 0, 0, 6.283); g.fill();
    if (snow) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -30, 22, 6, 0, 0, 6.283); g.fill(); }
  } else if (type === 'jizo') {
    g.fillStyle = '#8a8782'; rrect(g, -14, -44, 28, 44, 10); g.fill(); g.beginPath(); g.arc(0, -52, 12, 0, 6.283); g.fill();
    g.fillStyle = '#c8302a'; g.beginPath(); g.moveTo(-15, -42); g.lineTo(15, -42); g.lineTo(0, -24); g.closePath(); g.fill();
    if (snow) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -62, 12, 5, 0, 0, 6.283); g.fill(); }
  } else if (type === 'house') {
    g.fillStyle = '#2c2838'; g.fillRect(-46, -70, 92, 70);
    g.fillStyle = '#ffcf6a'; g.fillRect(-34, -50, 22, 18); g.fillRect(10, -50, 22, 18);
    g.fillStyle = '#7a5a2a'; g.fillRect(-34, -42, 22, 2); g.fillRect(10, -42, 22, 2);
    g.fillStyle = '#14121c'; g.beginPath(); g.moveTo(-60, -66); g.lineTo(60, -66); g.lineTo(40, -104); g.lineTo(-40, -104); g.closePath(); g.fill();
    var hg = g.createRadialGradient(0, -40, 0, 0, -40, 80); hg.addColorStop(0, 'rgba(255,190,90,.25)'); hg.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = hg; g.fillRect(-64, -120, 128, 120);
  } else if (type === 'torii') {
    g.fillStyle = '#b82a1c'; g.fillRect(-40, -120, 10, 120); g.fillRect(30, -120, 10, 120); g.fillRect(-50, -108, 100, 9);
    g.fillStyle = '#1a0a08'; g.beginPath(); g.moveTo(-60, -124); g.lineTo(60, -124); g.lineTo(56, -134); g.lineTo(-56, -134); g.closePath(); g.fill();
    g.fillStyle = '#d23a2a'; g.fillRect(-52, -124, 104, 6);
  } else if (type === 'pine') {
    g.fillStyle = '#3a2a1a'; g.fillRect(-6, -40, 12, 40);
    for (i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#1f4030' : '#25503a'; g.beginPath(); g.moveTo(-52 + i * 9, -30 - i * 34); g.lineTo(52 - i * 9, -30 - i * 34); g.lineTo(0, -84 - i * 34); g.closePath(); g.fill();
      if (snow) { g.fillStyle = '#f4f8fc'; g.beginPath(); g.moveTo(-26 + i * 5, -58 - i * 34); g.lineTo(26 - i * 5, -58 - i * 34); g.lineTo(0, -84 - i * 34); g.closePath(); g.fill(); }
    }
  } else if (type === 'flag') {
    g.fillStyle = '#2a1a10'; g.fillRect(-3, -180, 5, 180);
    var fc = '#c8302a';
    g.fillStyle = fc; g.fillRect(3, -172, 30, 110); g.fillStyle = '#e8e0c8'; g.beginPath(); g.arc(18, -140, 9, 0, 6.283); g.fill();
    g.fillStyle = fc; g.beginPath(); g.arc(18, -140, 5, 0, 6.283); g.fill();
  } else if (type === 'fire') {
    var fg2 = g.createRadialGradient(0, -40, 0, 0, -40, 70); fg2.addColorStop(0, 'rgba(255,170,60,.7)'); fg2.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = fg2; g.fillRect(-70, -110, 140, 110);
    g.fillStyle = '#ff5a1a'; g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-30, -40, 0, -90); g.quadraticCurveTo(30, -40, 26, 0); g.closePath(); g.fill();
    g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-12, -24, 0, -50); g.quadraticCurveTo(12, -24, 12, 0); g.closePath(); g.fill();
  } else if (type === 'higan') {      // 彼岸花
    for (i = 0; i < 9; i++) {
      var hx = (hash(i, 11) - 0.5) * 90, hh = 30 + hash(i, 12) * 40;
      g.strokeStyle = '#2a5a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, 0); g.lineTo(hx, -hh); g.stroke();
      g.strokeStyle = '#ff2a3a';
      for (var pp = 0; pp < 7; pp++) { var aa = pp / 7 * 6.283; g.beginPath(); g.moveTo(hx, -hh); g.quadraticCurveTo(hx + Math.cos(aa) * 10, -hh - 10 + Math.sin(aa) * 4, hx + Math.cos(aa) * 14, -hh - 2 + Math.sin(aa) * 8); g.stroke(); }
    }
  }
  decoCache[key] = c; return c;
}
function drawBG() {
  var th = THEMES[G.theme];
  if (skyFor !== G.theme || !skyCv) buildSky();
  ctx.drawImage(skyCv, 0, 0, W, HY + 40);
  ctx.fillStyle = th.grass; ctx.fillRect(0, HY, W, H - HY);
  var zf = SPAWN + 200, yF = py(zf), xF = ROAD * KX * sOf(zf);
  var yN = H + 40, sN = (yN - HY) / (SY - HY), xN = ROAD * KX * sN;
  ctx.fillStyle = th.edge; ctx.beginPath(); ctx.moveTo(CX - xF * 1.1, yF); ctx.lineTo(CX + xF * 1.1, yF); ctx.lineTo(CX + xN * 1.1, yN); ctx.lineTo(CX - xN * 1.1, yN); ctx.closePath(); ctx.fill();
  ctx.fillStyle = th.road[0]; ctx.beginPath(); ctx.moveTo(CX - xF, yF); ctx.lineTo(CX + xF, yF); ctx.lineTo(CX + xN, yN); ctx.lineTo(CX - xN, yN); ctx.closePath(); ctx.fill();
  // 進むしま模様(速さを感じさせる)
  ctx.fillStyle = th.road[1];
  var step = 90, off = G.dist % (step * 2);
  for (var z = -off - 200; z < zf; z += step * 2) {
    var za = Math.max(z, -D0 + 60), zb = Math.max(z + step, -D0 + 60);
    if (zb <= za) continue;
    var ya = py(za), yb = py(zb), xa = ROAD * KX * sOf(za), xb = ROAD * KX * sOf(zb);
    ctx.beginPath(); ctx.moveTo(CX - xa, ya); ctx.lineTo(CX + xa, ya); ctx.lineTo(CX + xb, yb); ctx.lineTo(CX - xb, yb); ctx.closePath(); ctx.fill();
  }
  // 3列の区切り
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
  [-0.5, 0.5].forEach(function (k) { ctx.beginPath(); ctx.moveTo(CX + LANE * k * KX * sOf(zf), yF); ctx.lineTo(CX + LANE * k * KX * sN, yN); ctx.stroke(); });
  // 道ばたの飾り(遠いほうから)
  var dstep = 150, doff = G.dist % dstep, kBase = Math.floor(G.dist / dstep), list = [];
  for (var kk = 0; kk < 14; kk++) {
    var zz = kk * dstep - doff - 60, idx = kBase + kk;
    for (var side = 0; side < 2; side++) {
      if (hash(idx, 50 + side) < 0.15) continue;
      list.push([zz, (ROAD + 50 + hash(idx, 70 + side) * 70) * (side ? 1 : -1), th.deco[Math.floor(hash(idx, 60 + side) * th.deco.length)]]);
    }
  }
  list.sort(function (a, b) { return b[0] - a[0]; });
  for (var d = 0; d < list.length; d++) {
    var it = list[d]; if (it[0] < -D0 + 80) continue;
    var s = sOf(it[0]), spr = decoSprite(it[2]), sz = 150 * s, X = px(it[1], it[0]), Y = py(it[0]);
    if (X + sz < -20 || X - sz > W + 20) continue;
    ctx.globalAlpha = fogA(it[0]);
    ctx.drawImage(spr, X - sz * 0.5, Y - sz * 1.45, sz, sz * 1.5);
  }
  ctx.globalAlpha = 1;
  var fg = ctx.createLinearGradient(0, HY, 0, HY + (SY - HY) * 0.32);      // 霧(遠くは かすむ)
  fg.addColorStop(0, th.fog); fg.addColorStop(1, th.fog + '00');
  ctx.fillStyle = fg; ctx.fillRect(0, HY - 1, W, (SY - HY) * 0.32 + 1);
}
function groundQuad(x0, x1, z0, z1) {
  ctx.beginPath(); ctx.moveTo(px(x0, z0), py(z0)); ctx.lineTo(px(x1, z0), py(z0)); ctx.lineTo(px(x1, z1), py(z1)); ctx.lineTo(px(x0, z1), py(z1)); ctx.closePath();
}
function groundEllipse(x, z, r) {
  var s = sOf(z); ctx.beginPath(); ctx.ellipse(px(x, z), py(z), Math.max(0.5, r * KX * s), Math.max(0.5, r * s * 0.55), 0, 0, 6.283);
}
function label(t, x, y, col, size) {
  ctx.font = size + 'px ' + NUMF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,6,4,.85)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
}
function drawWarns() {
  for (var i = 0; i < G.warns.length; i++) {
    var w = G.warns[i], p = 1 - w.t / w.max, blink = 0.5 + 0.5 * Math.sin(G.t * 22);
    if (w.k === 'circle') {
      ctx.fillStyle = w.arrows ? 'rgba(255,200,80,' + (0.12 + p * 0.2) + ')' : 'rgba(255,40,30,' + (0.15 + p * 0.25) + ')';
      groundEllipse(w.x, w.z, w.r); ctx.fill();
      ctx.fillStyle = w.arrows ? 'rgba(255,210,90,.4)' : 'rgba(255,60,40,.45)'; groundEllipse(w.x, w.z, w.r * p); ctx.fill();
      ctx.strokeStyle = w.arrows ? 'rgba(255,220,120,.9)' : 'rgba(255,90,70,' + (0.6 + blink * 0.4) + ')'; ctx.lineWidth = 2; groundEllipse(w.x, w.z, w.r); ctx.stroke();
    } else if (w.k === 'sweep') {
      for (var j = 0; j < 3; j++) {
        if (j === w.safe) { ctx.fillStyle = 'rgba(120,255,160,.18)'; groundQuad(laneX(j) - LANE / 2, laneX(j) + LANE / 2, -90, 140); ctx.fill(); continue; }
        ctx.fillStyle = 'rgba(255,30,20,' + (0.18 + p * 0.3 + blink * 0.08) + ')';
        groundQuad(laneX(j) - LANE / 2 + 2, laneX(j) + LANE / 2 - 2, -90, 140); ctx.fill();
      }
      label('安全', px(laneX(w.safe), 60), py(60), '#9dffb8', 18);
    } else if (w.k === 'lane') {
      var col = w.fire ? '255,120,30' : '255,40,30';
      ctx.fillStyle = 'rgba(' + col + ',' + (0.14 + p * 0.25 + blink * 0.1) + ')';
      groundQuad(laneX(w.lane) - LANE / 2 + 3, laneX(w.lane) + LANE / 2 - 3, -100, 1400); ctx.fill();
      ctx.fillStyle = 'rgba(' + col + ',.85)';
      for (var a = 0; a < 6; a++) {        // 矢じるし(手前へ)
        var az = 1300 - ((G.t * 400 + a * 230) % 1380), ax = laneX(w.lane), s = sOf(az), yy = py(az), ww = 26 * KX * s;
        ctx.beginPath(); ctx.moveTo(px(ax, az) - ww, yy - 12 * s); ctx.lineTo(px(ax, az), yy + 6 * s); ctx.lineTo(px(ax, az) + ww, yy - 12 * s); ctx.lineTo(px(ax, az), yy - 4 * s); ctx.closePath(); ctx.fill();
      }
      if (w.label) label(w.label + '!', px(laneX(w.lane), 260), py(260), '#ffd0c0', 18);
    } else if (w.k === 'flashring') {
      ctx.strokeStyle = 'rgba(255,60,40,' + (1 - p) + ')'; ctx.lineWidth = 4; groundEllipse(w.x, 0, squadR() * (1 + p)); ctx.stroke();
    }
  }
}

/* ---- 立っている物を 遠い順に描く ---- */
var DL = [];
function drawWorld() {
  DL.length = 0;
  var i;
  for (i = 0; i < G.enemies.length; i++) { var e = G.enemies[i]; if (e.z < SPAWN + 100 && e.z > -D0 + 40) DL.push({ z: e.z, t: 1, o: e }); }
  var m = G.n <= 0 && G.state === 'play' ? 0 : Math.floor(G.state === 'title' ? 60 : G.nShow);
  for (i = 0; i < m; i++) DL.push({ z: FORM[i].z, t: 0, o: i });
  for (i = 0; i < G.gates.length; i++) DL.push({ z: G.gates[i].z, t: 3, o: G.gates[i] });
  for (i = 0; i < G.props.length; i++) DL.push({ z: G.props[i].z, t: 4, o: G.props[i] });
  if (G.boss) DL.push({ z: G.boss.z, t: 2, o: G.boss });
  DL.sort(function (a, b) { return b.z - a.z; });
  var sxw = G.state === 'title' ? Math.sin(G.t * 0.6) * 40 : G.sx;
  for (i = 0; i < DL.length; i++) {
    var d = DL[i];
    if (d.t === 0) drawUnit(d.o, sxw);
    else if (d.t === 1) drawEnemy(d.o);
    else if (d.t === 2) drawBoss(d.o);
    else if (d.t === 3) drawGateRow(d.o);
    else drawProp(d.o);
  }
}
function drawUnit(i, sxw) {
  var u = FORM[i], z = u.z, s = sOf(z), x = px(sxw + u.x, z), y = py(z);
  var ph = Math.sin(G.t * 11 + u.ph), sp = art('unit', u.k, ph > 0 ? 0 : 1), sz = 46 * s;
  if (sp) ctx.drawImage(sp, x - sz / 2, y - sz * 0.96 + ph * 1.2 * s, sz, sz);
  else { ctx.fillStyle = u.k === 'nin' ? '#222' : '#2f62d8'; ctx.beginPath(); ctx.arc(x, y - 12 * s, 8 * s, 0, 6.283); ctx.fill(); }
}
function drawEnemy(e) {
  var s = sOf(e.z), x = px(e.x, e.z), y = py(e.z), T = e.T, sz = T.px * s;
  if (x < -sz || x > W + sz) return;
  var ph = Math.sin(e.ph * (e.type === 'kiba' ? 16 : 10)), sp = art('enemy', e.type, ph > 0 ? 0 : 1);
  ctx.globalAlpha = fogA(e.z) * (T.ghost ? 0.82 : 1);
  if (sp) ctx.drawImage(sp, x - sz / 2, y - sz * 0.97 + (T.ghost ? Math.sin(e.ph * 3) * 3 * s : ph * 1.5 * s), sz, sz);
  else { ctx.fillStyle = '#a02020'; ctx.beginPath(); ctx.arc(x, y - sz * 0.4, sz * 0.3, 0, 6.283); ctx.fill(); }
  if (e.flash > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45;
    ctx.drawImage(tintGlow('#ffffff'), x - sz * 0.4, y - sz * 0.8, sz * 0.8, sz * 0.8);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
  if (T.big && e.hp < e.hpMax && e.z < 1100) {
    var bw = 34 * s + 10;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - bw / 2, y - sz - 6, bw, 5);
    ctx.fillStyle = '#ff4a3a'; ctx.fillRect(x - bw / 2 + 1, y - sz - 5, (bw - 2) * Math.max(0, e.hp / e.hpMax), 3);
  }
}
function drawBoss(b) {
  var z = b.z, s = sOf(z), x = px(b.x, z), y = py(z), a = b.phase === 'dead' ? Math.max(0, 1 - b.deadT / 1.8) : fogA(z);
  var sz = 560 * s * (1 + Math.sin(b.t * 2.2) * 0.012), fr = Math.sin(b.t * (b.rage ? 5 : 3)) > 0 ? 0 : 1;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (0.35 + b.rage * 0.15);      // 不気味な光
  ctx.drawImage(tintGlow(b.rage ? '#ff2a1a' : '#8a1a3a'), x - sz * 0.6, y - sz * 0.95, sz * 1.2, sz * 1.0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
  var sp = art('boss', b.def.k, fr);
  if (sp) ctx.drawImage(sp, x - sz / 2, y - sz * 0.98, sz, sz);
  else { ctx.fillStyle = '#801010'; ctx.beginPath(); ctx.arc(x, y - sz * 0.4, sz * 0.3, 0, 6.283); ctx.fill(); }
  if (b.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; ctx.drawImage(tintGlow('#ffffff'), x - sz * 0.35, y - sz * 0.8, sz * 0.7, sz * 0.7); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1;
}
function drawGateRow(row) {
  var z = row.z; if (z < -D0 + 60) return;
  var s = sOf(z), y = py(z), H0 = 96 * s, a = Math.max(0, row.fade) * fogA(z);
  for (var k = 0; k < row.list.length; k++) {
    var g = row.list[k], X0 = px(g.x0, z), X1 = px(g.x1, z), w = X1 - X0, good = gateGood(g), wpn = g.kind === 'wpn';
    ctx.globalAlpha = row.passed && !g.chosen ? a * 0.35 : a;
    var gr = ctx.createLinearGradient(0, y - H0, 0, y);      // 光る幕
    if (wpn) { gr.addColorStop(0, 'rgba(255,200,80,.85)'); gr.addColorStop(1, 'rgba(200,90,20,.45)'); }
    else if (good) { gr.addColorStop(0, 'rgba(90,200,255,.85)'); gr.addColorStop(1, 'rgba(30,90,220,.4)'); }
    else { gr.addColorStop(0, 'rgba(255,90,80,.85)'); gr.addColorStop(1, 'rgba(180,20,20,.4)'); }
    ctx.fillStyle = gr; ctx.fillRect(X0 + 4 * s, y - H0, w - 8 * s, H0);
    ctx.fillStyle = 'rgba(255,255,255,.18)';      // 流れる光の筋
    var sh = ((G.t * 0.8 + k * 0.3) % 1) * (w + 40 * s) - 20 * s;
    ctx.beginPath(); ctx.moveTo(X0 + sh, y - H0); ctx.lineTo(X0 + sh + 16 * s, y - H0); ctx.lineTo(X0 + sh - 10 * s, y); ctx.lineTo(X0 + sh - 26 * s, y); ctx.closePath(); ctx.fill();
    if (g.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, g.flash * 3) + ')'; ctx.fillRect(X0, y - H0, w, H0); }
    // 柱と笠木(鳥居のような門)
    ctx.fillStyle = '#1a0a06'; ctx.fillRect(X0 - 3 * s, y - H0 - 6 * s, 9 * s, H0 + 6 * s); ctx.fillRect(X1 - 6 * s, y - H0 - 6 * s, 9 * s, H0 + 6 * s);
    ctx.fillStyle = wpn ? '#c8a040' : good ? '#2a6fd6' : '#c8302a';
    ctx.fillRect(X0 - 1 * s, y - H0 - 4 * s, 5 * s, H0 + 4 * s); ctx.fillRect(X1 - 4 * s, y - H0 - 4 * s, 5 * s, H0 + 4 * s);
    ctx.fillStyle = '#120604'; ctx.beginPath(); ctx.moveTo(X0 - 10 * s, y - H0 - 6 * s); ctx.lineTo(X1 + 10 * s, y - H0 - 6 * s); ctx.lineTo(X1 + 14 * s, y - H0 - 15 * s); ctx.lineTo(X0 - 14 * s, y - H0 - 15 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = wpn ? '#ffd34d' : good ? '#5ab0ff' : '#ff5a4a'; ctx.fillRect(X0 - 8 * s, y - H0 - 7 * s, w + 16 * s, 2.5 * s);
    var cx = (X0 + X1) / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (wpn) {
      var ic = art('icon', g.w, 0), isz = 50 * s;
      ctx.fillStyle = 'rgba(30,10,4,.55)'; ctx.beginPath(); ctx.arc(cx, y - H0 * 0.58, isz * 0.6, 0, 6.283); ctx.fill();
      if (ic) ctx.drawImage(ic, cx - isz / 2, y - H0 * 0.58 - isz / 2, isz, isz);
      ctx.font = Math.max(7, (wname(g.w).length > 3 ? 12 : 15) * s) + 'px ' + NUMF;
      ctx.lineWidth = 4 * s; ctx.strokeStyle = '#2a0e04'; var nm = wname(g.w);
      ctx.strokeText(nm, cx, y - H0 * 0.14); ctx.fillStyle = '#fff'; ctx.fillText(nm, cx, y - H0 * 0.14);
      ctx.font = Math.max(6, 12 * s) + 'px ' + NUMF; ctx.strokeText('Lv' + g.lv, cx, y - H0 * 0.92); ctx.fillStyle = '#ffe9a0'; ctx.fillText('Lv' + g.lv, cx, y - H0 * 0.92);
    } else {
      var lab = gateLabel(g), fs = Math.max(8, (lab.length > 4 ? 26 : 32) * s);
      ctx.font = fs + 'px ' + NUMF;
      ctx.lineWidth = 6 * s; ctx.strokeStyle = 'rgba(10,4,2,.7)'; ctx.strokeText(lab, cx, y - H0 * 0.5);
      ctx.fillStyle = '#fff'; ctx.fillText(lab, cx, y - H0 * 0.5);
    }
  }
  ctx.globalAlpha = 1;
}
function drawProp(pr) {
  var z = pr.z; if (z < -D0 + 60) return;
  var s = sOf(z), y = py(z), X0 = px(pr.x0, z), X1 = px(pr.x1, z), r = 30 * s;
  ctx.globalAlpha = (pr.dead ? Math.max(0, pr.fade) : 1) * fogA(z);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(X0, y - 4 * s, X1 - X0, 8 * s);
  var gr = ctx.createLinearGradient(0, y - r * 2, 0, y);
  gr.addColorStop(0, pr.flash > 0 ? '#f0c890' : '#a8743c'); gr.addColorStop(0.5, '#7a4e22'); gr.addColorStop(1, '#3a220c');
  ctx.fillStyle = gr; ctx.fillRect(X0 + r * 0.5, y - r * 2, X1 - X0 - r, r * 2);
  [X0 + r * 0.5, X1 - r * 0.5].forEach(function (ex) {      // 木の輪(両はし)
    ctx.fillStyle = '#c8945a'; ctx.beginPath(); ctx.ellipse(ex, y - r, r * 0.45, r, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#7a4e22'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(ex, y - r, r * 0.28, r * 0.6, 0, 0, 6.283); ctx.stroke();
  });
  ctx.strokeStyle = 'rgba(40,20,6,.6)'; ctx.lineWidth = 2 * s;
  for (var k = 0; k < 4; k++) { var yy = y - r * 2 + ((pr.rot * 10 + k * 15) % 60) / 60 * r * 2; ctx.beginPath(); ctx.moveTo(X0 + r, yy); ctx.lineTo(X1 - r, yy); ctx.stroke(); }
  if (!pr.dead) {
    var bw = (X1 - X0) * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect((X0 + X1) / 2 - bw / 2, y - r * 2 - 10 * s, bw, 6 * s);
    ctx.fillStyle = '#7dff8a'; ctx.fillRect((X0 + X1) / 2 - bw / 2 + 1, y - r * 2 - 9 * s, (bw - 2) * Math.max(0, pr.hp / pr.hpMax), 4 * s);
  }
  ctx.globalAlpha = 1;
}
function drawShots() {
  ctx.globalCompositeOperation = 'lighter';
  var bs = G.bullets, i;
  for (i = 0; i < bs.length; i++) {
    var b = bs[i], s = sOf(b.z), x = px(b.x, b.z), y = py(b.z) - b.h * s;
    var x2 = px(b.x - b.vx * 0.03, b.z - 34), y2 = py(b.z - 34) - b.h * sOf(b.z - 34);
    switch (b.kind) {
      case 'arrow': ctx.strokeStyle = 'rgba(255,240,210,.85)'; ctx.lineWidth = Math.max(1, 2 * s); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); break;
      case 'kunai': ctx.strokeStyle = 'rgba(200,240,255,.95)'; ctx.lineWidth = Math.max(1, 2.4 * s); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); break;
      case 'star':
        ctx.fillStyle = 'rgba(220,235,255,.95)'; ctx.save(); ctx.translate(x, y); ctx.rotate(b.rot); var r = 6 * s + 1;
        ctx.beginPath(); for (var q = 0; q < 8; q++) { var aa = q * Math.PI / 4, rad = q % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(aa) * rad, Math.sin(aa) * rad); } ctx.closePath(); ctx.fill(); ctx.restore(); break;
      case 'ball': ctx.drawImage(tintGlow('#ffd27a'), x - 10 * s - 2, y - 10 * s - 2, 20 * s + 4, 20 * s + 4); ctx.strokeStyle = 'rgba(255,220,120,.8)'; ctx.lineWidth = Math.max(1, 2 * s); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); break;
      case 'fire': ctx.drawImage(tintGlow('#ff7a2a'), x - 12 * s - 2, y - 12 * s - 2, 24 * s + 4, 24 * s + 4); ctx.strokeStyle = 'rgba(255,150,50,.9)'; ctx.lineWidth = Math.max(1, 3 * s); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); break;
      case 'shell': ctx.drawImage(tintGlow('#ff9a3a'), x - 18 * s - 2, y - 18 * s - 2, 36 * s + 4, 36 * s + 4); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(x, y, 6 * s + 1, 0, 6.283); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; break;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (i = 0; i < G.ebul.length; i++) {      // 投げた物・敵の弾
    var f = G.ebul[i], s2 = sOf(f.z), X = px(f.x, f.z), Y = py(f.z) - (f.h || 0) * s2;
    if (f.mine) {
      if (f.k === 'bomb') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(X, Y, 9 * s2 + 1, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(X + 5 * s2, Y - 7 * s2, 3 * s2 + 1, 0, 6.283); ctx.fill(); }
      else if (f.k === 'crack') { ctx.fillStyle = '#d0302a'; ctx.fillRect(X - 5 * s2, Y - 2 * s2, 10 * s2 + 1, 4 * s2 + 1); ctx.fillStyle = '#ffd34d'; ctx.fillRect(X + 5 * s2, Y - 1, 2, 2); }
      else { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tintGlow('#fff0c0'), X - 10, Y - 10, 20, 20); ctx.globalCompositeOperation = 'source-over'; }
    } else {
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tintGlow('#ffb347'), X - 12 * s2 - 3, Y - 12 * s2 - 3, 24 * s2 + 6, 24 * s2 + 6); ctx.globalCompositeOperation = 'source-over';
    }
  }
  var icF = art('icon', 'fuma', 0);      // 風魔手裏剣
  for (i = 0; i < G.fumas.length; i++) {
    var fu = G.fumas[i], s3 = sOf(fu.z), fs = 54 * s3;
    ctx.save(); ctx.translate(px(fu.x, fu.z), py(fu.z) - 20 * s3); ctx.rotate(fu.rot); if (icF) ctx.drawImage(icF, -fs / 2, -fs / 2, fs, fs); ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (i = 0; i < G.waves.length; i++) {      // 妖刀の斬撃
    var v = G.waves[i], zz = v.z, s4 = sOf(zz), xl = px(v.x - v.hw, zz), xr = px(v.x + v.hw, zz), yy = py(zz) - 16 * s4;
    ctx.strokeStyle = 'rgba(200,120,255,' + Math.max(0.1, 0.9 - zz / 1600) + ')'; ctx.lineWidth = 6 * s4 + 1;
    ctx.beginPath(); ctx.moveTo(xl, yy + 10 * s4); ctx.quadraticCurveTo((xl + xr) / 2, yy - 26 * s4, xr, yy + 10 * s4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,255,.8)'; ctx.lineWidth = 2 * s4 + 0.5; ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  var L = G.spec.kusarigama || 0;      // 鎖鎌
  if (L && G.n > 0 && G.state === 'play') {
    var R = squadR() + 22, icK = art('icon', 'kusarigama', 0);
    for (var k = 0; k < L; k++) {
      var an = G.t * 5 + k * Math.PI * 2 / L, kx = G.sx + Math.cos(an) * R, kz = Math.sin(an) * R * 0.8, s5 = sOf(kz);
      ctx.strokeStyle = 'rgba(200,200,220,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px(G.sx, 0), py(0) - 20); ctx.lineTo(px(kx, kz), py(kz) - 14 * s5); ctx.stroke();
      if (icK) { ctx.save(); ctx.translate(px(kx, kz), py(kz) - 14 * s5); ctx.rotate(an * 2); ctx.drawImage(icK, -17 * s5, -17 * s5, 34 * s5, 34 * s5); ctx.restore(); }
    }
  }
}
function drawFx() {
  var A = window.ART && ART.fx, i;
  for (i = 0; i < G.fx.length; i++) {
    var f = G.fx[i], a = f.life / f.max;
    if (f.z < -D0 + 40) continue;
    var s = sOf(f.z), x = px(f.x, f.z), y = py(f.z) - f.h * s, sz = f.size * s;
    switch (f.k) {
      case 'smoke': ctx.globalAlpha = a * 0.55; if (A && A.smoke) ctx.drawImage(A.smoke, x - sz / 2, y - sz / 2, sz, sz); break;
      case 'ink': ctx.globalAlpha = a * 0.7; if (A && A.ink) { ctx.save(); ctx.translate(x, py(f.z)); ctx.scale(1, 0.45); ctx.drawImage(A.ink, -sz / 2, -sz / 2, sz, sz); ctx.restore(); } break;
      case 'plank': ctx.globalAlpha = a; ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot); ctx.fillStyle = f.col; ctx.fillRect(-sz / 2, -sz / 6, sz, sz / 3); ctx.restore(); break;
      case 'soul': ctx.globalAlpha = a * 0.8; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tintGlow('#cfe8ff'), x - sz, y - sz, sz * 2, sz * 2); ctx.globalCompositeOperation = 'source-over'; break;
      case 'ring': ctx.globalAlpha = a; ctx.strokeStyle = f.col; ctx.lineWidth = 3 * a + 1; groundEllipse(f.x, f.z, f.size * (1.4 - a * 0.5)); ctx.stroke(); break;
      case 'slashfx': ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,220,200,.5)'; groundQuad(f.x - LANE / 2, f.x + LANE / 2, -60, 100); ctx.fill(); break;
      case 'bolt':
        ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#d8f8ff'; ctx.lineWidth = 3;
        var by = py(f.z) - 10 * s; ctx.beginPath(); ctx.moveTo(x, by);
        for (var q = 1; q <= 7; q++) ctx.lineTo(x + Math.sin(f.seed + q * 7.3) * 14, by - (by + 20) * q / 7);
        ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(120,200,255,.35)'; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; break;
      default:   // glow / spark
        ctx.globalAlpha = Math.min(1, a * 1.4); ctx.globalCompositeOperation = 'lighter';
        if (f.k === 'spark' && A && A.spark) ctx.drawImage(A.spark, x - sz / 2, y - sz / 2, sz, sz);
        else ctx.drawImage(tintGlow(f.col), x - sz / 2, y - sz / 2, sz, sz);
        ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalAlpha = 1;
}
function drawAmb() {
  var kind = THEMES[G.theme].amb;
  for (var i = 0; i < G.amb.length; i++) {
    var a = G.amb[i];
    if (kind === 'petal') { ctx.fillStyle = 'rgba(255,190,215,.9)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.s, a.s * 0.55, a.ph, 0, 6.283); ctx.fill(); }
    else if (kind === 'leaf') { ctx.fillStyle = 'rgba(160,210,110,.7)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.s * 1.3, a.s * 0.4, a.ph, 0, 6.283); ctx.fill(); }
    else if (kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(a.x, a.y, a.s * 0.6, 0, 6.283); ctx.fill(); }
    else if (kind === 'firefly') { ctx.fillStyle = 'rgba(220,255,120,' + (0.4 + 0.4 * Math.sin(a.ph * 3)) + ')'; ctx.beginPath(); ctx.arc(a.x, a.y, 1.8, 0, 6.283); ctx.fill(); }
    else if (kind === 'soul') { ctx.fillStyle = 'rgba(160,220,255,' + (0.3 + 0.3 * Math.sin(a.ph * 3)) + ')'; ctx.beginPath(); ctx.arc(a.x, a.y, a.s * 0.8, 0, 6.283); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,150,60,' + (0.5 + 0.4 * Math.sin(a.ph * 4)) + ')'; ctx.fillRect(a.x, a.y, 2, 2); }
  }
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (var i = 0; i < G.texts.length; i++) {
    var t = G.texts[i], a = Math.min(1, t.life / t.max * 2.5), x = t.screen ? CX : px(t.x, t.z), y = py(t.z) - 40 - t.dy;
    ctx.globalAlpha = a; ctx.font = t.size + 'px ' + NUMF;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,6,4,.85)'; ctx.strokeText(t.txt, x, y); ctx.fillStyle = t.col; ctx.fillText(t.txt, x, y);
  }
  ctx.globalAlpha = 1;
}
function drawSquadBanner() {
  if (G.state !== 'play' || G.n <= 0) return;
  var R = squadR(), z = R * 0.8 + 6, x = px(G.sx, z), y = py(z) - 56, txt = fmt(G.n);
  ctx.font = '26px ' + NUMF; var tw = Math.max(54, ctx.measureText(txt).width + 28);
  ctx.fillStyle = '#1a0a06'; ctx.fillRect(x - 1.5, y + 14, 3, 22);
  rrect(ctx, x - tw / 2, y - 17, tw, 34, 6);
  var bg = ctx.createLinearGradient(0, y - 17, 0, y + 17); bg.addColorStop(0, '#1d3a8a'); bg.addColorStop(1, '#0c1a48');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = G.nFlash > 0 ? G.nFlashCol : '#ffd34d'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  var fg = ctx.createLinearGradient(0, y - 12, 0, y + 12); fg.addColorStop(0, '#fff8e0'); fg.addColorStop(1, G.nFlash > 0 ? G.nFlashCol : '#ffd34d');
  ctx.lineWidth = 4; ctx.strokeStyle = '#0a0402'; ctx.strokeText(txt, x, y + 1); ctx.fillStyle = fg; ctx.fillText(txt, x, y + 1);
}
function plaque(x, y, w, h) {
  rrect(ctx, x, y, w, h, 6);
  var g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(40,14,8,.85)'); g.addColorStop(1, 'rgba(14,4,2,.85)');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,211,77,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawHUD() {
  var y = SAFE_T + 8;
  ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  plaque(8, y, 86, 32);
  ctx.font = '22px ' + BRUSH; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0'; ctx.fillText('第' + kan(G.stage) + '陣', 51, y + 17);
  var bx = 102, bw = 98, p = G.boss ? 1 : clamp(G.dist / G.bossAt, 0, 1);      // 進み具合
  plaque(bx, y + 9, bw, 14);
  var pg = ctx.createLinearGradient(bx, 0, bx + bw, 0); pg.addColorStop(0, '#ffd34d'); pg.addColorStop(1, '#ff6a3a');
  ctx.fillStyle = pg; rrect(ctx, bx + 2, y + 11, Math.max(4, (bw - 4) * p), 10, 5); ctx.fill();
  var bsp = art('boss', BOSSES[(G.stage - 1) % BOSSES.length].k, 0);
  if (bsp) ctx.drawImage(bsp, bx + bw - 16, y - 6, 38, 38);
  ctx.textAlign = 'right'; ctx.font = '11px ' + NUMF; ctx.fillStyle = '#d8c8b0'; ctx.fillText('撃破', W - 100, y + 8);      // 撃破の数
  ctx.font = '17px ' + NUMF; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,4,2,.8)';
  var kc = String(G.stageKills); ctx.strokeText(kc, W - 100, y + 24); ctx.fillStyle = '#fff'; ctx.fillText(kc, W - 100, y + 24);
  var b = G.boss;      // 大将の体力
  if (b && (b.phase === 'fight' || b.phase === 'crush' || b.dash)) {
    var by = y + 40; plaque(16, by, W - 32, 28);
    ctx.fillStyle = '#3a0808'; rrect(ctx, 22, by + 15, W - 44, 9, 4); ctx.fill();
    var hg = ctx.createLinearGradient(22, 0, W - 22, 0); hg.addColorStop(0, '#ff2a1a'); hg.addColorStop(1, '#ff8a3a');
    ctx.fillStyle = hg; rrect(ctx, 22, by + 15, Math.max(0, (W - 44) * b.hp / b.hpMax), 9, 4); ctx.fill();
    ctx.textAlign = 'left'; ctx.font = '13px ' + BRUSH; ctx.fillStyle = '#fff'; ctx.fillText('大将 ' + b.def.n + (b.rage === 2 ? ' 激怒' : b.rage ? ' 怒り' : ''), 24, by + 8);
    var dz = clamp((b.z - 170) / (620 - 170), 0, 1);
    ctx.textAlign = 'right'; ctx.font = '11px ' + NUMF; ctx.fillStyle = dz < 0.3 ? '#ff6a5a' : '#ffd8a0'; ctx.fillText(b.phase === 'crush' ? '目の前!' : '距離 ' + Math.round(dz * 100), W - 24, by + 8);
  }
  var wy = H - SAFE_B - 46, w = MAIN[G.main];      // 武器
  var specs = SPEC_KEYS.filter(function (k) { return G.spec[k]; });
  plaque(8, wy, 124 + specs.length * 32, 38);
  var mic = art('icon', G.main, 0); if (mic) ctx.drawImage(mic, 12, wy + 3, 32, 32);
  ctx.textAlign = 'left'; ctx.font = '14px ' + NUMF; ctx.fillStyle = '#fff'; ctx.fillText(w.name, 48, wy + 14);
  ctx.font = '11px ' + NUMF; ctx.fillStyle = '#ffd34d'; ctx.fillText('Lv' + G.mainLv, 48, wy + 29);
  for (var si = 0; si < specs.length; si++) {
    var k = specs[si], sx0 = 128 + si * 32, ic = art('icon', k, 0);
    if (ic) ctx.drawImage(ic, sx0, wy + 2, 28, 28);
    for (var l = 0; l < 3; l++) { ctx.fillStyle = l < G.spec[k] ? '#ffd34d' : 'rgba(255,255,255,.2)'; ctx.fillRect(sx0 + 3 + l * 8, wy + 32, 6, 3); }
  }
  if (G.banner) {      // 見出し
    var bn = G.banner, a = Math.min(1, bn.t * 2.2, (3 - bn.t) * 5);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    var cy = bn.boss ? H * 0.42 : H * 0.34, hh = bn.boss ? 124 : 90;
    var bg = ctx.createLinearGradient(0, cy - hh / 2, 0, cy + hh / 2);
    bg.addColorStop(0, 'rgba(10,2,0,0)'); bg.addColorStop(0.2, 'rgba(10,2,0,.82)'); bg.addColorStop(0.8, 'rgba(10,2,0,.82)'); bg.addColorStop(1, 'rgba(10,2,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, cy - hh / 2, W, hh);
    ctx.fillStyle = bn.col; ctx.fillRect(20, cy - hh / 2 + 10, W - 40, 1.5); ctx.fillRect(20, cy + hh / 2 - 11, W - 40, 1.5);
    ctx.textAlign = 'center';
    var big = bn.big, fsz = bn.boss ? (big.length > 5 ? 46 : 60) : (big.length > 7 ? 32 : 40);
    ctx.font = fsz + 'px ' + BRUSH; ctx.lineWidth = 7; ctx.strokeStyle = '#0a0200';
    var sc = 1 + Math.max(0, (bn.t - (bn.boss ? 2.6 : 1.9))) * 1.2;
    ctx.save(); ctx.translate(CX, cy - (bn.boss ? 12 : 8)); ctx.scale(sc, sc);
    ctx.strokeText(big, 0, 0); ctx.fillStyle = bn.col; ctx.fillText(big, 0, 0); ctx.restore();
    ctx.font = (bn.boss ? 17 : 15) + 'px ' + NUMF; ctx.fillStyle = '#fff'; ctx.fillText(bn.small, CX, cy + (bn.boss ? 40 : 26));
    ctx.globalAlpha = 1;
  }
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0a0404'; ctx.fillRect(0, 0, cv.width, cv.height);
  var shx = 0, shy = 0;
  if (G.shake > 0 && G.state === 'play') { shx = (Math.random() - 0.5) * G.shake; shy = (Math.random() - 0.5) * G.shake; }
  ctx.setTransform(SC, 0, 0, SC, OX + shx * SC, OY + shy * SC);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  drawBG();
  if (G.state !== 'title') drawWarns();
  drawWorld();
  if (G.state !== 'title') { drawShots(); drawFx(); }
  drawAmb();
  if (vigCv) ctx.drawImage(vigCv, 0, 0, W, H);
  if (G.danger > 0.02) {      // あぶないとき 赤く脈打つ
    var pulse = 0.5 + 0.5 * Math.sin(G.t * 7);
    var rg = ctx.createRadialGradient(CX, H / 2, H * 0.25, CX, H / 2, H * 0.7);
    rg.addColorStop(0, 'rgba(255,0,0,0)'); rg.addColorStop(1, 'rgba(200,0,0,' + ((0.35 + pulse * 0.25) * G.danger) + ')');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  if (G.boss && G.boss.phase === 'enter') { ctx.fillStyle = 'rgba(0,0,0,' + clamp((1500 - G.boss.z) / 600, 0, 0.45) + ')'; ctx.fillRect(0, 0, W, H); }
  if (G.state !== 'title') { drawTexts(); drawSquadBanner(); drawHUD(); }
  if (G.flash > 0) { ctx.fillStyle = 'rgba(255,250,240,' + Math.min(0.8, G.flash) + ')'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

/* ---------------- 画面の切りかえ ---------------- */
var $ = function (id) { return document.getElementById(id); };
function hideAll() { ['title', 'over', 'clear', 'pause'].forEach(function (id) { $(id).classList.add('hidden'); }); }
function startRun(stage, ev) {
  if (window.SND) { SND.start(); SND.setMute(SAVE.mute); SND.quiet(G.auto); }
  G.score = 0; G.kills = 0;
  startStage(stage);
  G.state = 'play'; G.paused = false; hideAll();
  $('ctl').classList.remove('hidden');
  if (ev && ev.isTrusted) try {
    var el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
    var pr = fs && fs.call(el); if (pr && pr.catch) pr.catch(function () {});
  } catch (e) {}
}
function nextStage() { if (window.SND) SND.start(); var sc = G.score, k = G.kills; startStage(G.stage + 1); G.score = sc; G.kills = k; G.state = 'play'; hideAll(); $('ctl').classList.remove('hidden'); }
function showOver() {
  G.state = 'over'; $('ctl').classList.add('hidden'); setMusic('off'); if (window.SND) SND.heart(false);
  if (G.score > SAVE.best) SAVE.best = G.score;
  save();
  $('overText').textContent = '第' + kan(G.stage) + '陣にて 討死';
  $('overScore').innerHTML = '撃破 <b>' + G.stageKills + '</b> 人 ・ 最大の軍勢 <b>' + fmt(G.maxN) + '</b> 人<br>点数 <b>' + G.score + '</b>(最高 ' + SAVE.best + ')';
  $('btnRetry').textContent = 'もう一度 挑む';
  $('over').classList.remove('hidden');
}
function showClear() {
  G.state = 'clear'; $('ctl').classList.add('hidden'); if (window.SND) SND.heart(false);
  SAVE.stage = Math.max(SAVE.stage, G.stage + 1); SAVE.bestStage = Math.max(SAVE.bestStage, G.stage);
  if (G.score > SAVE.best) SAVE.best = G.score;
  save(); sfx('clear');
  $('clearText').textContent = '第' + kan(G.stage) + '陣 突破';
  $('clearScore').innerHTML = '大将 <b>' + BOSSES[(G.stage - 1) % BOSSES.length].n + '</b> 討ち取ったり!<br>撃破 <b>' + G.stageKills + '</b> 人 ・ 残った軍勢 <b>' + fmt(G.n) + '</b> 人<br>点数 <b>' + G.score + '</b>';
  $('clear').classList.remove('hidden');
}
function showTitle() {
  G.state = 'title'; hideAll(); $('ctl').classList.add('hidden'); $('title').classList.remove('hidden'); setMusic('off');
  G.theme = (SAVE.stage - 1) % THEMES.length; G.amb = []; skyFor = -1; G.nShow = 60;
  $('btnPlay').textContent = SAVE.stage > 1 ? '出陣(第' + kan(SAVE.stage) + '陣)' : '出陣';
  $('btnFirst').classList.toggle('hidden', SAVE.stage <= 1);
  $('bestLine').textContent = SAVE.best ? '最高点 ' + SAVE.best + ' ・ 第' + kan(SAVE.bestStage) + '陣まで突破' : '';
}
function setPause(on) {
  if (G.state !== 'play') return;
  G.paused = on; $('pause').classList.toggle('hidden', !on);
  if (window.SND) SND.quiet(on);
}
function toggleMute() {
  SAVE.mute = !SAVE.mute; save();
  if (window.SND) SND.setMute(SAVE.mute);
  $('btnMute').textContent = SAVE.mute ? '🔇' : '🔊';
}
function btn(id, fn) { $(id).addEventListener('click', function (ev) { this.blur(); fn(ev); }); }
btn('btnPlay', function (ev) { startRun(SAVE.stage, ev); });
btn('btnFirst', function (ev) { startRun(1, ev); });
btn('btnRetry', function (ev) { startRun(G.stage, ev); });
btn('btnTitle', showTitle);
btn('btnTitle2', showTitle);
btn('btnNext', nextStage);
btn('btnPause', function () { setPause(true); });
btn('btnResume', function () { if (window.SND) SND.start(); setPause(false); });
btn('btnQuit', function () { if (window.SND) SND.quiet(false); showTitle(); });
btn('btnMute', function () { if (window.SND) SND.start(); toggleMute(); });
$('btnMute').textContent = SAVE.mute ? '🔇' : '🔊';
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { if (G.state === 'play') setPause(true); }
  else { try { if (window.ART) ART.build(); } catch (e) {} skyFor = -1; decoCache = {}; glowTints = {}; }      // スマホが裏で絵を捨てることがあるので 描き直す
});

/* ---------------- ループ ---------------- */
var last = 0, acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  try {
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (G.state === 'play' && !G.paused) {
      var ts = G.timeScale;
      if (G.slow > 0) { G.slow -= dt; ts *= 0.3; }
      acc += dt * ts; var n = 0;
      while (acc >= DT && n++ < 12 * Math.max(1, G.timeScale)) { update(DT); acc -= DT; }
      if (acc > DT * 4) acc = 0;
      updAmb(dt);
    } else if (G.state === 'title') { G.t += dt; G.dist += 70 * dt; updAmb(dt); }
    draw();
  } catch (e) { console.error(e); }
}

try { if (window.ART) ART.build(); } catch (e) { console.error(e); }
addEventListener('resize', resize); resize();
showTitle();
requestAnimationFrame(function (t) { last = t; loop(t); });
if (document.fonts && document.fonts.load) { try { document.fonts.load('20px Yuji'); document.fonts.load('20px Dela'); } catch (e) {} }

// 確認用: #play ですぐ始まる / #auto でおまかせ操作 / #auto4 で4倍速 / #s3 で第3陣から
var hs = location.hash;
var mS = /s(\d+)/.exec(hs), st = mS ? +mS[1] : 1;
if (/auto/.test(hs)) { G.auto = true; var mT = /auto(\d+)/.exec(hs); if (mT) G.timeScale = +mT[1]; }
if (/play|auto/.test(hs)) startRun(st);
window.__musou = {
  G: G, startRun: startRun, update: update, startStage: startStage,
  sim: function (sec) { var n = Math.round(sec / DT); for (var i = 0; i < n && G.state === 'play'; i++) update(DT); return G.state; }
};
})();
