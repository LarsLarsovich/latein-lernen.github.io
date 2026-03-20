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
  if (!str || !str.includes('(')) return str;
  // Split on top-level % only (not inside brackets), then expand (a%b%c) suffix
  function splitTopLevel(s) {
    const parts = []; let depth = 0, cur = '';
    for (const c of s) {
      if (c === '(') { depth++; cur += c; }
      else if (c === ')') { depth--; cur += c; }
      else if (c === '%' && depth === 0) { parts.push(cur); cur = ''; }
      else { cur += c; }
    }
    parts.push(cur);
    return parts;
  }
  const expanded = [];
  splitTopLevel(str).forEach(seg => {
    seg = seg.trim();
    const m = seg.match(/^\(([^)]+)\)\s*(.*)$/);
    if (m) {
      const opts = m[1].split('%').map(s => s.trim());
      const suffix = m[2].trim();
      opts.forEach(o => expanded.push(suffix ? o + ' ' + suffix : o));
    } else { expanded.push(seg); }
  });
  return expanded.filter(Boolean).join('%');
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

    // Vokabel tables - sorted alphabetically
    const vg = document.getElementById('vokabel-grid');
    const ve = document.getElementById('vokabel-empty');
    vg.innerHTML = '';
    const sortedVok = [...state.vokabel].sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true,sensitivity:'base'}));
    if (!sortedVok.length) { ve.style.display='block'; }
    else { ve.style.display='none'; sortedVok.forEach(t=>vg.appendChild(this._makeTableCard(t,'vokabel'))); }
    // Update alle-vokabeln count
    const alleCount = sortedVok.reduce((s,t)=>(t.rows?.length||0)+s,0);
    const alleEl = document.getElementById('alle-vok-count');
    if (alleEl) alleEl.textContent = alleCount + ' Vokabeln aus ' + sortedVok.length + ' Listen';
  },

  _makeDraftCard(q) {
    const card = document.createElement('div');
    card.className = 'quiz-card admin-mode-click draft-card';
    card.innerHTML = `
      <div class="draft-pill">Entwurf</div>
      <div class="quiz-card-name">${q.name}</div>
      <div class="quiz-card-desc">${q.desc||''}</div>
    `;
    card.onclick = () => App.showDraftActions(q.id);
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
  },

  openAlleVokabeln() {
    VokSearch.openAlleVokabeln();
  }
};

