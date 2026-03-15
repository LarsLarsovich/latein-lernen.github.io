'use strict';

const ADMIN_USER  = 'admin';
const ADMIN_PASS  = 'latina2024';
const STORAGE_KEY = 'latina_quizes';

const CASES       = [1, 2, 3, 4, 6];
const CASE_NAMES  = { 1:'Nominativ', 2:'Genitiv', 3:'Dativ', 4:'Akkusativ', 6:'Ablativ' };
const GENDERS     = ['M', 'W', 'N'];
const GENDER_NAMES  = { M:'Maskulinum (m.)', W:'Femininum (f.)', N:'Neutrum (n.)' };
const GENDER_SHORT  = { M:'m.', W:'f.', N:'n.' };
const GENDER_LABEL  = { M:'Maskulinum', W:'Femininum', N:'Neutrum' };
const GENDER_CLASS  = { M:'m', W:'f', N:'n' };

// Parse "iis/eis" or "iis, eis" into multiple accepted answers
function parseAnswers(raw) {
  return raw.toLowerCase()
    .split(/[\/,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function isCorrect(input, raw) {
  const accepted = parseAnswers(raw);
  return accepted.includes(input.trim().toLowerCase());
}

const DEFAULT_QUIZ = {
  id: 'idem', name: 'idem / eadem / idem', desc: 'Pronomen „derselbe / dieselbe / dasselbe"',
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
};

let state = {
  quizes: [],
  adminLoggedIn: false,
  currentQuiz: null,
  selectedPhases: [],
  shuffleWithin: false,
  lastQuizId: null,
  editingQuizId: null,
  cardActionQuizId: null
};

function saveQuizes() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.quizes)); }
function loadQuizes() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) state.quizes = JSON.parse(r); } catch(e) { state.quizes = []; }
  if (!state.quizes.find(q => q.id === 'idem')) { state.quizes.unshift(DEFAULT_QUIZ); saveQuizes(); }
}

