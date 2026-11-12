'use strict';

// ── Vokabel Quiz Engine ───────────────────────────────────────
// Deutsch → Latein wird in Bestandteile zerlegt und einzeln geprüft:
//   Nomen:    Wort, 2. Fall, Geschlecht      (femina, feminae f.)
//   Verb:     Infinitiv, 1. Person Präsens, 1. Person Perfekt (amare, amo, amavi)
//   Adjektiv: alle Geschlechter              (bonus/a/um)
// Satzzeichen sind egal: "femina, ae f." = "femina ae f" = "femina; ae, f."
const VokabelQuiz = {
  _requireFall2: false, _requireGenus: false, _requirePerf: false,

  _has(v) { return !!v && !['–', '-', '#'].includes(v.trim()); },

  // Kleinbuchstaben, ohne Längenzeichen, ohne Anmerkungen wie "(+Akk.)"
  _norm(s) {
    const macron = { 'ā':'a', 'ē':'e', 'ī':'i', 'ō':'o', 'ū':'u', 'ȳ':'y' };
    return (s || '').toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[āēīōūȳ]/g, c => macron[c])
      .trim();
  },

  // Trennzeichen: Leerzeichen , ; .   →   "femina, ae, f." = ["femina","ae","f"]
  _tokens(s) { return this._norm(s).split(/[\s,;.]+/).filter(Boolean); },

  _genusLetter(tok) {
    return /^(m|f|n|mask|fem|neutr|maskulinum|femininum|neutrum)$/.test(tok) ? tok[0] : null;
  },

  _lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    return d[a.length][b.length];
  },

  // Welche Bestandteile hat diese Vokabel?
  _parts(r) {
    const type = Latin.detectType(r);
    const isVerb = type === 'verb';
    return {
      type,
      fall2: this._has(r.fall2) ? r.fall2.trim() : '',
      genus: (!isVerb && this._has(r.genus)) ? r.genus.trim() : '',
      perf:  (type !== 'noun' && this._has(r.perf)) ? r.perf.trim() : '',
      fall2Label: isVerb ? '1. Person Präsens' : '2. Fall',
      genusLabel: 'Geschlecht',
      perfLabel:  '1. Person Perfekt'
    };
  },

  // Vollständige lateinische Angabe: "femina, feminae f." · "amare, amo, amavi" · "bonus/a/um"
  formatLatin(r) {
    const p = this._parts(r);
    let s = (r.lat || '?').split('%').map(x => x.trim()).filter(Boolean).join(', ');
    if (p.fall2) s += ', ' + p.fall2;
    if (p.genus) s += ' ' + p.genus;
    if (p.perf)  s += ', ' + p.perf;
    return s;
  },

  // Alle deutschen Bedeutungen: "fröhlich, froh"
  formatGerman(r) {
    return (r.de || '').split('%').map(x => x.trim()).filter(Boolean).join(', ') || '?';
  },

  // Länge des gemeinsamen Wortanfangs (für Kurzformen wie "ae" statt "feminae")
  _commonPrefix(a, b) {
    let k = 0;
    while (k < a.length && k < b.length && a[k] === b[k]) k++;
    return k;
  },

  // Stimmt eine Form? Erlaubt ist die ganze Form oder nur die Endung.
  // "ae"/"feminae" für feminae, "inis" für fluminis (aber nicht nur "is").
  _formMatches(attempt, full, base) {
    const a = attempt.replace(/^-/, '');
    const f = this._tokens(full).join(' ');
    if (!a || !f) return false;
    if (a === f) return true;
    if (f.endsWith(' sum') && a === f.slice(0, -4)) return true;   // "gavisus" für "gavisus sum"
    if (a.includes(' ') || !f.endsWith(a)) return false;
    const lastF = f.split(' ').pop();
    const lastB = (this._tokens(base).pop() || '');
    const need  = Math.max(1, lastF.length - this._commonPrefix(lastF, lastB));
    return a.length >= need;
  },

  // Lateinisches Grundwort prüfen. Liefert { ok, html, rest }.
  _matchLat(variant, tok) {
    const display = variant.trim();
    const slash   = display.includes('/') && !/\s/.test(display);

    if (slash) {
      // Mehrere Formen (bonus/a/um, hic/haec/hoc): die erste ist Pflicht,
      // weitere dürfen dabei sein – als Endung oder ausgeschrieben.
      const exp   = display.split('/').map(x => this._norm(x)).filter(Boolean);
      const shown = display.split('/').map(x => x.trim()).filter(Boolean);
      const given = tok.flatMap(t => t.split('/')).filter(Boolean);
      const first = given[0] || '';
      const firstOk = first === exp[0];
      const partOk = (g, e) => {
        const x = g.replace(/^-/, '');
        return x === e || (x.length > e.length && x.endsWith(e) && x[0] === exp[0][0]) || (x.length >= 1 && e.endsWith(x));
      };
      let ok = firstOk, used = 1;
      const marks = [false];
      for (let i = 1; i < exp.length && used < given.length; i++, used++) {
        const good = partOk(given[used], exp[i]);
        marks[i] = !good;
        if (!good) ok = false;
      }
      const html = shown.map((s, i) => {
        if (i === 0) return firstOk ? escHtml(s) : this._markDiff(first, s);
        return marks[i] ? `<mark class="diff-wrong">${escHtml(s)}</mark>` : escHtml(s);
      }).join('/');
      return { ok, html, rest: given.slice(used), dist: this._lev(first, exp[0]) };
    }

    const exp     = this._tokens(display);
    const attempt = tok.slice(0, exp.length).join(' ');
    const ok      = attempt === exp.join(' ');
    const plain   = display.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const note    = (display.match(/\([^)]*\)/g) || []).join(' ');
    const html    = (ok ? escHtml(plain) : this._markDiff(attempt, plain)) + (note ? ' ' + escHtml(note) : '');
    return { ok, html, rest: tok.slice(exp.length), dist: this._lev(attempt, exp.join(' ')) };
  },

  // Wie diffHighlight, markiert aber die ganze Form, wenn nur Buchstaben zu viel waren
  _markDiff(attempt, correct) {
    const html = diffHighlight(attempt, correct);
    return html.includes('<mark') ? html : `<mark class="diff-wrong">${html}</mark>`;
  },

  // Markiert eine falsch eingegebene Form. Bei Kurzformen wird nur die Endung verglichen.
  _diffForm(attempt, full, base) {
    const a = attempt.replace(/^-/, '');
    if (a.length >= full.length - 2) return this._markDiff(a, full);
    const k = Math.min(this._commonPrefix(this._norm(full), this._norm(base)), full.length - 1);
    return escHtml(full.slice(0, k)) + this._markDiff(a, full.slice(k));
  },

  // Eingabe für Deutsch → Latein auswerten.
  // require = { fall2, genus, perf }: was zusätzlich verlangt ist.
  analyse(input, r, require = {}) {
    const p = this._parts(r);
    let tok = this._tokens(input);

    // Geschlecht steht am Ende: "f." / "f" / "fem."
    let genusIn = null;
    if (tok.length > 1) {
      const g = this._genusLetter(tok[tok.length - 1]);
      if (g) { genusIn = g; tok = tok.slice(0, -1); }
    }

    // Grundwort: bei mehreren gültigen Varianten (a%b) die passendste nehmen
    // Klammern im lateinischen Wort sind freiwillig: "in (+Abl.)" → "in" reicht.
    // Hängt die Klammer direkt am Wort ("ne(c)"), gilt auch die Form mit Inhalt ("nec").
    const variants = [];
    (r.lat || '').split('%').map(x => x.trim()).filter(Boolean).forEach(v => {
      variants.push(v);
      if (/\S\([^)\s]+\)|\([^)\s]+\)\S/.test(v)) variants.push(v.replace(/[()]/g, ''));
    });
    let lat = null;
    variants.forEach(v => {
      const m = this._matchLat(v, tok);
      if (!lat || (m.ok && !lat.ok) || (m.ok === lat.ok && m.dist < lat.dist)) lat = m;
    });
    if (!lat) lat = { ok: false, html: '', rest: tok, dist: 99 };

    // Übrige Eingabe auf 2. Fall / 1. Person Präsens und Perfekt verteilen
    const base = this._tokens(variants[0] || '').join(' ');
    let fall2In = null, perfIn = null;
    const rest = lat.rest;
    if (p.fall2 && p.perf) {
      const nF = this._tokens(p.fall2).length;
      if (rest.length > nF) {
        fall2In = rest.slice(0, nF).join(' ');
        perfIn  = rest.slice(nF).join(' ');
      } else if (rest.length) {
        // Nur ein Teil angegeben: gehört er zum Präsens oder zum Perfekt?
        const a = rest.join(' ');
        const isF = this._formMatches(a, p.fall2, base), isP = this._formMatches(a, p.perf, base);
        if (isF || (!isP && this._lev(a, this._norm(p.fall2)) <= this._lev(a, this._norm(p.perf)))) fall2In = a;
        else perfIn = a;
      }
    } else if (p.fall2) {
      if (rest.length) fall2In = rest.join(' ');
    } else if (p.perf) {
      if (rest.length) perfIn = rest.join(' ');
    } else if (rest.length) {
      lat.ok = false;                       // zu viel eingegeben
      if (!lat.html.includes('<mark')) lat.html = `<mark class="diff-wrong">${lat.html}</mark>`;
    }

    const item = (key, label, full, given, good, required, html) => {
      if (!full) return null;
      let status;
      if (given == null) status = required ? 'missing' : 'skipped';
      else               status = good ? 'ok' : 'wrong';
      return { key, label, full, status, html: status === 'wrong' ? html() : null };
    };
    const items = [
      item('fall2', p.fall2Label, p.fall2, fall2In, fall2In != null && this._formMatches(fall2In, p.fall2, base),
           require.fall2, () => this._diffForm(fall2In, p.fall2, variants[0] || '')),
      item('genus', p.genusLabel, p.genus, genusIn, genusIn != null && genusIn === this._norm(p.genus)[0],
           require.genus, () => `<mark class="diff-wrong">${escHtml(p.genus)}</mark>`),
      item('perf',  p.perfLabel,  p.perf,  perfIn,  perfIn != null && this._formMatches(perfIn, p.perf, base),
           require.perf,  () => this._diffForm(perfIn, p.perf, variants[0] || ''))
    ].filter(Boolean);

    const wrong   = items.filter(i => i.status === 'wrong');
    const missing = items.filter(i => i.status === 'missing');
    return {
      lat, items, wrong, missing,
      correct: lat.ok && !wrong.length && !missing.length,
      almost:  lat.ok && !wrong.length && missing.length > 0,
      full: this.formatLatin(r)
    };
  },

  _list(labels) {
    if (labels.length <= 1) return labels.join('');
    return labels.slice(0, -1).join(', ') + ' und ' + labels[labels.length - 1];
  },

  // Rückmeldung für eine nicht (ganz) richtige Antwort
  feedbackHtml(a) {
    const show = it => {
      if (it.status === 'wrong')   return it.html;
      if (it.status === 'missing') return `<mark class="diff-missing">${escHtml(it.full)}</mark>`;
      return escHtml(it.full);
    };
    let line = a.lat.html;
    a.items.forEach(it => { line += (it.key === 'genus' ? ' ' : ', ') + show(it); });

    const missing = this._list(a.missing.map(i => i.label));
    if (a.almost) {
      return `Fast richtig – ${escHtml(missing)} vergessen.<div class="feedback-answer">${line}</div>`;
    }
    const wrongLabels = [...(a.lat.ok ? [] : ['Wort']), ...a.wrong.map(i => i.label)];
    const notes = [];
    if (wrongLabels.length) notes.push('Falsch: ' + this._list(wrongLabels));
    if (missing)            notes.push('Vergessen: ' + missing);
    return `✗ Richtig: ${line}<div class="feedback-variants">${escHtml(notes.join(' · '))}</div>`;
  },

  // Latein → Deutsch: eine der Bedeutungen genügt; Klammern sind freiwillig (siehe utils.js)
  _checkDeAnswer(input, r) { return isCorrect(input, r.de || ''); },

  // Fragezettel für eine Liste von Vokabelzeilen bauen
  build(rows, modes, shuffle) {
    const questions = [];

    rows.forEach(r => {
      if (modes.includes('lat-de')) {
        const deRaw = r.de || '';
        questions.push({
          mode: 'lat-de',
          meta: '',
          hint: this._has(r.dekl) ? r.dekl : '',
          main: this.formatLatin(r),
          placeholder: 'Deutsch eingeben…',
          answer: deRaw,
          answerDisplay: deRaw.split('%').map(s=>s.trim()).join(', '),
          r
        });
      }
      if (modes.includes('de-lat')) {
        questions.push({
          mode: 'de-lat',
          meta: '',
          hint: '',
          main: this.formatGerman(r),
          placeholder: 'Latein eingeben…',
          answer: '_de-lat_',
          answerDisplay: this.formatLatin(r),
          requireFall2: !!this._requireFall2,
          requireGenus: !!this._requireGenus,
          requirePerf:  !!this._requirePerf,
          r
        });
      }
    });

    return shuffle ? questions.sort(() => Math.random() - 0.5) : questions;
  }
};

