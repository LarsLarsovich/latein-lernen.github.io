'use strict';

// ── Meldungen (nur für Admins) ────────────────────────────────
// Zeigt alle Fehlermeldungen, eingeteilt nach der Kategorie, die beim Melden
// gewählt wurde (REPORT_CATEGORIES in gemeinsam/constants.js).
// Ältere Meldungen ohne Kategorie stehen unter „Sonstiges".
const Meldungen = {
  _docs: [],
  _showRead: false,
  _loadedFor: null,

  // Wird bei Login/Logout aufgerufen
  async render() {
    const admin = state.adminLoggedIn;
    document.getElementById('meld-locked').classList.toggle('hidden', admin);
    document.getElementById('meld-body').classList.toggle('hidden', !admin);
    if (!admin) { this._loadedFor = null; return; }
    if (this._loadedFor === state.currentAdmin.uid) return;
    this._loadedFor = state.currentAdmin.uid;
    await this.load();
  },

  async load() {
    const list = document.getElementById('meld-list');
    list.innerHTML = '<div class="empty-hint">Wird geladen…</div>';
    try {
      const snap = await COL.reports.orderBy('timestamp', 'desc').limit(500).get();
      this._docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.draw();
    } catch (e) { list.innerHTML = `<div class="empty-hint">Fehler beim Laden: ${escHtml(e.message)}</div>`; }
  },

  _category(doc) {
    return REPORT_CATEGORIES.some(c => c.id === doc.category) ? doc.category : 'sonstiges';
  },

  // Wohin führt ein Klick auf die Meldung? (nur bei Vokabeln bekannt)
  _link(doc) {
    const m = (doc.encodedContext || '').match(/^(?:VOK|QUIZ):([^:]+):(\d+)/);
    return m ? `${App.topicUrl('vokabeln')}?vok=${encodeURIComponent(m[1] + ':' + m[2])}` : null;
  },

  toggleRead() { this._showRead = !this._showRead; this.draw(); },

  draw() {
    const unread = this._docs.filter(d => !d.read).length;
    document.getElementById('meld-summary').textContent =
      `${unread} offen · ${this._docs.length - unread} erledigt`;
    document.getElementById('meld-toggle-read').textContent = this._showRead ? 'Erledigte ausblenden' : 'Erledigte anzeigen';

    const shown = this._docs.filter(d => this._showRead || !d.read);
    let html = '';
    REPORT_CATEGORIES.forEach(cat => {
      const docs = shown.filter(d => this._category(d) === cat.id);
      if (!docs.length) return;
      const open = docs.filter(d => !d.read).length;
      html += `<div class="tables-category-block">
        <div class="tables-category-heading">
          <div class="tables-category-heading-title">${escHtml(cat.label)}</div>
          <span class="meld-count${open ? '' : ' meld-count--done'}">${open || '✓'}</span>
          <div class="tables-category-heading-line"></div>
        </div>
        <div class="meld-grid">${docs.map(d => this._item(d)).join('')}</div>
      </div>`;
    });
    document.getElementById('meld-list').innerHTML = html ||
      `<div class="empty-hint">${this._docs.length ? 'Keine offenen Meldungen. 🎉' : 'Noch keine Meldungen.'}</div>`;
  },

  _item(d) {
    const date = d.timestamp ? new Date(d.timestamp).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const link = this._link(d);
    const ctx  = escHtml(d.context || 'Unbekannt');
    return `<div class="report-item meld-item${d.read ? ' report-read' : ''}">
      ${link ? `<a class="report-item-context" href="${link}">${ctx} <span class="report-nav-hint">→</span></a>`
             : `<div class="report-item-context meld-nolink">${ctx}</div>`}
      <div class="report-item-msg">${escHtml(d.message || '')}</div>
      <div class="report-item-footer">
        <span>${date}</span>
        ${d.read ? `<button onclick="Meldungen.setRead('${d.id}', false)">Wieder öffnen</button>`
                 : `<button onclick="Meldungen.setRead('${d.id}', true)">✓ Erledigt</button>`}
        <button class="btn-danger-text" onclick="Meldungen.remove('${d.id}')">Löschen</button>
      </div>
    </div>`;
  },

  async setRead(id, read) {
    try {
      await COL.reports.doc(id).update({ read });
      const doc = this._docs.find(d => d.id === id); if (doc) doc.read = read;
      this.draw(); App.updateBellBadge();
    } catch (e) { alert('Fehler: ' + e.message); }
  },

  async remove(id) {
    if (!confirm('Diese Meldung endgültig löschen?')) return;
    try {
      await COL.reports.doc(id).delete();
      this._docs = this._docs.filter(d => d.id !== id);
      this.draw(); App.updateBellBadge();
    } catch (e) { alert('Fehler: ' + e.message); }
  }
};
