'use strict';

// ── Fehler-Meldesystem ────────────────────────────────────────
const Report = {
  _context: '',
  _category: null,

  open(context) {
    this._context = context || 'Unbekannt';
    document.getElementById('report-context-display').textContent = context || '';
    document.getElementById('report-message').value = '';
    this._renderCategories(null);
    document.getElementById('report-error').classList.add('hidden');
    document.getElementById('report-success').classList.add('hidden');
    document.getElementById('report-form-body').classList.remove('hidden');
    const btn = document.getElementById('report-send-btn');
    btn.textContent = 'Melden'; btn.disabled = false;
    document.getElementById('report-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('report-message').focus(), 100);
  },

  // Kategorie-Knöpfe: genau eine muss gewählt werden
  _renderCategories(selected) {
    this._category = selected;
    document.getElementById('report-categories').innerHTML = REPORT_CATEGORIES.map(c =>
      `<button type="button" class="report-cat-btn${c.id === selected ? ' active' : ''}" onclick="Report.selectCategory('${c.id}')">${escHtml(c.label)}</button>`
    ).join('');
    const cat = REPORT_CATEGORIES.find(c => c.id === selected);
    document.getElementById('report-category-hint').textContent = cat ? cat.hint : '';
  },

  selectCategory(id) {
    this._renderCategories(id);
    document.getElementById('report-error').classList.add('hidden');
  },

  close(e) {
    if (e && e.target !== document.getElementById('report-overlay')) return;
    document.getElementById('report-overlay').classList.add('hidden');
  },

  async send() {
    const msg = document.getElementById('report-message').value.trim();
    if (!this._category) {
      document.getElementById('report-error').textContent = 'Bitte wähle eine Kategorie aus.';
      document.getElementById('report-error').classList.remove('hidden');
      return;
    }
    if (!msg) {
      document.getElementById('report-error').textContent = 'Bitte schreib eine Nachricht.';
      document.getElementById('report-error').classList.remove('hidden');
      return;
    }
    const btn = document.getElementById('report-send-btn');
    btn.textContent = '…'; btn.disabled = true;
    try {
      await COL.reports.add({
        message: msg,
        category: this._category,
        context: this._context,
        encodedContext: Report._encodedContext || null,
        timestamp: Date.now(),
        read: false
      });
      Report._encodedContext = null;
      document.getElementById('report-error').classList.add('hidden');
      document.getElementById('report-form-body').classList.add('hidden');
      document.getElementById('report-success').classList.remove('hidden');
      if (state.adminLoggedIn) App.updateBellBadge();
    } catch(e) {
      document.getElementById('report-error').textContent = 'Fehler: ' + e.message;
      document.getElementById('report-error').classList.remove('hidden');
      btn.textContent = 'Melden'; btn.disabled = false;
    }
  }
};