// ── App ──────────────────────────────────────────────────────
const App = {
  init() {
    loadQuizes();
    this.buildEditorGrids();
    this.renderHome();
  },

  showPage(id, quizName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + id);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
    // topbar center: show quiz name during quiz, empty otherwise
    const center = document.getElementById('topbar-center');
    center.textContent = quizName || '';
  },

  goHome() {
    this.closeCardAction();
    this.renderHome();
    this.showPage('home');
  },

  renderHome() {
    const grid  = document.getElementById('quiz-grid');
    const empty = document.getElementById('empty-hint');
    grid.innerHTML = '';
    if (!state.quizes.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    state.quizes.forEach(q => {
      const card = document.createElement('div');
      card.className = 'quiz-card' + (state.adminLoggedIn ? ' admin-mode' : '');

      const overlayHTML = state.adminLoggedIn ? `
        <div class="card-admin-overlay">
          <button class="card-overlay-btn card-overlay-edit" onclick="event.stopPropagation();App.openEditor('${q.id}')">Bearbeiten</button>
          <button class="card-overlay-btn card-overlay-del" onclick="event.stopPropagation();App.confirmDelete('${q.id}')">Löschen</button>
        </div>` : '';

      card.innerHTML = `
        <div class="quiz-card-name">${q.name}</div>
        <div class="quiz-card-desc">${q.desc || ''}</div>
        ${overlayHTML}
      `;

      card.addEventListener('click', () => {
        if (!state.adminLoggedIn) App.openSetup(q.id);
      });
      grid.appendChild(card);
    });
  },

  // ── Quiz Flow ─────────────────────────────────────────────
  openSetup(quizId) {
    const q = state.quizes.find(x => x.id === quizId);
    if (!q) return;
    state.currentQuiz = q;
    state.lastQuizId = quizId;
    document.getElementById('setup-title').textContent = q.name;
    document.getElementById('setup-desc').textContent = q.desc || '';
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
    if (state.lastQuizId) this.openSetup(state.lastQuizId);
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

  // ── Card Action Modal ─────────────────────────────────────
  confirmDelete(quizId) {
    const q = state.quizes.find(x => x.id === quizId);
    if (!q) return;
    state.cardActionQuizId = quizId;
    document.getElementById('card-action-title').textContent = q.name;
    document.getElementById('card-action-desc').textContent = q.desc || '';
    document.getElementById('card-action-overlay').classList.remove('hidden');
  },

  closeCardAction(e) {
    if (e && e.target !== document.getElementById('card-action-overlay')) return;
    document.getElementById('card-action-overlay').classList.add('hidden');
    state.cardActionQuizId = null;
  },

  editFromModal() {
    const id = state.cardActionQuizId;
    document.getElementById('card-action-overlay').classList.add('hidden');
    state.cardActionQuizId = null;
    this.openEditor(id);
  },

  deleteFromModal() {
    const id = state.cardActionQuizId;
    if (!id) return;
    document.getElementById('card-action-overlay').classList.add('hidden');
    state.cardActionQuizId = null;
    state.quizes = state.quizes.filter(q => q.id !== id);
    saveQuizes();
    this.renderHome();
  },

  // ── Editor ───────────────────────────────────────────────
  buildEditorGrids() {
    const sections = ['sg-columns','pl-columns','de-sg-columns','de-pl-columns'];
    sections.forEach(sec => {
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

  openEditor(quizId) {
    state.editingQuizId = quizId;
    const isNew = !quizId;
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
      const q = state.quizes.find(x => x.id === quizId);
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

  saveQuiz() {
    const name  = document.getElementById('new-quiz-name').value.trim();
    const desc  = document.getElementById('new-quiz-desc').value.trim();
    const errEl = document.getElementById('create-error');

    if (!name) { errEl.textContent = 'Bitte gib einen Quiz-Namen ein.'; errEl.classList.remove('hidden'); return; }

    const readSection = (prefix) => {
      const result = {};
      GENDERS.forEach(g => {
        result[g] = {};
        CASES.forEach(c => { result[g][c] = document.getElementById(`${prefix}_${g}_${c}`)?.value.trim() || ''; });
      });
      return result;
    };

    const sg    = readSection('sg-columns');
    const pl    = readSection('pl-columns');
    const de_sg = readSection('de-sg-columns');
    const de_pl = readSection('de-pl-columns');

    let allFilled = true;
    [sg, pl, de_sg, de_pl].forEach(obj => {
      GENDERS.forEach(g => CASES.forEach(c => { if (!obj[g][c]) allFilled = false; }));
    });
    if (!allFilled) { errEl.textContent = 'Bitte fülle alle Felder aus.'; errEl.classList.remove('hidden'); return; }

    if (state.editingQuizId) {
      const idx = state.quizes.findIndex(q => q.id === state.editingQuizId);
      if (idx !== -1) state.quizes[idx] = { ...state.quizes[idx], name, desc, sg, pl, de_sg, de_pl };
    } else {
      state.quizes.push({ id: 'quiz_' + Date.now(), name, desc, sg, pl, de_sg, de_pl });
    }
    saveQuizes();
    this.goHome();
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

    // Phase 1 – Singular: Kasus+Genus → lateinische Singularform
    if (phases.includes(1)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => p.push({
        phase: 1,
        meta: `${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
        main: 'Lateinische Form?',
        placeholder: 'Latein eingeben…',
        answer: q.sg[g][c] || '',
        answerDisplay: q.sg[g][c] || ''
      })));
      qs = [...qs, ...(shuffle ? p.sort(() => Math.random() - 0.5) : p)];
    }

    // Phase 2 – Plural: Kasus+Genus → lateinische Pluralform
    if (phases.includes(2)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => p.push({
        phase: 2,
        meta: `${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
        main: 'Lateinische Form?',
        placeholder: 'Latein eingeben…',
        answer: q.pl[g][c] || '',
        answerDisplay: q.pl[g][c] || ''
      })));
      qs = [...qs, ...(shuffle ? p.sort(() => Math.random() - 0.5) : p)];
    }

    // Phase 3 – Gemischt: zufällig Sg oder Pl
    if (phases.includes(3)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => {
        const isSg = Math.random() > 0.5;
        const form = isSg ? q.sg[g][c] : q.pl[g][c];
        p.push({
          phase: 3,
          meta: `${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  ${isSg ? 'Singular' : 'Plural'}`,
          main: 'Lateinische Form?',
          placeholder: 'Latein eingeben…',
          answer: form || '',
          answerDisplay: form || ''
        });
      }));
      qs = [...qs, ...p.sort(() => Math.random() - 0.5)];
    }

    // Phase 4 – Deutsch → Latein: deutsches Wort groß anzeigen
    if (phases.includes(4)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => {
        // Singular
        p.push({
          phase: 4,
          meta: `Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
          main: q.de_sg[g][c] || '?',
          placeholder: 'Latein eingeben…',
          answer: q.sg[g][c] || '',
          answerDisplay: q.sg[g][c] || ''
        });
        // Plural
        p.push({
          phase: 4,
          meta: `Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
          main: q.de_pl[g][c] || '?',
          placeholder: 'Latein eingeben…',
          answer: q.pl[g][c] || '',
          answerDisplay: q.pl[g][c] || ''
        });
      }));
      p = p.sort(() => Math.random() - 0.5);
      if (!shuffle) p = p.slice(0, 20);
      qs = [...qs, ...p];
    }

    // Phase 5 – Latein → Deutsch: lateinisches Wort groß anzeigen
    if (phases.includes(5)) {
      let p = [];
      GENDERS.forEach(g => CASES.forEach(c => {
        // Singular
        p.push({
          phase: 5,
          meta: `Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
          main: q.sg[g][c] || '?',
          placeholder: 'Deutsch eingeben…',
          answer: q.de_sg[g][c] || '',
          answerDisplay: q.de_sg[g][c] || ''
        });
        // Plural
        p.push({
          phase: 5,
          meta: `Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
          main: q.pl[g][c] || '?',
          placeholder: 'Deutsch eingeben…',
          answer: q.de_pl[g][c] || '',
          answerDisplay: q.de_pl[g][c] || ''
        });
      }));
      p = p.sort(() => Math.random() - 0.5);
      if (!shuffle) p = p.slice(0, 20);
      qs = [...qs, ...p];
    }

    return qs;
  },

  render() {
    const q     = this.questions[this.idx];
    const total = this.questions.length;
    const phaseLabels = {
      1: 'Phase 1 – Singular',
      2: 'Phase 2 – Plural',
      3: 'Phase 3 – Gemischt',
      4: 'Phase 4 – Deutsch → Latein',
      5: 'Phase 5 – Latein → Deutsch'
    };

    document.getElementById('quiz-phase-badge').textContent   = phaseLabels[q.phase] || '';
    document.getElementById('quiz-progress-text').textContent = `${this.idx + 1} / ${total}`;
    document.getElementById('progress-bar').style.width       = (this.idx / total * 100) + '%';
    document.getElementById('q-meta').textContent             = q.meta;
    document.getElementById('q-main').textContent             = q.main;

    const input = document.getElementById('answer-input');
    input.placeholder = q.placeholder || 'Antwort eingeben…';
    input.value = ''; input.disabled = false;
    input.focus();
    document.getElementById('feedback-box').className = 'feedback-box hidden';
    document.getElementById('next-btn').classList.add('hidden');
    this.answered = false;
  },

  check() {
    if (this.answered) return;
    const input = document.getElementById('answer-input');
    const val   = input.value.trim();
    if (!val) return;
    this.answered = true;
    input.disabled = true;

    const q  = this.questions[this.idx];
    const fb = document.getElementById('feedback-box');
    const correct = isCorrect(val, q.answer);

    if (correct) {
      this.score++;
      fb.textContent = '✓ Richtig!';
      fb.className = 'feedback-box correct';
    } else {
      // show all accepted answers if multiple
      const accepted = parseAnswers(q.answer);
      const display  = accepted.length > 1 ? accepted.join(' / ') : q.answerDisplay;
      fb.textContent = `✗ Falsch. Richtig: ${display}`;
      fb.className = 'feedback-box wrong';
    }
    document.getElementById('progress-bar').style.width = ((this.idx + 1) / this.questions.length * 100) + '%';
    document.getElementById('next-btn').classList.remove('hidden');
  },

  next() {
    this.idx++;
    if (this.idx >= this.questions.length) this.showResult();
    else this.render();
  },

  showResult() {
    const total = this.questions.length;
    const pct   = Math.round(this.score / total * 100);
    document.getElementById('result-score').textContent = `${this.score}/${total}`;
    let msg, icon;
    if (pct === 100) { msg = 'Perfekt! Absolut fehlerfrei.';       icon = '🏆'; }
    else if (pct >= 80) { msg = 'Sehr gut! Fast alles richtig.';   icon = '🏛️'; }
    else if (pct >= 60) { msg = 'Gut! Noch etwas üben.';           icon = '📜'; }
    else if (pct >= 40) { msg = 'Es geht. Mehr Übung hilft!';      icon = '⚡'; }
    else                { msg = 'Weiter üben – du schaffst das!';  icon = '🌿'; }
    document.getElementById('result-icon').textContent = icon;
    document.getElementById('result-msg').textContent  = msg;
    App.showPage('result');
  }
};

// ── Keyboard shortcuts ───────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('page-quiz').classList.contains('active')) {
    if (!Quiz.answered) Quiz.check(); else Quiz.next();
    return;
  }
  if (!document.getElementById('login-overlay').classList.contains('hidden')) {
    App.adminLogin();
  }
});

App.init();
