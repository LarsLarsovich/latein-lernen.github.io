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
const COL = {
  published: db.collection('quizes'),
  drafts:    db.collection('drafts'),
  pronomen:       db.collection('tables_pronomen'),
  vokabel:        db.collection('tables_vokabel'),
  pronomenDrafts: db.collection('drafts_pronomen'),
  vokabelDrafts:  db.collection('drafts_vokabel')
};

// ── Constants ────────────────────────────────────────────────
const ADMIN_USER   = 'admin';
const ADMIN_PASS   = 'latina2024';
const CASES        = [1, 2, 3, 4, 6];
const CASE_NAMES   = { 1:'Nominativ', 2:'Genitiv', 3:'Dativ', 4:'Akkusativ', 6:'Ablativ' };
const GENDERS      = ['M', 'W', 'N'];
const GENDER_NAMES = { M:'Maskulinum (m.)', W:'Femininum (f.)', N:'Neutrum (n.)' };
const GENDER_LABEL = { M:'Maskulinum', W:'Femininum', N:'Neutrum' };
const GENDER_CLASS = { M:'m', W:'f', N:'n' };
const GENUS_OPTS   = ['–','m.','f.','n.'];
const DEKL_OPTS    = ['–','1. Dekl.','2. Dekl.','3. Dekl.','4. Dekl.','5. Dekl.'];

function parseAnswers(raw) {
  return (raw||'').toLowerCase().split('%').map(s=>s.trim()).filter(Boolean);
}
function isCorrect(input, raw) {
  return parseAnswers(raw).includes(input.trim().toLowerCase());
}

// Expand "(er%sie%es) geht" → "er geht%sie geht%es geht"
function expandBrackets(str) {
  if (!str) return str;
  // Find (a%b%c) pattern and expand with surrounding text
  return str.replace(/\(([^)]+)\)\s*/g, (match, inner, offset, full) => {
    const prefix = full.slice(0, offset);
    const suffix = full.slice(offset + match.length);
    const options = inner.split('%').map(s => s.trim());
    return options.map(o => (prefix + o + ' ' + suffix).replace(/\s+/g, ' ').trim()).join('%');
  }).replace(/\s*%\s*/g, '%');
}

// ── State ────────────────────────────────────────────────────
const state = {
  published: [], drafts: [], pronomen: [], vokabel: [],
  pronomenDrafts: [], vokabelDrafts: [],
  adminLoggedIn: false,
  currentTab: 'quizes',
  currentQuiz: null, lastQuizId: null, lastQuizSource: null,
  editingId: null, editingSource: null,
  actionId: null, actionType: null,
  tableViewId: null, tableViewType: null,
  pickerMode: null, // 'quiz-from-table' | 'table-from-quiz'
  unsubs: {}
};

