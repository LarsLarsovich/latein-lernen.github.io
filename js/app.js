'use strict';

// ── App ──────────────────────────────────────────────────────
const App = {

  async init() {
    this.buildEditorGrids('');
    this.buildEditorGrids('pt-');
    Tables.buildVokabelRow_template();

    const loader   = document.getElementById('loading-screen');
    loader.style.display = 'flex';
    const hideLoader = () => { loader.style.display = 'none'; };
    const timeout  = setTimeout(hideLoader, 6000);
    const fromSnap = snap => snap.docs.map(d => ({id: d.id, ...d.data()}));

    try {
      const [pubS, draftS, pronS, vokS, pronDrS, vokDrS, gottS] = await Promise.all([
        COL.published.get().catch(()=>({docs:[]})),
        COL.drafts.get().catch(()=>({docs:[]})),
        COL.pronomen.get().catch(()=>({docs:[]})),
        COL.vokabel.get().catch(()=>({docs:[]})),
        COL.pronomenDrafts.get().catch(()=>({docs:[]})),
        COL.vokabelDrafts.get().catch(()=>({docs:[]})),
        COL.goetter.get().catch(()=>({docs:[]}))
      ]);
      state.published      = fromSnap(pubS);
      state.drafts         = fromSnap(draftS);
      state.pronomen       = fromSnap(pronS);
      state.vokabel        = fromSnap(vokS);
      state.pronomenDrafts = fromSnap(pronDrS);
      state.vokabelDrafts  = fromSnap(vokDrS);
      state.goetter        = fromSnap(gottS);
    } catch(e) { console.warn('init load:', e.message); }

    clearTimeout(timeout);
    hideLoader();
    this.renderHome();
    this.showPage('home');

    // News-Banner einmalig anzeigen
    try {
      if (!localStorage.getItem('news_v3')) {
        setTimeout(() => {
          document.getElementById('news-overlay')?.classList.remove('hidden');
        }, 900);
      }
    } catch(e) {}

    // Live-Listener
    const listen = (col, key, sort) => {
      if (state.unsubs[key]) state.unsubs[key]();
      state.unsubs[key] = col.onSnapshot(snap => {
        state[key] = snap.docs.map(d => ({id: d.id, ...d.data()}));
        if (sort) state[key].sort((a,b) => (a.order||0)-(b.order||0));
        if (this._onHome()) this.renderHome();
      }, err => console.warn(key, err.message));
    };
    listen(COL.published,      'published',      true);
    listen(COL.drafts,         'drafts',         true);
    listen(COL.pronomen,       'pronomen',       true);
    listen(COL.vokabel,        'vokabel',        true);
    listen(COL.pronomenDrafts, 'pronomenDrafts', true);
    listen(COL.vokabelDrafts,  'vokabelDrafts',  true);
    // Goetter: always re-render (goetter page updates live)
    if (state.unsubs['goetter']) state.unsubs['goetter']();
    state.unsubs['goetter'] = COL.goetter.onSnapshot(snap => {
      state.goetter = snap.docs.map(d => ({id: d.id, ...d.data()}));
      state.goetter.sort((a,b) => (a.order||0)-(b.order||0));
      Goetter.renderHome();
    }, err => console.warn('goetter', err.message));
  },

  _onHome() { return document.getElementById('page-home').classList.contains('active'); },

  _prevPage: null,

  showPage(id, name) {
    const current = document.querySelector('.page.active')?.id?.replace('page-','');
    if (current && current !== id) {
      this._prevPage = current === 'home' ? null : current;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-'+id)?.classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('topbar-center').textContent = name || '';
    if (id === 'gt-deklinationen') setTimeout(() => GrammarTables.renderDeklinationen(), 0);
    if (id === 'gt-konjugationen') setTimeout(() => GrammarTables.renderKonjugationen(), 0);
  },

  goBack() {
    if (this._prevPage && this._prevPage !== 'home') {
      const target   = this._prevPage;
      this._prevPage = null;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-'+target)?.classList.add('active');
      window.scrollTo(0, 0);
    } else {
      this.goHome();
    }
  },

  goHome() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    this._prevPage = null;
    this.renderHome();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-home')?.classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('topbar-center').textContent = '';
  },

  switchTab(tab) {
    state.currentTab = 'tables';
    document.getElementById('tab-content-tables')?.classList.remove('hidden');
  },

  // ── Startseite rendern ────────────────────────────────────
  renderHome() {
    const isAdmin = state.adminLoggedIn;

    const pdg = document.getElementById('pronomen-draft-grid');
    const pds = document.getElementById('pronomen-draft-section');
    if (pdg && pds) {
      pds.classList.toggle('hidden', !isAdmin);
      if (isAdmin) {
        pdg.innerHTML = '';
        state.pronomenDrafts.forEach(t => pdg.appendChild(this._makeTableDraftCard(t,'pronomen')));
        document.getElementById('pronomen-draft-empty').style.display =
          state.pronomenDrafts.length ? 'none' : 'block';
      }
    }

    const pg = document.getElementById('pronomen-grid');
    const pe = document.getElementById('pronomen-empty');
    pg.innerHTML = '';
    if (!state.pronomen.length) { pe.style.display = 'block'; }
    else { pe.style.display = 'none'; state.pronomen.forEach(t => pg.appendChild(this._makeTableCard(t,'pronomen'))); }

    const vdg = document.getElementById('vokabel-draft-grid');
    const vds = document.getElementById('vokabel-draft-section');
    if (vdg && vds) {
      vds.classList.toggle('hidden', !isAdmin);
      if (isAdmin) {
        vdg.innerHTML = '';
        state.vokabelDrafts.forEach(t => vdg.appendChild(this._makeTableDraftCard(t,'vokabel')));
        document.getElementById('vokabel-draft-empty').style.display =
          state.vokabelDrafts.length ? 'none' : 'block';
      }
    }

    const vg        = document.getElementById('vokabel-grid');
    const ve        = document.getElementById('vokabel-empty');
    vg.innerHTML    = '';
    const sortedVok = [...state.vokabel].sort((a,b) =>
      a.name.localeCompare(b.name,'de',{numeric:true,sensitivity:'base'})
    );
    if (!sortedVok.length) { ve.style.display = 'block'; }
    else { ve.style.display = 'none'; sortedVok.forEach(t => vg.appendChild(this._makeTableCard(t,'vokabel'))); }

    const alleCount = sortedVok.reduce((s,t) => (t.rows?.length||0)+s, 0);
    const alleEl    = document.getElementById('alle-vok-count');
    if (alleEl) alleEl.textContent = alleCount + ' Vokabeln aus ' + sortedVok.length + ' Listen';
  },

  _makeDraftCard(q) {
    const card = document.createElement('div');
    card.className = 'quiz-card admin-mode-click draft-card';
    card.innerHTML = `
      <div class="draft-pill">Entwurf</div>
      <div class="quiz-card-name">${q.name}</div>
      <div class="quiz-card-desc">${q.desc||''}</div>`;
    card.onclick = () => App.showDraftActions(q.id);
    return card;
  },

  _makePublishedCard(q) {
    const card = document.createElement('div');
    card.className = 'quiz-card' + (state.adminLoggedIn ? ' admin-mode' : '');
    card.innerHTML = `
      <div class="quiz-card-name">${q.name}</div>
      <div class="quiz-card-desc">${q.desc||''}</div>
      ${state.adminLoggedIn ? `<div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>` : ''}`;
    if (state.adminLoggedIn) {
      card.querySelector('.card-overlay-edit').onclick = e => { e.stopPropagation(); App.openEditor(q.id,'published'); };
      card.querySelector('.card-overlay-del').onclick  = e => { e.stopPropagation(); App.confirmDelete(q.id); };
    } else {
      card.onclick = () => App.openSetup(q.id, 'published');
    }
    return card;
  },

  _makeTableCard(t, type) {
    const card      = document.createElement('div');
    const typeLabel = type === 'pronomen' ? 'Pronomen' : 'Vokabeln';
    card.className  = 'quiz-card' + (state.adminLoggedIn ? ' admin-mode' : '');
    card.innerHTML  = `
      <div class="table-type-pill">${typeLabel}</div>
      <div class="quiz-card-name">${t.name}</div>
      <div class="quiz-card-desc">${t.desc||''}</div>
      ${state.adminLoggedIn ? `<div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>` : ''}`;
    if (state.adminLoggedIn) {
      card.querySelector('.card-overlay-edit').onclick = e => { e.stopPropagation();
        type === 'pronomen' ? Tables.openPronomenEditor(t.id) : Tables.openVokabelEditor(t.id);
      };
      card.querySelector('.card-overlay-del').onclick = e => { e.stopPropagation(); Tables.confirmDelete(t.id, type); };
    }
    card.onclick = () => Tables.viewTable(t.id, type);
    return card;
  },

  _makeTableDraftCard(t, type) {
    const typeLabel = type === 'pronomen' ? 'Pronomen' : 'Vokabeln';
    const card      = document.createElement('div');
    card.className  = 'quiz-card admin-mode draft-card';
    card.innerHTML  = `
      <div class="draft-pill">Entwurf · ${typeLabel}</div>
      <div class="quiz-card-name">${t.name}</div>
      <div class="quiz-card-desc">${t.desc||''}</div>
      <div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-pub">Veröffentlichen</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>`;
    card.querySelector('.card-overlay-edit').onclick = e => { e.stopPropagation();
      type === 'pronomen' ? Tables.openPronomenEditor(t.id,'draft') : Tables.openVokabelEditor(t.id,'draft');
    };
    card.querySelector('.card-overlay-pub').onclick = e => { e.stopPropagation(); Tables.publishTableDraft(t.id, type, e.target); };
    card.querySelector('.card-overlay-del').onclick = e => { e.stopPropagation(); Tables.deleteTableDraft(t.id, type); };
    card.onclick = () => Tables.viewTable(t.id, type, true);
    return card;
  },

  // ── Quiz-Flow ─────────────────────────────────────────────
  openSetup(id, source) {
    const q = source === 'draft' ? state.drafts.find(x=>x.id===id) : state.published.find(x=>x.id===id);
    if (!q) return;
    state.currentQuiz = q; state.lastQuizId = id; state.lastQuizSource = source;
    state.quizType = 'pronomen';
    document.getElementById('setup-title').textContent = q.name;
    document.getElementById('setup-desc').textContent  = q.desc || '';
    document.getElementById('setup-pronomen').classList.remove('hidden');
    document.getElementById('setup-vokabel').classList.add('hidden');
    document.querySelectorAll('input[name="phase"]').forEach(cb => { cb.checked = cb.value === '1'; });
    document.getElementById('shuffle-within').checked = false;
    this.showPage('setup', q.name);
  },

  // ── Reports ───────────────────────────────────────────────
  async loadReports() {
    const grid = document.getElementById('reports-list');
    if (!grid) return;
    try {
      const snap = await COL.reports.orderBy('timestamp','desc').limit(50).get();
      const docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
      grid.innerHTML = '';
      if (!docs.length) { grid.innerHTML = '<div class="reports-empty">Keine Meldungen.</div>'; return; }
      docs.forEach(doc => {
        const date = new Date(doc.timestamp).toLocaleString('de-AT');
        const div  = document.createElement('div');
        div.className = 'report-item' + (doc.read ? ' report-read' : '');
        div.innerHTML = `
          <div class="report-item-context" onclick="App.navigateToReport('${escHtml(doc.encodedContext||'')}',this)">${escHtml(doc.context||'Unbekannt')} <span class="report-nav-hint">→</span></div>
          <div class="report-item-msg">${escHtml(doc.message||'')}</div>
          <div class="report-item-footer">
            <span>${date}</span>
            <button onclick="App.markReportRead('${doc.id}',this)">✓ Gelesen</button>
            <button class="btn-danger-text" onclick="App.deleteReport('${doc.id}',this)">Löschen</button>
          </div>`;
        grid.appendChild(div);
      });
      this.updateBellBadge();
    } catch(e) { console.error('loadReports error:', e); }
  },

  navigateToReport(encoded, el) {
    document.getElementById('reports-panel').classList.add('hidden');
    document.getElementById('reports-backdrop').classList.add('hidden');
    if (!encoded) return;
    if (encoded.startsWith('VOK:')) {
      const parts = encoded.split(':');
      const tid = parts[1], idx = parseInt(parts[2]);
      if (tid && !isNaN(idx)) { VokDetail.open(idx, tid); return; }
    }
    if (encoded.startsWith('QUIZ:')) {
      const parts = encoded.split(':');
      const tid = parts[1], idx = parseInt(parts[2]);
      if (tid && !isNaN(idx)) { VokDetail.open(idx, tid); return; }
      const word = parts[3];
      if (word) {
        for (const t of state.vokabel) {
          const i = (t.rows||[]).findIndex(r => r.lat === word);
          if (i >= 0) { VokDetail.open(i, t.id); return; }
        }
      }
    }
  },

  async markReportRead(id, btn) {
    try { await COL.reports.doc(id).update({read: true}); } catch(e) {}
    btn.closest('.report-item').classList.add('report-read');
    this.updateBellBadge();
  },

  async deleteReport(id, btn) {
    try { await COL.reports.doc(id).delete(); } catch(e) {}
    btn.closest('.report-item').remove();
    this.updateBellBadge();
  },

  toggleReportsPanel() {
    const panel    = document.getElementById('reports-panel');
    const backdrop = document.getElementById('reports-backdrop');
    if (!panel) return;
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    backdrop.classList.toggle('hidden', !opening);
    if (opening) this.loadReports();
  },

  async updateBellBadge() {
    if (!state.adminLoggedIn) return;
    try {
      const snap  = await COL.reports.where('read','==',false).get();
      const count = snap.size;
      const bell  = document.getElementById('bell-btn');
      if (!bell) return;
      bell.classList.remove('hidden');
      let badge = bell.querySelector('.badge');
      if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; bell.appendChild(badge); }
      badge.textContent = count;
      badge.style.display = count > 0 ? 'block' : 'none';
    } catch(e) { console.error('updateBellBadge:', e); }
  },

  // ── Admin-Verwaltung ──────────────────────────────────────
  openAdminSettings() {
    document.getElementById('admin-settings-overlay').classList.remove('hidden');
    this.loadAdminList();
  },

  closeAdminSettings(e) {
    if (e && e.target !== document.getElementById('admin-settings-overlay')) return;
    document.getElementById('admin-settings-overlay').classList.add('hidden');
  },

  async loadAdminList() {
    const list = document.getElementById('admin-list');
    if (!list) return;
    try {
      const snap = await COL.admins.orderBy('name').get();
      list.innerHTML = '';
      if (snap.empty) { list.innerHTML = '<div class="admin-list-empty">Keine weiteren Admins.</div>'; }
      snap.docs.forEach(doc => {
        const d   = doc.data();
        // Überspringe den internen Super-Admin-Eintrag
        if (doc.id === '_super') return;
        const row = document.createElement('div');
        row.className = 'admin-list-row';
        row.innerHTML = `
          <div class="admin-list-info">
            <span class="admin-list-name">${escHtml(d.name||d.username)}</span>
            <span class="admin-list-user">@${escHtml(d.username)}</span>
          </div>
          <div class="admin-list-actions">
            <button onclick="App.editAdmin('${doc.id}','${escHtml(d.name||'')}','${escHtml(d.username)}')">Bearbeiten</button>
            <button class="btn-danger-text" onclick="App.deleteAdmin('${doc.id}',this)">Entfernen</button>
          </div>`;
        list.appendChild(row);
      });
    } catch(e) { console.error(e); }
  },

  async saveNewAdmin() {
    const name = document.getElementById('new-admin-name').value.trim();
    const user = document.getElementById('new-admin-user').value.trim().toLowerCase();
    const pass = document.getElementById('new-admin-pass').value;
    const err  = document.getElementById('new-admin-error');
    if (!name||!user||!pass) { err.textContent='Alle Felder ausfüllen.'; err.classList.remove('hidden'); return; }
    try {
      const existing = await COL.admins.where('username','==',user).get();
      if (!existing.empty) { err.textContent='Benutzername bereits vergeben.'; err.classList.remove('hidden'); return; }
      // Passwort wird sofort gehasht gespeichert
      const hashedPass = await hashPassword(pass);
      await COL.admins.add({ name, username: user, password: hashedPass, createdAt: Date.now() });
      document.getElementById('new-admin-name').value = '';
      document.getElementById('new-admin-user').value = '';
      document.getElementById('new-admin-pass').value = '';
      err.classList.add('hidden');
      this.loadAdminList();
    } catch(e) { err.textContent='Fehler: '+e.message; err.classList.remove('hidden'); }
  },

  editAdmin(id, name, username) {
    document.getElementById('edit-admin-id').value   = id;
    document.getElementById('edit-admin-name').value = name;
    document.getElementById('edit-admin-user').value = username;
    document.getElementById('edit-admin-pass').value = '';
    document.getElementById('edit-admin-error').classList.add('hidden');
    document.getElementById('edit-admin-section').classList.remove('hidden');
    document.getElementById('edit-admin-section').scrollIntoView({behavior:'smooth'});
  },

  async saveEditAdmin() {
    const id   = document.getElementById('edit-admin-id').value;
    const name = document.getElementById('edit-admin-name').value.trim();
    const user = document.getElementById('edit-admin-user').value.trim().toLowerCase();
    const pass = document.getElementById('edit-admin-pass').value;
    const err  = document.getElementById('edit-admin-error');
    if (!name||!user) { err.textContent='Name und Benutzername erforderlich.'; err.classList.remove('hidden'); return; }
    const updates = { name, username: user };
    if (pass) updates.password = await hashPassword(pass);
    try {
      await COL.admins.doc(id).update(updates);
      document.getElementById('edit-admin-section').classList.add('hidden');
      this.loadAdminList();
    } catch(e) { err.textContent='Fehler: '+e.message; err.classList.remove('hidden'); }
  },

  async deleteAdmin(id, btn) {
    if (!confirm('Admin wirklich entfernen?')) return;
    try {
      await COL.admins.doc(id).delete();
      btn.closest('.admin-list-row').remove();
    } catch(e) { alert('Fehler: '+e.message); }
  },

  openOwnSettings() {
    const admin = state.currentAdmin;
    if (!admin) return;
    document.getElementById('own-settings-name').value     = admin.name || '';
    document.getElementById('own-settings-username').value = admin.username || '';
    document.getElementById('own-settings-old').value      = '';
    document.getElementById('own-settings-new').value      = '';
    document.getElementById('own-settings-error').classList.add('hidden');
    document.getElementById('own-settings-success').classList.add('hidden');
    document.getElementById('own-settings-overlay').classList.remove('hidden');
  },

  closeOwnSettings(e) {
    if (e && e.target !== document.getElementById('own-settings-overlay')) return;
    document.getElementById('own-settings-overlay').classList.add('hidden');
  },

  async saveOwnSettings() {
    const name     = document.getElementById('own-settings-name').value.trim();
    const username = document.getElementById('own-settings-username').value.trim().toLowerCase();
    const oldPass  = document.getElementById('own-settings-old').value;
    const newPass  = document.getElementById('own-settings-new').value;
    const err      = document.getElementById('own-settings-error');
    const succ     = document.getElementById('own-settings-success');
    err.classList.add('hidden');

    const admin = state.currentAdmin;
    if (!admin) return;

    if (newPass && !oldPass) {
      err.textContent = 'Altes Passwort eingeben.'; err.classList.remove('hidden'); return;
    }

    try {
      if (admin.isSuperAdmin) {
        // Super-Admin: Passwort aus Firestore doc '_super' prüfen
        const superDoc = await COL.admins.doc('_super').get();
        const stored   = superDoc.exists ? superDoc.data().password : null;

        if (oldPass) {
          const ok = await verifyAndMigratePassword(oldPass, stored, COL.admins.doc('_super'));
          if (!ok) { err.textContent='Altes Passwort stimmt nicht.'; err.classList.remove('hidden'); return; }
        }
        const updates = {};
        if (name)     { updates.name = name; admin.name = name; }
        if (username) updates.username = username;
        if (newPass)  updates.password = await hashPassword(newPass);
        if (Object.keys(updates).length) {
          await COL.admins.doc('_super').set(updates, {merge: true});
        }
      } else {
        // Normaler Admin
        const doc  = await COL.admins.doc(admin.id).get();
        if (!doc.exists) { err.textContent='Admin nicht gefunden.'; err.classList.remove('hidden'); return; }

        if (oldPass) {
          const ok = await verifyAndMigratePassword(oldPass, doc.data().password, COL.admins.doc(admin.id));
          if (!ok) { err.textContent='Altes Passwort stimmt nicht.'; err.classList.remove('hidden'); return; }
        }
        const updates = {};
        if (name)     { updates.name = name; admin.name = name; }
        if (username) updates.username = username;
        if (newPass)  updates.password = await hashPassword(newPass);
        if (Object.keys(updates).length) await COL.admins.doc(admin.id).update(updates);
      }

      succ.classList.remove('hidden');
      setTimeout(() => document.getElementById('own-settings-overlay').classList.add('hidden'), 1500);
    } catch(e) { err.textContent='Fehler: '+e.message; err.classList.remove('hidden'); }
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
    const count   = parseInt(document.getElementById('alle-quiz-count').value) || 20;
    const modes   = [...document.querySelectorAll('input[name="aqphase"]:checked')].map(c=>c.value);
    if (!modes.length) { alert('Bitte mindestens eine Abfrageart wählen.'); return; }
    const shuffle = document.getElementById('aq-shuffle')?.checked ?? true;
    VokabelQuiz._requireFall2 = document.getElementById('aq-require-fall2')?.checked || false;
    VokabelQuiz._requireGenus = document.getElementById('aq-require-genus')?.checked || false;

    const sorted = [...state.vokabel].sort((a,b) => a.name.localeCompare(b.name,'de',{numeric:true}));
    let allRows  = [];
    sorted.forEach(t => (t.rows||[]).forEach(r => allRows.push(r)));
    allRows = allRows.sort(() => Math.random() - 0.5).slice(0, count);

    const questions = VokabelQuiz.build(allRows, modes, shuffle, false);
    if (!questions.length) { alert('Keine Vokabeln gefunden.'); return; }

    Quiz._pendingPruefung = document.getElementById('aq-pruefung')?.checked || false;
    document.getElementById('alle-quiz-overlay').classList.add('hidden');
    state.quizType = 'vokabel'; state._quizOrigin = 'alle';
    state.currentVokabelTable = { name: 'Alle Vokabeln', rows: allRows };
    Quiz.startVokabel(questions, 'Alle Vokabeln');
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
    const selectedIds   = [...document.querySelectorAll('input[name="cqlist"]:checked')].map(c=>c.value);
    if (!selectedIds.length) { alert('Bitte mindestens eine Liste auswählen.'); return; }
    const modes         = [...document.querySelectorAll('input[name="cqphase"]:checked')].map(c=>c.value);
    if (!modes.length)  { alert('Bitte mindestens eine Abfrageart wählen.'); return; }
    const shuffle       = document.getElementById('cq-shuffle')?.checked ?? true;
    VokabelQuiz._requireFall2  = document.getElementById('cq-require-fall2')?.checked || false;
    VokabelQuiz._requireGenus  = document.getElementById('cq-require-genus')?.checked || false;
    const pruefungCustom       = document.getElementById('cq-pruefung')?.checked || false;

    const allRows = [];
    selectedIds.forEach(id => {
      const t = state.vokabel.find(x => x.id === id);
      if (t) (t.rows||[]).forEach(r => allRows.push(r));
    });
    const questions = VokabelQuiz.build(allRows, modes, shuffle, false);
    if (!questions.length) { alert('Keine Vokabeln in den gewählten Listen.'); return; }

    Quiz._pendingPruefung = pruefungCustom;
    document.getElementById('custom-quiz-overlay').classList.add('hidden');
    const names = selectedIds.map(id => state.vokabel.find(x=>x.id===id)?.name||'').filter(Boolean);
    state.quizType = 'vokabel'; state._quizOrigin = 'custom'; state._customQuizIds = selectedIds;
    state.currentVokabelTable = { name: names.join(', '), rows: allRows };
    Quiz.startVokabel(questions, names.join(' + '));
  },

  toggleDeLatOptions() {
    const checked = document.getElementById('vphase-de-lat')?.checked;
    document.getElementById('de-lat-options')?.classList.toggle('hidden', !checked);
  },

  toggleAqDeLatOpts() {
    const checked = document.getElementById('aq-de-lat')?.checked;
    document.getElementById('aq-de-lat-opts')?.classList.toggle('hidden', !checked);
  },

  toggleCqDeLatOpts() {
    const checked = document.getElementById('cq-de-lat')?.checked;
    document.getElementById('cq-de-lat-opts')?.classList.toggle('hidden', !checked);
  },

  openVokabelQuizSetup(tableId) {
    const t = state.vokabel.find(x => x.id === tableId);
    if (!t) return;
    state.quizType = 'vokabel'; state.currentVokabelTable = t;
    state.lastQuizId = tableId; state.lastQuizSource = 'vokabel'; state._quizOrigin = 'table';
    document.getElementById('setup-title').textContent = t.name;
    document.getElementById('setup-desc').textContent  = (t.rows||[]).length + ' Vokabeln';
    document.getElementById('setup-pronomen').classList.add('hidden');
    document.getElementById('setup-vokabel').classList.remove('hidden');
    document.querySelectorAll('input[name="vphase"]').forEach(cb => { cb.checked = cb.value === 'lat-de'; });
    document.getElementById('vok-shuffle').checked = false;
    this.showPage('setup', t.name);
  },

  startVokabelQuiz() {
    if (state.tableViewType === 'pronomen') {
      const t = state.pronomen.find(x => x.id === state.tableViewId);
      if (!t) return;
      state.quizType = 'pronomen';
      state.currentQuiz = { id:t.id, name:t.name, desc:t.desc||'', sg:t.sg, pl:t.pl, de_sg:t.de_sg, de_pl:t.de_pl };
      state.lastQuizId = t.id; state.lastQuizSource = 'pronomen-table';
      document.getElementById('setup-title').textContent = t.name;
      document.getElementById('setup-desc').textContent  = t.desc||'';
      document.getElementById('setup-pronomen').classList.remove('hidden');
      document.getElementById('setup-vokabel').classList.add('hidden');
      document.querySelectorAll('input[name="phase"]').forEach(cb => { cb.checked = cb.value === '1'; });
      document.getElementById('shuffle-within').checked = false;
      this.showPage('setup', t.name);
    } else {
      const t = state.vokabel.find(x => x.id === state.tableViewId);
      if (!t) return;
      this.openVokabelQuizSetup(t.id);
    }
  },

  startQuiz() {
    if (state.quizType === 'vokabel') {
      const checked = [...document.querySelectorAll('input[name="vphase"]:checked')];
      if (!checked.length) { alert('Bitte wähle mindestens eine Abfrage aus.'); return; }
      const modes   = checked.map(c => c.value);
      const shuffle = document.getElementById('vok-shuffle').checked;
      VokabelQuiz._requireFall2 = document.getElementById('vok-require-fall2')?.checked || false;
      VokabelQuiz._requireGenus = document.getElementById('vok-require-genus')?.checked || false;
      const rows    = state.currentVokabelTable.rows || [];
      const questions = VokabelQuiz.build(rows, modes, shuffle, false);
      if (!questions.length) { alert('Keine Vokabeln für diese Auswahl vorhanden.'); return; }
      Quiz.startVokabel(questions, state.currentVokabelTable.name);
    } else {
      const checked = [...document.querySelectorAll('input[name="phase"]:checked')];
      if (!checked.length) { alert('Bitte wähle mindestens eine Phase.'); return; }
      Quiz.start(state.currentQuiz, checked.map(c=>parseInt(c.value)), document.getElementById('shuffle-within').checked);
    }
  },

  replaySetup() {
    const origin = state._quizOrigin;
    if      (origin === 'alle')   { this.openAlleVokabelQuiz(); }
    else if (origin === 'custom') {
      this.openCustomQuiz();
      setTimeout(() => {
        (state._customQuizIds||[]).forEach(id => {
          const cb = document.querySelector(`input[name="cqlist"][value="${id}"]`);
          if (cb) cb.checked = true;
        });
      }, 50);
    }
    else if (origin === 'table' && state.lastQuizId) { this.openVokabelQuizSetup(state.lastQuizId); }
    else if (state.lastQuizId)                        { this.openSetup(state.lastQuizId, state.lastQuizSource); }
    else                                               { this.goHome(); }
  },

  // ── Admin Login ───────────────────────────────────────────
  showGottActions(id) {
    const g = state.goetter.find(x=>x.id===id);
    if (!g) return;
    state.actionId   = id;
    state.actionType = 'gott';
    document.getElementById('card-action-title').textContent = g.nameGre||g.nameRom||'?';
    document.getElementById('card-action-desc').textContent  = (g.bereiche||[]).join(' · ');
    const pubBtn = document.getElementById('card-action-publish-btn');
    if (pubBtn) pubBtn.style.display = 'none';
    document.getElementById('card-action-overlay').classList.remove('hidden');
  },

  closeNewsBanner() {
    document.getElementById('news-overlay')?.classList.add('hidden');
    try { localStorage.setItem('news_v3', '1'); } catch(err) {}
  },

  handleAdminBtn() {
    if (state.adminLoggedIn) {
      state.adminLoggedIn = false; state.currentAdmin = null;
      try { sessionStorage.removeItem('adminData'); } catch(e) {}
      document.getElementById('admin-topbtn').classList.remove('active');
      document.getElementById('admin-topbtn').textContent = 'Admin';
      document.getElementById('add-btn').classList.add('hidden');
      ['bell-btn','admin-settings-btn','own-settings-btn'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
      });
      ['reports-panel','reports-backdrop'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
      });
      this.renderHome();
    } else { this.openLogin(); }
  },

  openLogin() {
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-username').focus(), 80);
  },

  closeLogin(e)       { if(e&&e.target!==document.getElementById('login-overlay'))return; document.getElementById('login-overlay').classList.add('hidden'); },
  closeLoginForced()  { document.getElementById('login-overlay').classList.add('hidden'); },

  // ── Sicherer Login mit SHA-256 ────────────────────────────
  // Passwörter werden niemals im Klartext verglichen.
  // Bestehende Klartext-Passwörter werden beim ersten Login automatisch migriert.
  async adminLogin() {
    const u = document.getElementById('admin-username').value.trim();
    const p = document.getElementById('admin-password').value;

    // Super-Admin: Daten aus Firestore '_super' doc
    try {
      const superDoc = await COL.admins.doc('_super').get();
      if (superDoc.exists) {
        const d = superDoc.data();
        if (u === (d.username || 'admin')) {
          const ok = await verifyAndMigratePassword(p, d.password, COL.admins.doc('_super'));
          if (ok) {
            this._setAdminLoggedIn({
              id: 'super', name: d.name || 'Super-Admin',
              username: d.username || 'admin', isSuperAdmin: true
            });
            return;
          }
        }
      } else {
        // Erster Start: '_super' doc existiert noch nicht → Fallback auf hardcoded Default
        // WICHTIG: Bitte sofort nach dem ersten Login das Passwort ändern!
        if (u === 'admin' && p === 'latina2024') {
          // Erstellt den sicheren Eintrag automatisch
          const hashedPass = await hashPassword(p);
          await COL.admins.doc('_super').set({
            username: 'admin', name: 'Super-Admin', password: hashedPass
          });
          this._setAdminLoggedIn({ id:'super', name:'Super-Admin', username:'admin', isSuperAdmin:true });
          return;
        }
      }
    } catch(e) { console.error('Super-Admin check:', e); }

    // Normaler Admin
    try {
      const snap = await COL.admins.where('username','==',u).get();
      if (!snap.empty) {
        const doc  = snap.docs[0];
        const data = doc.data();
        if (doc.id === '_super') { /* wird oben behandelt */ }
        else {
          const ok = await verifyAndMigratePassword(p, data.password, COL.admins.doc(doc.id));
          if (ok) {
            this._setAdminLoggedIn({ id: doc.id, name: data.name||u, username: u, isSuperAdmin: false });
            return;
          }
        }
      }
    } catch(e) { console.error('Admin login:', e); }

    document.getElementById('login-error').classList.remove('hidden');
  },

  _setAdminLoggedIn(adminData) {
    state.adminLoggedIn = true;
    state.currentAdmin  = adminData;
    try { sessionStorage.setItem('adminData', JSON.stringify(adminData)); } catch(e) {}
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-topbtn').classList.add('active');
    document.getElementById('admin-topbtn').textContent = 'Ausloggen';
    document.getElementById('add-btn').classList.remove('hidden');
    document.getElementById('admin-settings-btn')?.classList.toggle('hidden', !adminData.isSuperAdmin);
    document.getElementById('own-settings-btn')?.classList.remove('hidden');
    document.getElementById('bell-btn')?.classList.remove('hidden');
    this.updateBellBadge();
    this.renderHome();
  },

  // ── Add-Menü ──────────────────────────────────────────────
  openAddMenu()  { document.getElementById('add-menu-overlay').classList.remove('hidden'); },
  closeAddMenu(e) {
    if(e&&e.target!==document.getElementById('add-menu-overlay'))return;
    document.getElementById('add-menu-overlay').classList.add('hidden');
  },

  // ── Quiz löschen ──────────────────────────────────────────
  confirmDelete(id) {
    const q = state.published.find(x=>x.id===id); if(!q)return;
    state.actionId = id;
    document.getElementById('card-action-title').textContent = q.name;
    document.getElementById('card-action-desc').textContent  = q.desc||'';
    state.actionType = 'quiz';
    document.getElementById('card-action-overlay').classList.remove('hidden');
  },
  closeCardAction(e) {
    if (e && e.target !== document.getElementById('card-action-overlay')) return;
    document.getElementById('card-action-overlay').classList.add('hidden');
    state.actionType = null;
  },
  editFromModal() {
    const id   = state.actionId;
    const type = state.actionType;
    state.actionType = null;
    document.getElementById('card-action-overlay').classList.add('hidden');
    if (type === 'gott')  { Goetter.openEditor(id); return; }
    if (type === 'draft') { this.openEditor(id, 'draft'); return; }
    this.openEditor(id, 'published');
  },
  async deleteFromModal() {
    const id   = state.actionId;
    const type = state.actionType;
    state.actionType = null;
    document.getElementById('card-action-overlay').classList.add('hidden');
    if (type === 'gott')  { await Goetter.deleteGott(id); return; }
    if (type === 'draft') { try { await COL.drafts.doc(id).delete(); } catch(e){ alert('Fehler: '+e.message); } return; }
    try { await COL.published.doc(id).delete(); } catch(e){ alert('Fehler: '+e.message); }
  },

  async deleteDraft(id) {
    if(!confirm('Entwurf löschen?'))return;
    try { await COL.drafts.doc(id).delete(); } catch(e){ alert('Fehler: '+e.message); }
  },
  async publishDraft(id, btn) {
    const draft=state.drafts.find(q=>q.id===id); if(!draft)return;
    if(btn){btn.textContent='…';btn.disabled=true;}
    const pubId='pub_'+Date.now();
    try {
      await COL.published.doc(pubId).set({...draft,id:pubId,order:Date.now()});
      await COL.drafts.doc(id).delete();
    } catch(e){ alert('Fehler: '+e.message); if(btn){btn.textContent='Veröffentlichen';btn.disabled=false;} }
  },

  showDraftActions(id) {
    const q = state.drafts.find(x=>x.id===id); if(!q)return;
    state.actionId   = id;
    state.actionType = 'draft';
    document.getElementById('card-action-title').textContent=q.name;
    document.getElementById('card-action-desc').textContent=q.desc||'';
    document.getElementById('card-action-overlay').classList.remove('hidden');
  },

  // ── Quiz-Editor ───────────────────────────────────────────
  buildEditorGrids(prefix) {
    ['sg-columns','pl-columns','de-sg-columns','de-pl-columns'].forEach(sec => {
      const wrap = document.getElementById(prefix+sec); if(!wrap)return;
      wrap.innerHTML = '';
      GENDERS.forEach(g => {
        const col = document.createElement('div'); col.className = 'genus-col';
        col.innerHTML = `<div class="genus-col-header ${GENDER_CLASS[g]}">${GENDER_LABEL[g]}</div>`;
        CASES.forEach(c => {
          const f = document.createElement('div'); f.className = 'genus-field';
          f.innerHTML = `<label>${CASE_NAMES[c]}</label><input type="text" id="${prefix}${sec}_${g}_${c}" placeholder="${CASE_NAMES[c].substring(0,3).toLowerCase()}." />`;
          col.appendChild(f);
        });
        wrap.appendChild(col);
      });
    });
  },

  openEditor(id, source) {
    state.editingId=id||null; state.editingSource=source||null;
    const isNew=!id;
    document.getElementById('editor-page-title').textContent=isNew?'Neues Quiz':'Quiz bearbeiten';
    document.getElementById('create-error').classList.add('hidden');
    if(isNew){ this._clearQuizForm(''); }
    else {
      const q=source==='draft'?state.drafts.find(x=>x.id===id):state.published.find(x=>x.id===id);
      if(q) this._fillQuizForm('',q); else this._clearQuizForm('');
    }
    this.showPage('editor', isNew?'Neues Quiz':'Bearbeiten');
  },

  _nameId(prefix) { return prefix==='pt-' ? 'pt-name' : 'new-quiz-name'; },
  _descId(prefix) { return prefix==='pt-' ? 'pt-desc' : 'new-quiz-desc'; },

  _clearQuizForm(prefix) {
    document.getElementById(this._nameId(prefix)).value='';
    document.getElementById(this._descId(prefix)).value='';
    ['sg-columns','pl-columns','de-sg-columns','de-pl-columns'].forEach(sec=>
      GENDERS.forEach(g=>CASES.forEach(c=>{
        const el=document.getElementById(`${prefix}${sec}_${g}_${c}`); if(el)el.value='';
      }))
    );
  },

  _fillQuizForm(prefix, q) {
    document.getElementById(this._nameId(prefix)).value=q.name||'';
    document.getElementById(this._descId(prefix)).value=q.desc||'';
    const map={'sg-columns':q.sg,'pl-columns':q.pl,'de-sg-columns':q.de_sg,'de-pl-columns':q.de_pl};
    Object.entries(map).forEach(([sec,data])=>
      GENDERS.forEach(g=>CASES.forEach(c=>{
        const el=document.getElementById(`${prefix}${sec}_${g}_${c}`); if(el)el.value=data?.[g]?.[c]||'';
      }))
    );
  },

  _readQuizForm(prefix) {
    const read = sec => {
      const r={}; GENDERS.forEach(g=>{r[g]={};CASES.forEach(c=>{
        r[g][c]=document.getElementById(`${prefix}${sec}_${g}_${c}`)?.value.trim()||'';
      });}); return r;
    };
    return {
      name: document.getElementById(this._nameId(prefix)).value.trim(),
      desc: document.getElementById(this._descId(prefix)).value.trim(),
      sg:   read('sg-columns'), pl:   read('pl-columns'),
      de_sg:read('de-sg-columns'), de_pl:read('de-pl-columns')
    };
  },

  _validateQuiz(data, errId, requireAll) {
    const err=document.getElementById(errId);
    if(!data.name){ err.textContent='Bitte gib einen Namen ein.'; err.classList.remove('hidden'); return false; }
    if(requireAll){
      let ok=true;
      [data.sg,data.pl,data.de_sg,data.de_pl].forEach(obj=>GENDERS.forEach(g=>CASES.forEach(c=>{ if(!obj[g][c])ok=false; })));
      if(!ok){ err.textContent='Bitte fülle alle Felder aus.'; err.classList.remove('hidden'); return false; }
    }
    return true;
  },

  async saveDraft() {
    const data=this._readQuizForm(''); if(!this._validateQuiz(data,'create-error',false))return;
    document.getElementById('create-error').classList.add('hidden');
    const btn=document.getElementById('draft-btn'); btn.textContent='…'; btn.disabled=true;
    try {
      if(state.editingSource==='draft'&&state.editingId) {
        await COL.drafts.doc(state.editingId).set({id:state.editingId,order:Date.now(),...data});
      } else {
        const id='draft_'+Date.now(); await COL.drafts.doc(id).set({id,order:Date.now(),...data});
      }
      this.goHome();
    } catch(e){ document.getElementById('create-error').textContent='Fehler: '+e.message; document.getElementById('create-error').classList.remove('hidden'); }
    finally { btn.textContent='Als Entwurf speichern'; btn.disabled=false; }
  },

  async publishQuiz() {
    const data=this._readQuizForm(''); if(!this._validateQuiz(data,'create-error',true))return;
    const btn=document.getElementById('publish-btn'); btn.textContent='…'; btn.disabled=true;
    const isEditPub=state.editingSource==='published'&&state.editingId;
    const docId=isEditPub?state.editingId:'pub_'+Date.now();
    const order=isEditPub?(state.published.find(q=>q.id===state.editingId)?.order||Date.now()):Date.now();
    try {
      await COL.published.doc(docId).set({id:docId,order,...data});
      if(state.editingSource==='draft'&&state.editingId) await COL.drafts.doc(state.editingId).delete();
      this.goHome();
    } catch(e){ document.getElementById('create-error').textContent='Fehler: '+e.message; document.getElementById('create-error').classList.remove('hidden'); }
    finally { btn.textContent='Veröffentlichen'; btn.disabled=false; }
  },

  // ── Picker ────────────────────────────────────────────────
  openTablePickerForQuiz() {
    state.pickerMode='quiz-from-table';
    document.getElementById('picker-title').textContent='Aus welcher Pronomen-Tabelle?';
    const list=document.getElementById('picker-list'); list.innerHTML='';
    if(!state.pronomen.length){ list.innerHTML='<div class="empty-hint">Keine Pronomen-Tabellen vorhanden.</div>'; }
    else {
      state.pronomen.forEach(t=>{
        const btn=document.createElement('button'); btn.className='picker-item';
        btn.innerHTML=`<div class="picker-item-name">${t.name}</div><div class="picker-item-sub">${t.desc||''}</div>`;
        btn.onclick=()=>{ this.closePicker(); this._fillFromPronomenTable(t); };
        list.appendChild(btn);
      });
    }
    document.getElementById('picker-overlay').classList.remove('hidden');
  },

  openQuizPickerForTable() {
    state.pickerMode='table-from-quiz';
    document.getElementById('picker-title').textContent='Aus welchem Quiz übernehmen?';
    const list=document.getElementById('picker-list'); list.innerHTML='';
    const all=[...state.published,...state.drafts];
    if(!all.length){ list.innerHTML='<div class="empty-hint">Keine Quize vorhanden.</div>'; }
    else {
      all.forEach(q=>{
        const btn=document.createElement('button'); btn.className='picker-item';
        btn.innerHTML=`<div class="picker-item-name">${q.name}</div><div class="picker-item-sub">${q.desc||''}</div>`;
        btn.onclick=()=>{ this.closePicker(); Tables._fillPronomenFromQuiz(q); };
        list.appendChild(btn);
      });
    }
    document.getElementById('picker-overlay').classList.remove('hidden');
  },

  closePicker(e) {
    if(e&&e.target!==document.getElementById('picker-overlay'))return;
    document.getElementById('picker-overlay').classList.add('hidden');
  },

  _fillFromPronomenTable(t) {
    document.getElementById('new-quiz-name').value=t.name;
    document.getElementById('new-quiz-desc').value=t.desc||'';
    this._fillQuizForm('',t);
  },

  editTableFromView() {
    if(state.tableViewType==='pronomen') Tables.openPronomenEditor(state.tableViewId);
    else Tables.openVokabelEditor(state.tableViewId);
  },

  createQuizFromTable() {
    if(state.tableViewType!=='pronomen'){ alert('Quiz-Erstellung nur aus Pronomen-Tabellen möglich.'); return; }
    const t=state.pronomen.find(x=>x.id===state.tableViewId); if(!t)return;
    this.openEditor(null,null);
    setTimeout(()=>this._fillFromPronomenTable(t),50);
  },

  openAlleVokabeln() { VokSearch.openAlleVokabeln(); }
};
