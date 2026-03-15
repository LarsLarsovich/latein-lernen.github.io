'use strict';

// ── Firebase init (compat SDK – no import/module needed) ─────
const firebaseConfig = {
  apiKey:            "AIzaSyDfIOQMo95TufbHY_f1EXHKhgP8FCu2PR4",
  authDomain:        "latein-lernen.firebaseapp.com",
  projectId:         "latein-lernen",
  storageBucket:     "latein-lernen.firebasestorage.app",
  messagingSenderId: "976723559385",
  appId:             "1:976723559385:web:efcf9b5176fa84676c8fc8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── Constants ────────────────────────────────────────────────
const ADMIN_USER   = 'admin';
const ADMIN_PASS   = 'latina2024';
const DRAFT_KEY    = 'latein_drafts';
const CASES        = [1, 2, 3, 4, 6];
const CASE_NAMES   = { 1:'Nominativ', 2:'Genitiv', 3:'Dativ', 4:'Akkusativ', 6:'Ablativ' };
const GENDERS      = ['M', 'W', 'N'];
const GENDER_NAMES = { M:'Maskulinum (m.)', W:'Femininum (f.)', N:'Neutrum (n.)' };
const GENDER_SHORT = { M:'m.', W:'f.', N:'n.' };
const GENDER_LABEL = { M:'Maskulinum', W:'Femininum', N:'Neutrum' };
const GENDER_CLASS = { M:'m', W:'f', N:'n' };

// ── Built-in quizes as drafts on first load ──────────────────
const BUILTIN_DRAFTS = [
  {
    id: 'draft_idem', name: 'idem / eadem / idem', desc: 'Pronomen „derselbe / dieselbe / dasselbe"',
    sg: {
      M: {1:'idem',    2:'eiusdem', 3:'eidem',  4:'eundem', 6:'eodem' },
      W: {1:'eadem',   2:'eiusdem', 3:'eidem',  4:'eandem', 6:'eadem' },
      N: {1:'idem',    2:'eiusdem', 3:'eidem',  4:'idem',   6:'eodem' }
    },
    pl: {
      M: {1:'iidem',   2:'eorundem', 3:'iisdem', 4:'eosdem', 6:'iisdem'},
      W: {1:'eaedem',  2:'eorundem', 3:'iisdem', 4:'easdem', 6:'iisdem'},
      N: {1:'eadem',   2:'eorundem', 3:'iisdem', 4:'eadem',  6:'iisdem'}
    },
    de_sg: {
      M: {1:'derselbe',  2:'desselben', 3:'demselben', 4:'denselben', 6:'demselben'},
      W: {1:'dieselbe',  2:'derselben', 3:'derselben', 4:'dieselbe',  6:'derselben'},
      N: {1:'dasselbe',  2:'desselben', 3:'demselben', 4:'dasselbe',  6:'demselben'}
    },
    de_pl: {
      M: {1:'dieselben', 2:'derselben', 3:'denselben', 4:'dieselben', 6:'denselben'},
      W: {1:'dieselben', 2:'derselben', 3:'denselben', 4:'dieselben', 6:'denselben'},
      N: {1:'dieselben', 2:'derselben', 3:'denselben', 4:'dieselben', 6:'denselben'}
    }
  }
];

// ── Helpers ──────────────────────────────────────────────────
function parseAnswers(raw) {
  return (raw || '').toLowerCase().split(/[\/,]/).map(s => s.trim()).filter(Boolean);
}
function isCorrect(input, raw) {
  return parseAnswers(raw).includes(input.trim().toLowerCase());
}
function loadDrafts() {
  try {
    const r = localStorage.getItem(DRAFT_KEY);
    return r ? JSON.parse(r) : null;
  } catch(e) { return null; }
}
function saveDraftsToStorage(drafts) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

// ── State ────────────────────────────────────────────────────
let state = {
  published: [],          // from Firestore
  drafts: [],             // from localStorage
  adminLoggedIn: false,
  currentQuiz: null,
  selectedPhases: [],
  shuffleWithin: false,
  lastQuizId: null,
  lastQuizSource: null,   // 'published' | 'draft'
  editingId: null,
  editingSource: null,    // 'published' | 'draft' | null (new)
  cardActionId: null,
  cardActionSource: null
};

// ── App ──────────────────────────────────────────────────────
const App = {

  async init() {
    this.buildEditorGrids();

    // Load drafts from localStorage
    const stored = loadDrafts();
    if (stored === null) {
      // First time: seed builtin drafts
      state.drafts = BUILTIN_DRAFTS;
      saveDraftsToStorage(state.drafts);
    } else {
      state.drafts = stored;
      // Merge builtin drafts if not already present
      BUILTIN_DRAFTS.forEach(bd => {
        if (!state.drafts.find(d => d.id === bd.id)) {
          state.drafts.unshift(bd);
        }
      });
      saveDraftsToStorage(state.drafts);
    }

    // Load published from Firestore
    const loading = document.getElementById('loading-screen');
    loading.style.display = 'flex';

    try {
      const snap = await db.collection('quizes').orderBy('order').get();
      state.published = [];
      snap.forEach(d => state.published.push({ id: d.id, ...d.data() }));
    } catch(e) {
      console.warn('Firestore Fehler (möglicherweise leer):', e.message);
      state.published = [];
    }

    loading.style.display = 'none';
    this.renderHome();
    this.showPage('home');

    // Live updates for published quizes
    db.collection('quizes').orderBy('order').onSnapshot(snap => {
      state.published = [];
      snap.forEach(d => state.published.push({ id: d.id, ...d.data() }));
      if (document.getElementById('page-home').classList.contains('active')) {
        this.renderHome();
      }
    }, err => console.warn('Snapshot error:', err.message));
  },

  showPage(id, quizName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + id);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('topbar-center').textContent = quizName || '';
  },

  goHome() {
    this.closeCardAction();
    this.closeDraftAction();
    this.renderHome();
    this.showPage('home');
  },

  renderHome() {
    const isAdmin = state.adminLoggedIn;

    // Draft section visibility
    const draftSection = document.getElementById('draft-section');
    draftSection.classList.toggle('hidden', !isAdmin);

    // Render drafts
    if (isAdmin) {
      const draftGrid  = document.getElementById('draft-grid');
      const draftEmpty = document.getElementById('draft-empty');
      draftGrid.innerHTML = '';
      if (!state.drafts.length) {
        draftEmpty.style.display = 'block';
      } else {
        draftEmpty.style.display = 'none';
        state.drafts.forEach(q => {
          const card = document.createElement('div');
          card.className = 'quiz-card admin-mode draft-card';
          card.innerHTML = `
            <div class="draft-pill">Entwurf</div>
            <div class="quiz-card-name">${q.name}</div>
            <div class="quiz-card-desc">${q.desc || ''}</div>
            <div class="card-admin-overlay">
              <button class="card-overlay-btn card-overlay-edit" data-id="${q.id}">Bearbeiten</button>
              <button class="card-overlay-btn card-overlay-pub"  data-id="${q.id}">Veröffentlichen</button>
              <button class="card-overlay-btn card-overlay-del"  data-id="${q.id}">Löschen</button>
            </div>
          `;
          card.querySelector('.card-overlay-edit').addEventListener('click', e => {
            e.stopPropagation(); App.openEditor(q.id, 'draft');
          });
          card.querySelector('.card-overlay-pub').addEventListener('click', e => {
            e.stopPropagation(); App.publishDraft(q.id);
          });
          card.querySelector('.card-overlay-del').addEventListener('click', e => {
            e.stopPropagation(); App.deleteDraft(q.id);
          });
          card.addEventListener('click', () => App.openSetup(q.id, 'draft'));
          draftGrid.appendChild(card);
        });
      }
    }

    // Render published
    const grid  = document.getElementById('quiz-grid');
    const empty = document.getElementById('empty-hint');
    grid.innerHTML = '';
    if (!state.published.length) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      state.published.forEach(q => {
        const card = document.createElement('div');
        card.className = 'quiz-card' + (isAdmin ? ' admin-mode' : '');
        const overlayHTML = isAdmin ? `
          <div class="card-admin-overlay">
            <button class="card-overlay-btn card-overlay-edit" data-id="${q.id}">Bearbeiten</button>
            <button class="card-overlay-btn card-overlay-del"  data-id="${q.id}">Löschen</button>
          </div>` : '';
        card.innerHTML = `
          <div class="quiz-card-name">${q.name}</div>
          <div class="quiz-card-desc">${q.desc || ''}</div>
          ${overlayHTML}
        `;
        if (isAdmin) {
          card.querySelector('.card-overlay-edit').addEventListener('click', e => {
            e.stopPropagation(); App.openEditor(q.id, 'published');
          });
          card.querySelector('.card-overlay-del').addEventListener('click', e => {
            e.stopPropagation(); App.confirmDelete(q.id, 'published');
          });
        }
        card.addEventListener('click', () => {
          if (!isAdmin) App.openSetup(q.id, 'published');
        });
        grid.appendChild(card);
      });
    }
  },

  // ── Quiz Flow ─────────────────────────────────────────────
  openSetup(id, source) {
    const q = source === 'draft'
      ? state.drafts.find(x => x.id === id)
      : state.published.find(x => x.id === id);
    if (!q) return;
    state.currentQuiz    = q;
    state.lastQuizId     = id;
    state.lastQuizSource = source;
    document.getElementById('setup-title').textContent = q.name;
    document.getElementById('setup-desc').textContent  = q.desc || '';
    document.querySelectorAll('input[name="phase"]').forEach(cb => { cb.checked = cb.value === '1'; });
    document.getElementById('shuffle-within').checked = false;
    this.showPage('setup', q.name);
  },

  startQuiz() {
    const checked = [...document.querySelectorAll('input[name="phase"]:checked')];
    if (!checked.length) { alert('Bitte wähle mindestens eine Phase aus.'); return; }
    state.selectedPhases = checked.map(c => parseInt(c.value));
    state.shuffleWithin  = document.getElementById('shuffle-within').checked;
    Quiz.start(state.currentQuiz, state.selectedPhases, state.shuffleWithin);
  },

  replaySetup() {
    if (state.lastQuizId) this.openSetup(state.lastQuizId, state.lastQuizSource);
    else this.goHome();
  },

  // ── Admin ─────────────────────────────────────────────────
  handleAdminBtn() {
    if (state.adminLoggedIn) {
      state.adminLoggedIn = false;
      const btn = document.getElementById('admin-topbtn');
      btn.classList.remove('active');
      btn.textContent = 'Admin';
      document.getElementById('add-btn').classList.add('hidden');
      this.renderHome();
    } else {
      this.openLogin();
    }
  },

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

  closeLoginForced() {
    document.getElementById('login-overlay').classList.add('hidden');
  },

  adminLogin() {
    const u = document.getElementById('admin-username').value.trim();
    const p = document.getElementById('admin-password').value;
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      state.adminLoggedIn = true;
      document.getElementById('login-overlay').classList.add('hidden');
      const btn = document.getElementById('admin-topbtn');
      btn.classList.add('active');
      btn.textContent = 'Ausloggen';
      document.getElementById('add-btn').classList.remove('hidden');
      this.renderHome();
    } else {
      document.getElementById('login-error').classList.remove('hidden');
    }
  },

  // ── Card action modals ────────────────────────────────────
  confirmDelete(id, source) {
    const q = source === 'draft'
      ? state.drafts.find(x => x.id === id)
      : state.published.find(x => x.id === id);
    if (!q) return;
    state.cardActionId     = id;
    state.cardActionSource = source;
    document.getElementById('card-action-title').textContent = q.name;
    document.getElementById('card-action-desc').textContent  = q.desc || '';
    document.getElementById('card-action-overlay').classList.remove('hidden');
  },

  closeCardAction(e) {
    if (e && e.target !== document.getElementById('card-action-overlay')) return;
    document.getElementById('card-action-overlay').classList.add('hidden');
  },

  editFromModal() {
    const id = state.cardActionId, src = state.cardActionSource;
    document.getElementById('card-action-overlay').classList.add('hidden');
    this.openEditor(id, src);
  },

  async deleteFromModal() {
    const id = state.cardActionId, src = state.cardActionSource;
    document.getElementById('card-action-overlay').classList.add('hidden');
    if (src === 'published') {
      try {
        await db.collection('quizes').doc(id).delete();
        state.published = state.published.filter(q => q.id !== id);
      } catch(e) { alert('Fehler beim Löschen.'); return; }
    } else {
      state.drafts = state.drafts.filter(q => q.id !== id);
      saveDraftsToStorage(state.drafts);
    }
    this.renderHome();
  },

  closeDraftAction(e) {
    if (e && e.target !== document.getElementById('draft-action-overlay')) return;
    document.getElementById('draft-action-overlay').classList.add('hidden');
  },

  publishDraftFromModal() {
    const id = state.cardActionId;
    document.getElementById('draft-action-overlay').classList.add('hidden');
    this.publishDraft(id);
  },

  editDraftFromModal() {
    const id = state.cardActionId;
    document.getElementById('draft-action-overlay').classList.add('hidden');
    this.openEditor(id, 'draft');
  },

  deleteDraftFromModal() {
    const id = state.cardActionId;
    document.getElementById('draft-action-overlay').classList.add('hidden');
    this.deleteDraft(id);
  },

  // ── Draft operations ──────────────────────────────────────
  deleteDraft(id) {
    if (!confirm('Entwurf löschen?')) return;
    state.drafts = state.drafts.filter(q => q.id !== id);
    saveDraftsToStorage(state.drafts);
    this.renderHome();
  },

  async publishDraft(id) {
    const draft = state.drafts.find(q => q.id === id);
    if (!draft) return;

    const btn = event && event.target;
    if (btn) { btn.textContent = '…'; btn.disabled = true; }

    const published = {
      ...draft,
      id: 'pub_' + Date.now(),
      order: Date.now()
    };

    try {
      await db.collection('quizes').doc(published.id).set(published);
      state.published.push(published);
      state.drafts = state.drafts.filter(q => q.id !== id);
      saveDraftsToStorage(state.drafts);
      this.renderHome();
    } catch(e) {
      alert('Fehler beim Veröffentlichen: ' + e.message);
      if (btn) { btn.textContent = 'Veröffentlichen'; btn.disabled = false; }
    }
  },

  // ── Editor ───────────────────────────────────────────────
  buildEditorGrids() {
    ['sg-columns','pl-columns','de-sg-columns','de-pl-columns'].forEach(sec => {
      const wrap = document.getElementById(sec);
      if (!wrap) return;
      wrap.innerHTML = '';
      GENDERS.forEach(g => {
        const col = document.createElement('div');
        col.className = 'genus-col';
        col.innerHTML = `<div class="genus-col-header ${GENDER_CLASS[g]}">${GENDER_LABEL[g]}</div>`;
        CASES.forEach(c => {
          const field = document.createElement('div');
          field.className = 'genus-field';
          field.innerHTML = `
            <label>${CASE_NAMES[c]}</label>
            <input type="text" id="${sec}_${g}_${c}" placeholder="${CASE_NAMES[c].substring(0,3).toLowerCase()}." />
          `;
          col.appendChild(field);
        });
        wrap.appendChild(col);
      });
    });
  },

  openEditor(id, source) {
    state.editingId     = id;
    state.editingSource = source || null;
    const isNew = !id;
    document.getElementById('editor-page-title').textContent = isNew ? 'Neues Quiz' : 'Quiz bearbeiten';
    document.getElementById('create-error').classList.add('hidden');

    if (isNew) {
      document.getElementById('new-quiz-name').value = '';
      document.getElementById('new-quiz-desc').value = '';
      ['sg-columns','pl-columns','de-sg-columns','de-pl-columns'].forEach(sec => {
        GENDERS.forEach(g => CASES.forEach(c => {
          const el = document.getElementById(`${sec}_${g}_${c}`);
          if (el) el.value = '';
        }));
      });
    } else {
      const q = source === 'draft'
        ? state.drafts.find(x => x.id === id)
        : state.published.find(x => x.id === id);
      if (!q) return;
      document.getElementById('new-quiz-name').value = q.name;
      document.getElementById('new-quiz-desc').value = q.desc || '';
      const map = { 'sg-columns': q.sg, 'pl-columns': q.pl, 'de-sg-columns': q.de_sg, 'de-pl-columns': q.de_pl };
      Object.entries(map).forEach(([sec, data]) => {
        GENDERS.forEach(g => CASES.forEach(c => {
          const el = document.getElementById(`${sec}_${g}_${c}`);
          if (el) el.value = (data[g] && data[g][c]) ? data[g][c] : '';
        }));
      });
    }
    this.showPage('editor', isNew ? 'Neues Quiz' : 'Bearbeiten');
  },

  _readEditorData() {
    const name  = document.getElementById('new-quiz-name').value.trim();
    const desc  = document.getElementById('new-quiz-desc').value.trim();
    const readSection = (prefix) => {
      const result = {};
      GENDERS.forEach(g => {
        result[g] = {};
        CASES.forEach(c => { result[g][c] = document.getElementById(`${prefix}_${g}_${c}`)?.value.trim() || ''; });
      });
      return result;
    };
    return { name, desc,
      sg:    readSection('sg-columns'),
      pl:    readSection('pl-columns'),
      de_sg: readSection('de-sg-columns'),
      de_pl: readSection('de-pl-columns')
    };
  },

  _validateEditor(data) {
    const errEl = document.getElementById('create-error');
    if (!data.name) { errEl.textContent = 'Bitte gib einen Quiz-Namen ein.'; errEl.classList.remove('hidden'); return false; }
    let allFilled = true;
    [data.sg, data.pl, data.de_sg, data.de_pl].forEach(obj => {
      GENDERS.forEach(g => CASES.forEach(c => { if (!obj[g][c]) allFilled = false; }));
    });
    if (!allFilled) { errEl.textContent = 'Bitte fülle alle Felder aus.'; errEl.classList.remove('hidden'); return false; }
    return true;
  },

  saveDraft() {
    const data = this._readEditorData();
    // Drafts können unvollständig sein – nur Name ist Pflicht
    if (!data.name) {
      const errEl = document.getElementById('create-error');
      errEl.textContent = 'Bitte gib einen Quiz-Namen ein.';
      errEl.classList.remove('hidden'); return;
    }
    document.getElementById('create-error').classList.add('hidden');

    if (state.editingSource === 'draft' && state.editingId) {
      // Update existing draft
      const idx = state.drafts.findIndex(q => q.id === state.editingId);
      if (idx !== -1) state.drafts[idx] = { ...state.drafts[idx], ...data };
    } else if (state.editingSource === 'published' && state.editingId) {
      // Save edited published quiz as new draft, keep original
      state.drafts.push({ id: 'draft_' + Date.now(), ...data });
    } else {
      // New draft
      state.drafts.push({ id: 'draft_' + Date.now(), ...data });
    }
    saveDraftsToStorage(state.drafts);
    this.goHome();
  },

  async publishQuiz() {
    const data = this._readEditorData();
    if (!this._validateEditor(data)) return;

    const btn = document.getElementById('publish-btn');
    btn.textContent = 'Veröffentlicht…'; btn.disabled = true;

    const isEditingPublished = state.editingSource === 'published' && state.editingId;
    const docId = isEditingPublished ? state.editingId : 'pub_' + Date.now();
    const quiz = { id: docId, order: isEditingPublished
      ? (state.published.find(q => q.id === state.editingId)?.order || Date.now())
      : Date.now(), ...data };

    try {
      await db.collection('quizes').doc(docId).set(quiz);
      if (isEditingPublished) {
        const idx = state.published.findIndex(q => q.id === state.editingId);
        if (idx !== -1) state.published[idx] = quiz;
      } else {
        state.published.push(quiz);
        // If we were editing a draft, remove it
        if (state.editingSource === 'draft' && state.editingId) {
          state.drafts = state.drafts.filter(q => q.id !== state.editingId);
          saveDraftsToStorage(state.drafts);
        }
      }
      this.goHome();
    } catch(e) {
      const errEl = document.getElementById('create-error');
      errEl.textContent = 'Firebase-Fehler: ' + e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.textContent = 'Veröffentlichen'; btn.disabled = false;
    }
  }
};

