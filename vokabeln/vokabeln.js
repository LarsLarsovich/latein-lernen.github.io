'use strict';

// ── Vokabeln: Übersicht, Listen-Editor, Suche und Lernmodi ────
// Ergänzt Tables (gemeinsam/tabellen.js) um alles, was nur Vokabellisten betrifft,
// und App (gemeinsam/shell.js) um den Weg vom Klick auf „Quiz" bis zum Start.

Object.assign(Tables, {

  _renderVokabelTable(t) {
    const items = (t.rows || []).map((r, idx) => ({ r, idx, tid: t.id }));
    return `<div class="table-desc">${escHtml(t.desc||'')}</div>`
      + VokSearch._renderRows(items, t.id, false)
      + `<div class="vok-table-hint">Auf ein Wort tippen für Details &amp; Deklination/Konjugation</div>`;
  },

  // ── Listen-Editor ─────────────────────────────────────────
  _vokEditorMode: 'form',
  openVokabelEditor(id, source) {
    const isNew = !id, isDraft = source==='draft';
    document.getElementById('vokabel-editor-title').textContent = isNew ? 'Neue Vokabel-Tabelle' : 'Vokabel-Tabelle bearbeiten';
    document.getElementById('vt-error').classList.add('hidden');
    state.editingId = id||null; state.editingSource = isDraft ? 'vokabel-draft' : 'vokabel';
    this._vokEditorMode = 'form';
    document.getElementById('vt-name').value = '';
    document.getElementById('vt-desc').value = '';
    document.getElementById('vok-mode-form-btn').classList.add('active');
    document.getElementById('vok-mode-text-btn').classList.remove('active');
    document.getElementById('vok-form-view').classList.remove('hidden');
    document.getElementById('vok-text-view').classList.add('hidden');
    const rowsEl = document.getElementById('vokabel-rows');
    rowsEl.innerHTML = '';
    if (isNew) { this.addVokabelRow(); this.addVokabelRow(); this.addVokabelRow(); }
    else {
      const t = this._list('vokabel', isDraft).find(x => x.id === id);
      if (t) {
        document.getElementById('vt-name').value = t.name||'';
        document.getElementById('vt-desc').value = t.desc||'';
        (t.rows||[]).forEach(r => this.addVokabelRow(r));
        if (!t.rows?.length) this.addVokabelRow();
      } else { this.addVokabelRow(); }
    }
    App.showPage('vokabel-editor', isNew ? 'Neue Vokabeln' : 'Vokabeln bearbeiten');
  },

  switchVokMode(mode) {
    if (mode === this._vokEditorMode) return;
    if (mode === 'text') {
      const rows  = this._readFormRows();
      const f = v => (v && v !== '–') ? v : '#';
      const lines = rows.map((r,i) => `${i+1}. ${f(r.lat)}-${f(r.fall2)}-${f(r.genus)}-${f(r.dekl)}-${f(r.de)}-${f(r.perf)}-${f(r.deGenus)}`);
      document.getElementById('vok-textarea').value = lines.join('\n');
    } else {
      const rows   = this._parseTextRows(document.getElementById('vok-textarea').value);
      const rowsEl = document.getElementById('vokabel-rows'); rowsEl.innerHTML = '';
      rows.length ? rows.forEach(r => this.addVokabelRow(r)) : this.addVokabelRow();
    }
    this._vokEditorMode = mode;
    document.getElementById('vok-mode-form-btn').classList.toggle('active', mode==='form');
    document.getElementById('vok-mode-text-btn').classList.toggle('active', mode==='text');
    document.getElementById('vok-form-view').classList.toggle('hidden', mode!=='form');
    document.getElementById('vok-text-view').classList.toggle('hidden', mode!=='text');
  },

  _readFormRows() {
    return [...document.querySelectorAll('.vokabel-row')].map(r => ({
      lat:   r.querySelector('.vok-lat').value.trim(),
      fall2: r.querySelector('.vok-fall2').value.trim(),
      genus: r.querySelector('.vok-genus').value,
      dekl:  r.querySelector('.vok-dekl').value,
      de:    r.querySelector('.vok-de').value.trim(),
      perf:  r.querySelector('.vok-perf').value.trim(),
      deGenus: r.querySelector('.vok-degenus').value === '–' ? '' : r.querySelector('.vok-degenus').value
    })).filter(r => r.lat || r.de);
  },

  _parseTextRows(text) {
    const rows = [];
    const normalized = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const lines = normalized.includes('\n')
      ? normalized.split('\n')
      : normalized.split(/(?<=\S)\s+(?=[a-zA-ZäöüÄÖÜ][a-zA-ZäöüÄÖÜ]*-)/);
    lines.forEach(line => {
      line = line.trim(); if (!line || line.startsWith('//')) return;
      line = line.replace(/^\d+[.)\s]+/,'');
      const bracketMap = {}; let bi = 0;
      const protected_ = line.replace(/\([^)]+\)/g, match => { const key=`__B${bi++}__`; bracketMap[key]=match; return key; });
      const parts = protected_.split('-'); if (parts.length < 1) return;
      const restore = s => { let r=s; Object.entries(bracketMap).forEach(([k,v])=>{r=r.split(k).join(v);}); return r; };
      const clean   = v => { if (!v) return ''; const s=restore(v).trim(); return (s&&s!=='#')?s:''; };
      // Feld 5 = Deutsch, Feld 6 = 1. Person Perfekt (optional), Feld 7 = deutsches Geschlecht (optional).
      // Deutsch darf selbst Bindestriche enthalten, deshalb wird von hinten gezählt.
      const tail    = parts.slice(5).map(p => restore(p).trim());
      const isGenus = v => /^(m\.|f\.|n\.|#)$/.test(v);
      let deGenus = '', perf = '', deEnd = parts.length;
      if (tail.length >= 2 && isGenus(tail[tail.length-1])) {
        deGenus = tail[tail.length-1] === '#' ? '' : tail[tail.length-1];
        perf    = tail[tail.length-2];
        deEnd   = parts.length - 2;
      } else if (tail.length >= 1) {
        perf  = tail[tail.length-1];
        deEnd = parts.length - 1;
      }
      if (perf === '#') perf = '';
      const deRaw   = parts.slice(4, deEnd).map(restore).join('-').trim();
      const deNorm  = deRaw==='#' ? '' : deRaw.replace(/\s*\/\s*/g,'%').replace(/\s*,\s*/g,'%');
      const de      = deNorm ? expandBrackets(deNorm) : '';
      rows.push({ lat:clean(parts[0]), fall2:clean(parts[1]), genus:clean(parts[2])||'–', dekl:clean(parts[3])||'–', de, perf, deGenus });
    });
    return rows.filter(r => r.lat);
  },

  addVokabelRow(data = {}) {
    const wrap = document.getElementById('vokabel-rows');
    const row  = document.createElement('div'); row.className = 'vokabel-row';
    row.innerHTML = `
      <div class="vok-row-grid">
        <div class="vok-cell"><label class="vok-label">Latein</label>
          <input type="text" class="modal-input vok-lat" placeholder="z.B. aqua" autocorrect="off" autocapitalize="off" spellcheck="false" value="${escHtml(data.lat||'')}"/></div>
        <div class="vok-cell"><label class="vok-label" title="Nomen: 2. Fall · Verben: 1. Person Präsens">2. Fall / Präsens</label>
          <input type="text" class="modal-input vok-fall2" placeholder="z.B. aquae" autocorrect="off" autocapitalize="off" spellcheck="false" value="${escHtml(data.fall2||'')}"/></div>
        <div class="vok-cell vok-cell-sm"><label class="vok-label">Genus</label>
          <select class="modal-input vok-genus">${GENUS_OPTS.map(o=>`<option${(data.genus||'–')===o?' selected':''}>${o}</option>`).join('')}</select></div>
        <div class="vok-cell vok-cell-sm"><label class="vok-label">Deklination</label>
          <select class="modal-input vok-dekl">${DEKL_OPTS.map(o=>`<option${(data.dekl||'–')===o?' selected':''}>${o}</option>`).join('')}</select></div>
        <div class="vok-cell"><label class="vok-label">Deutsch</label>
          <input type="text" class="modal-input vok-de" placeholder="Übersetzung" autocorrect="off" spellcheck="false" value="${escHtml(data.de||'')}"/></div>
        <div class="vok-cell vok-cell-sm"><label class="vok-label" title="Nur nötig, wenn das deutsche Wort ein anderes Geschlecht hat (annus m. → das Jahr)">Genus Dt.</label>
          <select class="modal-input vok-degenus">${GENUS_OPTS.map(o=>`<option${(data.deGenus||'–')===o?' selected':''}>${o}</option>`).join('')}</select></div>
        <div class="vok-cell"><label class="vok-label" title="Nur bei Verben: 1. Person Perfekt">Perfekt</label>
          <input type="text" class="modal-input vok-perf" placeholder="z.B. amavi" autocorrect="off" autocapitalize="off" spellcheck="false" value="${escHtml(data.perf||'')}"/></div>
        <div class="vok-cell vok-cell-del"><label class="vok-label">&nbsp;</label>
          <button class="row-del-btn" onclick="this.closest('.vokabel-row').remove()" title="Löschen">✕</button></div>
      </div>`;
    wrap.appendChild(row);
  },

  copyAiPrompt(btn) {
    const prompt = `You are a Latin vocabulary extractor for a German-speaking school. Extract the vocabulary in EXACTLY this format — one entry per line, 7 fields separated by "-":

Latin-SecondField-Gender-Declension-German-Perfect-GermanGender

Fields:
(1) Latin: nominative singular / infinitive / adjective with all genders (bonus/a/um, pulcher/ra/rum, nobilis/e)
(2) Nouns: genitive singular, written out (aquae). Verbs: 1st person singular present (clamo). Otherwise #
(3) Latin gender of nouns: m. / f. / n. — otherwise #
(4) Declension of nouns: 1. Dekl. / 2. Dekl. / 3. Dekl. / 4. Dekl. / 5. Dekl. — otherwise #
(5) German meaning. Several meanings are separated by % (never by / or comma). Verbs as infinitive. Notes like (+Akk.) in brackets.
(6) Verbs: 1st person singular perfect (clamavi, gavisus sum) — otherwise #
(7) Nouns: grammatical gender of the FIRST German meaning: m. / f. / n. (annus = "Jahr" → n., because "das Jahr") — otherwise #

Rules: Use # for every field that does not apply. No spaces around -. No headers, no numbering, no explanations.

Examples:
aqua-aquae-f.-1. Dekl.-Wasser%Flüssigkeit-#-n.
annus-anni-m.-2. Dekl.-Jahr-#-n.
rex-regis-m.-3. Dekl.-König-#-m.
bonus/a/um-#-#-#-gut-#-#
clamare-clamo-#-#-rufen%schreien-clamavi-#
esse-sum-#-#-sein-fui-#
nunc-#-#-#-jetzt%nun-#-#

Now extract all vocabulary from the provided content.`;
    navigator.clipboard.writeText(prompt).then(()=>{
      const orig=btn.textContent; btn.textContent='✓ Kopiert!';
      setTimeout(()=>{btn.textContent=orig;},2000);
    }).catch(()=>{ window.prompt('Prompt kopieren:', prompt); });
  },

  importTextVokabeln() {
    const raw  = document.getElementById('vok-textarea').value;
    const rows = this._parseTextRows(raw);
    if (!rows.length) { alert('Keine gültigen Zeilen gefunden.\nFormat: Latein-2.Fall-Genus-Deklination-Deutsch-Perfekt-GenusDeutsch\nLeere Felder als # angeben.'); return; }
    document.getElementById('vokabel-rows').innerHTML = '';
    rows.forEach(r => this.addVokabelRow(r));
    this.switchVokMode('form');
    document.getElementById('vok-textarea').value = '';
  },

  // Beim Speichern einer Liste werden die Zeilen neu aus dem Editor gelesen.
  // Damit von Hand eingetragene Formen und die festgelegte Wortart nicht verloren
  // gehen, werden sie über das lateinische Wort wieder zugeordnet.
  _carryOver(rows) {
    if (!state.editingId) return;
    const prev = state.vokabel.find(x => x.id === state.editingId)
              || state.vokabelDrafts.find(x => x.id === state.editingId);
    if (!prev) return;
    const byLat = {};
    (prev.rows || []).forEach((r, idx) => {
      const legacy = prev.overrides && prev.overrides[idx];
      const forms  = r.forms || (legacy ? VokForms.snapshot(r, legacy) : null);
      if ((forms || r.type) && r.lat && !(r.lat in byLat)) byLat[r.lat] = { forms, type: r.type };
    });
    rows.forEach(r => {
      const keep = byLat[r.lat];
      if (!keep) return;
      if (keep.forms) r.forms = keep.forms;
      if (keep.type)  r.type  = keep.type;
    });
  },

  async saveVokabelDraft() {
    const name = document.getElementById('vt-name').value.trim();
    const desc = document.getElementById('vt-desc').value.trim();
    const err  = document.getElementById('vt-error');
    if (!name) { err.textContent='Bitte gib einen Namen ein.'; err.classList.remove('hidden'); return; }
    const rows = this._vokEditorMode==='text'
      ? this._parseTextRows(document.getElementById('vok-textarea').value)
      : this._readFormRows();
    err.classList.add('hidden');
    const btn = document.getElementById('vt-draft-btn');
    if (btn) { btn.textContent='…'; btn.disabled=true; }
    // Use existing draft ID if editing a draft, else new ID
    this._carryOver(rows);
    const docId = (state.editingSource==='vokabel-draft' && state.editingId)
      ? state.editingId : 'vd_'+Date.now();
    try {
      await COL.vokabelDrafts.doc(docId).set({id:docId, order:Date.now(), name, desc, rows});
      state.editingId = null; state.editingSource = null;
      App.goHome();
    } catch(e) {
      console.error('saveVokabelDraft error:', e);
      err.textContent='Fehler: '+e.message; err.classList.remove('hidden');
    }
    finally { if (btn) { btn.textContent='Als Entwurf speichern'; btn.disabled=false; } }
  },

  async saveVokabel() {
    const name = document.getElementById('vt-name').value.trim();
    const desc = document.getElementById('vt-desc').value.trim();
    const err  = document.getElementById('vt-error');
    if (!name) { err.textContent='Bitte gib einen Namen ein.'; err.classList.remove('hidden'); return; }
    const rows = this._vokEditorMode==='text'
      ? this._parseTextRows(document.getElementById('vok-textarea').value)
      : this._readFormRows();
    if (!rows.length) { err.textContent='Bitte füge mindestens eine Vokabel hinzu.'; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');
    const btn   = document.getElementById('vt-save-btn'); btn.textContent='…'; btn.disabled=true;
    this._carryOver(rows);
    const fromDraft = state.editingSource==='vokabel-draft' && state.editingId;
    const existing  = !fromDraft && state.editingId ? state.vokabel.find(x => x.id === state.editingId) : null;
    const docId     = existing ? existing.id : 'vt_'+Date.now();
    try {
      // Reihenfolge bleibt beim Bearbeiten erhalten; alte Teil-Überschreibungen stecken jetzt in rows[].forms
      await COL.vokabel.doc(docId).set({id:docId, order:existing ? (existing.order||Date.now()) : Date.now(), name, desc, rows});
      if (fromDraft) await COL.vokabelDrafts.doc(state.editingId).delete();
      state.editingId = null; state.editingSource = null;
      App.goHome();
    } catch(e) { err.textContent='Fehler: '+e.message; err.classList.remove('hidden'); }
    finally { btn.textContent='Speichern'; btn.disabled=false; }
  }
});

