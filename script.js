'use strict';

// ── Firebase ─────────────────────────────────────────────────
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
const colPublished = db.collection('quizes');
const colDrafts    = db.collection('drafts');

// ── Constants ────────────────────────────────────────────────
const ADMIN_USER   = 'admin';
const ADMIN_PASS   = 'latina2024';
const CASES        = [1, 2, 3, 4, 6];
const CASE_NAMES   = { 1:'Nominativ', 2:'Genitiv', 3:'Dativ', 4:'Akkusativ', 6:'Ablativ' };
const GENDERS      = ['M', 'W', 'N'];
const GENDER_NAMES = { M:'Maskulinum (m.)', W:'Femininum (f.)', N:'Neutrum (n.)' };
const GENDER_LABEL = { M:'Maskulinum', W:'Femininum', N:'Neutrum' };
const GENDER_CLASS = { M:'m', W:'f', N:'n' };

// ── Helpers ──────────────────────────────────────────────────
function parseAnswers(raw) {
  return (raw||'').toLowerCase().split(/[\/,]/).map(s=>s.trim()).filter(Boolean);
}
function isCorrect(input, raw) {
  return parseAnswers(raw).includes(input.trim().toLowerCase());
}

// ── State ────────────────────────────────────────────────────
const state = {
  published: [],
  drafts: [],
  adminLoggedIn: false,
  currentQuiz: null,
  lastQuizId: null,
  lastQuizSource: null,
  editingId: null,
  editingSource: null,
  unsubPublished: null,
  unsubDrafts: null
};

