/* =========================================================
   侍無双 キャラクター絵（Canvas2D だけで描く・画像ファイルなし）
   window.ART.build() を呼ぶと、全部の絵をキャンバスに描いて用意する。
   - unit  : 味方（後ろ姿）96x96 ・ 足もと ≈ (48,92)
   - enemy : 敵（正面）128x128 ・ 足もと ≈ (64,124)
   - boss  : ボス（正面）384x384 ・ 足もと ≈ (192,376)
   - icon  : 武器のアイコン 96x96
   - fx    : 光・けむり・火花・墨
   ※ ctx.filter と ctx.roundRect は古い iPhone で使えないので使わない
   ========================================================= */
(function () {
  'use strict';
  var OL = '#120806';          // 輪郭の色（ほぼ黒の焦げ茶）
  var PI = Math.PI, TAU = PI * 2;

  /* ---------- 小さな道具 ---------- */
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  var seed = 1;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // 折れ線のパス
  function P(g, a, open) {
    g.beginPath(); g.moveTo(a[0], a[1]);
    for (var i = 2; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]);
    if (!open) g.closePath();
  }
  // なめらかな閉じた形（点の間を曲線でつなぐ）
  function S(g, a) {
    var n = a.length / 2, i;
    g.beginPath();
    var lx = a[(n - 1) * 2], ly = a[(n - 1) * 2 + 1];
    g.moveTo((lx + a[0]) / 2, (ly + a[1]) / 2);
    for (i = 0; i < n; i++) {
      var x = a[i * 2], y = a[i * 2 + 1], j = ((i + 1) % n) * 2;
      g.quadraticCurveTo(x, y, (x + a[j]) / 2, (y + a[j + 1]) / 2);
    }
    g.closePath();
  }
  // なめらかな線（開いた形）
  function SL(g, a) {
    g.beginPath(); g.moveTo(a[0], a[1]);
    var n = a.length / 2, i;
    if (n === 2) { g.lineTo(a[2], a[3]); return; }
    for (i = 1; i < n - 2; i++) {
      g.quadraticCurveTo(a[i * 2], a[i * 2 + 1], (a[i * 2] + a[i * 2 + 2]) / 2, (a[i * 2 + 1] + a[i * 2 + 3]) / 2);
    }
    g.quadraticCurveTo(a[i * 2], a[i * 2 + 1], a[i * 2 + 2], a[i * 2 + 3]);
  }
  function E(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(rx, 0.1), Math.max(ry, 0.1), rot || 0, 0, TAU); }
  function C(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(r, 0.1), 0, TAU); }
  // 角の丸い四角（roundRect の代わり）
  function RR(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function LG(g, x0, y0, x1, y1, st) {
    var gr = g.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < st.length; i += 2) gr.addColorStop(st[i], st[i + 1]);
    return gr;
  }
  function RG(g, x, y, r, st, fx, fy) {
    var gr = g.createRadialGradient(fx == null ? x : fx, fy == null ? y : fy, 0, x, y, r);
    for (var i = 0; i < st.length; i += 2) gr.addColorStop(st[i], st[i + 1]);
    return gr;
  }
  // 塗って、細い輪郭線をひく
  function F(g, fill, lw, col) {
    g.fillStyle = fill; g.fill();
    if (lw) { g.lineWidth = lw; g.strokeStyle = col || OL; g.lineJoin = 'round'; g.stroke(); }
  }
  function ST(g, lw, col) { g.lineWidth = lw; g.strokeStyle = col || OL; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function LN(g, a, lw, col) { P(g, a, true); ST(g, lw, col); }
  function SLN(g, a, lw, col) { SL(g, a); ST(g, lw, col); }
  // 太い手足：輪郭色で太く→中身の色
  function limb(g, a, w, col, o) { o = o == null ? 1.6 : o; SL(g, a); ST(g, w + o * 2, OL); SL(g, a); ST(g, w, col); }
  // 形の中だけに模様を描く
  function inside(g, pathFn, fn) { g.save(); pathFn(); g.clip(); fn(); g.restore(); }
  // ぼわっと光る丸（加算）
  function glow(g, x, y, r, c, a) {
    a = a == null ? 1 : a;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = RG(g, x, y, r, [0, 'rgba(' + c + ',' + a + ')', 0.3, 'rgba(' + c + ',' + (a * 0.45) + ')', 1, 'rgba(' + c + ',0)']);
    C(g, x, y, r); g.fill(); g.restore();
  }
  // 光る目（つり目）
  function eye(g, x, y, r, c, ang, gl) {
    glow(g, x, y, r * (gl || 4.2), c, 0.85);
    g.save(); g.translate(x, y); g.rotate(ang || 0);
    g.beginPath(); g.moveTo(-r * 1.6, r * 0.25); g.quadraticCurveTo(0, -r * 1.1, r * 1.6, -r * 0.35); g.quadraticCurveTo(0, r * 0.9, -r * 1.6, r * 0.25); g.closePath();
    g.fillStyle = 'rgb(' + c + ')'; g.fill();
    E(g, 0, 0, r * 0.85, r * 0.42); g.fillStyle = '#fffbe6'; g.fill();
    g.restore();
  }
  // とげとげ（髪・たてがみ）
  function spikes(g, cx, cy, r0, r1, n, a0, a1, jit) {
    g.beginPath();
    for (var i = 0; i <= n * 2; i++) {
      var t = a0 + (a1 - a0) * i / (n * 2);
      var r = (i % 2 ? r1 * (1 - jit * rnd()) : r0);
      var x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.lineTo(cx, cy); g.closePath();
  }
  // うろこ模様（クリップ中に呼ぶ）
  function scaleTex(g, x0, y0, x1, y1, sz, col, lw) {
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
    for (var y = y0, row = 0; y < y1 + sz; y += sz * 0.55, row++) {
      for (var x = x0 + (row % 2 ? sz / 2 : 0); x < x1 + sz; x += sz) {
        g.beginPath(); g.arc(x, y, sz / 2, 0.1 * PI, 0.9 * PI); g.stroke();
      }
    }
  }
  // 虎の皮のしま（クリップ中に呼ぶ）
  function tigerStripes(g, x0, y0, x1, y1, k) {
    g.fillStyle = '#1a0e06';
    var h = y1 - y0, x = x0 + rnd() * 4 * k, i = 0;
    while (x < x1) {
      var w = (2.2 + rnd() * 1.8) * k, len = h * (0.45 + rnd() * 0.4), top = (i % 2 === 0);
      var ya = top ? y0 : y1, yb = top ? y0 + len : y1 - len, lean = (rnd() - 0.5) * 6 * k;
      g.beginPath(); g.moveTo(x - w / 2, ya); g.quadraticCurveTo(x - w * 0.3 + lean * 0.5, (ya + yb) / 2, x + lean, yb);
      g.quadraticCurveTo(x + w * 0.3 + lean * 0.5, (ya + yb) / 2, x + w / 2, ya); g.closePath(); g.fill();
      x += (4.5 + rnd() * 4) * k; i++;
    }
  }
  // 左右対称に描く（cx を軸に反転してもう一度）
  function sym(g, cx, fn) { fn(1); g.save(); g.translate(cx * 2, 0); g.scale(-1, 1); fn(-1); g.restore(); }

  /* ---------- 絵を仕上げる流れ ----------
     本体を描く → 立体の陰 → リムライト → 地面の影 → 太い輪郭 → 本体 → 光るもの */
  function sprite(w, h, o, f) {
    seed = o.seed || 7;
    var sc = o.sc || 1;
    var c = mk(w, h), g = c.getContext('2d');
    var b = mk(w, h), bg = b.getContext('2d');
    bg.lineJoin = 'round'; bg.lineCap = 'round';
    bg.translate(o.tx || 0, o.ty || 0); bg.scale(sc, sc);
    o.body(bg, f);
    bg.setTransform(1, 0, 0, 1, 0, 0);
    // 立体感：左上を少し明るく、右下を暗く
    if (o.shade !== false) {
      bg.save(); bg.globalCompositeOperation = 'source-atop';
      bg.fillStyle = LG(bg, w * 0.15, h * 0.05, w * 0.85, h * 0.95, [0, 'rgba(255,236,210,0.10)', 0.5, 'rgba(0,0,0,0)', 1, 'rgba(8,0,20,0.36)']);
      bg.fillRect(0, 0, w, h); bg.restore();
    }
    // 輪郭用のシルエット
    var s = mk(w, h), sg = s.getContext('2d');
    sg.drawImage(b, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = OL; sg.fillRect(0, 0, w, h);
    // リムライト（左上のふちを光らせる）
    if (o.rim) {
      var ro = o.ro || Math.max(2, w / 46);
      var r = mk(w, h), rx = r.getContext('2d');
      rx.drawImage(b, 0, 0); rx.globalCompositeOperation = 'source-in'; rx.fillStyle = o.rim; rx.fillRect(0, 0, w, h);
      rx.globalCompositeOperation = 'destination-out'; rx.drawImage(b, ro, ro * 0.9);
      bg.save(); bg.globalCompositeOperation = 'source-atop'; bg.drawImage(r, 0, 0); bg.restore();
    }
    g.save(); g.translate(o.tx || 0, o.ty || 0); g.scale(sc, sc); g.lineJoin = 'round'; g.lineCap = 'round';
    if (o.sh) {   // 地面の影 [x, y, 横半径, 縦半径]
      var a = o.sh;
      g.save(); g.translate(a[0], a[1]); g.scale(1, a[3] / a[2]);
      g.fillStyle = RG(g, 0, 0, a[2], [0, 'rgba(0,0,0,0.6)', 0.55, 'rgba(0,0,0,0.32)', 1, 'rgba(0,0,0,0)']);
      C(g, 0, 0, a[2]); g.fill(); g.restore();
    }
    if (o.pre) o.pre(g, f);
    g.restore();
    var t = o.ol || 3, n = t > 4 ? 16 : 10, i;
    for (i = 0; i < n; i++) { var an = i / n * TAU; g.drawImage(s, Math.cos(an) * t, Math.sin(an) * t); }
    g.drawImage(b, 0, 0);
    if (o.post) { g.save(); g.translate(o.tx || 0, o.ty || 0); g.scale(sc, sc); g.lineJoin = 'round'; g.lineCap = 'round'; o.post(g, f); g.restore(); }
    return c;
  }
  function pair(w, h, o) { return [sprite(w, h, o, 0), sprite(w, h, o, 1)]; }

  /* ---------- 色 ---------- */
  var GOLD = '#e8b84a', GOLDL = '#ffe08a', RED = '#c8202e';
  function blueArmor(g, y0, y1) { return LG(g, 0, y0, 0, y1, [0, '#5585ff', 0.3, '#3a63d8', 1, '#1a2f73']); }
  function blackArmor(g, y0, y1) { return LG(g, 0, y0, 0, y1, [0, '#5a5060', 0.35, '#2c2530', 1, '#0f0b10']); }
  function steel(g, x0, y0, x1, y1) { return LG(g, x0, y0, x1, y1, [0, '#ffffff', 0.35, '#c9d2dc', 0.6, '#7d8894', 1, '#3c444e']); }
  function iron(g, x0, y0, x1, y1) { return LG(g, x0, y0, x1, y1, [0, '#6a6470', 0.4, '#3a3540', 1, '#141016']); }

  /* ---------- 共通の部品 ---------- */
  // 刀（柄→刃先）
  function katana(g, x0, y0, x1, y1, w, k, bladeCol, edgeCol) {
    var dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    var hl = len * 0.24; // 柄の長さ
    var tx = x0 + ux * hl, ty = y0 + uy * hl;
    // 刃（少し反り）
    var mx = (tx + x1) / 2 + nx * len * 0.04, my = (ty + y1) / 2 + ny * len * 0.04;
    g.beginPath();
    g.moveTo(tx + nx * w / 2, ty + ny * w / 2);
    g.quadraticCurveTo(mx + nx * w / 2, my + ny * w / 2, x1, y1);
    g.quadraticCurveTo(mx - nx * w / 2, my - ny * w / 2, tx - nx * w / 2, ty - ny * w / 2);
    g.closePath();
    F(g, bladeCol || steel(g, tx + nx * w, ty + ny * w, tx - nx * w, ty - ny * w), 1.2 * k);
    // 刃先の光
    g.beginPath(); g.moveTo(tx + nx * w * 0.3, ty + ny * w * 0.3); g.quadraticCurveTo(mx + nx * w * 0.3, my + ny * w * 0.3, x1, y1);
    ST(g, 0.9 * k, edgeCol || 'rgba(255,255,255,0.9)');
    // つば
    E(g, tx, ty, w * 1.05, w * 0.5, Math.atan2(uy, ux) + PI / 2); F(g, GOLD, 1.1 * k);
    // 柄
    limb(g, [x0, y0, tx - ux * w * 0.4, ty - uy * w * 0.4], w * 0.85, '#2a1a24', 1 * k);
    var hx = (x0 + tx) / 2, hy = (y0 + ty) / 2;
    E(g, hx, hy, w * 0.3, w * 0.3); g.fillStyle = '#d8c8a0'; g.fill();
  }
  // 金棒（鬼の鉄の棍棒）
  function kanabo(g, x0, y0, x1, y1, w0, w1, k) {
    var dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    // 柄
    limb(g, [x0 - ux * len * 0.08, y0 - uy * len * 0.08, x0 + ux * len * 0.3, y0 + uy * len * 0.3], w0 * 0.6, '#4a2c1a', 1.3 * k);
    var bx = x0 + ux * len * 0.2, by = y0 + uy * len * 0.2;
    g.beginPath();
    g.moveTo(bx + nx * w0 / 2, by + ny * w0 / 2);
    g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
    g.quadraticCurveTo(x1 + ux * w1 * 0.55, y1 + uy * w1 * 0.55, x1 - nx * w1 / 2, y1 - ny * w1 / 2);
    g.lineTo(bx - nx * w0 / 2, by - ny * w0 / 2); g.closePath();
    F(g, LG(g, x1 + nx * w1 * 0.6, y1 + ny * w1 * 0.6, x1 - nx * w1 * 0.6, y1 - ny * w1 * 0.6, [0, '#8a8490', 0.3, '#4a4450', 0.75, '#1e1a22', 1, '#0a080c']), 1.4 * k);
    // 鉄の帯
    var t, j;
    for (t = 0.22; t < 1; t += 0.26) {
      var cx = bx + (x1 - bx) * t, cy = by + (y1 - by) * t, ww = (w0 + (w1 - w0) * t) / 2;
      LN(g, [cx + nx * ww, cy + ny * ww, cx - nx * ww, cy - ny * ww], 1.2 * k, '#0a080c');
    }
    // いぼ（とげ）
    for (t = 0.12, j = 0; t < 0.97; t += 0.15, j++) {
      var px = bx + (x1 - bx) * t, py = by + (y1 - by) * t, wd = (w0 + (w1 - w0) * t) / 2;
      var offs = j % 2 ? [-0.55, 0.05, 0.6] : [-0.25, 0.35];
      for (var q = 0; q < offs.length; q++) {
        var sx = px + nx * wd * offs[q], sy = py + ny * wd * offs[q], sr = (0.9 + wd * 0.09) * k * 0.9;
        C(g, sx, sy, sr); F(g, RG(g, sx, sy, sr, [0, '#f4f0e8', 0.4, '#a8a2a8', 1, '#3a343c'], sx - sr * 0.4, sy - sr * 0.4), 0.7 * k);
      }
    }
  }
  // 虎の皮の腰巻き
  function tigerCloth(g, pts, x0, y0, x1, y1, k) {
    S(g, pts); F(g, LG(g, 0, y0, 0, y1, [0, '#ffc23a', 0.6, '#e08a14', 1, '#9a4a08']), 1.4 * k);
    inside(g, function () { S(g, pts); }, function () { tigerStripes(g, x0, y0, x1, y1, k); });
    S(g, pts); ST(g, 1.4 * k);
  }
  // 角
  function horn(g, bx, by, tx, ty, bw, k, curl) {
    var mx = (bx + tx) / 2 + curl, my = (by + ty) / 2;
    g.beginPath();
    g.moveTo(bx - bw / 2, by);
    g.quadraticCurveTo(mx - bw * 0.3, my, tx, ty);
    g.quadraticCurveTo(mx + bw * 0.45, my + bw * 0.2, bx + bw / 2, by + 1);
    g.closePath();
    F(g, LG(g, bx, by, tx, ty, [0, '#a8946a', 0.35, '#f2e6c8', 1, '#fffaf0']), 1.3 * k);
    // 角のふし
    for (var t = 0.18; t < 0.6; t += 0.17) {
      var px = bx + (mx - bx) * t * 1.6, py = by + (my - by) * t * 1.6;
      g.beginPath(); g.moveTo(px - bw * 0.45 * (1 - t), py + 0.5); g.quadraticCurveTo(px, py + bw * 0.15, px + bw * 0.45 * (1 - t), py - 0.5);
      ST(g, 0.8 * k, 'rgba(90,60,30,0.7)');
    }
  }

  /* =========================================================
     味方（後ろ姿）96x96
     ========================================================= */
  function legBack(g, x, fy, armorFill) {
    P(g, [x - 7.5, 68, x + 7.5, 68, x + 5.5, fy - 7, x - 5.5, fy - 7]); F(g, LG(g, 0, 68, 0, fy, [0, '#2a3460', 1, '#10162e']), 1.6);
    RR(g, x - 4.8, fy - 17, 9.6, 11, 2.5); F(g, armorFill, 1.4);
    LN(g, [x - 3.5, fy - 12, x + 3.5, fy - 12], 1.2, GOLD);
    E(g, x, fy - 3, 5.5, 3.4); F(g, '#2a1c14', 1.4);
  }
  function drawSam(g, f) {
    var arm = blueArmor(g, 40, 80);
    var lf = f ? 86 : 91, rf = f ? 91 : 86;
    legBack(g, 41, lf, arm); legBack(g, 55, rf, arm);
    // 左腕（ふり）
    limb(g, [33, 50, 28, 58, f ? 27 : 29, f ? 64 : 67], 7, '#1e2a58', 1.5);
    C(g, f ? 27 : 29, f ? 65 : 68, 3.4); F(g, '#2a1c14', 1.3);
    // 草摺（腰の板）
    P(g, [31, 62, 65, 62, 68, 76, 28, 76]); F(g, arm, 1.6);
    LN(g, [42, 63, 41, 76], 1.3); LN(g, [54, 63, 55, 76], 1.3);
    LN(g, [30, 68, 66, 68], 1.5, GOLD); LN(g, [29, 72.5, 67, 72.5], 1.5, GOLD);
    // 胴（背中）
    S(g, [30, 46, 48, 44, 66, 46, 65, 56, 63, 64, 33, 64, 31, 56]); F(g, arm, 1.6);
    LN(g, [33, 51, 63, 51], 1.6, GOLD); LN(g, [33, 56, 63, 56], 1.6, GOLD); LN(g, [34, 60.5, 62, 60.5], 1.6, GOLD);
    LN(g, [48, 46, 48, 63], 1.2, 'rgba(10,20,60,0.8)');
    // 右手の刀
    var hx = f ? 70 : 71, hy = f ? 61 : 63;
    limb(g, [63, 50, 69, 56, hx, hy], 7, '#1e2a58', 1.5);
    katana(g, hx - 2, hy + 4, f ? 90 : 89, f ? 33 : 36, 4.6, 1);
    C(g, hx, hy, 3.6); F(g, '#2a1c14', 1.3);
    // 袖（肩の大きな板）
    sym(g, 48, function () {
      P(g, [21, 45, 35, 43, 37, 58, 23, 61]); F(g, arm, 1.6);
      LN(g, [22, 50, 36, 48.5], 1.4, GOLD); LN(g, [22.5, 55, 36.5, 53.5], 1.4, GOLD);
    });
    // しころ（首の後ろの板）
    g.beginPath(); g.moveTo(37, 36); g.lineTo(59, 36); g.quadraticCurveTo(66, 43, 66, 50); g.quadraticCurveTo(48, 54, 30, 50); g.quadraticCurveTo(30, 43, 37, 36); g.closePath();
    F(g, LG(g, 0, 36, 0, 52, [0, '#3f6ae0', 1, '#162660']), 1.6);
    g.beginPath(); g.moveTo(33, 43); g.quadraticCurveTo(48, 47, 63, 43); ST(g, 1.5, GOLD);
    g.beginPath(); g.moveTo(31.5, 47.5); g.quadraticCurveTo(48, 51, 64.5, 47.5); ST(g, 1.5, GOLD);
    // 兜の鉢
    g.beginPath(); g.moveTo(37, 38); g.quadraticCurveTo(36, 24, 48, 23); g.quadraticCurveTo(60, 24, 59, 38); g.closePath();
    F(g, RG(g, 48, 32, 14, [0, '#4a72e8', 0.6, '#22388a', 1, '#101c48'], 43, 26), 1.6);
    LN(g, [42, 25, 40.5, 37], 1, 'rgba(160,190,255,0.5)'); LN(g, [48, 23.5, 48, 37], 1, 'rgba(160,190,255,0.5)'); LN(g, [54, 25, 55.5, 37], 1, 'rgba(160,190,255,0.5)');
    C(g, 48, 23, 2.2); F(g, GOLD, 1);
    // 吹返し
    sym(g, 48, function () { P(g, [36, 34, 32, 36, 33, 41, 37, 39]); F(g, '#22388a', 1.2); });
    // 旗指物（背中の旗）
    var wv = f ? 1.5 : -1.5;
    LN(g, [48, 58, 48, 2.5], 2.6, '#3a2414');
    g.beginPath(); g.moveTo(49.5, 4); g.lineTo(73, 4);
    g.quadraticCurveTo(75 + wv, 15, 73, 27); g.quadraticCurveTo(62, 29 - wv, 49.5, 27); g.closePath();
    F(g, LG(g, 49, 4, 74, 27, [0, '#4f86ff', 0.5, '#2a5bd8', 1, '#16348a']), 1.6);
    C(g, 61.5, 15.5, 6); F(g, '#f6f4ec', 1.2);
    C(g, 61.5, 15.5, 2.4); F(g, '#2a5bd8');
    LN(g, [47, 3.5, 74, 3.5], 2, '#3a2414');
    C(g, 48, 2.5, 1.8); F(g, GOLD, 0.8);
  }
  function drawNin(g, f) {
    var cloth = LG(g, 0, 36, 0, 92, [0, '#3a3e4c', 0.5, '#20222c', 1, '#0c0d12']);
    var lf = f ? 86 : 91, rf = f ? 91 : 86;
    [[42, lf], [54, rf]].forEach(function (L) {
      var x = L[0], fy = L[1];
      P(g, [x - 6, 68, x + 6, 68, x + 4, fy - 5, x - 4, fy - 5]); F(g, cloth, 1.5);
      LN(g, [x - 4, fy - 12, x + 4, fy - 12], 1.3, '#3a4c7a'); LN(g, [x - 4, fy - 9, x + 4, fy - 9], 1.3, '#3a4c7a');
      E(g, x, fy - 3, 4.8, 3); F(g, '#141418', 1.3);
    });
    // 腕
    limb(g, [36, 50, 31, 59, f ? 30 : 32, f ? 66 : 69], 6.5, '#262a36', 1.5);
    C(g, f ? 30 : 32, f ? 67 : 70, 3); F(g, '#1a1a20', 1.2);
    limb(g, [60, 50, 65, 59, f ? 66 : 64, f ? 69 : 66], 6.5, '#262a36', 1.5);
    C(g, f ? 66 : 64, f ? 70 : 67, 3); F(g, '#1a1a20', 1.2);
    // 胴
    S(g, [34, 46, 48, 43, 62, 46, 61, 58, 59, 70, 37, 70, 35, 58]); F(g, cloth, 1.6);
    LN(g, [48, 47, 48, 62], 1, 'rgba(120,140,190,0.35)');
    // 背中の刀
    katana(g, 31, 34, 66, 69, 4.2, 1, LG(g, 0, 40, 0, 70, [0, '#2a2a36', 1, '#0c0c12']), 'rgba(120,150,220,0.6)');
    // 帯と結び
    P(g, [35, 62, 61, 62, 60, 67, 36, 67]); F(g, LG(g, 0, 62, 0, 67, [0, '#3a64d0', 1, '#1a2f73']), 1.4);
    var t = f ? 2 : -2;
    P(g, [46, 64, 43 + t, 78, 47 + t, 77, 49, 66]); F(g, '#2a4cb0', 1.2);
    P(g, [50, 64, 53 + t * 0.5, 76, 56 + t * 0.5, 74, 52, 65]); F(g, '#22408f', 1.2);
    E(g, 48, 64.5, 3.2, 2.6); F(g, '#3a64d0', 1.2);
    // 首巻き（なびく布）
    var w = f ? 3 : -3;
    g.beginPath(); g.moveTo(44, 42); g.bezierCurveTo(60, 40, 66, 50 + w, 80, 46 + w);
    g.lineTo(84, 54 + w); g.bezierCurveTo(72, 58 + w, 62, 50, 52, 47); g.closePath();
    F(g, LG(g, 44, 0, 84, 0, [0, '#4a7cff', 1, '#1e3a9a']), 1.4);
    E(g, 48, 44, 9, 3.4); F(g, '#3a64d0', 1.3);
    // 頭（ずきん）
    C(g, 48, 34, 10); F(g, RG(g, 48, 34, 12, [0, '#3a3e4c', 0.7, '#1a1c24', 1, '#0c0d12'], 44, 28), 1.6);
    g.beginPath(); g.moveTo(39, 33); g.quadraticCurveTo(48, 30, 57, 33); ST(g, 1.2, 'rgba(120,140,190,0.4)');
    // ずきんの結び目
    P(g, [47, 26, 42 + (f ? -1 : 1), 19, 46, 21]); F(g, '#1a1c24', 1.2);
    P(g, [49, 26, 55 + (f ? 1 : -1), 20, 51, 22]); F(g, '#1a1c24', 1.2);
  }

  /* =========================================================
     敵（正面）128x128
     ========================================================= */
  function legFront(g, hx, fx, fy, top, col, lace) {
    P(g, [hx - 8.5, top, hx + 8.5, top, fx + 6.5, fy - 8, fx - 6.5, fy - 8]); F(g, col, 1.6);
    RR(g, fx - 5.5, fy - 21, 11, 13, 3); F(g, blackArmor(g, fy - 21, fy - 8), 1.5);
    LN(g, [fx - 4, fy - 16, fx + 4, fy - 16], 1.5, lace); LN(g, [fx - 4, fy - 12, fx + 4, fy - 12], 1.5, lace);
    E(g, fx, fy - 3, 7.5, 3.8); F(g, LG(g, 0, fy - 7, 0, fy, [0, '#7a6040', 1, '#3a2a18']), 1.5);
  }
  function jingasa(g, crest) {
    g.beginPath(); g.moveTo(64, 26); g.lineTo(99, 47); g.quadraticCurveTo(64, 59, 29, 47); g.closePath();
    F(g, LG(g, 34, 30, 96, 50, [0, '#5a525c', 0.4, '#2e2830', 1, '#0c090c']), 1.8);
    g.beginPath(); g.moveTo(30, 47); g.quadraticCurveTo(64, 59, 98, 47); ST(g, 2.2, '#7a1a20');
    g.beginPath(); g.moveTo(64, 27); g.lineTo(40, 42); ST(g, 1.2, 'rgba(255,240,230,0.35)');
    if (crest) { C(g, 64, 42, 4.8); F(g, RG(g, 64, 42, 5, [0, '#ff4a3a', 1, '#9a1018']), 1.2); }
  }
  function soldierBody(g, f) {
    var b = f ? 1 : 0;
    // 草摺
    P(g, [42, 84 + b, 86, 84 + b, 92, 101, 36, 101]); F(g, blackArmor(g, 84, 101), 1.6);
    LN(g, [53, 85 + b, 51, 101], 1.3); LN(g, [64, 85 + b, 64, 101], 1.3); LN(g, [75, 85 + b, 77, 101], 1.3);
    LN(g, [40, 90.5 + b, 88, 90.5 + b], 1.8, RED); LN(g, [38, 96 + b, 90, 96 + b], 1.8, RED);
    // 胴
    S(g, [45, 58 + b, 64, 56 + b, 83, 58 + b, 86, 72 + b, 84, 86 + b, 44, 86 + b, 42, 72 + b]); F(g, blackArmor(g, 56, 88), 1.7);
    P(g, [47, 58 + b, 81, 58 + b, 80, 64 + b, 48, 64 + b]); F(g, '#1a141c', 1.2);
    for (var y = 69; y < 86; y += 5.5) LN(g, [45, y + b, 83, y + b], 1.9, RED);
    LN(g, [56, 65 + b, 56, 85 + b], 1, 'rgba(0,0,0,0.6)'); LN(g, [72, 65 + b, 72, 85 + b], 1, 'rgba(0,0,0,0.6)');
  }
  function soldierHead(g, f) {
    var b = f ? 1 : 0;
    g.save(); g.translate(0, b);
    // 顔（かさの影でまっ暗）
    E(g, 64, 55, 10, 8.5); F(g, '#1e1210', 1.5);
    P(g, [56, 57, 72, 57, 70, 63, 58, 63]); F(g, '#3a1416', 1.1); // 面頬
    jingasa(g, true);
    g.restore();
  }
  function soldierSode(g, f) {
    var b = f ? 1 : 0;
    sym(g, 64, function () {
      P(g, [33, 59 + b, 46, 57 + b, 48, 73 + b, 35, 76 + b]); F(g, blackArmor(g, 57, 76), 1.5);
      LN(g, [34, 64 + b, 47, 62.5 + b], 1.6, RED); LN(g, [34.5, 69.5 + b, 47.5, 68 + b], 1.6, RED);
    });
  }
  function soldierLegs(g, f) {
    var col = LG(g, 0, 96, 0, 124, [0, '#3a3440', 1, '#16121a']);
    legFront(g, 54, 52, f ? 117 : 123, 96, col, RED);
    legFront(g, 74, 76, f ? 123 : 117, 96, col, RED);
  }
  function hand(g, x, y, r) { C(g, x, y, r); F(g, RG(g, x, y, r, [0, '#5a4a40', 1, '#1e1612'], x - r * 0.3, y - r * 0.4), 1.4); }
  function drawAshigaru(g, f) {
    var b = f ? 1 : 0;
    soldierLegs(g, f);
    // 槍
    LN(g, [92, 8, 92, 123], 3.6, OL); LN(g, [92, 9, 92, 122], 2.2, '#6a4026');
    g.beginPath(); g.moveTo(92, 2); g.quadraticCurveTo(97, 12, 92, 24); g.quadraticCurveTo(87, 12, 92, 2); g.closePath();
    F(g, steel(g, 88, 6, 97, 18), 1.3);
    E(g, 92, 27, 3.5, 2.6); F(g, RED, 1.1);
    soldierBody(g, f);
    // 腕
    limb(g, [46, 62 + b, 44, 80 + b, 90, 88 + b], 8, '#231e26', 1.6);
    limb(g, [82, 62 + b, 88, 80 + b, 92, 70 + b], 8, '#231e26', 1.6);
    soldierSode(g, f);
    hand(g, 92, 88 + b, 4.6); hand(g, 92, 70 + b, 4.6);
    soldierHead(g, f);
  }
  function drawTeppo(g, f) {
    var b = f ? 1 : 0;
    soldierLegs(g, f);
    soldierBody(g, f);
    limb(g, [82, 62 + b, 90, 76 + b, 82, 74 + b], 8, '#231e26', 1.6);
    // 鉄砲（銃口がこちらを向く）
    limb(g, [88, 62 + b, 68, 79 + b], 7, LG(g, 60, 70, 90, 70, [0, '#3a3a44', 1, '#16161c']), 1.6);
    limb(g, [98, 58 + b, 86, 66 + b], 7.5, '#6a3a1c', 1.6);  // 台木
    LN(g, [80, 66 + b, 77, 70 + b], 2.4, GOLD); LN(g, [74, 71 + b, 71, 74 + b], 2.4, GOLD);
    limb(g, [46, 62 + b, 50, 80 + b, 66, 82 + b], 8, '#231e26', 1.6);
    soldierSode(g, f);
    hand(g, 67, 82 + b, 4.6); hand(g, 83, 72 + b, 4.6);
    // 銃口
    C(g, 64, 81 + b, 5.6); F(g, RG(g, 64, 81, 6, [0, '#b08a3a', 1, '#5a4018']), 1.5);
    C(g, 64, 81 + b, 3); F(g, '#050304');
    soldierHead(g, f);
  }
  function drawYumi(g, f) {
    var b = f ? 1 : 0;
    // 矢筒の矢羽（背中）
    for (var i = 0; i < 3; i++) {
      LN(g, [84 + i * 3, 60, 88 + i * 3, 38], 2, '#6a4026');
      P(g, [86 + i * 3, 44, 89 + i * 3, 34, 92 + i * 3, 44]); F(g, '#ece6d6', 1.1);
    }
    soldierLegs(g, f);
    soldierBody(g, f);
    // 右腕（矢を持つ）
    limb(g, [82, 62 + b, 88, 78 + b, 74, 78 + b], 8, '#231e26', 1.6);
    LN(g, [70, 86 + b, 92, 64 + b], 2, '#6a4026');
    P(g, [92, 64 + b, 96, 58 + b, 94, 66 + b]); F(g, '#ddd', 1);
    // 弓
    g.beginPath(); g.moveTo(34, 6); g.quadraticCurveTo(12, 56, 30, 122); ST(g, 6.2, OL);
    g.beginPath(); g.moveTo(34, 6); g.quadraticCurveTo(12, 56, 30, 122); ST(g, 3.6, LG(g, 0, 0, 0, 128, [0, '#5a2a1a', 0.5, '#2a1410', 1, '#5a2a1a']));
    LN(g, [34.5, 7, 30.5, 121], 1, 'rgba(240,230,210,0.85)');
    RR(g, 20, 82, 6, 10, 2); F(g, RED, 1.1);
    limb(g, [46, 62 + b, 36, 76 + b, 26, 86 + b], 8, '#231e26', 1.6);
    soldierSode(g, f);
    hand(g, 24, 86 + b, 4.6); hand(g, 74, 79 + b, 4.6);
    soldierHead(g, f);
  }
  function soldierEyes(g, f) {
    var b = f ? 1 : 0;
    eye(g, 59, 55 + b, 2.3, '255,60,30', 0.22);
    eye(g, 69, 55 + b, 2.3, '255,60,30', -0.22);
  }
  function drawNinjaE(g, f) {
    var s = f ? 1 : -1;
    var cloth = LG(g, 0, 40, 0, 124, [0, '#3a3644', 0.5, '#1c1a22', 1, '#0a090c']);
    // 赤いマフラーのはし（うしろ）
    g.beginPath(); g.moveTo(58, 58); g.bezierCurveTo(44, 50, 34, 60 + s * 4, 14, 48 + s * 4); g.lineTo(10, 56 + s * 4); g.bezierCurveTo(30, 70 + s * 4, 42, 60, 56, 66); g.closePath();
    F(g, LG(g, 10, 0, 56, 0, [0, '#5a0810', 1, '#d42430']), 1.4);
    g.beginPath(); g.moveTo(70, 58); g.bezierCurveTo(84, 48, 96, 58 - s * 4, 116, 42 - s * 4); g.lineTo(118, 51 - s * 4); g.bezierCurveTo(98, 66 - s * 4, 86, 60, 72, 66); g.closePath();
    F(g, LG(g, 72, 0, 118, 0, [0, '#d42430', 1, '#5a0810']), 1.4);
    // 脚（ひくくかまえる）
    var k1 = f ? 2 : 0;
    limb(g, [56, 92, 40, 104 + k1, 38, 121], 11, cloth, 1.6);
    limb(g, [72, 92, 88, 104 - k1, 90, 121], 11, cloth, 1.6);
    E(g, 37, 121, 7, 3.6); F(g, '#141218', 1.4); E(g, 91, 121, 7, 3.6); F(g, '#141218', 1.4);
    LN(g, [33, 112, 43, 112], 1.5, '#5a1a20'); LN(g, [85, 112, 95, 112], 1.5, '#5a1a20');
    // 胴（前かがみ）
    S(g, [46, 66, 64, 62, 82, 66, 80, 82, 76, 94, 52, 94, 48, 82]); F(g, cloth, 1.7);
    g.beginPath(); g.moveTo(56, 66); g.lineTo(64, 78); g.lineTo(72, 66); ST(g, 1.3, 'rgba(120,110,140,0.5)');
    // 赤い帯
    P(g, [49, 84, 79, 84, 78, 90, 50, 90]); F(g, LG(g, 0, 84, 0, 90, [0, '#e0303a', 1, '#8a0e16']), 1.4);
    P(g, [70, 87, 84, 100 + s * 2, 80, 102 + s * 2, 68, 90]); F(g, '#b01822', 1.2);
    // 左腕（うしろでクナイ）
    limb(g, [48, 70, 34, 80, 28, 92], 8, cloth, 1.6);
    g.beginPath(); g.moveTo(28, 92); g.lineTo(18, 108); g.lineTo(26, 98); g.closePath(); F(g, steel(g, 18, 92, 30, 108), 1.2);
    C(g, 28, 92, 4.2); F(g, '#1a181e', 1.3);
    // 右腕（前にクナイ）
    limb(g, [80, 70, 94, 76, 98, 68 + s], 8, cloth, 1.6);
    g.beginPath(); g.moveTo(99, 66 + s); g.lineTo(112, 44 + s); g.lineTo(104, 66 + s); g.closePath(); F(g, steel(g, 100, 50, 112, 66), 1.3);
    LN(g, [100, 67 + s, 98, 74 + s], 2.6, '#3a2a20');
    C(g, 98, 68 + s, 4.4); F(g, '#1a181e', 1.3);
    // 頭
    C(g, 64, 54, 12.5); F(g, RG(g, 64, 54, 14, [0, '#3a3644', 0.7, '#18161e', 1, '#08070a'], 60, 47), 1.7);
    RR(g, 52, 50, 24, 7.5, 3.5); F(g, '#3a2420', 1.1);  // 目のすきま
    P(g, [56, 45, 51, 37 - s, 59, 43]); F(g, '#18161e', 1.2);
  }
  /* --- 鬼（赤・青）--- */
  function oniBody(g, f, o) {
    var k = o.bulk, s = f ? 1 : 0;
    function X(x) { return 64 + (x - 64) * k; }
    var skin = LG(g, 0, 20, 0, 124, [0, o.c0, 0.45, o.c1, 1, o.c2]);
    // 髪（うしろ）
    g.fillStyle = '#120c10';
    spikes(g, 64, 30 + s, 16, 30, 9, PI * 0.82, PI * 2.18, 0.25); F(g, LG(g, 0, 0, 0, 50, [0, '#2a2230', 1, '#0a0608']), 1.5);
    // 脚
    limb(g, [X(52), 96, X(46), 110, X(46), 120], 15 * k, skin, 1.7);
    limb(g, [X(76), 96, X(82), 110, X(82), 120], 15 * k, skin, 1.7);
    sym(g, 64, function () {
      E(g, X(46), 121, 9 * k, 4); F(g, o.c2, 1.5);
      for (var i = -1; i <= 1; i++) { P(g, [X(46) + i * 5 - 1.5, 123, X(46) + i * 5, 127, X(46) + i * 5 + 1.5, 123]); F(g, '#f0e6d0', 0.8); }
    });
    // 金棒を持たない腕（たらす）
    var A = o.mirror ? -1 : 1;
    function AX(x) { return o.mirror ? 128 - X(x) : X(x); }
    limb(g, [AX(28), 58 + s, AX(19), 78 + s, AX(22), 94 + s], 13 * k, skin, 1.7);
    // 胴
    S(g, [X(20), 60 + s, X(34), 44 + s, 64, 42 + s, X(94), 44 + s, X(108), 60 + s, X(102), 76 + s, X(92), 84, X(88), 96, X(40), 96, X(36), 84, X(26), 76 + s]);
    F(g, skin, 1.8);
    // 胸と腹の筋肉
    g.beginPath(); g.moveTo(X(42), 56 + s); g.quadraticCurveTo(X(52), 70 + s, 63, 64 + s); ST(g, 1.6, 'rgba(40,0,10,0.55)');
    g.beginPath(); g.moveTo(X(86), 56 + s); g.quadraticCurveTo(X(76), 70 + s, 65, 64 + s); ST(g, 1.6, 'rgba(40,0,10,0.55)');
    LN(g, [64, 66 + s, 64, 88], 1.4, 'rgba(40,0,10,0.5)');
    LN(g, [57, 74 + s, 71, 74 + s], 1.2, 'rgba(40,0,10,0.45)'); LN(g, [58, 81, 70, 81], 1.2, 'rgba(40,0,10,0.45)');
    E(g, X(50), 52 + s, 6 * k, 3, -0.3); g.fillStyle = 'rgba(255,220,200,0.18)'; g.fill();
    // 肩
    E(g, AX(27), 57 + s, 10 * k, 9); F(g, skin, 1.6);
    // こぶし
    C(g, AX(22), 96 + s, 7.5 * k); F(g, skin, 1.6);
    for (var c = -1; c <= 1; c++) { P(g, [AX(22) + c * 4 - 1.5, 101 + s, AX(22) + c * 4 + A * 1, 107 + s, AX(22) + c * 4 + 1.5, 101 + s]); F(g, '#f0e6d0', 0.8); }
    // 虎の腰巻き
    tigerCloth(g, [X(36), 88, X(92), 88, X(96), 102, X(80), 108, 64, 101, X(48), 108, X(32), 102], X(30), 86, X(98), 110, 1);
    LN(g, [X(37), 89, X(91), 89], 3, '#3a1a0a');
    // 首
    RR(g, 55, 40 + s, 18, 8, 3); F(g, o.c1, 1.4);
  }
  function oniArmClub(g, f, o) {
    var k = o.bulk, s = f ? 1 : 0;
    function X(x) { return 64 + (x - 64) * k; }
    function AX(x) { return o.mirror ? 128 - X(x) : X(x); }
    var skin = LG(g, 0, 20, 0, 124, [0, o.c0, 0.45, o.c1, 1, o.c2]);
    var hx = AX(f ? 110 : 108), hy = f ? 62 : 72;
    kanabo(g, hx, hy + 6, AX(f ? 112 : 120), f ? 1 : 6, 6, 14, 1);
    limb(g, [AX(101), 58 + s, AX(112), 72, hx, hy], 13 * k, skin, 1.7);
    E(g, AX(101), 57 + s, 10 * k, 9); F(g, skin, 1.6);
    C(g, hx, hy, 7 * k); F(g, skin, 1.6);
  }
  function oniHead(g, f, o) {
    var s = f ? 1 : 0;
    var skin = LG(g, 0, 14, 0, 56, [0, o.c0, 0.6, o.c1, 1, o.c2]);
    g.save(); g.translate(0, s);
    // 角
    if (o.oneHorn) horn(g, 64, 22, 67, 0, 17, 1, 5);
    else { horn(g, 55, 22, 44, 1, 9, 1, -5); horn(g, 73, 22, 84, 1, 9, 1, 5); }
    // 耳
    sym(g, 64, function () { P(g, [48, 32, 40, 28, 47, 40]); F(g, o.c1, 1.3); });
    // 顔
    S(g, [50, 22, 64, 17, 78, 22, 82, 34, 79, 46, 64, 54, 49, 46, 46, 34]); F(g, skin, 1.7);
    // 前髪
    g.fillStyle = '#120c10';
    P(g, [48, 26, 52, 16, 56, 23, 60, 14, 64, 22, 69, 14, 72, 23, 77, 16, 80, 26, 74, 21, 64, 25, 54, 21]); F(g, '#140e14', 1.2);
    // 目のくぼみ
    E(g, 56.5, 33.5, 5, 3.4, 0.2); g.fillStyle = 'rgba(30,0,6,0.8)'; g.fill();
    E(g, 71.5, 33.5, 5, 3.4, -0.2); g.fillStyle = 'rgba(30,0,6,0.8)'; g.fill();
    // まゆ
    P(g, [49, 27, 62, 31.5, 61, 34, 49, 30.5]); F(g, '#140e14', 1);
    P(g, [79, 27, 66, 31.5, 67, 34, 79, 30.5]); F(g, '#140e14', 1);
    // 鼻
    E(g, 64, 40, 5, 3); g.fillStyle = 'rgba(40,0,10,0.35)'; g.fill();
    C(g, 61.5, 40.5, 1.2); g.fillStyle = OL; g.fill(); C(g, 66.5, 40.5, 1.2); g.fill();
    // 口（大きく開く）
    g.beginPath(); g.moveTo(53, 44); g.quadraticCurveTo(64, 41, 75, 44); g.quadraticCurveTo(72, 53 + s, 64, 53 + s); g.quadraticCurveTo(56, 53 + s, 53, 44); g.closePath();
    F(g, '#3a0408', 1.4);
    // 上の歯
    P(g, [55, 44.5, 73, 44.5, 72, 46.5, 56, 46.5]); g.fillStyle = '#f4ecd8'; g.fill();
    // 牙
    P(g, [56, 51 + s, 55, 41, 59, 50 + s]); F(g, '#fff8e8', 1);
    P(g, [72, 51 + s, 73, 41, 69, 50 + s]); F(g, '#fff8e8', 1);
    g.restore();
  }
  function oniEyes(g, f) { var s = f ? 1 : 0; eye(g, 56.5, 33.5 + s, 2.5, '255,214,40', 0.25); eye(g, 71.5, 33.5 + s, 2.5, '255,214,40', -0.25); }
  var ONI_R = { c0: '#ff6a4a', c1: '#d6262a', c2: '#6a0c12', bulk: 1, mirror: false };
  var ONI_B = { c0: '#7ab0ff', c1: '#2f5cc8', c2: '#0e1e5a', bulk: 1.12, mirror: true, oneHorn: true };

  function drawGaikotsu(g, f) {
    var s = f ? 1 : 0;
    var bone = LG(g, 0, 10, 0, 124, [0, '#f6eed8', 0.5, '#d8ccb0', 1, '#8a7c62']);
    var rust = LG(g, 0, 50, 0, 104, [0, '#b0602a', 0.5, '#7a3a18', 1, '#3a1a0a']);
    // 脚の骨
    [[54, 52, f ? 116 : 122], [74, 76, f ? 122 : 116]].forEach(function (L) {
      limb(g, [L[0], 94, L[1] - 2, 107, L[1], L[2]], 6, bone, 1.6);
      C(g, L[1] - 2, 107, 4); F(g, bone, 1.4);
      P(g, [L[1] - 6, L[2] + 2, L[1] + 6, L[2] + 2, L[1] + 4, L[2] - 2, L[1] - 4, L[2] - 2]); F(g, bone, 1.3);
    });
    // 腰のぼろぼろの板
    P(g, [42, 84, 86, 84, 90, 97, 84, 101, 80, 95, 74, 103, 67, 96, 59, 102, 52, 95, 46, 100, 39, 97]); F(g, rust, 1.6);
    LN(g, [41, 90, 87, 90], 1.6, '#5a1a10'); C(g, 70, 92, 2); g.fillStyle = '#1a0a04'; g.fill();
    // 背骨とろっ骨
    S(g, [47, 56, 64, 54, 81, 56, 83, 70, 76, 83, 52, 83, 45, 70]); F(g, '#1a1416', 1.6);
    LN(g, [64, 55, 64, 86], 4.5, OL); LN(g, [64, 55, 64, 86], 2.6, '#d8ccb0');
    for (var i = 0; i < 4; i++) {
      var y = 59 + i * 6;
      sym(g, 64, function () {
        g.beginPath(); g.moveTo(63, y); g.quadraticCurveTo(48 + i, y - 2, 48 + i * 1.5, y + 5);
        ST(g, 5, OL); g.beginPath(); g.moveTo(63, y); g.quadraticCurveTo(48 + i, y - 2, 48 + i * 1.5, y + 5); ST(g, 3, bone);
      });
    }
    // 鎖骨
    LN(g, [44, 56, 84, 56], 5, OL); LN(g, [44, 56, 84, 56], 3, bone);
    // 左腕（たらす）
    limb(g, [42, 58, 36, 76 + s, 40, 90 + s], 5.5, bone, 1.6);
    C(g, 36, 76 + s, 3.5); F(g, bone, 1.3);
    P(g, [36, 90 + s, 44, 90 + s, 46, 98 + s, 42, 95 + s, 40, 99 + s, 37, 95 + s]); F(g, bone, 1.2);
    // 錆びた刀（右手でふり上げる）
    katana(g, 98, 58 + s, 114, 4 + s * 2, 5, 1, LG(g, 100, 0, 112, 0, [0, '#c08a5a', 0.5, '#7a5034', 1, '#3a2418']), 'rgba(220,200,180,0.7)');
    P(g, [107, 30, 110, 29, 108, 33]); g.fillStyle = OL; g.fill();
    limb(g, [86, 58, 100, 70, 98, 58 + s], 5.5, bone, 1.6);
    C(g, 100, 70, 3.5); F(g, bone, 1.3);
    C(g, 98, 59 + s, 4); F(g, bone, 1.3);
    // 錆びた袖（左肩だけ）
    P(g, [32, 54, 48, 52, 49, 62, 44, 64, 46, 69, 34, 72]); F(g, rust, 1.5);
    LN(g, [33, 59, 48, 57.5], 1.5, '#5a1a10'); LN(g, [33.5, 65, 44, 64], 1.5, '#5a1a10');
    // ずがい骨
    S(g, [50, 34, 51, 21, 64, 14, 77, 21, 78, 34, 75, 43, 53, 43]); F(g, bone, 1.7);
    S(g, [52.5, 29, 61.5, 31, 61, 36.5, 55, 36.5]); F(g, '#0a0608', 1); S(g, [75.5, 29, 66.5, 31, 67, 36.5, 73, 36.5]); F(g, '#0a0608', 1);
    LN(g, [51, 27, 61, 30], 1.6, 'rgba(90,70,40,0.8)'); LN(g, [77, 27, 67, 30], 1.6, 'rgba(90,70,40,0.8)');
    P(g, [64, 37, 61.5, 41.5, 66.5, 41.5]); F(g, '#0a0608');
    // あご（歯）
    P(g, [54, 43, 74, 43, 73, 46, 55, 46]); F(g, '#e8dcc0', 1.2);
    for (var t = 57; t < 73; t += 3) LN(g, [t, 43, t, 46], 0.9, OL);
    g.save(); g.translate(0, s * 1.5);
    P(g, [55, 47, 73, 47, 71, 53, 57, 53]); F(g, bone, 1.3);
    for (t = 58; t < 72; t += 3) LN(g, [t, 47, t, 49.5], 0.9, OL);
    g.restore();
    LN(g, [70, 17, 72, 23, 69, 26], 1, 'rgba(60,40,20,0.8)');
    // こわれた兜
    P(g, [48, 27, 50, 17, 58, 11, 66, 10, 70, 14, 67, 16, 72, 19, 69, 22, 74, 24, 62, 23, 52, 25]); F(g, rust, 1.5);
    P(g, [56, 13, 50, 2, 53, 12]); F(g, '#8a6a3a', 1.2);
    C(g, 55, 20, 1.2); g.fillStyle = '#e0a060'; g.fill(); C(g, 61, 18, 1.2); g.fill();
  }
  function drawKiba(g, f) {
    var s = f ? 1 : 0;
    var horse = LG(g, 0, 40, 0, 124, [0, '#7a5844', 0.45, '#4a3022', 1, '#1a0e08']);
    var legc = LG(g, 0, 90, 0, 124, [0, '#5a3e2c', 1, '#1a0e08']);
    // 赤い旗（うしろ）
    LN(g, [30, 50, 26, 2], 2.4, '#3a2414');
    g.beginPath(); g.moveTo(26, 4); g.lineTo(10, 6 + s); g.quadraticCurveTo(8, 20, 11, 34 - s); g.lineTo(28, 32); g.closePath();
    F(g, LG(g, 8, 0, 28, 0, [0, '#8a0e16', 1, '#e0303a']), 1.4);
    C(g, 19, 19, 3.6); F(g, '#f0e8d8', 1);
    // 馬の脚（前脚を1本ふり上げて走る）
    var la = f ? [42, 96, 32, 106, 38, 114] : [42, 96, 40, 110, 40, 121];
    var ra = f ? [86, 96, 88, 110, 88, 121] : [86, 96, 96, 106, 90, 114];
    [la, ra].forEach(function (A) {
      limb(g, A, 8.5, legc, 1.6);
      C(g, A[2], A[3], 4.6); F(g, legc, 1.3);
      RR(g, A[4] - 5, A[5] - 1, 10, 6, 2); F(g, '#2a2420', 1.4);
      LN(g, [A[4] - 4, A[5] - 3, A[4] + 4, A[5] - 3], 2.4, '#d8ccb8');
    });
    // 胸（よろいの前かけ）
    S(g, [30, 78, 44, 66, 84, 66, 98, 78, 98, 98, 88, 106, 40, 106, 30, 98]); F(g, horse, 1.8);
    P(g, [34, 86, 94, 86, 92, 102, 36, 102]); F(g, blackArmor(g, 86, 102), 1.4);
    LN(g, [35, 91, 93, 91], 1.8, RED); LN(g, [36, 96.5, 92, 96.5], 1.8, RED);
    // 騎手
    LN(g, [14, 76, 116, 8], 4.2, OL); LN(g, [14, 76, 116, 8], 2.4, '#6a4026');
    g.beginPath(); g.moveTo(122, 3); g.lineTo(111, 9); g.lineTo(115, 14); g.closePath(); F(g, steel(g, 112, 4, 122, 14), 1.2);
    S(g, [42, 42, 64, 39, 86, 42, 88, 62, 40, 62]); F(g, blackArmor(g, 38, 62), 1.7);
    for (var y = 48; y < 62; y += 5) LN(g, [43, y, 85, y], 1.8, RED);
    sym(g, 64, function () { P(g, [33, 42, 45, 40, 47, 56, 35, 58]); F(g, blackArmor(g, 40, 58), 1.5); LN(g, [34, 47, 46, 45.5], 1.6, RED); });
    limb(g, [84, 44, 90, 42, 84, 37], 7, '#231e26', 1.5); hand(g, 84, 36, 4.4);
    limb(g, [44, 46, 38, 56, 44, 63], 7, '#231e26', 1.5); hand(g, 44, 63, 4.4);
    // 兜
    g.beginPath(); g.moveTo(58, 22); g.quadraticCurveTo(52, 12, 46, 2); g.lineTo(50, 2); g.quadraticCurveTo(56, 12, 61, 20); g.closePath(); F(g, GOLD, 1.2);
    g.beginPath(); g.moveTo(70, 22); g.quadraticCurveTo(76, 12, 82, 2); g.lineTo(78, 2); g.quadraticCurveTo(72, 12, 67, 20); g.closePath(); F(g, GOLD, 1.2);
    E(g, 64, 34, 10, 7.5); F(g, '#1e1210', 1.4);
    g.beginPath(); g.moveTo(50, 32); g.quadraticCurveTo(64, 38, 78, 32); g.lineTo(80, 40); g.quadraticCurveTo(64, 46, 48, 40); g.closePath(); F(g, blackArmor(g, 32, 44), 1.4);
    g.beginPath(); g.moveTo(53, 31); g.quadraticCurveTo(53, 18, 64, 18); g.quadraticCurveTo(75, 18, 75, 31); g.closePath(); F(g, RG(g, 64, 26, 12, [0, '#5a5060', 1, '#141016'], 60, 21), 1.5);
    P(g, [51, 30, 77, 30, 76, 33, 52, 33]); F(g, '#7a1a20', 1.2);
    C(g, 64, 24, 2.5); F(g, GOLD, 1);
    // 赤いたてがみ（首の両がわに広がる）
    seed = 61;
    spikes(g, 64, 66, 12, 26, 7, PI * 1.0, PI * 2.0, 0.3); F(g, LG(g, 0, 40, 0, 66, [0, '#ff3a3a', 1, '#6a0a12']), 1.3);
    // 首
    S(g, [46, 64, 64, 58, 82, 64, 82, 84, 46, 84]); F(g, horse, 1.6);
    // 耳
    sym(g, 64, function () { P(g, [54, 52, 50, 39, 59, 48]); F(g, horse, 1.3); });
    // 馬の顔（長い）
    var hd = [50, 52, 64, 46, 78, 52, 78, 68, 73, 90, 70, 102, 64, 106, 58, 102, 55, 90, 50, 68];
    S(g, hd); F(g, LG(g, 50, 0, 78, 0, [0, '#9a7258', 0.4, '#6a4a36', 1, '#2a1810']), 1.8);
    // 面（鉄の仮面・赤いふち）
    P(g, [54, 53, 74, 53, 72, 76, 64, 82, 56, 76]); F(g, LG(g, 54, 53, 74, 80, [0, '#b8bcc8', 0.4, '#6a6e7a', 1, '#24262e']), 1.5);
    P(g, [54, 53, 74, 53, 72, 76, 64, 82, 56, 76]); ST(g, 1.6, RED);
    LN(g, [64, 56, 64, 78], 1.6, 'rgba(255,255,255,0.45)');
    P(g, [64, 52, 60, 38, 64, 42, 68, 38]); F(g, GOLD, 1.1);
    // 鼻先
    E(g, 64, 99, 8.5, 6.5); F(g, LG(g, 0, 92, 0, 106, [0, '#6a5448', 1, '#2a1e18']), 1.5);
    E(g, 60.5, 100, 1.8, 2.6, 0.2); g.fillStyle = OL; g.fill(); E(g, 67.5, 100, 1.8, 2.6, -0.2); g.fill();
    // 手綱
    SLN(g, [44, 63, 50, 80, 57, 96], 1.4, '#a01a20'); SLN(g, [84, 40, 80, 70, 71, 96], 1.4, '#a01a20');
  }
  function kibaPost(g, f) {
    eye(g, 59, 34, 2, '255,60,30', 0.2); eye(g, 69, 34, 2, '255,60,30', -0.2);
    eye(g, 52.5, 62, 2, '255,70,30', 0.5, 3.4); eye(g, 75.5, 62, 2, '255,70,30', -0.5, 3.4);
    var s = f ? 1 : 0;
    // 鼻息
    g.save(); g.globalAlpha = 0.35 + s * 0.15;
    E(g, 54, 110 + s * 2, 6, 3.5); g.fillStyle = '#d8dce8'; g.fill();
    E(g, 74, 110 + s * 2, 6, 3.5); g.fill();
    g.restore();
  }
  function drawYurei(g, f) {
    var s = f ? 1 : 0;
    var white = LG(g, 0, 40, 0, 124, [0, '#ffffff', 0.4, '#dce8f0', 1, '#8aa0b8']);
    // うしろの長い髪
    S(g, [44, 30, 64, 12, 84, 30, 90, 66, 86, 96, 64, 92, 42, 96, 38, 66]); F(g, LG(g, 0, 10, 0, 96, [0, '#1e1a26', 1, '#06050a']), 1.6);
    // 着物（すそは広がって消える）
    S(g, [46, 52, 64, 48, 82, 52, 88, 82, 96, 124, 64, 128, 32, 124, 40, 82]); F(g, white, 1.6);
    g.beginPath(); g.moveTo(54, 50); g.lineTo(66, 76); g.lineTo(74, 50); ST(g, 1.5, 'rgba(60,80,110,0.7)');
    g.beginPath(); g.moveTo(66, 76); g.quadraticCurveTo(70, 100, 62, 124); ST(g, 1.2, 'rgba(60,80,110,0.5)');
    // 袖（腕を前に出して手をたらす）
    var dy = s * 2;
    sym(g, 64, function (m) {
      // 手首からたれた手（指が下を向く）
      S(g, [44, 54, 54, 64 + dy, 59, 70 + dy, 55, 98 + dy, 42, 94 + dy, 36, 70]); F(g, white, 1.5);
      S(g, [54, 68 + dy, 60, 67 + dy, 61, 76 + dy, 59, 86 + dy, 56, 78 + dy]); F(g, '#d6e4ec', 1.2);
      LN(g, [57.5, 76 + dy, 57.5, 82 + dy], 0.9, 'rgba(60,80,100,0.6)');
    });
    // 顔
    E(g, 64, 32, 10, 12.5); F(g, LG(g, 0, 20, 0, 44, [0, '#eef6f8', 1, '#a8bcc8']), 1.5);
    // 前髪（顔のほとんどをかくす）
    g.beginPath(); g.moveTo(53, 18); g.quadraticCurveTo(64, 12, 75, 18);
    g.quadraticCurveTo(80, 34, 78, 50); g.lineTo(73, 46); g.lineTo(70, 54); g.lineTo(67, 44);
    g.lineTo(63, 52); g.quadraticCurveTo(62, 36, 63, 30); g.quadraticCurveTo(58, 28, 56, 34);
    g.quadraticCurveTo(52, 40, 52, 52); g.lineTo(49, 44); g.quadraticCurveTo(50, 26, 53, 18); g.closePath();
    F(g, LG(g, 0, 12, 0, 54, [0, '#262230', 1, '#06050a']), 1.3);
    // 口もと（うっすら）
    LN(g, [57, 41, 61, 40.5], 1, 'rgba(80,20,30,0.7)');
    // 額の三角布
    P(g, [58, 17, 70, 17, 64, 25]); F(g, '#ffffff', 1.1);
  }
  function yureiPost(g, f) {
    // すそを消す
    g.save(); g.globalCompositeOperation = 'destination-out';
    g.fillStyle = LG(g, 0, 88, 0, 126, [0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,1)']);
    g.fillRect(0, 88, 128, 40); g.restore();
    // うすい影
    g.save(); g.translate(64, 122); g.scale(1, 0.25);
    g.fillStyle = RG(g, 0, 0, 22, [0, 'rgba(60,120,140,0.35)', 1, 'rgba(0,0,0,0)']); C(g, 0, 0, 22); g.fill(); g.restore();
    eye(g, 58.5, 33, 2.4, '150,255,235', 0.15, 5);
    C(g, 58.5, 33, 1); g.fillStyle = '#300'; g.fill();
  }
  function drawTengu(g, f) {
    var s = f ? 1 : -1;
    // 羽（黒い翼）
    sym(g, 64, function () {
      var tip = 18 + s * 5;
      for (var i = 0; i < 7; i++) {
        var t = i / 6;
        var tx = 4 + t * 8, ty = tip + t * 70;
        var bx = 48, by = 56 + t * 10;
        var mx = (tx + bx) / 2, my = (ty + by) / 2;
        g.beginPath(); g.moveTo(bx, by - 4); g.quadraticCurveTo(mx, my - 8, tx, ty); g.quadraticCurveTo(mx + 2, my + 4, bx, by + 4); g.closePath();
        F(g, LG(g, tx, ty, bx, by, [0, '#3a3650', 0.6, '#1a1824', 1, '#0a090e']), 1.3);
      }
      g.beginPath(); g.moveTo(48, 50); g.quadraticCurveTo(26, 30 + s * 2, 6, tip - 2); g.quadraticCurveTo(26, 42 + s * 2, 48, 60); g.closePath();
      F(g, '#14121c', 1.3);
    });
    // 脚と一本歯の下駄
    [[56, f ? 112 : 117], [72, f ? 117 : 112]].forEach(function (L) {
      P(g, [L[0] - 7, 88, L[0] + 7, 88, L[0] + 6, L[1] - 4, L[0] - 6, L[1] - 4]); F(g, LG(g, 0, 88, 0, 118, [0, '#e8e2d2', 1, '#9a9282']), 1.5);
      RR(g, L[0] - 6, L[1] - 4, 12, 3.5, 1); F(g, '#7a4a24', 1.2);
      RR(g, L[0] - 1.6, L[1] - 1, 3.2, 7, 1); F(g, '#5a3418', 1.1);
    });
    // 衣
    S(g, [46, 56, 64, 53, 82, 56, 88, 76, 90, 92, 38, 92, 40, 76]); F(g, LG(g, 0, 52, 0, 92, [0, '#fbf6ea', 1, '#b4ac98']), 1.6);
    g.beginPath(); g.moveTo(56, 54); g.lineTo(64, 70); g.lineTo(72, 54); ST(g, 1.4, 'rgba(80,70,50,0.7)');
    P(g, [41, 80, 87, 80, 88, 85, 40, 85]); F(g, '#2a2430', 1.2);
    // 梵天（ぽんぽん）
    [[56, 62], [72, 62], [55, 71], [73, 71]].forEach(function (p) {
      C(g, p[0], p[1], 3.4); F(g, RG(g, p[0], p[1], 3.6, [0, '#ffffff', 1, '#e0a020'], p[0] - 1, p[1] - 1), 1.1);
    });
    // 羽うちわ（左手）
    g.save(); g.translate(28, 70); g.rotate(-0.3 + s * 0.05);
    for (var i = -3; i <= 3; i++) {
      g.save(); g.rotate(i * 0.22);
      g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(-5, -10, 0, -22); g.quadraticCurveTo(5, -10, 0, 6); F(g, LG(g, 0, -22, 0, 6, [0, '#5a5048', 1, '#1a1612']), 1.1);
      g.restore();
    }
    RR(g, -2, 4, 4, 12, 1.5); F(g, '#c8a040', 1.1);
    g.restore();
    limb(g, [46, 60, 34, 74, 30, 82], 7.5, '#e8e2d2', 1.5);
    hand(g, 30, 82, 4.2);
    // 錫杖（右手）
    LN(g, [100, 16, 100, 122], 3.6, OL); LN(g, [100, 16, 100, 122], 2.2, '#7a4a24');
    E(g, 100, 12, 6.5, 8.5); ST(g, 4.4, OL); E(g, 100, 12, 6.5, 8.5); ST(g, 2.4, GOLD);
    C(g, 93.5, 15, 2.6); ST(g, 3.4, OL); C(g, 93.5, 15, 2.6); ST(g, 1.6, GOLD);
    C(g, 106.5, 15, 2.6); ST(g, 3.4, OL); C(g, 106.5, 15, 2.6); ST(g, 1.6, GOLD);
    limb(g, [82, 60, 94, 72, 100, 68], 7.5, '#e8e2d2', 1.5);
    hand(g, 100, 68, 4.2);
    // 白い髪
    spikes(g, 64, 34, 12, 22, 8, PI * 0.75, PI * 2.25, 0.25); F(g, LG(g, 0, 12, 0, 56, [0, '#ffffff', 1, '#a8a49c']), 1.4);
    // 赤い顔
    S(g, [54, 26, 64, 23, 74, 26, 78, 38, 74, 48, 64, 51, 54, 48, 50, 38]); F(g, LG(g, 0, 22, 0, 52, [0, '#ff5a3a', 0.6, '#d0201e', 1, '#7a0c10']), 1.6);
    // ひげ
    P(g, [56, 47, 72, 47, 70, 58, 64, 64, 58, 58]); F(g, LG(g, 0, 46, 0, 64, [0, '#ffffff', 1, '#b8b4ac']), 1.2);
    // 白いまゆ
    P(g, [51, 30, 62, 33, 61, 35.5, 49, 33]); F(g, '#ffffff', 1);
    P(g, [77, 30, 66, 33, 67, 35.5, 79, 33]); F(g, '#ffffff', 1);
    E(g, 57, 37, 4, 2.6, 0.2); g.fillStyle = 'rgba(40,0,0,0.8)'; g.fill();
    E(g, 71, 37, 4, 2.6, -0.2); g.fillStyle = 'rgba(40,0,0,0.8)'; g.fill();
    // 長い鼻（こちらへ突き出る）
    g.beginPath(); g.moveTo(60.5, 34); g.lineTo(67.5, 34); g.quadraticCurveTo(70, 46, 68.5, 56); g.quadraticCurveTo(64, 60, 60.5, 55); g.quadraticCurveTo(58.5, 46, 60.5, 34); g.closePath();
    F(g, LG(g, 58, 0, 70, 0, [0, '#ff7a5a', 0.5, '#e0281e', 1, '#7a0c10']), 1.4);
    E(g, 62.5, 44, 1.2, 6); g.fillStyle = 'rgba(255,220,200,0.5)'; g.fill();
    // 頭襟（黒い小さなぼうし）
    P(g, [59, 25, 64, 19, 69, 25, 67, 28, 61, 28]); F(g, '#1a1820', 1.2);
  }

  /* =========================================================
     ボス（正面）384x384 … 192 の大きさで考えて 2 倍で描く
     足もと ≈ (96,188)
     ========================================================= */
  function aura(g, cx, cy, r, c1, c2, n, f) {
    g.fillStyle = RG(g, cx, cy, r, [0, c1, 0.6, c2, 1, 'rgba(0,0,0,0)']);
    C(g, cx, cy, r); g.fill();
    seed = 99 + f;
    for (var i = 0; i < n; i++) {
      var a = rnd() * TAU, d = r * (0.45 + rnd() * 0.45), pr = r * (0.12 + rnd() * 0.16);
      var x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.9;
      g.fillStyle = RG(g, x, y, pr, [0, c2, 1, 'rgba(0,0,0,0)']); C(g, x, y, pr); g.fill();
    }
    seed = 7;
  }
  // --- 赤鬼の親分 ---
  function drawAkaoni(g, f) {
    var s = f ? 1.5 : 0;
    var skin = LG(g, 0, 10, 0, 190, [0, '#ff7a52', 0.4, '#d8242a', 1, '#5a0810']);
    // 髪（うしろの大きなたてがみ）
    seed = 21;
    spikes(g, 96, 58, 26, 62, 13, PI * 0.78, PI * 2.22, 0.3); F(g, LG(g, 0, 0, 0, 110, [0, '#2e2434', 1, '#08050a']), 2);
    // 金棒（左手でふり上げる）
    var cx = f ? 28 : 22, cy = f ? 34 : 44;
    kanabo(g, cx, cy + 8, f ? 44 : 14, f ? 0 : 1, 10, 26, 2);
    // 脚
    limb(g, [76, 140, 64, 162, 62, 180], 28, skin, 3);
    limb(g, [116, 140, 128, 162, 130, 180], 28, skin, 3);
    sym(g, 96, function () {
      E(g, 61, 182, 17, 7); F(g, '#5a0810', 2.6);
      for (var i = -1; i <= 1; i++) { P(g, [61 + i * 9 - 3, 184, 61 + i * 9, 191, 61 + i * 9 + 3, 184]); F(g, '#f4ead4', 1.4); }
    });
    // 左腕（ふり上げ）
    limb(g, [42, 78 + s, 16, 66, cx, cy], 24, skin, 3);
    // 右腕（つかみかかる手）
    limb(g, [150, 80 + s, 176, 108, 162, 132], 24, skin, 3);
    // 胴
    S(g, [22, 84 + s, 44, 62 + s, 96, 58 + s, 148, 62 + s, 170, 84 + s, 160, 112 + s, 142, 124, 138, 144, 54, 144, 50, 124, 32, 112 + s]); F(g, skin, 3.4);
    // 筋肉
    g.beginPath(); g.moveTo(58, 82 + s); g.quadraticCurveTo(72, 106 + s, 95, 98 + s); ST(g, 2.6, 'rgba(50,0,10,0.55)');
    g.beginPath(); g.moveTo(134, 82 + s); g.quadraticCurveTo(120, 106 + s, 97, 98 + s); ST(g, 2.6, 'rgba(50,0,10,0.55)');
    LN(g, [96, 100 + s, 96, 136], 2.2, 'rgba(50,0,10,0.5)');
    LN(g, [84, 112 + s, 108, 112 + s], 2, 'rgba(50,0,10,0.45)'); LN(g, [85, 124, 107, 124], 2, 'rgba(50,0,10,0.45)');
    E(g, 70, 78 + s, 12, 5, -0.3); g.fillStyle = 'rgba(255,220,200,0.16)'; g.fill();
    // 傷あと
    LN(g, [118, 86, 132, 104], 2, 'rgba(255,200,180,0.5)'); LN(g, [124, 84, 128, 90], 1.6, 'rgba(255,200,180,0.5)');
    // 肩
    E(g, 38, 80 + s, 20, 17); F(g, skin, 2.6); E(g, 154, 80 + s, 20, 17); F(g, skin, 2.6);
    // 金の腕輪
    RR(g, 8, 52, 18, 8, 3); F(g, LG(g, 0, 52, 0, 60, [0, GOLDL, 1, '#a07018']), 2);
    // つかむ手
    C(g, 162, 134, 13); F(g, skin, 2.6);
    for (var c = 0; c < 4; c++) {
      var a = 0.3 + c * 0.45, fx = 162 + Math.cos(a) * 13, fy = 134 + Math.sin(a) * 13;
      limb(g, [fx, fy, fx + Math.cos(a) * 8, fy + Math.sin(a) * 8 + 2], 6, skin, 2);
      P(g, [fx + Math.cos(a) * 10 - 2, fy + Math.sin(a) * 10, fx + Math.cos(a) * 16, fy + Math.sin(a) * 16 + 4, fx + Math.cos(a) * 10 + 2, fy + Math.sin(a) * 10 + 2]); F(g, '#fff4dc', 1.2);
    }
    // 虎の腰巻き
    tigerCloth(g, [48, 130, 144, 130, 152, 156, 124, 166, 96, 154, 68, 166, 40, 156], 40, 128, 154, 168, 2);
    LN(g, [50, 132, 142, 132], 6, '#3a1a0a'); LN(g, [50, 132, 142, 132], 2.4, '#7a4a20');
    // 金棒を持つ手
    C(g, cx, cy, 12); F(g, skin, 2.6);
    // 首
    RR(g, 78, 70 + s, 36, 14, 5); F(g, '#a8141c', 2);
    drawOniFaceBig(g, f, 96, 50, skin);
  }
  function drawOniFaceBig(g, f, x, y, skin) {
    var s = f ? 1.5 : 0;
    g.save(); g.translate(x - 96, y - 50);
    // 大きな角
    horn(g, 80, 26, 50, -4, 16, 2, -14);
    horn(g, 112, 26, 142, -4, 16, 2, 14);
    // 耳と金の耳輪
    sym(g, 96, function () {
      P(g, [70, 50, 54, 44, 68, 64]); F(g, '#c01c24', 2);
      C(g, 64, 70, 7); ST(g, 6, OL); C(g, 64, 70, 7); ST(g, 3.4, LG(g, 56, 62, 72, 78, [0, GOLDL, 1, '#a07018']));
    });
    // 顔
    S(g, [72, 30, 96, 22, 120, 30, 126, 50, 122, 70, 96, 84, 70, 70, 66, 50]); F(g, skin, 3);
    // 前髪
    P(g, [68, 38, 74, 22, 80, 32, 86, 18, 92, 30, 98, 16, 104, 30, 110, 18, 114, 32, 120, 22, 124, 38, 112, 30, 96, 34, 80, 30]); F(g, '#160e16', 2);
    // 目のくぼみ
    E(g, 84, 50, 8, 5.5, 0.25); g.fillStyle = 'rgba(30,0,6,0.85)'; g.fill();
    E(g, 108, 50, 8, 5.5, -0.25); g.fillStyle = 'rgba(30,0,6,0.85)'; g.fill();
    // まゆ
    P(g, [70, 40, 92, 47, 90, 51, 70, 45]); F(g, '#160e16', 1.6);
    P(g, [122, 40, 100, 47, 102, 51, 122, 45]); F(g, '#160e16', 1.6);
    // しわ
    LN(g, [90, 38, 93, 44], 1.6, 'rgba(50,0,10,0.6)'); LN(g, [102, 38, 99, 44], 1.6, 'rgba(50,0,10,0.6)');
    // 鼻
    S(g, [90, 54, 96, 52, 102, 54, 104, 62, 96, 64, 88, 62]); F(g, '#b81c22', 1.8);
    C(g, 92, 61, 1.8); g.fillStyle = OL; g.fill(); C(g, 100, 61, 1.8); g.fill();
    // 口（ほえる）
    g.beginPath(); g.moveTo(78, 66); g.quadraticCurveTo(96, 62, 114, 66); g.quadraticCurveTo(110, 82 + s * 2, 96, 82 + s * 2); g.quadraticCurveTo(82, 82 + s * 2, 78, 66); g.closePath();
    F(g, RG(g, 96, 76, 18, [0, '#7a0a12', 1, '#2a0206']), 2.2);
    for (var t = 82; t < 112; t += 5) { P(g, [t, 66.5, t + 5, 66.5, t + 2.5, 71]); F(g, '#f6eedc', 0.8); }
    P(g, [80, 80 + s * 2, 79, 62, 86, 78 + s * 2]); F(g, '#fff8e8', 1.6);
    P(g, [112, 80 + s * 2, 113, 62, 106, 78 + s * 2]); F(g, '#fff8e8', 1.6);
    g.restore();
  }
  function akaoniPre(g, f) { aura(g, 96, 100, 100, 'rgba(120,10,10,0.55)', 'rgba(60,10,20,0.45)', 14, f); }
  function akaoniPost(g, f) {
    var s = f ? 1.5 : 0;
    eye(g, 84, 50, 4.6, '255,214,40', 0.3, 4.5); eye(g, 108, 50, 4.6, '255,214,40', -0.3, 4.5);
    // 口の中の熱
    glow(g, 96, 76 + s, 16, '255,90,30', 0.35);
  }
  // --- がしゃどくろ ---
  function drawGasha(g, f) {
    var s = f ? 1 : 0;
    var bone = LG(g, 0, 0, 0, 190, [0, '#fbf4e0', 0.45, '#d8ccb0', 1, '#7a6c54']);
    // 背骨とろっ骨
    S(g, [50, 96, 96, 88, 142, 96, 148, 130, 132, 162, 60, 162, 44, 130]); F(g, RG(g, 96, 130, 60, [0, '#0e1a1a', 1, '#040808']), 2.6);
    LN(g, [96, 86, 96, 192], 11, OL); LN(g, [96, 86, 96, 192], 7, bone);
    for (var y = 98; y < 190; y += 9) LN(g, [92, y, 100, y], 2, 'rgba(60,50,30,0.8)');
    for (var i = 0; i < 6; i++) {
      var ry = 100 + i * 11, w = 46 - Math.abs(i - 2) * 3;
      sym(g, 96, function () {
        g.beginPath(); g.moveTo(94, ry); g.quadraticCurveTo(96 - w * 1.05, ry - 8, 96 - w, ry + 12);
        ST(g, 9, OL); g.beginPath(); g.moveTo(94, ry); g.quadraticCurveTo(96 - w * 1.05, ry - 8, 96 - w, ry + 12); ST(g, 5.4, bone);
      });
    }
    // 鎖骨・肩
    sym(g, 96, function () { limb(g, [94, 90, 70, 86, 48, 92], 8, bone, 2.2); C(g, 46, 93, 9); F(g, bone, 2.2); });
    // 腕（前へのばす）
    var la = f ? [46, 94, 18, 128, 40, 156] : [46, 94, 16, 134, 34, 164];
    var ra = f ? [146, 94, 176, 134, 158, 164] : [146, 94, 174, 128, 152, 156];
    [la, ra].forEach(function (A, k) {
      limb(g, [A[0], A[1], A[2], A[3]], 11, bone, 2.4);
      // 前腕は2本の骨
      limb(g, [A[2] - 3, A[3], A[4] - 4, A[5]], 6, bone, 2);
      limb(g, [A[2] + 3, A[3] + 2, A[4] + 3, A[5]], 6, bone, 2);
      C(g, A[2], A[3], 8); F(g, bone, 2.2);
      // 大きな骨の手（指を広げる）
      var hx = A[4], hy = A[5], d = k ? -1 : 1;
      S(g, [hx - 10, hy - 4, hx + 10, hy - 4, hx + 12, hy + 8, hx - 12, hy + 8]); F(g, bone, 2.2);
      for (var j = 0; j < 4; j++) {
        var an = PI * (0.15 + j * 0.23) + (k ? 0.1 : -0.1);
        var bx = hx + (j - 1.5) * 6, by = hy + 6;
        var mx = bx + Math.cos(an) * 12, my = by + Math.sin(an) * 12;
        limb(g, [bx, by, mx, my, mx + Math.cos(an + 0.5 * d) * 10, my + Math.sin(an + 0.5 * d) * 10], 4.2, bone, 1.8);
      }
      limb(g, [hx - 10 * d, hy, hx - 22 * d, hy - 6, hx - 26 * d, hy + 2], 4.6, bone, 1.8);
    });
    // ずがい骨
    g.save(); g.translate(0, s * 0.5);
    S(g, [56, 56, 58, 24, 96, 6, 134, 24, 136, 56, 128, 74, 64, 74]); F(g, bone, 3);
    // ひび
    SLN(g, [104, 10, 108, 22, 102, 30, 106, 38], 1.8, 'rgba(60,40,20,0.8)');
    SLN(g, [68, 30, 74, 36, 72, 44], 1.6, 'rgba(60,40,20,0.7)');
    // 目のあな
    S(g, [64, 46, 72, 38, 88, 42, 90, 56, 80, 64, 68, 60]); F(g, '#040808', 2);
    S(g, [128, 46, 120, 38, 104, 42, 102, 56, 112, 64, 124, 60]); F(g, '#040808', 2);
    // 鼻のあな
    P(g, [96, 60, 90, 72, 96, 69, 102, 72]); F(g, '#040808', 1.4);
    // 頬骨
    E(g, 70, 70, 9, 4, 0.2); g.fillStyle = 'rgba(80,60,40,0.35)'; g.fill(); E(g, 122, 70, 9, 4, -0.2); g.fill();
    // 上の歯
    P(g, [70, 74, 122, 74, 120, 84, 72, 84]); F(g, '#efe4c8', 2);
    for (var t = 74; t < 120; t += 6) LN(g, [t, 74, t, 84], 1.4, OL);
    g.restore();
    // あご（開く）
    g.save(); g.translate(0, s * 5);
    S(g, [68, 88, 124, 88, 120, 104, 96, 110, 72, 104]); F(g, bone, 2.6);
    P(g, [74, 88, 118, 88, 117, 95, 75, 95]); F(g, '#efe4c8', 1.6);
    for (t = 78; t < 116; t += 6) LN(g, [t, 88, t, 95], 1.4, OL);
    g.restore();
  }
  function gashaPre(g, f) {
    aura(g, 96, 90, 96, 'rgba(20,90,90,0.45)', 'rgba(10,50,60,0.4)', 12, f);
  }
  function gashaPost(g, f) {
    var s = f ? 0.5 : 0;
    eye(g, 78, 51 + s, 5, '80,255,220', 0.1, 5); eye(g, 114, 51 + s, 5, '80,255,220', -0.1, 5);
    // 口の奥の光
    glow(g, 96, 90 + s * 6, 14, '60,255,200', 0.25);
    // 下のもや
    g.save(); g.globalCompositeOperation = 'destination-out';
    g.fillStyle = LG(g, 0, 160, 0, 192, [0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0.9)']); g.fillRect(0, 160, 192, 32); g.restore();
    seed = 33 + f;
    for (var i = 0; i < 9; i++) {
      var x = 20 + rnd() * 152, y = 168 + rnd() * 18, r = 14 + rnd() * 16;
      g.fillStyle = RG(g, x, y, r, [0, 'rgba(120,200,190,0.35)', 1, 'rgba(60,120,120,0)']); C(g, x, y, r); g.fill();
    }
    // ひとだま
    for (i = 0; i < 4; i++) {
      var hx = [26, 168, 40, 156][i], hy = [40, 46, 110, 112][i] + (f ? -3 : 3) * (i % 2 ? 1 : -1);
      glow(g, hx, hy, 10, '80,255,220', 0.6); C(g, hx, hy, 2.2); g.fillStyle = '#eafffa'; g.fill();
    }
  }
  // --- 土蜘蛛 ---
  function spiderLeg(g, hip, knee, foot, w, dark) {
    var c1 = dark ? '#8a6a18' : '#e0b030', c2 = dark ? '#3a2a08' : '#7a5410';
    var col = LG(g, knee[0], knee[1] - 20, foot[0], foot[1], [0, c1, 1, c2]);
    limb(g, [hip[0], hip[1], knee[0], knee[1]], w, col, 2.4);
    limb(g, [knee[0], knee[1], foot[0], foot[1]], w * 0.72, col, 2.4);
    // しま
    var k;
    function band(a, b, t, ww) {
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy), nx = -dy / l, ny = dx / l;
      var x = a[0] + dx * t, y = a[1] + dy * t;
      LN(g, [x + nx * ww * 0.5, y + ny * ww * 0.5, x - nx * ww * 0.5, y - ny * ww * 0.5], ww * 0.42, dark ? '#100a04' : '#1a1006');
    }
    for (k = 0.3; k < 0.95; k += 0.3) band(hip, knee, k, w);
    for (k = 0.22; k < 0.85; k += 0.26) band(knee, foot, k, w * 0.72);
    C(g, knee[0], knee[1], w * 0.55); F(g, col, 2);
    // つめ
    var dx = foot[0] - knee[0], dy = foot[1] - knee[1], l = Math.sqrt(dx * dx + dy * dy);
    P(g, [foot[0] - dy / l * 3, foot[1] + dx / l * 3, foot[0] + dx / l * 9, foot[1] + dy / l * 9, foot[0] + dy / l * 3, foot[1] - dx / l * 3]); F(g, '#0e0a06', 1.4);
  }
  function drawTsuchi(g, f) {
    var s = f ? 2 : 0;
    // 奥の脚
    sym(g, 96, function () {
      spiderLeg(g, [80, 104], [44, 44 + s], [30, 96], 10, true);
      spiderLeg(g, [78, 110], [22, 62 - s], [10, 128], 12, true);
    });
    // 大きなおなか（うしろ）
    E(g, 96, 82, 52, 40); F(g, RG(g, 96, 70, 60, [0, '#5a3a4a', 0.6, '#2a1622', 1, '#0e060a'], 82, 60), 3);
    inside(g, function () { E(g, 96, 82, 52, 40); }, function () {
      for (var i = 0; i < 4; i++) {
        var y = 56 + i * 13;
        g.beginPath(); g.moveTo(52, y + 8); g.lineTo(96, y - 4); g.lineTo(140, y + 8); g.lineTo(140, y + 13); g.lineTo(96, y + 2); g.lineTo(52, y + 13); g.closePath();
        g.fillStyle = i % 2 ? '#d09a20' : '#e8c040'; g.fill();
      }
    });
    E(g, 82, 60, 16, 7, -0.4); g.fillStyle = 'rgba(255,220,240,0.15)'; g.fill();
    // 手前の脚
    sym(g, 96, function () {
      spiderLeg(g, [78, 118], [24, 92 + s], [8, 166], 14, false);
      spiderLeg(g, [84, 126], [44, 112 - s], [40, 186], 15, false);
    });
    // 白いたてがみ
    seed = 44;
    spikes(g, 96, 132, 30, 52, 12, PI * 0.9, PI * 2.1, 0.25); F(g, LG(g, 0, 80, 0, 150, [0, '#ffffff', 1, '#9a948a']), 2.4);
    // 角
    horn(g, 82, 108, 66, 78, 10, 2, -8); horn(g, 110, 108, 126, 78, 10, 2, 8);
    // 牙（あご）
    var o = f ? 3 : 0;
    sym(g, 96, function () {
      g.beginPath(); g.moveTo(80, 152); g.quadraticCurveTo(70 - o, 168, 82 + o * 0.5, 184); g.lineTo(84, 176); g.quadraticCurveTo(80, 166, 90, 156); g.closePath();
      F(g, LG(g, 70, 150, 90, 184, [0, '#5a1a1a', 0.6, '#2a0a0a', 1, '#0a0202']), 2);
    });
    // 鬼の顔
    S(g, [72, 112, 96, 104, 120, 112, 126, 134, 118, 156, 96, 164, 74, 156, 66, 134]); F(g, LG(g, 0, 104, 0, 164, [0, '#e85a3a', 0.6, '#a8201c', 1, '#4a0808']), 3);
    // くぼみ
    E(g, 84, 132, 8, 5, 0.25); g.fillStyle = 'rgba(30,0,6,0.85)'; g.fill(); E(g, 108, 132, 8, 5, -0.25); g.fill();
    // 小さな目のくぼみ（3つずつ）
    [[80, 120], [88, 116], [104, 116], [112, 120]].forEach(function (p) { C(g, p[0], p[1], 3); g.fillStyle = 'rgba(30,0,6,0.85)'; g.fill(); });
    P(g, [70, 124, 92, 129, 91, 133, 70, 128]); F(g, '#1a0a0a', 1.4);
    P(g, [122, 124, 100, 129, 101, 133, 122, 128]); F(g, '#1a0a0a', 1.4);
    // 口
    g.beginPath(); g.moveTo(80, 146); g.quadraticCurveTo(96, 142, 112, 146); g.quadraticCurveTo(106, 158 + o, 96, 158 + o); g.quadraticCurveTo(86, 158 + o, 80, 146); g.closePath();
    F(g, '#2a0206', 2);
    for (var t = 83; t < 110; t += 4.5) { P(g, [t, 146.5, t + 4.5, 146.5, t + 2.2, 151]); F(g, '#f6eedc', 0.7); }
    P(g, [83, 156 + o, 82, 143, 88, 154 + o]); F(g, '#fff8e8', 1.4); P(g, [109, 156 + o, 110, 143, 104, 154 + o]); F(g, '#fff8e8', 1.4);
  }
  function tsuchiPre(g, f) { aura(g, 96, 110, 96, 'rgba(90,20,80,0.4)', 'rgba(40,10,40,0.4)', 10, f); }
  function tsuchiPost(g, f) {
    eye(g, 84, 132, 4.4, '255,200,40', 0.3, 4.2); eye(g, 108, 132, 4.4, '255,200,40', -0.3, 4.2);
    [[80, 120], [88, 116], [104, 116], [112, 120]].forEach(function (p) { glow(g, p[0], p[1], 8, '255,60,40', 0.8); C(g, p[0], p[1], 1.8); g.fillStyle = '#ffe0c0'; g.fill(); });
  }
  // --- 八岐大蛇 ---
  var SNAKE = { c0: '#7aa04a', c1: '#2a5028', c2: '#0a1a0c', belly: '#d8c888' };
  function neck(g, pts, w) {
    SL(g, pts); ST(g, w + 6, OL);
    SL(g, pts); ST(g, w, LG(g, pts[0] - w, 0, pts[0] + w, 0, [0, SNAKE.c0, 0.5, SNAKE.c1, 1, SNAKE.c2]));
    // うろこ（点線で）
    g.save(); g.setLineDash([2.5, 4]); SL(g, pts); ST(g, w * 0.7, 'rgba(10,30,10,0.45)'); g.restore();
    // おなか
    SL(g, pts); ST(g, w * 0.32, SNAKE.belly);
    g.save(); g.setLineDash([1.4, 4]); SL(g, pts); ST(g, w * 0.32, 'rgba(90,70,30,0.8)'); g.restore();
  }
  function snakeHead(g, x, y, sc, ang, open) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(sc, sc);
    var hc = LG(g, 0, -18, 0, 12, [0, SNAKE.c0, 0.5, SNAKE.c1, 1, SNAKE.c2]);
    // うしろへ反る角
    P(g, [-11, -12, -24, -26, -16, -12]); F(g, LG(g, 0, -26, 0, -10, [0, '#fff4d0', 1, '#a08a50']), 1.4);
    P(g, [11, -12, 24, -26, 16, -12]); F(g, LG(g, 0, -26, 0, -10, [0, '#fff4d0', 1, '#a08a50']), 1.4);
    // 下あご（大きく開く）
    g.beginPath(); g.moveTo(-15, 2); g.lineTo(-10, 14 + open); g.quadraticCurveTo(0, 24 + open, 10, 14 + open); g.lineTo(15, 2); g.quadraticCurveTo(0, 8, -15, 2); g.closePath(); F(g, hc, 2);
    // 口の中
    g.beginPath(); g.moveTo(-13, 3); g.lineTo(-8.5, 13 + open); g.quadraticCurveTo(0, 20 + open, 8.5, 13 + open); g.lineTo(13, 3); g.quadraticCurveTo(0, 6, -13, 3); g.closePath();
    F(g, RG(g, 0, 10, 14, [0, '#5a0414', 1, '#c0182e']), 1.4);
    // 下の牙
    P(g, [-8, 13 + open, -7, 6 + open, -5.5, 13.5 + open]); F(g, '#fffaf0', 0.8); P(g, [8, 13 + open, 7, 6 + open, 5.5, 13.5 + open]); F(g, '#fffaf0', 0.8);
    // 舌
    g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 17 + open); g.lineTo(-3.5, 23 + open); g.moveTo(0, 17 + open); g.lineTo(3.5, 23 + open); ST(g, 1.8, '#ff3a5a');
    // 頭の上（くさび形）
    var top = [-17, 3, -15, -8, -7, -16, 0, -18, 7, -16, 15, -8, 17, 3, 9, 6, -9, 6];
    S(g, top); F(g, hc, 2);
    inside(g, function () { S(g, top); }, function () { scaleTex(g, -17, -18, 17, 4, 6, 'rgba(10,30,10,0.4)', 0.9); });
    // 上の牙
    P(g, [-10, 4, -8.5, 13 + open * 0.3, -6.5, 5]); F(g, '#fffaf0', 1); P(g, [10, 4, 8.5, 13 + open * 0.3, 6.5, 5]); F(g, '#fffaf0', 1);
    // 怒った眉
    P(g, [-16, -9, -3, -6, -4, -2.5, -15, -4]); F(g, SNAKE.c2, 1); P(g, [16, -9, 3, -6, 4, -2.5, 15, -4]); F(g, SNAKE.c2, 1);
    E(g, -8.5, -2.5, 3.6, 2.2, 0.35); g.fillStyle = '#100404'; g.fill(); E(g, 8.5, -2.5, 3.6, 2.2, -0.35); g.fill();
    C(g, -3, 3, 0.9); g.fillStyle = OL; g.fill(); C(g, 3, 3, 0.9); g.fill();
    g.restore();
  }
  var OROCHI_HEADS = [ // x, y, 大きさ, 傾き, 首の根元x
    [22, 92, 0.9, -0.25, 70], [170, 92, 0.9, 0.25, 122], [50, 52, 1.0, -0.12, 82], [142, 52, 1.0, 0.12, 110], [96, 30, 1.15, 0, 96]];
  function orochiHeadPos(i, f) {
    var h = OROCHI_HEADS[i], sw = (f ? 1 : -1) * (i % 2 ? 3 : -3);
    return [h[0] + sw, h[1] + (f ? -2 : 2) * (i % 2 ? -1 : 1)];
  }
  function drawOrochi(g, f) {
    // とぐろ（下のからだ）
    var coils = [[96, 176, 80, 16], [96, 160, 66, 15], [96, 146, 50, 13]];
    coils.forEach(function (c) {
      E(g, c[0], c[1], c[2], c[3]); F(g, LG(g, 0, c[1] - c[3], 0, c[1] + c[3], [0, SNAKE.c0, 0.5, SNAKE.c1, 1, SNAKE.c2]), 3);
      inside(g, function () { E(g, c[0], c[1], c[2], c[3]); }, function () { scaleTex(g, c[0] - c[2], c[1] - c[3], c[0] + c[2], c[1] + c[3], 7, 'rgba(10,30,10,0.5)', 1.2); });
      g.beginPath(); g.ellipse(c[0], c[1], c[2] - 3, c[3] - 4, 0, 0.1 * PI, 0.9 * PI); ST(g, 4, 'rgba(224,208,144,0.7)');
    });
    // 首（外側から）
    var order = [0, 1, 2, 3, 4];
    order.forEach(function (i) {
      var p = orochiHeadPos(i, f), bx = OROCHI_HEADS[i][4];
      var mx = (p[0] + bx) / 2 + (i === 4 ? (f ? 6 : -6) : (p[0] < 96 ? 10 : -10)), my = (p[1] + 146) / 2 + 10;
      neck(g, [bx, 150, (bx + mx) / 2 + (p[0] < 96 ? -8 : 8), 128, mx, my, p[0], p[1] + 12], i === 4 ? 22 : 18);
    });
    order.forEach(function (i) {
      var p = orochiHeadPos(i, f), h = OROCHI_HEADS[i];
      snakeHead(g, p[0], p[1], h[2] * 1.5, h[3], (f ? (i % 2 ? 6 : 1) : (i % 2 ? 1 : 6)));
    });
  }
  function orochiPre(g, f) { aura(g, 96, 100, 96, 'rgba(60,10,30,0.45)', 'rgba(20,40,20,0.4)', 12, f); }
  function orochiPost(g, f) {
    for (var i = 0; i < 5; i++) {
      var p = orochiHeadPos(i, f), h = OROCHI_HEADS[i], sc = h[2] * 1.5;
      g.save(); g.translate(p[0], p[1]); g.rotate(h[3]);
      eye(g, -8.5 * sc, -2.5 * sc, 1.9 * sc, '255,50,30', 0.35, 3.6);
      eye(g, 8.5 * sc, -2.5 * sc, 1.9 * sc, '255,50,30', -0.35, 3.6);
      g.restore();
    }
  }
  // --- 鬼武者 ---
  function drawOnimusha(g, f) {
    var s = f ? 1 : 0;
    var blk = function (y0, y1) { return LG(g, 0, y0, 0, y1, [0, '#5a5262', 0.3, '#2a2430', 1, '#08060a']); };
    // ぼろぼろの赤いマント
    var w = f ? 4 : -4;
    g.beginPath(); g.moveTo(52, 70); g.quadraticCurveTo(20, 100, 10 + w, 168);
    g.lineTo(20, 160); g.lineTo(26 + w, 176); g.lineTo(36, 164); g.lineTo(44, 180); g.lineTo(54, 166); g.lineTo(96, 170);
    g.lineTo(138, 166); g.lineTo(148, 180); g.lineTo(156, 164); g.lineTo(166 - w, 176); g.lineTo(172, 160); g.lineTo(182 - w, 168);
    g.quadraticCurveTo(172, 100, 140, 70); g.closePath();
    F(g, LG(g, 0, 70, 0, 180, [0, '#c01a24', 0.5, '#7a0a14', 1, '#2a0208']), 3);
    // 脚
    [[74, 70], [118, 122]].forEach(function (L) {
      P(g, [L[0] - 13, 150, L[0] + 13, 150, L[1] + 10, 176, L[1] - 10, 176]); F(g, blk(150, 176), 2.4);
      RR(g, L[1] - 10, 158, 20, 20, 4); F(g, blk(158, 178), 2.4);
      LN(g, [L[1] - 8, 164, L[1] + 8, 164], 2, GOLD); LN(g, [L[1] - 8, 170, L[1] + 8, 170], 2, GOLD);
      E(g, L[1], 182, 14, 6); F(g, '#1a141c', 2.4);
    });
    // 草摺
    P(g, [54, 118 + s, 138, 118 + s, 150, 156, 42, 156]); F(g, blk(118, 156), 3);
    for (var x = 66; x < 140; x += 14) LN(g, [x, 119 + s, x + (x - 96) * 0.15, 156], 2, OL);
    LN(g, [50, 130 + s, 142, 130 + s], 2.4, GOLD); LN(g, [47, 142 + s, 145, 142 + s], 2.4, GOLD);
    LN(g, [43, 155, 149, 155], 3, GOLD);
    // 胴
    S(g, [56, 72 + s, 96, 66 + s, 136, 72 + s, 142, 98 + s, 136, 122 + s, 56, 122 + s, 50, 98 + s]); F(g, blk(66, 122), 3);
    for (var y = 86; y < 122; y += 8) LN(g, [54, y + s, 138, y + s], 2.4, '#a8841e');
    // 胸の紋（金のひし形）
    P(g, [96, 82 + s, 110, 96 + s, 96, 110 + s, 82, 96 + s]); F(g, LG(g, 0, 82, 0, 110, [0, GOLDL, 0.5, GOLD, 1, '#7a5010']), 2);
    P(g, [96, 89 + s, 103, 96 + s, 96, 103 + s, 89, 96 + s]); F(g, '#a0101c', 1.4);
    // 左腕（こぶし）
    limb(g, [50, 80 + s, 34, 104, 40, 126], 16, blk(80, 126), 2.6);
    gauntlet(g, 40, 128);

    // 袖（大きな肩の板）
    sym(g, 96, function () {
      P(g, [24, 66 + s, 58, 62 + s, 62, 104 + s, 28, 110 + s]); F(g, blk(62, 110), 2.6);
      for (var k = 0; k < 3; k++) LN(g, [25 + k, 78 + k * 10 + s, 59 + k * 0.5, 74 + k * 10 + s], 2.2, '#a8841e');
      LN(g, [28, 109 + s, 62, 103 + s], 3, GOLD);
    });
    // 大太刀（右がわに高くかまえる）
    var tx = f ? 180 : 186, ty = f ? 2 : 8;
    limb(g, [150, 100 + s, 166, 112, 156, 132], 15, blk(100, 132), 2.6);
    katana(g, 150, 152, tx, ty, 12, 2, LG(g, 160, 0, 178, 0, [0, '#f4f6ff', 0.4, '#a8b0c8', 1, '#3a3e54']), 'rgba(255,90,120,0.95)');
    gauntlet(g, 152, 142); gauntlet(g, 155, 130);
    drawOniKabuto(g, f);
  }
  function gauntlet(g, x, y) {   // よろいの手（金の帯つき）
    C(g, x, y, 8.5); F(g, RG(g, x, y, 9, [0, '#5a5262', 1, '#0e0b10'], x - 3, y - 3), 2.2);
    g.beginPath(); g.arc(x, y, 6, PI * 1.1, PI * 1.9); ST(g, 2.2, GOLD);
  }
  function drawOniKabuto(g, f) {
    var s = f ? 1 : 0;
    g.save(); g.translate(0, s);
    // 長い角
    horn(g, 74, 30, 34, -2, 12, 2, -16); horn(g, 118, 30, 158, -2, 12, 2, 16);
    // しころ
    g.beginPath(); g.moveTo(62, 40); g.lineTo(130, 40); g.quadraticCurveTo(150, 54, 152, 70); g.quadraticCurveTo(96, 78, 40, 70); g.quadraticCurveTo(42, 54, 62, 40); g.closePath();
    F(g, LG(g, 0, 40, 0, 74, [0, '#3a3440', 1, '#08060a']), 2.6);
    g.beginPath(); g.moveTo(46, 58); g.quadraticCurveTo(96, 66, 146, 58); ST(g, 2.4, GOLD);
    g.beginPath(); g.moveTo(42, 66); g.quadraticCurveTo(96, 74, 150, 66); ST(g, 2.4, GOLD);
    // 面頬（鬼の面）
    S(g, [74, 44, 96, 40, 118, 44, 120, 60, 110, 74, 96, 78, 82, 74, 72, 60]); F(g, LG(g, 0, 40, 0, 78, [0, '#7a1a20', 0.6, '#3a080c', 1, '#140204']), 2.4);
    E(g, 85, 50, 7, 4, 0.3); g.fillStyle = '#060204'; g.fill(); E(g, 107, 50, 7, 4, -0.3); g.fill();
    // 口（牙）
    g.beginPath(); g.moveTo(82, 62); g.quadraticCurveTo(96, 58, 110, 62); g.quadraticCurveTo(104, 70, 96, 70); g.quadraticCurveTo(88, 70, 82, 62); g.closePath(); F(g, '#060204', 1.6);
    for (var t = 84; t < 108; t += 4) { P(g, [t, 62.5, t + 4, 62.5, t + 2, 66]); F(g, '#f0e8d8', 0.6); }
    // 白いひげ
    sym(g, 96, function () { P(g, [82, 72, 70, 86, 78, 82, 74, 92, 86, 78]); F(g, '#e8e4dc', 1.4); });
    // 鉢
    g.beginPath(); g.moveTo(64, 42); g.quadraticCurveTo(62, 14, 96, 12); g.quadraticCurveTo(130, 14, 128, 42); g.closePath();
    F(g, RG(g, 96, 30, 34, [0, '#6a6274', 0.5, '#2a2430', 1, '#08060a'], 84, 18), 2.6);
    for (var k = -2; k <= 2; k++) { LN(g, [96 + k * 11, 14 + Math.abs(k) * 1.5, 96 + k * 14, 40], 1.4, 'rgba(200,170,90,0.6)'); }
    P(g, [62, 38, 130, 38, 128, 44, 64, 44]); F(g, GOLD, 1.8);
    // 金の三日月の前立て
    g.beginPath(); g.moveTo(58, 10); g.quadraticCurveTo(96, 50, 134, 10); g.quadraticCurveTo(96, 34, 58, 10); g.closePath();
    F(g, LG(g, 0, 10, 0, 34, [0, '#fff4b0', 0.5, GOLD, 1, '#8a5a10']), 2);
    C(g, 96, 30, 5); F(g, RG(g, 96, 30, 5, [0, '#ff6a6a', 1, '#7a0010']), 1.6);
    // 吹返し
    sym(g, 96, function () { P(g, [64, 36, 50, 30, 52, 46, 64, 44]); F(g, LG(g, 0, 30, 0, 46, [0, '#3a3440', 1, '#08060a']), 2); LN(g, [51, 31, 52, 45], 2, GOLD); });
    g.restore();
  }
  function onimushaPre(g, f) {
    aura(g, 96, 96, 100, 'rgba(70,20,110,0.55)', 'rgba(40,10,70,0.45)', 16, f);
  }
  function onimushaPost(g, f) {
    var s = f ? 1 : 0;
    eye(g, 85, 50 + s, 3.6, '255,40,40', 0.3, 5); eye(g, 107, 50 + s, 3.6, '255,40,40', -0.3, 5);
    // 刀の妖しい光
    var tx = f ? 180 : 186, ty = f ? 2 : 8;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.4;
    LN(g, [158, 116, tx, ty], 12, 'rgba(255,60,120,0.5)'); g.restore();
  }
  // --- 竜神 ---
  var DRA = { c0: '#5adcc0', c1: '#1f8a7a', c2: '#073a36' };
  function dragonBody(g, pts, w) {
    SL(g, pts); ST(g, w + 7, OL);
    SL(g, pts); ST(g, w, DRA.c1);
    g.save(); g.translate(-w * 0.12, -w * 0.18); SL(g, pts); ST(g, w * 0.5, 'rgba(120,255,220,0.32)'); g.restore();
    g.save(); g.setLineDash([3, 5]); SL(g, pts); ST(g, w * 0.82, 'rgba(0,30,30,0.4)'); g.restore();
    // 金のおなか
    g.save(); g.translate(w * 0.14, w * 0.2); SL(g, pts); ST(g, w * 0.34, '#e8c050'); g.setLineDash([2, 4]); SL(g, pts); ST(g, w * 0.34, 'rgba(120,70,10,0.7)'); g.restore();
    // せびれ
  }
  function drawRyujin(g, f) {
    var s = f ? 1 : 0;
    // からだのうねり
    // 背びれ
    seed = 55;
    [[34, 24, 1.25], [12, 70, 1.0], [158, 24, 1.75], [184, 72, 2.0], [16, 130, 0.9], [178, 130, 0.1]].forEach(function (p) {
      spikes(g, p[0], p[1], 2, 18, 3, PI * (p[2] - 0.28), PI * (p[2] + 0.28), 0.2); F(g, LG(g, 0, p[1] - 18, 0, p[1] + 8, [0, '#ffb04a', 1, '#c02a1a']), 1.6);
    });
    dragonBody(g, [84, 60, 40, 22, 10, 70, 22, 132, 64, 156], 26);
    dragonBody(g, [108, 60, 156, 22, 184, 76, 172, 132, 132, 158], 26);
    // しっぽの先のひれ
    spikes(g, 30, 172, 4, 24, 4, PI * 0.7, PI * 1.3, 0.25); F(g, LG(g, 6, 0, 30, 0, [0, '#ffb04a', 1, '#c02a1a']), 1.6);
    dragonBody(g, [30, 172, 60, 156, 100, 178, 142, 162, 168, 174], 30);
    // たてがみ
    spikes(g, 96, 78, 34, 66, 14, PI * 0.7, PI * 2.3, 0.3); F(g, LG(g, 0, 10, 0, 140, [0, '#bafff0', 0.5, '#3ab8a0', 1, '#0e4a44']), 2.4);
    // 金の角（枝分かれ）
    sym(g, 96, function () {
      limb(g, [80, 50, 64, 26, 46, 8], 7, LG(g, 0, 50, 0, 8, [0, '#a07018', 1, GOLDL]), 2.2);
      limb(g, [66, 30, 52, 30, 44, 22], 4.6, GOLD, 2);
      limb(g, [56, 18, 60, 6], 4, GOLD, 1.8);
    });
    // 頭
    S(g, [62, 52, 96, 40, 130, 52, 138, 76, 126, 100, 96, 106, 66, 100, 54, 76]); F(g, LG(g, 0, 40, 0, 106, [0, DRA.c0, 0.5, DRA.c1, 1, DRA.c2]), 3);
    inside(g, function () { S(g, [62, 52, 96, 40, 130, 52, 138, 76, 126, 100, 96, 106, 66, 100, 54, 76]); }, function () { scaleTex(g, 54, 40, 138, 106, 8, 'rgba(0,30,30,0.35)', 1.2); });
    // 眉の骨
    P(g, [62, 62, 90, 68, 88, 74, 64, 70]); F(g, '#0e5a50', 1.8); P(g, [130, 62, 102, 68, 104, 74, 128, 70]); F(g, '#0e5a50', 1.8);
    E(g, 78, 76, 8, 5, 0.25); g.fillStyle = 'rgba(0,10,10,0.9)'; g.fill(); E(g, 114, 76, 8, 5, -0.25); g.fill();
    // 鼻先（こちらへ）
    S(g, [76, 92, 96, 86, 116, 92, 118, 108, 96, 114, 74, 108]); F(g, LG(g, 0, 86, 0, 114, [0, DRA.c0, 1, DRA.c1]), 2.6);
    E(g, 88, 100, 3.5, 2.4, 0.4); g.fillStyle = OL; g.fill(); E(g, 104, 100, 3.5, 2.4, -0.4); g.fill();
    // 口（開く）
    var o = s * 5;
    g.beginPath(); g.moveTo(72, 110); g.quadraticCurveTo(96, 118, 120, 110); g.quadraticCurveTo(114, 138 + o, 96, 140 + o); g.quadraticCurveTo(78, 138 + o, 72, 110); g.closePath();
    F(g, RG(g, 96, 124, 24, [0, '#c0202e', 1, '#3a0208']), 2.4);
    g.beginPath(); g.moveTo(88, 128 + o); g.quadraticCurveTo(96, 122, 104, 128 + o); g.quadraticCurveTo(96, 138 + o, 88, 128 + o); F(g, '#ff5a6a', 1.2);
    P(g, [76, 111, 79, 124, 82, 113]); F(g, '#fffaf0', 1.2); P(g, [116, 111, 113, 124, 110, 113]); F(g, '#fffaf0', 1.2);
    P(g, [80, 136 + o, 82, 126 + o, 85, 137 + o]); F(g, '#fffaf0', 1.1); P(g, [112, 136 + o, 110, 126 + o, 107, 137 + o]); F(g, '#fffaf0', 1.1);
    // 下あご
    g.beginPath(); g.moveTo(74, 132 + o); g.quadraticCurveTo(96, 152 + o, 118, 132 + o); g.quadraticCurveTo(96, 144 + o, 74, 132 + o); F(g, DRA.c1, 2);
    // あごひげ
    P(g, [88, 146 + o, 96, 168 + o, 104, 146 + o]); F(g, LG(g, 0, 146, 0, 168, [0, '#bafff0', 1, '#3ab8a0']), 1.6);
    // ひげ（長い）
    var wv = f ? 6 : -6;
    sym(g, 96, function (m) {
      SLN(g, [78, 104, 50, 108, 30, 130 + wv * m, 10, 120 + wv * m], 5.4, OL);
      SLN(g, [78, 104, 50, 108, 30, 130 + wv * m, 10, 120 + wv * m], 2.6, GOLDL);
    });
    // 宝珠を持つ手
    limb(g, [168, 150, 160, 146, 152, 156], 12, DRA.c1, 2.4);
    C(g, 150, 164, 13); F(g, RG(g, 150, 164, 14, [0, '#ffffff', 0.3, '#bff8ff', 0.8, '#5ac8e8', 1, '#2a7aa8'], 145, 158), 2.4);
    sym(g, 150, function (m) {
      limb(g, [140, 156, 134, 166, 138, 176], 5, '#e8c050', 1.8);
    });
    limb(g, [160, 156, 166, 168, 160, 178], 5, '#e8c050', 1.8);
  }
  function ryujinPre(g, f) { aura(g, 96, 96, 100, 'rgba(20,120,120,0.45)', 'rgba(10,60,80,0.4)', 14, f); }
  function ryujinPost(g, f) {
    eye(g, 78, 76, 4.8, '255,200,40', 0.3, 4.5); eye(g, 114, 76, 4.8, '255,200,40', -0.3, 4.5);
    glow(g, 150, 164, 30, '160,240,255', 0.7);
  }

  /* =========================================================
     武器のアイコン 96x96
     ========================================================= */
  function icon(fn, rim) {
    return sprite(96, 96, { body: fn, ol: 3.5, rim: rim || 'rgba(255,255,255,0.55)', ro: 2.5, shade: true }, 0);
  }
  function rot(g, a, fn) { g.save(); g.translate(48, 48); g.rotate(a); g.translate(-48, -48); fn(); g.restore(); }
  function arrow(g, x0, x1, y) {
    LN(g, [x0, y, x1 - 10, y], 4, '#8a5a2a');
    P(g, [x1, y, x1 - 14, y - 7, x1 - 11, y, x1 - 14, y + 7]); F(g, steel(g, x1 - 14, y - 7, x1, y + 7), 1.6);
    P(g, [x0 + 14, y, x0, y - 8, x0 + 4, y, x0, y + 8]); F(g, '#f4eee0', 1.4);
    LN(g, [x0 + 4, y - 3, x0 + 12, y], 1.2, RED);
  }
  var ICON = {
    yumi: function (g) {
      rot(g, -0.6, function () {
        g.beginPath(); g.moveTo(34, 4); g.quadraticCurveTo(6, 48, 34, 92); ST(g, 10, OL);
        g.beginPath(); g.moveTo(34, 4); g.quadraticCurveTo(6, 48, 34, 92); ST(g, 6, LG(g, 0, 0, 0, 96, [0, '#a04a2a', 0.5, '#4a1a10', 1, '#a04a2a']));
        LN(g, [34, 5, 34, 91], 1.8, '#f6f0e0');
        RR(g, 15, 42, 7, 12, 2); F(g, RED, 1.4);
        arrow(g, 26, 94, 48);
      });
    },
    shuriken: function (g) {
      rot(g, 0.3, function () {
        g.beginPath();
        for (var i = 0; i < 8; i++) { var a = i * PI / 4, r = i % 2 ? 11 : 42; var x = 48 + Math.cos(a) * r, y = 48 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.closePath(); F(g, steel(g, 14, 14, 82, 82), 2.4);
        for (var j = 0; j < 4; j++) { var b = j * PI / 2; LN(g, [48, 48, 48 + Math.cos(b) * 40, 48 + Math.sin(b) * 40], 1.4, 'rgba(255,255,255,0.7)'); }
        C(g, 48, 48, 6); F(g, '#1a1a22', 2);
      });
    },
    kunai: function (g) {
      rot(g, 0.78, function () {
        P(g, [48, 2, 62, 34, 52, 52, 44, 52, 34, 34]); F(g, steel(g, 34, 20, 62, 30), 2.4);
        LN(g, [48, 6, 48, 50], 1.4, 'rgba(255,255,255,0.8)');
        RR(g, 42, 52, 12, 26, 3); F(g, LG(g, 42, 0, 54, 0, [0, '#3a3a50', 1, '#14141c']), 2);
        for (var y = 56; y < 78; y += 5) LN(g, [42, y, 54, y + 3], 1.6, '#c8b07a');
        C(g, 48, 85, 7); ST(g, 7, OL); C(g, 48, 85, 7); ST(g, 3.4, steel(g, 40, 78, 56, 92));
      });
    },
    teppo: function (g) {
      rot(g, -0.5, function () {
        P(g, [4, 52, 34, 46, 40, 58, 10, 66]); F(g, LG(g, 0, 46, 0, 66, [0, '#a0602a', 1, '#4a2410']), 2.2);
        RR(g, 30, 42, 64, 9, 3); F(g, LG(g, 0, 42, 0, 51, [0, '#7a7a88', 0.4, '#3a3a44', 1, '#14141a']), 2.2);
        RR(g, 30, 50, 46, 8, 2); F(g, '#6a3a1a', 2);
        LN(g, [52, 42, 52, 58], 3, GOLD); LN(g, [70, 42, 70, 58], 3, GOLD); LN(g, [88, 42, 88, 51], 3, GOLD);
        g.beginPath(); g.moveTo(36, 50); g.quadraticCurveTo(30, 36, 40, 30); ST(g, 3, '#8a7a5a');
      });
    },
    hiya: function (g) {
      rot(g, -0.78, function () { arrow(g, 4, 76, 48); });
    },
    ozutsu: function (g) {
      // 台
      P(g, [16, 74, 80, 74, 86, 88, 10, 88]); F(g, LG(g, 0, 74, 0, 88, [0, '#a0602a', 1, '#4a2410']), 2.2);
      C(g, 28, 80, 9); F(g, '#5a3418', 2.2); C(g, 28, 80, 3); F(g, GOLD, 1.4);
      C(g, 68, 80, 9); F(g, '#5a3418', 2.2); C(g, 68, 80, 3); F(g, GOLD, 1.4);
      rot(g, -0.4, function () {
        g.beginPath(); g.moveTo(10, 50); g.quadraticCurveTo(8, 34, 22, 32); g.lineTo(78, 38); g.lineTo(78, 62); g.lineTo(22, 68); g.quadraticCurveTo(8, 66, 10, 50); g.closePath();
        F(g, LG(g, 0, 32, 0, 68, [0, '#ffe0a0', 0.25, '#d09a4a', 0.65, '#8a5a20', 1, '#3a2408']), 2.4);
        for (var x = 30; x < 78; x += 16) LN(g, [x, 35 + (x - 22) * 0.1, x, 65 - (x - 22) * 0.1], 3, '#5a3a10');
        E(g, 80, 50, 6, 13); F(g, '#b07a30', 2.2); E(g, 81, 50, 3.5, 8); F(g, '#0a0604');
      });
    },
    bakuchiku: function (g) {
      rot(g, -0.25, function () {
        for (var i = 0; i < 4; i++) {
          var x = 22 + i * 14, y = 36 + (i % 2) * 6;
          RR(g, x, y, 13, 44, 4); F(g, LG(g, x, 0, x + 13, 0, [0, '#ff6a5a', 0.4, '#e0202a', 1, '#7a0a10']), 2);
          LN(g, [x + 2, y + 8, x + 11, y + 8], 2, GOLD); LN(g, [x + 2, y + 36, x + 11, y + 36], 2, GOLD);
        }
        RR(g, 18, 54, 62, 8, 2); F(g, '#e8d8a8', 2);
        g.beginPath(); g.moveTo(50, 38); g.quadraticCurveTo(54, 18, 68, 14); ST(g, 3, '#4a3a2a');
      });
    },
    horoku: function (g) {
      C(g, 46, 56, 30); F(g, RG(g, 46, 56, 32, [0, '#5a5664', 0.5, '#24222a', 1, '#060508'], 36, 44), 2.6);
      RR(g, 38, 20, 16, 10, 3); F(g, '#8a7a5a', 2);
      g.beginPath(); g.moveTo(46, 22); g.quadraticCurveTo(52, 8, 66, 12); ST(g, 3.2, '#4a3a2a');
      E(g, 34, 44, 9, 5, -0.6); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
      LN(g, [18, 60, 74, 60], 3, '#8a2a1a');
    },
    hanabi: function (g) {
      var cols = ['#ffd84a', '#ff5a4a', '#5ae0ff', '#ff8adf'];
      for (var i = 0; i < 16; i++) {
        var a = i / 16 * TAU, r0 = 12, r1 = i % 2 ? 34 : 44;
        LN(g, [48 + Math.cos(a) * r0, 48 + Math.sin(a) * r0, 48 + Math.cos(a) * r1, 48 + Math.sin(a) * r1], 5, cols[i % 4]);
        C(g, 48 + Math.cos(a) * (r1 + 3), 48 + Math.sin(a) * (r1 + 3), 3.4); F(g, '#fff6c8', 1);
      }
      C(g, 48, 48, 10); F(g, RG(g, 48, 48, 10, [0, '#ffffff', 1, '#ffb030']), 1.6);
    },
    kaminari: function (g) {
      // 太鼓の輪
      C(g, 48, 48, 36); ST(g, 9, OL); C(g, 48, 48, 36); ST(g, 5, '#c01a24');
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * TAU, x = 48 + Math.cos(a) * 36, y = 48 + Math.sin(a) * 36;
        C(g, x, y, 8); F(g, LG(g, x, y - 8, x, y + 8, [0, '#e04a3a', 1, '#6a0a10']), 2);
        C(g, x, y, 4.4); F(g, '#f4e8c8', 1.2);
      }
      // いなずま
      P(g, [56, 6, 30, 50, 46, 50, 34, 90, 70, 40, 52, 40, 64, 6]); F(g, LG(g, 0, 6, 0, 90, [0, '#ffffff', 0.3, '#fff27a', 1, '#ffb000']), 2.6);
    },
    fuma: function (g) {
      rot(g, 0.2, function () {
        for (var i = 0; i < 4; i++) {
          g.save(); g.translate(48, 48); g.rotate(i * PI / 2);
          g.beginPath(); g.moveTo(-7, -6); g.quadraticCurveTo(-4, -30, 8, -46); g.quadraticCurveTo(4, -26, 12, -8); g.closePath();
          F(g, steel(g, -6, -46, 12, -6), 2.4);
          LN(g, [-2, -10, 6, -40], 1.4, 'rgba(255,255,255,0.8)');
          g.restore();
        }
        C(g, 48, 48, 14); F(g, RG(g, 48, 48, 14, [0, '#5a5a6a', 1, '#14141c']), 2.4);
        C(g, 48, 48, 6); F(g, '#06060a', 1.6);
        C(g, 48, 48, 10); ST(g, 1.6, GOLD);
      });
    },
    yoto: function (g) {
      rot(g, -0.78, function () {
        // 紫のもや
        g.save(); g.globalAlpha = 0.6;
        E(g, 58, 48, 38, 14); g.fillStyle = RG(g, 58, 48, 40, [0, 'rgba(200,80,255,0.9)', 1, 'rgba(120,0,200,0)']); g.fill(); g.restore();
        katana(g, 2, 48, 94, 46, 9, 1.8, LG(g, 0, 40, 0, 56, [0, '#3a1a4a', 0.5, '#14081a', 1, '#06020a']), '#e08aff');
      });
    },
    kusarigama: function (g) {
      // くさり
      g.save();
      for (var i = 0; i < 6; i++) {
        var x = 56 + i * 6, y = 62 + Math.sin(i * 0.9) * 6 + i * 3;
        E(g, x, y, 4.4, 3, i % 2 ? 0.9 : -0.2); ST(g, 4.6, OL); E(g, x, y, 4.4, 3, i % 2 ? 0.9 : -0.2); ST(g, 2.2, '#c8ccd8');
      }
      g.restore();
      C(g, 90, 84, 7); F(g, RG(g, 90, 84, 7, [0, '#9a9aaa', 1, '#2a2a34'], 87, 81), 2);
      // 柄
      rot(g, 0.5, function () {
        RR(g, 42, 30, 10, 46, 3); F(g, LG(g, 42, 0, 52, 0, [0, '#b0703a', 1, '#5a3418']), 2.2);
        for (var y = 50; y < 74; y += 6) LN(g, [42, y, 52, y + 3], 1.6, '#2a1a10');
        // 鎌の刃
        g.beginPath(); g.moveTo(52, 30); g.quadraticCurveTo(30, 6, 4, 14); g.quadraticCurveTo(28, 18, 42, 38); g.closePath();
        F(g, steel(g, 10, 6, 40, 36), 2.4);
        g.beginPath(); g.moveTo(6, 14); g.quadraticCurveTo(30, 10, 48, 32); ST(g, 1.4, 'rgba(255,255,255,0.9)');
      });
    }
  };
  // アイコンの後で足す光（火・火花）
  function iconPost(name, c) {
    var g = c.getContext('2d');
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    if (name === 'hiya') {
      // 火のついた矢じり
      var x = 48 + Math.cos(-0.78) * 22, y = 48 + Math.sin(-0.78) * 22;
      glow(g, x + 4, y - 4, 30, '255,140,30', 0.9);
      g.translate(x + 2, y - 2); g.rotate(-0.78 + PI / 2);
      g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(12, -6, 8, 6); g.quadraticCurveTo(0, 14, -8, 6); g.quadraticCurveTo(-12, -6, 0, -26); g.closePath();
      F(g, LG(g, 0, -26, 0, 12, [0, '#fff6a0', 0.4, '#ffb020', 1, '#e0300a']), 2.2);
      g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(5, -2, 3, 5); g.quadraticCurveTo(0, 8, -3, 5); g.quadraticCurveTo(-5, -2, 0, -14); g.fillStyle = '#ffffe0'; g.fill();
    } else if (name === 'bakuchiku' || name === 'horoku') {
      var p = name === 'horoku' ? [66, 12] : [72, 10];
      glow(g, p[0], p[1], 18, '255,180,40', 1);
      spark(g, p[0], p[1], 10, '#fffbe0');
    } else if (name === 'teppo') {
      glow(g, 40, 40, 10, '255,120,30', 0.9);
    } else if (name === 'kaminari') {
      glow(g, 48, 48, 26, '255,240,120', 0.4);
    } else if (name === 'yoto') {
      glow(g, 70, 30, 14, '220,120,255', 0.5);
    }
    g.restore();
  }
  function spark(g, x, y, r, col) {
    g.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * PI / 4 - PI / 2, rr = i % 2 ? r * 0.28 : r; var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath(); g.fillStyle = col; g.fill();
  }

  /* =========================================================
     効果（光・けむり・火花・墨）
     ========================================================= */
  function fxGlow() {
    var c = mk(128, 128), g = c.getContext('2d');
    g.fillStyle = RG(g, 64, 64, 64, [0, 'rgba(255,255,255,1)', 0.25, 'rgba(255,255,255,0.6)', 0.6, 'rgba(255,255,255,0.15)', 1, 'rgba(255,255,255,0)']);
    g.fillRect(0, 0, 128, 128); return c;
  }
  function fxSmoke() {
    var c = mk(128, 128), g = c.getContext('2d');
    seed = 77;
    for (var i = 0; i < 9; i++) {
      var a = rnd() * TAU, d = rnd() * 26, x = 64 + Math.cos(a) * d, y = 66 + Math.sin(a) * d * 0.8, r = 22 + rnd() * 18;
      g.fillStyle = RG(g, x, y, r, [0, 'rgba(200,196,192,0.5)', 0.6, 'rgba(150,146,144,0.22)', 1, 'rgba(120,118,116,0)'], x - r * 0.3, y - r * 0.3);
      C(g, x, y, r); g.fill();
    }
    return c;
  }
  function fxSpark() {
    var c = mk(32, 32), g = c.getContext('2d');
    g.fillStyle = RG(g, 16, 16, 16, [0, 'rgba(255,255,255,0.8)', 0.4, 'rgba(255,255,255,0.15)', 1, 'rgba(255,255,255,0)']);
    g.fillRect(0, 0, 32, 32);
    spark(g, 16, 16, 15, '#ffffff');
    return c;
  }
  function fxInk() {
    var c = mk(128, 128), g = c.getContext('2d');
    seed = 13;
    var pts = [];
    for (var i = 0; i < 18; i++) { var a = i / 18 * TAU, r = 26 + rnd() * 22 * (i % 2 ? 1 : 0.5); pts.push(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    S(g, pts); g.fillStyle = RG(g, 64, 64, 50, [0, '#6a0a12', 0.7, '#4a0408', 1, '#2a0204']); g.fill();
    for (i = 0; i < 12; i++) {
      var b = rnd() * TAU, d = 44 + rnd() * 16, rr = 2 + rnd() * 5;
      C(g, 64 + Math.cos(b) * d, 64 + Math.sin(b) * d, rr); g.fillStyle = '#5a0810'; g.fill();
    }
    E(g, 52, 50, 10, 5, -0.5); g.fillStyle = 'rgba(255,120,120,0.18)'; g.fill();
    return c;
  }

  /* =========================================================
     まとめて作る
     ========================================================= */
  var ART = { unit: {}, enemy: {}, boss: {}, icon: {}, fx: {} };
  var UNIT_RIM = 'rgba(190,220,255,0.75)', EN_RIM = 'rgba(255,170,120,0.55)';
  ART.build = function () {
    // 味方
    ART.unit.sam = pair(96, 96, { body: drawSam, ol: 3, rim: UNIT_RIM, sh: [48, 91, 19, 5] });
    ART.unit.nin = pair(96, 96, { body: drawNin, ol: 3, rim: UNIT_RIM, sh: [48, 91, 17, 5] });
    // 敵
    var E128 = function (body, post, sh, rim, pre) { return pair(128, 128, { body: body, post: post, pre: pre, ol: 3.2, rim: rim || EN_RIM, ro: 2.6, sh: sh || [64, 123, 26, 6] }); };
    ART.enemy.ashigaru = E128(drawAshigaru, soldierEyes);
    ART.enemy.teppo = E128(drawTeppo, function (g, f) {
      soldierEyes(g, f); var b = f ? 1 : 0;
      glow(g, 82, 62 + b, 12, '255,120,30', 1); C(g, 82, 62 + b, 2); g.fillStyle = '#fff2b0'; g.fill();
    });
    ART.enemy.yumi = E128(drawYumi, soldierEyes);
    ART.enemy.ninja = E128(drawNinjaE, function (g, f) { eye(g, 58.5, 53.5, 2.3, '255,40,30', 0.25); eye(g, 69.5, 53.5, 2.3, '255,40,30', -0.25); }, [64, 122, 32, 6]);
    ART.enemy.oni = E128(function (g, f) { oniBody(g, f, ONI_R); oniArmClub(g, f, ONI_R); oniHead(g, f, ONI_R); }, oniEyes, [64, 123, 34, 7]);
    ART.enemy.aooni = E128(function (g, f) { oniBody(g, f, ONI_B); oniArmClub(g, f, ONI_B); oniHead(g, f, ONI_B); }, oniEyes, [64, 123, 38, 7]);
    ART.enemy.gaikotsu = E128(drawGaikotsu, function (g, f) { eye(g, 57.5, 33.5, 1.7, '90,200,255', 0.25, 4); eye(g, 70.5, 33.5, 1.7, '90,200,255', -0.25, 4); }, null, 'rgba(160,220,255,0.5)');
    ART.enemy.kiba = E128(drawKiba, kibaPost, [64, 122, 44, 7]);
    ART.enemy.yurei = pair(128, 128, { body: drawYurei, post: yureiPost, ol: 3.2, rim: 'rgba(170,255,240,0.6)', ro: 2.6,
      pre: function (g) { glow(g, 64, 64, 60, '80,200,190', 0.35); } });
    ART.enemy.tengu = E128(drawTengu, function (g, f) { eye(g, 57, 37, 2.2, '255,220,60', 0.25); eye(g, 71, 37, 2.2, '255,220,60', -0.25); }, [64, 122, 30, 6]);
    // ボス
    var B = function (body, pre, post, sh, rim) { return pair(384, 384, { body: body, pre: pre, post: post, sc: 1.8, tx: 19.2, ty: 37.6, ol: 6, rim: rim || 'rgba(255,190,140,0.55)', ro: 7, sh: sh || [96, 186, 70, 10] }); };
    ART.boss.akaoni = B(drawAkaoni, akaoniPre, akaoniPost);
    ART.boss.gashadokuro = B(drawGasha, gashaPre, gashaPost, [96, 186, 80, 9], 'rgba(160,255,230,0.5)');
    ART.boss.tsuchigumo = B(drawTsuchi, tsuchiPre, tsuchiPost, [96, 184, 88, 10]);
    ART.boss.orochi = B(drawOrochi, orochiPre, orochiPost, [96, 186, 86, 10], 'rgba(200,255,170,0.5)');
    ART.boss.onimusha = B(drawOnimusha, onimushaPre, onimushaPost, null, 'rgba(230,180,255,0.55)');
    ART.boss.ryujin = B(drawRyujin, ryujinPre, ryujinPost, [96, 186, 86, 9], 'rgba(200,255,240,0.55)');
    // アイコン
    for (var k in ICON) { if (ICON.hasOwnProperty(k)) { ART.icon[k] = icon(ICON[k]); iconPost(k, ART.icon[k]); } }
    // 効果
    ART.fx.glow = fxGlow(); ART.fx.smoke = fxSmoke(); ART.fx.spark = fxSpark(); ART.fx.ink = fxInk();
    return ART;
  };
  window.ART = ART;
})();
