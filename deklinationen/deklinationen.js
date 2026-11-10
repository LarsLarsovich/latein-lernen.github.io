'use strict';

// ── Deklinationen: Inhalt der Tafeln ──────────────────────────
Object.assign(GrammarTables, {

  renderDeklinationen() {
    const el = document.getElementById('gt-dekl-content');
    if (!el) return;
    const cases = ['Nom.','Gen.','Dat.','Akk.','Vok.','Abl.'];
    const self = this;
    let html = '';

    // 1. Deklination
    const sg1=['a','ae','ae','am','a','a'], pl1=['ae','arum','is','as','ae','is'];
    html += this._section('1. Deklination (a-Deklination)', 'via',
      cases.map(function(c,i){return self._row(c,self._hl('vi',sg1[i]),self._hl('vi',pl1[i]));}).join(''),
      '0efuowRWDYA','Latein Rap: A-Deklination');

    // 2. Deklination m. -us
    const sg2m=['us','i','o','um','e','o'], pl2m=['i','orum','is','os','i','is'];
    html += this._section('2. Deklination m. -us (o-Deklination)', 'stilus',
      cases.map(function(c,i){return self._row(c,self._hl('stil',sg2m[i]),self._hl('stil',pl2m[i]));}).join(''),
      'NYnGOthO8z8','Latein Rap: O-Deklination maskulin (-us)');

    // 2. Deklination m. -r
    const sg2r=[
      '<span class="gt-stem">vir</span>',self._hl('vir','i'),self._hl('vir','o'),
      self._hl('vir','um'),'<span class="gt-stem">vir</span>',self._hl('vir','o')
    ];
    const pl2r=[
      self._hl('vir','i'),self._hl('vir','orum'),self._hl('vir','is'),
      self._hl('vir','os'),self._hl('vir','i'),self._hl('vir','is')
    ];
    html += this._section('2. Deklination m. -r (o-Deklination)', 'vir',
      cases.map(function(c,i){return self._row(c,sg2r[i],pl2r[i]);}).join(''),
      '90pSLJIcmNA','Latein Rap: O-Deklination maskulin (-r)');

    // 2. Deklination n.
    const sg2n=['um','i','o','um','um','o'], pl2n=['a','orum','is','a','a','is'];
    html += this._section('2. Deklination n. (o-Deklination)', 'templum',
      cases.map(function(c,i){return self._row(c,self._hl('templ',sg2n[i]),self._hl('templ',pl2n[i]));}).join(''),
      'Vlf-_vgQ8yI','Latein Rap: O-Deklination neutrum (-um)');

    // 3. Deklination m./f.
    const sg3mf=[
      '<span class="gt-stem">homo</span>',self._hl('homin','is'),self._hl('homin','i'),
      self._hl('homin','em'),'<span class="gt-stem">homo</span>',self._hl('homin','e')
    ];
    const pl3mf=[
      self._hl('homin','es'),self._hl('homin','um'),self._hl('homin','ibus'),
      self._hl('homin','es'),self._hl('homin','es'),self._hl('homin','ibus')
    ];
    html += this._section('3. Deklination m./f. (Konsonantenstämme)', 'homo (homin-)',
      cases.map(function(c,i){return self._row(c,sg3mf[i],pl3mf[i]);}).join(''),
      'jyohDpYLtlE','Latin Rap: Consonantal Declension Masculine & Feminine');

    // 3. Deklination n.
    const sg3n=[
      '<span class="gt-stem">flumen</span>',self._hl('flumin','is'),self._hl('flumin','i'),
      '<span class="gt-stem">flumen</span>','<span class="gt-stem">flumen</span>',self._hl('flumin','e')
    ];
    const pl3n=[
      self._hl('flumin','a'),self._hl('flumin','um'),self._hl('flumin','ibus'),
      self._hl('flumin','a'),self._hl('flumin','a'),self._hl('flumin','ibus')
    ];
    html += this._section('3. Deklination n. (Konsonantenstämme)', 'flumen (flumin-)',
      cases.map(function(c,i){return self._row(c,sg3n[i],pl3n[i]);}).join(''),
      'hqir0zXtF0I','Latein Rap: Konsonantische Deklination neutrum');

    // 4. Deklination m.
    const sg4m=['us','us','ui','um','us','u'], pl4m=['us','uum','ibus','us','us','ibus'];
    html += this._section('4. Deklination m.', 'manus',
      cases.map(function(c,i){return self._row(c,self._hl('man',sg4m[i]),self._hl('man',pl4m[i]));}).join(''));

    // 4. Deklination n.
    const sg4n=['u','us','ui','u','u','u'], pl4n=['ua','uum','ibus','ua','ua','ibus'];
    html += this._section('4. Deklination n.', 'cornu',
      cases.map(function(c,i){return self._row(c,self._hl('corn',sg4n[i]),self._hl('corn',pl4n[i]));}).join(''));

    // 5. Deklination
    const sg5=['es','ei','ei','em','es','e'], pl5=['es','erum','ebus','es','es','ebus'];
    html += this._section('5. Deklination', 'res, rei',
      cases.map(function(c,i){return self._row(c,self._hl('r',sg5[i]),self._hl('r',pl5[i]));}).join(''),
      'V3q6acvJ6Os','Latin Rap: E-Declension');

    el.innerHTML = html;
    this._syncVideoHeights(el);
  }
});
