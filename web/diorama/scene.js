// Built from ui/diorama-wip by build.py. Do not edit here.
{
  // ---------------------------------------------------------------- content (The Sausage Gazette: one day, fetch to apply)
  // Three stops on one tile: the press that prints the Gazette, your house (where the dachshund lives) and the
  // hiring office. Each stop has a sign that starts grey and flips to the accent colour when its part is done.
  // Tile coordinates: x left to right, z back (-) to front (+), y up, 0 = the grass.
  const SIGNS = [
    { word: 'GAZETTE PRESS', at: [-3.2, -2.9], h: 2.85 },
    { word: 'YOUR HOUSE', at: [0.95, -0.95], h: 2.55 },
    { word: 'HIRING OFFICE', at: [5.15, -3.0], h: 3.05 },
  ];
  const TILE = { w: 12.6, d: 8.2, r: 1.0 }, FLOOR = -3.5;
  // the road leaves the press at the back left, swings forward past your house and climbs to the office at the back right
  const ROAD = [[-2.3, -1.7], [-1.2, -1.7], [-0.3, -1.45], [0.15, -0.75], [0.05, 0.3], [-0.1, 1.3], [0.35, 2.2], [1.3, 2.68], [2.5, 2.72], [3.4, 2.5], [3.9, 1.75], [3.75, 0.7], [3.55, -0.05], [3.48, -0.4]];
  const PRESS = { x: -3.9, z: -1.8, w: 3.0, d: 3.2, h: 1.5 }, DOOR_Z = -1.7;
  const HOME = { x: 1.9, z: 0.3, w: 2.0, d: 1.8, h: 1.35 };   // front wall at z 1.2
  const OFFICE = { x: 4.7, z: -2.55, w: 2.3, d: 1.7 };
  const MAT = [1.9, 1.58];                 // the doormat where the dachshund naps
  const BOX = [0.85, 1.72];                // the letterbox at the left of the porch
  const TW = [2.86, 1.46];                 // the little typewriter at the right end of the step, keys facing the dog
  const SLOT = [4.72, 1.0, -1.66];         // the office door's mail slot

  const PAL = {
    backdrop: '#b4d2de', evening: '#7c8fbd', grass: '#9fc47c', leaf: ['#5fa574', '#3f866c', '#84ba6b'], trunk: '#8b5b3e',
    earth: ['#5c4135', '#8f6248', '#c9955f', '#7c7f8e'], stone: ['#a9a9b0', '#d9cdb8', '#8d8f9c'],
    cream: '#f6ebd8', slate: '#44718a', mustard: '#f0b040', accent: '#e9573f', glass: '#2c4658', dark: '#272b36',
    road: '#6e7080', kraft: '#cb9c68', skin: '#f2c8a2', smoke: '#ffffff', water: '#8fd0e0', lampGlow: '#ffc56e',
    dog: '#c47a3d', ear: '#7e4524', newsprint: '#f3eee2',
  };
  const FONT = '600 160px "Fredoka"';

  // ---------------------------------------------------------------- one schedule for picture and sound
  // In the app each stage plays its own beats: /scrape = 1-2, /rank = 3, /apply = 4 (then the flag stays up),
  // and 5-6 only after you confirm you applied on the job site.
  const T = {
    push: 0.3, inVan: 1.0, shut: 1.2, rollDown: [1.6, 2.3],      // 1: the Gazette rolls off the press into the van
    go1: 1.5, arrive1: 3.4,                                       // 2: drive to your house
    out1: 3.55, hop1: 3.8, drop: 4.12, back1: 4.3, inVan1: 4.6,   //    the mailman leaves it on the mat
    wake: 4.25, stand: 4.6, fetch: [4.72, 5.0], sit: 5.25, unroll: [5.3, 5.55],
    cards: [5.55, 5.7, 5.85], stamps: [6.05, 6.25, 6.45], ring: [6.75, 7.25], fall: [7.35, 7.6], toTW: [7.45, 7.9],   // 3: scored; you circle one
    toType: [7.65, 7.95], typing: [8.0, 9.15], pages: [8.1, 8.6], fold: [9.2, 9.45], grab: 9.5,                          // 4: the CV and letter get typed
    trot: [9.55, 10.05], rear: [10.05, 10.5], post: 10.32, flag: 10.4, home: [10.5, 10.95], nap: [10.95, 11.15],
    door: [11.3, 13.55], youOut: 11.4, you: [11.6, 11.85], take: 12.05, wave: [12.55, 12.8], youBack: [13.05, 13.3],     // 5: you send it
    out1b: 11.7, mail: [11.95, 12.2], hand: 12.36, mailBack: [12.5, 12.75], inVan2: 13.0,
    go2: 13.1, arrive2: 14.6,                                     // 6: delivered at dusk
    out2: 14.75, hops2: [14.95, 15.2], slot: 15.47, lamp: 14.7, lights: 15.67,
  };
  const FLIPS = [T.shut + 0.1, T.drop + 0.13, T.slot + 0.1];
  const BEATS = [
    { t0: 0, t1: 2.6, tag: 'FETCH', text: 'The Gazette goes to press' },
    { t0: 2.6, t1: 5.25, tag: 'FETCH', text: 'The mailman brings it to your door' },
    { t0: 5.25, t1: 7.6, tag: 'RANK', text: 'Scored for you. You circle your pick.' },
    { t0: 7.6, t1: 11.2, tag: 'TAILOR', text: 'Your pup types up your CV and letter' },
    { t0: 11.2, t1: 13.6, tag: 'YOU APPLY', text: 'You apply on the job site. Off it goes.' },
    { t0: 13.6, t1: 17.0, tag: 'SENT', text: 'Sent. Time for a nap.' },
  ];
  const DURATION = 17;

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

  // NEW PIECES FOR THIS STORY ---------------------------------------
  // The dachshund: a long capsule body on four stubby legs, a round head with a long snout, floppy ears, a tail.
  function dachshund(parent) {
    const g = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group(), tail = new THREE.Group(); parent.add(g); g.add(torso); torso.add(head); torso.add(tail); g.scale.setScalar(1.6);
    const fur = paint(PAL.dog, 0.9), earP = paint(PAL.ear, 0.9);
    put(torso, new THREE.CapsuleGeometry(0.1, 0.36, 8, 18), fur, [0, 0, 0], [0, 0, Math.PI / 2]);
    put(torso, new THREE.SphereGeometry(0.112, 20, 14), fur, [0.15, -0.006, 0]);
    head.position.set(0.27, 0.09, 0);
    put(head, new THREE.SphereGeometry(0.094, 22, 16), fur);
    put(head, new THREE.CapsuleGeometry(0.048, 0.1, 6, 14), fur, [0.1, -0.028, 0], [0, 0, Math.PI / 2]);
    put(head, new THREE.SphereGeometry(0.028, 12, 10), PAL.dark, [0.178, -0.024, 0]);
    const eyes = [1, -1].map((s) => put(head, new THREE.SphereGeometry(0.016, 10, 8), PAL.dark, [0.055, 0.03, s * 0.066]));
    const ears = [1, -1].map((s) => { const e = new THREE.Group(); e.position.set(-0.015, 0.03, s * 0.085); head.add(e); put(e, new THREE.SphereGeometry(1, 16, 12), earP, [0, -0.07, s * 0.012]).scale.set(0.048, 0.085, 0.024); return e; });
    tail.position.set(-0.27, 0.04, 0);
    put(tail, new THREE.CylinderGeometry(0.012, 0.024, 0.17, 10), fur, [0, 0.085, 0]);
    const legs = [[0.16, 0.065], [0.16, -0.065], [-0.17, 0.065], [-0.17, -0.065]].map(([x, z]) => {
      const l = new THREE.Group(); l.position.set(x, -0.05, z); torso.add(l);
      put(l, new THREE.CylinderGeometry(0.03, 0.034, 0.14, 12), fur, [0, -0.07, 0]); put(l, new THREE.SphereGeometry(0.036, 12, 8), fur, [0.01, -0.14, 0]).scale.set(1.2, 0.6, 1);
      return l;
    });
    const mouth = new THREE.Group(); mouth.position.set(0.15, -0.07, 0); head.add(mouth);
    function pose(p) {
      const lie = p.lie || 0, rear = p.rear || 0, walkAmt = p.walking ? 1 : 0, ph = p.walk || 0;
      g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw || 0;
      const breath = (p.sleep ? 0.006 : 0.003) * Math.sin(p.t * (p.sleep ? 2.4 : 4.5));
      torso.position.set(0, 0.2 - 0.088 * lie + 0.11 * rear + 0.012 * walkAmt * Math.abs(Math.sin(ph)) + breath, 0);
      torso.rotation.set(0, 0, (p.pitch || 0) + 0.8 * rear);
      legs.forEach((l, i) => {
        const front = i < 2, swing = walkAmt * 0.6 * Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI));
        l.rotation.z = swing + (lie > 0 ? (front ? -1.2 : 1.2) * lie : 0) - (front ? 0 : 0.6 * (p.sitAmt || 0)) - (front ? 0.5 * rear : -0.4 * rear) + (front ? (p.paw || 0) : 0);
        l.scale.y = 1 - 0.45 * lie;
      });
      head.rotation.set(0, 0, -0.35 * lie * (1 - (p.headUp || 0)) + (p.headTilt || 0) - 0.7 * rear);
      head.position.y = 0.09 - 0.03 * lie * (1 - (p.headUp || 0));
      eyes.forEach((e) => e.scale.set(1, p.sleep ? 0.18 : 1, 1));
      ears.forEach((e, i) => { e.rotation.x = (i ? -1 : 1) * (0.12 + (p.perk || 0) * 0.35 + walkAmt * 0.15 * Math.sin(ph * 2)); });
      tail.rotation.set((p.wag || 0) * Math.sin(p.t * 22), 0, 0.75 - 0.5 * lie);
    }
    return { g, torso, head, mouth, pose };
  }
  function gazetteRoll(parent) {
    const g = new THREE.Group(); parent.add(g);
    put(g, new THREE.CylinderGeometry(0.06, 0.06, 0.36, 20), PAL.newsprint, [0, 0, 0], [0, 0, Math.PI / 2]);
    put(g, new THREE.CylinderGeometry(0.063, 0.063, 0.06, 20), PAL.accent, [0, 0, 0], [0, 0, Math.PI / 2]);
    put(g, new THREE.CircleGeometry(0.058, 20), paint('#ddd5c4'), [0.181, 0, 0], [0, Math.PI / 2, 0]);
    return g;
  }
  function gazetteSheet(parent) {
    const g = new THREE.Group(); parent.add(g);
    const tex = K.canvasTex(1024, 704, (ctx, W, H) => {
      ctx.fillStyle = PAL.newsprint; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2a2620'; ctx.font = FONT.replace('160px', '86px'); ctx.textAlign = 'center'; ctx.fillText('The Sausage Gazette', W / 2, 108);
      ctx.fillRect(40, 136, W - 80, 6); ctx.fillRect(40, 150, W - 80, 2);
      ctx.font = FONT.replace('160px', '40px'); ctx.fillText('CLASSIFIEDS', W / 2, 206);
      for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) { const x = 60 + c * 312, y = 240 + r * 110; ctx.fillStyle = 'rgba(42,38,32,0.8)'; ctx.fillRect(x, y, 200, 16); ctx.fillStyle = 'rgba(42,38,32,0.35)'; ctx.fillRect(x, y + 30, 270, 10); ctx.fillRect(x, y + 50, 240, 10); }
    });
    put(g, K.roundedBox(0.62, 0.012, 0.43, 0.005, 2), PAL.newsprint);
    decal(g, 0.6, 0.41, 0.004, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), [0, 0.0075, 0], [-Math.PI / 2, 0, 0]);
    return g;
  }
  // A classified ad card; its fit score arrives as a separate red rubber stamp.
  function adCard(parent, title, score) {
    const g = new THREE.Group(); parent.add(g);
    box(g, 0.74, 0.5, 0.05, PAL.newsprint, [0, 0, 0], 0.03);
    decal(g, 0.7, 0.46, 0.025, new THREE.MeshStandardMaterial({ roughness: 0.85, map: K.canvasTex(560, 368, (ctx, W, H) => {
      ctx.fillStyle = PAL.newsprint; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2a2620'; ctx.font = FONT.replace('160px', '76px'); ctx.fillText(title, 36, 96);
      ctx.fillStyle = 'rgba(42,38,32,0.3)'; ctx.fillRect(36, 128, 470, 14); ctx.fillRect(36, 156, 400, 14); ctx.fillRect(36, 184, 430, 14);
    }) }), [0, 0, 0.027]);
    const stamp = new THREE.Group(); stamp.position.set(-0.03, -0.1, 0.034); g.add(stamp);
    decal(stamp, 0.5, 0.2, 0.03, new THREE.MeshStandardMaterial({ roughness: 0.8, transparent: true, map: K.canvasTex(500, 200, (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H); ctx.strokeStyle = PAL.accent; ctx.lineWidth = 12; ctx.beginPath(); ctx.roundRect(8, 8, W - 16, H - 16, 26); ctx.stroke();
      ctx.fillStyle = PAL.accent; ctx.font = FONT.replace('160px', '128px'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FIT ' + score, W / 2, H / 2 + 8);
    }) }), [0, 0, 0]);
    return { g, stamp };
  }
  // A typed page that pops up out of the typewriter: the tailored CV or the cover letter.
  function pageCard(parent, title) {
    const g = new THREE.Group(); parent.add(g);
    box(g, 0.5, 0.66, 0.03, '#fffaf0', [0, 0, 0], 0.02);
    decal(g, 0.47, 0.63, 0.015, new THREE.MeshStandardMaterial({ roughness: 0.85, map: K.canvasTex(376, 504, (ctx, W, H) => {
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2a2620'; ctx.font = FONT.replace('160px', title.length > 4 ? '50px' : '96px'); ctx.textAlign = 'center'; ctx.fillText(title, W / 2, title.length > 4 ? 82 : 110);
      ctx.fillStyle = PAL.accent; ctx.fillRect(40, title.length > 4 ? 108 : 140, W - 80, 7);
      ctx.fillStyle = 'rgba(42,38,32,0.32)'; for (let i = 0; i < 8; i++) ctx.fillRect(40, 170 + i * 38, (i % 3 === 2 ? 0.6 : 0.9) * (W - 80), 12);
    }) }), [0, 0, 0.017]);
    return g;
  }
  function envelope(parent) {
    const g = new THREE.Group(); parent.add(g);
    box(g, 0.32, 0.21, 0.028, PAL.accent, [0, 0, 0], 0.012);
    for (const s of [1, -1]) box(g, 0.19, 0.016, 0.006, '#fff1e4', [s * 0.078, 0.03, 0.016], 0.004, [0, 0, s * -0.55]);
    return g;
  }
  // A little typewriter: slate body, rows of dark keys toward local +z, a cream roller on top.
  function typewriter(parent) {
    const g = new THREE.Group(); parent.add(g);
    box(g, 0.46, 0.13, 0.34, PAL.slate, [0, 0.075, 0], 0.04);
    box(g, 0.42, 0.08, 0.14, PAL.slate, [0, 0.17, -0.08], 0.035);
    put(g, new THREE.CylinderGeometry(0.035, 0.035, 0.5, 16), PAL.dark, [0, 0.22, -0.1], [0, 0, Math.PI / 2]);
    box(g, 0.34, 0.12, 0.012, PAL.cream, [0, 0.29, -0.12], 0.005, [-0.25, 0, 0]);
    const keys = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), paint(PAL.dark, 0.6), 24); keys.castShadow = true; g.add(keys);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) K.place(keys, r * 8 + c, [-0.16 + c * 0.046 + (r % 2) * 0.02, 0.15 + r * 0.012, 0.13 - r * 0.045], null, 1);
    return g;
  }

  registerStyle({
    id: 'sausage-gazette-diorama',
    name: 'Tiny Diorama: The Sausage Gazette',
    family: 'Spaces and journeys',
    topic: 'How the Sausage Gazette helps you apply: fetch, rank, tailor, you apply',
    duration: DURATION,
    beats: BEATS, schedule: T,
    fonts: [FONT],
    render: { samples: 72, shutter: 0.5, tone: 'neutral', exposure: 1.0, bloom: 0.3, bloomThreshold: 1.05, vignette: 0.2, grain: 0.01, saturation: 1.08, contrast: 1.03, fov: 20, near: 1, far: 300, background: PAL.backdrop },

    build(S) {
      const { THREE, K, scene, camera } = S;

      // live in the app header ("lite"): smaller shadow maps so it can draw every frame
      const lite = typeof window !== 'undefined' && window.__gazetteApp && window.__gazetteApp.lite;
      K.env(S, { top: '#c4dcf2', horizon: '#f2e8da', bottom: '#9db39a', intensity: 0.4 });
      const sun = K.sun(S, { pos: [-9, 13, 9], color: '#ffe3c0', power: 3.3, size: 12, soft: 1.3, mapSize: lite ? 1024 : 4096, far: 70 });
      const sky = K.skyLight(S, { color: '#bcd3ff', power: 0.95, size: 11, center: [0, 0, 0], mapSize: lite ? 512 : 2048 });
      const paper = new THREE.MeshBasicMaterial({ color: PAL.backdrop }); put(scene, new THREE.PlaneGeometry(300, 300), paper, [0, FLOOR, 0], [-Math.PI / 2, 0, 0], false);
      const shade = put(scene, new THREE.PlaneGeometry(TILE.w + 8, TILE.d + 8), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: K.canvasTex(512, 512, (ctx, W) => {
        const sx = W / (TILE.w + 8), sz = W / (TILE.d + 8); ctx.filter = 'blur(26px)'; ctx.fillStyle = 'rgba(38,62,92,0.55)';
        ctx.beginPath(); ctx.roundRect(4 * sx, 4 * sz, TILE.w * sx, TILE.d * sz, 50); ctx.fill();
      }) }), [1.6, FLOOR + 0.02, -1.0], [-Math.PI / 2, 0, 0], false);

      const world = new THREE.Group(); scene.add(world);
      const land = tile(world, TILE);
      const roadTex = K.canvasTex(256, 128, (ctx, W, H) => { ctx.fillStyle = PAL.road; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#f3ead8'; ctx.fillRect(40, H / 2 - 5, 120, 10); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(0, 12, W, 5); ctx.fillRect(0, H - 17, W, 5); }, { repeat: [1, 1] });
      roadTex.wrapS = THREE.RepeatWrapping;
      const road = ribbon(land, ROAD, { width: 1.14, texture: roadTex, period: 0.8 });
      const distNear = (x, z) => { let best = 0, bd = 1e9; for (let i = 0; i <= 800; i++) { const p = road.getPointAt(i / 800), d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = i / 800 * road.len; } } return best; };
      const S0 = distNear(-0.55, -1.6), S1 = distNear(3.72, 2.1), S2 = road.len - 0.04;

      // ---- stop 1: the Gazette press
      const press = new THREE.Group(); press.position.set(PRESS.x, 0, PRESS.z); land.add(press);
      put(press, loft(ring(PRESS.w + 0.24, PRESS.d + 0.24, 0.16), [...lip(0.05, 0.12), [0, 0, Math.PI / 2]]), PAL.slate);
      box(press, PRESS.w, PRESS.h, PRESS.d, PAL.cream, [0, PRESS.h / 2 + 0.08, 0], 0.09);
      const pressGlass = lampPaint(PAL.glass, '#ffe2a8');
      for (let i = -1; i <= 1; i++) {
        put(press, prism([[-0.52, 0], [0.52, 0], [0.52, 0.56]], [0.05, 0.07, 0.08], PRESS.d + 0.12, 0.05), PAL.slate, [i * 1.0, PRESS.h + 0.06, 0]);
        decal(press, PRESS.d - 0.5, 0.26, 0.05, pressGlass, [i * 1.0 + 0.525, PRESS.h + 0.34, 0], [0, Math.PI / 2, 0]);
      }
      const fx = PRESS.w / 2, dz = DOOR_Z - PRESS.z;
      box(press, 0.12, 1.34, 1.72, PAL.mustard, [fx, 0.75, dz], 0.05);
      decal(press, 1.44, 1.14, 0.04, PAL.dark, [fx + 0.062, 0.69, dz], [0, Math.PI / 2, 0]);
      const slats = K.canvasTex(64, 64, (ctx) => { ctx.fillStyle = '#e9dcc4'; ctx.fillRect(0, 0, 64, 64); ctx.fillStyle = 'rgba(90,70,50,0.35)'; ctx.fillRect(0, 0, 64, 9); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 9, 64, 6); }, { repeat: [1, 7] });
      const rollGeo = new THREE.PlaneGeometry(1.44, 1.14); rollGeo.translate(0, -0.57, 0);
      const rollDoor = put(press, rollGeo, new THREE.MeshStandardMaterial({ map: slats, roughness: 0.7 }), [fx + 0.068, 1.26, dz], [0, Math.PI / 2, 0], false);
      box(press, 0.2, 0.2, 1.76, PAL.mustard, [fx + 0.03, 1.36, dz], 0.06);
      const zf = PRESS.d / 2;
      const pressWin = [windowPane(press, 0.5, 0.42, [-0.95, 0.98, zf + 0.01]), windowPane(press, 0.5, 0.42, [-0.2, 0.98, zf + 0.01])];
      decal(press, 0.78, 0.78, 0.12, PAL.slate, [0.85, 0.85, zf + 0.004]); box(press, 0.46, 0.34, 0.025, PAL.newsprint, [0.85, 0.85, zf + 0.012], 0.015);
      for (let i = 0; i < 4; i++) box(press, i ? 0.34 : 0.38, i ? 0.03 : 0.05, 0.03, i ? '#b9b2a2' : PAL.dark, [0.85 - (i ? 0.02 : 0), 0.95 - i * 0.07, zf + 0.022], 0.008);
      put(press, new THREE.CylinderGeometry(0.13, 0.15, 0.8, 16), PAL.slate, [-1.25, PRESS.h + 0.6, 1.05]); put(press, new THREE.CylinderGeometry(0.17, 0.17, 0.07, 16), PAL.cream, [-1.25, PRESS.h + 1.0, 1.05]);
      const STACK = [PRESS.x - 1.25, PRESS.h + 1.08, PRESS.z + 1.05];
      const bigRoll = new THREE.Group(); bigRoll.position.set(-4.1, 0.32, 0.25); land.add(bigRoll);
      put(bigRoll, new THREE.CylinderGeometry(0.32, 0.32, 0.7, 32), PAL.newsprint, [0, 0, 0], [0, 0, Math.PI / 2]);
      put(bigRoll, new THREE.CylinderGeometry(0.1, 0.1, 0.72, 16), PAL.kraft, [0, 0, 0], [0, 0, Math.PI / 2]);
      const CONV = { x0: PRESS.x + fx + 0.1, x1: -1.56, y: 0.5 }, conv = new THREE.Group(); land.add(conv);
      box(conv, CONV.x1 - CONV.x0, 0.1, 0.62, PAL.slate, [(CONV.x0 + CONV.x1) / 2, CONV.y - 0.07, DOOR_Z], 0.04);
      for (const x of [CONV.x0 + 0.12, CONV.x1 - 0.1]) for (const s of [1, -1]) box(conv, 0.07, CONV.y - 0.1, 0.07, PAL.slate, [x, (CONV.y - 0.1) / 2, DOOR_Z + s * 0.24], 0.02);
      const rollers = []; for (let i = 0; i < 6; i++) rollers.push(put(conv, new THREE.CylinderGeometry(0.045, 0.045, 0.56, 12), PAL.cream, [CONV.x0 + 0.1 + i * (CONV.x1 - CONV.x0 - 0.2) / 5, CONV.y - 0.01, DOOR_Z], [Math.PI / 2, 0, 0]));
      const bundleGeo = K.roundedBox(0.44, 0.24, 0.32, 0.03, 3), twineGeo = K.roundedBox(0.05, 0.246, 0.326, 0.008, 2);
      const bundle = (p, ry = 0, s = 1) => { const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]); g.rotation.y = ry; g.scale.setScalar(s); land.add(g); put(g, bundleGeo, PAL.newsprint); put(g, twineGeo, PAL.accent); return g; };
      bundle([-4.75, 0.12, 0.2], 0.3); bundle([-5.2, 0.12, 0.35], -0.15, 1.1); bundle([-4.95, 0.36, 0.25], 0.1, 0.9);
      const printer = peg(land, PAL.slate, 'helmet');

      // ---- stop 2: your house, with a porch, a doormat, a letterbox, a typewriter and a lamp
      const home = new THREE.Group(); home.position.set(HOME.x, 0, HOME.z); land.add(home);
      put(home, loft(ring(HOME.w + 0.22, HOME.d + 0.22, 0.16), [...lip(0.05, 0.1), [0, 0, Math.PI / 2]]), PAL.stone[1]);
      box(home, HOME.w, HOME.h, HOME.d, PAL.cream, [0, HOME.h / 2 + 0.06, 0], 0.09);
      put(home, gable(HOME.d + 0.5, 1.0, HOME.w + 0.34), PAL.slate, [0, HOME.h - 0.02, 0], [0, Math.PI / 2, 0]);
      box(home, 0.3, 0.75, 0.3, PAL.cream, [0.62, HOME.h + 0.45, -0.25], 0.05); box(home, 0.38, 0.09, 0.38, PAL.slate, [0.62, HOME.h + 0.85, -0.25], 0.03);
      const CHIM = [HOME.x + 0.62, HOME.h + 0.93, HOME.z - 0.25];
      const hz = HOME.d / 2, homeWin = [windowPane(home, 0.4, 0.42, [-0.62, 0.8, hz + 0.01], 0, PAL.slate), windowPane(home, 0.4, 0.42, [0.62, 0.8, hz + 0.01], 0, PAL.slate)];
      box(home, 0.7, 1.0, 0.08, PAL.slate, [0, 0.55, hz + 0.01], 0.04);
      const doorway = lampPaint(PAL.dark, '#ffca7a'); decal(home, 0.54, 0.88, 0.04, doorway, [0, 0.52, hz + 0.052]);
      const door = new THREE.Group(); door.position.set(-0.27, 0.52, hz + 0.06); home.add(door);
      box(door, 0.54, 0.88, 0.05, PAL.mustard, [0.27, 0, 0], 0.025); put(door, new THREE.SphereGeometry(0.035, 10, 8), PAL.cream, [0.45, -0.02, 0.035]);
      box(land, 1.9, 0.07, 0.74, PAL.stone[1], [MAT[0] + 0.1, 0.035, MAT[1] - 0.02], 0.03); box(land, 1.3, 0.03, 0.5, PAL.slate, [MAT[0] - 0.25, 0.08, MAT[1]], 0.012);
      const tw = typewriter(land); tw.position.set(TW[0], 0.07, TW[1]); tw.rotation.y = -Math.PI / 2;
      const lb = new THREE.Group(); lb.position.set(BOX[0], 0, BOX[1]); land.add(lb);
      box(lb, 0.08, 0.44, 0.08, PAL.slate, [0, 0.22, 0], 0.02); box(lb, 0.36, 0.24, 0.24, PAL.mustard, [0, 0.54, 0], 0.07);
      put(lb, new THREE.CircleGeometry(0.06, 20), paint(PAL.dark), [0.181, 0.56, 0], [0, Math.PI / 2, 0], false);
      const flag = new THREE.Group(); flag.position.set(0.05, 0.5, 0.125); lb.add(flag);
      box(flag, 0.03, 0.22, 0.02, PAL.slate, [0, 0.1, 0], 0.008); box(flag, 0.1, 0.07, 0.022, PAL.accent, [0.05, 0.18, 0], 0.01);
      const lamp = new THREE.Group(); lamp.position.set(3.25, 0, 1.15); land.add(lamp);
      put(lamp, new THREE.CylinderGeometry(0.04, 0.055, 1.25, 10), PAL.slate, [0, 0.625, 0]); put(lamp, new THREE.CylinderGeometry(0.1, 0.07, 0.07, 12), PAL.slate, [0, 1.27, 0]);
      const bulb = lampPaint('#fff4dd', PAL.lampGlow); put(lamp, new THREE.SphereGeometry(0.13, 16, 12), bulb, [0, 1.42, 0]);
      const lampLight = new THREE.PointLight(PAL.lampGlow, 0, 5, 2); lampLight.position.set(3.25, 1.42, 1.15); land.add(lampLight);
      const porchLight = new THREE.PointLight('#ffb866', 0, 4, 2); porchLight.position.set(MAT[0], 1.3, MAT[1] + 0.5); land.add(porchLight);

      // ---- stop 3: the hiring office
      const office = new THREE.Group(); office.position.set(OFFICE.x, 0, OFFICE.z); land.add(office);
      put(office, loft(ring(OFFICE.w + 0.24, OFFICE.d + 0.24, 0.14), [...lip(0.05, 0.12), [0, 0, Math.PI / 2]]), PAL.stone[1]);
      box(office, OFFICE.w, 1.25, OFFICE.d, PAL.cream, [0, 0.7, 0], 0.08);
      box(office, OFFICE.w + 0.08, 1.0, OFFICE.d + 0.08, PAL.slate, [0, 1.8, 0], 0.08);
      box(office, OFFICE.w + 0.2, 0.1, OFFICE.d + 0.2, PAL.cream, [0, 2.33, 0], 0.04);
      box(office, 0.6, 0.3, 0.5, '#c9cfcc', [-0.5, 2.53, -0.2], 0.05);
      const oz = OFFICE.d / 2, officeWin = [];
      for (const x of [-0.75, 0, 0.75]) officeWin.push(windowPane(office, 0.4, 0.5, [x, 1.82, oz + 0.05]));
      for (const x of [-0.75, 0.75]) officeWin.push(windowPane(office, 0.4, 0.42, [x, 0.82, oz + 0.01]));
      box(office, 0.62, 0.95, 0.08, PAL.slate, [0, 0.52, oz + 0.01], 0.04);
      const officeDoor = lampPaint(PAL.mustard, '#ffca7a'); decal(office, 0.5, 0.84, 0.04, officeDoor, [0, 0.5, oz + 0.052]);
      box(office, 0.24, 0.045, 0.03, PAL.dark, [0, 0.68, oz + 0.07], 0.01);
      const deskLight = new THREE.PointLight('#ffc070', 0, 5, 2); deskLight.position.set(OFFICE.x, 1.4, OFFICE.z + oz + 0.7); land.add(deskLight);
      const clerk = peg(land, PAL.leaf[1], 'hair');

      // ---- the land in between
      const hill = put(land, new THREE.SphereGeometry(1, 40, 20), land.userData.grass, [0.6, -0.75, -3.15]); hill.scale.set(1.9, 1.35, 1.0);
      const hillY = (x, z) => -0.75 + 1.35 * Math.sqrt(Math.max(0, 1 - ((x - 0.6) / 1.9) ** 2 - ((z + 3.15) / 1.0) ** 2));
      for (const [x, z, s, kind] of [[0.2, -3.35, 1.0, 'fir'], [1.1, -3.3, 1.2, 'fir'], [1.9, -3.0, 0.85, 'round'], [-1.1, -3.1, 0.8, 'pale'], [2.95, -1.6, 0.8, 'round'],
        [-5.5, 1.1, 1.1, 'round'], [-4.8, 2.4, 0.95, 'fir'], [-5.35, 3.1, 0.8, 'pale'], [-1.7, 3.3, 0.9, 'round'], [-1.4, 0.4, 0.85, 'fir'], [5.55, 1.5, 0.75, 'pale'], [5.6, 0.2, 0.9, 'fir'], [5.25, 3.35, 0.7, 'pale'], [4.75, 0.55, 0.75, 'pale']]) tree(land, x, z, s, kind, Math.max(0, hillY(x, z) - 0.05));
      for (const [x, z, s] of [[0.6, 0.85, 0.26], [-2.9, -0.05, 0.26], [-3.6, 3.3, 0.32], [0.9, 3.55, 0.26], [4.0, 3.5, 0.3], [5.0, -0.9, 0.26]]) put(land, new THREE.SphereGeometry(1, 18, 12), PAL.leaf[x > 2 ? 0 : 2], [x, s * 0.55, z]).scale.set(s * 1.25, s, s * 1.1);
      const pond = new THREE.Group(); pond.position.set(-3.05, 0, 1.95); pond.rotation.y = 0.2; land.add(pond);
      put(pond, loft(ring(2.5, 1.5, 0.74), [...lip(0.04, 0.05), [0, 0, Math.PI / 2]]), PAL.stone[1]);
      put(pond, loft(ring(2.24, 1.24, 0.61), [[0, 0.062, 0]]), new THREE.MeshStandardMaterial({ color: PAL.water, roughness: 0.3 }), [0, 0, 0], null, false);
      for (const [x, z, s] of [[-0.5, 0.2, 0.15], [-0.28, 0.32, 0.1], [0.55, -0.2, 0.13]]) put(pond, new THREE.CylinderGeometry(s, s, 0.02, 14), PAL.leaf[2], [x, 0.07, z]);
      const duck = new THREE.Group(); pond.add(duck); put(duck, new THREE.SphereGeometry(0.1, 14, 10), '#ffffff', [0, 0.12, 0]).scale.set(1.3, 0.8, 1); put(duck, new THREE.SphereGeometry(0.065, 12, 8), '#ffffff', [0.1, 0.23, 0]); box(duck, 0.07, 0.03, 0.05, PAL.mustard, [0.17, 0.22, 0], 0.012);
      const bench = new THREE.Group(); bench.position.set(-3.1, 0, 3.25); bench.rotation.y = 0.15; land.add(bench);
      box(bench, 0.85, 0.06, 0.28, PAL.kraft, [0, 0.24, 0], 0.025); box(bench, 0.85, 0.2, 0.06, PAL.kraft, [0, 0.42, 0.13], 0.025); for (const x of [-0.32, 0.32]) box(bench, 0.07, 0.24, 0.26, PAL.slate, [x, 0.12, 0], 0.02);
      for (const [x, z, s] of [[-1.45, 2.85, 0.16], [-4.45, 1.3, 0.2], [1.7, 3.6, 0.14], [-0.5, -2.75, 0.15]]) put(land, new THREE.SphereGeometry(1, 12, 8), PAL.stone[0], [x, s * 0.4, z]).scale.set(s * 1.3, s * 0.8, s);
      const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), paint('#ffffff', 0.8), 66), fr = K.rng(21); flowers.castShadow = flowers.receiveShadow = true; land.add(flowers);
      [[-4.2, 3.35], [-1.9, 3.5], [0.85, 1.05], [3.0, 3.6], [-1.7, 0.2], [-1.0, -2.6], [5.9, 2.4], [5.6, -1.1], [-5.75, -0.1], [-4.0, 0.95], [3.4, 0.6]].forEach(([x, z], c) => {
        for (let i = 0; i < 6; i++) { const a = fr.range(0, 6.3), d = fr.range(0.05, 0.36), s = fr.range(0.035, 0.055); K.place(flowers, c * 6 + i, [x + Math.cos(a) * d, Math.max(0, hillY(x, z)) + s * 0.7, z + Math.sin(a) * d], null, [s, s * 0.7, s]); flowers.setColorAt(c * 6 + i, new THREE.Color(fr.pick(['#fff7ea', '#fff7ea', PAL.mustard, '#f7c9c0']))); }
      });

      // ---- the characters and what they carry
      const car = van(land, PAL.accent), mailman = peg(land, PAL.slate, 'cap');
      box(mailman, 0.2, 0.17, 0.08, PAL.accent, [0.17, 0.24, 0.04], 0.03, [0, 0, 0.15]);
      const you = peg(land, PAL.mustard, 'hair');
      const dog = dachshund(land), roll = gazetteRoll(land), sheet = gazetteSheet(land), letter = envelope(land);
      const cardsG = new THREE.Group(); land.add(cardsG);
      const cards = [adCard(cardsG, 'FRONTEND', 61), adCard(cardsG, 'BACKEND', 88), adCard(cardsG, 'DATA', 54)];
      const RING_N = 72, ringDots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), paint(PAL.accent, 0.7), RING_N); ringDots.castShadow = true; cards[1].g.add(ringDots);
      for (let i = 0; i < RING_N; i++) { const a = -0.6 + i / (RING_N - 1) * (Math.PI * 2 + 0.5), r = 1 + 0.04 * Math.sin(i * 0.7); K.place(ringDots, i, [0.48 * r * Math.cos(a), 0.34 * r * Math.sin(a) + 0.01 * i / RING_N, 0.06], null, 0.026); }
      const pages = [pageCard(land, 'CV'), pageCard(land, 'COVER LETTER')];
      const EXH = 6, smoke = puffs(land, 12 + 2 * EXH);
      const exhaust = [...Array.from({ length: EXH }, (_, i) => T.go1 + 0.04 + i * 0.13), ...Array.from({ length: EXH }, (_, i) => T.go2 + 0.04 + i * 0.13)];

      const signs = SIGNS.map((s, i) => { const o = sign(land, s.word, i + 1); o.g.position.set(s.at[0], Math.max(0, hillY(s.at[0], s.at[1])), s.at[1]); o.setHeight(s.h); return o; });

      // ---- where things are at time t
      const vanDist = (t) => t < T.go2 ? S0 + (S1 - S0) * trap((t - T.go1) / (T.arrive1 - T.go1), 0.26, 0.3) : S1 + (S2 - S1) * trap((t - T.go2) / (T.arrive2 - T.go2), 0.28, 0.32);
      const vanAt = (t) => { const u = K.clamp(vanDist(t) / road.len), p = road.getPointAt(u), tg = road.getTangentAt(u); return { p, tg, yaw: Math.atan2(-tg.z, tg.x) }; };
      const DOG_REST = [MAT[0] - 0.45, MAT[1]];                 // napping spot, facing +x
      const SIT_AT = [DOG_REST[0] + 0.25, DOG_REST[1]];         // sitting to read
      const TYPE_AT = [TW[0] - 0.78, TW[1] + 0.04];            // sitting at the typewriter, facing +x
      const PAPER_AT = [MAT[0] + 0.48, 0.13, MAT[1] + 0.14];
      const SHEET_AT = [MAT[0] + 0.5, 0.075, MAT[1] + 0.32];
      const LB_FRONT = [BOX[0] + 0.6, BOX[1] + 0.02];
      const BY_VAN = [3.0, 2.3], AT_MAT = [2.75, 2.12], MID = [2.0, 2.42], HAND = [1.5, 2.36];
      const DOORSTEP = [HOME.x, HOME.z + hz + 0.16], BEHIND = [1.25, HOME.z + hz + 0.2], AT_BOX = [1.06, 2.02];
      const M3 = [[3.98, -0.62], [4.35, -1.1], [4.66, -1.42]];
      const MAIL_MOVES = [
        [T.out1, 0.22, BY_VAN, BY_VAN, 0.3], [T.hop1, 0.24, BY_VAN, AT_MAT, 0.2], [T.back1, 0.24, AT_MAT, BY_VAN, 0.16],
        [T.out1b, 0.22, BY_VAN, BY_VAN, 0.3], [T.mail[0], 0.24, BY_VAN, MID, 0.2], [T.mail[1], 0.24, MID, HAND, 0.2], [T.mailBack[0], 0.24, HAND, MID, 0.2], [T.mailBack[1], 0.24, MID, BY_VAN, 0.2],
        [T.out2, 0.2, M3[0], M3[0], 0.3], [T.hops2[0], 0.22, M3[0], M3[1], 0.2], [T.hops2[1], 0.22, M3[1], M3[2], 0.2],
      ];
      const YOU_MOVES = [
        [T.youOut, 0.2, DOORSTEP, DOORSTEP, 0.22], [T.you[0], 0.24, DOORSTEP, BEHIND, 0.2], [T.you[1], 0.24, BEHIND, AT_BOX, 0.2],
        [T.wave[0], 0.22, AT_BOX, AT_BOX, 0.18], [T.wave[1], 0.22, AT_BOX, AT_BOX, 0.18], [T.youBack[0], 0.24, AT_BOX, BEHIND, 0.2], [T.youBack[1], 0.24, BEHIND, DOORSTEP, 0.2],
      ];
      const moveAt = (moves, t) => { let mv = moves[0]; for (const m of moves) if (t >= m[0]) mv = m; return hop(t, mv[0], mv[1], mv[2], mv[3], mv[4]); };
      const turn = (t) => { const u = t / DURATION; return (-12 + 22 * u * (1.3 - 0.3 * u)) * D2R; };
      const toWorld = (p, th) => [p[0] * Math.cos(th) + p[2] * Math.sin(th), p[1], -p[0] * Math.sin(th) + p[2] * Math.cos(th)];
      const cam = {
        orbit: K.path([[0, [-10, 27, 25]], [4.0, [-6, 28.5, 21.5]], [6.4, [-3, 29.5, 18.5]], [9.5, [-1, 30, 18.5]], [12.3, [1, 30, 19.5]], [14.8, [3, 31, 23]], [DURATION, [4, 31.5, 24]]]),
        aim: K.path([[0, [-1.6, 0.9, -1.0]], [2.4, [-0.2, 0.9, 0.0]], [3.9, [1.7, 0.95, 1.0]], [6.4, [1.8, 1.15, 1.2]], [9.0, [2.0, 1.05, 1.1]], [11.6, [1.5, 0.95, 1.05]], [13.4, [2.0, 0.95, 0.6]], [15.0, [2.8, 0.85, 0.0]], [DURATION, [2.75, 0.7, 0.15]]]),
      };
      const sunCol = new THREE.Color(), cA = new THREE.Color('#ffe6c6'), cB = new THREE.Color('#ffa564'), skyA = new THREE.Color('#bcd3ff'), skyB = new THREE.Color('#8a90dc'), paperA = new THREE.Color(PAL.backdrop), paperB = new THREE.Color(PAL.evening);
      const blink = (t, t0) => (t < t0 ? 0 : t < t0 + 0.05 ? 0.7 : t < t0 + 0.1 ? 0.25 : 1);
      const lerp2 = (a, b, u) => [K.lerp(a[0], b[0], u), K.lerp(a[1], b[1], u)];

      // the dachshund's whole day as one function of t
      const dogState = (t) => {
        const base = { t, x: DOG_REST[0], z: DOG_REST[1], yaw: 0, lie: 1, sleep: true, headUp: 0, wag: 0, perk: 0 };
        const awake = { ...base, sleep: false, lie: 0 };
        if (t < T.wake) return base;
        if (t < T.stand) { const u = K.seg(t, T.wake, T.wake + 0.25, K.ease.out); return { ...base, sleep: false, headUp: u, perk: u, wag: 0.25 * u }; }
        if (t < T.fetch[0]) return { ...base, sleep: false, lie: 1 - K.seg(t, T.stand, T.stand + 0.12, K.ease.out), headUp: 1, perk: 1, wag: 0.35 };
        if (t < T.sit) { const u = K.seg(t, T.fetch[0], T.fetch[1], K.ease.inOut); return { ...awake, x: K.lerp(DOG_REST[0], SIT_AT[0], u), walking: u > 0 && u < 1, walk: u * 9, headTilt: -0.35 * Math.sin(Math.PI * K.seg(t, T.fetch[1] - 0.1, T.fetch[1] + 0.15)), wag: 0.4 }; }
        if (t < T.toType[0]) { const s = K.seg(t, T.sit, T.sit + 0.18, K.ease.out), look = K.seg(t, T.cards[0], T.cards[0] + 0.3, K.ease.inOut) * (1 - K.seg(t, T.fall[0], T.toType[0], K.ease.inOut)); return { ...awake, x: SIT_AT[0], pitch: 0.4 * s, sitAmt: s, headTilt: 0.55 * look - 0.2 * s, perk: 0.6 + 0.4 * look, wag: 0.5 }; }
        if (t < T.typing[0]) { const u = K.seg(t, T.toType[0], T.toType[1], K.ease.inOut), p = lerp2(SIT_AT, TYPE_AT, u); return { ...awake, x: p[0], z: p[1], walking: u > 0 && u < 1, walk: u * 8, wag: 0.4, perk: 0.6 }; }
        if (t < T.trot[0]) {   // typing: sitting up, head nodding with the keys, front paws tapping
          const s = K.seg(t, T.typing[0], T.typing[0] + 0.15, K.ease.out), on = t < T.typing[1] ? 1 : 0, grab = Math.sin(Math.PI * K.seg(t, T.grab - 0.15, T.grab + 0.1));
          return { ...awake, x: TYPE_AT[0], z: TYPE_AT[1], pitch: 0.32 * s, sitAmt: s, headTilt: -0.15 + 0.05 * Math.sin(t * 19) * on - 0.35 * grab, paw: 0.25 * Math.sin(t * 24) * on, perk: 0.7, wag: 0.35 };
        }
        if (t < T.rear[0]) { const u = K.seg(t, T.trot[0], T.trot[1], K.ease.inOut), p = lerp2(TYPE_AT, LB_FRONT, u); return { ...awake, x: p[0], z: p[1], yaw: Math.PI * K.seg(t, T.trot[0], T.trot[0] + 0.3, K.ease.inOut), walking: u > 0 && u < 1, walk: u * 16, wag: 0.4, perk: 0.4 }; }
        if (t < T.home[0]) { const r = Math.sin(Math.PI * K.seg(t, T.rear[0], T.home[0] - 0.05)); return { ...awake, x: LB_FRONT[0], z: LB_FRONT[1], yaw: Math.PI, rear: r, wag: 0.5, perk: 0.8 }; }
        if (t < T.nap[0]) { const u = K.seg(t, T.home[0] + 0.2, T.home[1], K.ease.inOut), p = lerp2(LB_FRONT, DOG_REST, u); return { ...awake, x: p[0], z: p[1], yaw: Math.PI * (1 - K.seg(t, T.home[0], T.home[0] + 0.3, K.ease.inOut)), walking: u > 0 && u < 1, walk: u * 6, wag: 0.3 }; }
        const n = K.seg(t, T.nap[0], T.nap[1], K.ease.inOut), stir = Math.sin(Math.PI * K.seg(t, T.youOut, T.youOut + 0.9)) * 0.6;   // one ear lifts when you step out
        return { ...base, lie: n, sleep: t > T.nap[1] + 0.06 && !(stir > 0.2), headUp: Math.max(1 - n, stir * 0.4), perk: Math.max(1 - n, stir), wag: 0.2 * (1 - n) + 0.15 * stir };
      };

      return {
        update(t) {
          // In the app, a beat can hold on one story time while the tile keeps living: `ambient` drives the
          // idle life (smoke, the duck, breathing, a gentle sway of the turntable). Absent in the video render.
          const app = (typeof window !== 'undefined' && window.__gazetteApp) || null;
          const amb = app && app.ambient != null ? app.ambient : t;
          const th = turn(t) + (app && app.ambient != null ? 0.035 * Math.sin(amb * 0.22) : 0); world.rotation.y = th;
          const [az, el, dist0] = cam.orbit(t), dist = dist0 * (app && app.zoom ? app.zoom : 1), aim0 = cam.aim(t), ca = toWorld(app && app.lift ? [aim0[0], aim0[1] + app.lift, aim0[2]] : aim0, th), cp = [ca[0] + dist * Math.sin(az * D2R) * Math.cos(el * D2R), ca[1] + dist * Math.sin(el * D2R), ca[2] + dist * Math.cos(az * D2R) * Math.cos(el * D2R)];
          const face = (p) => Math.atan2(cp[0] - toWorld(p, th)[0], cp[2] - toWorld(p, th)[2]) - th;   // billboard toward the lens

          // daylight until you send the letter; dusk falls as the van reaches the office, and the lamps take over
          const dusk = K.seg(t, 13.2, 15.8, K.ease.inOut);
          sun.position.set(-9 - 4 * dusk, 13 - 6.5 * dusk, 9); sun.intensity = 3.3 - 1.5 * dusk; paper.color.copy(paperA).lerp(paperB, dusk); sun.color.copy(sunCol.copy(cA).lerp(cB, dusk));
          sky.intensity = 0.95 - 0.38 * dusk; sky.color.copy(sunCol.copy(skyA).lerp(skyB, dusk));

          // 1: the Gazette slides down the rollers, the hatch shuts, the door rolls down
          const slide = K.seg(t, T.push, T.inVan, K.ease.inOut), open = 1 - K.seg(t, T.rollDown[0], T.rollDown[1], K.ease.inOut);
          rollDoor.scale.y = Math.max(0.02, 1 - open * 0.96); slats.repeat.y = 7 * rollDoor.scale.y; slats.offset.y = -slats.repeat.y;
          rollers.forEach((r) => { r.rotation.y = -slide * 7; });
          const lean = Math.sin(Math.PI * K.seg(t, T.push - 0.18, T.push + 0.3)) * 0.22;
          printer.position.set(-2.12 + lean * 0.35, 0, DOOR_Z + 0.62); printer.rotation.set(-lean * 1.2, Math.PI, 0);
          const shut = K.seg(t, T.shut - 0.17, T.shut, K.ease.in), settle = t > T.shut ? Math.exp(-(t - T.shut) * 9) * Math.cos((t - T.shut) * 26) : 0;
          car.hatch.rotation.z = -1.78 * (1 - shut) - 0.05 * settle * (t < T.go1 ? 1 : 0);

          // the van: road position, then its weight on top
          const v = vanAt(t), w = 0.14, acc = (vanDist(t + w) - 2 * vanDist(t) + vanDist(t - w)) / (w * w), speed = (vanDist(t + 0.02) - vanDist(t - 0.02)) / 0.04;
          const bend = (vanAt(t + 0.08).yaw - vanAt(t - 0.08).yaw) / 0.16;
          const loadDip = (slide >= 1 ? Math.exp(-(t - T.inVan) * 10) * Math.sin((t - T.inVan) * 24) * 0.02 : 0) + settle * 0.02;
          const stopRock = [T.arrive1, T.arrive2].reduce((a, t0) => a + (t > t0 ? Math.exp(-(t - t0) * 7) * Math.sin((t - t0) * 19) * 0.03 : 0), 0);
          car.g.position.set(v.p.x, 0.045, v.p.z); car.g.rotation.y = v.yaw;
          car.body.position.y = -loadDip + Math.abs(Math.sin(vanDist(t) * 5.3)) * 0.008 * K.clamp(speed);
          car.body.rotation.set(K.clamp(bend * speed * 0.012, -0.1, 0.1), 0, K.clamp(acc * 0.011, -0.085, 0.085) - stopRock);
          car.wheels.forEach((wh) => { wh.rotation.z = -vanDist(t) / 0.2; });
          car.lamps.emissiveIntensity = 2.6 * K.seg(t, T.go1 - 0.12, T.go1 - 0.04);

          // the mailman pops out of the van three times: with the paper, for your letter, at the office
          const win = (a, b) => (t >= a && t < b ? K.seg(t, a, a + 0.16, K.ease.outBack) * (1 - K.seg(t, b - 0.16, b, K.ease.in)) : 0);
          const popM = win(T.out1, T.inVan1) + win(T.out1b, T.inVan2) + (t >= T.out2 ? K.seg(t, T.out2, T.out2 + 0.16, K.ease.outBack) : 0);
          const m = moveAt(MAIL_MOVES, t);
          mailman.visible = popM > 0.001; mailman.position.set(m[0], m[1], m[2]); mailman.scale.set(popM * (1 + m[3]), popM * (1 - m[3]), popM * (1 + m[3]));
          const mLook = t >= T.out2 ? [SLOT[0], SLOT[2]] : t < T.back1 ? [PAPER_AT[0], PAPER_AT[2]] : t < T.out1b ? [MAT[0], MAT[1] + 0.8] : t < T.mailBack[0] ? AT_BOX : [3.6, 2.5];
          mailman.rotation.set(0, Math.atan2(mLook[0] - m[0], mLook[1] - m[2]), 0);
          mailman.rotateX(Math.sin(Math.PI * K.seg(t, T.drop - 0.24, T.drop + 0.14)) * 0.5 + Math.sin(Math.PI * K.seg(t, T.hand - 0.2, T.hand + 0.14)) * 0.3 + Math.sin(Math.PI * K.seg(t, T.slot - 0.24, T.slot + 0.14)) * 0.5);
          const mHead = [m[0], m[1] + 0.9 * popM, m[2]];

          // you: the door opens, you step out, take the letter from the box, hand it over, wave, and go back in
          const popY = win(T.youOut, T.youBack[1] + 0.26), y = moveAt(YOU_MOVES, t);
          you.visible = popY > 0.001; you.position.set(y[0], y[1], y[2]); you.scale.set(popY * (1 + y[3]), popY * (1 - y[3]), popY * (1 + y[3]));
          const yLook = t < T.you[1] ? AT_BOX : t < T.youBack[0] ? [MAT[0], 2.6] : DOORSTEP;
          you.rotation.set(0, Math.atan2(yLook[0] - y[0], yLook[1] - y[2]) + (t < T.you[0] ? Math.PI * 0 : 0), 0);
          you.rotateX(Math.sin(Math.PI * K.seg(t, T.take - 0.2, T.take + 0.12)) * 0.35);
          const yHead = [y[0], y[1] + 0.9 * popY, y[2]];
          const dOpen = t < T.door[0] ? 0 : t < T.door[1] - 0.4 ? K.spring(t - T.door[0], 2.2, 0.6) : 1 - K.spring(t - (T.door[1] - 0.4), 2.4, 0.7);
          door.rotation.y = 1.7 * dOpen;

          // the dachshund
          const d = dogState(t); d.t = amb; dog.pose(d);
          const mouthW = dog.mouth.getWorldPosition(new THREE.Vector3()); land.worldToLocal(mouthW);
          const mouth = [mouthW.x, mouthW.y, mouthW.z];

          // the Gazette: conveyor -> van -> mailman's head -> the mat -> the dog's mouth -> opened flat
          roll.visible = true; roll.scale.setScalar(1);
          if (t < T.inVan + 0.02) { roll.position.set(K.lerp(CONV.x0 + 0.3, v.p.x - 0.45, slide), CONV.y + 0.1 - 0.06 * K.seg(slide, 0.75, 1), DOOR_Z); roll.rotation.set(0, Math.PI / 2, 0); }
          else if (t < T.out1) roll.visible = false;
          else if (t < T.fetch[1]) {
            const dd = K.seg(t, T.drop - 0.2, T.drop, K.ease.in), b = t > T.drop ? Math.exp(-(t - T.drop) * 10) * Math.abs(Math.sin((t - T.drop) * 17)) * 0.08 : 0, p = mix(mHead, PAPER_AT, dd);
            roll.position.set(p[0], p[1] + Math.sin(Math.PI * dd) * 0.12 + b, p[2]); roll.rotation.set(0, K.lerp(1.4, 0.15, dd), 0); roll.scale.setScalar(Math.max(0.01, t < T.drop ? popM : 1));
          } else if (t < T.unroll[0]) { roll.position.set(...mouth); roll.rotation.set(0, 0.15, 0); }
          else roll.visible = false;
          const un = K.seg(t, T.unroll[0], T.unroll[1], K.ease.outBack);
          sheet.visible = t >= T.unroll[0]; sheet.position.set(SHEET_AT[0], SHEET_AT[1], SHEET_AT[2]); sheet.rotation.set(0, 0.12, 0); sheet.scale.set(Math.max(0.05, un), 1, Math.max(0.1, un));

          // 3: three ads pop up, their fit scores stamp on, you circle the best one; the others fall away and
          // the circled ad flies into the typewriter
          const cardHome = [[MAT[0] - 1.0, 1.92, MAT[1] + 0.45], [MAT[0] + 0.04, 2.12, MAT[1] + 0.5], [MAT[0] + 1.08, 1.92, MAT[1] + 0.45]];
          const twTop = [TW[0], 0.42, TW[1]];
          cards.forEach((c, i) => {
            const pop = K.seg(t, T.cards[i], T.cards[i] + 0.35, K.ease.outBack), fall = i === 1 ? 0 : K.seg(t, T.fall[0] + i * 0.04, T.fall[1] + i * 0.04, K.ease.in), into = i === 1 ? K.seg(t, T.toTW[0], T.toTW[1], K.ease.inOut) : 0;
            const bob = 0.03 * Math.sin(t * 2.2 + i);
            const p = mix([cardHome[i][0], cardHome[i][1] + bob - 1.4 * fall * fall, cardHome[i][2]], twTop, into);
            const s = pop * (1 - fall) * (1 - 0.85 * into);
            c.g.visible = s > 0.02 && t < T.toTW[1]; c.g.position.set(p[0], p[1], p[2]); c.g.scale.setScalar(Math.max(0.01, 1.25 * s));
            c.g.rotation.set(0.05 * Math.sin(t * 1.7 + i) + fall * 1.2, face(p), (i - 1) * 0.04 + fall * (i - 1) * 0.8);
            const st = t - T.stamps[i], thump = st < 0 ? 0 : K.ease.outBack(K.clamp(st / 0.18), 2.4);
            c.stamp.visible = st >= 0; c.stamp.scale.setScalar(Math.max(0.01, K.lerp(1.9, 1, thump))); c.stamp.rotation.z = -0.12 + 0.05 * i;
          });
          ringDots.count = app && app.ring === false ? 0 : Math.floor(RING_N * K.seg(t, T.ring[0], T.ring[1], K.ease.inOut));

          // 4: the CV and the cover letter pop up out of the typewriter, then fold into one red envelope
          const fold = K.seg(t, T.fold[0], T.fold[1], K.ease.inOut);
          pages.forEach((pg, i) => {
            const t0 = T.pages[0] + i * (T.pages[1] - T.pages[0]), rise = K.seg(t, t0, t0 + 0.45, K.ease.outBack);
            const at = [TW[0] - 0.35 + i * 0.62, 0.55 + 0.75 * rise + 0.02 * Math.sin(t * 2 + i), TW[1] + 0.35];
            const p = mix([K.lerp(TW[0], at[0], rise), at[1], K.lerp(TW[1], at[2], rise)], twTop, fold);
            pg.visible = rise > 0.01 && fold < 0.98; pg.position.set(...p); pg.scale.setScalar(Math.max(0.01, (0.3 + 0.7 * rise) * (1 - 0.8 * fold) * 1.2));
            pg.rotation.set(0.04 * Math.sin(t * 1.5 + i), face(p), (i ? 0.05 : -0.05) * (1 - fold));
          });

          // the letter: typewriter -> mouth -> letterbox (flag up, it waits for you) -> your hand -> the mailman -> the office slot
          const boxIn = [BOX[0] + 0.1, 0.56, BOX[1]];
          let lp = null, lr = [Math.PI / 2 * 0.9, 0, 0.2], ls = 1;
          if (t >= T.fold[1] - 0.05 && t < T.grab) { lp = [twTop[0], twTop[1] + 0.06, twTop[2]]; lr = [0, face(twTop), 0]; ls = K.seg(t, T.fold[1] - 0.05, T.fold[1] + 0.1, K.ease.outBack); }
          else if (t >= T.grab && t < T.post) { const pp = K.seg(t, T.post - 0.12, T.post, K.ease.in), g0 = K.seg(t, T.grab, T.grab + 0.08); lp = mix(mix(twTop, mouth, g0), boxIn, pp); ls = K.lerp(1, 0.6, pp); }
          else if (t >= T.take - 0.12 && t < T.hand) { const up = K.seg(t, T.take - 0.12, T.take + 0.1, K.ease.out); lp = mix(boxIn, [yHead[0], yHead[1] + 0.03, yHead[2]], up); lr = [Math.PI / 2, 0, 0.3]; ls = K.lerp(0.6, 1, up); }
          else if (t >= T.hand && t < T.inVan2) { const h = K.seg(t, T.hand - 0.04, T.hand + 0.14, K.ease.inOut); lp = mix([yHead[0], yHead[1] + 0.03, yHead[2]], [mHead[0], mHead[1] + 0.03, mHead[2]], h); lr = [Math.PI / 2, 0, 0.3]; ls = Math.max(0.01, t > T.mailBack[1] ? popM : 1); }
          else if (t >= T.out2 && t < T.slot + 0.05) { const sl = K.seg(t, T.slot - 0.22, T.slot, K.ease.in); lp = mix([mHead[0], mHead[1] + 0.03, mHead[2]], [SLOT[0], SLOT[1] - 0.3, SLOT[2] + 0.05], sl); lr = [Math.PI / 2 * (1 - sl), 0, 0]; ls = Math.max(0.01, popM * (1 - 0.5 * K.seg(t, T.slot - 0.05, T.slot + 0.05))); }
          letter.visible = !!lp; if (lp) { letter.position.set(...lp); letter.rotation.set(...lr); letter.scale.setScalar(ls); }
          let flagUp = t < T.flag ? 0 : t < T.take ? K.spring(t - T.flag, 2.4, 0.45) : 1 - K.spring(t - T.take, 2.4, 0.6);
          if (app && app.flag != null) flagUp = app.flag ? 1 : 0;   // the app knows whether you have unsent drafts
          flag.rotation.z = -1.45 * (1 - flagUp);

          // lights: the lamp, your windows and porch, then the office when the letter arrives
          bulb.emissiveIntensity = 5 * blink(t, T.lamp); lampLight.intensity = 4 * blink(t, T.lamp);
          homeWin[0].emissiveIntensity = 3.0 * blink(t, T.lamp + 0.25); homeWin[1].emissiveIntensity = 3.0 * blink(t, T.lamp + 0.37); porchLight.intensity = 1.3 * K.seg(t, T.lamp + 0.25, T.lamp + 0.6);
          doorway.emissiveIntensity = 1.2 * dOpen + 1.0 * K.seg(t, T.lamp + 0.25, T.lamp + 0.6);
          officeWin.forEach((mm, i) => { mm.emissiveIntensity = 3.2 * blink(t, T.lights + i * 0.07); });
          officeDoor.emissiveIntensity = 1.2 * K.seg(t, T.lights, T.lights + 0.4); deskLight.intensity = 1.6 * K.seg(t, T.lights, T.lights + 0.3);
          pressWin.forEach((mm) => { mm.emissiveIntensity = 0.6 + 1.6 * dusk; }); pressGlass.emissiveIntensity = 0.5 + 1.2 * dusk;
          const greet = K.seg(t, T.lights + 0.1, T.lights + 0.4, K.ease.out), cheer = [T.lights + 0.5, T.lights + 0.8].reduce((a, t0) => a + hop(t, t0, 0.24, [0, 0], [0, 0], 0.18)[1], 0);
          clerk.position.set(OFFICE.x - 0.72, 0.02 + cheer, OFFICE.z + 1.12); clerk.rotation.y = 0.5; clerk.visible = greet > 0; clerk.scale.setScalar(Math.max(0.01, greet));
          duck.position.set(0.25 + 0.55 * Math.cos(0.5 + amb * 0.22), 0, 0.12 * Math.sin(0.5 + amb * 0.22)); duck.rotation.y = -(0.5 + amb * 0.22) - Math.PI / 2;

          for (let i = 0; i < 6; i++) { const age = ((amb + 10) / 2.2 + i / 6) % 1; smoke.set(i, CHIM, age, { size: 0.22, rise: 1.4, drift: 0.6, driftZ: -0.15 + 0.1 * K.hash(i, Math.floor((amb + 10) / 2.2 + i / 6)) }); }
          for (let i = 0; i < 6; i++) { const age = ((amb + 10) / 2.6 + i / 6 + 0.4) % 1; smoke.set(6 + i, STACK, age, { size: 0.22, rise: 1.05, drift: 0.15, driftZ: 0.1 }); }
          exhaust.forEach((t0, i) => { const e = vanAt(t0); smoke.set(12 + i, [e.p.x - e.tg.x * 0.98, 0.25, e.p.z - e.tg.z * 0.98], (t - t0) / 0.75, { size: 0.14 - (i % EXH) * 0.008, rise: 0.4, drift: 0 }); });
          smoke.mesh.instanceMatrix.needsUpdate = true;

          // camera and lens: the sharp band follows the story
          shade.rotation.z = th;
          const focusTile = t < T.go1 ? [-1.9, 0.5, -1.6] : t < T.arrive1 ? [v.p.x, 0.5, v.p.z] : t < T.go2 ? (t > T.door[0] ? [1.4, 0.5, 2.0] : [MAT[0] + 0.3, 0.6, MAT[1] + 0.3]) : t < T.arrive2 ? [v.p.x, 0.5, v.p.z] : [SLOT[0], 0.7, SLOT[2] + 0.3];
          K.look(camera, cp, ca); K.focus(camera, toWorld(focusTile, th), K.lerp(0.3, 0.2, K.seg(t, 15.2, 16.6, K.ease.inOut)));

          signs.forEach((s, i) => {
            const wp = toWorld([s.g.position.x, 0, s.g.position.z], th), f = t - FLIPS[i];
            s.g.rotation.y = Math.atan2(cp[0] - wp[0], cp[2] - wp[2]) - th;
            s.flip.rotation.x = -0.3 + Math.PI * (f > 0 ? K.spring(f, 2.0, 0.5) : 0);
            s.flip.position.y = SIGNS[i].h + (f > 0 ? Math.exp(-f * 7) * Math.sin(f * 14) * 0.16 : 0);
          });
        },
        // captions: one small card per beat in the lower left; the stage name rides above it in the accent colour
        overlay(ctx, t, W, H) {
          if (typeof window !== 'undefined' && window.__gazetteApp && window.__gazetteApp.captions === false) return;
          const b = BEATS.find((x) => t >= x.t0 && t < x.t1) || BEATS[BEATS.length - 1];
          const last = b === BEATS[BEATS.length - 1];
          const a = K.seg(t, b.t0, b.t0 + 0.35, K.ease.out) * (last ? 1 : 1 - K.seg(t, b.t1 - 0.3, b.t1));
          if (a <= 0) return;
          ctx.globalAlpha = a;
          const x = 96, y = H - 96 - 8 * (1 - a);
          ctx.font = '600 64px "Fredoka"'; const tw2 = ctx.measureText(b.text).width;
          ctx.fillStyle = 'rgba(251,246,236,0.94)'; ctx.beginPath(); ctx.roundRect(x, y - 138, tw2 + 92, 150, 34); ctx.fill();
          ctx.fillStyle = PAL.accent; ctx.font = '600 30px "Fredoka"'; ctx.letterSpacing = '6px'; ctx.fillText(b.tag, x + 46, y - 84); ctx.letterSpacing = '0px';
          ctx.fillStyle = '#2b2f3a'; ctx.font = '600 64px "Fredoka"'; ctx.fillText(b.text, x + 46, y - 22);
          ctx.globalAlpha = 1;
        },
      };
    },

    sound(k) {
      k.bed('room', 0, DURATION, { gain: 0.7 });
      k.music('pad', 0, DURATION, { bpm: 112, gain: 0.6, chords: [['F3', 'A3', 'C4', 'E4'], ['D3', 'F3', 'A3', 'C4'], ['Bb2', 'D3', 'F3', 'A3'], ['C3', 'E3', 'G3', 'C4']] });
      // 1: the press
      k.play('roller', T.push, { gain: 0.45, dur: T.inVan - T.push, pan: -0.45 });
      k.play('paper', T.inVan - 0.05, { gain: 0.35, dur: 0.15, pan: -0.4 });
      k.play('thud', T.shut, { gain: 0.45, pan: -0.35 }); k.play('click', T.shut, { gain: 0.5, pan: -0.35 });
      k.play('roller', T.rollDown[0], { gain: 0.22, dur: T.rollDown[1] - T.rollDown[0], pan: -0.55 }); k.play('tock', T.rollDown[1], { gain: 0.3, f: 300, pan: -0.55 });
      // two drives
      for (const [go, arr, pan] of [[T.go1, T.arrive1, -0.1], [T.go2, T.arrive2, 0.35]]) {
        const d = arr - go;
        for (const [f, g] of [[1, 0.04], [2.02, 0.018]]) k.tone(go - 0.1, { f: [[0, 58 * f], [d * 0.3, 118 * f], [d * 0.7, 108 * f], [d + 0.15, 52 * f]], type: 'sawtooth', dur: d + 0.3, a: 0.12, hold: d - 0.2, gain: g, filter: 'lowpass', f2: 520, q: 2, pan });
        k.noise(go, { dur: d, color: 'brown', filter: 'bandpass', f: 300, q: 0.8, gain: 0.06, a: 0.4, hold: d - 0.9 });
        k.withMinor(() => { for (let i = 0; i < 4; i++) k.play('pop', go + 0.04 + i * 0.13, { gain: 0.15, f: 240 - i * 12, pan }); });
        k.play('swish', arr - 0.35, { gain: 0.25, dur: 0.3, pan });
      }
      // 2: the doorstep
      k.play('pop', T.out1, { gain: 0.5, pan: 0.2 });
      [T.out1 + 0.22, T.hop1 + 0.24, T.back1 + 0.24].forEach((t, i) => k.play('tock', t, { gain: 0.3, f: 520 + i * 50, pan: 0.2 }));
      k.play('slap', T.drop, { gain: 0.4, pan: 0.15 }); k.play('paper', T.drop, { gain: 0.3, dur: 0.12, pan: 0.15 });
      k.play('pop', T.inVan1 - 0.1, { gain: 0.25, f: 380, pan: 0.3 });
      k.play('blip', T.wake + 0.05, { gain: 0.3, f: 'A5', type: 'sine', dur: 0.09 }); k.play('blip', T.wake + 0.15, { gain: 0.26, f: 'D6', type: 'sine', dur: 0.07 });
      k.play('paper', T.unroll[0], { gain: 0.35, dur: 0.3, pan: 0.15 });
      // 3: ads pop, scores stamp, you circle one
      T.cards.forEach((t, i) => k.play('pop', t, { gain: 0.4, f: 520 + i * 90, pan: -0.25 + i * 0.25 }));
      T.stamps.forEach((t, i) => k.play('stamp', t, { gain: 0.42, pan: -0.25 + i * 0.25 }));
      k.play('stroke', T.ring[0], { gain: 0.8, dur: T.ring[1] - T.ring[0], material: 'marker', pan: 0.05 });
      k.play('swish', T.fall[0], { gain: 0.3, pan: -0.2 }); k.play('swish', T.fall[0] + 0.05, { gain: 0.3, pan: 0.3 });
      k.play('whoosh', T.toTW[0], { gain: 0.25, dur: 0.4, pan: 0.3 });
      // 4: the typewriter
      k.play('typing', T.typing[0], { gain: 0.6, n: 12, rate: 0.085, pan: 0.35 });
      T.pages.forEach((t, i) => { k.play('typebar', t - 0.04, { gain: 0.45, pan: 0.35 }); k.play('paper', t + 0.05, { gain: 0.35, dur: 0.2, pan: 0.3 + i * 0.1 }); });
      k.play('bell', T.pages[1] + 0.35, { gain: 0.35, f: 'A6', pan: 0.35 });
      k.play('paper', T.fold[0], { gain: 0.3, dur: 0.25, pan: 0.3 }); k.play('pop', T.fold[1], { gain: 0.3, f: 640, pan: 0.3 });
      for (let i = 0; i < 4; i++) k.play('tock', T.trot[0] + 0.08 + i * 0.12, { gain: 0.14, f: 900 + (i % 2) * 120, pan: 0.0 });
      k.play('paper', T.post - 0.06, { gain: 0.3, dur: 0.1, pan: -0.3 }); k.play('tock', T.post + 0.02, { gain: 0.45, f: 360, pan: -0.3 }); k.play('click', T.flag, { gain: 0.45, pan: -0.3 });
      // 5: you step out, the handover
      k.play('click', T.door[0], { gain: 0.5, pan: 0.0 }); k.play('pop', T.youOut, { gain: 0.4, f: 560, pan: 0.0 });
      [...T.you, ...T.youBack].forEach((t, i) => k.play('tock', t + 0.24, { gain: 0.25, f: 600 + (i % 2) * 70, pan: -0.15 }));
      k.play('click', T.take - 0.06, { gain: 0.4, pan: -0.3 }); k.play('paper', T.take, { gain: 0.25, dur: 0.1, pan: -0.3 });
      k.play('pop', T.out1b, { gain: 0.45, pan: 0.3 });
      [...T.mail, ...T.mailBack].forEach((t, i) => k.play('tock', t + 0.24, { gain: 0.24, f: 520 + (i % 2) * 60, pan: 0.1 }));
      k.play('paper', T.hand, { gain: 0.3, dur: 0.12, pan: -0.1 }); k.play('blip', T.hand + 0.05, { gain: 0.25, f: 'E6', type: 'sine', pan: -0.1 });
      T.wave.forEach((t) => k.play('tock', t + 0.22, { gain: 0.18, f: 700, pan: -0.25 }));
      k.play('pop', T.inVan2 - 0.1, { gain: 0.3, f: 380, pan: 0.3 }); k.play('thud', T.door[1], { gain: 0.25, f: 150, pan: 0.0 });
      // 6: dusk at the office
      k.play('click', T.lamp, { gain: 0.35, pan: 0.1 }); k.play('blip', T.lamp + 0.25, { gain: 0.2, f: 'A5', type: 'sine', pan: 0.1 });
      k.play('pop', T.out2, { gain: 0.5, pan: 0.45 });
      T.hops2.forEach((t, i) => k.play('tock', t + 0.22, { gain: 0.3, f: 560 + i * 60, pan: 0.45 }));
      k.play('paper', T.slot - 0.12, { gain: 0.35, dur: 0.15, pan: 0.45 }); k.play('tock', T.slot + 0.02, { gain: 0.4, f: 300, pan: 0.45 });
      [0, 1, 2, 3, 4].forEach((i) => k.play('blip', T.lights + i * 0.07, { gain: 0.18, f: ['C6', 'E6', 'G6', 'C7', 'E7'][i], type: 'sine', pan: 0.45 }));
      FLIPS.forEach((t, i) => { const pan = [-0.4, 0.1, 0.45][i]; k.play('swish', t, { gain: 0.45, pan }); k.play('tock', t + 0.2, { gain: 0.5, f: 760, pan }); k.play('ding', t + 0.2, { gain: i === 2 ? 0.75 : 0.5, f: ['C6', 'E6', 'G6'][i], pan }); });
      k.play('success', FLIPS[2] + 0.5, { gain: 0.5, f: 'C6' });
    },
  });
}

export {};