// ── Vokabel-Suchmaschine ──────────────────────────────────────
const VokSearch = {
  _currentTableId: null, _currentTableRows: [], _sortMode: 'lat',

  // Alles, wonach man suchen kann: Grundformen, Übersetzungen und jede gebeugte Form
  _allForms(r, legacy) {
    const forms = new Set();
    const add   = s => { if (Latin._has(s)) forms.add(String(s).toLowerCase()); };
    add(r.lat); add(r.fall2); add(r.perf); add(r.de);
    (r.lat || '').split(/[%/]/).forEach(x => add(x.trim()));
    (r.de  || '').split('%').forEach(x => add(x.trim()));
    VokForms.allValues(r, legacy).forEach(add);
    return forms;
  },

  // f = { query, genus, klasse, type }
  //   klasse: "d:3. Dekl." (Deklination) oder "k:a" (Konjugation, k:irr = unregelmäßig)
  //   type:   noun | verb | adj | indecl
  _matches(r, f, legacy) {
    const type = Latin.detectType(r);
    if (f.type  && type !== f.type) return false;
    if (f.genus && (r.genus || '') !== f.genus) return false;
    if (f.klasse) {
      const [kind, val] = [f.klasse[0], f.klasse.slice(2)];
      if (kind === 'd' && (r.dekl || '') !== val) return false;
      if (kind === 'k' && (type !== 'verb' || (Latin.verbClass(r.lat, r.fall2) || 'irr') !== val)) return false;
    }
    const q = (f.query || '').toLowerCase().trim();
    if (!q) return true;
    return [...this._allForms(r, legacy)].some(x => x.includes(q));
  },

  _filters(prefix) {
    const v = id => document.getElementById(id).value;
    return prefix === 'table'
      ? { query: v('table-search-input'), genus: v('table-filter-genus'), klasse: v('table-filter-klasse'), type: v('table-filter-type') }
      : { query: v('alle-search-input'),  genus: v('filter-genus'),       klasse: v('filter-klasse'),       type: v('filter-type') };
  },

  _legacyOf(tid, idx) {
    const t = state.vokabel.find(x => x.id === tid);
    return (t && t.overrides && t.overrides[idx]) || null;
  },

  // Vokabeltabelle. Spalten:
  //   Latein | 2. Fall / 1. Person Präsens | Genus / 1. Person Perfekt | Dekl. / Konj. | Übersetzung
  // Leere Zellen bekommen einen Strich.
  _renderRows(rows, tableId, showSource) {
    if (!rows.length) return '<div class="empty-hint">Keine Vokabeln gefunden.</div>';
    const cell = v => Latin._has(v) ? escHtml(String(v).trim()) : '–';
    let html = '<div class="dekl-table-wrap"><table class="dekl-table vok-table"><thead><tr>'
      + '<th>Latein</th>'
      + '<th>2. Fall<span class="th-alt">1. Pers. Präsens</span></th>'
      + '<th>Genus<span class="th-alt">1. Pers. Perfekt</span></th>'
      + '<th>Dekl.<span class="th-alt">Konj.</span></th>'
      + '<th>Übersetzung</th>';
    if (showSource) html += '<th>Liste</th>';
    html += '<th></th></tr></thead><tbody>';
    rows.forEach(({r,idx,tid,tname}) => {
      const type    = Latin.detectType(r);
      const clickId = tid||tableId;
      const lat     = (r.lat||'').split('%').map(s=>s.trim()).filter(Boolean).join(', ');
      const third   = type === 'verb' ? r.perf : r.genus;
      html += `<tr class="vok-row-clickable" onclick="VokDetail.open(${idx},'${clickId}')">`
        + `<td><strong>${cell(lat)}</strong></td><td>${cell(r.fall2)}</td><td>${cell(third)}</td>`
        + `<td>${cell(Latin.klassShort(r, type))}</td><td>${escHtml(VokabelQuiz.formatGerman(r)).replace(/^\?$/, '–')}</td>`;
      if (showSource) html += `<td class="vok-source-cell">${escHtml(tname||'')}</td>`;
      html += `<td class="vok-row-arrow">›</td></tr>`;
    });
    return html + '</tbody></table></div>';
  },

  openAlleVokabeln() {
    this._sortMode = 'lat';
    ['alle-search-input','filter-genus','filter-klasse','filter-type'].forEach(id => { document.getElementById(id).value = ''; });
    this._updateSortBtns(); this.search();
    App.showPage('alle-vokabeln', 'Alle Vokabeln');
  },

  setSortMode(mode) { this._sortMode=mode; this._updateSortBtns(); this.search(); },

  _updateSortBtns() {
    document.getElementById('sort-btn-lat')?.classList.toggle('active', this._sortMode==='lat');
    document.getElementById('sort-btn-de')?.classList.toggle('active',  this._sortMode==='de');
  },

  // Suche über alle Listen
  search() {
    const f       = this._filters('alle');
    const tables  = [...state.vokabel].sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true,sensitivity:'base'}));
    const matched = [];
    tables.forEach(t => (t.rows||[]).forEach((r,idx) => {
      if (this._matches(r, f, t.overrides && t.overrides[idx])) matched.push({r,idx,tid:t.id,tname:t.name});
    }));
    const key = this._sortMode==='lat' ? 'lat' : 'de';
    matched.sort((a,b)=>(a.r[key]||'').localeCompare(b.r[key]||'','de',{sensitivity:'base'}));
    document.getElementById('alle-count-badge').textContent = matched.length + ' Vokabeln';
    document.getElementById('alle-vok-results').innerHTML   = this._renderRows(matched, null, true);
  },

  initTableSearch(tableId, rows) { this._currentTableId=tableId; this._currentTableRows=rows; },

  // Suche in der geöffneten Liste
  searchTable() {
    const f = this._filters('table'), tid = this._currentTableId;
    const matched = this._currentTableRows
      .map((r,idx)=>({r,idx,tid}))
      .filter(({r,idx})=>this._matches(r, f, this._legacyOf(tid, idx)));
    document.getElementById('table-view-content').innerHTML = this._renderRows(matched, tid, false);
  }
};