function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Tables ───────────────────────────────────────────────────
const Tables = {

  // ── View ─────────────────────────────────────────────────
  viewTable(id, type, isDraft) {
    state.tableViewId=id; state.tableViewType=type;
    const arr = isDraft
      ? (type==='pronomen' ? state.pronomenDrafts : state.vokabelDrafts)
      : (type==='pronomen' ? state.pronomen : state.vokabel);
    const t = arr.find(x=>x.id===id);
    if(!t)return;
    document.getElementById('table-view-title').textContent=t.name;
    document.getElementById('table-view-admin-btns').classList.toggle('hidden',!state.adminLoggedIn);

    // Show search bar only for vokabel tables (not for admins in edit mode? no – show for all)
    const searchWrap = document.getElementById('table-view-search');
    if (type === 'vokabel') {
      searchWrap.classList.remove('hidden');
      document.getElementById('table-search-input').value = '';
      document.getElementById('table-filter-genus').value = '';
      document.getElementById('table-filter-dekl').value = '';
      VokSearch.initTableSearch(id, t.rows || []);
    } else {
      searchWrap.classList.add('hidden');
    }

    const contentEl = document.getElementById('table-view-content');
    contentEl.innerHTML = type==='pronomen' ? this._renderPronomenTable(t) : this._renderVokabelTable(t);
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
    html += `<div class="dekl-table-wrap"><table class="dekl-table vok-table"><thead><tr><th>Latein</th><th>2. Fall</th><th>Genus</th><th>Dekl.</th><th>Übersetzung</th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      const _de = (r.de||'–').split('%').join(' / ');
      html += `<tr class="vok-row-clickable" onclick="VokDetail.open(${i},'${t.id}')">
        <td><strong>${r.lat||'–'}</strong></td>
        <td>${r.fall2||'–'}</td>
        <td>${r.genus||'–'}</td>
        <td>${r.dekl||'–'}</td>
        <td>${_de}</td>
        <td class="vok-row-arrow">›</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    html += `<div class="vok-table-hint">Auf ein Wort tippen für Details &amp; Deklination/Konjugation</div>`;
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

  openAlleVokabeln() {
    VokSearch.openAlleVokabeln();
  },

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
    const rows = [];
    // Pre-process: if everything is on one line, split on word boundaries
    // A new entry looks like: word- or word-word- etc.
    // Split before a sequence like "word-" that follows a space
    // but only if it's not inside brackets
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    // If there are no newlines, try to split on entry boundaries:
    // An entry starts with a Latin word (letters only) followed by -
    const lines = normalized.includes('\n')
      ? normalized.split('\n')
      : normalized.split(/(?<=\S)\s+(?=[a-zA-ZäöüÄÖÜ][a-zA-ZäöüÄÖÜ]*-)/);

    lines.forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('//')) return;

      // Strip leading numbering like "1. " or "1) "
      line = line.replace(/^\d+[.)\s]+/, '');

      // Split on - but NOT on - inside brackets like (er lacht-#)
      // Strategy: temporarily protect brackets content
      const bracketMap = {};
      let bi = 0;
      const protected_ = line.replace(/\([^)]+\)/g, match => {
        const key = `__B${bi++}__`;
        bracketMap[key] = match;
        return key;
      });

      const parts = protected_.split('-');
      if (parts.length < 1) return;

      // Restore brackets
      const restore = s => {
        let r = s;
        Object.entries(bracketMap).forEach(([k,v]) => { r = r.split(k).join(v); });
        return r;
      };

      const clean = v => {
        if (!v) return '';
        const s = restore(v).trim();
        return (s && s !== '#') ? s : '';
      };

      // German translation: everything from index 4 onwards, rejoined with -
      const deRaw = parts.slice(4).map(restore).join('-').trim();
      // Normalize: replace " / " with %, strip stray /
      const deNorm = deRaw === '#' ? '' : deRaw
        .replace(/\s*\/\s*/g, '%')   // " / " → "%"
        .replace(/\s*,\s*/g, '%');    // ", " → "%"
      const de = deNorm ? expandBrackets(deNorm) : '';

      rows.push({
        lat:   clean(parts[0]),
        fall2: clean(parts[1]),
        genus: clean(parts[2]) || '–',
        dekl:  clean(parts[3]) || '–',
        de,
      });
    });
    return rows.filter(r => r.lat);
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
    const prompt = `You are a Latin vocabulary extractor. You will receive either a screenshot of a Latin vocabulary list OR pasted text. Extract every vocabulary entry in EXACTLY this format — one entry per line, nothing else:

Latin-SecondField-Gender-Declension-GermanTranslation

WHAT TO PUT IN EACH FIELD:

Field 1 - Latin word:
- Nouns: Nominative singular (e.g. aqua)
- Adjectives: ALL three gender forms: bonus/a/um or magnus/a/um
- Verbs: ALWAYS the INFINITIVE (e.g. clamare, ridere, laborare) — NEVER the conjugated form
- Other (adverb, conjunction, particle): the word as-is

Field 2 - Second field:
- Nouns: Genitive singular (e.g. aquae, servi, corporis)
- Adjectives: #
- Verbs: 1st person singular present (e.g. clamo, rideo, laboro)
- Other: #

Field 3 - Gender:
- Nouns: exactly m., f., or n.
- Everything else: #

Field 4 - Declension:
- Nouns: exactly 1. Dekl., 2. Dekl., 3. Dekl., 4. Dekl., or 5. Dekl.
- Everything else: #

Field 5 - German translation:
- Separate multiple translations with % (NEVER use / or commas)
- Verb translations: use bracket notation with % inside: (ich rufe%er ruft%sie ruft%es ruft)
- Adjectives: just the base meaning (e.g. gut, gross, schlecht)

STRICT RULES:
1. Use # for any field that is not applicable
2. NO spaces around the - separators
3. NO line numbers, NO headers, NO explanations — only the data lines
4. Each word gets exactly ONE line
5. Do NOT merge or concatenate words

EXAMPLES:
aqua-aquae-f.-1. Dekl.-Wasser%Flussigkeit
bonus/a/um-#-#-#-gut
magnus/a/um-#-#-#-gross
clamare-clamo-#-#-(ich rufe%er ruft%sie ruft%es ruft)
ridere-rideo-#-#-(ich lache%er lacht%sie lacht%es lacht)
laborare-laboro-#-#-(ich arbeite%er arbeitet%sie arbeitet%es arbeitet)
cur-#-#-#-warum
nunc-#-#-#-jetzt%nun
non-#-#-#-nicht
pensum-pensi-n.-2. Dekl.-Aufgabe
servus-servi-m.-2. Dekl.-Sklave%Diener

Now extract all vocabulary from the provided screenshot or text.`;
    navigator.clipboard.writeText(prompt).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Kopiert!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(() => {
      window.prompt('Prompt kopieren:', prompt);
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



// ── Vokabel Search Engine ─────────────────────────────────────

const VokSearch = {
  _currentTableId: null,
  _currentTableRows: [],

  // Generate all forms for a row for fuzzy matching
  _allForms(r) {
    const forms = new Set();
    const add = s => { if (s && s !== '#' && s !== '–') forms.add(s.toLowerCase()); };

    add(r.lat); add(r.fall2); add(r.de);
    // Add all % variants of translation
    if (r.de) r.de.split('%').forEach(d => add(d.trim()));

    const type = Latin.detectType(r);
    if (type === 'verb') {
      const conj = Latin.conjugateVerb(r.lat||'', r.fall2||'');
      if (conj) conj.forms.forEach(([,f]) => add(f));
    } else if (type === 'noun' && r.fall2 && r.fall2 !== '#' && r.fall2 !== '–') {
      const res = Latin.declineNoun(r.lat||'', r.fall2||'', r.genus||'');
      if (res) { res.sg.forEach(f=>add(f)); res.pl.forEach(f=>add(f)); }
    } else if (type === 'adj') {
      const res = Latin.declineAdj(r.lat||'');
      if (res) {
        ['m_sg','f_sg','n_sg','m_pl','f_pl','n_pl'].forEach(k=>res[k]?.forEach(f=>add(f)));
      }
    }
    return forms;
  },

  _matches(r, query, genus, dekl) {
    if (genus && (r.genus||'') !== genus) return false;
    if (dekl  && (r.dekl ||'') !== dekl)  return false;
    if (!query) return true;
    const q = query.toLowerCase().trim();
    return this._allForms(r).has(q) ||
      [...this._allForms(r)].some(f => f.includes(q));
  },

  _renderRows(rows, tableId, showSource, fromAlle) {
    if (!rows.length) return '<div class="empty-hint">Keine Vokabeln gefunden.</div>';
    let html = '<div class="dekl-table-wrap"><table class="dekl-table vok-table"><thead><tr>';
    html += '<th>Latein</th><th>2. Fall</th><th>Genus</th><th>Dekl.</th><th>Übersetzung</th>';
    if (showSource) html += '<th>Liste</th>';
    html += '</tr></thead><tbody>';
    rows.forEach(({r, idx, tid, tname}) => {
      const de = (r.de||'–').split('%').join(' / ');
      const clickId = tid || tableId;
      const alleParam = fromAlle ? ',true' : '';
      html += `<tr class="vok-row-clickable" onclick="VokDetail.open(${idx},'${clickId}'${alleParam})">
        <td><strong>${r.lat||'–'}</strong></td>
        <td>${r.fall2||'–'}</td><td>${r.genus||'–'}</td><td>${r.dekl||'–'}</td>
        <td>${de}</td>`;
      if (showSource) html += `<td style="font-size:11px;color:var(--text3);">${tname||''}</td>`;
      html += `<td class="vok-row-arrow">›</td></tr>`;
    });
    html += '</tbody></table></div>';
    return html;
  },

  // ── Alle Vokabeln ──────────────────────────────────────────
  _sortMode: 'lat', // 'lat' or 'de'

  openAlleVokabeln() {
    this._sortMode = 'lat';
    document.getElementById('alle-search-input').value = '';
    document.getElementById('filter-genus').value = '';
    document.getElementById('filter-dekl').value = '';
    this._updateSortBtns();
    this._renderAlleResults('', '', '');
    App.showPage('alle-vokabeln', 'Alle Vokabeln');
  },

  setSortMode(mode) {
    this._sortMode = mode;
    this._updateSortBtns();
    this.search();
  },

  _updateSortBtns() {
    const btnLat = document.getElementById('sort-btn-lat');
    const btnDe  = document.getElementById('sort-btn-de');
    if (btnLat) btnLat.classList.toggle('active', this._sortMode === 'lat');
    if (btnDe)  btnDe.classList.toggle('active',  this._sortMode === 'de');
  },

  search() {
    const q     = document.getElementById('alle-search-input').value;
    const genus = document.getElementById('filter-genus').value;
    const dekl  = document.getElementById('filter-dekl').value;
    this._renderAlleResults(q, genus, dekl);
  },

  _renderAlleResults(q, genus, dekl) {
    const tables = [...state.vokabel].sort((a,b) =>
      a.name.localeCompare(b.name, 'de', {numeric:true, sensitivity:'base'})
    );
    const matched = [];
    tables.forEach(t => {
      (t.rows||[]).forEach((r, idx) => {
        if (this._matches(r, q, genus, dekl)) {
          matched.push({ r, idx, tid: t.id, tname: t.name });
        }
      });
    });
    // Sort results
    if (this._sortMode === 'lat') {
      matched.sort((a,b) => (a.r.lat||'').localeCompare(b.r.lat||'', 'de', {sensitivity:'base'}));
    } else {
      matched.sort((a,b) => (a.r.de||'').localeCompare(b.r.de||'', 'de', {sensitivity:'base'}));
    }
    document.getElementById('alle-count-badge').textContent = matched.length + ' Vokabeln';
    document.getElementById('alle-vok-results').innerHTML = this._renderRows(matched, null, true, true);
  },

  // ── Table-specific search ──────────────────────────────────
  initTableSearch(tableId, rows) {
    this._currentTableId = tableId;
    this._currentTableRows = rows;
  },

  searchTable() {
    const q     = document.getElementById('table-search-input').value;
    const genus = document.getElementById('table-filter-genus').value;
    const dekl  = document.getElementById('table-filter-dekl').value;
    const matched = this._currentTableRows
      .map((r, idx) => ({ r, idx, tid: this._currentTableId }))
      .filter(({r}) => this._matches(r, q, genus, dekl));
    document.getElementById('table-view-content').innerHTML =
      this._renderRows(matched, this._currentTableId, false);
  }
};


// ── German Grammar Engine ────────────────────────────────────

const German = {

  // Conjugate a German verb in Präsens
  // Input: translation like "gehen", "machen", or "er geht" → extract infinitive
  conjugateVerb(de) {
    if (!de) return null;
    // Extract infinitive: if "er/sie/es X" → take X, then derive infinitive
    // Try to get a clean base verb
    let base = de.toLowerCase()
      .replace(/^(ich|du|er|sie|es|wir|ihr)\s+/, '')
      .trim();

    // Common irregulars
    const irregulars = {
      'sein':  ['bin','bist','ist','sind','seid','sind'],
      'haben': ['habe','hast','hat','haben','habt','haben'],
      'werden':['werde','wirst','wird','werden','werdet','werden'],
      'gehen': ['gehe','gehst','geht','gehen','geht','gehen'],
      'kommen':['komme','kommst','kommt','kommen','kommt','kommen'],
      'geben': ['gebe','gibst','gibt','geben','gebt','geben'],
      'stehen':['stehe','stehst','steht','stehen','steht','stehen'],
      'sehen': ['sehe','siehst','sieht','sehen','seht','sehen'],
      'wissen':['weiß','weißt','weiß','wissen','wisst','wissen'],
    };

    // Try to find infinitive: if base ends in conjugated form, try to get stem
    // Most weak verbs: infinitive = stem + en
    // Try matching base against known verb patterns
    let inf = base;
    if (!inf.endsWith('en') && !inf.endsWith('ern') && !inf.endsWith('eln')) {
      // Likely a conjugated form – try to add 'en'
      if (inf.endsWith('t')) inf = inf.slice(0,-1) + 'en';
      else if (inf.endsWith('e')) inf = inf + 'n';
      else inf = inf + 'en';
    }

    if (irregulars[inf]) return irregulars[inf];

    // Regular weak verb: stem = infinitive minus -en
    const stem = inf.endsWith('eln') ? inf.slice(0,-2)
               : inf.endsWith('ern') ? inf.slice(0,-2)
               : inf.endsWith('en')  ? inf.slice(0,-2)
               : inf;

    // Handle stems ending in -t, -d, -fn, -gn, -chn (insert e)
    const needsE = /[td]$/.test(stem) || /[^aeiou][nm]$/.test(stem);
    const s2 = needsE ? stem + 'e' : stem;

    return [
      stem  + 'e',      // ich
      s2    + 'st',     // du
      s2    + 't',      // er/sie/es
      inf.endsWith('eln') ? stem + 'ln' : stem + 'en', // wir
      s2    + 't',      // ihr
      inf.endsWith('eln') ? stem + 'ln' : stem + 'en', // sie
    ];
  },

  imperativVerb(de) {
    if (!de) return null;
    let base = de.toLowerCase().replace(/^(ich|du|er|sie|es|wir|ihr)\s+/, '').trim();
    let inf = base;
    if (!inf.endsWith('en')) {
      if (inf.endsWith('t')) inf = inf.slice(0,-1) + 'en';
      else if (inf.endsWith('e')) inf = inf + 'n';
      else inf = inf + 'en';
    }
    const irregImp = {
      'sein':  ['sei','seid'],
      'haben': ['hab','habt'],
      'werden':['werd','werdet'],
      'geben': ['gib','gebt'],
      'sehen': ['sieh','seht'],
    };
    if (irregImp[inf]) return irregImp[inf];
    const stem = inf.endsWith('en') ? inf.slice(0,-2) : inf;
    const needsE = /[td]$/.test(stem);
    return [
      stem + (needsE ? 'e' : ''),   // Sg.
      stem + (needsE ? 'et' : 't')  // Pl.
    ];
  },

  // Decline a German noun (simplified – using article + base form)
  declineNoun(word, genus) {
    if (!word || word === '–') return null;
    const w = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

    // Determine article
    const art = genus === 'm.' ? 'der' : genus === 'f.' ? 'die' : genus === 'n.' ? 'das' : null;
    if (!art) return null;

    // German cases: Nominativ, Genitiv, Dativ, Akkusativ, (Vokativ=Nom), Ablativ=Dativ
    // Simplified: show der/die/das system with article
    let sg, pl;
    if (genus === 'm.') {
      sg = [`der ${w}`, `des ${w}s`, `dem ${w}`, `den ${w}`, `der ${w}`, `dem ${w}`];
      pl = [`die ${w}`, `der ${w}`, `den ${w}n`, `die ${w}`, `die ${w}`, `den ${w}n`];
    } else if (genus === 'f.') {
      sg = [`die ${w}`, `der ${w}`, `der ${w}`, `die ${w}`, `die ${w}`, `der ${w}`];
      pl = [`die ${w}n`, `der ${w}n`, `den ${w}n`, `die ${w}n`, `die ${w}n`, `den ${w}n`];
    } else {
      sg = [`das ${w}`, `des ${w}s`, `dem ${w}`, `das ${w}`, `das ${w}`, `dem ${w}`];
      pl = [`die ${w}`, `der ${w}`, `den ${w}n`, `die ${w}`, `die ${w}`, `den ${w}n`];
    }
    return { sg, pl };
  }
};

// ── Latin Grammar Engine ─────────────────────────────────────

const Latin = {

  // Detect word type from data
  detectType(r) {
    const lat   = (r.lat   || '').trim();
    const fall2 = (r.fall2 || '').trim();
    const genus = (r.genus || '').trim();
    // Adjective: lat contains /
    if (lat.includes('/')) return 'adj';
    // Noun: has genus m./f./n.
    if (['m.','f.','n.'].includes(genus)) return 'noun';
    // Verb: fall2 looks like 1st person (ends in -o or -m, or starts with same root)
    if (fall2 && fall2 !== '#' && fall2 !== '–' &&
        (fall2.endsWith('o') || fall2.endsWith('m') || fall2.endsWith('or'))) return 'verb';
    // Check infinitive ending
    if (lat.endsWith('are') || lat.endsWith('ere') || lat.endsWith('ire')) return 'verb';
    return 'indecl';
  },

  // ── VERB CONJUGATION (Präsens Aktiv) ────────────────────────
  conjugateVerb(inf, form1sg) {
    let stem = '', endings = [], conj = '', impSg = '', impPl = '';
    if (inf.endsWith('are')) {
      stem  = inf.slice(0, -3);
      endings = ['o','as','at','amus','atis','ant'];
      conj  = '1. Konjugation';
      impSg = stem + 'a';
      impPl = stem + 'ate';
    } else if (inf.endsWith('ire')) {
      stem  = inf.slice(0, -3);
      endings = ['io','is','it','imus','itis','iunt'];
      conj  = '4. Konjugation';
      impSg = stem + 'i';
      impPl = stem + 'ite';
    } else if (inf.endsWith('ere')) {
      if (form1sg && form1sg.endsWith('eo')) {
        stem  = inf.slice(0, -3);
        endings = ['eo','es','et','emus','etis','ent'];
        conj  = '2. Konjugation';
        impSg = stem + 'e';
        impPl = stem + 'ete';
      } else {
        stem = inf.slice(0, -3);
        const sg1   = (form1sg && form1sg !== '#' && form1sg !== '–') ? form1sg : stem + 'o';
        const stem3 = sg1.endsWith('o') ? sg1.slice(0,-1) : stem;
        return {
          conj: '3. Konjugation',
          forms: [
            ['1. Sg.', sg1],
            ['2. Sg.', stem3 + 'is'],
            ['3. Sg.', stem3 + 'it'],
            ['1. Pl.', stem3 + 'imus'],
            ['2. Pl.', stem3 + 'itis'],
            ['3. Pl.', stem3 + 'unt']
          ],
          imperativ: [
            ['Sg. (du)',  stem3 + 'e'],
            ['Pl. (ihr)', stem3 + 'ite']
          ]
        };
      }
    } else {
      return null;
    }

    const sg1 = (form1sg && form1sg !== '#' && form1sg !== '–') ? form1sg : stem + endings[0];
    return {
      conj,
      forms: [
        ['1. Sg. (ich)',        sg1],
        ['2. Sg. (du)',         stem + endings[1]],
        ['3. Sg. (er/sie/es)',  stem + endings[2]],
        ['1. Pl. (wir)',        stem + endings[3]],
        ['2. Pl. (ihr)',        stem + endings[4]],
        ['3. Pl. (sie)',        stem + endings[5]]
      ],
      imperativ: [
        ['Sg. (du)',  impSg],
        ['Pl. (ihr)', impPl]
      ]
    };
  },

  // ── NOUN DECLENSION ──────────────────────────────────────────
  declineNoun(nom, gen, genus) {
    // Determine declension from genitive
    let decl = 0;
    if (gen.endsWith('ae'))  decl = 1;
    else if (gen.endsWith('i'))   decl = 2;
    else if (gen.endsWith('is'))  decl = 3;
    else if (gen.endsWith('us'))  decl = 4;
    else if (gen.endsWith('ei') || gen.endsWith('ei')) decl = 5;

    const n = genus === 'n.';
    let sg = [], pl = [];

    if (decl === 1) {
      const stem = gen.slice(0, -2); // remove -ae → stem
      sg = [nom, gen, stem+'ae', stem+'am', nom, stem+'a'];
      pl = [stem+'ae', stem+'arum', stem+'is', stem+'as', stem+'ae', stem+'is'];
    } else if (decl === 2) {
      const stem = gen.slice(0, -1); // remove -i
      if (n) {
        sg = [nom, gen, stem+'o', nom, nom, stem+'o'];
        pl = [stem+'a', stem+'orum', stem+'is', stem+'a', stem+'a', stem+'is'];
      } else {
        sg = [nom, gen, stem+'o', stem+'um', nom, stem+'o'];
        pl = [stem+'i', stem+'orum', stem+'is', stem+'os', stem+'i', stem+'is'];
      }
    } else if (decl === 3) {
      const stem = gen.slice(0, -2); // remove -is
      if (n) {
        sg = [nom, gen, stem+'i', nom, nom, stem+'e'];
        pl = [stem+'ia', stem+'ium', stem+'ibus', stem+'ia', stem+'ia', stem+'ibus'];
      } else {
        sg = [nom, gen, stem+'i', stem+'em', nom, stem+'e'];
        pl = [stem+'es', stem+'um', stem+'ibus', stem+'es', stem+'es', stem+'ibus'];
      }
    } else if (decl === 4) {
      const stem = gen.slice(0, -2); // remove -us
      if (n) {
        sg = [nom, gen, stem+'u', nom, nom, stem+'u'];
        pl = [stem+'ua', stem+'uum', stem+'ibus', stem+'ua', stem+'ua', stem+'ibus'];
      } else {
        sg = [nom, gen, stem+'ui', stem+'um', nom, stem+'u'];
        pl = [stem+'us', stem+'uum', stem+'ibus', stem+'us', stem+'us', stem+'ibus'];
      }
    } else if (decl === 5) {
      const stem = gen.slice(0, -2); // remove -ei
      sg = [nom, gen, stem+'ei', stem+'em', nom, stem+'e'];
      pl = [stem+'es', stem+'erum', stem+'ebus', stem+'es', stem+'es', stem+'ebus'];
    }

    if (!sg.length) return null;
    const cases = ['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
    return { decl, sg, pl, cases };
  },

  // ── ADJECTIVE (1/2 Deklination, bonus/a/um type) ─────────────
  declineAdj(lat) {
    // Parse bonus/a/um → stem = bon
    const parts = lat.split('/');
    if (parts.length < 2) return null;
    const mNom = parts[0].trim();
    // stem: remove -us or -er
    let stem = mNom.endsWith('us') ? mNom.slice(0,-2)
             : mNom.endsWith('er') ? mNom
             : mNom;

    const cases = ['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
    const m_sg = [mNom,      stem+'i',  stem+'o',  stem+'um', mNom,      stem+'o'];
    const f_sg = [stem+'a',  stem+'ae', stem+'ae', stem+'am', stem+'a',  stem+'a'];
    const n_sg = [stem+'um', stem+'i',  stem+'o',  stem+'um', stem+'um', stem+'o'];
    const m_pl = [stem+'i',  stem+'orum',stem+'is',stem+'os', stem+'i',  stem+'is'];
    const f_pl = [stem+'ae', stem+'arum',stem+'is',stem+'as', stem+'ae', stem+'is'];
    const n_pl = [stem+'a',  stem+'orum',stem+'is',stem+'a',  stem+'a',  stem+'is'];

    return { cases, m_sg, f_sg, n_sg, m_pl, f_pl, n_pl };
  }
};

// ── Vokabel Detail View ───────────────────────────────────────
const VokDetail = {
  currentTableId: null,

  _currentRow: null,
  _currentRowIndex: null,
  _currentOverrideKey: null,

  open(rowIndex, tableId, fromAlle) {
    this.currentTableId = tableId;
    this._currentRowIndex = rowIndex;
    this._fromAlle = !!fromAlle;
    const t = state.vokabel.find(x => x.id === tableId);
    if (!t) return;
    const r = t.rows[rowIndex];
    if (!r) return;
    this._currentRow = r;
    this._currentOverrideKey = tableId + '_' + rowIndex;

    // Show admin edit button
    const editBtn = document.getElementById('vok-detail-edit-btn');
    if (editBtn) editBtn.classList.toggle('hidden', !state.adminLoggedIn);

    // Get manual override if exists
    const override = (t.overrides && t.overrides[rowIndex]) || {};

    const type = Latin.detectType(r);
    const de = (r.de || '–').split('%').join(' / ');

    let html = '';

    // ── Info card ──────────────────────────────────────────────
    html += `<div class="vok-detail-card">
      <div class="vok-detail-lat">${r.lat || '–'}</div>
      <div class="vok-detail-de">${de}</div>
      <div class="vok-detail-meta">`;
    if (r.fall2 && r.fall2 !== '–') html += `<span class="vok-meta-chip">${r.fall2}</span>`;
    if (r.genus && r.genus !== '–') html += `<span class="vok-meta-chip">${r.genus}</span>`;
    if (r.dekl  && r.dekl  !== '–') html += `<span class="vok-meta-chip">${r.dekl}</span>`;
    html += `<span class="vok-meta-chip vok-type-chip">${this._typeLabel(type)}</span>`;
    if (Object.keys(override).length) html += `<span class="vok-meta-chip" style="color:#8adc9e;border-color:#1e4a30;">manuell</span>`;
    html += `</div></div>`;

    // ── Grammar tables (Latin + German) ───────────────────────
    if (type === 'verb') {
      const autoConj = Latin.conjugateVerb(r.lat || '', r.fall2 || '');
      const persons  = ['ich','du','er / sie / es','wir','ihr','sie'];
      const keys     = ['p1sg','p2sg','p3sg','p1pl','p2pl','p3pl'];
      const auto     = autoConj ? autoConj.forms.map(([,f])=>f) : ['','','','','',''];
      const conjLabel = autoConj ? autoConj.conj : 'unbekannte Konjugation';

      // Get base German translation (first % variant, strip brackets)
      const deBase = (r.de||'').split('%')[0].replace(/\(.*?\)/g,'').trim() || r.de || '–';
      // German present tense – derive from translation
      // Pattern: "er lacht" → stem = "lacht" → ich lache, du lachst, ...
      const deConj = German.conjugateVerb(deBase);

      html += `<div class="forms-section-title" style="margin-top:1.5rem;">Konjugation – Präsens Aktiv <span style="font-weight:400;color:var(--text3);font-size:11px;">(${conjLabel})</span></div>`;
      html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Person</th><th>Latein</th><th>Deutsch</th></tr></thead><tbody>`;
      keys.forEach((k, i) => {
        const latForm = override[k] || auto[i] || '–';
        const isManual = !!override[k];
        const deForm  = deConj ? deConj[i] : '–';
        html += `<tr><td class="case-cell">${persons[i]}</td><td><strong${isManual?' style="color:#8adc9e;"':''}>${latForm}</strong></td><td style="color:var(--text2);">${deForm}</td></tr>`;
      });
      html += `</tbody></table></div>`;

      // Imperativ
      if (autoConj && autoConj.imperativ) {
        const deImp = German.imperativVerb(deBase);
        html += `<div class="forms-section-title" style="margin-top:1.2rem;">Imperativ – Präsens</div>`;
        html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Form</th><th>Latein</th><th>Deutsch</th></tr></thead><tbody>`;
        autoConj.imperativ.forEach(([label, latForm], i) => {
          const ovKey = 'imp_' + label.split(' ')[0].toLowerCase();
          const manualForm = override[ovKey];
          const deImpForm = deImp ? deImp[i] : '–';
          html += `<tr><td class="case-cell">${label}</td><td><strong${manualForm?' style="color:#8adc9e;"':''}>${manualForm||latForm||'–'}</strong></td><td style="color:var(--text2);">${deImpForm}</td></tr>`;
        });
        html += `</tbody></table></div>`;
      }

    } else if (type === 'noun') {
      const res = Latin.declineNoun(r.lat||'', r.fall2||'', r.genus||'');
      const caseKeys = ['nom','gen','dat','akk','vok','abl'];
      const cases    = ['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
      const deWord   = (r.de||'').split('%')[0].trim();
      const deDecl   = German.declineNoun(deWord, r.genus||'');
      if (res) {
        html += `<div class="forms-section-title" style="margin-top:1.5rem;">Deklination – ${res.decl}. Deklination</div>`;
        html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Kasus</th><th>Lat. Sg.</th><th>Lat. Pl.</th><th>De. Sg.</th><th>De. Pl.</th></tr></thead><tbody>`;
        cases.forEach((c, i) => {
          const sg = override['sg_'+caseKeys[i]] || res.sg[i] || '–';
          const pl = override['pl_'+caseKeys[i]] || res.pl[i] || '–';
          const isMSg = !!override['sg_'+caseKeys[i]], isMPl = !!override['pl_'+caseKeys[i]];
          const deSg = deDecl ? deDecl.sg[i] : '–';
          const dePl = deDecl ? deDecl.pl[i] : '–';
          html += `<tr>
            <td class="case-cell">${c}</td>
            <td><strong${isMSg?' style="color:#8adc9e;"':''}>${sg}</strong></td>
            <td${isMPl?' style="color:#8adc9e;"':''}>${pl}</td>
            <td style="color:var(--text2);">${deSg}</td>
            <td style="color:var(--text2);">${dePl}</td>
          </tr>`;
        });
        html += `</tbody></table></div>`;
      }

    } else if (type === 'adj') {
      const res = Latin.declineAdj(r.lat||'');
      const deWord = (r.de||'').split('%')[0].trim();
      if (res) {
        html += `<div class="forms-section-title" style="margin-top:1.5rem;">Deklination – Adjektiv (1./2. Dekl.)</div>`;
        html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Kasus</th><th>M Sg.</th><th>F Sg.</th><th>N Sg.</th><th>M Pl.</th><th>F Pl.</th><th>N Pl.</th></tr></thead><tbody>`;
        res.cases.forEach((c, i) => {
          html += `<tr><td class="case-cell">${c}</td><td><strong>${res.m_sg[i]}</strong></td><td>${res.f_sg[i]}</td><td>${res.n_sg[i]}</td><td>${res.m_pl[i]}</td><td>${res.f_pl[i]}</td><td>${res.n_pl[i]}</td></tr>`;
        });
        html += `</tbody></table></div>`;
        // German adjective note
        if (deWord) {
          html += `<div style="font-size:13px;color:var(--text3);margin-top:8px;">Deutsch: <em>${deWord}</em> – Steigerung: ${deWord}er · ${deWord}(e)st</div>`;
        }
      }
    } else {
      html += `<div class="forms-section-title" style="margin-top:1.5rem;">Indeklinabel</div>`;
      html += `<div class="empty-hint">Dieses Wort wird nicht dekliniert oder konjugiert.</div>`;
    }

    document.getElementById('vok-detail-content').innerHTML = html;
    // Determine where to go back: alle-vokabeln page or specific table
    const fromAlleVok = document.getElementById('page-alle-vokabeln').classList.contains('active') ||
                        (state._vokDetailSource === 'alle');
    state._vokDetailSource = fromAlleVok ? 'alle' : 'table';
    document.getElementById('vok-detail-back').onclick = () => {
      if (state._vokDetailSource === 'alle') {
        // Go back to alle-vokabeln and re-render with current state
        App.showPage('alle-vokabeln', 'Alle Vokabeln');
      } else {
        Tables.viewTable(tableId, 'vokabel');
      }
    };
    App.showPage('vok-detail', r.lat || '');
  },

  // ── Manual Override ──────────────────────────────────────────
  openOverride() {
    const r = this._currentRow;
    if (!r) return;
    const t = state.vokabel.find(x => x.id === this.currentTableId);
    const override = (t && t.overrides && t.overrides[this._currentRowIndex]) || {};
    const type = Latin.detectType(r);

    document.getElementById('override-modal-title').textContent = 'Formen für „' + (r.lat||'') + '" bearbeiten';

    let fields = '';
    if (type === 'verb') {
      const autoConj = Latin.conjugateVerb(r.lat||'', r.fall2||'');
      const auto = autoConj ? autoConj.forms.map(([,f])=>f) : ['','','','','',''];
      const persons = ['ich','du','er / sie / es','wir','ihr','sie'];
      const keys = ['p1sg','p2sg','p3sg','p1pl','p2pl','p3pl'];
      fields += '<div class="override-grid">';
      keys.forEach((k, i) => {
        fields += `<div class="override-field">
          <label>${persons[i]}</label>
          <input type="text" id="ov_${k}" class="modal-input" placeholder="${auto[i]||''}" value="${override[k]||''}"/>
        </div>`;
      });
      fields += '</div>';
    } else if (type === 'noun') {
      const res = Latin.declineNoun(r.lat||'', r.fall2||'', r.genus||'');
      const caseKeys = ['nom','gen','dat','akk','vok','abl'];
      const cases = ['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
      fields += '<div class="override-section-label">Singular</div><div class="override-grid">';
      cases.forEach((c, i) => {
        const auto = res ? res.sg[i] : '';
        fields += `<div class="override-field"><label>${c}</label><input type="text" id="ov_sg_${caseKeys[i]}" class="modal-input" placeholder="${auto||''}" value="${override['sg_'+caseKeys[i]]||''}"/></div>`;
      });
      fields += '</div><div class="override-section-label">Plural</div><div class="override-grid">';
      cases.forEach((c, i) => {
        const auto = res ? res.pl[i] : '';
        fields += `<div class="override-field"><label>${c}</label><input type="text" id="ov_pl_${caseKeys[i]}" class="modal-input" placeholder="${auto||''}" value="${override['pl_'+caseKeys[i]]||''}"/></div>`;
      });
      fields += '</div>';
    } else {
      fields = '<div style="color:var(--text2);font-size:14px;">Für diesen Worttyp gibt es keine Formen zum Bearbeiten.</div>';
    }

    document.getElementById('override-fields').innerHTML = fields;
    document.getElementById('override-overlay').classList.remove('hidden');
  },

  closeOverride(e) {
    if (e && e.target !== document.getElementById('override-overlay')) return;
    document.getElementById('override-overlay').classList.add('hidden');
  },

  async saveOverride() {
    const t = state.vokabel.find(x => x.id === this.currentTableId);
    if (!t) return;
    const r = this._currentRow;
    const type = Latin.detectType(r);
    const idx = this._currentRowIndex;

    const override = {};
    const readField = id => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    if (type === 'verb') {
      ['p1sg','p2sg','p3sg','p1pl','p2pl','p3pl'].forEach(k => {
        const v = readField('ov_' + k); if (v) override[k] = v;
      });
    } else if (type === 'noun') {
      ['nom','gen','dat','akk','vok','abl'].forEach(k => {
        const sg = readField('ov_sg_' + k); if (sg) override['sg_'+k] = sg;
        const pl = readField('ov_pl_' + k); if (pl) override['pl_'+k] = pl;
      });
    }

    // Merge into table overrides
    if (!t.overrides) t.overrides = {};
    if (Object.keys(override).length) {
      t.overrides[idx] = override;
    } else {
      delete t.overrides[idx];
    }

    try {
      await COL.vokabel.doc(t.id).update({ overrides: t.overrides });
      document.getElementById('override-overlay').classList.add('hidden');
      // Reopen detail to refresh
      this.open(idx, this.currentTableId);
    } catch(e) {
      alert('Fehler beim Speichern: ' + e.message);
    }
  },

  _typeLabel(type) {
    return { noun:'Nomen', verb:'Verb', adj:'Adjektiv', indecl:'Indeklinabel' }[type] || '';
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
window.App       = App;
window.Tables    = Tables;
window.Quiz      = Quiz;
window.VokDetail = VokDetail;
window.VokSearch = VokSearch;

App.init();
