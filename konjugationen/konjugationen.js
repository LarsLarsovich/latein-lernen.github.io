'use strict';

// ── Konjugationen: Inhalt der Tafeln ──────────────────────────
Object.assign(GrammarTables, {

  renderKonjugationen() {
    const el = document.getElementById('gt-konj-content');
    if (!el) return;
    const persons = ['1. Sg. (ich)','2. Sg. (du)','3. Sg. (er/sie/es)','1. Pl. (wir)','2. Pl. (ihr)','3. Pl. (sie)'];
    const self = this;
    let html = '';

    // 1.–4. Konjugation: nur Präsens
    const sg1k=['o','as','at','amus','atis','ant'];
    html += this._konjSection('1. Konjugation (a-Konjugation)', 'amare – amō',
      persons.map(function(p,i){return '<tr><td class="case-cell">'+escHtml(p)+'</td><td>'+self._hl('am',sg1k[i])+'</td></tr>';}).join(''));

    const sg2k=['eo','es','et','emus','etis','ent'];
    html += this._konjSection('2. Konjugation (e-Konjugation)', 'monēre – moneō',
      persons.map(function(p,i){return '<tr><td class="case-cell">'+escHtml(p)+'</td><td>'+self._hl('mon',sg2k[i])+'</td></tr>';}).join(''));

    const sg3k=['o','is','it','imus','itis','unt'];
    html += this._konjSection('3. Konjugation (konsonantisch)', 'regere – regō',
      persons.map(function(p,i){return '<tr><td class="case-cell">'+escHtml(p)+'</td><td>'+self._hl('reg',sg3k[i])+'</td></tr>';}).join(''));

    const sg4k=['io','is','it','imus','itis','iunt'];
    html += this._konjSection('4. Konjugation (i-Konjugation)', 'audire – audiō',
      persons.map(function(p,i){return '<tr><td class="case-cell">'+escHtml(p)+'</td><td>'+self._hl('aud',sg4k[i])+'</td></tr>';}).join(''));

    // ── Perfekt, Plusquamperfekt & Imperfekt (einmal, für alle Konjugationen) ──
    html += '<div class="gt-section">';
    html += '<div class="gt-section-title">Perfekt, Plusquamperfekt & Imperfekt<span class="gt-example">Beispiel: <em>amare</em></span></div>';
    html += this._zeitTable('Perfekt', 'ich habe geliebt / ich liebte', 'amav', ['i','isti','it','imus','istis','erunt'], this);
    html += this._zeitTable('Plusquamperfekt', 'ich hatte geliebt', 'amav', ['eram','eras','erat','eramus','eratis','erant'], this);
    html += this._zeitTable('Imperfekt', 'ich liebte (wiederholt / andauernd)', 'ama', ['bam','bas','bat','bamus','batis','bant'], this);
    html += '</div>';

    // ── esse – Präsens, Perfekt, Plusquamperfekt ──
    const esse=['sum','es','est','sumus','estis','sunt'];
    const esseRows = persons.map(function(p,i){
      return '<tr><td class="case-cell">'+escHtml(p)+'</td><td><span class="gt-ending">'+esse[i]+'</span></td></tr>';
    }).join('');
    html += '<div class="gt-section">' +
      '<div class="gt-section-title">esse – sein (unregelmäßig)' +
        '<span class="gt-example">Beispiel: <em>esse (sein)</em></span></div>' +
      '<div class="gt-tense-title">Präsens <span class="gt-tense-de">ich bin</span></div>' +
      '<div class="dekl-table-wrap"><table class="dekl-table gt-table">' +
        '<thead><tr><th>Person</th><th>Form</th></tr></thead><tbody>' + esseRows + '</tbody></table></div>' +
      self._zeitTable('Perfekt', 'ich bin gewesen / ich war', 'fu', ['i','isti','it','imus','istis','erunt'], self) +
      self._zeitTable('Plusquamperfekt', 'ich war gewesen', 'fu', ['eram','eras','erat','eramus','eratis','erant'], self) +
      self._zeitTable('Imperfekt', 'ich war (andauernd)', 'er', ['am','as','at','amus','atis','ant'], self) +
    '</div>';

    el.innerHTML = html;
  }
});