// ── Lernmodi und Quiz-Start ───────────────────────────────────
Object.assign(App, {

  // Übersicht der Vokabel-Seite
  renderVokabelHome() {
    Tables.renderOverview('vokabel');
    const lists = state.vokabel.length;
    const words = state.vokabel.reduce((s, t) => s + (t.rows?.length || 0), 0);
    this.setTopicInfo(lists ? `${words} Vokabeln in ${lists} Listen. Wähle eine Liste oder such im ganzen Wortschatz.` : '');
    this._openDeepLink();
  },

  // Link von der Meldungen-Seite: …/vokabeln/index.html?vok=<Listen-ID>:<Zeile>
  _openDeepLink() {
    if (this._deepLinkDone || !state.vokabel.length) return;
    this._deepLinkDone = true;
    const m = (new URLSearchParams(location.search).get('vok') || '').match(/^(.+):(\d+)$/);
    if (m && state.vokabel.some(t => t.id === m[1])) VokDetail.open(parseInt(m[2], 10), m[1]);
  },

  // ── Alle Vokabeln Quiz ────────────────────────────────────
  openAlleVokabelQuiz() {
    const total  = state.vokabel.reduce((s,t) => (t.rows?.length||0)+s, 0);
    const slider = document.getElementById('alle-quiz-count');
    const label  = document.getElementById('alle-quiz-count-label');
    const hint   = document.getElementById('alle-quiz-max-hint');
    if (slider) { slider.max = total; slider.value = Math.min(20, total); }
    if (label)  label.textContent = Math.min(20, total);
    if (hint)   hint.textContent  = `Max. ${total} Vokabeln verfügbar`;
    document.getElementById('alle-quiz-overlay').classList.remove('hidden');
  },

  closeAlleQuiz(e) {
    if (e && e.target !== document.getElementById('alle-quiz-overlay')) return;
    document.getElementById('alle-quiz-overlay').classList.add('hidden');
  },

  startAlleVokabelQuiz() {
    const count = parseInt(document.getElementById('alle-quiz-count').value) || 20;

    const sorted = [...state.vokabel].sort((a,b) => a.name.localeCompare(b.name,'de',{numeric:true}));
    let allRows  = [];
    sorted.forEach(t => (t.rows||[]).forEach(r => allRows.push(r)));
    allRows = allRows.sort(() => Math.random() - 0.5).slice(0, count);

    // Alle Vokabeln werden als lat-de vorgeladen; Richtung/Mischen/Prüfung folgt auf dem nächsten Screen
    const questions = VokabelQuiz.build(allRows, ['lat-de'], true);
    if (!questions.length) { alert('Keine Vokabeln gefunden.'); return; }

    document.getElementById('alle-quiz-overlay').classList.add('hidden');
    state._pendingQuizConfig = { rows: allRows, questions, name: 'Alle Vokabeln', origin: 'alle', pruefung: false };
    document.getElementById('quiz-mode-title').textContent = 'Alle Vokabeln';
    this.showPage('quiz-mode', 'Alle Vokabeln');
  },

  openCustomQuiz() {
    const list   = document.getElementById('custom-quiz-list');
    if (!list) return;
    const sorted = [...state.vokabel].sort((a,b) => a.name.localeCompare(b.name,'de',{numeric:true}));
    list.innerHTML = sorted.map(t => `
      <label class="custom-quiz-item">
        <input type="checkbox" name="cqlist" value="${t.id}" />
        <span class="custom-quiz-name">${escHtml(t.name)}</span>
        <span class="custom-quiz-count">${(t.rows||[]).length} Vok.</span>
      </label>`).join('');
    document.getElementById('custom-quiz-overlay').classList.remove('hidden');
  },

  closeCustomQuiz(e) {
    if (e && e.target !== document.getElementById('custom-quiz-overlay')) return;
    document.getElementById('custom-quiz-overlay').classList.add('hidden');
  },

  startCustomQuiz() {
    const selectedIds = [...document.querySelectorAll('input[name="cqlist"]:checked')].map(c=>c.value);
    if (!selectedIds.length) { alert('Bitte mindestens eine Liste auswählen.'); return; }

    const allRows = [];
    selectedIds.forEach(id => {
      const t = state.vokabel.find(x => x.id === id);
      if (t) (t.rows||[]).forEach(r => allRows.push(r));
    });

    // Richtung/Mischen/Prüfung folgt auf dem nächsten Screen
    const questions = VokabelQuiz.build(allRows, ['lat-de'], true);
    if (!questions.length) { alert('Keine Vokabeln in den gewählten Listen.'); return; }

    document.getElementById('custom-quiz-overlay').classList.add('hidden');
    const names = selectedIds.map(id => state.vokabel.find(x=>x.id===id)?.name||'').filter(Boolean);
    const name  = names.join(' + ');
    state._pendingQuizConfig = { rows: allRows, questions, name, origin: 'custom', pruefung: false, customIds: selectedIds };
    document.getElementById('quiz-mode-title').textContent = name;
    this.showPage('quiz-mode', name);
  },

  openVokabelQuizSetup(tableId) {
    const t = state.vokabel.find(x => x.id === tableId);
    if (!t) return;
    state._pendingQuizConfig = { rows: t.rows || [], name: t.name, origin: 'table', tableId };
    document.getElementById('quiz-mode-title').textContent = t.name;
    this.showPage('quiz-mode', t.name);
  },

  selectQuizMode(mode) {
    const cfg = state._pendingQuizConfig;
    if (!cfg) return;
    if (mode === 'flashcards') {
      Flashcards.start(cfg.rows, cfg.name);
    } else if (mode === 'matching') {
      Matching.start(cfg.rows, cfg.name);
    } else {
      // Eingeben: immer über Setup-Seite (Richtung, Mischen, Prüfung wählen)
      state.quizType = 'vokabel';
      state._quizOrigin = cfg.origin;
      if (cfg.origin === 'custom') state._customQuizIds = cfg.customIds;
      if (cfg.origin === 'table') {
        const t = state.vokabel.find(x => x.id === cfg.tableId);
        if (!t) return;
        state.currentVokabelTable = t;
        state.lastQuizId = cfg.tableId; state.lastQuizSource = 'vokabel';
      } else {
        state.currentVokabelTable = { name: cfg.name, rows: cfg.rows };
      }
      document.getElementById('setup-title').textContent = cfg.name;
      document.getElementById('setup-desc').textContent  = cfg.rows.length + ' Vokabeln';
      document.getElementById('setup-pronomen').classList.add('hidden');
      document.getElementById('setup-vokabel').classList.remove('hidden');
      // Standardmäßig ist keine Richtung ausgewählt
      document.querySelectorAll('input[name="vphase"]').forEach(rb => { rb.checked = false; });
      document.getElementById('vok-shuffle').checked = false;
      this.onVokDirectionChange();
      this.showPage('setup', cfg.name);
    }
  },

  // Knopf „Quiz starten" in der Listenansicht
  startTableQuiz() { this.openVokabelQuizSetup(state.tableViewId); },

  // „Nochmal" nach einem Quiz
  replaySetup() {
    const origin = state._quizOrigin;
    if (origin === 'alle') { this.goHome(); this.openAlleVokabelQuiz(); }
    else if (origin === 'custom') {
      this.goHome(); this.openCustomQuiz();
      (state._customQuizIds || []).forEach(id => {
        const cb = document.querySelector(`input[name="cqlist"][value="${id}"]`);
        if (cb) cb.checked = true;
      });
    }
    else if (origin === 'table' && state.lastQuizId) this.openVokabelQuizSetup(state.lastQuizId);
    else this.goHome();
  }
});
