  // ---------------------------------------------------------------- the diorama kit (from the Tiny Diorama reference)
  const D2R = Math.PI / 180;
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

  function ring(w, d, r, n = 10) {
    const pts = [], hx = w / 2 - r, hz = d / 2 - r; let u = 0, px = 0, pz = 0;
    for (let k = 0; k < 4; k++) for (let i = 0; i <= n; i++) {
      const a = (k + i / n) * Math.PI / 2, x = (k === 0 || k === 3 ? hx : -hx) + r * Math.cos(a), z = (k < 2 ? hz : -hz) + r * Math.sin(a);
      if (pts.length) u += Math.hypot(x - px, z - pz);
      px = x; pz = z; pts.push({ x, z, nx: Math.cos(a), nz: Math.sin(a), u });
    }
    pts.push({ ...pts[0], u: u + Math.hypot(pts[0].x - px, pts[0].z - pz) });
    pts.around = pts[pts.length - 1].u;
    return pts;
  }
  function loft(loop, profile, cap = true) {
    const P = profile.map(([inset, y, a], j) => { const p0 = profile[Math.max(0, j - 1)], p1 = profile[Math.min(profile.length - 1, j + 1)]; return [inset, y, a == null ? Math.atan2(p0[1] - p1[1], p0[0] - p1[0]) : a]; });
    const M = loop.length, pos = [], nor = [], uv = [], idx = [], y0 = P[0][1], y1 = P[P.length - 1][1];
    for (const [inset, y, a] of P) for (const p of loop) { pos.push(p.x - p.nx * inset, y, p.z - p.nz * inset); nor.push(p.nx * Math.sin(a), Math.cos(a), p.nz * Math.sin(a)); uv.push(p.u / loop.around, (y - y1) / (y0 - y1 || 1)); }
    for (let j = 0; j < P.length - 1; j++) for (let i = 0; i < M - 1; i++) { const a = j * M + i, b = a + 1, c = a + M, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(), sideCount = idx.length;
    if (cap) {
      const base = pos.length / 3; pos.push(0, y0, 0); nor.push(0, 1, 0); uv.push(0, 0);
      for (const p of loop) { const x = p.x - p.nx * P[0][0], z = p.z - p.nz * P[0][0]; pos.push(x, y0, z); nor.push(0, 1, 0); uv.push(x, z); }
      for (let i = 0; i < M - 1; i++) idx.push(base, base + 2 + i, base + 1 + i);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.addGroup(0, sideCount, 0); if (cap) g.addGroup(sideCount, idx.length - sideCount, 1);
    return g;
  }
  const lip = (r, y, n = 5) => Array.from({ length: n + 1 }, (_, i) => { const a = i / n * Math.PI / 2; return [r * (1 - Math.sin(a)), y - r * (1 - Math.cos(a)), a]; });
  function prism(pts, r, depth, bevel = 0.04) {
    const s = new THREE.Shape(), n = pts.length;
    pts.forEach((p, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]), k = Math.min(Array.isArray(r) ? r[i] : r, da / 2, db / 2);
      const p0 = [p[0] + (a[0] - p[0]) * k / da, p[1] + (a[1] - p[1]) * k / da], p1 = [p[0] + (b[0] - p[0]) * k / db, p[1] + (b[1] - p[1]) * k / db];
      if (i === 0) s.moveTo(p0[0], p0[1]); else s.lineTo(p0[0], p0[1]);
      s.quadraticCurveTo(p[0], p[1], p1[0], p1[1]);
    });
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -(depth - 2 * bevel) / 2);
    return g;
  }

  const paints = new Map();
  const paint = (hex, rough = 0.86) => { const key = hex + rough; if (!paints.has(key)) paints.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 })); return paints.get(key); };
  const lampPaint = (hex = PAL.glass, glow = PAL.lampGlow) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45, emissive: glow, emissiveIntensity: 0 });
  function put(parent, geo, mat, p = [0, 0, 0], r, cast = true) {
    const m = new THREE.Mesh(geo, typeof mat === 'string' ? paint(mat) : mat); m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]);
    m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (parent, w, h, d, color, p, r = 0.06, rot) => put(parent, K.roundedBox(w, h, d, r, 4), color, p, rot);
  const decal = (parent, w, h, r, mat, p, rot) => put(parent, K.roundedRect(w, h, r), mat, p, rot, false);

  function tile(parent, { w, d, r }) {
    const g = new THREE.Group(); parent.add(g);
    const rr = K.rng(7);
    const grass = K.canvasTex(1024, 1024, (ctx, W) => {
      ctx.fillStyle = PAL.grass; ctx.fillRect(0, 0, W, W);
      for (let i = 0; i < 90; i++) { const x = rr.range(0, W), y = rr.range(0, W), s = rr.range(60, 190), c = rr.chance(0.5) ? '255,246,190' : '60,120,70'; for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) { const gr = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, s); gr.addColorStop(0, `rgba(${c},0.11)`); gr.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gr; ctx.fillRect(x + ox - s, y + oy - s, 2 * s, 2 * s); } }
      for (let i = 0; i < 26000; i++) { ctx.fillStyle = rr.chance(0.5) ? 'rgba(255,255,210,0.10)' : 'rgba(40,90,50,0.10)'; ctx.fillRect(rr.range(0, W), rr.range(0, W), 2, 2); }
    }, { repeat: [1 / 5, 1 / 5] });
    const grassMat = new THREE.MeshPhysicalMaterial({ map: grass, roughness: 0.95, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color('#e8f5b0') });
    const cap = put(g, loft(ring(w + 0.18, d + 0.18, r + 0.09, 12), [...lip(0.11, 0), [0, -0.19, Math.PI / 2], [0.1, -0.27, Math.PI]]), [grassMat, grassMat]);
    cap.material[0] = new THREE.MeshPhysicalMaterial({ color: PAL.grass, roughness: 0.95, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color('#e8f5b0') });
    const H = 1.8, strata = K.canvasTex(2048, 512, (ctx, W, Hh) => {
      const wave = (base, amp, k, ph) => (x) => base + amp * Math.sin(x / W * Math.PI * 2 * k + ph) + amp * 0.5 * Math.sin(x / W * Math.PI * 2 * (k * 2 + 1) + ph * 2.3);
      const band = (top, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, Hh); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, top(x)); ctx.lineTo(W, Hh); ctx.fill(); };
      ctx.fillStyle = PAL.earth[0]; ctx.fillRect(0, 0, W, Hh);
      band(wave(44, 7, 5, 0.4), PAL.earth[1]); band(wave(170, 14, 3, 1.9), PAL.earth[2]); band(wave(292, 16, 2, 4.0), PAL.earth[3]);
      const blob = (x, y, a, b, rot, color) => { for (const ox of [-W, 0, W]) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x + ox, y, a, b, rot, 0, 7); ctx.fill(); } };
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(255,240,205,0.28)'; ctx.lineWidth = 5; ctx.beginPath(); const f = wave(194 + i * 15, 12, 3, 1.9 + i * 0.25); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, f(x)); ctx.stroke(); }
      for (let i = 0; i < 46; i++) blob(rr.range(0, W), rr.range(66, 160), rr.range(7, 20), rr.range(5, 12), rr.range(-0.5, 0.5), rr.pick(['#d7c4a6', '#a88a70', '#6f4c3b']));
      for (let i = 0; i < 30; i++) blob(rr.range(0, W), rr.range(322, 500), rr.range(24, 70), rr.range(10, 24), rr.range(-0.3, 0.3), rr.pick(['#8b8e9d', '#6e7181', '#73768a']));
      for (let i = 0; i < 40; i++) { const x = rr.range(0, W); ctx.strokeStyle = 'rgba(60,40,30,0.5)'; ctx.lineWidth = rr.range(2, 4); ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + rr.range(-18, 18), 30, x + rr.range(-26, 26), rr.range(40, 90)); ctx.stroke(); }
    }, { repeat: [2, 1] });
    put(g, loft(ring(w, d, r, 12), [[0, -0.19, Math.PI / 2], [0, -1.32, Math.PI / 2], [0.07, -1.52], [0.3, -1.76], [0.62, -1.9], [0.95, -H - 0.19]], false), new THREE.MeshStandardMaterial({ map: strata, roughness: 0.9 }));
    put(g, loft(ring(w - 1.9, d - 1.9, 0.3), [[0, -H - 0.17, 0]]), PAL.earth[3]);
    const loop = ring(w, d, r, 12), stones = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), paint('#ffffff', 0.9), 30); stones.castShadow = stones.receiveShadow = true; g.add(stones);
    for (let i = 0; i < stones.count; i++) {
      const at = rr.range(0, loop.around), j = loop.findIndex((q) => q.u >= at), a = loop[Math.max(0, j - 1)], b = loop[j], f = (at - a.u) / (b.u - a.u || 1), p = { x: K.lerp(a.x, b.x, f), z: K.lerp(a.z, b.z, f), nx: b.nx, nz: b.nz }, y = rr.range(-0.45, -1.25), s = rr.range(0.05, 0.11);
      K.place(stones, i, [p.x - p.nx * s * 0.25, y, p.z - p.nz * s * 0.25], [rr.range(0, 3), rr.range(0, 3), 0], [s * rr.range(1, 1.7), s * rr.range(0.6, 1), s]);
      stones.setColorAt(i, new THREE.Color(y > -1.0 ? rr.pick(PAL.stone) : PAL.stone[2]));
    }
    g.userData.grass = cap.material[0];
    return g;
  }
  function ribbon(parent, pts, { width = 1.1, height = 0.05, texture, period = 1 }) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'); curve.arcLengthDivisions = 600;
    const len = curve.getLength(), n = Math.ceil(len * 14), pos = [], uv = [], idx = [], cross = [[-width / 2, 0, 0], [-width / 2 + 0.05, height, 0.06], [width / 2 - 0.05, height, 0.94], [width / 2, 0, 1]];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n), tg = curve.getTangentAt(i / n);
      for (const [o, y, v] of cross) { pos.push(p.x - tg.z * o, y, p.z + tg.x * o); uv.push(i / n * len / period, v); }
      if (i < n) for (let k = 0; k < 3; k++) { const a = i * 4 + k; idx.push(a, a + 1, a + 4, a + 1, a + 5, a + 4); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    put(parent, g, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }), [0, 0, 0], null, false);
    return Object.assign(curve, { len });
  }
  const gable = (w, h, len, r = 0.1) => prism([[-w / 2, 0], [w / 2, 0], [0, h]], [r, r, r * 1.6], len, 0.05);
  function windowPane(parent, w, h, p, rotY = 0, frame = PAL.cream) {
    const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]); g.rotation.y = rotY; parent.add(g);
    box(g, w + 0.12, h + 0.12, 0.07, frame, [0, 0, 0], 0.03);
    const m = lampPaint(); decal(g, w, h, 0.04, m, [0, 0, 0.04]); box(g, 0.035, h, 0.02, frame, [0, 0, 0.045], 0.008);
    return m;
  }
  function peg(parent, color, hat) {
    const g = new THREE.Group(); parent.add(g);
    const body = new THREE.LatheGeometry([[0, 0], [0.15, 0], [0.185, 0.04], [0.17, 0.3], [0.12, 0.43], [0, 0.46]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
    put(g, body, color); put(g, new THREE.SphereGeometry(0.15, 20, 14), PAL.skin, [0, 0.58, 0]);
    if (hat === 'cap') { put(g, new THREE.SphereGeometry(0.158, 20, 10, 0, 7, 0, 1.25), color, [0, 0.6, 0]); box(g, 0.2, 0.03, 0.14, color, [0, 0.64, 0.15], 0.012); }
    if (hat === 'helmet') put(g, new THREE.SphereGeometry(0.17, 20, 10, 0, 7, 0, 1.5), PAL.mustard, [0, 0.6, 0]);
    if (hat === 'hair') put(g, new THREE.SphereGeometry(0.162, 20, 10, 0, 7, 0, 1.75), PAL.trunk, [0, 0.59, -0.012], [-0.35, 0, 0]);
    return g;
  }
  function tree(parent, x, z, s, kind, y = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
    put(g, new THREE.CylinderGeometry(0.06, 0.09, 0.6, 10), PAL.trunk, [0, 0.3, 0]);
    if (kind === 'fir') {
      put(g, new THREE.LatheGeometry([[0, 0.38], [0.4, 0.4], [0.5, 0.52], [0.47, 0.72], [0.3, 1.2], [0.1, 1.68], [0, 1.75]].map(([a, b]) => new THREE.Vector2(a, b)), 22), PAL.leaf[1]);
    } else {
      put(g, new THREE.SphereGeometry(0.52, 24, 16), PAL.leaf[kind === 'pale' ? 2 : 0], [0, 0.98, 0]).scale.set(1, 0.92, 1);
      put(g, new THREE.SphereGeometry(0.3, 20, 14), PAL.leaf[kind === 'pale' ? 2 : 0], [0.3, 0.74, 0.22]);
    }
    return g;
  }
  function sign(parent, word, number) {
    const g = new THREE.Group(), flip = new THREE.Group(); parent.add(g); g.add(flip);
    const PX = 380, SPACING = 0.05, m = document.createElement('canvas').getContext('2d'); m.font = FONT; m.letterSpacing = SPACING * 160 + 'px';
    const capPx = m.measureText('H').actualBoundingBoxAscent, k = 0.3 * PX / capPx, textW = m.measureText(word).width * k / PX;
    const bh = 0.62, coin = 0.4, bw = textW + coin * 2 + 0.34, tx = -bw / 2 + coin * 2 + 0.08;
    const face = (bg, fg) => new THREE.MeshStandardMaterial({ roughness: 0.8, map: K.canvasTex(Math.round(bw * PX), Math.round(bh * PX), (ctx, W, Hh) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh); ctx.fillStyle = fg; ctx.font = FONT.replace('160px', 160 * k + 'px'); ctx.letterSpacing = SPACING * 160 * k + 'px'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(word, (tx + bw / 2) * PX, Hh / 2 + 0.15 * PX);
    }) });
    const disc = (bg, fg) => new THREE.MeshStandardMaterial({ roughness: 0.8, map: K.canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = fg; ctx.font = FONT.replace('160px', '190px'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const mm = ctx.measureText(String(number)); ctx.fillText(String(number), 128, 128 + mm.actualBoundingBoxAscent / 2);
    }) });
    box(flip, bw, bh, 0.1, PAL.cream, [0, 0, 0], 0.05);
    put(flip, new THREE.CylinderGeometry(coin + 0.07, coin + 0.07, 0.16, 40), PAL.cream, [-bw / 2 + coin, 0, 0], [Math.PI / 2, 0, 0]);
    for (const [side, bg, fg, cbg, cfg] of [[1, '#ece8df', '#7d8996', '#aab3bd', '#f4f1ea'], [-1, PAL.accent, '#fff6e6', '#fff6e6', PAL.accent]]) {
      const s = new THREE.Group(); s.rotation.x = side > 0 ? 0 : Math.PI; flip.add(s);
      decal(s, bw - 0.09, bh - 0.09, 0.03, face(bg, fg), [0, 0, 0.052]);
      put(s, new THREE.CircleGeometry(coin, 40), disc(cbg, cfg), [-bw / 2 + coin, 0, 0.082], null, false);
    }
    const pole = put(g, new THREE.CylinderGeometry(0.05, 0.06, 1, 12), PAL.cream, [0, 0, -0.1]);
    put(g, new THREE.CylinderGeometry(0.13, 0.15, 0.08, 16), PAL.slate, [0, 0.04, -0.1]);
    return { g, flip, pole, setHeight(h) { flip.position.y = h; pole.scale.y = h; pole.position.y = h / 2; } };
  }
  function van(parent, color) {
    const g = new THREE.Group(), body = new THREE.Group(); parent.add(g); g.add(body);
    put(body, prism([[-0.92, 0.2], [0.92, 0.2], [0.94, 0.52], [0.68, 0.61], [0.4, 1.05], [-0.92, 1.05]], [0.08, 0.1, 0.1, 0.05, 0.14, 0.12], 0.86, 0.06), color);
    const glass = paint(PAL.glass, 0.6), n = new THREE.Vector3(0.44, 0.28, 0).normalize();
    const ws = decal(body, 0.66, 0.38, 0.07, glass, [0.54 + n.x * 0.012, 0.835 + n.y * 0.012, 0]); ws.lookAt(ws.position.clone().add(n));
    for (const s of [1, -1]) {
      const rot = [0, s > 0 ? 0 : Math.PI, 0];
      decal(body, 0.3, 0.26, 0.05, glass, [0.2, 0.83, s * 0.432], rot);
      decal(body, 1.5, 0.09, 0.03, PAL.cream, [-0.1, 0.44, s * 0.432], rot);
      decal(body, 0.46, 0.34, 0.05, PAL.cream, [-0.42, 0.78, s * 0.432], rot);
      // a painted envelope on the side: the mail van
      box(body, 0.26, 0.17, 0.012, PAL.newsprint, [-0.42, 0.775, s * 0.436], 0.01);
      const v = new THREE.Group(); v.position.set(-0.42, 0.83, s * 0.443); v.rotation.y = s > 0 ? 0 : Math.PI; body.add(v);
      for (const d of [1, -1]) box(v, 0.15, 0.022, 0.006, color, [d * 0.062, -0.035, 0], 0.004, [0, 0, d * -0.5]);
    }
    box(body, 0.09, 0.1, 0.82, PAL.slate, [0.93, 0.27, 0], 0.03); box(body, 0.09, 0.1, 0.82, PAL.slate, [-0.92, 0.25, 0], 0.03);
    const lamps = lampPaint('#fff3d6', '#fff0c8'); for (const s of [1, -1]) put(body, new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16), lamps, [0.945, 0.42, s * 0.28], [0, 0, Math.PI / 2]);
    decal(body, 0.72, 0.62, 0.05, PAL.dark, [-0.923, 0.64, 0], [0, -Math.PI / 2, 0]);
    const hatch = new THREE.Group(); hatch.position.set(-0.94, 1.0, 0); body.add(hatch);
    box(hatch, 0.05, 0.74, 0.76, color, [0, -0.37, 0], 0.025); box(hatch, 0.02, 0.2, 0.44, PAL.glass, [-0.02, -0.2, 0], 0.01);
    const wheels = [];
    for (const [x, z] of [[0.56, 0.37], [0.56, -0.37], [-0.56, 0.37], [-0.56, -0.37]]) {
      const w = new THREE.Group(); w.position.set(x, 0.2, z); g.add(w); wheels.push(w);
      put(w, new THREE.CylinderGeometry(0.2, 0.2, 0.17, 24), PAL.dark, [0, 0, 0], [Math.PI / 2, 0, 0]);
      put(w, new THREE.CylinderGeometry(0.1, 0.1, 0.19, 16), PAL.cream, [0, 0, 0], [Math.PI / 2, 0, 0]);
      put(w, new THREE.CylinderGeometry(0.028, 0.028, 0.2, 8), PAL.dark, [0.055, 0, 0], [Math.PI / 2, 0, 0]);
    }
    return { g, body, hatch, wheels, lamps };
  }
  function puffs(parent, count) {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), paint(PAL.smoke, 0.95), count); m.castShadow = true; m.frustumCulled = false; parent.add(m);
    return { mesh: m, set(i, at, age, o) {
      const s = age <= 0 || age >= 1 ? 0 : o.size * K.smooth(0, 0.3, age) * (1 - K.smooth(0.55, 1, age)) * (0.7 + 0.5 * age);
      K.place(m, i, [at[0] + (o.drift || 0) * age * age, at[1] + o.rise * age, at[2] + (o.driftZ || 0) * age], null, Math.max(s, 1e-4));
    } };
  }
  const trap = (u, a, b) => { u = K.clamp(u); const v = 1 / (1 - a / 2 - b / 2); return u < a ? v * u * u / (2 * a) : u < 1 - b ? v * (u - a / 2) : 1 - v * (1 - u) * (1 - u) / (2 * b); };
  const hop = (t, t0, len, from, to, height) => { const u = K.clamp((t - t0) / len), e = K.ease.inOut(u), land = t - t0 - len; return [from[0] + (to[0] - from[0]) * e, height * Math.sin(Math.PI * u), from[1] + (to[1] - from[1]) * e, land > 0 ? Math.exp(-land * 14) * Math.sin(land * 30) * 0.12 : 0]; };