// ── App ──────────────────────────────────────────────────────
const App = {

  async init() {
    this.buildEditorGrids('');          // quiz editor
    this.buildEditorGrids('pt-');       // pronomen table editor
    Tables.buildVokabelRow_template();

    const loader = document.getElementById('loading-screen');
    loader.style.display = 'flex';

    const hideLoader = () => { loader.style.display = 'none'; };

    // Hard timeout – loader never stays more than 6 seconds
    const timeout = setTimeout(hideLoader, 6000);

    const fromSnap = snap => snap.docs.map(d=>({id:d.id,...d.data()}));

    try {
      const [pubS, draftS, pronS, vokS, pronDrS, vokDrS] = await Promise.all([
        COL.published.get().catch(()=>({docs:[]})),
        COL.drafts.get().catch(()=>({docs:[]})),
        COL.pronomen.get().catch(()=>({docs:[]})),
        COL.vokabel.get().catch(()=>({docs:[]})),
        COL.pronomenDrafts.get().catch(()=>({docs:[]})),
        COL.vokabelDrafts.get().catch(()=>({docs:[]}))
      ]);
      state.published      = fromSnap(pubS);
      state.drafts         = fromSnap(draftS);
      state.pronomen       = fromSnap(pronS);
      state.vokabel        = fromSnap(vokS);
      state.pronomenDrafts = fromSnap(pronDrS);
      state.vokabelDrafts  = fromSnap(vokDrS);
    } catch(e) { console.warn('init load:', e.message); }

    clearTimeout(timeout);
    hideLoader();
    this.renderHome();
    this.showPage('home');

    // Live listeners
    const listen = (col, key, sort) => {
      if (state.unsubs[key]) state.unsubs[key]();
      state.unsubs[key] = col.onSnapshot(snap => {
        state[key] = snap.docs.map(d=>({id:d.id,...d.data()}));
        if (sort) state[key].sort((a,b)=>(a.order||0)-(b.order||0));
        if (this._onHome()) this.renderHome();
      }, err => console.warn(key, err.message));
    };
    listen(COL.published, 'published', true);
    listen(COL.drafts,    'drafts',    true);
    listen(COL.pronomen,       'pronomen',       true);
    listen(COL.vokabel,        'vokabel',        true);
    listen(COL.pronomenDrafts, 'pronomenDrafts', true);
    listen(COL.vokabelDrafts,  'vokabelDrafts',  true);
  },

  _onHome() { return document.getElementById('page-home').classList.contains('active'); },

  showPage(id, name) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+id)?.classList.add('active');
    window.scrollTo(0,0);
    document.getElementById('topbar-center').textContent = name||'';
  },

  goHome() {
    document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.add('hidden'));
    this.renderHome();
    this.showPage('home');
  },

  switchTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.home-tab').forEach(t=>t.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    document.getElementById('tab-content-quizes').classList.toggle('hidden', tab!=='quizes');
    document.getElementById('tab-content-tables').classList.toggle('hidden', tab!=='tables');
  },

  // ── Render home ──────────────────────────────────────────
  renderHome() {
    const isAdmin = state.adminLoggedIn;

    // Drafts
    document.getElementById('draft-section').classList.toggle('hidden', !isAdmin);
    if (isAdmin) {
      const g = document.getElementById('draft-grid');
      const e = document.getElementById('draft-empty');
      g.innerHTML = '';
      if (!state.drafts.length) { e.style.display='block'; }
      else { e.style.display='none'; state.drafts.forEach(q=>g.appendChild(this._makeDraftCard(q))); }
    }

    // Published quizes
    const qg = document.getElementById('quiz-grid');
    const qe = document.getElementById('empty-hint');
    qg.innerHTML = '';
    if (!state.published.length) { qe.style.display='block'; }
    else { qe.style.display='none'; state.published.forEach(q=>qg.appendChild(this._makePublishedCard(q))); }

    // Pronomen drafts (admin only)
    const pdg = document.getElementById('pronomen-draft-grid');
    const pds = document.getElementById('pronomen-draft-section');
    if (pdg && pds) {
      pds.classList.toggle('hidden', !isAdmin);
      if (isAdmin) {
        pdg.innerHTML = '';
        state.pronomenDrafts.forEach(t=>pdg.appendChild(this._makeTableDraftCard(t,'pronomen')));
        document.getElementById('pronomen-draft-empty').style.display = state.pronomenDrafts.length ? 'none' : 'block';
      }
    }

    // Pronomen tables
    const pg = document.getElementById('pronomen-grid');
    const pe = document.getElementById('pronomen-empty');
    pg.innerHTML = '';
    if (!state.pronomen.length) { pe.style.display='block'; }
    else { pe.style.display='none'; state.pronomen.forEach(t=>pg.appendChild(this._makeTableCard(t,'pronomen'))); }

    // Vokabel drafts (admin only)
    const vdg = document.getElementById('vokabel-draft-grid');
    const vds = document.getElementById('vokabel-draft-section');
    if (vdg && vds) {
      vds.classList.toggle('hidden', !isAdmin);
      if (isAdmin) {
        vdg.innerHTML = '';
        state.vokabelDrafts.forEach(t=>vdg.appendChild(this._makeTableDraftCard(t,'vokabel')));
        document.getElementById('vokabel-draft-empty').style.display = state.vokabelDrafts.length ? 'none' : 'block';
      }
    }

    // Vokabel tables
    const vg = document.getElementById('vokabel-grid');
    const ve = document.getElementById('vokabel-empty');
    vg.innerHTML = '';
    if (!state.vokabel.length) { ve.style.display='block'; }
    else { ve.style.display='none'; state.vokabel.forEach(t=>vg.appendChild(this._makeTableCard(t,'vokabel'))); }
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
      </div>`;
    card.querySelector('.card-overlay-edit').onclick = e=>{e.stopPropagation();App.openEditor(q.id,'draft');};
    card.querySelector('.card-overlay-pub').onclick  = e=>{e.stopPropagation();App.publishDraft(q.id,e.target);};
    card.querySelector('.card-overlay-del').onclick  = e=>{e.stopPropagation();App.deleteDraft(q.id);};
    card.onclick = ()=>App.openSetup(q.id,'draft');
    return card;
  },

  _makePublishedCard(q) {
    const card = document.createElement('div');
    card.className = 'quiz-card'+(state.adminLoggedIn?' admin-mode':'');
    card.innerHTML = `
      <div class="quiz-card-name">${q.name}</div>
      <div class="quiz-card-desc">${q.desc||''}</div>
      ${state.adminLoggedIn?`<div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>`:''}`;
    if (state.adminLoggedIn) {
      card.querySelector('.card-overlay-edit').onclick = e=>{e.stopPropagation();App.openEditor(q.id,'published');};
      card.querySelector('.card-overlay-del').onclick  = e=>{e.stopPropagation();App.confirmDelete(q.id);};
    } else {
      card.onclick = ()=>App.openSetup(q.id,'published');
    }
    return card;
  },

  _makeTableCard(t, type) {
    const card = document.createElement('div');
    const typeLabel = type==='pronomen'?'Pronomen':'Vokabeln';
    card.className = 'quiz-card'+(state.adminLoggedIn?' admin-mode':'');
    card.innerHTML = `
      <div class="table-type-pill">${typeLabel}</div>
      <div class="quiz-card-name">${t.name}</div>
      <div class="quiz-card-desc">${t.desc||''}</div>
      ${state.adminLoggedIn?`<div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>`:''}`;
    if (state.adminLoggedIn) {
      card.querySelector('.card-overlay-edit').onclick = e=>{e.stopPropagation();
        if(type==='pronomen') Tables.openPronomenEditor(t.id);
        else Tables.openVokabelEditor(t.id);
      };
      card.querySelector('.card-overlay-del').onclick = e=>{e.stopPropagation();Tables.confirmDelete(t.id,type);};
    }
    card.onclick = ()=>Tables.viewTable(t.id, type);
    return card;
  },

  _makeTableDraftCard(t, type) {
    const typeLabel = type==='pronomen'?'Pronomen':'Vokabeln';
    const card = document.createElement('div');
    card.className = 'quiz-card admin-mode draft-card';
    card.innerHTML = `
      <div class="draft-pill">Entwurf · ${typeLabel}</div>
      <div class="quiz-card-name">${t.name}</div>
      <div class="quiz-card-desc">${t.desc||''}</div>
      <div class="card-admin-overlay">
        <button class="card-overlay-btn card-overlay-edit">Bearbeiten</button>
        <button class="card-overlay-btn card-overlay-pub">Veröffentlichen</button>
        <button class="card-overlay-btn card-overlay-del">Löschen</button>
      </div>`;
    card.querySelector('.card-overlay-edit').onclick = e=>{e.stopPropagation();
      if(type==='pronomen') Tables.openPronomenEditor(t.id,'draft');
      else Tables.openVokabelEditor(t.id,'draft');
    };
    card.querySelector('.card-overlay-pub').onclick = e=>{e.stopPropagation();Tables.publishTableDraft(t.id,type,e.target);};
    card.querySelector('.card-overlay-del').onclick = e=>{e.stopPropagation();Tables.deleteTableDraft(t.id,type);};
    card.onclick = ()=>Tables.viewTable(t.id, type, true);
    return card;
  },

  // ── Quiz flow ─────────────────────────────────────────────
  openSetup(id, source) {
    const q = source==='draft' ? state.drafts.find(x=>x.id===id) : state.published.find(x=>x.id===id);
    if (!q) return;
    state.currentQuiz=q; state.lastQuizId=id; state.lastQuizSource=source;
    document.getElementById('setup-title').textContent = q.name;
    document.getElementById('setup-desc').textContent  = q.desc||'';
    document.querySelectorAll('input[name="phase"]').forEach(cb=>{cb.checked=cb.value==='1';});
    document.getElementById('shuffle-within').checked = false;
    this.showPage('setup', q.name);
  },

  startQuiz() {
    const checked=[...document.querySelectorAll('input[name="phase"]:checked')];
    if (!checked.length){alert('Bitte wähle mindestens eine Phase.');return;}
    Quiz.start(state.currentQuiz, checked.map(c=>parseInt(c.value)), document.getElementById('shuffle-within').checked);
  },

  replaySetup() {
    if (state.lastQuizId) this.openSetup(state.lastQuizId,state.lastQuizSource); else this.goHome();
  },

  // ── Admin ─────────────────────────────────────────────────
  handleAdminBtn() {
    if (state.adminLoggedIn) {
      state.adminLoggedIn=false;
      document.getElementById('admin-topbtn').classList.remove('active');
      document.getElementById('admin-topbtn').textContent='Admin';
      document.getElementById('add-btn').classList.add('hidden');
      this.renderHome();
    } else { this.openLogin(); }
  },

  openLogin() {
    document.getElementById('admin-username').value='';
    document.getElementById('admin-password').value='';
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
    setTimeout(()=>document.getElementById('admin-username').focus(),80);
  },

  closeLogin(e) { if(e&&e.target!==document.getElementById('login-overlay'))return; document.getElementById('login-overlay').classList.add('hidden'); },
  closeLoginForced() { document.getElementById('login-overlay').classList.add('hidden'); },

  adminLogin() {
    const u=document.getElementById('admin-username').value.trim();
    const p=document.getElementById('admin-password').value;
    if (u===ADMIN_USER&&p===ADMIN_PASS) {
      state.adminLoggedIn=true;
      document.getElementById('login-overlay').classList.add('hidden');
      document.getElementById('admin-topbtn').classList.add('active');
      document.getElementById('admin-topbtn').textContent='Ausloggen';
      document.getElementById('add-btn').classList.remove('hidden');
      this.renderHome();
    } else { document.getElementById('login-error').classList.remove('hidden'); }
  },

  // ── Add menu ──────────────────────────────────────────────
  openAddMenu() { document.getElementById('add-menu-overlay').classList.remove('hidden'); },
  closeAddMenu(e) {
    if(e&&e.target!==document.getElementById('add-menu-overlay'))return;
    document.getElementById('add-menu-overlay').classList.add('hidden');
  },

  // ── Delete published quiz ─────────────────────────────────
  confirmDelete(id) {
    const q=state.published.find(x=>x.id===id); if(!q)return;
    state.actionId=id;
    document.getElementById('card-action-title').textContent=q.name;
    document.getElementById('card-action-desc').textContent=q.desc||'';
    document.getElementById('card-action-overlay').classList.remove('hidden');
  },
  closeCardAction(e) { if(e&&e.target!==document.getElementById('card-action-overlay'))return; document.getElementById('card-action-overlay').classList.add('hidden'); },
  editFromModal() { const id=state.actionId; document.getElementById('card-action-overlay').classList.add('hidden'); this.openEditor(id,'published'); },
  async deleteFromModal() {
    const id=state.actionId; document.getElementById('card-action-overlay').classList.add('hidden');
    try { await COL.published.doc(id).delete(); } catch(e){ alert('Fehler: '+e.message); }
  },

  // ── Draft ops ─────────────────────────────────────────────
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

  // ── Quiz Editor ───────────────────────────────────────────
  buildEditorGrids(prefix) {
    ['sg-columns','pl-columns','de-sg-columns','de-pl-columns'].forEach(sec=>{
      const wrap=document.getElementById(prefix+sec); if(!wrap)return;
      wrap.innerHTML='';
      GENDERS.forEach(g=>{
        const col=document.createElement('div'); col.className='genus-col';
        col.innerHTML=`<div class="genus-col-header ${GENDER_CLASS[g]}">${GENDER_LABEL[g]}</div>`;
        CASES.forEach(c=>{
          const f=document.createElement('div'); f.className='genus-field';
          f.innerHTML=`<label>${CASE_NAMES[c]}</label><input type="text" id="${prefix}${sec}_${g}_${c}" placeholder="${CASE_NAMES[c].substring(0,3).toLowerCase()}." />`;
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

  _nameId(prefix)  { return prefix==='pt-' ? 'pt-name' : 'new-quiz-name'; },
  _descId(prefix)  { return prefix==='pt-' ? 'pt-desc' : 'new-quiz-desc'; },

  _clearQuizForm(prefix) {
    document.getElementById(this._nameId(prefix)).value='';
    document.getElementById(this._descId(prefix)).value='';
    ['sg-columns','pl-columns','de-sg-columns','de-pl-columns'].forEach(sec=>
      GENDERS.forEach(g=>CASES.forEach(c=>{ const el=document.getElementById(`${prefix}${sec}_${g}_${c}`); if(el)el.value=''; }))
    );
  },

  _fillQuizForm(prefix, q) {
    document.getElementById(this._nameId(prefix)).value=q.name||'';
    document.getElementById(this._descId(prefix)).value=q.desc||'';
    const map={'sg-columns':q.sg,'pl-columns':q.pl,'de-sg-columns':q.de_sg,'de-pl-columns':q.de_pl};
    Object.entries(map).forEach(([sec,data])=>
      GENDERS.forEach(g=>CASES.forEach(c=>{ const el=document.getElementById(`${prefix}${sec}_${g}_${c}`); if(el)el.value=data?.[g]?.[c]||''; }))
    );
  },

  _readQuizForm(prefix) {
    const read=sec=>{ const r={}; GENDERS.forEach(g=>{r[g]={};CASES.forEach(c=>{r[g][c]=document.getElementById(`${prefix}${sec}_${g}_${c}`)?.value.trim()||'';});}); return r; };
    return { name:document.getElementById(this._nameId(prefix)).value.trim(), desc:document.getElementById(this._descId(prefix)).value.trim(),
      sg:read('sg-columns'), pl:read('pl-columns'), de_sg:read('de-sg-columns'), de_pl:read('de-pl-columns') };
  },


  _validateQuiz(data, errId, requireAll) {
    const err=document.getElementById(errId);
    if(!data.name){err.textContent='Bitte gib einen Namen ein.';err.classList.remove('hidden');return false;}
    if(requireAll){
      let ok=true;
      [data.sg,data.pl,data.de_sg,data.de_pl].forEach(obj=>GENDERS.forEach(g=>CASES.forEach(c=>{if(!obj[g][c])ok=false;})));
      if(!ok){err.textContent='Bitte fülle alle Felder aus.';err.classList.remove('hidden');return false;}
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

  // ── Picker (Quiz↔Tabelle) ─────────────────────────────────
  openTablePickerForQuiz() {
    state.pickerMode='quiz-from-table';
    document.getElementById('picker-title').textContent='Aus welcher Pronomen-Tabelle?';
    const list=document.getElementById('picker-list'); list.innerHTML='';
    if(!state.pronomen.length){list.innerHTML='<div class="empty-hint">Keine Pronomen-Tabellen vorhanden.</div>';} 
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
    if(!all.length){list.innerHTML='<div class="empty-hint">Keine Quize vorhanden.</div>';}
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
    // Fill quiz editor from pronomen table
    document.getElementById('new-quiz-name').value=t.name;
    document.getElementById('new-quiz-desc').value=t.desc||'';
    this._fillQuizForm('',t);
  },

  // From table view page
  editTableFromView() {
    if(state.tableViewType==='pronomen') Tables.openPronomenEditor(state.tableViewId);
    else Tables.openVokabelEditor(state.tableViewId);
  },

  createQuizFromTable() {
    if(state.tableViewType!=='pronomen'){alert('Quiz-Erstellung nur aus Pronomen-Tabellen möglich.');return;}
    const t=state.pronomen.find(x=>x.id===state.tableViewId); if(!t)return;
    this.openEditor(null,null);
    setTimeout(()=>this._fillFromPronomenTable(t),50);
  }
};

function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Tables ───────────────────────────────────────────────────
const Tables = {

  // ── View ─────────────────────────────────────────────────
  viewTable(id, type) {
    state.tableViewId=id; state.tableViewType=type;
    const t = type==='pronomen' ? state.pronomen.find(x=>x.id===id) : state.vokabel.find(x=>x.id===id);
    if(!t)return;
    document.getElementById('table-view-title').textContent=t.name;
    document.getElementById('table-view-admin-btns').classList.toggle('hidden',!state.adminLoggedIn);
    const content=document.getElementById('table-view-content');
    content.innerHTML = type==='pronomen' ? this._renderPronomenTable(t) : this._renderVokabelTable(t);
    App.showPage('table-view', t.name);
  },

  _renderPronomenTable(t) {
    let html=`<div class="table-desc">${t.desc||''}</div>`;
    // Singular
    html+=`<div class="forms-section-title">Singular</div>`;
    html+=`<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th></th><th>Maskulinum</th><th>Femininum</th><th>Neutrum</th></tr></thead><tbody>`;
    CASES.forEach(c=>{
      html+=`<tr><td class="case-cell">${CASE_NAMES[c]}</td>`;
      GENDERS.forEach(g=>{ html+=`<td>${t.sg?.[g]?.[c]||'–'}</td>`; });
      html+=`</tr>`;
    });
    html+=`</tbody></table></div>`;
    // Plural
    html+=`<div class="forms-section-title" style="margin-top:1.5rem;">Plural</div>`;
    html+=`<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th></th><th>Maskulinum</th><th>Femininum</th><th>Neutrum</th></tr></thead><tbody>`;
    CASES.forEach(c=>{
      html+=`<tr><td class="case-cell">${CASE_NAMES[c]}</td>`;
      GENDERS.forEach(g=>{ html+=`<td>${t.pl?.[g]?.[c]||'–'}</td>`; });
      html+=`</tr>`;
    });
    html+=`</tbody></table></div>`;
    // Deutsche Entsprechungen
    if(t.de_sg) {
      html+=`<div class="forms-section-title" style="margin-top:1.5rem;">Deutsche Entsprechungen</div>`;
      html+=`<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th></th><th>M Sg.</th><th>F Sg.</th><th>N Sg.</th><th>M Pl.</th><th>F Pl.</th><th>N Pl.</th></tr></thead><tbody>`;
      CASES.forEach(c=>{
        html+=`<tr><td class="case-cell">${CASE_NAMES[c]}</td>`;
        GENDERS.forEach(g=>{ html+=`<td>${t.de_sg?.[g]?.[c]||'–'}</td>`; });
        GENDERS.forEach(g=>{ html+=`<td>${t.de_pl?.[g]?.[c]||'–'}</td>`; });
        html+=`</tr>`;
      });
      html+=`</tbody></table></div>`;
    }
    return html;
  },

  _renderVokabelTable(t) {
    const rows = t.rows||[];
    let html = `<div class="table-desc">${t.desc||''}</div>`;
    html += `<div class="dekl-table-wrap"><table class="dekl-table vok-table"><thead><tr><th>Latein</th><th>Übersetzung</th><th>Genus</th><th>Dekl.</th><th>1. Fall</th><th>2. Fall</th></tr></thead><tbody>`;
    rows.forEach(r => {
      const _de = (r.de||'–').split('%').join(' / '); html += `<tr><td><strong>${r.lat||'–'}</strong></td><td>${r.fall1||'–'}</td><td>${r.fall2||'–'}</td><td>${r.genus||'–'}</td><td>${r.dekl||'–'}</td><td>${_de}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    return html;
  },

  // ── Delete tables ─────────────────────────────────────────
  confirmDelete(id, type) {
    const arr=type==='pronomen'?state.pronomen:state.vokabel;
    const t=arr.find(x=>x.id===id); if(!t)return;
    state.actionId=id; state.actionType=type; state.actionIsDraft=false;
    document.getElementById('table-action-title').textContent=t.name;
    document.getElementById('table-action-desc').textContent=t.desc||'';
    document.getElementById('table-action-overlay').classList.remove('hidden');
  },
  closeAction(e) { if(e&&e.target!==document.getElementById('table-action-overlay'))return; document.getElementById('table-action-overlay').classList.add('hidden'); },
  editFromAction() {
    const id=state.actionId, type=state.actionType, isDraft=state.actionIsDraft;
    document.getElementById('table-action-overlay').classList.add('hidden');
    if(type==='pronomen') this.openPronomenEditor(id, isDraft?'draft':null);
    else this.openVokabelEditor(id, isDraft?'draft':null);
  },
  async deleteFromAction() {
    const id=state.actionId, type=state.actionType, isDraft=state.actionIsDraft;
    document.getElementById('table-action-overlay').classList.add('hidden');
    const col = isDraft
      ? (type==='pronomen'?COL.pronomenDrafts:COL.vokabelDrafts)
      : (type==='pronomen'?COL.pronomen:COL.vokabel);
    try { await col.doc(id).delete(); } catch(e){ alert('Fehler: '+e.message); }
  },

  async publishTableDraft(id, type, btn) {
    const arr = type==='pronomen' ? state.pronomenDrafts : state.vokabelDrafts;
    const draft = arr.find(x=>x.id===id); if(!draft)return;
    if(btn){btn.textContent='…';btn.disabled=true;}
    const pubId = (type==='pronomen'?'pt_':'vt_') + Date.now();
    const pubCol = type==='pronomen' ? COL.pronomen : COL.vokabel;
    const draftCol = type==='pronomen' ? COL.pronomenDrafts : COL.vokabelDrafts;
    try {
      await pubCol.doc(pubId).set({...draft, id:pubId, order:Date.now()});
      await draftCol.doc(id).delete();
    } catch(e){ alert('Fehler: '+e.message); if(btn){btn.textContent='Veröffentlichen';btn.disabled=false;} }
  },

  async deleteTableDraft(id, type) {
    if(!confirm('Entwurf löschen?'))return;
    const col = type==='pronomen' ? COL.pronomenDrafts : COL.vokabelDrafts;
    try { await col.doc(id).delete(); } catch(e){ alert('Fehler: '+e.message); }
  },

  // ── Pronomen Editor ───────────────────────────────────────
  openPronomenEditor(id, source) {
    const isNew=!id;
    const isDraft = source==='draft';
    document.getElementById('pronomen-editor-title').textContent=isNew?'Neue Pronomen-Tabelle':'Pronomen-Tabelle bearbeiten';
    document.getElementById('pt-error').classList.add('hidden');
    state.editingId=id||null; state.editingSource=isDraft?'pronomen-draft':'pronomen';
    if(isNew){ App._clearQuizForm('pt-'); }
    else {
      const arr = isDraft ? state.pronomenDrafts : state.pronomen;
      const t=arr.find(x=>x.id===id);
      if(t) App._fillQuizForm('pt-',t); else App._clearQuizForm('pt-');
    }
    App.showPage('pronomen-editor', isNew?'Neue Tabelle':'Bearbeiten');
  },

  async savePronomenDraft() {
    const data=App._readQuizForm('pt-');
    if(!App._validateQuiz(data,'pt-error',false)){return;}
    document.getElementById('pt-error').classList.add('hidden');
    const btn=document.getElementById('pt-draft-btn'); btn.textContent='…'; btn.disabled=true;
    const isEdit = state.editingSource==='pronomen-draft' && state.editingId;
    const docId = isEdit ? state.editingId : 'ptd_'+Date.now();
    try {
      await COL.pronomenDrafts.doc(docId).set({id:docId,order:Date.now(),...data});
      App.goHome(); setTimeout(()=>App.switchTab('tables'),100);
    } catch(e){ document.getElementById('pt-error').textContent='Fehler: '+e.message; document.getElementById('pt-error').classList.remove('hidden'); }
    finally { btn.textContent='Als Entwurf speichern'; btn.disabled=false; }
  },

  async savePronomen() {
    const data=App._readQuizForm('pt-');
    if(!App._validateQuiz(data,'pt-error',false)){return;}
    document.getElementById('pt-error').classList.add('hidden');
    const btn=document.getElementById('pt-save-btn'); btn.textContent='…'; btn.disabled=true;
    const isEdit = state.editingSource==='pronomen' && state.editingId;
    const isDraftEdit = state.editingSource==='pronomen-draft' && state.editingId;
    const docId = isEdit ? state.editingId : 'pt_'+Date.now();
    try {
      await COL.pronomen.doc(docId).set({id:docId,order:Date.now(),...data});
      if(isDraftEdit) await COL.pronomenDrafts.doc(state.editingId).delete();
      App.goHome(); setTimeout(()=>App.switchTab('tables'),100);
    } catch(e){ document.getElementById('pt-error').textContent='Fehler: '+e.message; document.getElementById('pt-error').classList.remove('hidden'); }
    finally { btn.textContent='Veröffentlichen'; btn.disabled=false; }
  },

  _fillPronomenFromQuiz(q) {
    document.getElementById('pt-name').value=q.name||'';
    document.getElementById('pt-desc').value=q.desc||'';
    App._fillQuizForm('pt-',q);
  },

  // ── Vokabel Editor ────────────────────────────────────────
  buildVokabelRow_template() {}, // placeholder, rows built dynamically

  _vokEditorMode: 'form', // 'form' | 'text'

  openVokabelEditor(id, source) {
    const isNew = !id;
    const isDraft = source==='draft';
    document.getElementById('vokabel-editor-title').textContent = isNew ? 'Neue Vokabel-Tabelle' : 'Vokabel-Tabelle bearbeiten';
    document.getElementById('vt-error').classList.add('hidden');
    state.editingId = id || null;
    state.editingSource = isDraft ? 'vokabel-draft' : 'vokabel';
    this._vokEditorMode = 'form';
    document.getElementById('vt-name').value = '';
    document.getElementById('vt-desc').value = '';
    document.getElementById('vok-mode-form-btn').classList.add('active');
    document.getElementById('vok-mode-text-btn').classList.remove('active');
    document.getElementById('vok-form-view').classList.remove('hidden');
    document.getElementById('vok-text-view').classList.add('hidden');

    const rowsEl = document.getElementById('vokabel-rows');
    rowsEl.innerHTML = '';
    if (isNew) {
      this.addVokabelRow(); this.addVokabelRow(); this.addVokabelRow();
    } else {
      const t = state.vokabel.find(x => x.id === id);
      if (t) {
        document.getElementById('vt-name').value = t.name || '';
        document.getElementById('vt-desc').value = t.desc || '';
        (t.rows || []).forEach(r => this.addVokabelRow(r));
        if (!t.rows?.length) this.addVokabelRow();
      } else { this.addVokabelRow(); }
    }
    App.showPage('vokabel-editor', isNew ? 'Neue Vokabeln' : 'Vokabeln bearbeiten');
  },

  switchVokMode(mode) {
    if (mode === this._vokEditorMode) return;
    if (mode === 'text') {
      // form → text: serialize rows to text
      const rows = this._readFormRows();
      const lines = rows.map((r,i) => {
        const lat   = r.lat   || '#';
        const fall2 = r.fall2 || '#';
        const genus = r.genus && r.genus !== '–' ? r.genus : '#';
        const dekl  = r.dekl  && r.dekl  !== '–' ? r.dekl  : '#';
        const de    = r.de    || '#';
        return `${i+1}. ${lat}-${fall2}-${genus}-${dekl}-${de}`;
      });
      document.getElementById('vok-textarea').value = lines.join('\n');
    } else {
      // text → form: parse text to rows
      const rows = this._parseTextRows(document.getElementById('vok-textarea').value);
      const rowsEl = document.getElementById('vokabel-rows');
      rowsEl.innerHTML = '';
      if (rows.length) rows.forEach(r => this.addVokabelRow(r));
      else { this.addVokabelRow(); }
    }
    this._vokEditorMode = mode;
    document.getElementById('vok-mode-form-btn').classList.toggle('active', mode === 'form');
    document.getElementById('vok-mode-text-btn').classList.toggle('active', mode === 'text');
    document.getElementById('vok-form-view').classList.toggle('hidden', mode !== 'form');
    document.getElementById('vok-text-view').classList.toggle('hidden', mode !== 'text');
  },

  _readFormRows() {
    return [...document.querySelectorAll('.vokabel-row')].map(r => ({
      lat:   r.querySelector('.vok-lat').value.trim(),
      fall2: r.querySelector('.vok-fall2').value.trim(),
      genus: r.querySelector('.vok-genus').value,
      dekl:  r.querySelector('.vok-dekl').value,
      de:    r.querySelector('.vok-de').value.trim()
    })).filter(r => r.lat || r.de);
  },

  _parseTextRows(text) {
    // Format: "1. Latein-fall2-genus-dekl-deutsch" – # = empty
    const rows = [];
    text.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;
      // Remove leading "1. " numbering if present
      const cleaned = line.replace(/^\d+\.\s*/, '');
      const parts = cleaned.split('-');
      if (parts.length < 1) return;
      const get = (i) => { const v = (parts[i]||'').trim(); return v === '#' ? '' : v; };
      rows.push({
        lat:   get(0),
        fall2: get(1),
        genus: get(2) || '–',
        dekl:  get(3) || '–',
        de:    parts.slice(4).join('-').trim().replace(/^#$/, '') // de can contain hyphens
      });
    });
    return rows;
  },

  addVokabelRow(data = {}) {
    const wrap = document.getElementById('vokabel-rows');
    const row  = document.createElement('div');
    row.className = 'vokabel-row';
    // Field order: Latein | 2. Fall | Genus | Dekl | Deutsch | ✕
    row.innerHTML = `
      <div class="vok-row-grid">
        <div class="vok-cell">
          <label class="vok-label">Latein</label>
          <input type="text" class="modal-input vok-lat" placeholder="z.B. aqua" value="${escHtml(data.lat||'')}"/>
        </div>
        <div class="vok-cell">
          <label class="vok-label">2. Fall</label>
          <input type="text" class="modal-input vok-fall2" placeholder="z.B. aquae" value="${escHtml(data.fall2||'')}"/>
        </div>
        <div class="vok-cell vok-cell-sm">
          <label class="vok-label">Genus</label>
          <select class="modal-input vok-genus">
            ${GENUS_OPTS.map(o=>`<option${(data.genus||'–')===o?' selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="vok-cell vok-cell-sm">
          <label class="vok-label">Deklination</label>
          <select class="modal-input vok-dekl">
            ${DEKL_OPTS.map(o=>`<option${(data.dekl||'–')===o?' selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="vok-cell">
          <label class="vok-label">Deutsch</label>
          <input type="text" class="modal-input vok-de" placeholder="Übersetzung" value="${escHtml(data.de||'')}"/>
        </div>
        <div class="vok-cell vok-cell-del">
          <label class="vok-label">&nbsp;</label>
          <button class="row-del-btn" onclick="this.closest('.vokabel-row').remove()" title="Löschen">✕</button>
        </div>
      </div>`;
    wrap.appendChild(row);
  },

  // ── AI Prompt & Import ───────────────────────────────────
  copyAiPrompt(btn) {
    const prompt = `Du bekommst einen Screenshot einer lateinischen Vokabelliste. Extrahiere alle Vokabeln und gib sie ausschließlich im folgenden Format aus – eine Vokabel pro Zeile, kein erklärender Text davor oder danach:

Format pro Zeile: Latein-2.Fall-Genus-Deklination-Deutsch
- Nicht ausgefüllte oder unbekannte Felder als # angeben
- Genus immer als m., f. oder n.
- Deklination immer als 1. Dekl., 2. Dekl., 3. Dekl., 4. Dekl. oder 5. Dekl.
- Mehrere Übersetzungen mit % trennen (NICHT mit /)
- Optionale Teile einer Übersetzung in Klammern: (er%sie%es) geht → wird automatisch expandiert
- Keine Leerzeichen um die - Trennzeichen

Beispiele:
aqua-aquae-f.-1. Dekl.-Wasser%Flüssigkeit
servus-servi-m.-2. Dekl.-Sklave%Diener
corpus-corporis-n.-3. Dekl.-Körper%Leib
manus-manus-f.-4. Dekl.-Hand%Schar
res-rei-f.-5. Dekl.-Sache%Ding
eo-#-#-#-(er%sie%es) geht
nomen-#-n.-#-Name
urbs-urbis-f.-3. Dekl.-Stadt

Gib jetzt alle Vokabeln aus dem Screenshot in diesem Format aus. Nur die Zeilen ausgeben, nichts anderes.`;
    navigator.clipboard.writeText(prompt).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Kopiert!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(() => {
      prompt && window.prompt('Prompt kopieren:', prompt);
    });
  },

  importTextVokabeln() {
    const raw = document.getElementById('vok-textarea').value;
    const rows = this._parseTextRows(raw);
    if (!rows.length) {
      alert('Keine gültigen Zeilen gefunden.\nFormat: Latein-2.Fall-Genus-Deklination-Deutsch\nLeere Felder als # angeben.');
      return;
    }
    // Clear existing form rows and fill with parsed data
    document.getElementById('vokabel-rows').innerHTML = '';
    rows.forEach(r => this.addVokabelRow(r));
    // Switch to form view
    this.switchVokMode('form');
    document.getElementById('vok-textarea').value = '';
  },

  _parseTextRows(text) {
    const rows = [];
    text.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('//') || line.startsWith('#')) return;
      const parts = line.split('-');
      if (parts.length < 2) return;
      const clean = v => (v && v.trim() && v.trim() !== '#') ? v.trim() : '';
      const deRaw = parts.slice(4).join('-').trim(); // de can contain hyphens
      const de = clean(deRaw) ? expandBrackets(clean(deRaw)) : '';
      rows.push({
        lat:   clean(parts[0]),
        fall2: clean(parts[1]),
        genus: clean(parts[2]),
        dekl:  clean(parts[3]),
        de,
        fall1: ''
      });
    });
    return rows.filter(r => r.lat);
  },

  copyAiPrompt() {
    const text = document.getElementById('ai-prompt-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('ai-copy-btn');
      btn.textContent = 'Kopiert ✓'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Kopieren'; btn.classList.remove('copied'); }, 2000);
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      const btn = document.getElementById('ai-copy-btn');
      btn.textContent = 'Kopiert ✓'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Kopieren'; btn.classList.remove('copied'); }, 2000);
    });
  },

  async saveVokabel() {
    const name = document.getElementById('vt-name').value.trim();
    const desc = document.getElementById('vt-desc').value.trim();
    const err  = document.getElementById('vt-error');
    if (!name) { err.textContent='Bitte gib einen Namen ein.'; err.classList.remove('hidden'); return; }

    let rows;
    if (this._vokEditorMode === 'text') {
      rows = this._parseTextRows(document.getElementById('vok-textarea').value);
    } else {
      rows = this._readFormRows();
    }
    if (!rows.length) { err.textContent='Bitte füge mindestens eine Vokabel hinzu.'; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');

    const btn = document.getElementById('vt-save-btn');
    btn.textContent='…'; btn.disabled=true;
    const docId = state.editingId || 'vt_'+Date.now();
    try {
      await COL.vokabel.doc(docId).set({id:docId, order:Date.now(), name, desc, rows});
      App.goHome();
      setTimeout(()=>App.switchTab('tables'),100);
    } catch(e) { err.textContent='Fehler: '+e.message; err.classList.remove('hidden'); }
    finally { btn.textContent='Speichern'; btn.disabled=false; }
  }
};