// ── Quiz Engine ───────────────────────────────────────────────
const Quiz = {
  questions: [], idx: 0, score: 0, answered: false,

  start(quiz, phases, shuffle) {
    const pruefung = document.getElementById('pruefung-pronomen')?.checked || false;
    this._initQuiz(this.build(quiz, phases, shuffle), false, pruefung);
    App.showPage('quiz', quiz.name);
    this.render();
  },

  startVokabel(questions, name) {
    const pruefung = (this._pendingPruefung !== undefined ? this._pendingPruefung : null)
      ?? document.getElementById('pruefung-vokabel')?.checked
      ?? false;
    this._pendingPruefung = undefined;
    this._initQuiz(questions, true, pruefung);
    App.showPage('quiz', name);
    this.render();
  },

  _initQuiz(questions, isVokabel, pruefung) {
    this._allQuestions  = [...questions];
    this._queue         = [...questions]; // active queue
    this._pending       = [];            // wrong answers waiting to be re-inserted
    this.idx            = 0;            // position in _queue
    this._done          = 0;            // how many correctly answered (for progress)
    this.score          = 0;
    this.answered       = false;
    this._isVokabel     = isVokabel;
    this._pruefung      = pruefung;
    this._firstCorrect  = {};           // qKey → attempt number (0=first try)
    this._attempt       = {};           // qKey → how many times answered wrong so far
    // For result chart: track attempt counts
    this._attemptCounts = {};           // attempt number → count of questions correct on that attempt
    // expose questions array for render() compatibility
    this.questions      = this._queue;
  },

  build(q, phases, shuffle) {
    let qs = [];
    const push = (list, shuf) => {
      qs = [...qs, ...(shuf ? list.sort(() => Math.random() - .5) : list)];
    };

    if (phases.includes(1))
      push(GENDERS.flatMap(g => CASES.map(c => ({
        phase: 1,
        meta: `${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
        main: 'Lateinische Form?', placeholder: 'Latein eingeben…',
        answer: q.sg[g][c]||'', answerDisplay: q.sg[g][c]||''
      }))), shuffle);

    if (phases.includes(2))
      push(GENDERS.flatMap(g => CASES.map(c => ({
        phase: 2,
        meta: `${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
        main: 'Lateinische Form?', placeholder: 'Latein eingeben…',
        answer: q.pl[g][c]||'', answerDisplay: q.pl[g][c]||''
      }))), shuffle);

    if (phases.includes(3)) {
      const p = GENDERS.flatMap(g => CASES.map(c => {
        const sg = Math.random() > .5, form = sg ? q.sg[g][c] : q.pl[g][c];
        return { phase: 3, meta: `${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  ${sg?'Singular':'Plural'}`,
          main: 'Lateinische Form?', placeholder: 'Latein eingeben…',
          answer: form||'', answerDisplay: form||'' };
      }));
      qs = [...qs, ...p.sort(() => Math.random() - .5)];
    }

    if (phases.includes(4)) {
      let p = GENDERS.flatMap(g => CASES.flatMap(c => [
        { phase:4, meta:`Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
          main: q.de_sg[g][c]||'?', placeholder:'Latein eingeben…',
          answer: q.sg[g][c]||'', answerDisplay: q.sg[g][c]||'' },
        { phase:4, meta:`Deutsch → Latein  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
          main: q.de_pl[g][c]||'?', placeholder:'Latein eingeben…',
          answer: q.pl[g][c]||'', answerDisplay: q.pl[g][c]||'' }
      ])).sort(() => Math.random() - .5);
      qs = [...qs, ...(shuffle ? p : p.slice(0,20))];
    }

    if (phases.includes(5)) {
      let p = GENDERS.flatMap(g => CASES.flatMap(c => [
        { phase:5, meta:`Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Singular`,
          main: q.sg[g][c]||'?', placeholder:'Deutsch eingeben…',
          answer: q.de_sg[g][c]||'', answerDisplay: q.de_sg[g][c]||'' },
        { phase:5, meta:`Latein → Deutsch  ·  ${CASE_NAMES[c]}  ·  ${GENDER_NAMES[g]}  ·  Plural`,
          main: q.pl[g][c]||'?', placeholder:'Deutsch eingeben…',
          answer: q.de_pl[g][c]||'', answerDisplay: q.de_pl[g][c]||'' }
      ])).sort(() => Math.random() - .5);
      qs = [...qs, ...(shuffle ? p : p.slice(0,20))];
    }
    return qs;
  },

  render() {
    const q      = this._queue[this.idx];
    const total  = this._allQuestions.length;
    const labels = { 1:'Phase 1 – Singular', 2:'Phase 2 – Plural', 3:'Phase 3 – Gemischt',
                     4:'Phase 4 – Deutsch → Latein', 5:'Phase 5 – Latein → Deutsch' };
    const badge  = this._isVokabel ? (q.meta||'') : (labels[q.phase]||'');
    document.getElementById('quiz-phase-badge').textContent   = badge;
    document.getElementById('quiz-progress-text').textContent = `${this._done} / ${total}`;
    this._renderProgressBar();
    document.getElementById('q-meta').textContent = this._isVokabel ? (q.hint||'') : q.meta;
    document.getElementById('q-main').textContent = q.main;
    const inp = document.getElementById('answer-input');
    inp.placeholder = q.placeholder||''; inp.value = ''; inp.disabled = false; inp.focus();
    document.getElementById('feedback-box').className = 'feedback-box hidden';
    document.getElementById('next-btn').classList.add('hidden');
    this.answered = false;
  },

  // Eindeutiger Schlüssel pro Frage (für Wiederholungen und Auswertung)
  _qKey(q) { return q.main + '||' + (q.answer||'') + '||' + (q.r ? (q.r.lat||'') : ''); },

  _renderProgressBar() {
    const wrap = document.getElementById('progress-bar-wrap');
    if (!wrap) return;
    const total = this._allQuestions.length;
    if (!total) return;
    const pct = (this._done / total * 100).toFixed(1);
    wrap.innerHTML = '<div class="progress-bar-fill" id="progress-bar"></div>';
    document.getElementById('progress-bar').style.width = pct + '%';
  },

  check() {
    if (this.answered) return;
    const inp = document.getElementById('answer-input');
    const val = inp.value.trim();
    if (!val) return;
    this.answered = true; inp.disabled = true;
    const q   = this.questions[this.idx];
    const fb  = document.getElementById('feedback-box');

    let correct       = false;
    let displayAnswer = q.answerDisplay || q.answer;
    let deLat         = null;   // Auswertung für Deutsch → Latein

    if (q.answer === '_de-lat_') {
      deLat   = VokabelQuiz.analyse(val, q.r, { fall2: q.requireFall2, genus: q.requireGenus, perf: q.requirePerf });
      correct = deLat.correct;
    } else if (q.mode === 'lat-de' && this._isVokabel) {
      correct       = VokabelQuiz._checkDeAnswer(val, q.r||{de: q.answer});
      displayAnswer = q.answerDisplay;
    } else {
      correct       = isCorrect(val, q.answer);
      const acc     = parseAnswers(q.answer);
      displayAnswer = acc.length > 1 ? acc.join(' / ') : (q.answerDisplay||q.answer);
    }

    const qKey = this._qKey(q);

    if (correct) {
      this.score++;
      this._done++;
      if (deLat && deLat.items.length) fb.innerHTML = `✓ Richtig! <span class="feedback-full">${escHtml(deLat.full)}</span>`;
      else       fb.textContent = '✓ Richtig!';
      fb.className   = 'feedback-box correct';
      // Track which attempt this was correct on (0 = first try)
      const attempts = this._attempt[qKey] || 0;
      if (this._firstCorrect[qKey] === undefined) {
        this._firstCorrect[qKey] = attempts;
        this._attemptCounts[attempts] = (this._attemptCounts[attempts]||0) + 1;
      }
    } else if (deLat) {
      fb.innerHTML = VokabelQuiz.feedbackHtml(deLat);
      fb.className = 'feedback-box ' + (deLat.almost ? 'almost' : 'wrong');
    } else {
      const variants  = parseAnswers(displayAnswer);
      const bestMatch = variants.reduce((best, ans) => {
        let d = 0;
        const a = val.toLowerCase(), b = ans.toLowerCase();
        const max = Math.max(a.length, b.length);
        for (let i = 0; i < max; i++) { if (a[i] !== b[i]) d++; }
        return (!best || d < best.d) ? {ans, d} : best;
      }, null);
      const showAnswer  = bestMatch ? bestMatch.ans : (displayAnswer||'').replace(/%/g,' / ');
      const highlighted = diffHighlight(val, showAnswer);
      const allVariants = variants.length > 1
        ? `<div class="feedback-variants">${variants.map(v=>escHtml(v)).join(' <span>·</span> ')}</div>`
        : '';
      fb.innerHTML = `✗ Richtig: ${highlighted}${allVariants}`;
      fb.className = 'feedback-box wrong';

    }

    if (!correct) {
      // Spaced repetition: re-insert after 5 others
      if (!this._pruefung) {
        this._attempt[qKey] = (this._attempt[qKey]||0) + 1;
        // Insert a copy of the question 5 positions ahead in the queue
        const insertAt = Math.min(this.idx + 6, this._queue.length); // +1 for current, +5 after
        this._queue.splice(insertAt, 0, {...q, _retry: true});
      }
    }
    this._renderProgressBar();
    document.getElementById('next-btn').classList.remove('hidden');
  },

  next() {
    this.idx++;
    if (this.idx >= this._queue.length) {
      this.showResult();
    } else {
      this.render();
    }
  },

  reportCurrent() {
    const q = this.questions[this.idx];
    if (!q) { Report.open('Quiz'); return; }
    const r = q.r;
    if (r && this._isVokabel) {
      const t = state.vokabel.find(x => (x.rows||[]).includes(r));
      if (t) {
        const idx   = t.rows.indexOf(r);
        const label = `Quiz: ${r.lat||q.main||'?'} (${t.name})`;
        Report._encodedContext = `QUIZ:${t.id}:${idx}:${r.lat||''}`;
        Report.open(label);
        return;
      }
    }
    Report._encodedContext = null;
    Report.open(`Quiz: ${q.main?.slice(0,40)||''}`);
  },

  showResult() {
    const allQ      = this._allQuestions;
    const total     = allQ.length;
    const roundCounts = {};
    let neverCorrect  = 0;

    allQ.forEach(q => {
      const key = this._qKey(q);
      const r   = this._firstCorrect[key];
      if (r === undefined) { neverCorrect++; }
      else { roundCounts[r] = (roundCounts[r]||0) + 1; }
    });

    const firstTry = roundCounts[0] || 0;
    const pct      = Math.round(firstTry / total * 100);

    // Ergebnis im Browser speichern für Mini-Chart auf der Startseite
    if (state.quizType === 'vokabel' && state._quizOrigin === 'table' && state.lastQuizId) {
      try {
        localStorage.setItem('quiz_result_' + state.lastQuizId,
          JSON.stringify({ roundCounts, neverCorrect, total, ts: Date.now() }));
      } catch(e) {}
    }

    if (this._pruefung) {
      document.getElementById('result-score').textContent  = `${firstTry}/${total}`;
      document.getElementById('result-label').textContent  = 'richtig beantwortet';
      document.getElementById('result-pct').textContent    = pct + '%';
      document.getElementById('result-chart-wrap').style.display = 'none';
    } else {
      document.getElementById('result-score').textContent  = total + '';
      document.getElementById('result-label').textContent  = 'Vokabeln abgeschlossen';
      document.getElementById('result-pct').textContent    = '';
      document.getElementById('result-chart-wrap').style.display = '';
      this._drawChart(roundCounts, neverCorrect, total);
    }

    const msgs = [[100,'Perfekt! Alle beim ersten Versuch!','🏆'],
                  [80, 'Sehr gut! Fast alles direkt richtig.','🏛️'],
                  [60, 'Gut! Noch etwas üben.','📜'],
                  [40, 'Es geht. Mehr Übung hilft!','⚡'],
                  [0,  'Weiter üben – du schaffst das!','🌿']];
    const [, msg, icon] = msgs.find(([x]) => pct >= x);
    document.getElementById('result-icon').textContent = icon;
    document.getElementById('result-msg').textContent  = msg;
    App.showPage('result');
  },

  _drawChart(roundCounts, neverCorrect, total) {
    const canvas = document.getElementById('result-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 100, cy = 100, r = 80, innerR = 45;
    const colors = ['#4CAF93','#e07b2a','#e05a5a','#c04040','#a03030','#777'];

    const segments   = [];
    const maxRound   = Math.max(...Object.keys(roundCounts).map(Number), 0);
    for (let i = 0; i <= maxRound; i++) {
      if (roundCounts[i]) {
        const label = i === 0 ? 'Beim 1. Versuch' : i === 1 ? 'Beim 2. Versuch' : `Beim ${i+1}. Versuch`;
        segments.push({ count: roundCounts[i], color: colors[Math.min(i, colors.length-1)], label });
      }
    }
    if (neverCorrect > 0) segments.push({ count: neverCorrect, color: '#555', label: 'Nicht geschafft' });

    ctx.clearRect(0, 0, 200, 200);
    let startAngle = -Math.PI / 2;
    segments.forEach(seg => {
      const slice = (seg.count / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.closePath(); ctx.fillStyle = seg.color; ctx.fill();
      startAngle += slice;
    });

    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#111';
    ctx.fill();

    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(Math.round((roundCounts[0]||0)/total*100) + '%', cx, cy - 8);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#aaa';
    ctx.fillText('1. Versuch', cx, cy + 12);

    const legendEl = document.getElementById('result-chart-legend');
    if (legendEl) {
      legendEl.innerHTML = segments.map(s =>
        `<div class="chart-legend-item">
          <span class="chart-legend-dot" style="background:${s.color}"></span>
          <span>${s.label}: <strong>${s.count}</strong></span>
        </div>`
      ).join('');
    }
  }
};
