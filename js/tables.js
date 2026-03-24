'use strict';

// ── Tabellen-Modul ────────────────────────────────────────────
const Tables = {

  viewTable(id, type, isDraft) {
    state.tableViewId = id; state.tableViewType = type;
    const arr = isDraft
      ? (type==='pronomen' ? state.pronomenDrafts : state.vokabelDrafts)
      : (type==='pronomen' ? state.pronomen       : state.vokabel);
    const t = arr.find(x => x.id === id);
    if (!t) return;
    document.getElementById('table-view-title').textContent = t.name;
    document.getElementById('table-view-admin-btns').classList.toggle('hidden', !state.adminLoggedIn);

    const searchWrap = document.getElementById('table-view-search');
    if (type === 'vokabel') {
      searchWrap.classList.remove('hidden');
      document.getElementById('table-search-input').value = '';
      document.getElementById('table-filter-genus').value = '';
      document.getElementById('table-filter-dekl').value  = '';
      VokSearch.initTableSearch(id, t.rows || []);
    } else {
      searchWrap.classList.add('hidden');
    }

    document.getElementById('table-view-content').innerHTML =
      type === 'pronomen' ? this._renderPronomenTable(t) : this._renderVokabelTable(t);

    const quizBtn = document.getElementById('vok-quiz-start-btn');
    if (quizBtn) quizBtn.classList.toggle('btn--hidden', !!isDraft);
    App.showPage('table-view', t.name);
  },

  _renderPronomenTable(t) {
    let html = `<div class="table-desc">${t.desc||''}</div>`;
    html += `<div class="forms-section-title">Singular</div>`;
    html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th></th><th>Maskulinum</th><th>Femininum</th><th>Neutrum</th></tr></thead><tbody>`;
    CASES.forEach(c => {
      html += `<tr><td class="case-cell">${CASE_NAMES[c]}</td>`;
      GENDERS.forEach(g => { html += `<td>${t.sg?.[g]?.[c]||'–'}</td>`; });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    html += `<div class="forms-section-title forms-section-title--spaced">Plural</div>`;
    html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th></th><th>Maskulinum</th><th>Femininum</th><th>Neutrum</th></tr></thead><tbody>`;
    CASES.forEach(c => {
      html += `<tr><td class="case-cell">${CASE_NAMES[c]}</td>`;
      GENDERS.forEach(g => { html += `<td>${t.pl?.[g]?.[c]||'–'}</td>`; });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    if (t.de_sg) {
      html += `<div class="forms-section-title forms-section-title--spaced">Deutsche Entsprechungen</div>`;
      html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th></th><th>M Sg.</th><th>F Sg.</th><th>N Sg.</th><th>M Pl.</th><th>F Pl.</th><th>N Pl.</th></tr></thead><tbody>`;
      CASES.forEach(c => {
        html += `<tr><td class="case-cell">${CASE_NAMES[c]}</td>`;
        GENDERS.forEach(g => { html += `<td>${t.de_sg?.[g]?.[c]||'–'}</td>`; });
        GENDERS.forEach(g => { html += `<td>${t.de_pl?.[g]?.[c]||'–'}</td>`; });
        html += `</tr>`;
      });
      html += `</tbody></table></div>`;
    }
    return html;
  },

  _renderVokabelTable(t) {
    const rows = t.rows || [];
    let html = `<div class="table-desc">${t.desc||''}</div>`;
    html += `<div class="dekl-table-wrap"><table class="dekl-table vok-table"><thead><tr><th>Latein</th><th>2. Fall</th><th>Genus</th><th>Dekl.</th><th>Übersetzung</th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      const _de = (r.de||'–').split('%').join(' / ');
      html += `<tr class="vok-row-clickable" onclick="VokDetail.open(${i},'${t.id}')">
        <td><strong>${r.lat||'–'}</strong></td><td>${r.fall2||'–'}</td>
        <td>${r.genus||'–'}</td><td>${r.dekl||'–'}</td><td>${_de}</td>
        <td class="vok-row-arrow">›</td></tr>`;
    });
    html += `</tbody></table></div>`;
    html += `<div class="vok-table-hint">Auf ein Wort tippen für Details &amp; Deklination/Konjugation</div>`;
    return html;
  },

  confirmDelete(id, type) {
    const arr = type==='pronomen' ? state.pronomen : state.vokabel;
    const t   = arr.find(x => x.id === id); if (!t) return;
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
  },

  openPronomenEditor(id, source) {
    const isNew = !id, isDraft = source==='draft';
    document.getElementById('pronomen-editor-title').textContent = isNew ? 'Neue Pronomen-Tabelle' : 'Pronomen-Tabelle bearbeiten';
    document.getElementById('pt-error').classList.add('hidden');
    state.editingId = id||null; state.editingSource = isDraft ? 'pronomen-draft' : 'pronomen';
    if (isNew) { App._clearQuizForm('pt-'); }
    else {
      const arr = isDraft ? state.pronomenDrafts : state.pronomen;
      const t   = arr.find(x => x.id === id);
      t ? App._fillQuizForm('pt-', t) : App._clearQuizForm('pt-');
    }
    App.showPage('pronomen-editor', isNew ? 'Neue Tabelle' : 'Bearbeiten');
  },

  async savePronomenDraft() {
    const data = App._readQuizForm('pt-');
    if (!App._validateQuiz(data,'pt-error',false)) return;
    document.getElementById('pt-error').classList.add('hidden');
    const btn = document.getElementById('pt-draft-btn'); btn.textContent='…'; btn.disabled=true;
    const isEdit = state.editingSource==='pronomen-draft' && state.editingId;
    const docId  = isEdit ? state.editingId : 'ptd_'+Date.now();
    try {
      await COL.pronomenDrafts.doc(docId).set({id:docId, order:Date.now(), ...data});
      App.goHome(); setTimeout(()=>App.switchTab('tables'),100);
    } catch(e) { document.getElementById('pt-error').textContent='Fehler: '+e.message; document.getElementById('pt-error').classList.remove('hidden'); }
    finally { btn.textContent='Als Entwurf speichern'; btn.disabled=false; }
  },

  async savePronomen() {
    const data = App._readQuizForm('pt-');
    if (!App._validateQuiz(data,'pt-error',false)) return;
    document.getElementById('pt-error').classList.add('hidden');
    const btn = document.getElementById('pt-save-btn'); btn.textContent='…'; btn.disabled=true;
    const isEdit      = state.editingSource==='pronomen'       && state.editingId;
    const isDraftEdit = state.editingSource==='pronomen-draft' && state.editingId;
    const docId       = isEdit ? state.editingId : 'pt_'+Date.now();
    try {
      await COL.pronomen.doc(docId).set({id:docId, order:Date.now(), ...data});
      if (isDraftEdit) await COL.pronomenDrafts.doc(state.editingId).delete();
      App.goHome(); setTimeout(()=>App.switchTab('tables'),100);
    } catch(e) { document.getElementById('pt-error').textContent='Fehler: '+e.message; document.getElementById('pt-error').classList.remove('hidden'); }
    finally { btn.textContent='Veröffentlichen'; btn.disabled=false; }
  },

  _fillPronomenFromQuiz(q) {
    document.getElementById('pt-name').value = q.name||'';
    document.getElementById('pt-desc').value = q.desc||'';
    App._fillQuizForm('pt-', q);
  },

  buildVokabelRow_template() {},
  _vokEditorMode: 'form',
  openAlleVokabeln() { VokSearch.openAlleVokabeln(); },

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
      const t = state.vokabel.find(x => x.id === id);
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
      const lines = rows.map((r,i) => `${i+1}. ${r.lat||'#'}-${r.fall2||'#'}-${(r.genus&&r.genus!=='–')?r.genus:'#'}-${(r.dekl&&r.dekl!=='–')?r.dekl:'#'}-${r.de||'#'}`);
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
      de:    r.querySelector('.vok-de').value.trim()
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
      const deRaw   = parts.slice(4).map(restore).join('-').trim();
      const deNorm  = deRaw==='#' ? '' : deRaw.replace(/\s*\/\s*/g,'%').replace(/\s*,\s*/g,'%');
      const de      = deNorm ? expandBrackets(deNorm) : '';
      rows.push({ lat:clean(parts[0]), fall2:clean(parts[1]), genus:clean(parts[2])||'–', dekl:clean(parts[3])||'–', de });
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
        <div class="vok-cell"><label class="vok-label">2. Fall</label>
          <input type="text" class="modal-input vok-fall2" placeholder="z.B. aquae" autocorrect="off" autocapitalize="off" spellcheck="false" value="${escHtml(data.fall2||'')}"/></div>
        <div class="vok-cell vok-cell-sm"><label class="vok-label">Genus</label>
          <select class="modal-input vok-genus">${GENUS_OPTS.map(o=>`<option${(data.genus||'–')===o?' selected':''}>${o}</option>`).join('')}</select></div>
        <div class="vok-cell vok-cell-sm"><label class="vok-label">Deklination</label>
          <select class="modal-input vok-dekl">${DEKL_OPTS.map(o=>`<option${(data.dekl||'–')===o?' selected':''}>${o}</option>`).join('')}</select></div>
        <div class="vok-cell"><label class="vok-label">Deutsch</label>
          <input type="text" class="modal-input vok-de" placeholder="Übersetzung" autocorrect="off" spellcheck="false" value="${escHtml(data.de||'')}"/></div>
        <div class="vok-cell vok-cell-del"><label class="vok-label">&nbsp;</label>
          <button class="row-del-btn" onclick="this.closest('.vokabel-row').remove()" title="Löschen">✕</button></div>
      </div>`;
    wrap.appendChild(row);
  },

  copyAiPrompt(btn) {
    const prompt = `You are a Latin vocabulary extractor. Extract vocabulary in EXACTLY this format — one entry per line:

Latin-SecondField-Gender-Declension-GermanTranslation

Fields: (1) Latin nominative/infinitive/adjective-forms, (2) genitive/1sg-present/#, (3) m./f./n./#, (4) 1.-5. Dekl./#, (5) German infinitive/meaning (use % for multiple, never / or comma)
Use # for non-applicable fields. No spaces around -. No headers or numbering.

Examples:
aqua-aquae-f.-1. Dekl.-Wasser%Flüssigkeit
bonus/a/um-#-#-#-gut
clamare-clamo-#-#-rufen
esse-sum-#-#-sein
nunc-#-#-#-jetzt%nun

Now extract all vocabulary from the provided content.`;
    navigator.clipboard.writeText(prompt).then(()=>{
      const orig=btn.textContent; btn.textContent='✓ Kopiert!';
      setTimeout(()=>{btn.textContent=orig;},2000);
    }).catch(()=>{ window.prompt('Prompt kopieren:', prompt); });
  },

  importTextVokabeln() {
    const raw  = document.getElementById('vok-textarea').value;
    const rows = this._parseTextRows(raw);
    if (!rows.length) { alert('Keine gültigen Zeilen gefunden.\nFormat: Latein-2.Fall-Genus-Deklination-Deutsch\nLeere Felder als # angeben.'); return; }
    document.getElementById('vokabel-rows').innerHTML = '';
    rows.forEach(r => this.addVokabelRow(r));
    this.switchVokMode('form');
    document.getElementById('vok-textarea').value = '';
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
    const docId = state.editingId || 'vt_'+Date.now();
    try {
      await COL.vokabel.doc(docId).set({id:docId, order:Date.now(), name, desc, rows});
      App.goHome(); setTimeout(()=>App.switchTab('tables'),100);
    } catch(e) { err.textContent='Fehler: '+e.message; err.classList.remove('hidden'); }
    finally { btn.textContent='Speichern'; btn.disabled=false; }
  }
};

// ── Vokabel-Suchmaschine ──────────────────────────────────────
const VokSearch = {
  _currentTableId: null, _currentTableRows: [], _sortMode: 'lat',

  _allForms(r) {
    const forms = new Set();
    const add   = s => { if (s && s!=='#' && s!=='–') forms.add(s.toLowerCase()); };
    add(r.lat); add(r.fall2); add(r.de);
    if (r.de) r.de.split('%').forEach(d => add(d.trim()));
    const type = Latin.detectType(r);
    if (type==='verb') { const c=Latin.conjugateVerb(r.lat||'',r.fall2||''); if(c) c.forms.forEach(([,f])=>add(f)); }
    else if (type==='noun' && r.fall2 && r.fall2!=='#' && r.fall2!=='–') { const res=Latin.declineNoun(r.lat||'',r.fall2||'',r.genus||''); if(res){res.sg.forEach(f=>add(f));res.pl.forEach(f=>add(f));} }
    else if (type==='adj') { const res=Latin.declineAdj(r.lat||''); if(res)['m_sg','f_sg','n_sg','m_pl','f_pl','n_pl'].forEach(k=>res[k]?.forEach(f=>add(f))); }
    return forms;
  },

  _matches(r, query, genus, dekl) {
    if (genus && (r.genus||'')!==genus) return false;
    if (dekl  && (r.dekl ||'')!==dekl)  return false;
    if (!query) return true;
    const q = query.toLowerCase().trim();
    return this._allForms(r).has(q) || [...this._allForms(r)].some(f=>f.includes(q));
  },

  _renderRows(rows, tableId, showSource, fromAlle) {
    if (!rows.length) return '<div class="empty-hint">Keine Vokabeln gefunden.</div>';
    let html = '<div class="dekl-table-wrap"><table class="dekl-table vok-table"><thead><tr><th>Latein</th><th>2. Fall</th><th>Genus</th><th>Dekl.</th><th>Übersetzung</th>';
    if (showSource) html += '<th>Liste</th>';
    html += '</tr></thead><tbody>';
    rows.forEach(({r,idx,tid,tname}) => {
      const de      = (r.de||'–').split('%').join(' / ');
      const clickId = tid||tableId;
      const alleP   = fromAlle ? ',true' : '';
      html += `<tr class="vok-row-clickable" onclick="VokDetail.open(${idx},'${clickId}'${alleP})"><td><strong>${r.lat||'–'}</strong></td><td>${r.fall2||'–'}</td><td>${r.genus||'–'}</td><td>${r.dekl||'–'}</td><td>${de}</td>`;
      if (showSource) html += `<td class="vok-source-cell">${tname||''}</td>`;
      html += `<td class="vok-row-arrow">›</td></tr>`;
    });
    return html + '</tbody></table></div>';
  },

  openAlleVokabeln() {
    this._sortMode = 'lat';
    document.getElementById('alle-search-input').value = '';
    document.getElementById('filter-genus').value = '';
    document.getElementById('filter-dekl').value  = '';
    this._updateSortBtns(); this._renderAlleResults('','','');
    App.showPage('alle-vokabeln', 'Alle Vokabeln');
  },

  setSortMode(mode) { this._sortMode=mode; this._updateSortBtns(); this.search(); },

  _updateSortBtns() {
    document.getElementById('sort-btn-lat')?.classList.toggle('active', this._sortMode==='lat');
    document.getElementById('sort-btn-de')?.classList.toggle('active',  this._sortMode==='de');
  },

  search() {
    this._renderAlleResults(
      document.getElementById('alle-search-input').value,
      document.getElementById('filter-genus').value,
      document.getElementById('filter-dekl').value
    );
  },

  _renderAlleResults(q, genus, dekl) {
    const tables  = [...state.vokabel].sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true,sensitivity:'base'}));
    const matched = [];
    tables.forEach(t => { (t.rows||[]).forEach((r,idx) => { if(this._matches(r,q,genus,dekl)) matched.push({r,idx,tid:t.id,tname:t.name}); }); });
    this._sortMode==='lat'
      ? matched.sort((a,b)=>(a.r.lat||'').localeCompare(b.r.lat||'','de',{sensitivity:'base'}))
      : matched.sort((a,b)=>(a.r.de||'').localeCompare(b.r.de||'','de',{sensitivity:'base'}));
    document.getElementById('alle-count-badge').textContent = matched.length + ' Vokabeln';
    document.getElementById('alle-vok-results').innerHTML   = this._renderRows(matched, null, true, true);
  },

  initTableSearch(tableId, rows) { this._currentTableId=tableId; this._currentTableRows=rows; },

  searchTable() {
    const matched = this._currentTableRows
      .map((r,idx)=>({r,idx,tid:this._currentTableId}))
      .filter(({r})=>this._matches(r, document.getElementById('table-search-input').value, document.getElementById('table-filter-genus').value, document.getElementById('table-filter-dekl').value));
    document.getElementById('table-view-content').innerHTML = this._renderRows(matched, this._currentTableId, false);
  }
};
