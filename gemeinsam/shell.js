'use strict';

// ── Rahmen jeder Seite ────────────────────────────────────────
// Jede HTML-Seite der Website lädt diese Datei und ruft am Ende App.init({...}) auf.
// Der Rahmen kümmert sich um alles, was überall gleich ist:
//   • Kopfzeile, Fußzeile und die gemeinsamen Fenster (Login, Konto, Admins, Melden)
//   • Admin-Anmeldung über Firebase Authentication
//   • Daten aus Firestore laden und aktuell halten
//   • Wechsel zwischen den Ansichten (<main class="page">) innerhalb einer Themenseite
//
// Themenseiten hängen ihre eigenen Funktionen mit Object.assign(App, {...}) an.
const App = {

  // Adresse des Hauptordners – daraus entstehen alle Links (funktioniert in jedem Unterordner)
  ROOT: new URL('..', document.currentScript.src).href,

  // Alle Themen der Website. Die Startseite baut daraus ihre Karten.
  // Neues Thema: Ordner mit index.html anlegen und hier eine Zeile ergänzen.
  TOPICS: [
    { id: 'vokabeln',        title: 'Vokabeln',             lat: 'vocabula',      desc: 'Alle Listen durchsuchen, Formen nachschlagen und abfragen lassen' },
    { id: 'pronomina',       title: 'Pronomina',            lat: 'pronomina',     desc: 'Tabellen und Quiz zu den Pronomen' },
    { id: 'deklinationen',   title: 'Deklinationen',        lat: 'declinationes', desc: 'Die Endungen aller 5 Deklinationen, mit Erklärvideos' },
    { id: 'konjugationen',   title: 'Konjugationen',        lat: 'coniugationes', desc: 'Die 4 Konjugationen und die Zeiten im Überblick' },
    { id: 'unregelmaessige', title: 'Unregelmäßige Verben', lat: 'verba anomala', desc: 'esse, posse, ire und alle weiteren Formen zum Nachschlagen' },
    { id: 'kulturkunde',     title: 'Kulturkunde',          lat: 'res divinae',   desc: 'Griechische und römische Götter mit Stammbaum' }
  ],


  url(path) { return this.ROOT + path; },
  topicUrl(id) { return this.url(id + '/index.html'); },

  // Karten der Startseite. Unter jeder Karte steht, wie viel es dort gibt (homeCounts).
  renderTopics(el) {
    el.innerHTML = this.TOPICS.map(t => `
      <a class="quiz-card topic-card" href="${this.topicUrl(t.id)}">
        <div class="topic-card-lat" lang="la">${escHtml(t.lat)}</div>
        <div class="quiz-card-name">${escHtml(t.title)}</div>
        <div class="quiz-card-desc">${escHtml(t.desc)}</div>
        <div class="topic-card-count" id="topic-count-${t.id}"></div>
        <span class="topic-card-arrow">›</span>
      </a>`).join('');
  },

  homeCounts() {
    const n = (count, one, many) => count ? `${count} ${count === 1 ? one : many}` : '';
    const words = state.vokabel.reduce((sum, t) => sum + (t.rows?.length || 0), 0);
    const text = {
      vokabeln:        words ? `${words} Vokabeln in ${n(state.vokabel.length, 'Liste', 'Listen')}` : '',
      pronomina:       n(state.pronomen.length, 'Tabelle', 'Tabellen'),
      unregelmaessige: n(state.unregelmaessige.length, 'Verb', 'Verben'),
      kulturkunde:     n(state.goetter.length, 'Gottheit', 'Gottheiten')
    };
    Object.entries(text).forEach(([id, t]) => {
      const el = document.getElementById('topic-count-' + id);
      if (el) el.textContent = t;
    });
  },

  // Kopf einer Themen-Übersicht: große Überschrift mit einer Zeile darunter
  setTopicInfo(text) {
    const el = document.getElementById('topic-info');
    if (el) el.textContent = text || '';
  },

  config: {},
  _unsubs: {},
  _prevPage: null,

  // ── Start ─────────────────────────────────────────────────
  // config = {
  //   title:       Name der Seite (steht oben in der Mitte)
  //   collections: Sammlungen, die alle sehen dürfen, z.B. ['vokabel']
  //   drafts:      Sammlungen nur für Admins, z.B. ['vokabelDrafts']
  //   onData():    wird aufgerufen, wenn Daten da sind oder sich ändern (auch bei Login/Logout)
  //   onAdd():     was der Plus-Knopf für Admins auf dieser Seite macht (weglassen = kein Plus)
  //   adminOnly:   true = Seite nur für Admins (Meldungen)
  // }
  init(config) {
    this.config = config || {};
    this._buildFrame();
    this._bindKeys();
    this._initOrnament();

    const loader = document.getElementById('loading-screen');
    const hide   = () => { loader.style.display = 'none'; };
    const cols   = this.config.collections || [];
    let waiting  = cols.length;
    if (!waiting) hide(); else setTimeout(hide, 6000);

    cols.forEach(key => this._listen(key, () => { if (waiting > 0 && --waiting === 0) hide(); }));
    this._setTitle(this.config.title || '');
    this._initAuth();
    this.config.onData?.();
  },

  // Sammlung laden und bei jeder Änderung neu zeichnen
  _listen(key, onFirst) {
    if (this._unsubs[key]) this._unsubs[key]();
    let first = true;
    const done = () => { if (first) { first = false; onFirst?.(); } };
    this._unsubs[key] = COL[key].onSnapshot(snap => {
      state[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                            .sort((a, b) => (a.order || 0) - (b.order || 0));
      done();
      this.config.onData?.();
    }, err => { console.warn(key, err.message); done(); });
  },

  _stopListening(key) {
    if (this._unsubs[key]) { this._unsubs[key](); delete this._unsubs[key]; }
    state[key] = [];
  },

  // ── Kopfzeile, Fußzeile, gemeinsame Fenster ───────────────
  _buildFrame() {
    const top = document.createElement('div');
    top.innerHTML = `
<header class="topbar">
  <a class="logo" href="${this.url('index.html')}" title="Zur Startseite">Latein</a>
  <div class="topbar-center" id="topbar-center"></div>
  <div class="topbar-right">
    <button class="add-btn hidden" id="add-btn" onclick="App.add()" title="Neu hinzufügen">+</button>
    <a class="topbar-reports-btn hidden" id="bell-btn" href="${this.topicUrl('meldungen')}">Meldungen<span class="badge" id="bell-badge" style="display:none"></span></a>
    <button class="topbar-icon-btn hidden" id="admin-settings-btn" onclick="App.openAdminSettings()" title="Admin-Verwaltung">⚙️</button>
    <button class="topbar-icon-btn hidden" id="own-settings-btn" onclick="App.openOwnSettings()" title="Mein Konto">👤</button>
  </div>
</header>
<div id="loading-screen" class="loading-screen">
  <div class="loading-spinner"></div>
  <div class="loading-text">Wird geladen…</div>
</div>`;
    document.body.prepend(...top.children);

    const bottom = document.createElement('div');
    bottom.innerHTML = `
<!-- Login -->
<div class="modal-overlay hidden" id="login-overlay" onclick="App.closeLogin(event)">
  <div class="modal login-modal">
    <button class="modal-close" onclick="App.closeLogin()">✕</button>
    <div class="modal-title">Admin-Login</div>
    <div class="field-group">
      <label>Benutzername</label>
      <input type="text" id="admin-username" class="modal-input" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" />
    </div>
    <div class="field-group">
      <label>Passwort</label>
      <input type="password" id="admin-password" class="modal-input" placeholder="••••••••" autocomplete="current-password" />
    </div>
    <div class="login-error hidden" id="login-error"></div>
    <button class="start-btn" id="login-btn" onclick="App.login()">Einloggen</button>
  </div>
</div>

<!-- Admin-Verwaltung (nur Haupt-Admin) -->
<div class="modal-overlay hidden" id="admin-settings-overlay" onclick="App.closeAdminSettings(event)">
  <div class="modal admin-settings-modal">
    <button class="modal-close" onclick="App.closeAdminSettings()">✕</button>
    <div class="modal-title">Admin-Verwaltung</div>
    <div class="admin-section-label">Bestehende Admins</div>
    <div id="admin-list"></div>
    <div class="admin-section-label admin-section-label--gap">Neuen Admin hinzufügen</div>
    <div class="field-group">
      <label>Name</label>
      <input type="text" id="new-admin-name" class="modal-input" placeholder="z.B. Maria" />
    </div>
    <div class="field-group">
      <label>Benutzername</label>
      <input type="text" id="new-admin-user" class="modal-input" placeholder="z.B. maria" autocapitalize="off" autocorrect="off" spellcheck="false" />
    </div>
    <div class="field-group">
      <label>Passwort <span class="label-note">(mindestens 6 Zeichen)</span></label>
      <input type="password" id="new-admin-pass" class="modal-input" placeholder="••••••••" autocomplete="new-password" />
    </div>
    <div class="create-error hidden" id="new-admin-error"></div>
    <button class="start-btn btn--mt" id="new-admin-btn" onclick="App.saveNewAdmin()">Admin hinzufügen</button>
  </div>
</div>

<!-- Mein Konto -->
<div class="modal-overlay hidden" id="own-settings-overlay" onclick="App.closeOwnSettings(event)">
  <div class="modal modal--xs">
    <button class="modal-close" onclick="App.closeOwnSettings()">✕</button>
    <div class="modal-title">Mein Konto</div>
    <div class="field-group">
      <label>Benutzername</label>
      <input type="text" id="own-settings-username" class="modal-input" disabled />
    </div>
    <div class="field-group">
      <label>Anzeigename</label>
      <input type="text" id="own-settings-name" class="modal-input" placeholder="Name" />
    </div>
    <div class="field-group">
      <label>Neues Passwort <span class="label-note">(leer lassen = unverändert)</span></label>
      <input type="password" id="own-settings-new" class="modal-input" placeholder="••••••••" autocomplete="new-password" />
    </div>
    <div class="field-group">
      <label>Aktuelles Passwort <span class="label-note">(nur nötig, wenn du es änderst)</span></label>
      <input type="password" id="own-settings-old" class="modal-input" placeholder="••••••••" autocomplete="current-password" />
    </div>
    <div class="create-error hidden" id="own-settings-error"></div>
    <div class="report-success hidden" id="own-settings-success">✓ Gespeichert!</div>
    <div class="editor-actions editor-actions--sm">
      <button class="start-btn" onclick="App.saveOwnSettings()">Speichern</button>
      <button class="outline-btn" onclick="App.logout()">Ausloggen</button>
    </div>
  </div>
</div>

<!-- Fehler melden -->
<div class="modal-overlay hidden" id="report-overlay" onclick="Report.close(event)">
  <div class="modal report-modal">
    <button class="modal-close" onclick="Report.close()">✕</button>
    <div class="modal-title">Fehler melden</div>
    <div class="report-context-badge" id="report-context-display"></div>
    <div id="report-form-body">
      <div class="field-group">
        <label>Worum geht es?</label>
        <div class="report-categories" id="report-categories"></div>
        <div class="report-category-hint" id="report-category-hint"></div>
      </div>
      <div class="field-group">
        <label>Was ist falsch?</label>
        <textarea id="report-message" autocorrect="off" spellcheck="false" class="modal-input report-textarea" placeholder="Beschreibe den Fehler…"></textarea>
      </div>
      <div class="create-error hidden" id="report-error"></div>
      <button class="start-btn" id="report-send-btn" onclick="Report.send()">Melden</button>
    </div>
    <div class="report-success-screen hidden" id="report-success">
      <div class="report-success-icon">✓</div>
      <div class="report-success-text">Gesendet! Danke für deinen Hinweis.</div>
    </div>
  </div>
</div>

<div id="print-area"></div>

<footer class="site-footer">
  <a class="footer-link" href="${this.url('impressum/index.html')}">Impressum</a>
  <span class="footer-sep">·</span>
  <span class="footer-hint">Inhalte können fehlerhaft sein – bitte bei Fehlern melden.</span>
  <span class="footer-sep">·</span>
  <button class="footer-link footer-admin" id="footer-admin-btn" onclick="App.handleAdminBtn()">Admin</button>
</footer>`;
    document.body.append(...bottom.children);
  },

  // Easter Egg: das Mäanderband am Seitenrand bewegt sich beim Scrollen ganz leicht mit.
  // Gibt nur zwei Werte an das CSS weiter (--sy, --sp); die Bewegung selbst steht in style.css.
  _initOrnament() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    let queued = false;
    const update = () => {
      queued = false;
      const max = root.scrollHeight - innerHeight;
      root.style.setProperty('--sy', scrollY + 'px');
      root.style.setProperty('--sp', max > 0 ? (scrollY / max).toFixed(3) : '0');
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  },

  _setTitle(name) { document.getElementById('topbar-center').textContent = name || ''; },

  _bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (!document.getElementById('login-overlay').classList.contains('hidden')) this.login();
    });
  },

  // ── Ansichten innerhalb einer Themenseite ─────────────────
  // Jede Themenseite hat mehrere <main id="page-…" class="page">; sichtbar ist immer eine.
  // "page-home" ist die Übersicht des Themas.
  _activePage() { return document.querySelector('.page.active')?.id?.replace('page-', '') || null; },
  _onHome()     { return this._activePage() === 'home'; },

  showPage(id, name) {
    const current = this._activePage();
    if (current && current !== id) this._prevPage = current === 'home' ? null : current;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id)?.classList.add('active');
    window.scrollTo(0, 0);
    this._setTitle(name || this.config.title || '');
  },

  goBack() {
    if (this._prevPage && this._prevPage !== 'home') {
      const target   = this._prevPage;
      this._prevPage = null;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + target)?.classList.add('active');
      window.scrollTo(0, 0);
    } else if (this._onHome()) {
      location.href = this.url('index.html');       // von der Themen-Übersicht zurück zur Startseite
    } else {
      this.goHome();
    }
  },

  // Zur Übersicht des aktuellen Themas
  goHome() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    this._prevPage = null;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-home')?.classList.add('active');
    window.scrollTo(0, 0);
    this._setTitle(this.config.title || '');
    this.config.onData?.();
  },

  // Plus-Knopf: legt direkt das an, was zur Seite gehört
  add() { this.config.onAdd?.(); },

  // ── Admin-Anmeldung (Firebase Authentication) ─────────────
  // Admin ist, wer angemeldet ist UND ein Dokument admins/<uid> hat.
  // Dasselbe prüfen die Firestore-Regeln – die Anzeige hier ist nur Komfort.
  _initAuth() {
    auth.onAuthStateChanged(async user => {
      if (!user) { this._setAdmin(null); return; }
      try {
        const doc = await COL.admins.doc(user.uid).get();
        if (!doc.exists) {
          await auth.signOut();
          this._loginError('Dieses Konto ist nicht als Admin eingetragen.');
          return;
        }
        const d = doc.data();
        this._setAdmin({ uid: user.uid, name: d.name || '', username: d.username || '', isSuperAdmin: d.role === 'super' });
      } catch (e) {
        console.error('Admin-Prüfung:', e);
        this._setAdmin(null);
      }
    });
  },

  _setAdmin(admin) {
    const was = state.adminLoggedIn;
    state.adminLoggedIn = !!admin;
    state.currentAdmin  = admin;

    const show = (id, on) => document.getElementById(id)?.classList.toggle('hidden', !on);
    show('add-btn', !!admin && !!this.config.onAdd);
    show('bell-btn', !!admin);
    show('own-settings-btn', !!admin);
    show('admin-settings-btn', !!admin && admin.isSuperAdmin);
    document.getElementById('footer-admin-btn').textContent = admin ? 'Ausloggen' : 'Admin';

    // Alles mit data-admin (Bearbeiten-Knöpfe in den Ansichten) nur für Admins zeigen.
    // Wichtig bei Direktlinks: die Ansicht ist oft schon offen, bevor die Anmeldung erkannt ist.
    document.body.classList.toggle('is-admin', !!admin);
    document.querySelectorAll('[data-admin]').forEach(el => el.classList.toggle('hidden', !admin));

    // Entwürfe gibt es nur für Admins
    (this.config.drafts || []).forEach(key => admin ? this._listen(key) : this._stopListening(key));

    if (admin) {
      document.getElementById('login-overlay').classList.add('hidden');
      this.updateBellBadge();
    }
    if (was !== state.adminLoggedIn || this.config.adminOnly) this.config.onData?.();
  },

  _email(username) {
    const u = username.trim().toLowerCase();
    return u.includes('@') ? u : u + '@' + ADMIN_DOMAIN;
  },

  handleAdminBtn() { state.adminLoggedIn ? this.logout() : this.openLogin(); },

  openLogin() {
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-username').focus(), 80);
  },

  closeLogin(e) {
    if (e && e.target !== document.getElementById('login-overlay')) return;
    document.getElementById('login-overlay').classList.add('hidden');
  },

  _loginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg; el.classList.remove('hidden');
  },

  async login() {
    const u = document.getElementById('admin-username').value.trim();
    const p = document.getElementById('admin-password').value;
    if (!u || !p) { this._loginError('Bitte Benutzername und Passwort eingeben.'); return; }
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = '…';
    try {
      await auth.signInWithEmailAndPassword(this._email(u), p);
      document.getElementById('admin-password').value = '';
    } catch (e) {
      const notSetUp = ['auth/operation-not-allowed', 'auth/configuration-not-found', 'auth/admin-restricted-operation'];
      if (notSetUp.includes(e.code))                 this._loginError('Der Login ist in Firebase noch nicht eingerichtet (siehe SICHERHEIT.md).');
      else if (e.code === 'auth/too-many-requests')  this._loginError('Zu viele Versuche. Bitte warte kurz.');
      else if (e.code === 'auth/network-request-failed') this._loginError('Keine Verbindung. Bitte später nochmal versuchen.');
      else                                           this._loginError('Falscher Benutzername oder Passwort.');
    } finally { btn.disabled = false; btn.textContent = 'Einloggen'; }
  },

  async logout() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    await auth.signOut();
  },

  // Zahl der ungelesenen Meldungen am Knopf „Meldungen"
  async updateBellBadge() {
    if (!state.adminLoggedIn) return;
    try {
      const snap  = await COL.reports.where('read', '==', false).get();
      const badge = document.getElementById('bell-badge');
      badge.textContent   = snap.size;
      badge.style.display = snap.size > 0 ? 'block' : 'none';
    } catch (e) { console.error('updateBellBadge:', e); }
  },

  // ── Mein Konto ────────────────────────────────────────────
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
    const admin = state.currentAdmin, user = auth.currentUser;
    if (!admin || !user) return;
    const name    = document.getElementById('own-settings-name').value.trim();
    const oldPass = document.getElementById('own-settings-old').value;
    const newPass = document.getElementById('own-settings-new').value;
    const err     = document.getElementById('own-settings-error');
    const fail    = msg => { err.textContent = msg; err.classList.remove('hidden'); };
    err.classList.add('hidden');

    if (newPass && newPass.length < 6) return fail('Das neue Passwort braucht mindestens 6 Zeichen.');
    if (newPass && !oldPass)           return fail('Bitte gib dein aktuelles Passwort ein.');

    try {
      if (newPass) {
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, oldPass);
        await user.reauthenticateWithCredential(cred);
        await user.updatePassword(newPass);
      }
      if (name && name !== admin.name) {
        await COL.admins.doc(admin.uid).update({ name });
        admin.name = name;
      }
      document.getElementById('own-settings-success').classList.remove('hidden');
      setTimeout(() => document.getElementById('own-settings-overlay').classList.add('hidden'), 1200);
    } catch (e) {
      fail(['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(e.code)
        ? 'Das aktuelle Passwort stimmt nicht.' : 'Fehler: ' + e.message);
    }
  },

  // ── Admin-Verwaltung (nur Haupt-Admin) ────────────────────
  openAdminSettings() {
    document.getElementById('new-admin-error').classList.add('hidden');
    document.getElementById('admin-settings-overlay').classList.remove('hidden');
    this.loadAdminList();
  },

  closeAdminSettings(e) {
    if (e && e.target !== document.getElementById('admin-settings-overlay')) return;
    document.getElementById('admin-settings-overlay').classList.add('hidden');
  },

  async loadAdminList() {
    const list = document.getElementById('admin-list');
    try {
      const snap = await COL.admins.get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.role === 'super' || d.role === 'admin')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
      list.innerHTML = docs.map(d => `
        <div class="admin-list-row">
          <div class="admin-list-info">
            <span class="admin-list-name">${escHtml(d.name || d.username)}</span>
            <span class="admin-list-user">@${escHtml(d.username || '')}${d.role === 'super' ? ' · Haupt-Admin' : ''}</span>
          </div>
          <div class="admin-list-actions">
            ${d.role === 'super' ? '' : `<button class="btn-danger-text" onclick="App.deleteAdmin('${d.id}')">Entfernen</button>`}
          </div>
        </div>`).join('') || '<div class="admin-list-empty">Keine Admins gefunden.</div>';
    } catch (e) { list.innerHTML = `<div class="admin-list-empty">Fehler: ${escHtml(e.message)}</div>`; }
  },

  // Neues Admin-Konto anlegen. Das Konto entsteht über eine zweite, getrennte
  // Firebase-Verbindung – so bleibt der Haupt-Admin selbst angemeldet.
  async saveNewAdmin() {
    const name = document.getElementById('new-admin-name').value.trim();
    const user = document.getElementById('new-admin-user').value.trim().toLowerCase();
    const pass = document.getElementById('new-admin-pass').value;
    const err  = document.getElementById('new-admin-error');
    const fail = msg => { err.textContent = msg; err.classList.remove('hidden'); };
    err.classList.add('hidden');
    if (!name || !user || !pass)          return fail('Bitte alle Felder ausfüllen.');
    if (!/^[a-z0-9._-]+$/.test(user))     return fail('Benutzername: nur Kleinbuchstaben, Ziffern, Punkt, Strich.');
    if (pass.length < 6)                  return fail('Das Passwort braucht mindestens 6 Zeichen.');

    const btn = document.getElementById('new-admin-btn');
    btn.disabled = true; btn.textContent = '…';
    let second = null;
    try {
      second = firebase.initializeApp(firebaseConfig, 'admin-anlegen-' + Date.now());
      const cred = await second.auth().createUserWithEmailAndPassword(this._email(user), pass);
      await COL.admins.doc(cred.user.uid).set({ name, username: user, role: 'admin', createdAt: Date.now() });
      await second.auth().signOut();
      ['new-admin-name', 'new-admin-user', 'new-admin-pass'].forEach(id => { document.getElementById(id).value = ''; });
      this.loadAdminList();
    } catch (e) {
      fail(e.code === 'auth/email-already-in-use' ? 'Diesen Benutzernamen gibt es schon.' : 'Fehler: ' + e.message);
    } finally {
      if (second) second.delete().catch(() => {});
      btn.disabled = false; btn.textContent = 'Admin hinzufügen';
    }
  },

  // Admin-Rechte entziehen (das Firebase-Konto selbst bleibt bestehen, kann aber nichts mehr)
  async deleteAdmin(uid) {
    if (!confirm('Diesem Konto die Admin-Rechte entziehen?')) return;
    try { await COL.admins.doc(uid).delete(); this.loadAdminList(); }
    catch (e) { alert('Fehler: ' + e.message); }
  }
};
