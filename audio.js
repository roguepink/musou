'use strict';
/* 侍無双の音(ファイルを使わず WebAudio で その場で作る)
   楽器: 大太鼓・締太鼓・鉦(かね)・三味線ふう・尺八ふう・琴ふう・低音
   曲: 合戦(ふつう)/大軍(はげしく)/大将戦(別の曲)/心臓の音(あぶないとき)
   使い方: SND.start()(最初のタップで)/ SND.music('battle'|'rush'|'boss'|'off') / SND.sfx(名前) / SND.heart(true|false) / SND.setMute(true|false) */
(function () {
  var A = { c: null, out: null, rev: null, revIn: null, nb: null, muted: false, mode: 'off', heart: false, last: {}, step: 0, next: 0, timer: null, quiet: false };
  // 都節の音階(レ・ミ♭・ソ・ラ・シ♭)。度数 → 周波数
  var BASE = [293.66, 311.13, 392.0, 440.0, 466.16];
  function deg(n) { var o = Math.floor(n / 5), i = ((n % 5) + 5) % 5; return BASE[i] * Math.pow(2, o); }

  function start() {
    try {
      if (!A.c) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        var c = A.c = new AC();
        var comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        A.out = c.createGain(); A.out.gain.value = A.muted ? 0 : 0.7;
        A.out.connect(comp); comp.connect(c.destination);
        // 響き(お寺の中のような残響)
        var len = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, len, c.sampleRate);
        for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        A.rev = c.createConvolver(); A.rev.buffer = ir;
        A.revIn = c.createGain(); A.revIn.gain.value = 0.28; A.revIn.connect(A.rev); A.rev.connect(A.out);
        var nl = c.sampleRate, nb = c.createBuffer(1, nl, c.sampleRate), nd = nb.getChannelData(0);
        for (var k = 0; k < nl; k++) nd[k] = Math.random() * 2 - 1;
        A.nb = nb;
        A.timer = setInterval(tick, 60);
      }
      if (A.c.state === 'suspended') A.c.resume();
    } catch (e) {}
  }
  function ok() { return A.c && !A.muted && A.c.state === 'running' && !A.quiet; }
  function gainEnv(t, a, peak, d, wet) {
    var g = A.c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(A.out); if (wet) { var s = A.c.createGain(); s.gain.value = wet; g.connect(s); s.connect(A.revIn); }
    return g;
  }
  function osc(type, f, t, dur, vol, f2, wet, a) {
    var o = A.c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = gainEnv(t, a || 0.005, vol, dur, wet); o.connect(g); o.start(t); o.stop(t + dur + (a || 0.005) + 0.05); return o;
  }
  function noise(t, dur, vol, ft, freq, q, wet, f2) {
    var s = A.c.createBufferSource(); s.buffer = A.nb; var f = A.c.createBiquadFilter(); f.type = ft; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = gainEnv(t, 0.003, vol, dur, wet); s.connect(f); f.connect(g); s.start(t, Math.random() * 0.6); s.stop(t + dur + 0.05);
  }
  /* ---------- 楽器 ---------- */
  function taiko(t, v) { osc('sine', 160, t, 0.45, v, 42, 0.5); osc('sine', 95, t, 0.25, v * 0.5, 50, 0.3); noise(t, 0.07, v * 0.45, 'lowpass', 700, 1, 0.3); }
  function shime(t, v) { osc('triangle', 420, t, 0.07, v, 210, 0.15); noise(t, 0.04, v * 0.6, 'bandpass', 2400, 2, 0.1); }
  function kane(t, v) { [1180, 1730, 2520].forEach(function (f, i) { osc('sine', f, t, 0.35 - i * 0.08, v * (1 - i * 0.25), 0, 0.4); }); }
  function shamisen(f, t, v) {     // バチではじく音 + さわり(ビリつき)
    var o = A.c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    var lp = A.c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.22);
    var g = gainEnv(t, 0.002, v, 0.32, 0.25); o.connect(lp); lp.connect(g); o.start(t); o.stop(t + 0.4);
    noise(t, 0.03, v * 0.35, 'highpass', 3000, 1, 0.1);
  }
  function koto(f, t, v) { osc('triangle', f, t, 0.9, v, f * 0.998, 0.45); osc('sine', f * 2, t, 0.4, v * 0.3, 0, 0.3); }
  function shaku(f, t, dur, v, bend) {   // 尺八: ゆっくり立ち上がる笛 + 息の音 + ゆれ
    var c = A.c, o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(bend ? f * 0.94 : f, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.18);
    var lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
    lfo.connect(lg); lg.connect(o.frequency);
    var g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.12); g.gain.setValueAtTime(v, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var s = c.createGain(); s.gain.value = 0.6; g.connect(A.out); g.connect(s); s.connect(A.revIn);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
    var o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; var g2 = c.createGain(); g2.gain.value = 0.12; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t + dur);
    noise(t, Math.min(0.3, dur), v * 0.5, 'bandpass', f * 2, 6, 0.3);
  }
  function bass(f, t, v) { osc('triangle', f, t, 0.3, v, f * 0.99, 0.05); osc('sine', f / 2, t, 0.3, v * 0.7, 0, 0); }
  function kakegoe(t, v) {   // 掛け声「ハッ!」(人の声ふうの雑音)
    noise(t, 0.12, v, 'bandpass', 900, 4, 0.4, 600); noise(t, 0.1, v * 0.6, 'bandpass', 2400, 6, 0.3, 1800);
  }

  /* ---------- 曲(16分音符で 2小節 = 32歩) ---------- */
  var _ = null;
  var RIFF = [0, _, 0, 5, _, 4, 3, _, 2, _, 3, _, 4, _, 3, 2,   0, _, 0, 5, _, 7, 6, 5, 4, _, 3, _, 2, 1, 0, _];
  var RIFF2 = [5, _, 5, 7, _, 6, 5, _, 4, _, 5, _, 6, _, 5, 4,   3, _, 3, 5, _, 4, 3, 2, 3, _, 2, _, 1, 2, 0, _];
  var BASSL = [-5, _, _, _, _, _, -5, _, -3, _, _, _, -2, _, _, _,   -5, _, _, _, _, _, -5, _, -1, _, _, _, -2, _, -3, _];
  var TAI = [1, 0, 0, .5, 0, 0, 1, 0, 1, 0, 0, .5, 0, 0, 1, 0];
  var TAI_RUSH = [1, 0, .6, .5, 1, 0, 1, 0, 1, 0, .6, .5, 1, .5, 1, .5];
  var MEL = [[0, 7, 6], [6, 6, 2], [8, 5, 8], [16, 4, 4], [20, 5, 4], [24, 3, 8], [32, 7, 4], [36, 8, 4], [40, 9, 8], [48, 8, 4], [52, 7, 2], [54, 6, 2], [56, 5, 8]];
  var BRIFF = [0, 0, _, 1, 0, _, _, 1, 0, _, 4, _, 3, _, 1, _,   0, 0, _, 1, 0, _, 7, 6, 5, _, 4, _, 1, _, 0, _];
  var BBASS = [-5, _, -5, _, _, -4, _, _, -5, _, -5, _, -1, _, -2, _,   -5, _, -5, _, _, -4, _, _, -3, _, -2, _, -4, _, -5, _];
  var BTAI = [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1];
  var BMEL = [[0, 10, 8], [8, 9, 4], [12, 7, 4], [16, 8, 12], [32, 10, 6], [38, 11, 2], [40, 10, 8], [48, 8, 4], [52, 7, 4], [56, 5, 8]];

  function tick() {
    if (!A.c) return;
    var now = A.c.currentTime;
    if (!ok() || A.mode === 'off') { A.next = now + 0.08; return; }
    var boss = A.mode === 'boss', rush = A.mode === 'rush';
    var spb = 60 / (boss ? 164 : rush ? 150 : 140) / 4;
    while (A.next < now + 0.2) {
      var t = A.next, s = A.step, b = s % 16, s32 = s % 32, s64 = s % 64, cyc = Math.floor(s / 64);
      if (boss) {
        if (BTAI[b]) taiko(t, b % 4 === 0 ? 0.42 : 0.26);
        if (b % 2 === 0) shime(t, b % 4 === 0 ? 0.07 : 0.04); else if (s % 4 === 3) shime(t, 0.03);
        if (b === 0 || b === 8) kane(t, 0.035);
        var r = BRIFF[s32]; if (r !== null) shamisen(deg(r), t, 0.11);
        var bs = BBASS[s32]; if (bs !== null) bass(deg(bs), t, 0.16);
        if (cyc % 2 === 1) BMEL.forEach(function (m) { if (m[0] === s64) shaku(deg(m[1]), t, m[2] * spb * 1.05, 0.085, true); });
        if (s64 === 60 || s64 === 28) kakegoe(t, 0.18);
      } else {
        var tp = rush ? TAI_RUSH : TAI;
        if (tp[b]) taiko(t, (b === 0 ? 0.38 : 0.24) * tp[b]);
        if (b % 2 === 0) shime(t, b % 4 === 0 ? 0.05 : 0.025);
        if (b === 4 || b === 12) kane(t, rush ? 0.035 : 0.02);
        var riff = (cyc % 4 === 3) ? RIFF2 : RIFF, rn = riff[s32];
        if (rn !== null) shamisen(deg(rn), t, 0.09);
        var bn = BASSL[s32]; if (bn !== null) bass(deg(bn), t, 0.13);
        if (cyc % 2 === 1 || rush) MEL.forEach(function (m) { if (m[0] === s64) shaku(deg(m[1]), t, m[2] * spb * 1.05, 0.07, m[2] >= 6); });
        if (cyc % 2 === 0 && !rush && s64 % 16 === 0) koto(deg(10), t, 0.05);
        if (rush && s64 === 0) kakegoe(t, 0.16);
      }
      if (A.heart && s % 16 === 0) { osc('sine', 62, t, 0.16, 0.5, 40, 0); osc('sine', 58, t + 0.2, 0.14, 0.35, 38, 0); }
      A.next += spb; A.step++;
    }
  }

  /* ---------- 効果音 ---------- */
  var GAP = { shot: 0.07, hit: 0.04, kill: 0.035, lose: 0.1, wood: 0.06, tick: 0.05, pop: 0.03, boom: 0.06, zap: 0.08, slash: 0.1, clang: 0.05 };
  function sfx(name, v) {
    if (!ok()) return;
    var t = A.c.currentTime, gap = GAP[name];
    if (gap && A.last[name] && t - A.last[name] < gap) return;
    A.last[name] = t; v = v || 1;
    try {
      switch (name) {
        case 'shot': noise(t, 0.035, 0.035 * v, 'highpass', 3500, 1, 0); break;
        case 'gun': noise(t, 0.12, 0.14 * v, 'lowpass', 1600, 1, 0.2); osc('square', 120, t, 0.06, 0.05, 60, 0); break;
        case 'cannon': noise(t, 0.4, 0.3 * v, 'lowpass', 500, 1, 0.4); osc('sine', 90, t, 0.3, 0.25, 35, 0.3); break;
        case 'hit': osc('triangle', 240, t, 0.04, 0.05 * v, 130, 0); break;
        case 'kill': noise(t, 0.07, 0.09 * v, 'bandpass', 1300, 1.5, 0.1); osc('square', 300, t, 0.05, 0.025, 150, 0); break;
        case 'bigkill': noise(t, 0.35, 0.25, 'lowpass', 900, 1, 0.4); osc('sawtooth', 150, t, 0.35, 0.08, 45, 0.3); break;
        case 'boom': noise(t, 0.45, 0.28 * v, 'lowpass', 700, 1, 0.45, 120); osc('sine', 110, t, 0.35, 0.22 * v, 38, 0.3); break;
        case 'pop': noise(t, 0.03, 0.12 * v, 'highpass', 1500, 1, 0.15); break;
        case 'crackle': for (var i = 0; i < 6; i++) noise(t + i * 0.045 + Math.random() * 0.02, 0.025, 0.12, 'highpass', 1800, 1, 0.2); break;
        case 'firework': osc('sine', 600, t, 0.5, 0.05, 1500, 0.3, 0.02); noise(t + 0.5, 0.6, 0.2, 'lowpass', 2000, 1, 0.6, 300); break;
        case 'zap': noise(t, 0.18, 0.2, 'highpass', 2500, 1, 0.3); osc('sawtooth', 70, t, 0.4, 0.12, 40, 0.4); break;
        case 'slash': noise(t, 0.18, 0.16, 'bandpass', 600, 3, 0.3, 3500); break;
        case 'clang': osc('square', 900, t, 0.08, 0.03, 700, 0.2); break;
        case 'wood': noise(t, 0.05, 0.1, 'bandpass', 650, 2, 0.1); break;
        case 'crate': noise(t, 0.3, 0.3, 'lowpass', 900, 1, 0.3); osc('square', 140, t, 0.15, 0.06, 70, 0); break;
        case 'power': [5, 7, 8, 10, 12].forEach(function (d, i) { koto(deg(d), t + i * 0.06, 0.1); }); break;
        case 'good': [5, 8, 10].forEach(function (d, i) { koto(deg(d), t + i * 0.05, 0.12); }); kane(t + 0.12, 0.04); break;
        case 'bad': [4, 2, 0].forEach(function (d, i) { osc('sawtooth', deg(d), t + i * 0.08, 0.2, 0.06, 0, 0.2); }); break;
        case 'tick': osc('square', 1320, t, 0.035, 0.025, 0, 0); break;
        case 'flip': osc('square', 784, t, 0.06, 0.05, 0, 0.1); osc('square', 1175, t + 0.06, 0.12, 0.05, 0, 0.1); break;
        case 'lose': osc('sawtooth', 300, t, 0.12, 0.05, 140, 0.1); break;
        case 'warn': osc('square', 880, t, 0.09, 0.05, 0, 0.1); osc('square', 660, t + 0.12, 0.09, 0.05, 0, 0.1); break;
        case 'horn':     // ほら貝
          var o = A.c.createOscillator(), lp = A.c.createBiquadFilter(), g = gainEnv(t, 0.25, 0.2, 1.4, 0.5);
          o.type = 'sawtooth'; o.frequency.setValueAtTime(98, t); o.frequency.linearRampToValueAtTime(118, t + 0.4); o.frequency.linearRampToValueAtTime(104, t + 1.5);
          lp.type = 'lowpass'; lp.frequency.value = 800; o.connect(lp); lp.connect(g); o.start(t); o.stop(t + 1.8);
          taiko(t, 0.5); taiko(t + 0.45, 0.4); taiko(t + 0.7, 0.5); break;
        case 'roar':     // 大将のうなり声
          var r = A.c.createOscillator(), lp2 = A.c.createBiquadFilter(), g2 = gainEnv(t, 0.08, 0.3, 1.3, 0.6);
          r.type = 'sawtooth'; r.frequency.setValueAtTime(70, t); r.frequency.linearRampToValueAtTime(55, t + 1.3);
          var lf = A.c.createOscillator(), lfg = A.c.createGain(); lf.frequency.value = 28; lfg.gain.value = 18; lf.connect(lfg); lfg.connect(r.frequency);
          lp2.type = 'lowpass'; lp2.frequency.value = 600; r.connect(lp2); lp2.connect(g2); r.start(t); r.stop(t + 1.5); lf.start(t); lf.stop(t + 1.5);
          noise(t, 1.2, 0.25, 'bandpass', 400, 2, 0.5, 200); taiko(t, 0.6); break;
        case 'slam': taiko(t, 0.75); noise(t, 0.45, 0.4, 'lowpass', 300, 1, 0.5); break;
        case 'gallop': for (var j = 0; j < 8; j++) osc('sine', 120, t + j * 0.11 + (j % 2) * 0.03, 0.06, 0.18, 70, 0.2); break;
        case 'arrows': noise(t, 0.5, 0.12, 'bandpass', 3000, 2, 0.3, 1200); break;
        case 'gong': osc('sine', 196, t, 2.2, 0.2, 190, 0.7); osc('sine', 293, t, 1.6, 0.1, 0, 0.6); osc('sine', 523, t, 1.0, 0.05, 0, 0.6); break;
        case 'dead': [7, 6, 5, 3, 2].forEach(function (d, i) { shaku(deg(d), t + i * 0.3, 0.45, 0.09, true); }); break;
        case 'clear': taiko(t, 0.6); [5, 7, 8, 10, 12, 15].forEach(function (d, i) { koto(deg(d), t + 0.15 + i * 0.1, 0.13); }); kane(t + 0.8, 0.06); kakegoe(t + 0.9, 0.2); break;
        case 'bossdown': taiko(t, 0.8); taiko(t + 0.25, 0.8); taiko(t + 0.5, 0.9); kane(t + 0.5, 0.08); [10, 12, 13, 15].forEach(function (d, i) { koto(deg(d), t + 0.6 + i * 0.1, 0.13); }); break;
      }
    } catch (e) {}
  }
  window.SND = {
    start: start,
    music: function (m) { if (A.mode !== m) { A.mode = m; A.step = 0; if (A.c) A.next = A.c.currentTime + 0.05; } },
    heart: function (on) { A.heart = !!on; },
    sfx: sfx,
    quiet: function (on) { A.quiet = !!on; },     // 早送りの確認中などに 音を止める
    setMute: function (m) { A.muted = !!m; if (A.out) A.out.gain.value = A.muted ? 0 : 0.7; }
  };
})();
