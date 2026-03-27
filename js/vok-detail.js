'use strict';

// ── Vokabel-Detailansicht ─────────────────────────────────────
const VokDetail = {
  currentTableId: null, _currentRow: null, _currentRowIndex: null,

  open(rowIndex, tableId, fromAlle) {
    this.currentTableId = tableId; this._currentRowIndex = rowIndex;
    const t = state.vokabel.find(x => x.id === tableId); if (!t) return;
    const r = t.rows[rowIndex]; if (!r) return;
    this._currentRow = r;
    document.getElementById('vok-detail-edit-btn')?.classList.toggle('hidden',  !state.adminLoggedIn);
    document.getElementById('vok-detail-forms-btn')?.classList.toggle('hidden', !state.adminLoggedIn);
    const override = (t.overrides && t.overrides[rowIndex]) || {};
    const type = Latin.detectType(r);
    const de   = (r.de||'–').split('%').map(s=>s.trim()).join(', ');

    let html = `<div class="vok-detail-card"><div class="vok-detail-lat">${(r.lat||'–').split('%').map(s=>s.trim()).join(', ')}</div><div class="vok-detail-de">${de}</div><div class="vok-detail-meta">`;
    if (r.fall2&&r.fall2!=='–') html += `<span class="vok-meta-chip">${r.fall2}</span>`;
    if (r.genus&&r.genus!=='–') html += `<span class="vok-meta-chip">${r.genus}</span>`;
    if (r.dekl &&r.dekl !=='–') html += `<span class="vok-meta-chip">${r.dekl}</span>`;
    html += `<span class="vok-meta-chip vok-type-chip">${this._typeLabel(type)}</span></div></div>`;

    if (type === 'verb') {
      const autoConj  = Latin.conjugateVerb(r.lat||'', r.fall2||'');
      const persons   = ['ich','du','er / sie / es','wir','ihr','sie'];
      const keys      = ['p1sg','p2sg','p3sg','p1pl','p2pl','p3pl'];
      const auto      = autoConj ? autoConj.forms.map(([,f])=>f) : ['','','','','',''];
      const conjLabel = autoConj ? autoConj.conj : 'unbekannte Konjugation';
      const deBase    = (r.de||'').split('%')[0].replace(/\(.*?\)/g,'').trim()||r.de||'–';
      const deConj    = German.conjugateVerb(deBase);
      html += `<div class="forms-section-title forms-section-title--spaced">Konjugation – Präsens Aktiv <span class="forms-subtitle">(${conjLabel})</span></div>`;
      html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Person</th><th>Latein</th><th>Deutsch</th></tr></thead><tbody>`;
      keys.forEach((k,i) => { html += `<tr><td class="case-cell">${persons[i]}</td><td><strong>${override[k]||auto[i]||'–'}</strong></td><td class="cell-de">${deConj?deConj[i]:'–'}</td></tr>`; });
      html += `</tbody></table></div>`;
      if (autoConj?.imperativ) {
        const deImp = German.imperativVerb(deBase);
        html += `<div class="forms-section-title forms-section-title--spaced">Imperativ – Präsens</div>`;
        html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Form</th><th>Latein</th><th>Deutsch</th></tr></thead><tbody>`;
        autoConj.imperativ.forEach(([label,latForm],i) => {
          const ovKey = 'imp_'+label.split(' ')[0].toLowerCase();
          html += `<tr><td class="case-cell">${label}</td><td><strong>${override[ovKey]||latForm||'–'}</strong></td><td class="cell-de">${deImp?deImp[i]:'–'}</td></tr>`;
        });
        html += `</tbody></table></div>`;
      }
    } else if (type === 'noun') {
      const res      = Latin.declineNoun(r.lat||'',r.fall2||'',r.genus||'');
      const caseKeys = ['nom','gen','dat','akk','vok','abl'];
      const cases    = ['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
      const deDecl   = German.declineNoun((r.de||'').split('%')[0].trim(), r.genus||'');
      if (res) {
        html += `<div class="forms-section-title forms-section-title--spaced">Deklination – ${res.decl}. Deklination</div>`;
        html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Kasus</th><th>Lat. Sg.</th><th>Lat. Pl.</th><th>De. Sg.</th><th>De. Pl.</th></tr></thead><tbody>`;
        cases.forEach((c,i) => {
          html += `<tr><td class="case-cell">${c}</td><td><strong>${override['sg_'+caseKeys[i]]||res.sg[i]||'–'}</strong></td><td>${override['pl_'+caseKeys[i]]||res.pl[i]||'–'}</td><td class="cell-de">${deDecl?deDecl.sg[i]:'–'}</td><td class="cell-de">${deDecl?deDecl.pl[i]:'–'}</td></tr>`;
        });
        html += `</tbody></table></div>`;
      }
    } else if (type === 'adj') {
      const res    = Latin.declineAdj(r.lat||'');
      const deWord = (r.de||'').split('%')[0].trim();
      if (res) {
        html += `<div class="forms-section-title forms-section-title--spaced">Deklination – Adjektiv (1./2. Dekl.)</div>`;
        html += `<div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Kasus</th><th>M Sg.</th><th>F Sg.</th><th>N Sg.</th><th>M Pl.</th><th>F Pl.</th><th>N Pl.</th></tr></thead><tbody>`;
        res.cases.forEach((c,i) => {
          html += `<tr><td class="case-cell">${c}</td><td><strong>${res.m_sg[i]}</strong></td><td>${res.f_sg[i]}</td><td>${res.n_sg[i]}</td><td>${res.m_pl[i]}</td><td>${res.f_pl[i]}</td><td>${res.n_pl[i]}</td></tr>`;
        });
        html += `</tbody></table></div>`;
        if (deWord) html += `<div class="adj-steigerung">Deutsch: <em>${deWord}</em> – Steigerung: ${deWord}er · ${deWord}(e)st</div>`;
      }
    } else {
      const hasManual = Object.keys(override).some(k=>k.startsWith('sg_')||k.startsWith('pl_'));
      if (hasManual) {
        const caseKeys=['nom','gen','dat','akk','vok','abl'], cases=['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
        html += `<div class="forms-section-title forms-section-title--spaced">Formen (manuell)</div><div class="dekl-table-wrap"><table class="dekl-table"><thead><tr><th>Kasus</th><th>Singular</th><th>Plural</th></tr></thead><tbody>`;
        cases.forEach((c,i) => { const sg=override['sg_'+caseKeys[i]]||'', pl=override['pl_'+caseKeys[i]]||''; if(sg||pl) html+=`<tr><td class="case-cell">${c}</td><td><strong>${sg||'–'}</strong></td><td>${pl||'–'}</td></tr>`; });
        html += `</tbody></table></div>`;
      } else {
        html += `<div class="forms-section-title forms-section-title--spaced">Indeklinabel</div><div class="empty-hint">Dieses Wort wird nicht dekliniert. Als Admin können Formen manuell eingetragen werden.</div>`;
      }
    }

    document.getElementById('vok-detail-content').innerHTML = html;
    document.getElementById('vok-detail-back').onclick = () => App.goBack();
    App.showPage('vok-detail', r.lat||'');
  },

  openBasicEdit() {
    const r=this._currentRow; if(!r)return;
    document.getElementById('basic-edit-lat').value   = r.lat  ||'';
    document.getElementById('basic-edit-fall2').value = r.fall2||'';
    document.getElementById('basic-edit-genus').value = r.genus||'–';
    document.getElementById('basic-edit-dekl').value  = r.dekl ||'–';
    document.getElementById('basic-edit-de').value    = r.de   ||'';
    document.getElementById('basic-edit-error').classList.add('hidden');
    document.getElementById('basic-edit-overlay').classList.remove('hidden');
  },
  closeBasicEdit(e) { if(e&&e.target!==document.getElementById('basic-edit-overlay'))return; document.getElementById('basic-edit-overlay').classList.add('hidden'); },
  async saveBasicEdit() {
    const t=state.vokabel.find(x=>x.id===this.currentTableId), idx=this._currentRowIndex;
    if(!t||idx==null)return;
    const err=document.getElementById('basic-edit-error');
    const lat=document.getElementById('basic-edit-lat').value.trim();
    if(!lat){err.textContent='Lateinisches Wort darf nicht leer sein.';err.classList.remove('hidden');return;}
    const rows=[...(t.rows||[])];
    rows[idx]={...rows[idx],lat,fall2:document.getElementById('basic-edit-fall2').value.trim(),genus:document.getElementById('basic-edit-genus').value,dekl:document.getElementById('basic-edit-dekl').value,de:document.getElementById('basic-edit-de').value.trim()};
    t.rows=rows;
    try { await COL.vokabel.doc(t.id).update({rows}); document.getElementById('basic-edit-overlay').classList.add('hidden'); this.open(idx,this.currentTableId); }
    catch(e){err.textContent='Fehler: '+e.message;err.classList.remove('hidden');}
  },

  openOverride() {
    const r=this._currentRow; if(!r)return;
    const t=state.vokabel.find(x=>x.id===this.currentTableId);
    const override=(t&&t.overrides&&t.overrides[this._currentRowIndex])||{};
    const type=Latin.detectType(r);
    document.getElementById('override-modal-title').textContent='Formen für: '+(r.lat||'');
    let fields='';
    if(type==='verb'){
      const autoConj=Latin.conjugateVerb(r.lat||'',r.fall2||'');
      const auto=autoConj?autoConj.forms.map(([,f])=>f):['','','','','',''];
      const persons=['ich','du','er / sie / es','wir','ihr','sie'];
      const keys=['p1sg','p2sg','p3sg','p1pl','p2pl','p3pl'];
      fields='<div class="override-grid">';
      keys.forEach((k,i)=>{fields+=`<div class="override-field"><label>${persons[i]}</label><input type="text" id="ov_${k}" class="modal-input" placeholder="${auto[i]||''}" value="${override[k]||''}"/></div>`;});
      fields+='</div>';
    } else {
      const caseKeys=['nom','gen','dat','akk','vok','abl'],cases=['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
      const res=type==='noun'?Latin.declineNoun(r.lat||'',r.fall2||'',r.genus||''):null;
      fields+='<div class="override-hint">Manuelle Formen (leer = nicht anzeigen)</div>';
      ['sg','pl'].forEach(sp=>{
        fields+=`<div class="override-section-label">${sp==='sg'?'Singular':'Plural'}</div><div class="override-grid">`;
        cases.forEach((c,i)=>{const auto=res?(sp==='sg'?res.sg[i]:res.pl[i]):'';fields+=`<div class="override-field"><label>${c}</label><input type="text" id="ov_${sp}_${caseKeys[i]}" class="modal-input" placeholder="${auto||''}" value="${override[sp+'_'+caseKeys[i]]||''}"/></div>`;});
        fields+='</div>';
      });
      if(type==='indecl') fields+=`<button class="danger-btn" onclick="VokDetail.clearOverride()">Alle Formen löschen</button>`;
    }
    document.getElementById('override-fields').innerHTML=fields;
    document.getElementById('override-overlay').classList.remove('hidden');
  },
  closeOverride(e) { if(e&&e.target!==document.getElementById('override-overlay'))return; document.getElementById('override-overlay').classList.add('hidden'); },
  async clearOverride() {
    const t=state.vokabel.find(x=>x.id===this.currentTableId); if(!t)return;
    const idx=this._currentRowIndex;
    if(!t.overrides)t.overrides={};
    delete t.overrides[idx];
    try{await COL.vokabel.doc(t.id).update({overrides:t.overrides});document.getElementById('override-overlay').classList.add('hidden');this.open(idx,this.currentTableId);}
    catch(e){alert('Fehler: '+e.message);}
  },
  async saveOverride() {
    const t=state.vokabel.find(x=>x.id===this.currentTableId); if(!t)return;
    const type=Latin.detectType(this._currentRow), idx=this._currentRowIndex;
    const readField=id=>{const el=document.getElementById(id);return el?el.value.trim():'';};
    const override={};
    if(type==='verb'){['p1sg','p2sg','p3sg','p1pl','p2pl','p3pl'].forEach(k=>{const v=readField('ov_'+k);if(v)override[k]=v;});}
    else{['nom','gen','dat','akk','vok','abl'].forEach(k=>{const sg=readField('ov_sg_'+k);if(sg)override['sg_'+k]=sg;const pl=readField('ov_pl_'+k);if(pl)override['pl_'+k]=pl;});}
    if(!t.overrides)t.overrides={};
    Object.keys(override).length?(t.overrides[idx]=override):delete t.overrides[idx];
    try{await COL.vokabel.doc(t.id).update({overrides:t.overrides});document.getElementById('override-overlay').classList.add('hidden');this.open(idx,this.currentTableId);}
    catch(e){alert('Fehler beim Speichern: '+e.message);}
  },

  reportCurrent() {
    const tid=this.currentTableId,idx=this._currentRowIndex,r=this._currentRow;
    if(tid!=null&&idx!=null&&r){const t=state.vokabel.find(x=>x.id===tid);Report._encodedContext=`VOK:${tid}:${idx}`;Report.open(`${r.lat||'?'} (${t?.name||'Vokabel'})`);}
    else Report.open('Vokabel-Detail');
  },

  _typeLabel(type) { return {noun:'Nomen',verb:'Verb',adj:'Adjektiv',indecl:'Indeklinabel'}[type]||''; }
};