// ── Quiz Engine ──────────────────────────────────────────────
const Quiz = {
  questions: [], idx: 0, score: 0, answered: false,

  start(quiz, phases, shuffle) {
    this.questions = this.build(quiz, phases, shuffle);
    this.idx = 0; this.score = 0; this.answered = false;
    App.showPage('quiz', quiz.name);
    this.render();
  },

  build(q, phases, shuffle) {
    let qs = [];

    if (phases.includes(1)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => p.push({
        phase:1, meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
        main:'Lateinische Form?', placeholder:'Latein eingeben…',
        answer: q.sg[g][c]||'', answerDisplay: q.sg[g][c]||''
      })));
      qs = [...qs, ...(shuffle ? p.sort(() => Math.random()-.5) : p)];
    }
    if (phases.includes(2)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => p.push({
        phase:2, meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
        main:'Lateinische Form?', placeholder:'Latein eingeben…',
        answer: q.pl[g][c]||'', answerDisplay: q.pl[g][c]||''
      })));
      qs = [...qs, ...(shuffle ? p.sort(() => Math.random()-.5) : p)];
    }
    if (phases.includes(3)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => {
        const isSg = Math.random() > .5;
        const form = isSg ? q.sg[g][c] : q.pl[g][c];
        p.push({ phase:3, meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  ${isSg?'Singular':'Plural'}`,
          main:'Lateinische Form?', placeholder:'Latein eingeben…',
          answer: form||'', answerDisplay: form||'' });
      }));
      qs = [...qs, ...p.sort(() => Math.random()-.5)];
    }
    if (phases.includes(4)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => {
        p.push({ phase:4, meta:`Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
          main: q.de_sg[g][c]||'?', placeholder:'Latein eingeben…',
          answer: q.sg[g][c]||'', answerDisplay: q.sg[g][c]||'' });
        p.push({ phase:4, meta:`Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
          main: q.de_pl[g][c]||'?', placeholder:'Latein eingeben…',
          answer: q.pl[g][c]||'', answerDisplay: q.pl[g][c]||'' });
      }));
      p = p.sort(() => Math.random()-.5);
      qs = [...qs, ...(shuffle ? p : p.slice(0,20))];
    }
    if (phases.includes(5)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => {
        p.push({ phase:5, meta:`Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
          main: q.sg[g][c]||'?', placeholder:'Deutsch eingeben…',
          answer: q.de_sg[g][c]||'', answerDisplay: q.de_sg[g][c]||'' });
        p.push({ phase:5, meta:`Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
          main: q.pl[g][c]||'?', placeholder:'Deutsch eingeben…',
          answer: q.de_pl[g][c]||'', answerDisplay: q.de_pl[g][c]||'' });
      }));
      p = p.sort(() => Math.random()-.5);
      qs = [...qs, ...(shuffle ? p : p.slice(0,20))];
    }
    return qs;
  },

  render() {
    const q = this.questions[this.idx], total = this.questions.length;
    const labels = {1:'Phase 1 – Singular',2:'Phase 2 – Plural',3:'Phase 3 – Gemischt',4:'Phase 4 – Deutsch → Latein',5:'Phase 5 – Latein → Deutsch'};
    document.getElementById('quiz-phase-badge').textContent   = labels[q.phase]||'';
    document.getElementById('quiz-progress-text').textContent = `${this.idx+1} / ${total}`;
    document.getElementById('progress-bar').style.width       = (this.idx/total*100)+'%';
    document.getElementById('q-meta').textContent             = q.meta;
    document.getElementById('q-main').textContent             = q.main;
    const input = document.getElementById('answer-input');
    input.placeholder = q.placeholder||''; input.value=''; input.disabled=false; input.focus();
    document.getElementById('feedback-box').className='feedback-box hidden';
    document.getElementById('next-btn').classList.add('hidden');
    this.answered = false;
  },

  check() {
    if (this.answered) return;
    const input = document.getElementById('answer-input');
    const val = input.value.trim(); if (!val) return;
    this.answered = true; input.disabled = true;
    const q = this.questions[this.idx], fb = document.getElementById('feedback-box');
    if (isCorrect(val, q.answer)) {
      this.score++;
      fb.textContent='✓ Richtig!'; fb.className='feedback-box correct';
    } else {
      const acc = parseAnswers(q.answer);
      fb.textContent=`✗ Falsch. Richtig: ${acc.length>1?acc.join(' / '):q.answerDisplay}`;
      fb.className='feedback-box wrong';
    }
    document.getElementById('progress-bar').style.width=((this.idx+1)/this.questions.length*100)+'%';
    document.getElementById('next-btn').classList.remove('hidden');
  },

  next() {
    this.idx++;
    if (this.idx >= this.questions.length) this.showResult(); else this.render();
  },

  showResult() {
    const total=this.questions.length, pct=Math.round(this.score/total*100);
    document.getElementById('result-score').textContent=`${this.score}/${total}`;
    let msg,icon;
    if(pct===100){msg='Perfekt! Absolut fehlerfrei.';icon='🏆';}
    else if(pct>=80){msg='Sehr gut! Fast alles richtig.';icon='🏛️';}
    else if(pct>=60){msg='Gut! Noch etwas üben.';icon='📜';}
    else if(pct>=40){msg='Es geht. Mehr Übung hilft!';icon='⚡';}
    else{msg='Weiter üben – du schaffst das!';icon='🌿';}
    document.getElementById('result-icon').textContent=icon;
    document.getElementById('result-msg').textContent=msg;
    App.showPage('result');
  }
};

// ── Keyboard shortcuts ───────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('page-quiz').classList.contains('active')) {
    if (!Quiz.answered) Quiz.check(); else Quiz.next(); return;
  }
  if (!document.getElementById('login-overlay').classList.contains('hidden')) App.adminLogin();
});

App.init();
