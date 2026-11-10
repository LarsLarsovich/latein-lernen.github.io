'use strict';

// ── Vokabel-Detailansicht ─────────────────────────────────────
// Zeigt alle Formen einer Vokabel (aus vok-forms.js). Admins können die
// Grunddaten und jede einzelne Form ändern.
const VokDetail = {
  currentTableId: null, _currentRow: null, _currentRowIndex: null,

  _table()  { return state.vokabel.find(x => x.id === this.currentTableId) || null; },
  _legacy() { const t = this._table(); return (t && t.overrides && t.overrides[this._currentRowIndex]) || null; },

  open(rowIndex, tableId) {
    this.currentTableId = tableId; this._currentRowIndex = rowIndex;
    const t = this._table(); if (!t) return;
    const r = t.rows[rowIndex]; if (!r) return;
    this._currentRow = r;
    document.getElementById('vok-detail-edit-btn')?.classList.toggle('hidden',  !state.adminLoggedIn);
    document.getElementById('vok-detail-forms-btn')?.classList.toggle('hidden', !state.adminLoggedIn);

    const has  = v => Latin._has(v);
    const data = VokForms.build(r, this._legacy());
    const type = data.type;
    const chip = (text, cls) => `<span class="vok-meta-chip${cls ? ' ' + cls : ''}">${escHtml(text)}</span>`;

    let html = `<div class="vok-detail-card">
      <div class="vok-detail-lat">${escHtml((r.lat || '–').split('%').map(s => s.trim()).join(', '))}</div>
      <div class="vok-detail-de">${escHtml(VokabelQuiz.formatGerman(r))}</div>
      <div class="vok-detail-meta">`;
    if (has(r.fall2)) html += chip(r.fall2);
    if (type === 'verb') { if (has(r.perf)) html += chip(r.perf); }
    else if (has(r.genus)) html += chip(r.genus);
    const klass = Latin.klassShort(r, type);
    if (klass) html += chip(klass);
    html += chip(VokForms.TYPE_LABEL[type], 'vok-type-chip');
    if (data.manual || data.partlyManual) html += chip('Formen von Hand eingetragen');
    if (data.irregular) html += `<a class="vok-meta-chip vok-link-chip" href="${App.topicUrl('unregelmaessige')}?verb=${encodeURIComponent(data.irregular.id)}">Unregelmäßige Verben →</a>`;
    html += `</div></div>`;

    const shown = data.sections.filter(sec => !sec.empty);
    shown.forEach((sec, n) => {
      const sub = (n === 0 && data.klass) ? ` <span class="forms-subtitle">– ${escHtml(data.klass)}</span>` : '';
      html += `<div class="forms-section-title forms-section-title--spaced">${escHtml(sec.title)}${sub}</div>`;
      html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>${sec.first}</th>`;
      html += sec.cols.map(c => `<th>${c.label}</th>`).join('') + `</tr></thead><tbody>`;
      sec.rows.forEach(row => {
        html += `<tr><td class="case-cell">${row.label}</td>`;
        row.cells.forEach((c, i) => {
          const v = escHtml(c.value || '–');
          html += c.de ? `<td class="cell-de">${v}</td>` : `<td>${i === 0 ? `<strong>${v}</strong>` : v}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></div>`;
    });

    const adminHint = state.adminLoggedIn ? ' Über „Formen“ kannst du sie eintragen.' : '';
    if (type === 'verb' && !data.manual && data.sections[0].empty) {
      html += `<div class="empty-hint">Unregelmäßiges Verb – Präsens, Imperfekt und Futur I werden nicht automatisch gebildet. Trage es auf der Seite „Unregelmäßige Verben“ ein, dann erscheinen die Formen auch hier.</div>`;
    } else if (!shown.length) {
      html += `<div class="forms-section-title forms-section-title--spaced">Formen</div>`;
      html += type === 'indecl'
        ? `<div class="empty-hint">Dieses Wort wird nicht gebeugt.${adminHint}</div>`
        : `<div class="empty-hint">Für dieses Wort konnten keine Formen gebildet werden.${adminHint}</div>`;
    }

    document.getElementById('vok-detail-content').innerHTML = html;
    document.getElementById('vok-detail-back').onclick = () => App.goBack();
    App.showPage('vok-detail', r.lat || '');
  },

  // Eine Zeile der Vokabelliste ändern und speichern.
  // change(row) liefert die neue Zeile; dropLegacy entfernt die alte Teil-Überschreibung.
  async _saveRow(change, dropLegacy) {
    const t = this._table(), idx = this._currentRowIndex;
    if (!t || idx == null) throw new Error('Vokabel nicht gefunden.');
    const rows = [...(t.rows || [])];
    const { gram, ...clean } = rows[idx];        // "gram" = Reste des entfernten Wörterbuch-Checks
    rows[idx] = change(clean);
    const update = { rows };
    if (dropLegacy && t.overrides && t.overrides[idx]) {
      update.overrides = { ...t.overrides };
      delete update.overrides[idx];
    }
    await COL.vokabel.doc(t.id).update(update);
    t.rows = rows;
    if (update.overrides) t.overrides = update.overrides;
  },

  // ── Grunddaten bearbeiten ─────────────────────────────────
  openBasicEdit() {
    const r = this._currentRow; if (!r) return;
    document.getElementById('basic-edit-lat').value   = r.lat   || '';
    document.getElementById('basic-edit-fall2').value = r.fall2 || '';
    document.getElementById('basic-edit-genus').value = r.genus || '–';
    document.getElementById('basic-edit-dekl').value  = r.dekl  || '–';
    document.getElementById('basic-edit-de').value    = r.de    || '';
    document.getElementById('basic-edit-perf').value  = r.perf  || '';
    document.getElementById('basic-edit-type').value  = r.type  || '';
    document.getElementById('basic-edit-degenus').value = r.deGenus || '';
    document.getElementById('basic-edit-error').classList.add('hidden');
    document.getElementById('basic-edit-overlay').classList.remove('hidden');
  },
  closeBasicEdit(e) {
    if (e && e.target !== document.getElementById('basic-edit-overlay')) return;
    document.getElementById('basic-edit-overlay').classList.add('hidden');
  },
  async saveBasicEdit() {
    const err = document.getElementById('basic-edit-error');
    const val = id => document.getElementById(id).value.trim();
    const lat = val('basic-edit-lat');
    if (!lat) { err.textContent = 'Lateinisches Wort darf nicht leer sein.'; err.classList.remove('hidden'); return; }
    const type = document.getElementById('basic-edit-type').value;
    try {
      await this._saveRow(row => {
        const next = { ...row, lat, fall2: val('basic-edit-fall2'),
          genus: document.getElementById('basic-edit-genus').value,
          dekl:  document.getElementById('basic-edit-dekl').value,
          de: val('basic-edit-de'), perf: val('basic-edit-perf') };
        if (type) next.type = type; else delete next.type;
        const deGenus = document.getElementById('basic-edit-degenus').value;
        if (deGenus) next.deGenus = deGenus; else delete next.deGenus;
        return next;
      }, false);
      document.getElementById('basic-edit-overlay').classList.add('hidden');
      this.open(this._currentRowIndex, this.currentTableId);
    } catch (e) { err.textContent = 'Fehler: ' + e.message; err.classList.remove('hidden'); }
  },

  // ── Alle Formen bearbeiten ────────────────────────────────
  // Jedes Feld ist mit der aktuell angezeigten Form vorbelegt. Nach dem Speichern
  // gilt genau das, was hier steht – es wird nichts mehr automatisch gebildet.
  openForms() {
    const r = this._currentRow; if (!r) return;
    const data = VokForms.build(r, this._legacy());
    document.getElementById('override-modal-title').textContent = 'Formen für: ' + (r.lat || '');
    document.getElementById('override-error').classList.add('hidden');

    let html = '';
    data.sections.forEach(sec => {
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
    document.getElementById('override-fields').innerHTML = html;
    document.getElementById('override-reset-btn').classList.toggle('hidden', !(data.manual || data.partlyManual));
    document.getElementById('override-overlay').classList.remove('hidden');
  },
  closeForms(e) {
    if (e && e.target !== document.getElementById('override-overlay')) return;
    document.getElementById('override-overlay').classList.add('hidden');
  },
  async _finishForms(change) {
    const err = document.getElementById('override-error');
    try {
      await this._saveRow(change, true);
      document.getElementById('override-overlay').classList.add('hidden');
      this.open(this._currentRowIndex, this.currentTableId);
    } catch (e) { err.textContent = 'Fehler beim Speichern: ' + e.message; err.classList.remove('hidden'); }
  },
  saveForms() {
    const forms = {};
    document.querySelectorAll('#override-fields input[data-key]').forEach(inp => {
      const v = inp.value.trim();
      if (v && v !== '–' && v !== '-') forms[inp.dataset.key] = v;
    });
    return this._finishForms(row => ({ ...row, forms }));
  },
  // Eigene Formen verwerfen → wieder automatisch bilden
  resetForms() {
    return this._finishForms(row => { const { forms, ...rest } = row; return rest; });
  },

  reportCurrent() {
    const tid = this.currentTableId, idx = this._currentRowIndex, r = this._currentRow;
    if (tid != null && idx != null && r) {
      const t = this._table();
      Report._encodedContext = `VOK:${tid}:${idx}`;
      Report.open(`${r.lat||'?'} (${t?.name||'Vokabel'})`);
    } else {
      Report.open('Vokabel-Detail');
    }
  }
};
