'use strict';

// ── HTML-Escaping ─────────────────────────────────────────────
function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Antwort-Parsing ───────────────────────────────────────────
// Mehrere gültige Antworten sind mit % getrennt:  esse%est → "esse", "est"
// Alles in Klammern ist freiwillig – man darf es eingeben, muss aber nicht:
//   wieder(um)               → "wieder" oder "wiederum"
//   streben (nach)           → "streben" oder "streben nach"
//   heiraten (vom Mann aus)  → "heiraten" reicht
//   durch (+Akk.)            → "durch" reicht

// Kleinbuchstaben, Leerzeichen vereinheitlicht
function _cleanAnswer(s) { return (s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

// Die Antworten ohne Klammer-Inhalte – für die Anzeige („Richtig wäre: …")
function parseAnswers(raw) {
  if (!raw) return [];
  const out = new Set();
  raw.split('%').forEach(seg => {
    const bare = _cleanAnswer(seg.replace(/\([^)]*\)/g, ' '));
    if (bare) out.add(bare);
  });
  return [...out];
}

// Alles, was als richtig gilt: jede Klammer einmal mit und einmal ohne ihren Inhalt
function acceptedAnswers(raw) {
  if (!raw) return [];
  const out = new Set();
  raw.split('%').forEach(seg => {
    const parts = seg.split(/(\([^)]*\))/);                 // Text und Klammern abwechselnd
    const groups = parts.filter(p => /^\(.*\)$/.test(p)).length;
    if (groups > 5) { const bare = _cleanAnswer(seg.replace(/\([^)]*\)/g, ' ')); if (bare) out.add(bare); return; }
    for (let mask = 0; mask < (1 << groups); mask++) {
      let g = 0;
      const text = parts.map(p => {
        if (!/^\(.*\)$/.test(p)) return p;
        return (mask >> g++) & 1 ? p.slice(1, -1) : '';      // Inhalt behalten oder weglassen
      }).join('');
      const clean = _cleanAnswer(text);
      if (clean) out.add(clean);
    }
  });
  return [...out];
}

// Stimmt die Eingabe? Klammern dürfen mitgetippt oder weggelassen werden.
function isCorrect(input, raw) {
  const answers = acceptedAnswers(raw);
  const typed   = _cleanAnswer(input);
  return answers.includes(typed)
      || answers.includes(_cleanAnswer(typed.replace(/[()]/g, '')))          // "streben (nach)" → "streben nach"
      || answers.includes(_cleanAnswer(typed.replace(/\([^)]*\)/g, ' ')));   // "durch (+Akk.)"  → "durch"
}

// "(er%sie%es) geht" → "er geht%sie geht%es geht"
function expandBrackets(str) {
  if (!str || !str.includes('(')) return str;

  function splitTopLevel(s) {
    const parts = []; let depth = 0, cur = '';
    for (const c of s) {
      if (c === '(')                    { depth++; cur += c; }
      else if (c === ')')               { depth--; cur += c; }
      else if (c === '%' && depth === 0){ parts.push(cur); cur = ''; }
      else                              { cur += c; }
    }
    parts.push(cur);
    return parts;
  }

  const expanded = [];
  splitTopLevel(str).forEach(seg => {
    seg = seg.trim();
    const m = seg.match(/^\(([^)]+)\)\s*(.*)$/);
    if (m) {
      const opts   = m[1].split('%').map(s => s.trim());
      const suffix = m[2].trim();
      opts.forEach(o => expanded.push(suffix ? o + ' ' + suffix : o));
    } else {
      expanded.push(seg);
    }
  });
  return expanded.filter(Boolean).join('%');
}

// ── Diff-Highlighting (für Falsch-Antworten) ─────────────────
function diffHighlight(input, correct) {
  const a = input.toLowerCase();
  const b = correct.toLowerCase();
  const m = a.length, n = b.length;

  const dp = Array.from({length: m+1}, (_,i) =>
    Array.from({length: n+1}, (_,j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);

  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
      ops.unshift({type:'match',   c: b[j-1]}); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] <= dp[i-1][j] && dp[i][j-1] <= dp[i-1][j-1])) {
      ops.unshift({type:'insert',  c: b[j-1]}); j--;
    } else if (i > 0 && (j === 0 || dp[i-1][j] <= dp[i][j-1] && dp[i-1][j] <= dp[i-1][j-1])) {
      ops.unshift({type:'delete',  c: a[i-1]}); i--;
    } else {
      ops.unshift({type:'replace', c: b[j-1]}); i--; j--;
    }
  }

  let html = '';
  ops.forEach(op => {
    const ch = escHtml(op.c);
    if      (op.type === 'match')   html += ch;
    else if (op.type === 'replace') html += `<mark class="diff-wrong">${ch}</mark>`;
    else if (op.type === 'insert')  html += `<mark class="diff-missing">${ch}</mark>`;
    // 'delete' = extra Zeichen des Nutzers, werden nicht angezeigt
  });
  return html;
}
