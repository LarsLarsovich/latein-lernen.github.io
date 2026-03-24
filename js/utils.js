'use strict';

// ── HTML-Escaping ─────────────────────────────────────────────
function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Passwort-Hashing (SHA-256 über Web Crypto API) ────────────
// Passwörter werden NUR noch als SHA-256-Hash gespeichert und verglichen.
// Das Klartext-Passwort verlässt den Browser nie.
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Beim ersten Login eines bestehenden Admins: Prüfe ob das Passwort
// noch im Klartext gespeichert ist (Altdaten) und migriere es automatisch.
async function verifyAndMigratePassword(inputPassword, storedValue, docRef) {
  const inputHash = await hashPassword(inputPassword);

  // Passwort ist bereits gehasht (64 Zeichen Hex)
  if (/^[a-f0-9]{64}$/.test(storedValue)) {
    return inputHash === storedValue;
  }

  // Altdaten: Klartext-Vergleich
  if (inputPassword === storedValue) {
    // Automatische Migration: Hash in Firestore speichern
    try {
      await docRef.update({ password: inputHash });
    } catch (e) {
      console.warn('Passwort-Migration fehlgeschlagen:', e.message);
    }
    return true;
  }

  return false;
}

// ── Antwort-Parsing ───────────────────────────────────────────
// wieder(um)  → ["wieder", "wiederum"]   optionale Endung
// gehen (+Dat.) → ["gehen"]             Annotation entfernt
// esse%est    → ["esse", "est"]          mehrere Formen
// (+Akk.)     → []                       reine Annotation = leer
function parseAnswers(raw) {
  if (!raw) return [];
  const variants = new Set();

  const annotationRe     = /^\([+]?[A-ZÄÖÜ][a-zA-ZäöüÄÖÜ.\s+]*\)$/;
  const stripAnnotationRe = /\s*\([+]?[A-ZÄÖÜ][a-zA-ZäöüÄÖÜ.\s+]*\)\s*/g;

  raw.split('%').forEach(seg => {
    seg = seg.trim();
    if (!seg) return;

    if (annotationRe.test(seg)) return;

    const stripped    = seg.replace(stripAnnotationRe, ' ').replace(/\s+/g,' ').trim();
    const strippedLow = stripped.toLowerCase();

    const optMatch = strippedLow.match(/^(.*?)\(([a-zäöü]+)\)(.*)$/);
    if (optMatch) {
      const before  = optMatch[1].trim();
      const opt     = optMatch[2].trim();
      const after   = optMatch[3].trim();
      const without = (before + (after ? ' ' + after : '')).replace(/\s+/g,' ').trim();
      const withIt  = (before + opt + (after ? ' ' + after : '')).replace(/\s+/g,' ').trim();
      if (without) variants.add(without);
      if (withIt)  variants.add(withIt);
    } else if (strippedLow) {
      variants.add(strippedLow);
    }
  });

  return [...variants].filter(Boolean);
}

function isCorrect(input, raw) {
  const inp = input.trim().toLowerCase();
  const answers = parseAnswers(raw);
  if (answers.includes(inp)) return true;
  const inpStripped = inp.replace(/\s*\([^)]*\)\s*/g,'').trim();
  return answers.includes(inpStripped);
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
