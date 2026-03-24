'use strict';

// ── Fehler-Meldesystem ────────────────────────────────────────
const Report = {
  _context: '',

  open(context) {
    this._context = context || 'Unbekannt';
    document.getElementById('report-context-display').textContent = context || '';
    document.getElementById('report-message').value = '';
    document.getElementById('report-error').classList.add('hidden');
    document.getElementById('report-success').classList.add('hidden');
    document.getElementById('report-form-body').classList.remove('hidden');
    const btn = document.getElementById('report-send-btn');
    btn.textContent = 'Melden'; btn.disabled = false;
    document.getElementById('report-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('report-message').focus(), 100);
  },

  close(e) {
    if (e && e.target !== document.getElementById('report-overlay')) return;
    document.getElementById('report-overlay').classList.add('hidden');
  },

  async send() {
    const msg = document.getElementById('report-message').value.trim();
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
