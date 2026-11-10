'use strict';

// ── Tabellen: gemeinsamer Teil für Vokabeln und Pronomina ─────
// Übersicht mit Karten, Tabellen-Ansicht, Entwürfe, Löschen.
// Die Themenseiten ergänzen mit Object.assign(Tables, {...}) ihre Editoren
// und wie eine Tabelle gezeichnet wird.
//   type = 'vokabel' | 'pronomen'
const Tables = {

  _col(type, isDraft) {
    return isDraft ? (type === 'pronomen' ? COL.pronomenDrafts : COL.vokabelDrafts)
                   : (type === 'pronomen' ? COL.pronomen       : COL.vokabel);
  },
  _list(type, isDraft) {
    return isDraft ? (type === 'pronomen' ? state.pronomenDrafts : state.vokabelDrafts)
                   : (type === 'pronomen' ? state.pronomen       : state.vokabel);
  },
  openEditor(type, id, source) {
    type === 'pronomen' ? this.openPronomenEditor(id, source) : this.openVokabelEditor(id, source);
  },

  // ── Übersicht: Entwürfe (nur Admins) und veröffentlichte Tabellen als Karten ──
  renderOverview(type) {
    const isAdmin = state.adminLoggedIn;
    const drafts  = this._list(type, true);
    document.getElementById(type + '-draft-section').classList.toggle('hidden', !isAdmin);
    if (isAdmin) {
      const dg = document.getElementById(type + '-draft-grid');
      dg.innerHTML = '';
      drafts.forEach(t => dg.appendChild(this._makeDraftCard(t, type)));
      document.getElementById(type + '-draft-empty').classList.toggle('hidden', drafts.length > 0);
    }
    const list = [...this._list(type, false)];
    if (type === 'vokabel') list.sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }));
    const grid = document.getElementById(type + '-grid');
    grid.innerHTML = '';
    list.forEach(t => grid.appendChild(this._makeCard(t, type)));
    document.getElementById(type + '-empty').classList.toggle('hidden', list.length > 0);
  },

  // "Lectio 12" → XII. Listen sind durchnummeriert, die Zahl steht groß auf der Karte.
  _roman(n) {
    if (!(n > 0 && n < 400)) return '';
    const map = [[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let out = '';
    map.forEach(([v, r]) => { while (n >= v) { out += r; n -= v; } });
    return out;
  },

  // Inhalt einer Karte: Name, eine Zeile dazu und eine Kostprobe aus der Tabelle
  _cardBody(t, type) {
    let meta = t.desc || '', taste = '', numeral = '';
    if (type === 'vokabel') {
      const rows = t.rows || [];
      const m = (t.name || '').match(/(\d+)\s*$/);
      numeral = m ? this._roman(parseInt(m[1], 10)) : '';
      meta    = `${rows.length} ${rows.length === 1 ? 'Vokabel' : 'Vokabeln'}` + (t.desc ? ' – ' + t.desc : '');
      taste   = rows.slice(0, 4).map(r => (r.lat || '').split(/[%/]/)[0].trim()).filter(Boolean).join(', ')
              + (rows.length > 4 ? ' …' : '');
    } else {
      // Pronomen: die Formen des Maskulinum Singular als Kostprobe (is, eius, ei, eum, eo)
      taste = CASES.map(c => t.sg?.M?.[c]).filter(Boolean).join(', ');
      if (!meta) meta = 'Deklination und Quiz';
    }
    return `${numeral ? `<div class="list-card-numeral" aria-hidden="true" style="--n:${numeral.length}">${numeral}</div>` : ''}
      <div class="quiz-card-name">${escHtml(t.name)}</div>
      <div class="quiz-card-desc">${escHtml(meta)}</div>
      ${taste ? `<div class="list-card-taste" lang="la">${escHtml(taste)}</div>` : ''}`;
  },

  _makeCard(t, type) {
    const card     = document.createElement('div');
    card.className = 'quiz-card' + (state.adminLoggedIn ? ' admin-mode' : '');

    // Mini-Diagramm vom letzten Quiz (nur Vokabellisten, im Browser gespeichert)
    let saved = null;
    if (type === 'vokabel') {
      try { const raw = localStorage.getItem('quiz_result_' + t.id); if (raw) saved = JSON.parse(raw); } catch (e) {}
    }

    card.className += ' list-card';
    card.innerHTML = this._cardBody(t, type) + `
      ${saved ? '<canvas class="card-mini-chart" width="54" height="54"></canvas>' : ''}
      ${state.adminLoggedIn ? `<div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>` : ''}`;

    if (saved) {
      this._drawMiniChart(card.querySelector('.card-mini-chart'), saved.roundCounts, saved.neverCorrect, saved.total);
    }
    if (state.adminLoggedIn) {
      card.querySelector('.card-overlay-edit').onclick = e => { e.stopPropagation(); this.openEditor(type, t.id); };
      card.querySelector('.card-overlay-del').onclick  = e => { e.stopPropagation(); this.confirmDelete(t.id, type); };
    }
    card.onclick = () => this.viewTable(t.id, type);
    return card;
  },

  _makeDraftCard(t, type) {
    const card     = document.createElement('div');
    card.className = 'quiz-card list-card admin-mode draft-card';
    card.innerHTML = `<div class="draft-pill">Entwurf</div>` + this._cardBody(t, type) + `
      <div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-pub">Veröffentlichen</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>`;
    card.querySelector('.card-overlay-edit').onclick = e => { e.stopPropagation(); this.openEditor(type, t.id, 'draft'); };
    card.querySelector('.card-overlay-pub').onclick  = e => { e.stopPropagation(); this.publishTableDraft(t.id, type, e.target); };
    card.querySelector('.card-overlay-del').onclick  = e => { e.stopPropagation(); this.deleteTableDraft(t.id, type); };
    card.onclick = () => this.viewTable(t.id, type, true);
    return card;
  },

  _drawMiniChart(canvas, roundCounts, neverCorrect, total) {
    const SIZE = 54;
    const dpr  = window.devicePixelRatio || 1;

    // Scharf auf Retina/HiDPI: physische Pixelgröße hochskalieren, CSS-Größe fix lassen
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width  = SIZE + 'px';
    canvas.style.height = SIZE + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = SIZE / 2, cy = SIZE / 2, r = 23, innerR = 13;
    const colors = ['#4CAF93','#e07b2a','#e05a5a','#c04040','#a03030','#777'];

    const segments = [];
    const maxRound = Math.max(...Object.keys(roundCounts).map(Number), 0);
    for (let i = 0; i <= maxRound; i++) {
      if (roundCounts[i]) segments.push({ count: roundCounts[i], color: colors[Math.min(i, colors.length-1)] });
    }
    if (neverCorrect > 0) segments.push({ count: neverCorrect, color: '#444' });

    ctx.clearRect(0, 0, SIZE, SIZE);
    let startAngle = -Math.PI / 2;
    segments.forEach(seg => {
      const slice = (seg.count / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.closePath(); ctx.fillStyle = seg.color; ctx.fill();
      startAngle += slice;
    });

    // Loch in der Mitte
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#1a1a1a';
    ctx.fill();

    // Prozent-Text
    const pct = Math.round((roundCounts[0]||0) / total * 100);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(pct + '%', cx, cy);
  },

  // ── Tabellen-Ansicht ──────────────────────────────────────
  viewTable(id, type, isDraft) {
    state.tableViewId = id; state.tableViewType = type;
    const t = this._list(type, isDraft).find(x => x.id === id);
    if (!t) return;
    document.getElementById('table-view-title').textContent = t.name;
    document.getElementById('table-view-admin-btns').classList.toggle('hidden', !state.adminLoggedIn);

    const searchWrap = document.getElementById('table-view-search');
    if (type === 'vokabel') {
      searchWrap.classList.remove('hidden');
      ['table-search-input', 'table-filter-genus', 'table-filter-klasse', 'table-filter-type']
        .forEach(i => { document.getElementById(i).value = ''; });
      VokSearch.initTableSearch(id, t.rows || []);
    } else {
      searchWrap.classList.add('hidden');
    }

    document.getElementById('table-view-content').innerHTML =
      type === 'pronomen' ? this._renderPronomenTable(t) : this._renderVokabelTable(t);
    document.getElementById('vok-quiz-start-btn').classList.toggle('btn--hidden', !!isDraft);
    App.showPage('table-view', t.name);
  },

  editTableFromView() { this.openEditor(state.tableViewType, state.tableViewId); },

  // ── Löschen / Entwürfe ────────────────────────────────────
  confirmDelete(id, type) {
    const t = this._list(type, false).find(x => x.id === id); if (!t) return;
    state.actionId = id; state.actionType = type; state.actionIsDraft = false;
    document.getElementById('table-action-title').textContent = t.name;
    document.getElementById('table-action-desc').textContent  = t.desc || '';
    document.getElementById('table-action-overlay').classList.remove('hidden');
  },
  closeAction(e) {
    if (e && e.target !== document.getElementById('table-action-overlay')) return;
    document.getElementById('table-action-overlay').classList.add('hidden');
  },
  editFromAction() {
    const {actionId: id, actionType: type, actionIsDraft: isDraft} = state;
    document.getElementById('table-action-overlay').classList.add('hidden');
    type === 'pronomen' ? this.openPronomenEditor(id, isDraft?'draft':null) : this.openVokabelEditor(id, isDraft?'draft':null);
  },
  async deleteFromAction() {
    const {actionId: id, actionType: type, actionIsDraft: isDraft} = state;
    document.getElementById('table-action-overlay').classList.add('hidden');
    const col = isDraft
      ? (type==='pronomen' ? COL.pronomenDrafts : COL.vokabelDrafts)
      : (type==='pronomen' ? COL.pronomen       : COL.vokabel);
    try { await col.doc(id).delete(); } catch(e) { alert('Fehler: '+e.message); }
  },

  async publishTableDraft(id, type, btn) {
    const arr = type==='pronomen' ? state.pronomenDrafts : state.vokabelDrafts;
    const draft = arr.find(x => x.id === id); if (!draft) return;
    if (btn) { btn.textContent='…'; btn.disabled=true; }
    const pubId    = (type==='pronomen'?'pt_':'vt_') + Date.now();
    const pubCol   = type==='pronomen' ? COL.pronomen       : COL.vokabel;
    const draftCol = type==='pronomen' ? COL.pronomenDrafts : COL.vokabelDrafts;
    try {
      await pubCol.doc(pubId).set({...draft, id:pubId, order:Date.now()});
      await draftCol.doc(id).delete();
    } catch(e) { alert('Fehler: '+e.message); if(btn){btn.textContent='Veröffentlichen';btn.disabled=false;} }
  },

  async deleteTableDraft(id, type) {
    if (!confirm('Entwurf löschen?')) return;
    const col = type==='pronomen' ? COL.pronomenDrafts : COL.vokabelDrafts;
    try { await col.doc(id).delete(); } catch(e) { alert('Fehler: '+e.message); }
  }
};