// ── App ──────────────────────────────────────────────────────
const App = {

  async init() {
    this.buildEditorGrids();

    const loader = document.getElementById('loading-screen');
    loader.style.display = 'flex';

    // Load both collections once to hide loader quickly
    try {
      const [pubSnap, draftSnap] = await Promise.all([
        colPublished.orderBy('order').get(),
        colDrafts.orderBy('order').get()
      ]);
      state.published = pubSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.drafts    = draftSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      console.warn('Initial load error:', e.message);
      // Try without orderBy in case index doesn't exist yet
      try {
        const [pubSnap, draftSnap] = await Promise.all([
          colPublished.get(),
          colDrafts.get()
        ]);
        state.published = pubSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        state.drafts    = draftSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e2) {
        console.warn('Fallback load also failed:', e2.message);
      }
    }

    loader.style.display = 'none';
    this.renderHome();
    this.showPage('home');

    // Live listeners – replace arrays completely to avoid duplicates
    if (state.unsubPublished) state.unsubPublished();
    if (state.unsubDrafts)    state.unsubDrafts();

    state.unsubPublished = colPublished.onSnapshot(snap => {
      state.published = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.published.sort((a,b) => (a.order||0)-(b.order||0));
      if (this._onHome()) this.renderHome();
    }, err => console.warn('published snapshot:', err.message));

    state.unsubDrafts = colDrafts.onSnapshot(snap => {
      state.drafts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.drafts.sort((a,b) => (a.order||0)-(b.order||0));
      if (this._onHome()) this.renderHome();
    }, err => console.warn('drafts snapshot:', err.message));
  },

  _onHome() {
    return document.getElementById('page-home').classList.contains('active');
  },

  showPage(id, name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id)?.classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('topbar-center').textContent = name || '';
  },

  goHome() {
    document.getElementById('card-action-overlay').classList.add('hidden');
    this.renderHome();
    this.showPage('home');
  },

  // ── Render ───────────────────────────────────────────────
  renderHome() {
    const isAdmin = state.adminLoggedIn;

    // Draft section – only visible to admin
    document.getElementById('draft-section').classList.toggle('hidden', !isAdmin);

    if (isAdmin) {
      const grid  = document.getElementById('draft-grid');
      const empty = document.getElementById('draft-empty');
      grid.innerHTML = '';
      if (!state.drafts.length) {
        empty.style.display = 'block';
      } else {
        empty.style.display = 'none';
        state.drafts.forEach(q => grid.appendChild(this._makeDraftCard(q)));
      }
    }

    // Published
    const grid  = document.getElementById('quiz-grid');
    const empty = document.getElementById('empty-hint');
    grid.innerHTML = '';
    if (!state.published.length) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      state.published.forEach(q => grid.appendChild(this._makePublishedCard(q)));
    }
  },

  _makeDraftCard(q) {
    const card = document.createElement('div');
    card.className = 'quiz-card admin-mode draft-card';
    card.innerHTML = `
      <div class="draft-pill">Entwurf</div>
      <div class="quiz-card-name">${q.name}</div>
      <div class="quiz-card-desc">${q.desc||''}</div>
      <div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-pub">Veröffentlichen</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>
    `;
    card.querySelector('.card-overlay-edit').onclick = e => { e.stopPropagation(); App.openEditor(q.id, 'draft'); };
    card.querySelector('.card-overlay-pub').onclick  = e => { e.stopPropagation(); App.publishDraft(q.id, e.target); };
    card.querySelector('.card-overlay-del').onclick  = e => { e.stopPropagation(); App.deleteDraft(q.id); };
    card.onclick = () => App.openSetup(q.id, 'draft');
    return card;
  },

  _makePublishedCard(q) {
    const card = document.createElement('div');
    card.className = 'quiz-card' + (state.adminLoggedIn ? ' admin-mode' : '');
    card.innerHTML = `
      <div class="quiz-card-name">${q.name}</div>
      <div class="quiz-card-desc">${q.desc||''}</div>
      ${state.adminLoggedIn ? `
      <div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>` : ''}
    `;
    if (state.adminLoggedIn) {
      card.querySelector('.card-overlay-edit').onclick = e => { e.stopPropagation(); App.openEditor(q.id, 'published'); };
      card.querySelector('.card-overlay-del').onclick  = e => { e.stopPropagation(); App.confirmDelete(q.id); };
    } else {
      card.onclick = () => App.openSetup(q.id, 'published');
    }
    return card;
  },

  // ── Quiz flow ─────────────────────────────────────────────
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
    Quiz.start(state.currentQuiz,
      checked.map(c => parseInt(c.value)),
      document.getElementById('shuffle-within').checked);
  },

  replaySetup() {
    if (state.lastQuizId) this.openSetup(state.lastQuizId, state.lastQuizSource);
    else this.goHome();
  },

  // ── Admin ─────────────────────────────────────────────────
  handleAdminBtn() {
    if (state.adminLoggedIn) {
      state.adminLoggedIn = false;
      document.getElementById('admin-topbtn').classList.remove('active');
      document.getElementById('admin-topbtn').textContent = 'Admin';
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
  closeLoginForced() { document.getElementById('login-overlay').classList.add('hidden'); },

  adminLogin() {
    const u = document.getElementById('admin-username').value.trim();
    const p = document.getElementById('admin-password').value;
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      state.adminLoggedIn = true;
      document.getElementById('login-overlay').classList.add('hidden');
      document.getElementById('admin-topbtn').classList.add('active');
      document.getElementById('admin-topbtn').textContent = 'Ausloggen';
      document.getElementById('add-btn').classList.remove('hidden');
      this.renderHome();
    } else {
      document.getElementById('login-error').classList.remove('hidden');
    }
  },

  // ── Delete published ──────────────────────────────────────
  confirmDelete(id) {
    const q = state.published.find(x => x.id === id);
    if (!q) return;
    state.actionId = id;
    document.getElementById('card-action-title').textContent = q.name;
    document.getElementById('card-action-desc').textContent  = q.desc || '';
    document.getElementById('card-action-overlay').classList.remove('hidden');
  },

  closeCardAction(e) {
    if (e && e.target !== document.getElementById('card-action-overlay')) return;
    document.getElementById('card-action-overlay').classList.add('hidden');
  },

  editFromModal() {
    const id = state.actionId;
    document.getElementById('card-action-overlay').classList.add('hidden');
    this.openEditor(id, 'published');
  },

  async deleteFromModal() {
    const id = state.actionId;
    document.getElementById('card-action-overlay').classList.add('hidden');
    try { await colPublished.doc(id).delete(); }
    catch(e) { alert('Fehler beim Löschen: ' + e.message); }
  },

  // ── Draft actions ─────────────────────────────────────────
  async deleteDraft(id) {
    if (!confirm('Entwurf löschen?')) return;
    try { await colDrafts.doc(id).delete(); }
    catch(e) { alert('Fehler: ' + e.message); }
  },

  async publishDraft(id, btn) {
    const draft = state.drafts.find(q => q.id === id);
    if (!draft) return;
    if (btn) { btn.textContent = '…'; btn.disabled = true; }
    const pubId = 'pub_' + Date.now();
    const toPublish = { ...draft, id: pubId, order: Date.now() };
    try {
      await colPublished.doc(pubId).set(toPublish);
      await colDrafts.doc(id).delete();
      // snapshots will update state automatically
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
          const f = document.createElement('div');
          f.className = 'genus-field';
          f.innerHTML = `<label>${CASE_NAMES[c]}</label><input type="text" id="${sec}_${g}_${c}" placeholder="${CASE_NAMES[c].substring(0,3).toLowerCase()}." />`;
          col.appendChild(f);
        });
        wrap.appendChild(col);
      });
    });
  },

  openEditor(id, source) {
    state.editingId     = id || null;
    state.editingSource = source || null;
    const isNew = !id;
    document.getElementById('editor-page-title').textContent = isNew ? 'Neues Quiz' : 'Quiz bearbeiten';
    document.getElementById('create-error').classList.add('hidden');

    const clearAll = () => {
      document.getElementById('new-quiz-name').value = '';
      document.getElementById('new-quiz-desc').value = '';
      ['sg-columns','pl-columns','de-sg-columns','de-pl-columns'].forEach(sec =>
        GENDERS.forEach(g => CASES.forEach(c => {
          const el = document.getElementById(`${sec}_${g}_${c}`);
          if (el) el.value = '';
        }))
      );
    };

    if (isNew) {
      clearAll();
    } else {
      const q = source === 'draft'
        ? state.drafts.find(x => x.id === id)
        : state.published.find(x => x.id === id);
      if (!q) { clearAll(); return; }
      document.getElementById('new-quiz-name').value = q.name;
      document.getElementById('new-quiz-desc').value = q.desc || '';
      const map = {'sg-columns':q.sg,'pl-columns':q.pl,'de-sg-columns':q.de_sg,'de-pl-columns':q.de_pl};
      Object.entries(map).forEach(([sec, data]) =>
        GENDERS.forEach(g => CASES.forEach(c => {
          const el = document.getElementById(`${sec}_${g}_${c}`);
          if (el) el.value = data?.[g]?.[c] || '';
        }))
      );
    }
    this.showPage('editor', isNew ? 'Neues Quiz' : 'Bearbeiten');
  },

  _readForm() {
    const read = prefix => {
      const r = {};
      GENDERS.forEach(g => {
        r[g] = {};
        CASES.forEach(c => { r[g][c] = document.getElementById(`${prefix}_${g}_${c}`)?.value.trim() || ''; });
      });
      return r;
    };
    return {
      name:  document.getElementById('new-quiz-name').value.trim(),
      desc:  document.getElementById('new-quiz-desc').value.trim(),
      sg:    read('sg-columns'),
      pl:    read('pl-columns'),
      de_sg: read('de-sg-columns'),
      de_pl: read('de-pl-columns')
    };
  },

  _validate(data, requireAll) {
    const err = document.getElementById('create-error');
    if (!data.name) {
      err.textContent = 'Bitte gib einen Quiz-Namen ein.';
      err.classList.remove('hidden'); return false;
    }
    if (requireAll) {
      let ok = true;
      [data.sg, data.pl, data.de_sg, data.de_pl].forEach(obj =>
        GENDERS.forEach(g => CASES.forEach(c => { if (!obj[g][c]) ok = false; }))
      );
      if (!ok) { err.textContent = 'Bitte fülle alle Felder aus.'; err.classList.remove('hidden'); return false; }
    }
    return true;
  },

  async saveDraft() {
    const data = this._readForm();
    if (!this._validate(data, false)) return;
    document.getElementById('create-error').classList.add('hidden');

    const btn = document.getElementById('draft-btn');
    btn.textContent = 'Wird gespeichert…'; btn.disabled = true;

    try {
      if (state.editingSource === 'draft' && state.editingId) {
        // Update existing draft
        await colDrafts.doc(state.editingId).set({ id: state.editingId, order: Date.now(), ...data });
      } else {
        // New draft (also when forking a published quiz for editing)
        const id = 'draft_' + Date.now();
        await colDrafts.doc(id).set({ id, order: Date.now(), ...data });
      }
      this.goHome();
    } catch(e) {
      const err = document.getElementById('create-error');
      err.textContent = 'Fehler: ' + e.message;
      err.classList.remove('hidden');
    } finally {
      btn.textContent = 'Als Entwurf speichern'; btn.disabled = false;
    }
  },

  async publishQuiz() {
    const data = this._readForm();
    if (!this._validate(data, true)) return;

    const btn = document.getElementById('publish-btn');
    btn.textContent = 'Wird veröffentlicht…'; btn.disabled = true;

    const isEditPub = state.editingSource === 'published' && state.editingId;
    const docId = isEditPub ? state.editingId : 'pub_' + Date.now();
    const order = isEditPub
      ? (state.published.find(q => q.id === state.editingId)?.order || Date.now())
      : Date.now();

    try {
      await colPublished.doc(docId).set({ id: docId, order, ...data });
      // If this was a draft being published, delete the draft
      if (state.editingSource === 'draft' && state.editingId) {
        await colDrafts.doc(state.editingId).delete();
      }
      this.goHome();
    } catch(e) {
      const err = document.getElementById('create-error');
      err.textContent = 'Firebase-Fehler: ' + e.message;
      err.classList.remove('hidden');
    } finally {
      btn.textContent = 'Veröffentlichen'; btn.disabled = false;
    }
  }
};

