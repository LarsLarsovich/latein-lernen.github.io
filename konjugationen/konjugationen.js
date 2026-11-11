'use strict';

// ── Konjugationen: Inhalt der Tafeln ──────────────────────────
Object.assign(GrammarTables, {

  renderKonjugationen() {
    const el = document.getElementById('gt-konj-content');
    if (!el) return;
    const persons = ['1. Sg. (ich)','2. Sg. (du)','3. Sg. (er/sie/es)','1. Pl. (wir)','2. Pl. (ihr)','3. Pl. (sie)'];
    const self = this;
    let html = '';

    // 1.–4. Konjugation: Präsens
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

    // ── Die weiteren Zeiten (einmal, für alle Konjugationen) ──
    // Reihenfolge wie in der Vokabel-Detailansicht: Imperfekt, Futur I, Perfekt, Plusquamperfekt.
    // Das Futur I gibt es in zwei Arten: mit -bo (1./2. Konjugation) und mit -am (3./4. Konjugation).
    html += '<div class="gt-section">';
    html += '<div class="gt-section-title">Imperfekt, Futur I, Perfekt & Plusquamperfekt<span class="gt-example">Beispiel: <em>amare</em></span></div>';
    html += this._zeitTable('Imperfekt', 'ich liebte (wiederholt / andauernd)', 'ama', ['bam','bas','bat','bamus','batis','bant'], this);
    html += this._zeitTable('Futur I – 1. und 2. Konjugation', 'ich werde lieben', 'ama', ['bo','bis','bit','bimus','bitis','bunt'], this);
    html += this._zeitTable('Futur I – 3. und 4. Konjugation', 'ich werde lenken (regere)', 'reg', ['am','es','et','emus','etis','ent'], this);
    html += this._zeitTable('Perfekt', 'ich habe geliebt / ich liebte', 'amav', ['i','isti','it','imus','istis','erunt'], this);
    html += this._zeitTable('Plusquamperfekt', 'ich hatte geliebt', 'amav', ['eram','eras','erat','eramus','eratis','erant'], this);
    html += '</div>';

    // esse steht nicht mehr hier, sondern mit allen Formen bei den unregelmäßigen Verben
    html += '<p class="gt-note">esse, posse, ire und andere unregelmäßige Verben findest du unter ' +
      '<a href="' + App.topicUrl('unregelmaessige') + '">Unregelmäßige Verben</a>.</p>';

    el.innerHTML = html;
  }
});
