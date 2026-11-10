'use strict';
/* 侍無双 — 縦に進む「門をくぐって仲間が増える」合戦ゲーム
   ・指(またはキーの ← →)で 左右に動かすだけ。仲間は自動で撃つ
   ・青い門で増える/赤い門で減る。門を撃つと数字が上がる
   ・木箱を壊すと 武器・援軍・攻撃力。最後に 大将(ボス)
   画像や音のファイルは使わない(図形・絵文字・WebAudio で作る)。 */
(function () {
var cv = document.getElementById('game'), ctx = cv.getContext('2d');
var W = 360, H = 640, SC = 1, OX = 0, OY = 0, DPR = 1, SAFE_T = 0, SAFE_B = 0;
var DT = 1 / 60;
var EF = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';
var JF = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",system-ui,sans-serif';
var ROAD_L = 36, ROAD_R = 324, MID = 180;
var SAVE_KEY = 'musou-save-v1';
var MAXSHOW = 150;          // 画面に描く仲間の数の上限(それ以上は数字だけ増える)
var MAX_SHOOT = 16;         // 1回に弾を撃つ仲間の数の上限(多いときは 1発を強くする)

/* ---------------- 保存 ---------------- */
var SAVE = { stage: 1, best: 0, bestStage: 0, mute: false };
try { var sv = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (sv) for (var k in sv) SAVE[k] = sv[k]; } catch (e) {}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }

/* ---------------- 乱数(ステージの並びは 毎回同じにする) ---------------- */
var seed = 1;
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
function rr(a, b) { return a + (b - a) * rnd(); }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function hash(k, salt) { var x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function nice(v) {
  v = Math.max(1, v);
  if (v < 20) return Math.round(v);
  if (v < 100) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 10) * 10;
  return Math.round(v / 50) * 50;
}
function fmt(n) { n = Math.floor(n); return n >= 10000 ? (Math.floor(n / 100) / 10) + '万' : String(n); }

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
  G.sy = H - 150 - SAFE_B * 0.6;
}

/* ---------------- 絵(仲間・敵の侍は図形で描く。妖怪は絵文字) ---------------- */
var SPR = {}, ATL = null, ATLI = {};
var EMOS = ['👹', '👺', '💀', '🐗', '👻', '🐍', '🦊', '🕷️', '🐉', '🔥', '🌸'];
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
var PAL = {
  sam:  { body: '#2f62d8', body2: '#1f46a8', line: '#173580', leg: '#1b2440', helm: '#1a2340', crest: '#ffd34d', skin: '#f3c9a0' },
  nin:  { body: '#2a2a33', body2: '#1b1b22', line: '#111', leg: '#15151b', helm: '#22222b', crest: '#e8433a', skin: '#f3c9a0' },
  esam: { body: '#c8382c', body2: '#962519', line: '#6e1a12', leg: '#3a1a14', helm: '#4a2a18', crest: '#e8e0c8', skin: '#e8b48a' },
  enin: { body: '#6b3fa0', body2: '#4e2a7a', line: '#341b55', leg: '#251538', helm: '#3e2366', crest: '#ff4d6d', skin: '#e8b48a' },
  shogun: { body: '#a0201a', body2: '#6a120c', line: '#3e0905', leg: '#2a0d08', helm: '#1a0d0a', crest: '#ffd34d', skin: '#b8462e' }
};
function drawWarrior(g, kind, frame) {   // 64x64 の箱に描く。足もとが下
  var P = PAL[kind], ninja = kind === 'nin' || kind === 'enin', enemy = kind === 'esam' || kind === 'enin' || kind === 'shogun';
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(32, 59, 15, 4.5, 0, 0, 6.283); g.fill();
  g.fillStyle = P.leg;
  rrect(g, 22, 45 + (frame ? 3 : 0), 8, 13 - (frame ? 3 : 0), 3); g.fill();
  rrect(g, 34, 45 + (frame ? 0 : 3), 8, 13 - (frame ? 0 : 3), 3); g.fill();
  // 刀・やり
  g.strokeStyle = enemy ? '#9aa' : '#dfe6ee'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); if (ninja) { g.moveTo(14, 44); g.lineTo(8, 30); } else { g.moveTo(49, 44); g.lineTo(55, 12); } g.stroke();
  g.fillStyle = P.body; rrect(g, 18, 27, 28, 22, 7); g.fill();
  g.strokeStyle = P.line; g.lineWidth = 2;
  if (!ninja) { g.beginPath(); g.moveTo(20, 35); g.lineTo(44, 35); g.moveTo(20, 41); g.lineTo(44, 41); g.stroke(); }
  else { g.fillStyle = P.crest; g.fillRect(19, 37, 26, 3); }
  g.fillStyle = P.body2; rrect(g, 11, 27, 11, 13, 4); g.fill(); rrect(g, 42, 27, 11, 13, 4); g.fill();
  g.fillStyle = P.skin; g.beginPath(); g.arc(32, 21, 9.5, 0, 6.283); g.fill();
  if (ninja) {
    g.fillStyle = P.helm; g.beginPath(); g.arc(32, 20, 11, 0, 6.283); g.fill();
    g.fillStyle = P.skin; rrect(g, 23, 17, 18, 6, 3); g.fill();
    g.fillStyle = '#111'; g.fillRect(26.5, 18.5, 3, 3); g.fillRect(34.5, 18.5, 3, 3);
    g.strokeStyle = P.crest; g.lineWidth = 3; g.beginPath(); g.moveTo(41, 14); g.quadraticCurveTo(50, 10 + frame * 3, 56, 16); g.stroke();
  } else if (kind === 'esam') {
    g.fillStyle = '#111'; g.fillRect(27, 21, 3, 3); g.fillRect(34, 21, 3, 3);
    g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(25, 18); g.lineTo(30, 20); g.moveTo(39, 18); g.lineTo(34, 20); g.stroke();
    g.fillStyle = P.helm; g.beginPath(); g.moveTo(13, 18); g.lineTo(51, 18); g.lineTo(32, 5); g.closePath(); g.fill();
    g.fillStyle = P.crest; g.beginPath(); g.arc(32, 13, 2.2, 0, 6.283); g.fill();
  } else {
    g.fillStyle = '#111'; g.fillRect(27, 21, 3, 3); g.fillRect(34, 21, 3, 3);
    if (kind === 'shogun') { g.fillStyle = '#ffd34d'; g.fillRect(24, 27, 16, 3); }
    g.fillStyle = P.helm; g.beginPath(); g.arc(32, 18, 11, Math.PI, 0); g.fill();
    g.beginPath(); g.moveTo(19, 17); g.lineTo(45, 17); g.lineTo(50, 24); g.lineTo(14, 24); g.closePath(); g.fill();
    g.fillStyle = P.skin; g.fillRect(24, 19, 16, 6);
    g.fillStyle = '#111'; g.fillRect(27, 20, 3, 3); g.fillRect(34, 20, 3, 3);
    g.strokeStyle = P.crest; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 2); g.quadraticCurveTo(32, 14, 42, 2); g.stroke();
    if (kind === 'shogun') { g.strokeStyle = '#ffd34d'; g.beginPath(); g.moveTo(16, 4); g.lineTo(24, 12); g.moveTo(48, 4); g.lineTo(40, 12); g.stroke(); }
  }
}
function makeSprite(kind, frame, px) {
  var c = document.createElement('canvas'); c.width = c.height = px;
  var g = c.getContext('2d'); g.scale(px / 64, px / 64); drawWarrior(g, kind, frame); return c;
}
function glyph(ch, px) {     // 絵文字を 色のある所だけで測って まんなかに置き直す(iPhone のずれ対策)
  var big = px * 2, t = document.createElement('canvas'); t.width = t.height = big;
  var g = t.getContext('2d'); g.font = px + 'px ' + EF; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(ch, px * 0.3, big / 2);
  var d = null; try { d = g.getImageData(0, 0, big, big).data; } catch (e) {}
  var minx = big, miny = big, maxx = -1, maxy = -1;
  if (d) for (var y = 0; y < big; y += 1) for (var x = 0; x < big; x += 1) {
    if (d[(y * big + x) * 4 + 3] > 10) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  return maxx < 0 ? null : { c: t, x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 };
}
function buildArt() {
  var px = 64;
  ['sam', 'nin', 'esam', 'enin'].forEach(function (k) { SPR[k] = [makeSprite(k, 0, px), makeSprite(k, 1, px)]; });
  SPR.shogun = [makeSprite('shogun', 0, 160), makeSprite('shogun', 1, 160)];
  var cell = 112; ATL = document.createElement('canvas'); ATL.width = cell * 4; ATL.height = cell * 3;
  var a = ATL.getContext('2d');
  EMOS.forEach(function (ch, i) {
    var cx = (i % 4) * cell, cy = Math.floor(i / 4) * cell, gl = glyph(ch, 96);
    ATLI[ch] = { x: cx, y: cy, s: cell };
    if (gl) {
      var k = Math.min((cell - 6) / gl.w, (cell - 6) / gl.h), dw = gl.w * k, dh = gl.h * k;
      a.drawImage(gl.c, gl.x, gl.y, gl.w, gl.h, cx + (cell - dw) / 2, cy + (cell - dh) / 2, dw, dh);
    } else { a.font = '90px ' + EF; a.textAlign = 'center'; a.textBaseline = 'middle'; a.fillText(ch, cx + cell / 2, cy + cell / 2); }
  });
}
function emo(ch, x, y, size, flip) {
  var c = ATLI[ch]; if (!c) return;
  if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(ATL, c.x, c.y, c.s, c.s, -size / 2, -size / 2, size, size); ctx.restore(); }
  else ctx.drawImage(ATL, c.x, c.y, c.s, c.s, x - size / 2, y - size / 2, size, size);
}

