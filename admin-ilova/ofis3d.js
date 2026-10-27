// Visart ofisi — 3D (Three.js r128). Yuqoridan ko'rinadigan kesim bino; agentlar do'ppi kiyib yuradi.
(function () {
  const T = window.THREE; let ST = null;
  const COLS = { senarist: 0xc4a876, montajchi: 0x4f8fd0, smm: 0xe08fb0, targetolog: 0xe8a35a, mijoz: 0x6fc08a, nazorat: 0x9a7fd6, seo: 0x3fb5ab, direktor: 0x2b2f3a, autocad: 0x7f8794, max: 0x7f8794 };
  const SKIN = [0xe7bb93, 0xd9a47a, 0xf0c8a0, 0xcf9868, 0xe3b088], HAIR = [0x1c1612, 0x2a1d14, 0x120e0b, 0x33261b];
  const WALLH = 3.4, PH = 1.5;
  const matC = {};
  const mat = (c, o) => { const k = c + JSON.stringify(o || {}); return matC[k] || (matC[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}))); };
  function ctex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t; }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }

  function start(box, L) {
    stop();
    if (!T) return false;
    let R; try { R = new T.WebGLRenderer({ antialias: true, alpha: false }); } catch (e) { return false; }
    if (!R || !R.getContext()) return false;
    box.innerHTML = '';
    const wrap = document.createElement('div'); wrap.style.cssText = 'position:relative;border-radius:16px;overflow:hidden;background:#14171d;border:1px solid #2a2f3a';
    box.appendChild(wrap);
    const cv = R.domElement; cv.id = 'o3'; cv.style.cssText = 'display:block;width:100%;touch-action:pan-y;cursor:grab'; wrap.appendChild(cv);
    const W0 = () => Math.max(280, wrap.clientWidth || 340);
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setClearColor(0x14171d);
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(36, 1, 1, 200);

    // ---- yorug'lik
    scene.add(new T.HemisphereLight(0xdfeaff, 0x5a4a3a, 0.62));
    const sun = new T.DirectionalLight(0xfff1dc, 0.55); sun.position.set(-10, 24, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536); const sc = sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 60; sun.shadow.bias = -0.0006;
    scene.add(sun);

    const box_ = (w, h, d, c, x, y, z, par, o) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c, o)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (par || scene).add(m); return m; };
    const cyl = (r1, r2, h, c, x, y, z, par, seg) => { const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg || 18), mat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (par || scene).add(m); return m; };
    const sph = (r, c, x, y, z, par) => { const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), mat(c)); m.position.set(x, y, z); m.castShadow = true; (par || scene).add(m); return m; };

    // ---- zamin va poldlar
    box_(24.8, 0.5, 16.8, 0x2f343f, 0, -0.26, 0);
    const woodT = ctex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { const s = 188 + Math.random() * 26; g.fillStyle = `rgb(${s},${s * 0.74 | 0},${s * 0.5 | 0})`; g.fillRect(0, i * 32, w, 32); g.strokeStyle = 'rgba(70,40,18,.5)'; g.lineWidth = 2; g.strokeRect(0, i * 32, w, 32); for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(80,45,20,.10)'; g.beginPath(); const y = i * 32 + Math.random() * 32; g.moveTo(0, y); g.lineTo(w, y + (Math.random() - .5) * 3); g.stroke(); } g.strokeStyle = 'rgba(70,40,18,.45)'; g.beginPath(); const xx = Math.random() * w; g.moveTo(xx, i * 32); g.lineTo(xx, i * 32 + 32); g.stroke(); } }, [7.5, 8]);
    const tileT = ctex(128, 128, (g, w, h) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#9d978b' : '#b3ad9f'; g.fillRect(i * 64, j * 64, 64, 64); } g.strokeStyle = 'rgba(0,0,0,.12)'; g.strokeRect(0, 0, w, h); }, [4.5, 3.5]);
    const carpT = ctex(128, 128, (g, w, h) => { g.fillStyle = '#41506a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.05)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [4, 3]);
    const floor = (x1, z1, x2, z2, tex) => { const m = new T.Mesh(new T.PlaneGeometry(x2 - x1, z2 - z1), new T.MeshLambertMaterial({ map: tex })); m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2); m.receiveShadow = true; scene.add(m); return m; };
    woodT.repeat.set(7.5, 8); floor(-12, -8, 3, 8, woodT);
    const w2 = woodT.clone(); w2.needsUpdate = true; w2.repeat.set(2.5, 1.75); floor(3, 4.5, 8, 8, w2);
    floor(3, -8, 12, -2.4, carpT); floor(3, -2.4, 12, 4.5, tileT); const t2 = tileT.clone(); t2.needsUpdate = true; t2.repeat.set(2, 1.75); floor(8, 4.5, 12, 8, t2);
    // gilam
    const rugT = ctex(256, 192, (g, w, h) => { g.fillStyle = '#7a2e2e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8d9a8'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 3; g.strokeRect(22, 22, w - 44, h - 44); g.fillStyle = '#d9b45a'; for (let i = 0; i < 5; i++) { g.save(); g.translate(40 + i * 44, h / 2); g.rotate(Math.PI / 4); g.fillRect(-12, -12, 24, 24); g.restore(); } }, null);
    const rug = new T.Mesh(new T.PlaneGeometry(4.2, 3.1), new T.MeshLambertMaterial({ map: rugT })); rug.rotation.x = -Math.PI / 2; rug.position.set(6.4, 0.025, -5.0); rug.receiveShadow = true; scene.add(rug);

    // ---- devorlar
    const WC = 0xe6dfd2, WD = 0x3a4252;
    const wall = (x1, z1, x2, z2, h, c, th) => { th = th || 0.22; const w = Math.abs(x2 - x1) + (z1 === z2 ? th : 0), d = Math.abs(z2 - z1) + (x1 === x2 ? th : 0); return box_(w, h, d, c || WC, (x1 + x2) / 2, h / 2, (z1 + z2) / 2); };
    wall(-12, -8, 12, -8, WALLH, 0x2f3646, 0.3); wall(-12, -8, -12, 8, WALLH, 0xcfc6b6, 0.3); wall(-12, 8, 12, 8, 0.45, 0x3a4150, 0.25); wall(12, -8, 12, 8, 0.45, 0x3a4150, 0.25);
    wall(3, -8, 3, -3.6, PH); wall(3, 0, 3, 8, PH); wall(3, -2.4, 6.4, -2.4, PH); wall(8.6, -2.4, 12, -2.4, PH);
    wall(5.0, 4.5, 9.0, 4.5, PH); wall(10.6, 4.5, 12, 4.5, PH); wall(3, 4.5, 3.6, 4.5, PH); wall(8, 4.5, 8, 8, PH);
    // derazalar
    const winMat = new T.MeshBasicMaterial({ color: 0xbfe0ff });
    const win = (x, z, rot) => { const g = new T.Group(); g.position.set(x, 1.95, z); g.rotation.y = rot; scene.add(g); const p = new T.Mesh(new T.PlaneGeometry(2.0, 1.5), winMat); g.add(p); const fr = 0x20242e; const f = (w, h, px, py) => { const m = new T.Mesh(new T.BoxGeometry(w, h, 0.08), mat(fr)); m.position.set(px, py, 0.02); g.add(m); }; f(2.1, 0.07, 0, 0.78); f(2.1, 0.07, 0, -0.78); f(0.07, 1.6, -1.03, 0); f(0.07, 1.6, 1.03, 0); f(0.04, 1.5, 0, 0); f(2.0, 0.04, 0, 0); };
    [-10, -7, -0.5, 2.5].forEach((x) => win(x, -7.82, 0)); [-5.5, -1.5, 2.5, 6].forEach((z) => win(-11.82, z, Math.PI / 2));
    // lavha
    const signT = ctex(512, 128, (g, w, h) => { g.fillStyle = '#1d222d'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9b45a'; g.font = '700 54px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VISART DESIGN', w / 2, h / 2 + 2); }, null);
    const sign = new T.Mesh(new T.PlaneGeometry(4, 1), new T.MeshBasicMaterial({ map: signT })); sign.position.set(-4.2, 2.2, -7.8); scene.add(sign);
    // rasmlar (portfolio)
    [[-11.8, 3.1, -3.5, 0x6b8f71], [-11.8, 3.1, 0.2, 0xb08968], [-11.8, 3.1, 3.9, 0x7a8fb5]].forEach(([x, y, z, c]) => { const fr = box_(0.06, 0.95, 1.3, 0x2a2a2a, x + 0.1, y - 0.6, z); box_(0.04, 0.8, 1.15, c, x + 0.14, y - 0.6, z); });

    // ---- mebellar
    const chairs = [];
    function desk(x, z, scrMat) {
      box_(2.0, 0.07, 1.0, 0xc9a37a, x, 0.76, z); [[-0.92, -0.42], [0.92, -0.42], [-0.92, 0.42], [0.92, 0.42]].forEach(([dx, dz]) => box_(0.07, 0.74, 0.07, 0x3a2f27, x + dx, 0.37, z + dz));
      box_(1.9, 0.5, 0.04, 0x8a6d4e, x, 0.5, z + 0.46);
      const mats = [mat(0x15171c), mat(0x15171c), mat(0x15171c), mat(0x15171c), mat(0x15171c), scrMat];
      const m = new T.Mesh(new T.BoxGeometry(0.95, 0.58, 0.05), mats); m.position.set(x, 1.2, z + 0.33); m.castShadow = true; scene.add(m);
      box_(0.12, 0.2, 0.12, 0x20232b, x, 0.89, z + 0.33); box_(0.34, 0.03, 0.22, 0x20232b, x, 0.8, z + 0.33);
      box_(0.62, 0.03, 0.2, 0xd8d8de, x, 0.81, z - 0.08); box_(0.08, 0.04, 0.12, 0xd8d8de, x + 0.5, 0.81, z - 0.05);
      cyl(0.07, 0.06, 0.1, 0xf2f2f2, x - 0.75, 0.85, z - 0.1, null, 12); box_(0.28, 0.02, 0.2, 0xeeeeee, x - 0.7, 0.8, z + 0.15);
    }
    function chair(x, z, y, ry) { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; scene.add(g); box_(0.58, 0.09, 0.58, 0x22262e, 0, y || 0.5, 0, g); box_(0.58, 0.62, 0.08, 0x22262e, 0, (y || 0.5) + 0.36, -0.28, g); cyl(0.04, 0.04, y || 0.5, 0x8d939f, 0, (y || 0.5) / 2, 0, g, 8); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; box_(0.36, 0.04, 0.05, 0x8d939f, Math.sin(a) * 0.18, 0.05, Math.cos(a) * 0.18, g).rotation.y = a; } return g; }
    function plant(x, z, s) { s = s || 1; cyl(0.28 * s, 0.22 * s, 0.5 * s, 0xb06a45, x, 0.25 * s, z, null, 12); for (let i = 0; i < 6; i++) { const a = i * 1.05; sph(0.3 * s, i % 2 ? 0x3f8f4e : 0x2f7a40, x + Math.sin(a) * 0.2 * s, (0.8 + (i % 3) * 0.2) * s, z + Math.cos(a) * 0.2 * s); } }
    const xA = [-9.6, -6.8, -4, -1.2, 1.6], xB = [-9.6, -6.8, -4, -1.2];
    const scrMats = [];
    const seatList = [];
    function mkScr() { const m = new T.MeshBasicMaterial({ color: 0x1d2430 }); scrMats.push(m); return m; }
    // hol stollari: A qator va B qator
    const homes = [];
    xA.forEach((x, j) => { const m = mkScr(); desk(x, -4.2, m); chair(x, -5.4, 0.5); homes.push({ n: 'cA' + j, scr: m }); });
    xB.forEach((x, j) => { const m = mkScr(); desk(x, 1.8, m); chair(x, 0.6, 0.5); homes.push({ n: 'cB' + j, scr: m }); });
    const mD = mkScr(); desk(6.2, 6.4, mD); chair(6.2, 5.2, 0.5);
    // hol bezaklari
    plant(-11.2, -7.2, 1.3); plant(2.2, -7.2, 1.1); plant(-11.2, 7.2, 1.2);
    box_(1.0, 1.1, 0.5, 0xdcd7cc, 2.3, 0.55, -1.0); box_(0.8, 0.04, 0.4, 0xffffff, 2.3, 1.12, -1.0);
    // lounj
    box_(4.0, 0.5, 1.0, 0x3d5a80, 6.4, 0.25, -6.7); box_(4.0, 0.6, 0.3, 0x35506f, 6.4, 0.7, -7.3); box_(0.3, 0.5, 1.0, 0x35506f, 4.5, 0.55, -6.7); box_(0.3, 0.5, 1.0, 0x35506f, 8.3, 0.55, -6.7);
    [5.5, 7.3].forEach((x) => box_(0.9, 0.12, 0.8, 0x4a6a94, x, 0.55, -6.7));
    cyl(0.6, 0.6, 0.35, 0x8a5a35, 6.4, 0.18, -4.7, null, 20); cyl(0.7, 0.7, 0.04, 0xd8c9a8, 6.4, 0.37, -4.7, null, 20);
    box_(0.9, 2.2, 0.4, 0x6a4a30, 10.8, 1.1, -7.6); for (let i = 0; i < 4; i++) box_(0.8, 0.05, 0.36, 0x4a3320, 10.8, 0.5 + i * 0.5, -7.6);
    [[10.7, -7.55, 0xd9b45a], [10.9, -7.55, 0x7a9cc6], [10.5, -7.55, 0xc87a7a]].forEach(([x, z, c], i) => box_(0.22, 0.34, 0.28, c, x - 0.1 + i * 0.1, 1.0 + i * 0.5, z + 0.05));
    plant(11.2, -5.0, 1.2); plant(3.7, -7.2, 0.9);
    const tvT = ctex(256, 144, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1f3a5f'); gr.addColorStop(1, '#a35ea0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '600 26px sans-serif'; g.textAlign = 'center'; g.fillText('Visart TV', w / 2, h / 2 + 8); }, null);
    const tv = new T.Mesh(new T.BoxGeometry(2.2, 1.25, 0.08), [mat(0x111), mat(0x111), mat(0x111), mat(0x111), new T.MeshBasicMaterial({ map: tvT }), mat(0x111)]); tv.position.set(6.4, 1.8, -7.75); scene.add(tv);
    // oshxona
    box_(0.8, 0.95, 4.4, 0xeceae4, 11.5, 0.475, 0.9); box_(0.86, 0.06, 4.46, 0x4a4f5a, 11.5, 0.98, 0.9);
    box_(0.5, 0.45, 0.45, 0x2b2b30, 11.4, 1.23, 0.0); box_(0.28, 0.06, 0.28, 0xd9d9de, 11.3, 1.04, 0.0); cyl(0.04, 0.04, 0.12, 0xf5f5f5, 11.2, 1.07, 0.0, null, 8);
    box_(0.9, 2.0, 0.85, 0xe9ecef, 11.4, 1.0, -1.8); box_(0.02, 0.9, 0.02, 0x888, 10.93, 1.5, -1.5);
    cyl(0.85, 0.85, 0.06, 0xd9cfba, 7, 0.76, 2.2, null, 24); cyl(0.07, 0.07, 0.76, 0x666, 7, 0.38, 2.2, null, 8);
    chair(5.9, 2.2, 0.48, Math.PI / 2); chair(8.1, 2.2, 0.48, -Math.PI / 2);
    plant(4.0, 3.9, 1); plant(11.3, 3.8, 1);
    // yo'l yo'riq (qavariq) paneli
    // kabinet
    box_(1.6, 1.8, 0.4, 0x6a4a30, 3.5, 0.9, 7.6); plant(7.6, 7.4, 1.1);
    // hojatxona
    box_(0.7, 0.4, 0.5, 0xffffff, 11.2, 0.2, 7.3); box_(0.5, 0.5, 0.2, 0xffffff, 11.2, 0.65, 7.62); box_(0.6, 0.85, 0.5, 0xffffff, 8.7, 0.45, 5.0); box_(0.4, 0.04, 0.35, 0x8ad, 8.7, 0.9, 5.0);
    // eshiklar
    function door(hx, hz, len, col, label) { const g = new T.Group(); g.position.set(hx, 0, hz); scene.add(g); const m = box_(len, PH - 0.05, 0.08, col, len / 2, (PH - 0.05) / 2, 0, g); if (label) { const lt = ctex(128, 64, (c, w, h) => { c.fillStyle = '#2a2f3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#e9e2d6'; c.font = '700 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2); }, null); const p = new T.Mesh(new T.PlaneGeometry(0.6, 0.3), new T.MeshBasicMaterial({ map: lt })); p.position.set(len / 2, 1.0, 0.05); g.add(p); } return { g, cx: hx + len / 2, cz: hz, t: 0 }; }
    const doors = [door(9.0, 4.5, 1.6, 0x7a5232, 'WC'), door(3.6, 4.5, 1.4, 0x7a5232, null)];

    // ---- graf
    const N = {};
    const gx = [-11, -8.2, -5.4, -2.6, 0.2];
    gx.forEach((x, j) => { N['a' + j] = [x, -1.8]; });
    N.a5 = [2.2, -1.8]; N.D1 = [3.0, -1.8]; N.K1 = [4.6, -1.8];
    const E = [];
    for (let j = 0; j < 4; j++) E.push(['a' + j, 'a' + (j + 1)]); E.push(['a4', 'a5'], ['a5', 'D1'], ['D1', 'K1']);
    xA.forEach((x, j) => { N['cA' + j] = [x, -5.4]; N['gA' + j] = [gx[j], -5.4]; N['hA' + j] = [gx[j], -3.0]; E.push(['cA' + j, 'gA' + j], ['gA' + j, 'hA' + j], ['hA' + j, 'a' + j]); });
    xB.forEach((x, j) => { N['cB' + j] = [x, 0.6]; N['gB' + j] = [gx[j + 1], 0.6]; N['hB' + j] = [gx[j + 1], -0.4]; E.push(['cB' + j, 'gB' + j], ['gB' + j, 'hB' + j], ['hB' + j, 'a' + (j + 1)]); });
    Object.assign(N, { KA: [4.6, 0.8], cG: [4.3, 5.2], cDr: [4.3, 4.5], CD: [4.3, 3.4], cD: [6.2, 5.2], K3: [7.5, -1.2], K2: [8.8, -0.4], AR: [7.5, -2.4], L1: [8.4, -3.8], L2: [8.4, -5.4], L3: [7.0, -5.4], SF1: [5.5, -6.6], SF2: [7.3, -6.6], LP: [10.0, -5.4], KT1: [5.9, 2.2], KT2: [8.1, 2.2], KM: [10.3, 0.0], KF: [10.3, -1.5], WD: [9.8, 3.4], WDr: [9.8, 4.5], WI: [9.8, 6.0] });
    E.push(['K1', 'KA'], ['KA', 'CD'], ['CD', 'cDr'], ['cDr', 'cG'], ['cG', 'cD'], ['KA', 'KT1'], ['K1', 'K3'], ['K3', 'K2'], ['K3', 'AR'], ['AR', 'L1'], ['L1', 'L2'], ['L2', 'L3'], ['L2', 'LP'], ['L3', 'SF1'], ['L2', 'SF2'], ['K2', 'KT2'], ['K2', 'KM'], ['KM', 'KF'], ['K2', 'WD'], ['WD', 'WDr'], ['WDr', 'WI']);
    const ADJ = {}; E.forEach(([a, b]) => { (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a); });
    const dist = (a, b) => Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]);
    function path(a, b) { const D = { [a]: 0 }, P = {}, Q = [a], dn = {}; while (Q.length) { Q.sort((x, y) => D[x] - D[y]); const u = Q.shift(); if (dn[u]) continue; dn[u] = 1; if (u === b) break; (ADJ[u] || []).forEach((v) => { const d = D[u] + dist(u, v); if (D[v] === undefined || d < D[v]) { D[v] = d; P[v] = u; Q.push(v); } }); } if (D[b] === undefined) return []; const r = []; let c = b; while (c !== a) { r.unshift(c); c = P[c]; } return r; }
    // o'tirish va qarash
    const SEAT = {}; const FACE = {};
    xA.forEach((x, j) => { SEAT['cA' + j] = 0.5; FACE['cA' + j] = 0; }); xB.forEach((x, j) => { SEAT['cB' + j] = 0.5; FACE['cB' + j] = 0; });
    Object.assign(SEAT, { cD: 0.5, SF1: 0.45, SF2: 0.45, KT1: 0.48, KT2: 0.48 }); Object.assign(FACE, { cD: 0, SF1: 0, SF2: 0, KT1: Math.PI / 2, KT2: -Math.PI / 2, KM: Math.PI / 2, KF: Math.PI / 2, LP: Math.PI * 0.75, WI: 0 });

    // ---- belgilar
    function label(text, col) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(16,19,26,.82)'; const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }; rr(4, 8, 248, 48, 22); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(30, 32, 9, 0, 7); g.fill(); g.fillStyle = '#f3efe6'; g.font = '600 27px Inter,Arial,sans-serif'; g.textBaseline = 'middle'; g.fillText(text.slice(0, 13), 48, 33); const t = new T.CanvasTexture(c); const s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2.5, 0.625, 1); s.renderOrder = 10; return s; }
    function bubble(ch) { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#e8c27a'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; g.font = '700 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 35); const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(0.55, 0.55, 1); s.renderOrder = 11; return s; }

    // ---- do'ppi (o'zbek tubeteykasi)
    const doppiT = ctex(256, 64, (g, w, h) => { g.fillStyle = '#101014'; g.fillRect(0, 0, w, h); for (let q = 0; q < 4; q++) { const ox = q * 64; g.strokeStyle = '#f2efe4'; g.fillStyle = '#f2efe4'; g.lineWidth = 2; g.strokeRect(ox + 4, 5, 56, 54); g.save(); g.translate(ox + 32, 32); g.rotate(Math.PI / 4); g.strokeRect(-13, -13, 26, 26); g.fillRect(-4, -4, 8, 8); g.restore(); [[14, 14], [50, 14], [14, 50], [50, 50]].forEach(([x, y]) => { g.beginPath(); g.arc(ox + x, y, 3, 0, 7); g.fill(); }); } }, null);
    function doppi() { const m = [new T.MeshLambertMaterial({ map: doppiT }), mat(0x101014), mat(0x101014)]; const mesh = new T.Mesh(new T.CylinderGeometry(0.19, 0.285, 0.23, 4, 1), m); mesh.rotation.y = Math.PI / 4; mesh.castShadow = true; return mesh; }

    // ---- odam
    function man(a, i) {
      const col = COLS[a.id] || 0xc4a876, skin = SKIN[i % SKIN.length], hair = HAIR[i % HAIR.length], pants = 0x262b36, female = a.id === 'smm';
      const g = new T.Group(); const b = new T.Group(); g.add(b);
      const leg = (x) => { const hip = new T.Group(); hip.position.set(x, 0.92, 0); b.add(hip); box_(0.23, 0.46, 0.25, pants, 0, -0.23, 0, hip); const kn = new T.Group(); kn.position.y = -0.46; hip.add(kn); box_(0.2, 0.44, 0.22, pants, 0, -0.22, 0, kn); box_(0.22, 0.1, 0.36, 0x16161a, 0, -0.47, 0.07, kn); return { hip, kn }; };
      const arm = (x) => { const sh = new T.Group(); sh.position.set(x, 1.6, 0); b.add(sh); sph(0.1, col, 0, 0, 0, sh); box_(0.15, 0.34, 0.16, col, 0, -0.19, 0, sh); const el = new T.Group(); el.position.y = -0.36; sh.add(el); box_(0.13, 0.32, 0.14, col, 0, -0.15, 0, el); sph(0.075, skin, 0, -0.33, 0, el); return { sh, el }; };
      const L1 = leg(-0.14), L2 = leg(0.14), A1 = arm(-0.37), A2 = arm(0.37);
      box_(0.6, 0.74, 0.32, col, 0, 1.3, 0, b); box_(0.62, 0.08, 0.34, 0x1a1c22, 0, 0.95, 0, b);
      if (a.id === 'direktor') { box_(0.1, 0.5, 0.04, 0x8b1e2d, 0, 1.3, 0.17, b); box_(0.2, 0.12, 0.34, 0xf3f0e8, 0, 1.64, 0.02, b); } else box_(0.22, 0.08, 0.34, 0xf3f0e8, 0, 1.66, 0.02, b);
      const head = new T.Group(); head.position.y = 1.9; b.add(head);
      cyl(0.09, 0.1, 0.14, skin, 0, -0.2, 0, head, 10); sph(0.24, skin, 0, 0, 0, head);
      sph(0.045, 0xffffff, -0.09, 0.03, 0.2, head); sph(0.045, 0xffffff, 0.09, 0.03, 0.2, head); sph(0.026, 0x1a1210, -0.09, 0.03, 0.235, head); sph(0.026, 0x1a1210, 0.09, 0.03, 0.235, head);
      box_(0.1, 0.02, 0.02, hair, -0.09, 0.1, 0.225, head); box_(0.1, 0.02, 0.02, hair, 0.09, 0.1, 0.225, head);
      sph(0.035, skin, 0, -0.03, 0.245, head); box_(0.12, 0.025, 0.02, 0xa8523f, 0, -0.1, 0.225, head);
      sph(0.05, skin, -0.245, 0, 0, head); sph(0.05, skin, 0.245, 0, 0, head);
      const hr = sph(0.235, hair, 0, 0.0, -0.09, head); hr.scale.set(1.0, 0.92, 0.92);
      if (female) { box_(0.5, 0.7, 0.14, hair, 0, -0.3, -0.2, head); }
      else if (i % 3 === 0) { const bd = sph(0.2, hair, 0, -0.1, 0.1, head); bd.scale.set(1, 0.6, 0.7); bd.position.z = 0.1; }
      const dp = doppi(); dp.position.y = 0.19; head.add(dp);
      const mug = cyl(0.06, 0.05, 0.1, 0xf4f4f4, 0, -0.38, 0.06, A2.el, 10); mug.visible = false;
      const lb = label(a.nom || a.id, '#' + (new T.Color(col === 0x2b2f3a ? 0xd4af37 : col)).getHexString()); lb.position.y = 3.2; g.add(lb);
      const bb = bubble('!'); bb.position.y = 3.85; bb.visible = false; g.add(bb);
      const hit = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 2.6, 8), new T.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; hit.userData.aid = a.id; g.add(hit);
      g.scale.setScalar(1.22); scene.add(g);
      return { a, i, g, b, head, L1, L2, A1, A2, mug, lb, bb, hit };
    }

    // ---- agentlar
    const cnt = Math.min(L.length, 10);
    const order = ['cD', ...homes.slice(0, 9).map((h) => h.n)];
    const homeScr = { cD: mD }; homes.forEach((h) => { homeScr[h.n] = h.scr; });
    const REST = ['SF1', 'SF2', 'KT1', 'KT2', 'KM', 'KF', 'LP', 'WI'];
    const AG = L.slice(0, cnt).map((a, i) => man(a, i));
    // uylarni taqsimlash (direktor kabinetda, qolganlar xonada)
    { let k = 1; AG.forEach((g) => { g.home = g.a.id === 'direktor' ? 'cD' : order[k++]; g.scr = homeScr[g.home]; }); }
    AG.forEach((g) => {
      const a = g.a; let s0 = g.home; if (a.h === 'dam') s0 = REST[g.i % REST.length]; if (s0 === 'WI') s0 = 'KM';
      g.node = s0; g.x = N[s0][0]; g.z = N[s0][1]; g.path = []; g.wait = 2 + Math.random() * 6; g.ph = Math.random() * 6; g.mode = SEAT[s0] ? 'sit' : 'stand'; g.cup = false; g.tgt = null; g.ry = FACE[s0] || 0; g.sitY = 0; g.open = 0;
      g.g.position.set(g.x, 0, g.z); g.g.rotation.y = g.ry;
    });
    const busy = (g, n) => AG.some((o) => o !== g && (o.tgt === n || (o.node === n && !o.path.length)));
    function go(g, dst) { const p = path(g.node, dst); if (!p.length) return false; g.path = p; g.tgt = dst; return true; }
    function decide(g) {
      const a = g.a;
      if (a.h !== 'dam') { if (g.node !== g.home) { g.cup = false; go(g, g.home); return; } if (a.h === 'ishlayapti' && Math.random() < 0.2) { go(g, rnd(['KM', 'KM', 'KF', 'SF1'])); return; } g.wait = 14 + Math.random() * 22; return; }
      const o = REST.filter((n) => n !== g.node && !busy(g, n)); if (!o.length) { g.wait = 3; return; } go(g, rnd(o));
    }
    function arrive(g) {
      g.node = g.tgt; g.tgt = null; const n = g.node; g.ry = FACE[n] !== undefined ? FACE[n] : g.ry;
      if (n === g.home) { g.mode = 'sit'; g.cup = g.a.h === 'ishlayapti'; g.wait = 14 + Math.random() * 22; }
      else if (SEAT[n]) { g.mode = 'sit'; g.cup = n === 'KT1' || n === 'KT2'; g.wait = 8 + Math.random() * 9; }
      else if (n === 'KM') { g.mode = 'stand'; g.cup = true; g.wait = 4 + Math.random() * 3; }
      else if (n === 'WI') { g.mode = 'stand'; g.wait = 5 + Math.random() * 4; }
      else { g.mode = 'stand'; g.wait = 3 + Math.random() * 5; }
    }

    // ---- kamera
    let az = 0.55, el = 0.93, Rd = 30, user = false, tgtZ = 0.4, tgtX = 0;
    function fit() { const w = W0(), h = Math.round(w * 0.86); R.setSize(w, h, false); cv.style.height = h + 'px'; cam.aspect = w / h; const hf = 2 * Math.atan(Math.tan(T.MathUtils.degToRad(36) / 2) * Math.min(cam.aspect, 1.3)); Rd = (12.6 / Math.tan(hf / 2)) * ST.zoom; cam.updateProjectionMatrix(); }
    ST = { look: (x, z, zm) => { tgtX = x; tgtZ = z; ST.zoom = zm; user = true; fit(); }, zoom: 1, R, wrap, alive: true };
    const bt = (t, f, x) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = `position:absolute;${x};width:34px;height:34px;border-radius:50%;border:1px solid #3a4150;background:rgba(20,23,29,.78);color:#e9e2d6;font-size:16px;line-height:1`; b.onclick = (e) => { e.stopPropagation(); user = true; f(); }; wrap.appendChild(b); };
    bt('⟲', () => { az -= 0.3; }, 'left:10px;bottom:10px'); bt('⟳', () => { az += 0.3; }, 'left:52px;bottom:10px');
    bt('＋', () => { ST.zoom = Math.max(0.35, ST.zoom * 0.85); fit(); }, 'right:52px;bottom:10px'); bt('－', () => { ST.zoom = Math.min(1.4, ST.zoom / 0.85); fit(); }, 'right:10px;bottom:10px');
    fit();
    let down = null, moved = 0;
    cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; moved = 0; user = true; cv.style.cursor = 'grabbing'; });
    window.addEventListener('pointermove', ST.pm = (e) => { if (!down) return; const dx = e.clientX - down.x; moved += Math.abs(dx) + Math.abs(e.clientY - down.y); down.x = e.clientX; down.y = e.clientY; az -= dx * 0.008; });
    window.addEventListener('pointerup', ST.pu = (e) => { if (!down) return; cv.style.cursor = 'grab'; down = null; if (moved < 8 && e.target === cv) pick(e); });
    const RC = new T.Raycaster();
    function pick(e) { const r = cv.getBoundingClientRect(); const v = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); RC.setFromCamera(v, cam); const hs = AG.filter((g) => g.g.visible).map((g) => g.hit); const h = RC.intersectObjects(hs)[0]; if (h && window.agSheet) window.agSheet(h.object.userData.aid); }
    ST.rs = () => { if (ST.alive) fit(); }; window.addEventListener('resize', ST.rs);

    // ---- sikl
    let last = performance.now(), tt = 0;
    const lerpA = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
    function frame(t) {
      if (!ST || !ST.alive) return; ST.raf = requestAnimationFrame(frame);
      if (!document.body.contains(cv)) { stop(); return; }
      if (document.hidden) { last = t; return; }
      const dt = Math.min(0.1, (t - last) / 1000); last = t; tt += dt;
      if (!user) az = 0.55 + Math.sin(tt * 0.18) * 0.22;
      az = Math.max(-1.25, Math.min(1.25, az));
      cam.position.set(tgtX + Math.sin(az) * Math.cos(el) * Rd, Math.sin(el) * Rd, tgtZ + Math.cos(az) * Math.cos(el) * Rd); cam.lookAt(tgtX, 0.6, tgtZ);
      AG.forEach((g) => {
        const a = g.a;
        if (g.path.length) {
          const p = g.path[0], tg = N[p], dx = tg[0] - g.x, dz = tg[1] - g.z, dd = Math.hypot(dx, dz), sp = 2.3 * dt;
          if (dd <= sp) { g.x = tg[0]; g.z = tg[1]; g.node = p; g.path.shift(); if (!g.path.length) arrive(g); } else { g.x += dx / dd * sp; g.z += dz / dd * sp; g.ry = lerpA(g.ry, Math.atan2(dx, dz), Math.min(1, dt * 9)); }
          g.mode = 'walk'; g.ph += dt * 8;
        } else { g.wait -= dt; if (g.wait <= 0) decide(g); }
        g.g.position.x = g.x; g.g.position.z = g.z; g.g.rotation.y = g.ry;
        const sit = g.mode === 'sit', walk = g.mode === 'walk', atHome = sit && g.node === g.home;
        g.sitY += ((sit ? -0.4 : 0) - g.sitY) * Math.min(1, dt * 10); g.b.position.y = g.sitY + (walk ? Math.abs(Math.sin(g.ph)) * 0.05 : 0);
        const s = Math.sin(g.ph);
        if (walk) { g.L1.hip.rotation.x = s * 0.65; g.L2.hip.rotation.x = -s * 0.65; g.L1.kn.rotation.x = Math.max(0, s) * 0.9; g.L2.kn.rotation.x = Math.max(0, -s) * 0.9; g.A1.sh.rotation.x = -s * 0.55; g.A2.sh.rotation.x = s * 0.55; g.A1.el.rotation.x = -0.25; g.A2.el.rotation.x = -0.25; }
        else if (sit) { g.L1.hip.rotation.x = g.L2.hip.rotation.x = -1.5; g.L1.kn.rotation.x = g.L2.kn.rotation.x = 1.5; const type = atHome && a.h === 'ishlayapti', w = type ? Math.sin(t / 70 + g.i * 2) * 0.07 : 0; g.A1.sh.rotation.x = -1.05 + w; g.A2.sh.rotation.x = -1.05 - w; g.A1.el.rotation.x = -0.55; g.A2.el.rotation.x = g.cup ? -1.7 : -0.55; }
        else { g.L1.hip.rotation.x = g.L2.hip.rotation.x = 0; g.L1.kn.rotation.x = g.L2.kn.rotation.x = 0; g.A1.sh.rotation.x = g.A2.sh.rotation.x = 0; g.A1.el.rotation.x = -0.1; g.A2.el.rotation.x = g.cup ? -1.9 : -0.1; if (g.cup) g.A2.sh.rotation.x = -0.5; }
        g.mug.visible = !!g.cup;
        g.head.rotation.x = atHome && a.h === 'ishlayapti' ? Math.sin(t / 900 + g.i) * 0.05 + 0.08 : 0; g.head.rotation.y = !walk && !atHome ? Math.sin(t / 1300 + g.i) * 0.4 : 0;
        const inWC = g.z > 5.0 && g.x > 8.2; g.g.visible = !inWC;
        const wait = (a.h === 'kutmoqda' || a.h === 'xato') && atHome; g.bb.visible = wait; if (wait) { g.bb.material.color.set(a.h === 'xato' ? 0xff7b7b : 0xffffff); g.bb.position.y = 3.85 + Math.sin(t / 250) * 0.08; }
      });
      // ekranlar
      scrMats.forEach((m) => m.color.set(0x1d2430)); AG.forEach((g) => { if (g.scr && g.mode === 'sit' && g.node === g.home) { const w = g.a.h === 'ishlayapti'; g.scr.color.set(w ? (0x6aa0e0 + (Math.sin(tt * 5 + g.i) > 0.6 ? 0x101010 : 0)) : (g.a.h === 'xato' ? 0xa84040 : g.a.h === 'kutmoqda' ? 0xb89a4a : 0x2a3342)); } });
      // eshiklar
      doors.forEach((d) => { const near = AG.some((g) => g.g.visible !== false && Math.hypot(g.x - d.cx, g.z - d.cz) < 1.7) || AG.some((g) => !g.g.visible && Math.hypot(g.x - d.cx, g.z - d.cz) < 3.2); d.t += ((near ? 1 : 0) - d.t) * Math.min(1, dt * 6); d.g.rotation.y = -d.t * 1.45; });
      R.render(scene, cam);
    }
    ST.raf = requestAnimationFrame(frame);
    return true;
  }
  function stop() { if (!ST) return; ST.alive = false; cancelAnimationFrame(ST.raf); window.removeEventListener('pointermove', ST.pm); window.removeEventListener('pointerup', ST.pu); window.removeEventListener('resize', ST.rs); try { ST.R.dispose(); ST.R.forceContextLoss(); } catch (e) {} ST = null; }
  window.Ofis3D = { start, stop, look: (x, z, zm) => ST && ST.look(x, z, zm) };
})();
