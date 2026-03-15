/* ============================================================
   LATINA – script.js
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'latina2024';
const STORAGE_KEY = 'latina_quizes';

const CASES     = [1, 2, 3, 4, 6];
const CASE_NAMES = { 1:'Nominativ', 2:'Genitiv', 3:'Dativ', 4:'Akkusativ', 6:'Ablativ' };
const GENDERS   = ['M', 'W', 'N'];
const GENDER_NAMES = { M:'Maskulinum (m.)', W:'Femininum (f.)', N:'Neutrum (n.)' };
const GENDER_SHORT = { M:'m.', W:'f.', N:'n.' };

// ── Default Quiz (idem/eadem/idem) ───────────────────────────
const DEFAULT_QUIZ = {
  id: 'idem',
  name: 'idem / eadem / idem',
  desc: 'Pronomen „derselbe / dieselbe / dasselbe"',
  icon: '🏛️',
  sg: {
    M: { 1:'idem',    2:'eiusdem', 3:'eidem',  4:'eundem', 6:'eodem'  },
    W: { 1:'eadem',   2:'eiusdem', 3:'eidem',  4:'eandem', 6:'eadem'  },
    N: { 1:'idem',    2:'eiusdem', 3:'eidem',  4:'idem',   6:'eodem'  }
  },
  pl: {
    M: { 1:'iidem',   2:'eorundem', 3:'iisdem', 4:'eosdem', 6:'iisdem' },
    W: { 1:'eaedem',  2:'eorundem', 3:'iisdem', 4:'easdem', 6:'iisdem' },
    N: { 1:'eadem',   2:'eorundem', 3:'iisdem', 4:'eadem',  6:'iisdem' }
  },
  de_sg: {
    M: { 1:'derselbe',  2:'desselben', 3:'demselben', 4:'denselben', 6:'demselben' },
    W: { 1:'dieselbe',  2:'derselben', 3:'derselben', 4:'dieselbe',  6:'derselben' },
    N: { 1:'dasselbe',  2:'desselben', 3:'demselben', 4:'dasselbe',  6:'demselben' }
  },
  de_pl: {
    M: { 1:'dieselben', 2:'derselben', 3:'denselben', 4:'dieselben', 6:'denselben' },
    W: { 1:'dieselben', 2:'derselben', 3:'denselben', 4:'dieselben', 6:'denselben' },
    N: { 1:'dieselben', 2:'derselben', 3:'denselben', 4:'dieselben', 6:'denselben' }
  }
};

const ICONS = ['📜','🏺','⚡','🌿','🗿','🔱','⚔️','🌙','🪐','🦅'];

// ── State ────────────────────────────────────────────────────
let state = {
  quizes: [],
  adminLoggedIn: false,
  currentQuiz: null,
  selectedPhases: [],
  lastQuizId: null
};

// ── Storage ──────────────────────────────────────────────────
function saveQuizes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.quizes));
}

function loadQuizes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state.quizes = JSON.parse(raw);
    }
  } catch(e) {
    state.quizes = [];
  }
  // always ensure default quiz exists
  if (!state.quizes.find(q => q.id === 'idem')) {
    state.quizes.unshift(DEFAULT_QUIZ);
    saveQuizes();
  }
}

// ── App Controller ───────────────────────────────────────────
const App = {
  init() {
    loadQuizes();
    this.renderHome();
    this.buildAdminForms();
  },

  showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + id);
    if (el) el.classList.add('active');
  },

  goHome() {
    this.renderHome();
    this.showPage('home');
  },

  renderHome() {
    const grid = document.getElementById('quiz-grid');
    const empty = document.getElementById('empty-hint');
    grid.innerHTML = '';
    if (!state.quizes.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    state.quizes.forEach(q => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      card.innerHTML = `
        <span class="quiz-card-icon">${q.icon || '📜'}</span>
        <div class="quiz-card-name">${q.name}</div>
        <div class="quiz-card-desc">${q.desc || ''}</div>
        ${state.adminLoggedIn ? `<button class="quiz-card-delete" onclick="event.stopPropagation();App.deleteQuiz('${q.id}')">✕</button>` : ''}
      `;
      if (state.adminLoggedIn) {
        card.querySelector('.quiz-card-delete').style.display = 'block';
      }
      card.addEventListener('click', () => App.openSetup(q.id));
      grid.appendChild(card);
    });
  },

  openSetup(quizId) {
    const q = state.quizes.find(x => x.id === quizId);
    if (!q) return;
    state.currentQuiz = q;
    state.lastQuizId = quizId;
    document.getElementById('setup-title').textContent = q.name;
    document.getElementById('setup-desc').textContent = q.desc || '';
    // reset checkboxes
    document.querySelectorAll('input[name="phase"]').forEach(cb => {
      cb.checked = cb.value === '1';
    });
    this.showPage('setup');
  },

  startQuiz() {
    const checked = [...document.querySelectorAll('input[name="phase"]:checked')];
    if (!checked.length) { alert('Bitte wähle mindestens eine Phase aus.'); return; }
    state.selectedPhases = checked.map(c => parseInt(c.value));
    Quiz.start(state.currentQuiz, state.selectedPhases);
  },

  replaySetup() {
    if (state.lastQuizId) this.openSetup(state.lastQuizId);
    else this.goHome();
  },

  // ── Admin ─────────────────────────────────────────────────
  openAdmin() {
    const overlay = document.getElementById('admin-overlay');
    overlay.classList.remove('hidden');
    if (state.adminLoggedIn) {
      this.showAdminDash();
    } else {
      document.getElementById('admin-login-view').classList.remove('hidden');
      document.getElementById('admin-dash-view').classList.add('hidden');
      document.getElementById('admin-username').value = '';
      document.getElementById('admin-password').value = '';
      document.getElementById('login-error').classList.add('hidden');
      setTimeout(() => document.getElementById('admin-username').focus(), 100);
    }
  },

  closeAdmin(e) {
    if (e && e.target !== document.getElementById('admin-overlay')) return;
    document.getElementById('admin-overlay').classList.add('hidden');
  },

  adminLogin() {
    const u = document.getElementById('admin-username').value.trim();
    const p = document.getElementById('admin-password').value;
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      state.adminLoggedIn = true;
      this.showAdminDash();
      this.renderHome();
    } else {
      document.getElementById('login-error').classList.remove('hidden');
    }
  },

  adminLogout() {
    state.adminLoggedIn = false;
    document.getElementById('admin-overlay').classList.add('hidden');
    this.renderHome();
  },

  showAdminDash() {
    document.getElementById('admin-login-view').classList.add('hidden');
    document.getElementById('admin-dash-view').classList.remove('hidden');
    this.renderAdminList();
    this.clearCreateForm();
  },

  renderAdminList() {
    const list = document.getElementById('admin-quiz-list');
    list.innerHTML = '';
    if (!state.quizes.length) {
      list.innerHTML = '<div style="font-size:13px;color:var(--text3);">Keine Quize vorhanden.</div>';
      return;
    }
    state.quizes.forEach(q => {
      const item = document.createElement('div');
      item.className = 'admin-quiz-item';
      item.innerHTML = `
        <span>${q.icon || '📜'} ${q.name}</span>
        <button class="admin-quiz-item-del" onclick="App.deleteQuiz('${q.id}');App.renderAdminList();">Löschen</button>
      `;
      list.appendChild(item);
    });
  },

  deleteQuiz(id) {
    if (!confirm('Quiz wirklich löschen?')) return;
    state.quizes = state.quizes.filter(q => q.id !== id);
    saveQuizes();
    this.renderHome();
  },

  clearCreateForm() {
    document.getElementById('new-quiz-name').value = '';
    document.getElementById('new-quiz-desc').value = '';
    document.querySelectorAll('.forms-grid input').forEach(i => i.value = '');
    document.getElementById('create-error').classList.add('hidden');
  },

  buildAdminForms() {
    const sections = [
      { id:'sg-grid',    label:'Singular',         number: false },
      { id:'pl-grid',    label:'Plural',            number: false },
      { id:'de-sg-grid', label:'Deutsch Singular',  number: false },
      { id:'de-pl-grid', label:'Deutsch Plural',    number: false },
    ];

    sections.forEach(sec => {
      const grid = document.getElementById(sec.id);
      grid.innerHTML = '';
      GENDERS.forEach(g => {
        CASES.forEach(c => {
          const item = document.createElement('div');
          item.className = 'forms-grid-item';
          const inputId = `${sec.id}_${g}_${c}`;
          item.innerHTML = `
            <label>${CASE_NAMES[c]} ${GENDER_SHORT[g]}</label>
            <input type="text" id="${inputId}" placeholder="${CASE_NAMES[c].substring(0,3).toLowerCase()}. ${g.toLowerCase()}."/>
          `;
          grid.appendChild(item);
        });
      });
    });
  },

  createQuiz() {
    const name = document.getElementById('new-quiz-name').value.trim();
    const desc = document.getElementById('new-quiz-desc').value.trim();
    if (!name) {
      document.getElementById('create-error').textContent = 'Bitte gib einen Quiz-Namen ein.';
      document.getElementById('create-error').classList.remove('hidden');
      return;
    }

    const readGrid = (prefix) => {
      const result = {};
      GENDERS.forEach(g => {
        result[g] = {};
        CASES.forEach(c => {
          const val = document.getElementById(`${prefix}_${g}_${c}`)?.value.trim() || '';
          result[g][c] = val;
        });
      });
      return result;
    };

    const sg    = readGrid('sg-grid');
    const pl    = readGrid('pl-grid');
    const de_sg = readGrid('de-sg-grid');
    const de_pl = readGrid('de-pl-grid');

    // Check all filled
    let allFilled = true;
    [sg, pl, de_sg, de_pl].forEach(obj => {
      GENDERS.forEach(g => CASES.forEach(c => { if (!obj[g][c]) allFilled = false; }));
    });

    if (!allFilled) {
      document.getElementById('create-error').textContent = 'Bitte fülle alle Felder aus.';
      document.getElementById('create-error').classList.remove('hidden');
      return;
    }

    const newQuiz = {
      id: 'quiz_' + Date.now(),
      name,
      desc,
      icon: ICONS[Math.floor(Math.random() * ICONS.length)],
      sg, pl, de_sg, de_pl
    };

    state.quizes.push(newQuiz);
    saveQuizes();
    this.clearCreateForm();
    this.renderAdminList();
    this.renderHome();
    document.getElementById('create-error').classList.add('hidden');
    alert(`Quiz "${name}" wurde gespeichert!`);
  }
};

// ── Quiz Engine ──────────────────────────────────────────────
const Quiz = {
  questions: [],
  idx: 0,
  score: 0,
  answered: false,
  currentQuiz: null,
  phases: [],

  start(quiz, phases) {
    this.currentQuiz = quiz;
    this.phases = phases;
    this.questions = this.buildQuestions(quiz, phases);
    this.idx = 0;
    this.score = 0;
    this.answered = false;
    App.showPage('quiz');
    this.render();
  },

  buildQuestions(q, phases) {
    let qs = [];

    if (phases.includes(1)) {
      // Singular: label = Kasus + Genus, question = "Was ist die Form?", answer = latin sg
      GENDERS.forEach(g => CASES.forEach(c => {
        qs.push({
          phase: 1,
          label: `${CASE_NAMES[c]} – ${GENDER_NAMES[g]}`,
          question: 'Singular',
          answer: (q.sg[g][c] || '').toLowerCase(),
          hint: 'Singular'
        });
      }));
    }

    if (phases.includes(2)) {
      GENDERS.forEach(g => CASES.forEach(c => {
        qs.push({
          phase: 2,
          label: `${CASE_NAMES[c]} – ${GENDER_NAMES[g]}`,
          question: 'Plural',
          answer: (q.pl[g][c] || '').toLowerCase(),
          hint: 'Plural'
        });
      }));
    }

    if (phases.includes(3)) {
      GENDERS.forEach(g => CASES.forEach(c => {
        const isSg = Math.random() > 0.5;
        qs.push({
          phase: 3,
          label: `${CASE_NAMES[c]} – ${GENDER_NAMES[g]} (${isSg ? 'Sg.' : 'Pl.'})`,
          question: isSg ? 'Singular' : 'Plural',
          answer: (isSg ? q.sg[g][c] : q.pl[g][c] || '').toLowerCase(),
          hint: isSg ? 'Singular' : 'Plural'
        });
      }));
      // shuffle phase 3
      qs = qs.filter(x => x.phase !== 3)
        .concat(qs.filter(x => x.phase === 3).sort(() => Math.random() - 0.5));
    }

    if (phases.includes(4)) {
      let p4 = [];
      GENDERS.forEach(g => CASES.forEach(c => {
        p4.push({
          phase: 4,
          label: `Deutsch → Latein`,
          question: `„${q.de_sg[g][c]}"  (Sg., ${CASE_NAMES[c]}, ${GENDER_SHORT[g]})`,
          answer: (q.sg[g][c] || '').toLowerCase(),
          hint: 'Singular'
        });
        p4.push({
          phase: 4,
          label: `Deutsch → Latein`,
          question: `„${q.de_pl[g][c]}"  (Pl., ${CASE_NAMES[c]}, ${GENDER_SHORT[g]})`,
          answer: (q.pl[g][c] || '').toLowerCase(),
          hint: 'Plural'
        });
      }));
      p4 = p4.sort(() => Math.random() - 0.5).slice(0, 20);
      qs = qs.concat(p4);
    }

    return qs;
  },

  render() {
    const q = this.questions[this.idx];
    const total = this.questions.length;
    const pct = ((this.idx) / total) * 100;

    // badge
    const phaseLabels = { 1:'Phase 1 – Singular', 2:'Phase 2 – Plural', 3:'Phase 3 – Gemischt', 4:'Phase 4 – Deutsch → Latein' };
    document.getElementById('quiz-phase-badge').textContent = phaseLabels[q.phase] || 'Phase';
    document.getElementById('quiz-progress-text').textContent = `${this.idx + 1} / ${total}`;
    document.getElementById('progress-bar').style.width = pct + '%';

    document.getElementById('q-label').textContent = q.label;
    document.getElementById('q-subtext').textContent = q.question;

    const input = document.getElementById('answer-input');
    input.value = '';
    input.disabled = false;
    input.focus();

    document.getElementById('feedback-box').className = 'feedback-box hidden';
    document.getElementById('next-btn').classList.add('hidden');
    this.answered = false;
  },

  check() {
    if (this.answered) return;
    const input = document.getElementById('answer-input');
    const val = input.value.trim().toLowerCase();
    if (!val) return;

    this.answered = true;
    input.disabled = true;

    const q = this.questions[this.idx];
    const fb = document.getElementById('feedback-box');
    const correct = val === q.answer;

    if (correct) {
      this.score++;
      fb.textContent = '✓ Richtig!';
      fb.className = 'feedback-box correct';
    } else {
      fb.textContent = `✗ Falsch. Richtig wäre: ${q.answer}`;
      fb.className = 'feedback-box wrong';
    }

    document.getElementById('progress-bar').style.width = ((this.idx + 1) / this.questions.length * 100) + '%';
    document.getElementById('next-btn').classList.remove('hidden');
  },

  next() {
    this.idx++;
    if (this.idx >= this.questions.length) {
      this.showResult();
    } else {
      this.render();
    }
  },

  showResult() {
    const total = this.questions.length;
    const pct = Math.round((this.score / total) * 100);
    document.getElementById('result-score').textContent = `${this.score}/${total}`;

    let msg = '', icon = '';
    if (pct === 100) { msg = 'Perfekt! Absolut fehlerfrei.'; icon = '🏆'; }
    else if (pct >= 80) { msg = 'Sehr gut! Fast alles richtig.'; icon = '🏛️'; }
    else if (pct >= 60) { msg = 'Gut! Noch etwas üben.'; icon = '📜'; }
    else if (pct >= 40) { msg = 'Es geht. Mehr Übung hilft!'; icon = '⚡'; }
    else { msg = 'Weiter üben – du schaffst das!'; icon = '🌿'; }

    document.getElementById('result-icon').textContent = icon;
    document.getElementById('result-msg').textContent = msg;
    App.showPage('result');
  }
};

// ── Keyboard shortcuts ───────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const quizPage = document.getElementById('page-quiz');
    if (!quizPage.classList.contains('active')) return;
    if (!Quiz.answered) {
      Quiz.check();
    } else {
      Quiz.next();
    }
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const loginView = document.getElementById('admin-login-view');
    if (!loginView.classList.contains('hidden') && !document.getElementById('admin-overlay').classList.contains('hidden')) {
      App.adminLogin();
    }
  }
});

// ── Init ─────────────────────────────────────────────────────
App.init();