/* ---------------- データ ---------------- */
var WEAPONS = [
  { name: '弓矢',   dmg: 1.0, rate: 3.0, speed: 520, pierce: 0, spread: 0,    splash: 0,  kind: 'arrow' },
  { name: '手裏剣', dmg: 1.3, rate: 3.6, speed: 470, pierce: 1, spread: 0.10, splash: 0,  kind: 'star' },
  { name: '火縄銃', dmg: 3.2, rate: 1.9, speed: 720, pierce: 0, spread: 0,    splash: 0,  kind: 'ball' },
  { name: '火矢',   dmg: 2.6, rate: 2.7, speed: 560, pierce: 2, spread: 0.03, splash: 0,  kind: 'fire' },
  { name: '焙烙玉', dmg: 4.6, rate: 1.4, speed: 400, pierce: 0, spread: 0.05, splash: 36, kind: 'bomb' },
  { name: '雷刀',   dmg: 4.2, rate: 3.0, speed: 820, pierce: 4, spread: 0,    splash: 0,  kind: 'bolt' }
];
var ET = {
  ashi:  { name: '足軽', spr: 'esam', size: 27, r: 11, hp: 1.0, spd: 16, pow: 1, sc: 10, steer: 34 },
  oni:   { name: '小鬼', emo: '👹', size: 27, r: 12, hp: 1.3, spd: 19, pow: 1, sc: 12, steer: 34 },
  nin:   { name: '忍者', spr: 'enin', size: 25, r: 10, hp: 0.8, spd: 30, pow: 1, sc: 12, steer: 58, weave: 1 },
  hone:  { name: '骸骨', emo: '💀', size: 27, r: 12, hp: 1.7, spd: 14, pow: 1, sc: 14, steer: 28 },
  ino:   { name: '猪',   emo: '🐗', size: 33, r: 14, hp: 2.2, spd: 52, pow: 2, sc: 20, steer: 10 },
  yurei: { name: '幽霊', emo: '👻', size: 28, r: 12, hp: 1.2, spd: 24, pow: 1, sc: 14, steer: 40, weave: 2 },
  tengu: { name: '天狗', emo: '👺', size: 34, r: 15, hp: 3.4, spd: 12, pow: 2, sc: 30, steer: 22 }
};
var ET_ORDER = ['ashi', 'oni', 'nin', 'hone', 'ino', 'yurei', 'tengu'];
var BOSSES = [
  { n: '赤鬼', e: '👹' }, { n: '大天狗', e: '👺' }, { n: 'がしゃどくろ', e: '💀' }, { n: '大猪', e: '🐗' }, { n: '大蛇', e: '🐍' },
  { n: '九尾の狐', e: '🦊' }, { n: '土蜘蛛', e: '🕷️' }, { n: '怨霊', e: '👻' }, { n: '龍神', e: '🐉' }, { n: '鬼将軍', spr: 'shogun' }
];
var THEMES = [
  { name: '桜街道',     grass: '#5f8f3a', grass2: '#517d30', road: '#cfae7a', road2: '#b99560', edge: '#8f7046', deco: ['sakura', 'lantern', 'sakura', 'rock', 'sakura'], amb: 'petal' },
  { name: '竹林',       grass: '#2f5f2b', grass2: '#285223', road: '#b19a72', road2: '#9c8661', edge: '#6e5d42', deco: ['bamboo', 'bamboo', 'jizo', 'bamboo', 'rock'], amb: 'leaf' },
  { name: '夜の城下町', grass: '#1f2440', grass2: '#191d34', road: '#5d566b', road2: '#4f485d', edge: '#3a3448', deco: ['house', 'lantern', 'house', 'torii', 'house'], amb: 'firefly' },
  { name: '雪の峠',     grass: '#e9eff6', grass2: '#d7e0eb', road: '#aeaaa6', road2: '#9d9995', edge: '#7d7975', deco: ['pine', 'pine', 'jizo', 'pine', 'rock'], amb: 'snow' },
  { name: '炎の合戦場', grass: '#5c3a28', grass2: '#4e3021', road: '#8e6c4b', road2: '#7d5e3f', edge: '#5a4129', deco: ['flag', 'flag', 'fire', 'flag', 'rock'], amb: 'ember' }
];

/* ---------------- 仲間の並び(ひまわりの種の並び) ---------------- */
var FORM = [], ORDER = [];
for (var fi = 0; fi < MAXSHOW; fi++) {
  var fr = 6.6 * Math.sqrt(fi + 0.35), fa = fi * 2.39996;
  FORM.push({ x: Math.cos(fa) * fr, y: Math.sin(fa) * fr * 0.72, k: fi % 3 === 2 ? 'nin' : 'sam', ph: Math.random() * 6.283 });
  ORDER.push(fi);
}
ORDER.sort(function (a, b) { return FORM[a].y - FORM[b].y; });

/* ---------------- 状態 ---------------- */
var G = {
  state: 'title', paused: false, t: 0, stage: 1, n: 5, nShow: 5, sx: MID, tx: MID, sy: 490, dist: 0, speed: 50,
  weapon: 0, power: 1, fireT: 0, score: 0, kills: 0, maxN: 5, startScore: 0,
  bullets: [], enemies: [], gates: [], crates: [], fx: [], texts: [], ebul: [], slams: [], amb: [],
  boss: null, events: [], evi: 0, bossAt: 1, clearT: 0, overT: 0, shake: 0, theme: 0, banner: null, nFlash: 0, nFlashCol: '#fff',
  auto: false, timeScale: 1
};
function D(s) { return 1 + 0.12 * (s - 1); }
function n0(s) { return Math.min(40, 5 + 3 * (s - 1)); }                            // 陣のはじめの人数
function expN(s, p) { var a = n0(s), e = 160 * (1 + 0.12 * (s - 1)); return a * Math.pow(e / a, p); }   // この辺で ふつうは何人くらいか
function expDPS(s, p) { return expN(s, p) * (3 + 2.5 * p); }                         // そのときの ふつうの攻撃の強さ
function actDPS() { var w = WEAPONS[G.weapon]; return Math.max(1, G.n) * w.dmg * w.rate * G.power; }
function mixDPS(p, a) { return (1 - a) * expDPS(G.stage, p) + a * actDPS(); }
function squadR() { return 6.6 * Math.sqrt(Math.max(1, Math.min(G.nShow, MAXSHOW))) + 9; }

/* ---------------- ステージを組み立てる ---------------- */
function buildStage(s) {
  seed = (s * 7919 + 101) >>> 0;
  var plan = ['G', 'W', 'G', 'C', 'W', 'G', 'W', 'G', 'C', 'W', 'G', 'W'];
  if (s >= 3) plan.splice(9, 0, 'W');
  if (s >= 10) plan.splice(5, 0, 'W');
  if (s >= 2 && rnd() < 0.5) { plan[6] = 'G'; plan[7] = 'W'; }
  var ev = [], at = 160;
  for (var i = 0; i < plan.length; i++) {
    ev.push({ at: at, type: plan[i], p: i / (plan.length - 1), first: i === 0 });
    at += plan[i] === 'W' ? 300 : 250;
  }
  G.events = ev; G.evi = 0; G.bossAt = at + 120;
}
function startStage(s) {
  G.stage = s; G.theme = (s - 1) % THEMES.length;
  G.n = n0(s); G.nShow = G.n; G.maxN = G.n; G.sx = G.tx = MID; G.dist = 0; G.weapon = 0; G.power = 1; G.fireT = 0;
  G.bullets = []; G.enemies = []; G.gates = []; G.crates = []; G.fx = []; G.texts = []; G.ebul = []; G.slams = []; G.amb = [];
  G.boss = null; G.clearT = 0; G.overT = 0; G.shake = 0; G.startScore = G.score;
  buildStage(s);
  G.banner = { big: '第' + s + '陣', small: THEMES[G.theme].name, t: 2.4, col: '#ffd34d' };
}

function spawnEvent(e) {
  if (e.type === 'G') spawnGates(e);
  else if (e.type === 'W') spawnWave(e);
  else if (e.type === 'C') spawnCrates(e);
}
function gateOf(op, v) { return { op: op, v: v, charge: 0, flash: 0 }; }
function spawnGates(e) {
  var s = G.stage, p = e.p, base = expN(s, p);
  var good = Math.max(3, nice(base * rr(0.45, 0.85))), bad = Math.max(2, nice(base * rr(0.3, 0.6)));
  var A, B, r = rnd();
  if (e.first) { A = gateOf('add', nice(base * 1.6)); B = gateOf('add', -bad); }
  else if (r < 0.28) { A = gateOf('add', good); B = gateOf('add', -bad); }
  else if (r < 0.52) { A = gateOf('mul', 1); B = gateOf('add', good); }
  else if (r < 0.70) { A = gateOf('mul', p > 0.5 && rnd() < 0.35 ? 2 : 1); B = gateOf('add', -bad); }
  else if (r < 0.86) { A = gateOf('add', good); B = gateOf('mul', -1); }
  else { A = gateOf('add', -Math.max(2, nice(base * 0.25))); B = gateOf('mul', -1); }
  if (rnd() < 0.5) { var t = A; A = B; B = t; }
  A.x0 = ROAD_L + 4; A.x1 = MID - 4; B.x0 = MID + 4; B.x1 = ROAD_R - 4;
  G.gates.push({ y: -40, list: [A, B], passed: false, fade: 1, step: Math.max(1, nice(base * 0.08)) });
}
function spawnWave(e) {
  var s = G.stage, p = e.p;
  var avail = ET_ORDER.slice(0, Math.min(ET_ORDER.length, s + 1));
  var main = avail[Math.min(avail.length - 1, Math.floor(Math.pow(rnd(), 0.6) * avail.length))];
  var count = Math.round(5 + 7 * p + Math.min(8, s * 0.8) * (0.3 + 0.7 * p));
  var lay = rnd(), cols, x0, x1;
  if (lay < 0.55) { cols = 6; x0 = ROAD_L + 22; x1 = ROAD_R - 22; }
  else if (lay < 0.8) { cols = 4; if (rnd() < 0.5) { x0 = ROAD_L + 20; x1 = MID + 30; } else { x0 = MID - 30; x1 = ROAD_R - 20; } }
  else { cols = 5; x0 = ROAD_L + 40; x1 = ROAD_R - 40; }
  var dps = mixDPS(p, 0.3), pw = Math.max(1, Math.round(expN(s, p) * 0.045 * Math.sqrt(D(s))));
  for (var i = 0; i < count; i++) {
    var type = rnd() < 0.72 ? main : pick(avail), T = ET[type];
    var c = i % cols, row = Math.floor(i / cols);
    var x = x0 + (cols === 1 ? 0.5 : c / (cols - 1)) * (x1 - x0) + rr(-6, 6);
    addEnemy(type, x, -30 - row * 34 - rr(0, 8), T.hp * 0.13 * D(s) * dps, T.pow * pw, 1);
  }
  if (p > 0.45 && rnd() < 0.3 + 0.03 * s) {
    var et = avail[avail.length - 1], T2 = ET[et];
    addEnemy(et, rr(ROAD_L + 60, ROAD_R - 60), -30 - Math.ceil(count / cols) * 34 - 20, T2.hp * 0.13 * D(s) * dps * 6, T2.pow * pw * 3, 1.7);
  }
}
function addEnemy(type, x, y, hp, pow, scale) {
  var T = ET[type];
  G.enemies.push({ type: type, T: T, x: x, y: y, r: T.r * scale, size: T.size * scale, hp: hp, hpMax: hp, pow: Math.max(1, Math.round(pow)),
    spd: T.spd * (scale > 1 ? 0.8 : 1), ph: Math.random() * 6.283, flash: 0, elite: scale > 1, sc: Math.round(T.sc * (scale > 1 ? 8 : 1)) });
}
function spawnCrates(e) {
  var s = G.stage, p = e.p, dps = mixDPS(p, 0.35);
  var tier = Math.min(WEAPONS.length - 1, G.weapon + (s >= 4 && rnd() < 0.4 ? 2 : 1));
  var other = rnd() < 0.55 ? { type: 'ally', v: nice(expN(s, p) * 0.6) } : { type: 'power', v: 1.3 };
  var a = { type: 'weapon', tier: tier }, b = other;
  if (rnd() < 0.5) { var t = a; a = b; b = t; }
  [[108, a], [252, b]].forEach(function (q) {
    var hp = dps * 1.25 * Math.sqrt(D(s)) * (q[1].type === 'weapon' ? 1.2 : 1);
    G.crates.push({ x: q[0], y: -40, w: 64, h: 52, hp: hp, hpMax: hp, rw: q[1], flash: 0, dead: false });
  });
}
function spawnBoss() {
  var s = G.stage, def = BOSSES[(s - 1) % BOSSES.length];
  var hp = 13 * mixDPS(1, 0.4) * Math.sqrt(D(s));
  G.boss = { def: def, x: MID, y: -90, hp: hp, hpMax: hp, size: 128, r: 52, stopY: Math.max(170, G.sy - 270), phase: 'enter',
    slamT: 2.2, fireT: 3.4, sumT: 5.5, flash: 0, deadT: 0, t: 0 };
  G.banner = { big: '大将 ' + def.n, small: '現る!', t: 2.4, col: '#ff5a4a' };
  sfx('boss');
}

