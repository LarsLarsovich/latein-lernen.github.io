'use strict';

const SFApp = (() => {

  // ── Fixed ViewBox matching Figma proportions (1100 × 590) ─
  const VB = '0 0 1100 590';
  const R  = 46;   // node circle radius (matches Figma's 96px / 1105px * 1100 / 2)

  // Node positions in 1100×590 space — matching the Figma layout
  const NODE_POS = [
    [ 90, 155],   //  1  completed
    [195, 260],   //  2  completed
    [360, 168],   //  3  active  ← rings here
    [555, 155],   //  4
    [710, 245],   //  5
    [855, 162],   //  6
    [1008, 248],  //  7
    [908,  378],  //  8
    [765,  335],  //  9
    [595,  445],  // 10
    [418,  495],  // 11
    [242,  538],  // 12
  ];

  const NS = 'http://www.w3.org/2000/svg';

  // ── Navigation ────────────────────────────────────────────
  let _currentPage = 'login';
  let _prevPage    = null;

  function showPage(id) {
    document.querySelectorAll('.sf-page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + id);
    if (el) el.classList.add('active');
    _prevPage    = _currentPage;
    _currentPage = id;
    document.getElementById('sf-header').style.display = id === 'login' ? 'none' : '';
    if (id === 'home') renderPath();
    window.scrollTo(0, 0);
  }

  function goBack() { showPage(_prevPage || 'home'); }

  // ── Login ─────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    const input = document.getElementById('login-email');
    const btn   = document.getElementById('login-btn');
    const err   = document.getElementById('login-error');
    err.textContent = '';
    btn.disabled    = true;
    btn.textContent = 'Einen Moment…';
    try {
      await Auth.loginWithEmail(input.value);
      await _afterLogin();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled    = false;
      btn.textContent = 'Loslegen';
    }
  }

  async function _afterLogin() {
    await Progress.load();
    document.getElementById('user-avatar-initial').textContent =
      Auth.getCurrentUser().email[0].toUpperCase();
    showPage('home');
  }

  function handleLogout() { Auth.logout(); closeMenu(); showPage('login'); }

  // ── Menu ──────────────────────────────────────────────────
  function toggleMenu() {
    document.getElementById('side-menu').classList.toggle('open');
    document.getElementById('menu-overlay').classList.toggle('open');
  }
  function closeMenu() {
    document.getElementById('side-menu').classList.remove('open');
    document.getElementById('menu-overlay').classList.remove('open');
  }

  // ── Catmull-Rom smooth path ───────────────────────────────
  function catmullRom(pts) {
    const d = [`M ${pts[0][0]} ${pts[0][1]}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cx1 = (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1);
      const cy1 = (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1);
      const cx2 = (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1);
      const cy2 = (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1);
      d.push(`C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2[0]} ${p2[1]}`);
    }
    return d.join(' ');
  }

  // ── SVG helper ────────────────────────────────────────────
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // ── Render path ───────────────────────────────────────────
  function renderPath() {
    const current = Progress.getCurrentStage();
    const stages  = Progress.getStages();

    // Path line
    document.getElementById('path-line').setAttribute('d', catmullRom(NODE_POS));

    // Nodes
    const g = document.getElementById('path-nodes-g');
    g.innerHTML = '';

    stages.forEach((stage, i) => {
      const [cx, cy] = NODE_POS[i];
      const num      = i + 1;
      const isFinal  = num === stages.length;
      const r        = isFinal ? Math.round(R * 1.15) : R;

      let state;
      if (num < current)        state = 'completed';
      else if (num === current) state = 'active';
      else                      state = 'locked';

      const group = el('g', { class: 'node-g ' + state });

      // Static concentric rings for active node (matching Figma)
      if (state === 'active') {
        const rings = [
          { dr: 44, opacity: 0.10 },
          { dr: 28, opacity: 0.22 },
          { dr: 14, opacity: 0.38 },
        ];
        for (const { dr, opacity } of rings) {
          group.appendChild(el('circle', {
            cx, cy,
            r: r + dr,
            fill: `rgba(163,136,136,${opacity})`,
          }));
        }
      }

      // Main circle
      group.appendChild(el('circle', {
        cx, cy, r,
        class: 'node-circ ' + state,
      }));

      group.addEventListener('click', () => openSheet(stage, state));
      g.appendChild(group);
    });
  }

  // ── Stage sheet ───────────────────────────────────────────
  function openSheet(stage, state) {
    document.getElementById('sheet-num').textContent   = 'Lektion ' + stage.id;
    document.getElementById('sheet-title').textContent = stage.title;
    document.getElementById('sheet-sub').textContent   = stage.sub;

    const btn = document.getElementById('sheet-btn');
    if (state === 'locked') {
      btn.textContent = 'Noch gesperrt';
      btn.className   = 'sheet-btn disabled';
      btn.onclick     = null;
    } else {
      btn.textContent = state === 'completed' ? 'Nochmal üben' : 'Jetzt starten';
      btn.className   = 'sheet-btn';
      btn.onclick     = () => { closeSheet(); showPage(stage.page); };
    }
    document.getElementById('stage-sheet').classList.add('open');
    document.getElementById('sheet-overlay').classList.add('open');
  }

  function closeSheet() {
    document.getElementById('stage-sheet').classList.remove('open');
    document.getElementById('sheet-overlay').classList.remove('open');
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('menu-overlay').addEventListener('click', closeMenu);
    document.getElementById('sheet-overlay').addEventListener('click', closeSheet);

    const user = await Auth.tryAutoLogin();
    if (user) await _afterLogin();
    else showPage('login');
  }

  // expose VB so HTML can use it
  return { init, showPage, goBack, handleLogout, toggleMenu, closeMenu, VB };
})();

document.addEventListener('DOMContentLoaded', SFApp.init);
