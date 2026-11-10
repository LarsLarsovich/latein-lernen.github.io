'use strict';

// ── Quiz-Ansichten: Einstellungen, Abfrage, Ergebnis ──────────
// Vokabeln und Pronomina benutzen dasselbe Quiz. Damit das HTML nicht in zwei
// Dateien doppelt steht, wird es hier einmal eingefügt (QuizViews.mount()).
// Die Abfrage-Logik selbst steht in quiz-engine.js.
const QuizViews = {
  HTML: `
<main id="page-setup" class="page">
  <div class="back-row">
    <button class="back-btn" onclick="App.goBack()">← Zurück</button>
  </div>
  <div class="setup-card">
    <div class="setup-title" id="setup-title"></div>
    <div class="setup-desc" id="setup-desc"></div>

    <!-- Pronomen setup -->
    <div id="setup-pronomen" class="phase-section">
      <div class="phase-label">Welche Phasen möchtest du üben?</div>
      <div class="phase-options">
        <label class="phase-opt"><input type="checkbox" name="phase" value="1" checked /><span class="phase-box"><span class="phase-num">1</span><span class="phase-name">Singular</span></span></label>
        <label class="phase-opt"><input type="checkbox" name="phase" value="2" /><span class="phase-box"><span class="phase-num">2</span><span class="phase-name">Plural</span></span></label>
        <label class="phase-opt"><input type="checkbox" name="phase" value="3" /><span class="phase-box"><span class="phase-num">3</span><span class="phase-name">Gemischt</span></span></label>
        <label class="phase-opt"><input type="checkbox" name="phase" value="4" /><span class="phase-box"><span class="phase-num">4</span><span class="phase-name">Deutsch → Latein</span></span></label>
        <label class="phase-opt"><input type="checkbox" name="phase" value="5" /><span class="phase-box"><span class="phase-num">5</span><span class="phase-name">Latein → Deutsch</span></span></label>
      </div>
      <div class="shuffle-option">
        <label class="shuffle-opt">
          <input type="checkbox" id="shuffle-within" />
          <span class="shuffle-box">Karten innerhalb der Kategorien mischen</span>
        </label>
      </div>
      <div class="shuffle-option shuffle-option--sm">
        <label class="shuffle-opt">
          <input type="checkbox" id="pruefung-pronomen" />
          <span class="shuffle-box">Prüfungsmodus <span class="pruefung-hint">(keine Wiederholung)</span></span>
        </label>
      </div>
    </div>

    <!-- Vokabel setup -->
    <div id="setup-vokabel" class="phase-section hidden">
      <div class="phase-label">In welche Richtung willst du abgefragt werden?</div>
      <div class="phase-options">
        <label class="phase-opt"><input type="radio" name="vphase" value="lat-de" onchange="App.onVokDirectionChange()" /><span class="phase-box"><span class="phase-icon">🏛️</span><span class="phase-name">Latein → Deutsch</span></span></label>
        <label class="phase-opt"><input type="radio" name="vphase" value="de-lat" id="vphase-de-lat" onchange="App.onVokDirectionChange()" /><span class="phase-box"><span class="phase-icon">🇩🇪</span><span class="phase-name">Deutsch → Latein</span></span></label>
      </div>
      <div id="de-lat-options" class="hidden de-lat-options-box">
        <div class="de-lat-options-hint">Zusätzlich zum Wort verlangen:</div>
        <label class="shuffle-opt shuffle-opt--mb">
          <input type="checkbox" id="vok-require-fall2" onchange="App.updateDeLatExample()" />
          <span class="shuffle-box">2. Fall bei Nomen · 1. Person Präsens bei Verben</span>
        </label>
        <label class="shuffle-opt shuffle-opt--mb">
          <input type="checkbox" id="vok-require-genus" onchange="App.updateDeLatExample()" />
          <span class="shuffle-box">Geschlecht (m./f./n.) bei Nomen</span>
        </label>
        <label class="shuffle-opt shuffle-opt--mb">
          <input type="checkbox" id="vok-require-perf" onchange="App.updateDeLatExample()" />
          <span class="shuffle-box">1. Person Perfekt bei Verben</span>
        </label>
        <div class="de-lat-example-row" id="de-lat-example"></div>
      </div>
      <div class="shuffle-option shuffle-option--gap">
        <label class="shuffle-opt">
          <input type="checkbox" id="vok-shuffle" />
          <span class="shuffle-box">Karten mischen</span>
        </label>
      </div>
      <div class="shuffle-option shuffle-option--sm">
        <label class="shuffle-opt">
          <input type="checkbox" id="pruefung-vokabel" />
          <span class="shuffle-box">Prüfungsmodus <span class="pruefung-hint">(keine Wiederholung)</span></span>
        </label>
      </div>

    </div>

    <div class="setup-hint hidden" id="setup-direction-hint">Wähle zuerst eine Richtung aus.</div>
    <button class="start-btn" id="setup-start-btn" onclick="App.startQuiz()">Quiz starten →</button>
  </div>
</main>

<main id="page-quiz" class="page">
  <div class="back-row">
    <button class="back-btn" onclick="App.goHome()">← Abbrechen</button>
    <div class="phase-badge" id="quiz-phase-badge"></div>
    <div class="quiz-progress-text" id="quiz-progress-text"></div>
    <button class="report-float-btn" onclick="Quiz.reportCurrent()" title="Fehler melden">⚑ Melden</button>
  </div>
  <div class="quiz-area">
    <div class="progress-bar-wrap" id="progress-bar-wrap"><div class="progress-bar-fill" id="progress-bar"></div></div>
    <div class="q-card">
      <div class="q-meta" id="q-meta"></div>
      <div class="q-main" id="q-main"></div>
    </div>
    <div class="answer-wrap">
      <input type="text" id="answer-input" class="answer-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
      <button class="check-btn" onclick="Quiz.check()">Prüfen</button>
    </div>
    <div class="feedback-box hidden" id="feedback-box"></div>
    <button class="next-btn hidden" id="next-btn" onclick="Quiz.next()">Weiter →</button>
  </div>
</main>

<main id="page-result" class="page">
  <div class="result-wrap">
    <div class="result-icon" id="result-icon">🏛️</div>
    <div class="result-score" id="result-score"></div>
    <div class="result-label" id="result-label">richtig beantwortet</div>
    <div class="result-msg" id="result-msg"></div>
    <div class="result-chart-wrap" id="result-chart-wrap">
      <canvas id="result-chart" width="200" height="200"></canvas>
      <div class="result-chart-legend" id="result-chart-legend"></div>
    </div>
    <div class="result-pct" id="result-pct"></div>
    <div class="result-btns">
      <button class="start-btn" onclick="App.goHome()">Zum Menü</button>
      <button class="outline-btn" id="result-nochmal-btn" onclick="App.replaySetup()">Nochmal</button>
    </div>
  </div>
</main>
`,

  // Fügt die drei Ansichten in die Seite ein (vor der Fußzeile)
  mount() {
    const box = document.createElement('div');
    box.innerHTML = this.HTML;
    document.querySelector('main.page:last-of-type').after(...box.children);

    // Enter = Prüfen bzw. Weiter
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || App._activePage() !== 'quiz') return;
      if (!Quiz.answered) Quiz.check(); else Quiz.next();
    });
  }
};