/* ---------------- 入力 ---------------- */
var keys = {}, drag = null;
function toLogical(ev) {
  var r = cv.getBoundingClientRect(), k = cv.width / r.width;
  return { x: ((ev.clientX - r.left) * k - OX) / SC, y: ((ev.clientY - r.top) * k - OY) / SC };
}
cv.addEventListener('pointerdown', function (ev) {
  if (G.state !== 'play') return;
  auStart();
  var p = toLogical(ev); drag = { id: ev.pointerId, x: p.x, tx: G.tx };
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
});
cv.addEventListener('pointermove', function (ev) {
  if (!drag || drag.id !== ev.pointerId || G.state !== 'play') return;
  var p = toLogical(ev); G.tx = clamp(drag.tx + (p.x - drag.x) * 1.15, ROAD_L + 8, ROAD_R - 8);
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
function update(dt) {
  G.t += dt;
  if (G.auto) bot();
  if (keys.l) G.tx -= 280 * dt;
  if (keys.r) G.tx += 280 * dt;
  G.tx = clamp(G.tx, ROAD_L + 8, ROAD_R - 8);
  G.sx += (G.tx - G.sx) * Math.min(1, dt * 14);
  var target = Math.min(G.n, MAXSHOW);
  if (G.nShow < target) G.nShow = Math.min(target, G.nShow + Math.max(3, (target - G.nShow) * 6) * dt);
  else G.nShow = target;
  G.dist += G.speed * dt;

  while (G.evi < G.events.length && G.dist >= G.events[G.evi].at) spawnEvent(G.events[G.evi++]);
  if (!G.boss && G.evi >= G.events.length && G.dist >= G.bossAt) spawnBoss();

  if (G.n > 0 && G.overT <= 0) fire(dt);
  updBullets(dt); updGates(dt); updCrates(dt); updEnemies(dt); updBoss(dt); updEbul(dt); updSlams(dt);
  updFx(dt);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.nFlash > 0) G.nFlash -= dt;
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  if (G.n > G.maxN) G.maxN = G.n;

  if (G.n <= 0 && G.overT <= 0 && G.clearT <= 0) { G.overT = 1.4; sfx('dead'); }
  if (G.overT > 0) { G.overT -= dt; if (G.overT <= 0) showOver(); }
  if (G.clearT > 0) { G.clearT -= dt; if (G.clearT <= 0) showClear(); }
}

function fire(dt) {
  var w = WEAPONS[G.weapon]; G.fireT -= dt * w.rate;
  var guard = 0;
  while (G.fireT <= 0 && guard++ < 4) { G.fireT += 1; volley(w); }
}
function volley(w) {
  if (G.bullets.length > 300) return;
  var m = Math.max(1, Math.floor(G.nShow)), S = Math.max(1, Math.min(G.n, m, MAX_SHOOT));
  var dmg = w.dmg * G.power * G.n / S;
  for (var j = 0; j < S; j++) {
    var u = FORM[Math.min(m - 1, Math.floor((j + Math.random()) * m / S))];
    var vx = w.spread ? (Math.random() - 0.5) * 2 * w.spread * w.speed : 0;
    G.bullets.push({ x: G.sx + u.x, y: G.sy + u.y - 16, vx: vx, vy: -w.speed * (0.95 + Math.random() * 0.1), dmg: dmg,
      pierce: w.pierce, splash: w.splash, kind: w.kind, rot: Math.random() * 6, last: null });
  }
  sfx('shot');
}
function updBullets(dt) {
  var bs = G.bullets, i, b;
  for (i = bs.length - 1; i >= 0; i--) {
    b = bs[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += dt * 18;
    if (b.y < -30 || b.x < -20 || b.x > W + 20) { bs.splice(i, 1); continue; }
    if (hitStuff(b)) bs.splice(i, 1);
  }
}
function hitStuff(b) {   // 当たって消えるなら true
  var j, k;
  for (j = 0; j < G.gates.length; j++) {
    var row = G.gates[j];
    if (row.passed || b.y > row.y + 24 || b.y < row.y - 28) continue;
    for (k = 0; k < row.list.length; k++) {
      var g = row.list[k];
      if (b.x >= g.x0 && b.x <= g.x1) { chargeGate(row, g, b.dmg); return true; }
    }
  }
  for (j = 0; j < G.crates.length; j++) {
    var c = G.crates[j];
    if (c.dead) continue;
    if (Math.abs(b.x - c.x) < c.w / 2 && b.y < c.y + c.h / 2 && b.y > c.y - c.h / 2) {
      c.hp -= b.dmg; c.flash = 0.08; sfx('wood');
      if (c.hp <= 0) breakCrate(c);
      return true;
    }
  }
  var bo = G.boss;
  if (bo && bo.phase !== 'dead' && bo.y > -60) {
    var dx = b.x - bo.x, dy = b.y - bo.y;
    if (dx * dx + dy * dy < bo.r * bo.r) {
      bo.hp -= b.dmg; bo.flash = 0.06; sfx('hit');
      if (b.splash) boom(b.x, b.y, b.splash, b.dmg * 0.5);
      if (Math.random() < 0.3) spark(b.x, b.y, '#fff2a8', 2);
      if (bo.hp <= 0) killBoss();
      return true;
    }
  }
  for (j = 0; j < G.enemies.length; j++) {
    var e = G.enemies[j];
    if (e === b.last || e.y < -20) continue;
    var ex = b.x - e.x, ey = b.y - e.y, rr2 = e.r + 3;
    if (ex * ex + ey * ey < rr2 * rr2) {
      hurtEnemy(e, b.dmg);
      if (b.splash) boom(b.x, b.y, b.splash, b.dmg * 0.6);
      if (b.pierce > 0) { b.pierce--; b.last = e; b.dmg *= 0.8; return false; }
      return true;
    }
  }
  return false;
}
function boom(x, y, r, dmg) {
  for (var j = 0; j < G.enemies.length; j++) {
    var e = G.enemies[j], dx = e.x - x, dy = e.y - y;
    if (dx * dx + dy * dy < (r + e.r) * (r + e.r)) hurtEnemy(e, dmg);
  }
  G.fx.push({ k: 'ring', x: x, y: y, r: r, life: 0.25, max: 0.25, col: '#ffb347' });
  if (G.fx.length < 380) for (var i = 0; i < 4; i++) G.fx.push({ k: 'dot', x: x, y: y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.35, max: 0.35, col: '#ff8a3d', s: 3 });
}
function hurtEnemy(e, dmg) {
  if (e.hp <= 0) return;
  e.hp -= dmg; e.flash = 0.06;
  if (e.hp <= 0) killEnemy(e, true); else sfx('hit');
}
function killEnemy(e, byShot) {
  e.hp = 0; e.dead = true;
  if (byShot) { G.score += Math.round(e.sc * (1 + G.stage * 0.2)); G.kills++; }
  var col = e.T.emo ? '#ffdede' : (e.type === 'nin' ? '#c9a2ff' : '#ff8a7a');
  if (G.fx.length < 380) {
    for (var i = 0; i < (e.elite ? 14 : 5); i++) G.fx.push({ k: 'dot', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.7) * 200, life: 0.45, max: 0.45, col: col, s: e.elite ? 4 : 3 });
    G.fx.push({ k: 'ring', x: e.x, y: e.y, r: e.r * 1.6, life: 0.2, max: 0.2, col: '#fff' });
  }
  sfx(e.elite ? 'bigkill' : 'kill');
}
function chargeGate(row, g, dmg) {
  g.charge += dmg; g.flash = 0.06;
  var thr = Math.max(1, actDPS() * (g.op === 'mul' ? 0.9 : 0.45)), n = 0;
  while (g.charge >= thr && n++ < 3) {
    g.charge -= thr;
    if (g.op === 'add') { var was = g.v; g.v += row.step; if (was < 0 && g.v >= 0) { g.flash = 0.3; sfx('flip'); } else sfx('tick'); }
    else if (g.v < 1) { g.v += 1; g.flash = 0.3; sfx('flip'); }   // 撃って上がるのは ×2 まで
  }
  if (g.op === 'mul' && g.v >= 1) g.charge = 0;
}
function gateResult(g, n) {
  var r = g.op === 'add' ? n + g.v : g.v >= 0 ? n * (g.v + 1) : Math.ceil(n / (1 - g.v));
  return clamp(Math.round(r), 0, 99999);
}
function gateLabel(g) {
  if (g.op === 'add') return (g.v >= 0 ? '+' : '−') + fmt(Math.abs(g.v));
  return g.v >= 0 ? '×' + (g.v + 1) : '÷' + (1 - g.v);
}
function gateGood(g) { return g.op === 'add' ? g.v > 0 : g.v >= 1; }
function updGates(dt) {
  for (var i = G.gates.length - 1; i >= 0; i--) {
    var row = G.gates[i]; row.y += G.speed * dt;
    row.list.forEach(function (g) { if (g.flash > 0) g.flash -= dt; });
    if (!row.passed && row.y >= G.sy - 4 && G.n > 0) {
      row.passed = true;
      var g = null;
      row.list.forEach(function (q) { if (G.sx >= q.x0 - 4 && G.sx <= q.x1 + 4) g = q; });
      if (g) {
        g.chosen = true;
        var before = G.n, after = gateResult(g, G.n);
        G.n = after; if (after < before) G.lossG = (G.lossG || 0) + before - after;
        if (after >= before) {
          addText('+' + fmt(after - before), G.sx, G.sy - squadR() - 40, '#7fd8ff', 30);
          G.nFlash = 0.5; G.nFlashCol = '#7fd8ff'; sfx('good');
          for (var k = 0; k < 16 && G.fx.length < 380; k++) G.fx.push({ k: 'dot', x: G.sx + (Math.random() - 0.5) * 80, y: G.sy, vx: (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 120, life: 0.7, max: 0.7, col: '#9fe3ff', s: 3 });
        } else {
          addText('−' + fmt(before - after), G.sx, G.sy - squadR() - 40, '#ff6b6b', 30);
          G.nFlash = 0.5; G.nFlashCol = '#ff6b6b'; sfx('bad'); G.shake = 6;
          lostFx(before - after);
        }
      }
    }
    if (row.passed) { row.fade -= dt * 2.2; if (row.fade <= 0) G.gates.splice(i, 1); }
    else if (row.y > H + 60) G.gates.splice(i, 1);
  }
}
function breakCrate(c) {
  c.dead = true; c.fade = 1;
  sfx('crate'); G.shake = Math.max(G.shake, 4);
  for (var i = 0; i < 14 && G.fx.length < 380; i++) G.fx.push({ k: 'plank', x: c.x, y: c.y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.8) * 240, life: 0.7, max: 0.7, col: '#a8743c', s: 5, rot: Math.random() * 6 });
  var rw = c.rw;
  if (rw.type === 'weapon') {
    if (rw.tier > G.weapon) { G.weapon = rw.tier; G.fireT = 0; }
    addText(WEAPONS[rw.tier].name + '!', c.x, c.y - 10, '#ffd34d', 26);
  } else if (rw.type === 'ally') {
    G.n = Math.min(99999, G.n + rw.v); G.nFlash = 0.5; G.nFlashCol = '#7fd8ff';
    addText('援軍 +' + fmt(rw.v), c.x, c.y - 10, '#7fd8ff', 24);
  } else {
    G.power *= rw.v; addText('攻撃力アップ!', c.x, c.y - 10, '#ff9b5a', 22);
  }
  sfx('power');
}
function updCrates(dt) {
  for (var i = G.crates.length - 1; i >= 0; i--) {
    var c = G.crates[i]; c.y += G.speed * dt; if (c.flash > 0) c.flash -= dt;
    if (c.dead) { c.fade -= dt * 4; if (c.fade <= 0) { G.crates.splice(i, 1); continue; } }
    if (c.y > H + 60) G.crates.splice(i, 1);
  }
}
function updEnemies(dt) {
  var R = squadR(), es = G.enemies;
  for (var i = es.length - 1; i >= 0; i--) {
    var e = es[i];
    if (e.dead) { es.splice(i, 1); continue; }
    if (e.flash > 0) e.flash -= dt;
    e.ph += dt;
    e.y += (G.speed + e.spd) * dt;
    var dy = G.sy - e.y, dx = G.sx - e.x;
    if (G.n > 0 && dy < 320 && dy > -10) e.x += clamp(dx, -e.T.steer * dt, e.T.steer * dt);
    if (e.T.weave) e.x += Math.sin(e.ph * (e.T.weave === 2 ? 2.2 : 4)) * (e.T.weave === 2 ? 40 : 30) * dt;
    e.x = clamp(e.x, ROAD_L + 6, ROAD_R - 6);
    if (G.n > 0 && dy < R * 0.72 + e.r && dy > -R * 0.72 && Math.abs(dx) < R + e.r * 0.6) {
      var lost = Math.min(G.n, e.pow); G.lossE = (G.lossE || 0) + lost;
      G.n -= lost; lostFx(lost); killEnemy(e, false); es.splice(i, 1);
      addText('−' + lost, e.x, e.y - 10, '#ff6b6b', 18);
      G.nFlash = 0.35; G.nFlashCol = '#ff6b6b'; G.shake = Math.max(G.shake, 3);
      continue;
    }
    if (e.y > H + 50) es.splice(i, 1);
  }
}
function lostFx(n) {
  var R = squadR();
  for (var i = 0; i < Math.min(12, n) && G.fx.length < 380; i++)
    G.fx.push({ k: 'soul', x: G.sx + (Math.random() - 0.5) * R * 1.6, y: G.sy + (Math.random() - 0.5) * R, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, life: 0.8, max: 0.8, col: '#fff', s: 4 });
  sfx('lose');
}
function updBoss(dt) {
  var b = G.boss; if (!b) return;
  b.t += dt; if (b.flash > 0) b.flash -= dt;
  if (b.phase === 'dead') {
    b.deadT += dt;
    if (Math.random() < 0.5 && b.deadT < 1.2) boom(b.x + (Math.random() - 0.5) * 100, b.y + (Math.random() - 0.5) * 100, 30, 0);
    return;
  }
  if (b.phase === 'enter') { b.y += 34 * dt; if (b.y >= b.stopY) { b.y = b.stopY; b.phase = 'fight'; } }
  b.x = MID + Math.sin(b.t * 0.55) * 70;
  if (b.phase !== 'fight' || G.n <= 0) return;
  var rage = b.hp < b.hpMax * 0.5 ? 0.65 : 1;
  b.slamT -= dt; b.fireT -= dt; b.sumT -= dt;
  if (b.slamT <= 0) { b.slamT = 3.3 * rage; G.slams.push({ x: clamp(G.sx, ROAD_L + 50, ROAD_R - 50), r: 64, t: 1.15, max: 1.15 }); sfx('warn'); }
  if (b.fireT <= 0) {
    b.fireT = 4.2 * rage;
    var ang = Math.atan2(G.sy - b.y, G.sx - b.x);
    for (var k = -1; k <= 1; k++) G.ebul.push({ x: b.x, y: b.y + 30, vx: Math.cos(ang + k * 0.3) * 135, vy: Math.sin(ang + k * 0.3) * 135, r: 10 });
    sfx('fireball');
  }
  if (b.sumT <= 0) {
    b.sumT = 6.5 * rage;
    var avail = ET_ORDER.slice(0, Math.min(ET_ORDER.length, G.stage + 1)), dps = mixDPS(1, 0.3), pw = Math.max(1, Math.round(expN(G.stage, 1) * 0.03));
    for (var m = 0; m < 5; m++) { var t = pick(avail); addEnemy(t, b.x - 80 + m * 40, b.y + 50, ET[t].hp * 0.15 * D(G.stage) * dps, ET[t].pow * pw, 1); }
  }
}
function killBoss() {
  var b = G.boss; b.phase = 'dead'; b.hp = 0;
  G.score += 1000 * G.stage + G.n * 5; G.kills++;
  G.enemies.forEach(function (e) { killEnemy(e, true); }); G.enemies = []; G.ebul = []; G.slams = [];
  G.shake = 14; G.clearT = 2.2; sfx('bossdown');
  addText('討ち取ったり!', MID, b.y + 80, '#ffd34d', 34);
}
function updEbul(dt) {
  var R = squadR();
  for (var i = G.ebul.length - 1; i >= 0; i--) {
    var f = G.ebul[i]; f.x += f.vx * dt; f.y += f.vy * dt;
    var dx = f.x - G.sx, dy = f.y - G.sy;
    if (G.n > 0 && Math.abs(dx) < R * 0.9 + f.r && Math.abs(dy) < R * 0.65 + f.r) {
      var lost = Math.min(G.n, Math.max(1, Math.ceil(G.n * 0.05)));
      G.n -= lost; lostFx(lost); addText('−' + lost, f.x, f.y, '#ff6b6b', 20);
      G.nFlash = 0.35; G.nFlashCol = '#ff6b6b'; G.shake = Math.max(G.shake, 4);
      boom(f.x, f.y, 20, 0); G.ebul.splice(i, 1); continue;
    }
    if (f.y > H + 30 || f.x < -30 || f.x > W + 30) G.ebul.splice(i, 1);
  }
}
function updSlams(dt) {
  var R = squadR();
  for (var i = G.slams.length - 1; i >= 0; i--) {
    var s = G.slams[i]; s.t -= dt;
    if (s.t <= 0) {
      var ov = Math.max(0, Math.min(G.sx + R, s.x + s.r) - Math.max(G.sx - R, s.x - s.r)) / (2 * R);
      if (ov > 0 && G.n > 0) {
        var lost = Math.min(G.n, Math.max(1, Math.ceil(G.n * ov * 0.4)));
        G.n -= lost; lostFx(lost); addText('−' + lost, s.x, G.sy - 30, '#ff6b6b', 26);
        G.nFlash = 0.4; G.nFlashCol = '#ff6b6b';
      }
      G.shake = Math.max(G.shake, 10); sfx('slam');
      G.fx.push({ k: 'ring', x: s.x, y: G.sy, r: s.r * 1.3, life: 0.35, max: 0.35, col: '#ff5a4a' });
      for (var k = 0; k < 10 && G.fx.length < 380; k++) G.fx.push({ k: 'dot', x: s.x + (Math.random() - 0.5) * s.r * 2, y: G.sy + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 100, life: 0.5, max: 0.5, col: '#8a6a4a', s: 4 });
      G.slams.splice(i, 1);
    }
  }
}
function spark(x, y, col, n) {
  for (var i = 0; i < n && G.fx.length < 380; i++) G.fx.push({ k: 'dot', x: x, y: y, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, life: 0.25, max: 0.25, col: col, s: 2.5 });
}
function addText(txt, x, y, col, size) { if (G.texts.length < 30) G.texts.push({ txt: txt, x: x, y: y, col: col, size: size, life: 1.1, max: 1.1 }); }
function updFx(dt) {
  var i, f;
  for (i = G.fx.length - 1; i >= 0; i--) {
    f = G.fx[i]; f.life -= dt; if (f.life <= 0) { G.fx.splice(i, 1); continue; }
    if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.k === 'plank' || f.k === 'dot') f.vy += 300 * dt; if (f.rot !== undefined) f.rot += dt * 10; }
  }
  for (i = G.texts.length - 1; i >= 0; i--) { f = G.texts[i]; f.life -= dt; f.y -= 34 * dt; if (f.life <= 0) G.texts.splice(i, 1); }
}
function updAmb(dt) {
  var kind = THEMES[G.theme].amb, want = kind === 'snow' ? 40 : 22;
  while (G.amb.length < want) G.amb.push({ x: Math.random() * W, y: Math.random() * H - (G.amb.length > want / 2 ? H : 0), s: 2 + Math.random() * 3, v: 20 + Math.random() * 40, ph: Math.random() * 6 });
  for (var i = 0; i < G.amb.length; i++) {
    var a = G.amb[i]; a.ph += dt;
    if (kind === 'ember') { a.y -= a.v * dt; a.x += Math.sin(a.ph * 2) * 20 * dt; if (a.y < -10) { a.y = H + 10; a.x = Math.random() * W; } }
    else if (kind === 'firefly') { a.x += Math.sin(a.ph * 0.9) * 14 * dt; a.y += (G.speed * 0.6 + Math.cos(a.ph) * 10) * dt; if (a.y > H + 10) { a.y = -10; a.x = Math.random() * W; } }
    else { a.y += (a.v + G.speed * 0.8) * dt; a.x += Math.sin(a.ph * 1.5) * 24 * dt; if (a.y > H + 10) { a.y = -10; a.x = Math.random() * W; } }
  }
}

