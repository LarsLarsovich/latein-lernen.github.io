'use strict';

// ── Grammatik-Tafeln: Deklinationen & Konjugationen ──────────
const GrammarTables = {

  _hl(stem, ending) {
    if (!ending) return '<span class="gt-stem">' + escHtml(stem) + '</span>';
    return '<span class="gt-stem">' + escHtml(stem) + '</span><span class="gt-ending">' + escHtml(ending) + '</span>';
  },

  _row(label, sg, pl) {
    return '<tr><td class="case-cell">' + escHtml(label) + '</td><td>' + sg + '</td><td>' + pl + '</td></tr>';
  },



  _section(title, example, rows, videoId, videoTitle) {
    var tableHtml = '<div class="dekl-table-wrap gt-table-side"><table class="dekl-table gt-table">' +
      '<thead><tr><th>Kasus</th><th>Singular</th><th>Plural</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
    var videoHtml = videoId
      ? '<div class="gt-video-side"><iframe src="https://www.youtube.com/embed/' + videoId +
        '" title="' + escHtml(videoTitle || title) + '" frameborder="0" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
        'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>'
      : '';
    return '<div class="gt-section">' +
      '<div class="gt-section-title">' + escHtml(title) +
        '<span class="gt-example">Beispiel: <em>' + escHtml(example) + '</em></span></div>' +
      '<div class="gt-row">' + tableHtml + videoHtml + '</div>' +
    '</div>';
  },

  _konjSection(title, example, rows) {
    return '<div class="gt-section">' +
      '<div class="gt-section-title">' + escHtml(title) +
        '<span class="gt-example">Beispiel: <em>' + escHtml(example) + '</em></span></div>' +
      '<div class="dekl-table-wrap"><table class="dekl-table gt-table">' +
        '<thead><tr><th>Person</th><th>Singular</th><th>Plural</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></div>';
  },

  // Match each video height to its sibling table height
  _syncVideoHeights(container) {
    requestAnimationFrame(function() {
      var rows = container.querySelectorAll('.gt-row');
      rows.forEach(function(row) {
        var table = row.querySelector('.gt-table-side');
        var video = row.querySelector('.gt-video-side');
        if (!table || !video) return;
        var h = table.offsetHeight;
        if (h > 0) {
          video.style.height = h + 'px';
          video.style.width  = (h * 16 / 9) + 'px';
        }
      });
    });
  },

  renderDeklinationen() {
    var el = document.getElementById('gt-dekl-content');
    if (!el) return;
    var cases = ['Nom.','Gen.','Dat.','Akk.','Vok.','Abl.'];
    var self = this;
    var html = '';

    // 1. Deklination
    var sg1=['a','ae','ae','am','a','a'], pl1=['ae','arum','is','as','ae','is'];
    html += this._section('1. Deklination (a-Deklination)', 'porta',
      cases.map(function(c,i){return self._row(c,self._hl('port',sg1[i]),self._hl('port',pl1[i]));}).join(''),
      '0efuowRWDYA','Latein Rap: A-Deklination');

    // 2. Deklination m. -us
    var sg2m=['us','i','o','um','e','o'], pl2m=['i','orum','is','os','i','is'];
    html += this._section('2. Deklination m. -us (o-Deklination)', 'servus',
      cases.map(function(c,i){return self._row(c,self._hl('serv',sg2m[i]),self._hl('serv',pl2m[i]));}).join(''),
      'NYnGOthO8z8','Latein Rap: O-Deklination maskulin (-us)');

    // 2. Deklination m. -r
    var sg2r=[
      '<span class="gt-stem">puer</span>',self._hl('puer','i'),self._hl('puer','o'),
      self._hl('puer','um'),'<span class="gt-stem">puer</span>',self._hl('puer','o')
    ];
    var pl2r=[
      self._hl('puer','i'),self._hl('puer','orum'),self._hl('puer','is'),
      self._hl('puer','os'),self._hl('puer','i'),self._hl('puer','is')
    ];
    html += this._section('2. Deklination m. -r (o-Deklination)', 'puer',
      cases.map(function(c,i){return self._row(c,sg2r[i],pl2r[i]);}).join(''),
      '90pSLJIcmNA','Latein Rap: O-Deklination maskulin (-r)');

    // 2. Deklination n.
    var sg2n=['um','i','o','um','um','o'], pl2n=['a','orum','is','a','a','is'];
    html += this._section('2. Deklination n. (o-Deklination)', 'bellum',
      cases.map(function(c,i){return self._row(c,self._hl('bell',sg2n[i]),self._hl('bell',pl2n[i]));}).join(''),
      'Vlf-_vgQ8yI','Latein Rap: O-Deklination neutrum (-um)');

    // 3. Deklination m./f.
    var sg3mf=[
      '<span class="gt-stem">rex</span>',self._hl('reg','is'),self._hl('reg','i'),
      self._hl('reg','em'),'<span class="gt-stem">rex</span>',self._hl('reg','e')
    ];
    var pl3mf=[
      self._hl('reg','es'),self._hl('reg','um'),self._hl('reg','ibus'),
      self._hl('reg','es'),self._hl('reg','es'),self._hl('reg','ibus')
    ];
    html += this._section('3. Deklination m./f. (Konsonantenstämme)', 'rex (reg-)',
      cases.map(function(c,i){return self._row(c,sg3mf[i],pl3mf[i]);}).join(''),
      'jyohDpYLtlE','Latin Rap: Consonantal Declension Masculine & Feminine');

    // 3. Deklination n.
    var sg3n=[
      '<span class="gt-stem">corpus</span>',self._hl('corpor','is'),self._hl('corpor','i'),
      '<span class="gt-stem">corpus</span>','<span class="gt-stem">corpus</span>',self._hl('corpor','e')
    ];
    var pl3n=[
      self._hl('corpor','a'),self._hl('corpor','um'),self._hl('corpor','ibus'),
      self._hl('corpor','a'),self._hl('corpor','a'),self._hl('corpor','ibus')
    ];
    html += this._section('3. Deklination n. (Konsonantenstämme)', 'corpus (corpor-)',
      cases.map(function(c,i){return self._row(c,sg3n[i],pl3n[i]);}).join(''),
      'hqir0zXtF0I','Latein Rap: Konsonantische Deklination neutrum');

    // 4. Deklination m.
    var sg4m=['us','us','ui','um','us','u'], pl4m=['us','uum','ibus','us','us','ibus'];
    html += this._section('4. Deklination m.', 'manus',
      cases.map(function(c,i){return self._row(c,self._hl('man',sg4m[i]),self._hl('man',pl4m[i]));}).join(''));

    // 4. Deklination n.
    var sg4n=['u','us','u','u','u','u'], pl4n=['ua','uum','ibus','ua','ua','ibus'];
    html += this._section('4. Deklination n.', 'cornu',
      cases.map(function(c,i){return self._row(c,self._hl('corn',sg4n[i]),self._hl('corn',pl4n[i]));}).join(''));

    // 5. Deklination
    var sg5=['es','ei','ei','em','es','e'], pl5=['es','erum','ebus','es','es','ebus'];
    html += this._section('5. Deklination', 'res',
      cases.map(function(c,i){return self._row(c,self._hl('r',sg5[i]),self._hl('r',pl5[i]));}).join(''),
      'V3q6acvJ6Os','Latin Rap: E-Declension');

    el.innerHTML = html;
    this._syncVideoHeights(el);
  },

  renderKonjugationen() {
    var el = document.getElementById('gt-konj-content');
    if (!el) return;
    var persons = ['1. Sg. (ich)','2. Sg. (du)','3. Sg. (er/sie/es)','1. Pl. (wir)','2. Pl. (ihr)','3. Pl. (sie)'];
    var self = this;
    var html = '';

    var sg1k=['o','as','at','amus','atis','ant'];
    html += this._konjSection('1. Konjugation (a-Konjugation)', 'amare – amō',
      persons.map(function(p,i){return self._row(p,self._hl('am',sg1k[i]),'');}).join(''));

    var sg2k=['eo','es','et','emus','etis','ent'];
    html += this._konjSection('2. Konjugation (e-Konjugation)', 'monēre – moneō',
      persons.map(function(p,i){return self._row(p,self._hl('mon',sg2k[i]),'');}).join(''));

    var sg3k=['o','is','it','imus','itis','unt'];
    html += this._konjSection('3. Konjugation (konsonantisch)', 'regere – regō',
      persons.map(function(p,i){return self._row(p,self._hl('reg',sg3k[i]),'');}).join(''));

    var sg4k=['io','is','it','imus','itis','iunt'];
    html += this._konjSection('4. Konjugation (i-Konjugation)', 'audire – audiō',
      persons.map(function(p,i){return self._row(p,self._hl('aud',sg4k[i]),'');}).join(''));

    var esse=['sum','es','est','sumus','estis','sunt'];
    html += this._konjSection('esse – Präsens (unregelmäßig)', 'esse (sein)',
      persons.map(function(p,i){return self._row(p,'<span class="gt-ending">'+esse[i]+'</span>','');}).join(''));

    el.innerHTML = html;
  }
};