Object.assign(App, {

  // Richtung gewählt: Zusatz-Optionen nur bei Deutsch → Latein zeigen
  onVokDirectionChange() {
    const dir   = document.querySelector('input[name="vphase"]:checked')?.value || null;
    const deLat = dir === 'de-lat';
    document.getElementById('de-lat-options').classList.toggle('hidden', !deLat);
    if (!deLat) {
      ['vok-require-fall2','vok-require-genus','vok-require-perf'].forEach(id => {
        document.getElementById(id).checked = false;
      });
    }
    this._setSetupReady(!!dir);
    this.updateDeLatExample();
  },

  // Start-Knopf erst freigeben, wenn eine Richtung gewählt ist
  _setSetupReady(ready) {
    document.getElementById('setup-start-btn').disabled = !ready;
    document.getElementById('setup-direction-hint').classList.toggle('hidden', ready);
  },

  updateDeLatExample() {
    const f2   = document.getElementById('vok-require-fall2')?.checked;
    const gen  = document.getElementById('vok-require-genus')?.checked;
    const perf = document.getElementById('vok-require-perf')?.checked;
    const el   = document.getElementById('de-lat-example');
    if (!el) return;
    const noun = 'schola' + (f2 ? ', ae' : '') + (gen ? ' f.' : '');
    const verb = 'sedere' + (f2 ? ', sedeo' : '') + (perf ? ', sedi' : '');
    const examples = [noun, ...(f2 || perf ? [verb] : [])];
    el.innerHTML = 'Eingabe z. B.: ' + examples.map(e => `<code>${e}</code>`).join(' · ')
      + (f2 ? '<br>Die Endung reicht: <code>ae</code> statt <code>scholae</code>.' : '');
  },

  startQuiz() {
    if (state.quizType === 'vokabel') {
      const dir = document.querySelector('input[name="vphase"]:checked')?.value;
      if (!dir) { this._setSetupReady(false); return; }
      const modes   = [dir];
      const shuffle = document.getElementById('vok-shuffle').checked;
      VokabelQuiz._requireFall2 = dir === 'de-lat' && document.getElementById('vok-require-fall2').checked;
      VokabelQuiz._requireGenus = dir === 'de-lat' && document.getElementById('vok-require-genus').checked;
      VokabelQuiz._requirePerf  = dir === 'de-lat' && document.getElementById('vok-require-perf').checked;
      const rows    = state.currentVokabelTable.rows || [];
      const questions = VokabelQuiz.build(rows, modes, shuffle);
      if (!questions.length) { alert('Keine Vokabeln für diese Auswahl vorhanden.'); return; }
      Quiz.startVokabel(questions, state.currentVokabelTable.name);
    } else {
      const checked = [...document.querySelectorAll('input[name="phase"]:checked')];
      if (!checked.length) { alert('Bitte wähle mindestens eine Phase.'); return; }
      Quiz.start(state.currentQuiz, checked.map(c=>parseInt(c.value)), document.getElementById('shuffle-within').checked);
    }
  }
});