/* ---------------- おまかせ操作(確認用: アドレスの末尾が #auto) ---------------- */
function bot() {
  var R = squadR(), tgt = null, i;
  var row = null;
  for (i = 0; i < G.gates.length; i++) { var r = G.gates[i]; if (!r.passed && r.y < G.sy && r.y > G.sy - 430 && (!row || r.y > row.y)) row = r; }
  if (row) {
    var best = null, bv = -1;
    row.list.forEach(function (g) { var v = gateResult(g, G.n); if (v > bv) { bv = v; best = g; } });
    tgt = (best.x0 + best.x1) / 2;
  } else {
    var cs = G.crates.filter(function (c) { return !c.dead && c.y > -20 && c.y < G.sy - 60; });
    if (cs.length) {
      var want = cs[0];
      cs.forEach(function (c) { if (c.rw.type === 'weapon' && c.rw.tier > G.weapon) want = c; });
      tgt = want.x;
    } else {
      var sx = 0, cnt = 0;
      G.enemies.forEach(function (e) { if (e.y > -10 && e.y < G.sy) { sx += e.x; cnt++; } });
      if (cnt) tgt = sx / cnt; else if (G.boss) tgt = G.boss.x;
    }
  }
  G.slams.forEach(function (s) { if (Math.abs(G.sx - s.x) < s.r + R) tgt = s.x < MID ? s.x + s.r + R + 10 : s.x - s.r - R - 10; });
  if (tgt !== null) G.tx = clamp(tgt, ROAD_L + 8, ROAD_R - 8);
}