// ── Quiz Engine ──────────────────────────────────────────────
const Quiz = {
  questions:[], idx:0, score:0, answered:false,
  start(quiz,phases,shuffle){
    this.questions=this.build(quiz,phases,shuffle);
    this.idx=0;this.score=0;this.answered=false;
    App.showPage('quiz',quiz.name); this.render();
  },
  build(q,phases,shuffle){
    let qs=[];
    const push=(list,shuf)=>{qs=[...qs,...(shuf?list.sort(()=>Math.random()-.5):list)];};
    if(phases.includes(1)) push(GENDERS.flatMap(g=>CASES.map(c=>({phase:1,meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,main:'Lateinische Form?',placeholder:'Latein eingeben…',answer:q.sg[g][c]||'',answerDisplay:q.sg[g][c]||''}))),shuffle);
    if(phases.includes(2)) push(GENDERS.flatMap(g=>CASES.map(c=>({phase:2,meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,main:'Lateinische Form?',placeholder:'Latein eingeben…',answer:q.pl[g][c]||'',answerDisplay:q.pl[g][c]||''}))),shuffle);
    if(phases.includes(3)){
      const p=GENDERS.flatMap(g=>CASES.map(c=>{const sg=Math.random()>.5,form=sg?q.sg[g][c]:q.pl[g][c];return{phase:3,meta:`${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  ${sg?'Singular':'Plural'}`,main:'Lateinische Form?',placeholder:'Latein eingeben…',answer:form||'',answerDisplay:form||''};}));
      qs=[...qs,...p.sort(()=>Math.random()-.5)];
    }
    if(phases.includes(4)){
      let p=GENDERS.flatMap(g=>CASES.flatMap(c=>[
        {phase:4,meta:`Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,main:q.de_sg[g][c]||'?',placeholder:'Latein eingeben…',answer:q.sg[g][c]||'',answerDisplay:q.sg[g][c]||''},
        {phase:4,meta:`Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,main:q.de_pl[g][c]||'?',placeholder:'Latein eingeben…',answer:q.pl[g][c]||'',answerDisplay:q.pl[g][c]||''}
      ])).sort(()=>Math.random()-.5);
      qs=[...qs,...(shuffle?p:p.slice(0,20))];
    }
    if(phases.includes(5)){
      let p=GENDERS.flatMap(g=>CASES.flatMap(c=>[
        {phase:5,meta:`Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,main:q.sg[g][c]||'?',placeholder:'Deutsch eingeben…',answer:q.de_sg[g][c]||'',answerDisplay:q.de_sg[g][c]||''},
        {phase:5,meta:`Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,main:q.pl[g][c]||'?',placeholder:'Deutsch eingeben…',answer:q.de_pl[g][c]||'',answerDisplay:q.de_pl[g][c]||''}
      ])).sort(()=>Math.random()-.5);
      qs=[...qs,...(shuffle?p:p.slice(0,20))];
    }
    return qs;
  },
  render(){
    const q=this.questions[this.idx],total=this.questions.length;
    const labels={1:'Phase 1 – Singular',2:'Phase 2 – Plural',3:'Phase 3 – Gemischt',4:'Phase 4 – Deutsch → Latein',5:'Phase 5 – Latein → Deutsch'};
    document.getElementById('quiz-phase-badge').textContent=labels[q.phase]||'';
    document.getElementById('quiz-progress-text').textContent=`${this.idx+1} / ${total}`;
    document.getElementById('progress-bar').style.width=(this.idx/total*100)+'%';
    document.getElementById('q-meta').textContent=q.meta;
    document.getElementById('q-main').textContent=q.main;
    const inp=document.getElementById('answer-input');
    inp.placeholder=q.placeholder||'';inp.value='';inp.disabled=false;inp.focus();
    document.getElementById('feedback-box').className='feedback-box hidden';
    document.getElementById('next-btn').classList.add('hidden');
    this.answered=false;
  },
  check(){
    if(this.answered)return;
    const inp=document.getElementById('answer-input'),val=inp.value.trim();if(!val)return;
    this.answered=true;inp.disabled=true;
    const q=this.questions[this.idx],fb=document.getElementById('feedback-box');
    if(isCorrect(val,q.answer)){this.score++;fb.textContent='✓ Richtig!';fb.className='feedback-box correct';}
    else{const acc=parseAnswers(q.answer);fb.textContent=`✗ Falsch. Richtig: ${acc.length>1?acc.join(' / '):q.answerDisplay}`;fb.className='feedback-box wrong';}
    document.getElementById('progress-bar').style.width=((this.idx+1)/this.questions.length*100)+'%';
    document.getElementById('next-btn').classList.remove('hidden');
  },
  next(){this.idx++;if(this.idx>=this.questions.length)this.showResult();else this.render();},
  showResult(){
    const total=this.questions.length,pct=Math.round(this.score/total*100);
    document.getElementById('result-score').textContent=`${this.score}/${total}`;
    const t=[[100,'Perfekt! Absolut fehlerfrei.','🏆'],[80,'Sehr gut! Fast alles richtig.','🏛️'],[60,'Gut! Noch etwas üben.','📜'],[40,'Es geht. Mehr Übung hilft!','⚡'],[0,'Weiter üben – du schaffst das!','🌿']];
    const [,msg,icon]=t.find(([x])=>pct>=x);
    document.getElementById('result-icon').textContent=icon;
    document.getElementById('result-msg').textContent=msg;
    App.showPage('result');
  }
};

// ── Keyboard ─────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  if(document.getElementById('page-quiz').classList.contains('active')){if(!Quiz.answered)Quiz.check();else Quiz.next();return;}
  if(!document.getElementById('login-overlay').classList.contains('hidden'))App.adminLogin();
});

// ── Export globals for onclick handlers ──────────────────────
window.App    = App;
window.Tables = Tables;
window.Quiz   = Quiz;

App.init();