// ── Quiz Engine ──────────────────────────────────────────────
const Quiz = {
  questions:[], idx:0, score:0, answered:false,

  start(quiz, phases, shuffle) {
    this.questions = this.build(quiz, phases, shuffle);
    this.idx = 0; this.score = 0; this.answered = false;
    App.showPage('quiz', quiz.name);
    this.render();
  },

  build(q, phases, shuffle) {
    let qs = [];
    const push = (list, shuf) => { qs = [...qs, ...(shuf ? list.sort(()=>Math.random()-.5) : list)]; };

    if (phases.includes(1)) {
      push(GENDERS.flatMap(g => CASES.map(c => ({
        phase:1, meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
        main:'Lateinische Form?', placeholder:'Latein eingeben…',
        answer:q.sg[g][c]||'', answerDisplay:q.sg[g][c]||''
      }))), shuffle);
    }
    if (phases.includes(2)) {
      push(GENDERS.flatMap(g => CASES.map(c => ({
        phase:2, meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
        main:'Lateinische Form?', placeholder:'Latein eingeben…',
        answer:q.pl[g][c]||'', answerDisplay:q.pl[g][c]||''
      }))), shuffle);
    }
    if (phases.includes(3)) {
      const p = GENDERS.flatMap(g => CASES.map(c => {
        const sg = Math.random() > .5, form = sg ? q.sg[g][c] : q.pl[g][c];
        return { phase:3, meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  ${sg?'Singular':'Plural'}`,
          main:'Lateinische Form?', placeholder:'Latein eingeben…',
          answer:form||'', answerDisplay:form||'' };
      }));
      qs = [...qs, ...p.sort(()=>Math.random()-.5)];
    }
    if (phases.includes(4)) {
      let p = GENDERS.flatMap(g => CASES.flatMap(c => [
        { phase:4, meta:`Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
          main:q.de_sg[g][c]||'?', placeholder:'Latein eingeben…',
          answer:q.sg[g][c]||'', answerDisplay:q.sg[g][c]||'' },
        { phase:4, meta:`Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
          main:q.de_pl[g][c]||'?', placeholder:'Latein eingeben…',
          answer:q.pl[g][c]||'', answerDisplay:q.pl[g][c]||'' }
      ])).sort(()=>Math.random()-.5);
      qs = [...qs, ...(shuffle ? p : p.slice(0,20))];
    }
    if (phases.includes(5)) {
      let p = GENDERS.flatMap(g => CASES.flatMap(c => [
        { phase:5, meta:`Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
          main:q.sg[g][c]||'?', placeholder:'Deutsch eingeben…',
          answer:q.de_sg[g][c]||'', answerDisplay:q.de_sg[g][c]||'' },
        { phase:5, meta:`Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
          main:q.pl[g][c]||'?', placeholder:'Deutsch eingeben…',
          answer:q.de_pl[g][c]||'', answerDisplay:q.de_pl[g][c]||'' }
      ])).sort(()=>Math.random()-.5);
      qs = [...qs, ...(shuffle ? p : p.slice(0,20))];
    }
    return qs;
  },

  render() {
    const q = this.questions[this.idx], total = this.questions.length;
    const labels = {1:'Phase 1 – Singular',2:'Phase 2 – Plural',3:'Phase 3 – Gemischt',
      4:'Phase 4 – Deutsch → Latein',5:'Phase 5 – Latein → Deutsch'};
    document.getElementById('quiz-phase-badge').textContent   = labels[q.phase]||'';
    document.getElementById('quiz-progress-text').textContent = `${this.idx+1} / ${total}`;
    document.getElementById('progress-bar').style.width       = (this.idx/total*100)+'%';
    document.getElementById('q-meta').textContent             = q.meta;
    document.getElementById('q-main').textContent             = q.main;
    const inp = document.getElementById('answer-input');
    inp.placeholder = q.placeholder||''; inp.value=''; inp.disabled=false; inp.focus();
    document.getElementById('feedback-box').className='feedback-box hidden';
    document.getElementById('next-btn').classList.add('hidden');
    this.answered = false;
  },

  check() {
    if (this.answered) return;
    const inp = document.getElementById('answer-input'), val = inp.value.trim();
    if (!val) return;
    this.answered = true; inp.disabled = true;
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
    const tiers=[[100,'Perfekt! Absolut fehlerfrei.','🏆'],[80,'Sehr gut! Fast alles richtig.','🏛️'],
      [60,'Gut! Noch etwas üben.','📜'],[40,'Es geht. Mehr Übung hilft!','⚡'],[0,'Weiter üben – du schaffst das!','🌿']];
    const [,msg,icon]=tiers.find(([t])=>pct>=t);
    document.getElementById('result-icon').textContent=icon;
    document.getElementById('result-msg').textContent=msg;
    App.showPage('result');
  }
};

// ── Keyboard ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('page-quiz').classList.contains('active')) {
    if (!Quiz.answered) Quiz.check(); else Quiz.next(); return;
  }
  if (!document.getElementById('login-overlay').classList.contains('hidden')) App.adminLogin();
});

App.init();