/* ---------------- 描く ---------------- */
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#120a0a'; ctx.fillRect(0, 0, cv.width, cv.height);
  var shx = 0, shy = 0;
  if (G.shake > 0 && G.state === 'play') { shx = (Math.random() - 0.5) * G.shake; shy = (Math.random() - 0.5) * G.shake; }
  ctx.setTransform(SC, 0, 0, SC, OX + shx * SC, OY + shy * SC);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  drawBG();
  if (G.state !== 'title') {
    drawGates(); drawCrates(); drawSlams(); drawEnemies(); drawBoss();
  }
  drawSquad(); drawBullets(); drawEbul(); drawFx(); drawAmb();
  if (G.state !== 'title') { drawTexts(); drawHUD(); }
  ctx.restore();
}
function drawBG() {
  var th = THEMES[G.theme], d = G.dist;
  ctx.fillStyle = th.grass; ctx.fillRect(0, 0, W, H);
  // 草のむら
  var k0 = Math.floor((d - H) / 40) - 1, k1 = Math.ceil(d / 40) + 1, k, y, h;
  ctx.fillStyle = th.grass2;
  for (k = k0; k <= k1; k++) {
    y = d - k * 40;
    h = hash(k, 1); ctx.fillRect(h * 30, y, 6, 3);
    h = hash(k, 2); ctx.fillRect(ROAD_R + 4 + h * 28, y + 14, 6, 3);
  }
  // 道
  ctx.fillStyle = th.edge; ctx.fillRect(ROAD_L - 4, 0, ROAD_R - ROAD_L + 8, H);
  ctx.fillStyle = th.road; ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
  ctx.fillStyle = th.road2;
  for (k = k0; k <= k1; k++) {
    y = d - k * 40;
    for (var j = 0; j < 3; j++) {
      h = hash(k, 10 + j);
      var x = ROAD_L + 10 + h * (ROAD_R - ROAD_L - 20);
      ctx.beginPath(); ctx.ellipse(x, y + hash(k, 20 + j) * 40, 3 + hash(k, 30 + j) * 4, 2 + hash(k, 40 + j) * 2, 0, 0, 6.283); ctx.fill();
    }
  }
  // わだち
  ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(ROAD_L + 70, 0, 8, H); ctx.fillRect(ROAD_R - 78, 0, 8, H);
  // 道ばたの飾り
  var t0 = Math.floor((d - H - 80) / 70), t1 = Math.ceil((d + 80) / 70);
  for (k = t0; k <= t1; k++) {
    y = d - k * 70;
    for (var side = 0; side < 2; side++) {
      var hv = hash(k, 50 + side);
      if (hv < 0.25) continue;
      var type = th.deco[Math.floor(hash(k, 60 + side) * th.deco.length)];
      var xx = side ? ROAD_R + 16 + hash(k, 70) * 8 : ROAD_L - 16 - hash(k, 71) * 8;
      deco(type, xx, y + hash(k, 80 + side) * 30, side);
    }
  }
}
function deco(type, x, y, side) {
  var c = ctx;
  if (type === 'sakura') {
    c.fillStyle = '#6b4226'; c.fillRect(x - 3, y, 6, 22);
    c.fillStyle = '#f7b6cf'; c.beginPath(); c.arc(x - 9, y - 2, 13, 0, 6.283); c.arc(x + 9, y - 2, 13, 0, 6.283); c.arc(x, y - 12, 14, 0, 6.283); c.fill();
    c.fillStyle = '#ffd6e5'; c.beginPath(); c.arc(x - 4, y - 14, 6, 0, 6.283); c.arc(x + 8, y - 6, 5, 0, 6.283); c.fill();
  } else if (type === 'lantern') {
    c.fillStyle = '#8f8c86'; c.fillRect(x - 3, y, 6, 16); c.fillRect(x - 9, y + 14, 18, 4);
    c.fillRect(x - 7, y - 10, 14, 10); c.fillStyle = '#ffcf6a'; c.fillRect(x - 4, y - 7, 8, 5);
    c.fillStyle = '#6f6c66'; c.beginPath(); c.moveTo(x - 12, y - 10); c.lineTo(x + 12, y - 10); c.lineTo(x, y - 19); c.closePath(); c.fill();
    if (G.theme === 2) { c.fillStyle = 'rgba(255,200,90,.18)'; c.beginPath(); c.arc(x, y - 4, 20, 0, 6.283); c.fill(); }
  } else if (type === 'rock') {
    c.fillStyle = '#7d7b78'; c.beginPath(); c.ellipse(x, y + 8, 12, 8, 0, 0, 6.283); c.fill();
    c.fillStyle = '#9a9894'; c.beginPath(); c.ellipse(x - 3, y + 5, 6, 4, 0, 0, 6.283); c.fill();
  } else if (type === 'bamboo') {
    for (var i = -1; i <= 1; i++) {
      var bx = x + i * 9; c.fillStyle = i === 0 ? '#7fb24a' : '#6a9c3c'; c.fillRect(bx - 2.5, y - 34, 5, 64);
      c.fillStyle = '#4d7a2a'; c.fillRect(bx - 3, y - 14, 6, 2); c.fillRect(bx - 3, y + 8, 6, 2);
    }
    c.fillStyle = '#8cc45a'; c.beginPath(); c.ellipse(x + 8, y - 30, 9, 3, -0.5, 0, 6.283); c.ellipse(x - 8, y - 20, 9, 3, 0.5, 0, 6.283); c.fill();
  } else if (type === 'jizo') {
    c.fillStyle = '#9b9893'; c.beginPath(); c.arc(x, y - 4, 6, 0, 6.283); c.fill(); rrect(c, x - 7, y, 14, 16, 5); c.fill();
    c.fillStyle = '#d23b2f'; c.beginPath(); c.moveTo(x - 7, y + 1); c.lineTo(x + 7, y + 1); c.lineTo(x, y + 9); c.closePath(); c.fill();
  } else if (type === 'house') {
    c.fillStyle = '#3b3346'; c.fillRect(x - 14, y - 6, 28, 26);
    c.fillStyle = '#ffcf6a'; c.fillRect(x - 8, y + 2, 7, 7); c.fillRect(x + 2, y + 2, 7, 7);
    c.fillStyle = '#20202c'; c.beginPath(); c.moveTo(x - 20, y - 4); c.lineTo(x + 20, y - 4); c.lineTo(x + 12, y - 18); c.lineTo(x - 12, y - 18); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,200,90,.14)'; c.beginPath(); c.arc(x, y + 6, 22, 0, 6.283); c.fill();
  } else if (type === 'torii') {
    c.fillStyle = '#d9432b'; c.fillRect(x - 11, y - 10, 4, 30); c.fillRect(x + 7, y - 10, 4, 30); c.fillRect(x - 16, y - 14, 32, 5); c.fillRect(x - 12, y - 6, 24, 3);
  } else if (type === 'pine') {
    c.fillStyle = '#5a3d26'; c.fillRect(x - 3, y + 6, 6, 14);
    c.fillStyle = '#2f5a3a'; for (var j = 0; j < 3; j++) { c.beginPath(); c.moveTo(x - 16 + j * 3, y + 8 - j * 11); c.lineTo(x + 16 - j * 3, y + 8 - j * 11); c.lineTo(x, y - 8 - j * 11); c.closePath(); c.fill(); }
    if (G.theme === 3) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - 5, y - 26); c.lineTo(x + 5, y - 26); c.lineTo(x, y - 30); c.closePath(); c.fill(); }
  } else if (type === 'flag') {
    c.fillStyle = '#4a3a2a'; c.fillRect(x - 1, y - 30, 3, 50);
    var col = side ? '#c8382c' : '#2f62d8';
    c.fillStyle = col; c.fillRect(x + 2, y - 28, 12, 34);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 8, y - 16, 4, 0, 6.283); c.fill();
  } else if (type === 'fire') {
    var f = Math.sin(G.t * 12 + x) * 2;
    c.fillStyle = '#ff6a1a'; c.beginPath(); c.moveTo(x - 9, y + 12); c.quadraticCurveTo(x - 10, y - 4, x, y - 16 - f); c.quadraticCurveTo(x + 10, y - 4, x + 9, y + 12); c.closePath(); c.fill();
    c.fillStyle = '#ffd34d'; c.beginPath(); c.moveTo(x - 4, y + 12); c.quadraticCurveTo(x - 4, y + 2, x, y - 6 - f); c.quadraticCurveTo(x + 4, y + 2, x + 4, y + 12); c.closePath(); c.fill();
  }
}
function drawGates() {
  for (var i = 0; i < G.gates.length; i++) {
    var row = G.gates[i];
    ctx.globalAlpha = Math.max(0, row.fade);
    for (var k = 0; k < row.list.length; k++) {
      var g = row.list[k], good = gateGood(g), y = row.y, x0 = g.x0, x1 = g.x1, w = x1 - x0;
      if (row.passed && !g.chosen) ctx.globalAlpha = Math.max(0, row.fade) * 0.4;
      var gr = ctx.createLinearGradient(0, y - 26, 0, y + 26);
      if (good) { gr.addColorStop(0, 'rgba(90,190,255,.75)'); gr.addColorStop(1, 'rgba(40,110,230,.55)'); }
      else { gr.addColorStop(0, 'rgba(255,110,100,.75)'); gr.addColorStop(1, 'rgba(200,40,40,.55)'); }
      ctx.fillStyle = gr; ctx.fillRect(x0 + 5, y - 24, w - 10, 48);
      if (g.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, g.flash * 3) + ')'; ctx.fillRect(x0 + 5, y - 24, w - 10, 48); }
      // 鳥居のような枠
      ctx.fillStyle = '#5a2414'; ctx.fillRect(x0, y - 30, 7, 58); ctx.fillRect(x1 - 7, y - 30, 7, 58);
      ctx.fillStyle = '#2b1810'; ctx.fillRect(x0 - 5, y - 36, w + 10, 8);
      ctx.fillStyle = good ? '#2a6fd6' : '#c8382c'; ctx.fillRect(x0 - 2, y - 30, w + 4, 4);
      // 数字
      ctx.font = '900 30px ' + JF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineJoin = 'round';
      var lab = gateLabel(g); ctx.strokeText(lab, (x0 + x1) / 2, y + 1); ctx.fillStyle = '#fff'; ctx.fillText(lab, (x0 + x1) / 2, y + 1);
      if (row.passed && !g.chosen) ctx.globalAlpha = Math.max(0, row.fade);
    }
    ctx.globalAlpha = 1;
  }
}
function drawCrates() {
  for (var i = 0; i < G.crates.length; i++) {
    var c = G.crates[i], x = c.x - c.w / 2, y = c.y - c.h / 2;
    ctx.globalAlpha = c.dead ? Math.max(0, c.fade) : 1;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 4, y + 6, c.w, c.h);
    ctx.fillStyle = c.flash > 0 ? '#f0c890' : '#b07a3e'; ctx.fillRect(x, y, c.w, c.h);
    ctx.strokeStyle = '#6e4620'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, c.w - 3, c.h - 3);
    ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + c.w - 3, y + c.h - 3); ctx.moveTo(x + c.w - 3, y + 3); ctx.lineTo(x + 3, y + c.h - 3); ctx.stroke();
    // ごほうびの絵
    ctx.fillStyle = 'rgba(255,248,230,.9)'; ctx.beginPath(); ctx.arc(c.x, c.y - 4, 17, 0, 6.283); ctx.fill();
    var rw = c.rw;
    if (rw.type === 'weapon') weaponIcon(rw.tier, c.x, c.y - 4, 26);
    else if (rw.type === 'ally') ctx.drawImage(SPR.sam[0], c.x - 15, c.y - 21, 30, 30);
    else { ctx.font = '900 20px ' + JF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c8382c'; ctx.fillText('攻', c.x, c.y - 3); }
    // 名前と のこり
    var lab = rw.type === 'weapon' ? WEAPONS[rw.tier].name : rw.type === 'ally' ? '援軍+' + fmt(rw.v) : '攻撃×1.3';
    ctx.font = '800 12px ' + JF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#2b1810'; ctx.strokeText(lab, c.x, y - 9); ctx.fillStyle = rw.type === 'weapon' ? '#ffd34d' : '#fff'; ctx.fillText(lab, c.x, y - 9);
    if (!c.dead) {
      ctx.fillStyle = '#2b1810'; ctx.fillRect(x + 6, y + c.h - 11, c.w - 12, 6);
      ctx.fillStyle = '#7dff8a'; ctx.fillRect(x + 7, y + c.h - 10, (c.w - 14) * Math.max(0, c.hp / c.hpMax), 4);
    }
    ctx.globalAlpha = 1;
  }
}
function weaponIcon(tier, x, y, s) {
  var kind = WEAPONS[tier].kind;
  ctx.save(); ctx.translate(x, y);
  var k = s / 26; ctx.scale(k, k);
  if (kind === 'arrow') {
    ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(-4, 0, 11, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
  } else if (kind === 'star') { star(0, 0, 11, 0, '#7a8592');
  } else if (kind === 'ball') {
    ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-11, 7); ctx.lineTo(8, -8); ctx.stroke();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(11, -10); ctx.stroke();
  } else if (kind === 'fire') {
    ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(8, -8); ctx.stroke();
    emo('🔥', 7, -7, 14);
  } else if (kind === 'bomb') {
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-1, 2, 9, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(8, -10); ctx.stroke();
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(9, -11, 2.5, 0, 6.283); ctx.fill();
  } else {
    ctx.strokeStyle = '#3a7bd5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(10, -10); ctx.stroke();
    ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -11); ctx.lineTo(3, -2); ctx.lineTo(-3, 1); ctx.lineTo(2, 11); ctx.stroke();
  }
  ctx.restore();
}
function star(x, y, r, rot, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath();
  for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rad = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, 6.283); ctx.fill(); ctx.restore();
}
function drawSlams() {
  for (var i = 0; i < G.slams.length; i++) {
    var s = G.slams[i], p = 1 - s.t / s.max;
    ctx.fillStyle = 'rgba(255,40,30,' + (0.12 + p * 0.18) + ')'; ctx.beginPath(); ctx.ellipse(s.x, G.sy, s.r, s.r * 0.6, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,60,40,.35)'; ctx.beginPath(); ctx.ellipse(s.x, G.sy, s.r * p, s.r * 0.6 * p, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,70,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, G.sy, s.r, s.r * 0.6, 0, 0, 6.283); ctx.stroke();
    ctx.font = '900 22px ' + JF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('!', s.x, G.sy);
  }
}
function drawEnemies() {
  var es = G.enemies;
  for (var i = 0; i < es.length; i++) {
    var e = es[i], bob = Math.sin(e.ph * 9) * 1.5;
    if (e.y < -40 || e.y > H + 40) continue;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.size * 0.42, e.size * 0.36, e.size * 0.12, 0, 0, 6.283); ctx.fill();
    if (e.T.spr) { var sp = SPR[e.T.spr][Math.sin(e.ph * 9) > 0 ? 0 : 1]; ctx.drawImage(sp, e.x - e.size / 2, e.y - e.size / 2 + bob, e.size, e.size); }
    else emo(e.T.emo, e.x, e.y + bob, e.size);
    if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill(); }
    if (e.elite) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - 20, e.y - e.size / 2 - 9, 40, 5);
      ctx.fillStyle = '#ff5a4a'; ctx.fillRect(e.x - 19, e.y - e.size / 2 - 8, 38 * Math.max(0, e.hp / e.hpMax), 3);
    }
  }
}
function drawBoss() {
  var b = G.boss; if (!b) return;
  var a = b.phase === 'dead' ? Math.max(0, 1 - b.deadT / 1.4) : 1;
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 58, 52, 14, 0, 0, 6.283); ctx.fill();
  var pulse = 1 + Math.sin(b.t * 3) * 0.03;
  ctx.fillStyle = 'rgba(255,60,40,.18)'; ctx.beginPath(); ctx.arc(b.x, b.y, 70 * pulse, 0, 6.283); ctx.fill();
  var s = b.size * pulse;
  if (b.def.spr) ctx.drawImage(SPR.shogun[Math.sin(b.t * 6) > 0 ? 0 : 1], b.x - s / 2, b.y - s / 2, s, s);
  else emo(b.def.e, b.x, b.y, s);
  if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawSquad() {
  var m = G.n <= 0 && G.state === 'play' ? 0 : Math.floor(G.state === 'title' ? 40 : G.nShow);
  var sx = G.state === 'title' ? MID + Math.sin(G.t * 0.6) * 30 : G.sx, sy = G.sy;
  for (var j = 0; j < ORDER.length; j++) {
    var idx = ORDER[j]; if (idx >= m) continue;
    var u = FORM[idx], s = Math.sin(G.t * 10 + u.ph), bob = s * 1.4;
    ctx.drawImage(SPR[u.k][s > 0 ? 0 : 1], sx + u.x - 12, sy + u.y - 22 + bob, 24, 24);
  }
  if (G.state === 'title' || m <= 0) return;
  // 人数の旗
  var R = squadR(), by = sy - R * 0.72 - 34, txt = fmt(G.n);
  ctx.font = '900 22px ' + JF; var tw = Math.max(44, ctx.measureText(txt).width + 22);
  ctx.fillStyle = '#3a2416'; ctx.fillRect(sx - 1.5, by + 12, 3, 16);
  var col = G.nFlash > 0 ? G.nFlashCol : '#fff8e8';
  rrect(ctx, sx - tw / 2, by - 14, tw, 28, 8); ctx.fillStyle = 'rgba(20,10,8,.75)'; ctx.fill();
  ctx.strokeStyle = G.nFlash > 0 ? G.nFlashCol : '#ffd34d'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(txt, sx, by + 1);
}
function drawBullets() {
  var bs = G.bullets;
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    switch (b.kind) {
      case 'arrow':
        ctx.strokeStyle = '#f3e3c3'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.02, b.y + 11); ctx.stroke();
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(b.x, b.y - 4); ctx.lineTo(b.x - 2.5, b.y + 1); ctx.lineTo(b.x + 2.5, b.y + 1); ctx.closePath(); ctx.fill();
        break;
      case 'star': star(b.x, b.y, 5.5, b.rot, '#d6dee8'); break;
      case 'ball':
        ctx.fillStyle = 'rgba(255,210,80,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.4, 0, 6.283); ctx.fill(); break;
      case 'fire':
        ctx.strokeStyle = '#ff7a2f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 13); ctx.stroke();
        ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 6.283); ctx.fill(); break;
      case 'bomb':
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(b.x + 3, b.y - 3, 1.8, 0, 6.283); ctx.fill(); break;
      default:
        ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + 3, b.y + 6); ctx.lineTo(b.x - 3, b.y + 11); ctx.lineTo(b.x, b.y + 17); ctx.stroke();
    }
  }
}
function drawEbul() {
  for (var i = 0; i < G.ebul.length; i++) {
    var f = G.ebul[i];
    ctx.fillStyle = 'rgba(255,90,30,.35)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 5, 0, 6.283); ctx.fill();
    emo('🔥', f.x, f.y, f.r * 2.6);
  }
}
function drawFx() {
  for (var i = 0; i < G.fx.length; i++) {
    var f = G.fx[i], a = f.life / f.max;
    ctx.globalAlpha = Math.max(0, a);
    if (f.k === 'ring') { ctx.strokeStyle = f.col; ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.4 - a * 0.6), 0, 6.283); ctx.stroke(); }
    else if (f.k === 'plank') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = f.col; ctx.fillRect(-7, -2, 14, 4); ctx.restore(); }
    else if (f.k === 'soul') { ctx.fillStyle = 'rgba(220,240,255,.85)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, 6.283); ctx.fill(); }
    else { ctx.fillStyle = f.col; ctx.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s); }
  }
  ctx.globalAlpha = 1;
}
function drawAmb() {
  var kind = THEMES[G.theme].amb;
  for (var i = 0; i < G.amb.length; i++) {
    var a = G.amb[i];
    if (kind === 'petal') { ctx.fillStyle = 'rgba(255,190,215,.9)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.s, a.s * 0.6, a.ph, 0, 6.283); ctx.fill(); }
    else if (kind === 'leaf') { ctx.fillStyle = 'rgba(150,200,90,.8)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.s * 1.2, a.s * 0.45, a.ph, 0, 6.283); ctx.fill(); }
    else if (kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(a.x, a.y, a.s * 0.6, 0, 6.283); ctx.fill(); }
    else if (kind === 'firefly') { ctx.fillStyle = 'rgba(220,255,120,' + (0.4 + 0.4 * Math.sin(a.ph * 3)) + ')'; ctx.beginPath(); ctx.arc(a.x, a.y, 1.8, 0, 6.283); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,150,60,' + (0.5 + 0.4 * Math.sin(a.ph * 4)) + ')'; ctx.fillRect(a.x, a.y, 2, 2); }
  }
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (var i = 0; i < G.texts.length; i++) {
    var t = G.texts[i], a = Math.min(1, t.life / t.max * 2.5);
    ctx.globalAlpha = a; ctx.font = '900 ' + t.size + 'px ' + JF;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,10,8,.8)'; ctx.strokeText(t.txt, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
function pill(x, y, w, h) { rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(20,10,8,.62)'; ctx.fill(); }
function drawHUD() {
  var y = SAFE_T + 8;
  ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  pill(8, y, 74, 28); ctx.font = '900 16px ' + JF; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd34d'; ctx.fillText('第' + G.stage + '陣', 45, y + 14);
  // 進み具合
  var px = 90, pw = 78, p = clamp(G.dist / G.bossAt, 0, 1);
  pill(px, y + 8, pw, 12); ctx.fillStyle = '#ffd34d'; rrect(ctx, px + 2, y + 10, (pw - 4) * p, 8, 4); ctx.fill();
  if (BOSSES[(G.stage - 1) % BOSSES.length].e) emo(BOSSES[(G.stage - 1) % BOSSES.length].e, px + pw + 2, y + 14, 22);
  else ctx.drawImage(SPR.shogun[0], px + pw - 10, y + 2, 24, 24);
  // 点数
  ctx.textAlign = 'right'; ctx.font = '900 17px ' + JF; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,10,8,.7)';
  var sc = String(G.score); ctx.strokeText(sc, W - 102, y + 14); ctx.fillStyle = '#fff'; ctx.fillText(sc, W - 102, y + 14);
  // 大将の体力
  var b = G.boss;
  if (b && b.phase !== 'dead' && b.y > -40) {
    var by = y + 36; pill(30, by, W - 60, 22);
    ctx.fillStyle = '#5a1010'; rrect(ctx, 34, by + 4, W - 68, 14, 7); ctx.fill();
    ctx.fillStyle = '#ff4a3a'; rrect(ctx, 34, by + 4, Math.max(0, (W - 68) * b.hp / b.hpMax), 14, 7); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = '900 12px ' + JF; ctx.fillStyle = '#fff'; ctx.fillText('大将 ' + b.def.n, MID, by + 11);
  }
  // 武器
  var wy = H - SAFE_B - 40, w = WEAPONS[G.weapon];
  pill(8, wy, 132 + (G.power > 1.01 ? 50 : 0), 30);
  weaponIcon(G.weapon, 26, wy + 15, 20);
  ctx.textAlign = 'left'; ctx.font = '900 15px ' + JF; ctx.fillStyle = '#fff'; ctx.fillText(w.name, 42, wy + 15);
  ctx.font = '800 11px ' + JF; ctx.fillStyle = '#ffd34d'; ctx.fillText('Lv' + (G.weapon + 1), 100, wy + 16);
  if (G.power > 1.01) { ctx.fillStyle = '#ff9b5a'; ctx.fillText('攻×' + (Math.round(G.power * 10) / 10), 130, wy + 16); }
  // 見出し(第◯陣・大将 現る)
  if (G.banner) {
    var bn = G.banner, a = Math.min(1, bn.t * 2, (2.4 - bn.t) * 4);
    ctx.globalAlpha = Math.max(0, a);
    var cy = H * 0.36;
    ctx.fillStyle = 'rgba(15,8,6,.7)'; ctx.fillRect(0, cy - 44, W, 88);
    ctx.fillStyle = bn.col; ctx.fillRect(0, cy - 44, W, 3); ctx.fillRect(0, cy + 41, W, 3);
    ctx.textAlign = 'center'; ctx.font = '900 38px ' + JF; ctx.lineWidth = 6; ctx.strokeStyle = '#1a0d0d';
    ctx.strokeText(bn.big, MID, cy - 8); ctx.fillStyle = bn.col; ctx.fillText(bn.big, MID, cy - 8);
    ctx.font = '800 18px ' + JF; ctx.fillStyle = '#fff'; ctx.fillText(bn.small, MID, cy + 24);
    ctx.globalAlpha = 1;
  }
}

/* ---------------- 音(WebAudio で その場で作る) ---------------- */
var AU = { c: null, m: null, nb: null, last: {} };
function auStart() {
  try {
    if (!AU.c) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      AU.c = new AC(); AU.m = AU.c.createGain(); AU.m.gain.value = SAVE.mute ? 0 : 0.5; AU.m.connect(AU.c.destination);
      var len = AU.c.sampleRate, buf = AU.c.createBuffer(1, len, AU.c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AU.nb = buf;
    }
    if (AU.c.state === 'suspended') AU.c.resume();
    bgmStart();
  } catch (e) {}
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(f, t, dur, type, vol, f2) {
  var o = AU.c.createOscillator(), g = AU.c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, 0.006, vol, dur); o.connect(g); g.connect(AU.m); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, vol, ft, freq) {
  var s = AU.c.createBufferSource(); s.buffer = AU.nb; var f = AU.c.createBiquadFilter(); f.type = ft; f.frequency.value = freq;
  var g = AU.c.createGain(); env(g, t, 0.003, vol, dur); s.connect(f); f.connect(g); g.connect(AU.m); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
var GAP = { shot: 0.09, hit: 0.05, kill: 0.05, lose: 0.12, wood: 0.07, tick: 0.06 };
function sfx(name) {
  if (!AU.c || SAVE.mute || AU.c.state !== 'running' || G.timeScale > 1) return;
  var t = AU.c.currentTime, gap = GAP[name];
  if (gap && AU.last[name] && t - AU.last[name] < gap) return;
  AU.last[name] = t;
  try {
    switch (name) {
      case 'shot': noise(t, 0.04, 0.05, 'highpass', 2500); break;
      case 'hit': tone(220, t, 0.05, 'triangle', 0.06, 120); break;
      case 'kill': noise(t, 0.08, 0.1, 'bandpass', 1200); tone(330, t, 0.07, 'square', 0.03, 160); break;
      case 'bigkill': noise(t, 0.3, 0.25, 'lowpass', 800); tone(160, t, 0.3, 'sawtooth', 0.08, 50); break;
      case 'wood': noise(t, 0.05, 0.1, 'bandpass', 700); break;
      case 'crate': noise(t, 0.25, 0.3, 'lowpass', 1000); tone(140, t, 0.15, 'square', 0.06, 70); break;
      case 'power': [587, 784, 880, 1175].forEach(function (f, i) { tone(f, t + i * 0.06, 0.18, 'triangle', 0.12); }); break;
      case 'good': [587, 880, 1175].forEach(function (f, i) { tone(f, t + i * 0.05, 0.2, 'triangle', 0.13); tone(f * 2, t + i * 0.05, 0.08, 'sine', 0.04); }); break;
      case 'bad': [440, 349, 262].forEach(function (f, i) { tone(f, t + i * 0.07, 0.18, 'sawtooth', 0.06); }); break;
      case 'tick': tone(1320, t, 0.04, 'square', 0.03); break;
      case 'flip': tone(784, t, 0.06, 'square', 0.05); tone(1175, t + 0.06, 0.12, 'square', 0.05); break;
      case 'lose': tone(300, t, 0.12, 'sawtooth', 0.05, 150); break;
      case 'dead': [392, 311, 262, 196].forEach(function (f, i) { tone(f, t + i * 0.16, 0.35, 'triangle', 0.14); }); break;
      case 'warn': tone(880, t, 0.08, 'square', 0.05); tone(880, t + 0.14, 0.08, 'square', 0.05); break;
      case 'slam': taiko(t, 0.7); noise(t, 0.35, 0.35, 'lowpass', 300); break;
      case 'fireball': noise(t, 0.3, 0.12, 'bandpass', 500); break;
      case 'boss':   // ほら貝 と 太鼓
        var o = AU.c.createOscillator(), g = AU.c.createGain(), f = AU.c.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(98, t); o.frequency.linearRampToValueAtTime(116, t + 0.4); o.frequency.linearRampToValueAtTime(104, t + 1.3);
        f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        o.connect(f); f.connect(g); g.connect(AU.m); o.start(t); o.stop(t + 1.6);
        taiko(t, 0.6); taiko(t + 0.5, 0.6); taiko(t + 0.75, 0.5); taiko(t + 1.0, 0.7); break;
      case 'bossdown': taiko(t, 0.8); taiko(t + 0.3, 0.8); [587, 698, 880, 1175, 1397].forEach(function (f, i) { tone(f, t + 0.3 + i * 0.09, 0.4, 'triangle', 0.13); }); break;
      case 'clear': [587, 784, 880, 1175].forEach(function (f, i) { tone(f, t + i * 0.12, 0.45, 'triangle', 0.14); }); break;
    }
  } catch (e) {}
}
function taiko(t, v) { tone(150, t, 0.35, 'sine', v, 48); noise(t, 0.06, v * 0.35, 'lowpass', 500); }
// 太鼓と三味線ふうの 音楽(都節の音階)
var SCALE = [293.66, 311.13, 392, 440, 466.16, 587.33, 622.25, 783.99, 880];
var BGM = { timer: null, next: 0, step: 0, mel: [] };
function genMel() {
  seed = (G.stage * 31 + 7) >>> 0; var m = [], idx = 4;
  for (var i = 0; i < 32; i++) {
    if (i % 2 === 0 && rnd() < 0.62) { idx = clamp(idx + Math.round(rr(-2.4, 2.4)), 0, SCALE.length - 1); m.push(SCALE[idx]); } else m.push(0);
  }
  BGM.mel = m;
}
function bgmStart() {
  if (BGM.timer || !AU.c) return;
  genMel(); BGM.next = AU.c.currentTime + 0.1;
  BGM.timer = setInterval(bgmTick, 70);
}
function bgmTick() {
  if (!AU.c) return;
  var now = AU.c.currentTime;
  if (G.state !== 'play' || G.paused || SAVE.mute || AU.c.state !== 'running' || G.overT > 0) { BGM.next = now + 0.1; return; }
  var boss = G.boss && G.boss.phase !== 'dead', spb = 60 / (boss ? 156 : 132) / 4;
  while (BGM.next < now + 0.25) {
    var s = BGM.step % 16, t = BGM.next;
    var pat = boss ? [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0] : [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0];
    if (pat[s]) taiko(t, s === 0 ? 0.32 : 0.2);
    if (s % 4 === 2) tone(2400, t, 0.03, 'square', 0.012);
    var f = BGM.mel[BGM.step % 32];
    if (f) { tone(f, t, 0.22, 'triangle', 0.06, f * 0.99); tone(f * 2, t, 0.05, 'square', 0.008); }
    BGM.next += spb; BGM.step++;
  }
}

/* ---------------- 画面の切りかえ ---------------- */
var $ = function (id) { return document.getElementById(id); };
function hideAll() { ['title', 'over', 'clear', 'pause'].forEach(function (id) { $(id).classList.add('hidden'); }); }
function startRun(stage, ev) {
  auStart();
  G.score = 0; G.kills = 0;
  startStage(stage);
  G.state = 'play'; G.paused = false; hideAll();
  $('ctl').classList.remove('hidden');
  if (ev && ev.isTrusted) try {
    var el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
    var pr = fs && fs.call(el); if (pr && pr.catch) pr.catch(function () {});
  } catch (e) {}
}
function nextStage() { auStart(); var sc = G.score; startStage(G.stage + 1); G.score = sc; G.state = 'play'; hideAll(); $('ctl').classList.remove('hidden'); }
function showOver() {
  G.state = 'over'; $('ctl').classList.add('hidden');
  if (G.score > SAVE.best) SAVE.best = G.score;
  save();
  $('overText').textContent = '第' + G.stage + '陣で 討死…';
  $('overScore').innerHTML = '点数 <b>' + G.score + '</b>(最高 ' + SAVE.best + ')<br>いちばん多かった仲間 <b>' + fmt(G.maxN) + '人</b>';
  $('btnRetry').textContent = 'もう一度(第' + G.stage + '陣)';
  $('over').classList.remove('hidden');
}
function showClear() {
  G.state = 'clear'; $('ctl').classList.add('hidden');
  SAVE.stage = Math.max(SAVE.stage, G.stage + 1); SAVE.bestStage = Math.max(SAVE.bestStage, G.stage);
  if (G.score > SAVE.best) SAVE.best = G.score;
  save(); sfx('clear');
  $('clearText').textContent = '第' + G.stage + '陣 突破!';
  $('clearScore').innerHTML = '大将 <b>' + BOSSES[(G.stage - 1) % BOSSES.length].n + '</b> を討ち取った!<br>のこった仲間 <b>' + fmt(G.n) + '人</b>(最大 ' + fmt(G.maxN) + '人)<br>点数 <b>' + G.score + '</b>';
  $('clear').classList.remove('hidden');
}
function showTitle() {
  G.state = 'title'; hideAll(); $('ctl').classList.add('hidden'); $('title').classList.remove('hidden');
  G.theme = (SAVE.stage - 1) % THEMES.length; G.amb = [];
  $('btnPlay').textContent = SAVE.stage > 1 ? '出陣!(第' + SAVE.stage + '陣)' : '出陣!';
  $('btnFirst').classList.toggle('hidden', SAVE.stage <= 1);
  $('bestLine').textContent = SAVE.best ? '最高点 ' + SAVE.best + ' / 突破 第' + SAVE.bestStage + '陣まで' : '';
}
function setPause(on) {
  if (G.state !== 'play') return;
  G.paused = on; $('pause').classList.toggle('hidden', !on);
}
function toggleMute() {
  SAVE.mute = !SAVE.mute; save();
  if (AU.m) AU.m.gain.value = SAVE.mute ? 0 : 0.5;
  $('btnMute').textContent = SAVE.mute ? '🔇' : '🔊';
}
function btn(id, fn) { $(id).addEventListener('click', function (ev) { this.blur(); fn(ev); }); }
btn('btnPlay', function (ev) { startRun(SAVE.stage, ev); });
btn('btnFirst', function (ev) { startRun(1, ev); });
btn('btnRetry', function (ev) { startRun(G.stage, ev); });
btn('btnTitle', showTitle);
btn('btnTitle2', showTitle);
btn('btnNext', nextStage);
btn('btnPause', function () { auStart(); setPause(true); });
btn('btnResume', function () { auStart(); setPause(false); });
btn('btnQuit', showTitle);
btn('btnMute', function () { auStart(); toggleMute(); });
$('btnMute').textContent = SAVE.mute ? '🔇' : '🔊';
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { if (G.state === 'play') setPause(true); }
  else buildArt();     // スマホが裏で絵を捨てることがあるので 描き直す
});

/* ---------------- ループ ---------------- */
var last = 0, acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  try {
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (G.state === 'play' && !G.paused) {
      acc += dt * G.timeScale; var n = 0;
      while (acc >= DT && n++ < 12 * G.timeScale) { update(DT); acc -= DT; }
      if (acc > DT * 4) acc = 0;
      updAmb(dt);
    } else if (G.state === 'title') { G.t += dt; G.dist += 40 * dt; updAmb(dt); }
    draw();
  } catch (e) { console.error(e); }
}

buildArt();
addEventListener('resize', resize); resize();
showTitle();
requestAnimationFrame(function (t) { last = t; loop(t); });

// 確認用: #play ですぐ始まる / #auto でおまかせ操作 / #auto4 で4倍速 / #s3 で第3陣から
var hs = location.hash;
var mS = /s(\d+)/.exec(hs), st = mS ? +mS[1] : 1;
if (/auto/.test(hs)) { G.auto = true; var mT = /auto(\d+)/.exec(hs); if (mT) G.timeScale = +mT[1]; }
if (/play|auto/.test(hs)) startRun(st);
window.__musou = {
  G: G, startRun: startRun, update: update,
  sim: function (sec) { var n = Math.round(sec / DT); for (var i = 0; i < n && G.state === 'play'; i++) update(DT); return G.state; }
};
})();
