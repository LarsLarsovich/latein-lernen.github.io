'use strict';

// ── Unregelmäßige Verben ──────────────────────────────────────
// Jede Form wird von Hand eingetragen – es gibt keinen Algorithmus.
// Firestore-Sammlung "unregelmaessige", ein Dokument pro Verb:
//   { id, inf: 'esse', de: 'sein', stamm: 'sum, fui', order, forms: { praes_p1sg: 'sum', … } }
// Die Feldnamen in forms sind dieselben wie bei den Vokabeln (gemeinsam/vok-forms.js).
// Steht ein Verb hier, zeigt auch die Vokabel-Detailansicht diese Formen.
const Irregular = {
  _id: null,          // gerade geöffnetes Verb
  _editId: null,      // gerade bearbeitetes Verb (null = neues)

  _verb(id) { return state.unregelmaessige.find(v => v.id === id) || null; },

  // ── Übersicht ─────────────────────────────────────────────
  renderHome() {
    const list = [...state.unregelmaessige].sort((a, b) => (a.order || 0) - (b.order || 0));
    const grid = document.getElementById('irr-grid');
    grid.innerHTML = '';
    list.forEach(v => {
      const card = document.createElement('div');
      // Kostprobe: die Präsensformen (sum, es, est …), sonst die Stammformen
      const praes = VokForms.PERSONS.map(([k]) => (v.forms || {})['praes_' + k]).filter(Boolean).join(', ');
      card.className = 'quiz-card list-card';
      card.innerHTML = `<div class="quiz-card-name">${escHtml(v.inf || '?')}</div>
        <div class="quiz-card-desc">${escHtml(v.de || '')}</div>
        <div class="list-card-taste" lang="la">${escHtml(praes || v.stamm || '')}</div>`;
      card.onclick = () => this.open(v.id);
      grid.appendChild(card);
    });
    App.setTopicInfo(list.length ? `${list.length} ${list.length === 1 ? 'Verb' : 'Verben'}, jede Form zum Nachschlagen` : '');
    document.getElementById('irr-empty').classList.toggle('hidden', list.length > 0);
    document.getElementById('irr-empty').textContent = state.adminLoggedIn
      ? 'Noch keine Verben eingetragen. Mit dem Plus oben rechts legst du das erste an.'
      : 'Noch keine Verben eingetragen.';

    // Link aus der Vokabel-Detailansicht: …/unregelmaessige/index.html?verb=<ID>
    if (!this._linkDone && list.length) {
      this._linkDone = true;
      const id = new URLSearchParams(location.search).get('verb');
      if (id && this._verb(id)) this.open(id);
    }
  },

  // ── Ein Verb ansehen ──────────────────────────────────────
  open(id) {
    const v = this._verb(id); if (!v) return;
    this._id = id;
    document.getElementById('irr-edit-btn').classList.toggle('hidden', !state.adminLoggedIn);

    let html = `<div class="vok-detail-card">
      <div class="vok-detail-lat">${escHtml(v.inf || '–')}</div>
      <div class="vok-detail-de">${escHtml(v.de || '')}</div>
      <div class="vok-detail-meta">${v.stamm ? `<span class="vok-meta-chip">${escHtml(v.stamm)}</span>` : ''}
        <span class="vok-meta-chip vok-type-chip">Unregelmäßiges Verb</span></div></div>`;

    const sections = VokForms.fill(VokForms.layoutIrregular(), key => (v.forms || {})[key]).filter(s => !s.empty);
    sections.forEach(sec => {
      // Deutsche Spalte nur zeigen, wenn dort etwas eingetragen ist
      const cols = sec.cols.map((c, i) => ({ c, i })).filter(({ c, i }) => !c.de || sec.rows.some(r => r.cells[i].value));
      html += `<div class="forms-section-title forms-section-title--spaced">${escHtml(sec.title)}</div>`;
      html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>${sec.first}</th>`;
      html += cols.map(({ c }) => `<th>${c.label}</th>`).join('') + `</tr></thead><tbody>`;
      sec.rows.forEach(row => {
        html += `<tr><td class="case-cell">${row.label}</td>`;
        cols.forEach(({ c, i }) => {
          const val = escHtml(row.cells[i].value || '–');
          html += c.de ? `<td class="cell-de">${val}</td>` : `<td><strong>${val}</strong></td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></div>`;
    });
    if (!sections.length) html += `<div class="empty-hint">Für dieses Verb sind noch keine Formen eingetragen.</div>`;

    document.getElementById('irr-content').innerHTML = html;
    App.showPage('verb', v.inf || '');
  },

  report() {
    const v = this._verb(this._id);
    Report.open('Unregelmäßiges Verb: ' + (v ? v.inf : '?'));
  },

  // ── Verb anlegen / bearbeiten (Admin) ─────────────────────
  openEditor(id) {
    const v = id ? this._verb(id) : null;
    this._editId = v ? v.id : null;
    document.getElementById('irr-editor-title').textContent = v ? 'Verb bearbeiten' : 'Neues unregelmäßiges Verb';
    document.getElementById('irr-ed-inf').value   = v?.inf   || '';
    document.getElementById('irr-ed-de').value    = v?.de    || '';
    document.getElementById('irr-ed-stamm').value = v?.stamm || '';
    document.getElementById('irr-ed-error').classList.add('hidden');
    document.getElementById('irr-delete-btn').classList.toggle('hidden', !v);

    let html = '';
    VokForms.fill(VokForms.layoutIrregular(), key => (v?.forms || {})[key]).forEach(sec => {
      html += `<div class="override-section-label">${escHtml(sec.title)}</div>`;
      html += `<div class="dekl-table-wrap"><table class="dekl-table forms-edit-table"><thead><tr><th>${sec.first}</th>`;
      html += sec.cols.map(c => `<th>${c.label}</th>`).join('') + `</tr></thead><tbody>`;
      sec.rows.forEach(row => {
        html += `<tr><td class="case-cell">${row.label}</td>`;
        row.cells.forEach(c => {
          html += `<td><input type="text" class="modal-input forms-edit-input" data-key="${c.key}" value="${escHtml(c.value)}" placeholder="–" autocorrect="off" autocapitalize="off" spellcheck="false" /></td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></div>`;
    });
    document.getElementById('irr-ed-forms').innerHTML = html;
    App.showPage('verb-editor', v ? v.inf : 'Neues Verb');
  },

  editCurrent() { this.openEditor(this._id); },

  async save() {
    const err = document.getElementById('irr-ed-error');
    const inf = document.getElementById('irr-ed-inf').value.trim();
    if (!inf) { err.textContent = 'Bitte gib den Infinitiv ein (z.B. esse).'; err.classList.remove('hidden'); return; }
    const forms = {};
    document.querySelectorAll('#irr-ed-forms input[data-key]').forEach(inp => {
      const val = inp.value.trim();
      if (val && val !== '–' && val !== '-') forms[inp.dataset.key] = val;
    });
    const old  = this._editId ? this._verb(this._editId) : null;
    const id   = old ? old.id : 'uv_' + Date.now();
    const data = { id, inf, de: document.getElementById('irr-ed-de').value.trim(),
                   stamm: document.getElementById('irr-ed-stamm').value.trim(),
                   order: old?.order || Date.now(), forms };
    const btn = document.getElementById('irr-save-btn');
    btn.disabled = true; btn.textContent = '…';
    try {
      await COL.unregelmaessige.doc(id).set(data);
      App.goHome();
    } catch (e) { err.textContent = 'Fehler: ' + e.message; err.classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = 'Speichern'; }
  },

  async remove() {
    if (!this._editId || !confirm('Dieses Verb wirklich löschen?')) return;
    try { await COL.unregelmaessige.doc(this._editId).delete(); App.goHome(); }
    catch (e) { alert('Fehler: ' + e.message); }
  }
};
