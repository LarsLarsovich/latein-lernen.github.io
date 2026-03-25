'use strict';

// ── Götter-Modul ──────────────────────────────────────────────
const Goetter = {

  // ── Startseite: Karten-Grid ──────────────────────────────────
  renderHome() {
    // Only update the full grid on the Götter page
    const list  = [...state.goetter].sort((a,b) => (a.order||0)-(b.order||0));
    const grid  = document.getElementById('goetter-full-grid');
    const empty = document.getElementById('goetter-full-empty');
    if (!grid) return;
    grid.innerHTML = '';
    if (!list.length) { if(empty) empty.style.display='block'; return; }
    if (empty) empty.style.display='none';
    list.forEach(g => grid.appendChild(this._makeCard(g)));
  },

  _makeCard(g) {
    const card = document.createElement('div');
    card.className = 'gott-card' + (state.adminLoggedIn ? ' admin-mode-click' : '');
    card.innerHTML = `
      <div class="gott-card-symbol">${g.symbol||'⚡'}</div>
      <div class="gott-card-names">
        <div class="gott-card-rom">${escHtml(g.nameRom||'')}</div>
        <div class="gott-card-gre">🇬🇷 ${escHtml(g.nameGre||'')}</div>
      </div>
      <div class="gott-card-bereich">${escHtml((g.bereiche||[]).join(' · '))}</div>
    `;
    if (state.adminLoggedIn) {
      card.onclick = () => App.showGottActions(g.id);
    } else {
      card.onclick = () => Goetter.openDetail(g.id);
    }
    return card;
  },

  // ── Detail-Ansicht ───────────────────────────────────────────
  openDetail(id) {
    const g = state.goetter.find(x => x.id === id);
    if (!g) return;

    let html = `
      <div class="gott-detail-hero">
        <div class="gott-detail-symbol">${g.symbol||'⚡'}</div>
        <div class="gott-detail-header">
          <h1 class="gott-detail-rom">${escHtml(g.nameRom||'')}</h1>
          <div class="gott-detail-gre">Griechisch: <strong>${escHtml(g.nameGre||'')}</strong></div>
        </div>
      </div>`;

    if ((g.bereiche||[]).length) {
      html += `<div class="gott-section-label">Bereiche</div>
        <div class="gott-tags">${g.bereiche.map(b=>`<span class="gott-tag">${escHtml(b)}</span>`).join('')}</div>`;
    }

    if ((g.symbole||[]).length) {
      html += `<div class="gott-section-label">Symbole &amp; Gegenstände</div>
        <div class="gott-tags">${g.symbole.map(s=>`<span class="gott-tag gott-tag--sym">${escHtml(s)}</span>`).join('')}</div>`;
    }

    if (g.beschreibung) {
      html += `<div class="gott-section-label">Beschreibung</div>
        <div class="gott-beschreibung">${escHtml(g.beschreibung)}</div>`;
    }

    if (g.fakten && g.fakten.length) {
      html += `<div class="gott-section-label">Wichtige Fakten</div><ul class="gott-fakten">`;
      g.fakten.forEach(f => { html += `<li>${escHtml(f)}</li>`; });
      html += `</ul>`;
    }

    if (g.eltern || g.kinder) {
      html += `<div class="gott-section-label">Familie</div><div class="gott-familie">`;
      if (g.eltern) html += `<div class="gott-fam-row"><span class="gott-fam-label">Eltern:</span> ${escHtml(g.eltern)}</div>`;
      if (g.kinder) html += `<div class="gott-fam-row"><span class="gott-fam-label">Kinder:</span> ${escHtml(g.kinder)}</div>`;
      html += `</div>`;
    }

    document.getElementById('gott-detail-content').innerHTML = html;
    // Admin edit btn
    const editBtn = document.getElementById('gott-detail-edit-btn');
    if (editBtn) {
      editBtn.classList.toggle('hidden', !state.adminLoggedIn);
      editBtn.onclick = () => Goetter.openEditor(id);
    }
    // Store current id for report
    document.getElementById('gott-detail-report-btn').onclick =
      () => Report.open(`Gott: ${g.nameRom||g.nameGre||'?'}`);
    App.showPage('gott-detail', g.nameRom||g.nameGre||'');
  },

  // ── Editor ───────────────────────────────────────────────────
  openEditor(id) {
    const isNew = !id;
    const g = id ? state.goetter.find(x=>x.id===id) : {};
    document.getElementById('gott-editor-title').textContent = isNew ? 'Neuer Gott' : 'Gott bearbeiten';
    document.getElementById('gott-ed-rom').value       = g?.nameRom     || '';
    document.getElementById('gott-ed-gre').value       = g?.nameGre     || '';
    document.getElementById('gott-ed-symbol').value    = g?.symbol      || '';
    document.getElementById('gott-ed-bereiche').value  = (g?.bereiche||[]).join(', ');
    document.getElementById('gott-ed-symbole').value   = (g?.symbole||[]).join(', ');
    document.getElementById('gott-ed-beschr').value    = g?.beschreibung|| '';
    document.getElementById('gott-ed-fakten').value    = (g?.fakten||[]).join('\n');
    document.getElementById('gott-ed-eltern').value    = g?.eltern      || '';
    document.getElementById('gott-ed-kinder').value    = g?.kinder      || '';
    document.getElementById('gott-ed-error').classList.add('hidden');
    state.editingGottId = id || null;
    App.showPage('gott-editor', isNew ? 'Neuer Gott' : 'Bearbeiten');
  },

  async saveGott() {
    const nameRom = document.getElementById('gott-ed-rom').value.trim();
    const nameGre = document.getElementById('gott-ed-gre').value.trim();
    const err = document.getElementById('gott-ed-error');
    if (!nameRom && !nameGre) {
      err.textContent = 'Bitte mindestens einen Namen eingeben.';
      err.classList.remove('hidden'); return;
    }
    const split = s => s.split(',').map(x=>x.trim()).filter(Boolean);
    const data = {
      nameRom:      nameRom,
      nameGre:      nameGre,
      symbol:       document.getElementById('gott-ed-symbol').value.trim() || '⚡',
      bereiche:     split(document.getElementById('gott-ed-bereiche').value),
      symbole:      split(document.getElementById('gott-ed-symbole').value),
      beschreibung: document.getElementById('gott-ed-beschr').value.trim(),
      fakten:       document.getElementById('gott-ed-fakten').value.split('\n').map(x=>x.trim()).filter(Boolean),
      eltern:       document.getElementById('gott-ed-eltern').value.trim(),
      kinder:       document.getElementById('gott-ed-kinder').value.trim(),
      order:        Date.now(),
    };
    const btn = document.getElementById('gott-save-btn');
    btn.textContent = '…'; btn.disabled = true;
    try {
      if (state.editingGottId) {
        await COL.goetter.doc(state.editingGottId).update(data);
      } else {
        const docRef = await COL.goetter.add(data);
        state.editingGottId = docRef.id;
      }
      App.showPage('goetter', 'Götter');
    } catch(e) {
      err.textContent = 'Fehler: '+e.message; err.classList.remove('hidden');
    } finally { btn.textContent = 'Speichern'; btn.disabled = false; }
  },

  async deleteGott(id) {
    if (!confirm('Gott wirklich löschen?')) return;
    try { await COL.goetter.doc(id).delete(); }
    catch(e) { alert('Fehler: '+e.message); }
  },

  // ── Stammbaum ────────────────────────────────────────────────
  openStammbaum(iframeUrl) {
    const container = document.getElementById('stammbaum-container');
    if (container) {
      container.innerHTML = `<iframe src="${escHtml(iframeUrl)}"
        width="100%" height="100%" frameborder="0" scrolling="no"
        allow="fullscreen; clipboard-read; clipboard-write" allowfullscreen></iframe>`;
    }
    App.showPage('stammbaum', 'Stammbaum');
  },
};
