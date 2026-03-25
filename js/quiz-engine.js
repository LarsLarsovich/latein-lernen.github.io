'use strict';

// ── Vokabel Quiz Engine ───────────────────────────────────────
const VokabelQuiz = {

  // Parst Eingaben wie "amica,ae f." oder "flumen,inis"
  _parseInput(input) {
    const s = input.trim();
    const genusMatch = s.match(/\s+(m\.|f\.|n\.)\s*$|^(m\.|f\.|n\.)\s*$|(m\.|f\.|n\.)\s*$/i);
    const genus = genusMatch ? (genusMatch[1]||genusMatch[2]||genusMatch[3]).toLowerCase() : null;
    const withoutGenus = genus
      ? s.slice(0, s.toLowerCase().lastIndexOf(genus)).trim().replace(/,\s*$/, '').trim()
      : s.trim();

    const commaIdx  = withoutGenus.indexOf(',');
    const lat       = commaIdx >= 0 ? withoutGenus.slice(0, commaIdx).trim() : withoutGenus.trim();
    const fall2Raw  = commaIdx >= 0 ? withoutGenus.slice(commaIdx + 1).trim() : null;

    const abbrevEndingsList = ['ae','arum','is','i','o','um','us','ui','uum','ei','erum','em',
                               'inis','eris','oris','icis','ucis','ntis','itis','atis','onis','alis'];
    const isAbbrev = fall2Raw && abbrevEndingsList.some(e => fall2Raw.toLowerCase() === e);

    return {
      lat: lat.toLowerCase(),
      fall2: fall2Raw ? fall2Raw.toLowerCase() : null,
      fall2IsAbbrev: isAbbrev,
      genus
    };
  },

  _fall2Matches(parsedFall2, storedFall2) {
    if (!parsedFall2 || !storedFall2) return false;
    const p = parsedFall2.toLowerCase().trim();
    const s = storedFall2.toLowerCase().trim();
    if (p === s) return true;
    if (s.endsWith(p) && p.length >= 1) return true;
    return false;
  },

  _checkDeLatAnswer(input, r, requireFall2, requireGenus) {
    const parsed = this._parseInput(input.trim());
    if (!parsed.lat) return false;
    const latForms = (r.lat||'').toLowerCase().split('%').map(s=>s.trim());
    if (!latForms.includes(parsed.lat)) return false;

    const hasFall2 = r.fall2 && r.fall2 !== '–' && r.fall2 !== '#';
    const hasGenus = r.genus && r.genus !== '–' && r.genus !== '#';

    if (requireFall2 && hasFall2) {
      if (!parsed.fall2) return false;
      if (!this._fall2Matches(parsed.fall2, r.fall2)) return false;
    } else if (parsed.fall2 && hasFall2) {
      if (!this._fall2Matches(parsed.fall2, r.fall2)) return false;
    }

    if (requireGenus && hasGenus) {
      if (!parsed.genus) return false;
      if (parsed.genus !== (r.genus||'').toLowerCase()) return false;
    } else if (parsed.genus && hasGenus) {
      if (parsed.genus !== (r.genus||'').toLowerCase()) return false;
    }
    return true;
  },

  _formatDeLatAnswer(r, requireFall2, requireGenus) {
    let parts = [r.lat||''];
    const hasFall2 = r.fall2 && r.fall2 !== '–' && r.fall2 !== '#';
    const hasGenus = r.genus && r.genus !== '–' && r.genus !== '#';
    if (requireFall2 && hasFall2) parts.push(r.fall2);
    if (requireGenus && hasGenus) parts.push(r.genus);
    return parts.join(', ');
  },

  _checkDeAnswer(input, r) {
    const inp = input.trim().toLowerCase();
    const answers = parseAnswers(r.de || '');
    if (answers.includes(inp)) return true;
    const inpStripped = inp.replace(/\s*\([^)]*\)\s*/g,'').trim();
    return answers.includes(inpStripped);
  },

  // Fragezettel für eine Liste von Vokabelzeilen bauen
  build(rows, modes, shuffle, extreme) {
    const questions = [];

    rows.forEach(r => {
      if (modes.includes('lat-de')) {
        const deRaw  = r.de || '';
        const deFmt  = deRaw.split('%').join(' / ');
        const deHint = parseAnswers(deRaw).join(' / ');
        questions.push({
          mode: 'lat-de',
          meta: '',
          hint: r.dekl && r.dekl !== '–' ? r.dekl : (r.fall2 && r.fall2 !== '–' ? r.fall2 : ''),
          main: r.lat || '?',
          placeholder: 'Deutsch eingeben…',
          answer: deRaw,
          answerDisplay: deFmt,
          r
        });
      }
      if (modes.includes('de-lat')) {
        const deRaw   = r.de || '';
        const deFirst = deRaw.split('%')[0].replace(/\(.*?\)/g,'').trim();
        questions.push({
          mode: 'de-lat',
          meta: '',
          hint: '',
          main: deFirst || r.de || '?',
          placeholder: 'Latein eingeben…',
          answer: '_de-lat_',
          answerDisplay: this._formatDeLatAnswer(r, this._requireFall2, this._requireGenus),
          requireFall2: this._requireFall2 || false,
          requireGenus: this._requireGenus || false,
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

    if (q.answer === '_de-lat_') {
      correct       = VokabelQuiz._checkDeLatAnswer(val, q.r, q.requireFall2, q.requireGenus);
      displayAnswer = VokabelQuiz._formatDeLatAnswer(q.r, q.requireFall2, q.requireGenus);
    } else if (q.mode === 'lat-de' && this._isVokabel) {
      correct       = VokabelQuiz._checkDeAnswer(val, q.r||{de: q.answer});
      displayAnswer = q.answerDisplay;
    } else {
      correct       = isCorrect(val, q.answer);
      const acc     = parseAnswers(q.answer);
      displayAnswer = acc.length > 1 ? acc.join(' / ') : (q.answerDisplay||q.answer);
    }

    const qKey = q.main + '||' + (q.answer||'');

    if (correct) {
      this.score++;
      this._done++;
      fb.textContent = '✓ Richtig!';
      fb.className   = 'feedback-box correct';
      // Track which attempt this was correct on (0 = first try)
      const attempts = this._attempt[qKey] || 0;
      if (this._firstCorrect[qKey] === undefined) {
        this._firstCorrect[qKey] = attempts;
        this._attemptCounts[attempts] = (this._attemptCounts[attempts]||0) + 1;
      }
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
      const key = q.main + '||' + (q.answer||'');
      const r   = this._firstCorrect[key];
      if (r === undefined) { neverCorrect++; }
      else { roundCounts[r] = (roundCounts[r]||0) + 1; }
    });

    const firstTry = roundCounts[0] || 0;
    const pct      = Math.round(firstTry / total * 100);

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
