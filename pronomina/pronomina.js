'use strict';

// ── Pronomina: Tabellen, Editor und Quiz-Start ────────────────
// Ergänzt Tables (gemeinsam/tabellen.js) um alles, was nur Pronomen-Tabellen betrifft.
// Eine Tabelle hat je Geschlecht (M/W/N) und Fall die Formen:
//   sg, pl (Latein) und de_sg, de_pl (Deutsch)
const PRONOMEN_SECTIONS = { 'sg-columns': 'sg', 'pl-columns': 'pl', 'de-sg-columns': 'de_sg', 'de-pl-columns': 'de_pl' };

Object.assign(Tables, {

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

  // ── Editor ────────────────────────────────────────────────
  // Baut die Eingabefelder: 4 Abschnitte × 3 Geschlechter × 5 Fälle
  buildEditorGrids() {
    Object.keys(PRONOMEN_SECTIONS).forEach(sec => {
      const wrap = document.getElementById('pt-' + sec);
      wrap.innerHTML = '';
      GENDERS.forEach(g => {
        const col = document.createElement('div'); col.className = 'genus-col';
        col.innerHTML = `<div class="genus-col-header ${GENDER_CLASS[g]}">${GENDER_LABEL[g]}</div>`;
        CASES.forEach(c => {
          const f = document.createElement('div'); f.className = 'genus-field';
          f.innerHTML = `<label>${CASE_NAMES[c]}</label><input type="text" id="pt-${sec}_${g}_${c}" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="${CASE_NAMES[c].substring(0,3).toLowerCase()}." />`;
          col.appendChild(f);
        });
        wrap.appendChild(col);
      });
    });
  },

  _eachField(fn) {
    Object.entries(PRONOMEN_SECTIONS).forEach(([sec, key]) =>
      GENDERS.forEach(g => CASES.forEach(c => fn(document.getElementById(`pt-${sec}_${g}_${c}`), key, g, c))));
  },
  _clearForm() {
    document.getElementById('pt-name').value = '';
    document.getElementById('pt-desc').value = '';
    this._eachField(el => { el.value = ''; });
  },
  _fillForm(t) {
    document.getElementById('pt-name').value = t.name || '';
    document.getElementById('pt-desc').value = t.desc || '';
    this._eachField((el, key, g, c) => { el.value = t[key]?.[g]?.[c] || ''; });
  },
  _readForm() {
    const data = { name: document.getElementById('pt-name').value.trim(),
                   desc: document.getElementById('pt-desc').value.trim(), sg: {}, pl: {}, de_sg: {}, de_pl: {} };
    this._eachField((el, key, g, c) => { (data[key][g] = data[key][g] || {})[c] = el.value.trim(); });
    return data;
  },

  openPronomenEditor(id, source) {
    const isNew = !id, isDraft = source==='draft';
    document.getElementById('pronomen-editor-title').textContent = isNew ? 'Neue Pronomen-Tabelle' : 'Pronomen-Tabelle bearbeiten';
    document.getElementById('pt-error').classList.add('hidden');
    state.editingId = id||null; state.editingSource = isDraft ? 'pronomen-draft' : 'pronomen';
    if (isNew) { this._clearForm(); }
    else {
      const arr = isDraft ? state.pronomenDrafts : state.pronomen;
      const t   = arr.find(x => x.id === id);
      t ? this._fillForm(t) : this._clearForm();
    }
    App.showPage('pronomen-editor', isNew ? 'Neue Tabelle' : 'Bearbeiten');
  },

  async savePronomenDraft() {
    const data = this._readForm();
    if (!data.name) { const er=document.getElementById('pt-error'); er.textContent='Bitte gib einen Namen ein.'; er.classList.remove('hidden'); return; }
    document.getElementById('pt-error').classList.add('hidden');
    const btn = document.getElementById('pt-draft-btn'); btn.textContent='…'; btn.disabled=true;
    const isEdit = state.editingSource==='pronomen-draft' && state.editingId;
    const docId  = isEdit ? state.editingId : 'ptd_'+Date.now();
    try {
      await COL.pronomenDrafts.doc(docId).set({id:docId, order:Date.now(), ...data});
      App.goHome();
    } catch(e) { document.getElementById('pt-error').textContent='Fehler: '+e.message; document.getElementById('pt-error').classList.remove('hidden'); }
    finally { btn.textContent='Als Entwurf speichern'; btn.disabled=false; }
  },

  async savePronomen() {
    const data = this._readForm();
    if (!data.name) { const er=document.getElementById('pt-error'); er.textContent='Bitte gib einen Namen ein.'; er.classList.remove('hidden'); return; }
    document.getElementById('pt-error').classList.add('hidden');
    const btn = document.getElementById('pt-save-btn'); btn.textContent='…'; btn.disabled=true;
    const isEdit      = state.editingSource==='pronomen'       && state.editingId;
    const isDraftEdit = state.editingSource==='pronomen-draft' && state.editingId;
    const docId       = isEdit ? state.editingId : 'pt_'+Date.now();
    const oldOrder    = isEdit ? state.pronomen.find(x => x.id === docId)?.order : null;
    try {
      await COL.pronomen.doc(docId).set({id:docId, order:oldOrder || Date.now(), ...data});
      if (isDraftEdit) await COL.pronomenDrafts.doc(state.editingId).delete();
      App.goHome();
    } catch(e) { document.getElementById('pt-error').textContent='Fehler: '+e.message; document.getElementById('pt-error').classList.remove('hidden'); }
    finally { btn.textContent='Veröffentlichen'; btn.disabled=false; }
  }
});

// ── Quiz-Start ────────────────────────────────────────────────
Object.assign(App, {

  // Knopf „Quiz starten" in der Tabellen-Ansicht
  startTableQuiz() { this.openPronomenSetup(state.tableViewId); },

  openPronomenSetup(id) {
    const t = state.pronomen.find(x => x.id === id);
    if (!t) return;
    state.quizType    = 'pronomen';
    state.currentQuiz = { id: t.id, name: t.name, desc: t.desc || '', sg: t.sg, pl: t.pl, de_sg: t.de_sg, de_pl: t.de_pl };
    state.lastQuizId  = t.id;
    document.getElementById('setup-title').textContent = t.name;
    document.getElementById('setup-desc').textContent  = t.desc || '';
    document.getElementById('setup-pronomen').classList.remove('hidden');
    document.getElementById('setup-vokabel').classList.add('hidden');
    document.querySelectorAll('input[name="phase"]').forEach(cb => { cb.checked = cb.value === '1'; });
    document.getElementById('shuffle-within').checked = false;
    this._setSetupReady(true);
    this.showPage('setup', t.name);
  },

  // „Nochmal" nach einem Quiz
  replaySetup() { state.lastQuizId ? this.openPronomenSetup(state.lastQuizId) : this.goHome(); }
});
