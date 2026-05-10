'use strict';

// ── AI Vokabel-Checker ────────────────────────────────────────
// Modell: claude-haiku-4-5 (günstigstes gutes Modell)
// Automatisches Speichern in Firebase, Rückgängig pro Änderung
const AiCheck = {
  _running: false,
  _abortFlag: false,
  _checkedKeys: {},   // hash → true (überspringe unveränderte)
  _changes: [],       // [{tableId, rowIdx, field, oldVal, newVal, word, table}]

  // ── Key Management ────────────────────────────────────────
  async _getKey() {
    if (state._anthropicKey) return state._anthropicKey;
    try {
      const doc = await COL.admins.doc('_config').get();
      if (doc.exists) {
        if (doc.data().anthropicKey) state._anthropicKey = doc.data().anthropicKey;
        if (doc.data().checkedKeys)  this._checkedKeys = doc.data().checkedKeys;
      }
      return state._anthropicKey || null;
    } catch(e) {}
    return null;
  },

  async _saveCheckedKeys() {
    try {
      await COL.admins.doc('_config').set({ checkedKeys: this._checkedKeys }, { merge: true });
    } catch(e) {}
  },

  async saveKey(key) {
    key = key.trim();
    if (!key || key.includes('•') || !key.startsWith('sk-ant') || key.length < 20) {
      alert('Ungültiger Key – muss mit sk-ant beginnen.');
      return;
    }
    await COL.admins.doc('_config').set({ anthropicKey: key }, { merge: true });
    state._anthropicKey = key;
    this._updateKeyDisplay(true);
  },

  async updateKey() {
    const val = document.getElementById('ai-key-input').value.trim();
    await this.saveKey(val);
  },

  async _updateKeyDisplay(saved) {
    const key = await this._getKey();
    const statusEl = document.getElementById('ai-key-status');
    const input = document.getElementById('ai-key-input');
    if (key) {
      input.value = '••••••••' + key.slice(-6);
      statusEl.textContent = saved ? '✓ Gespeichert' : '✓ Key vorhanden';
      statusEl.style.color = '#4CAF93';
    } else {
      statusEl.textContent = '⚠ Kein Key';
      statusEl.style.color = 'var(--accent)';
    }
  },

  // ── Open/Close ────────────────────────────────────────────
  open() {
    document.getElementById('ai-check-overlay').classList.remove('hidden');
    this._updateKeyDisplay(false);
    this._renderChangesList();
  },

  abort() {
    this._abortFlag = true;
    document.getElementById('ai-btn-abort').style.display = 'none';
  },

  close(e) {
    if (e && e.target !== document.getElementById('ai-check-overlay')) return;
    if (this._running) return;
    document.getElementById('ai-check-overlay').classList.add('hidden');
  },

  // ── Start Check ───────────────────────────────────────────
  async startCheck(mode) {
    // mode: 'new' = nur neue/geänderte, 'all' = alle
    if (this._running) return;
    const key = await this._getKey();
    if (!key || !key.startsWith('sk-ant') || key.length < 20) {
      alert('Bitte erst einen gültigen Anthropic API Key eintragen.');
      return;
    }

    this._running = true;
    document.getElementById('ai-check-log').innerHTML = '';
    document.getElementById('ai-check-progress').style.width = '0%';

    this._abortFlag = false;
    const btnNew = document.getElementById('ai-btn-new');
    const btnAll = document.getElementById('ai-btn-all');
    const btnAbort = document.getElementById('ai-btn-abort');
    btnNew.disabled = btnAll.disabled = true;
    if (btnAbort) btnAbort.style.display = '';

    // Sammle Vokabeln
    const allVok = [];
    state.vokabel.forEach(table => {
      (table.rows || []).forEach((r, idx) => {
        const hash = table.id + '_' + idx + '_' + (r.lat||'') + (r.fall2||'') + (r.de||'') + (r.perf||'');
        if (mode === 'new' && this._checkedKeys[hash]) return;
        allVok.push({ tableId: table.id, tableName: table.name, rowIdx: idx, hash, ...r });
      });
    });

    const total = allVok.length;
    if (!total) {
      this._log('info', '✓ Alle Vokabeln bereits geprüft. Klicke "Alle prüfen" für eine Neuprüfung.');
      btnNew.disabled = btnAll.disabled = false;
      this._running = false;
      return;
    }

    this._log('info', `Prüfe ${total} Vokabeln…`);

    // Batches à 20 (spart Tokens)
    const batchSize = 20;
    let done = 0, changedCount = 0;

    for (let i = 0; i < allVok.length; i += batchSize) {
      if (this._abortFlag) {
        this._log('info', '⏹ Prüfung abgebrochen.');
        break;
      }
      const batch = allVok.slice(i, i + batchSize);
      try {
        const results = await this._checkBatch(batch, key);

        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          const orig = batch.find(b => b.tableId === r.tableId && b.rowIdx === r.rowIdx) || batch[j];
          if (!orig) continue;

          // Mark as checked
          this._checkedKeys[orig.hash] = true;

          // Apply all corrections automatically to Firebase
          const fields = ['lat','fall2','de','perf'];
          const t = state.vokabel.find(x => x.id === r.tableId);
          if (!t) continue;

          let changed = false;
          const rows = [...(t.rows || [])];
          const row = rows[r.rowIdx];
          if (!row) continue;

          fields.forEach(field => {
            if (r[field] && r[field] !== (row[field]||'')) {
              // Record change for undo
              this._changes.push({
                tableId: r.tableId, rowIdx: r.rowIdx,
                field, oldVal: row[field]||'', newVal: r[field],
                word: row.lat||'?', table: t.name||'?'
              });
              rows[r.rowIdx] = { ...rows[r.rowIdx], [field]: r[field] };
              changed = true;
              changedCount++;
            }
          });

          if (changed) {
            t.rows = rows;
            await COL.vokabel.doc(r.tableId).update({ rows });
            // Log the change
            const changedFields = fields.filter(f => r[f] && r[f] !== (orig[f]||''));
            changedFields.forEach(f => {
              this._log('change', `<strong>${escHtml(orig.lat||'?')}</strong> (${escHtml(orig.tableName||'?')}): ${f} <span class="ai-old">${escHtml(orig[f]||'–')}</span> → <span class="ai-new">${escHtml(r[f])}</span>`);
            });
          }

          if (r.fehler?.length && !results[j].ok) {
            r.fehler.forEach(f => {
              this._log('error', `<strong>${escHtml(orig.lat||'?')}</strong>: ${escHtml(f)}`);
            });
          }
        }
      } catch(e) {
        this._log('error', 'API Fehler: ' + escHtml(e.message));
        if (e.message.includes('401') || e.message.includes('credit')) break;
      }

      this._saveCheckedKeys();
      done = Math.min(i + batchSize, total);
      document.getElementById('ai-check-progress').style.width = (done / total * 100) + '%';
      document.getElementById('ai-check-status').textContent = `${done} / ${total}…`;
    }

    document.getElementById('ai-check-progress').style.width = '100%';
    document.getElementById('ai-check-status').textContent =
      `✓ Fertig. ${total} geprüft, ${changedCount} Korrekturen vorgenommen.`;

    if (changedCount === 0) {
      this._log('info', '✓ Keine Korrekturen nötig – alle Vokabeln sind korrekt!');
    } else {
      this._log('info', `${changedCount} Korrekturen wurden automatisch in Firebase gespeichert.`);
    }

    this._renderChangesList();
    btnNew.disabled = btnAll.disabled = false;
    if (btnAbort) btnAbort.style.display = 'none';
    this._running = false;
  },

  _log(type, html) {
    const el = document.createElement('div');
    el.className = 'ai-log-' + type;
    el.innerHTML = html;
    document.getElementById('ai-check-log').appendChild(el);
  },

  // ── API Call (Token-optimiert) ────────────────────────────
  async _checkBatch(batch, key) {
    // Minimaler Prompt = weniger Tokens = billiger
    const items = batch.map(v => ({
      id: v.tableId + '|' + v.rowIdx,
      lat: v.lat||'', f2: v.fall2||'', gen: v.genus||'',
      de: v.de||'', perf: v.perf||''
    }));

    const prompt = `Du bist ein erfahrener Latein-Lehrer (Österreich, Medias in Res Lektionen 1-11).
Prüfe diese Vokabeln. Antworte NUR als JSON-Array, keine Erklärungen, kein Markdown.

═══ LATEINISCHE GRAMMATIK ═══

FELD "f2" – Bedeutung je nach Wortart:
• Nomen → Genitiv Singular:
  1.Dekl: porta→portae | 2.Dekl m: servus→servi | 2.Dekl n: bellum→belli
  3.Dekl: rex→regis, homo→hominis, corpus→corporis, nomen→nominis
  4.Dekl: manus→manus | 5.Dekl: res→rei
• Verb → 1. Person Singular Präsens Aktiv (NICHT Infinitiv, NICHT Perfekt!):
  amare→amo | sedere→sedeo | facere→facio | esse→sum | ire→eo | velle→volo
  laudare→laudo | monere→moneo | mittere→mitto | capere→capio | audire→audio

FELD "perf" – 1. Person Singular Perfekt Aktiv:
• Regelmäßig (a-Konjugation): amare→amavi, laudare→laudavi, narrare→narravi
• Regelmäßig (e-Konjugation): monere→monui, sedere→sedi, tenere→tenui
• 3. Konjugation unregelmäßig (IMMER angeben!):
  esse→fui | ire→ivi | velle→volui | facere→feci | dicere→dixi
  mittere→misi | capere→cepi | venire→veni | videre→vidi | scire→scivi
  currere→cucurri | stare→steti | dare→dedi | ferre→tuli | esse→fui
• Semideponentia (Perfekt mit Passivform!):
  gaudere→gavisus sum | audere→ausus sum | solere→solitus sum
• Deponentia: loqui→locutus sum | sequi→secutus sum

FELD "lat" – Lateinische Schreibweise prüfen (Tippfehler, falsche Endungen)

═══ DEUTSCHES FELD "de" ═══

ABSOLUT NICHT ÄNDERN:
• % ist Trennzeichen für Alternativen: "gehen%laufen" → beide Formen korrekt lassen
• (Klammern) sind grammatische Hinweise: "(+Akk.)" "(Pl.)" → nie ändern
• Synonyme sind korrekt: "Bub"="Junge", "Mädchen"="Mädel" → NICHT ändern
• Keine Artikel hinzufügen: "Krieg" NICHT zu "der Krieg" ändern
• Kein "sich" hinzufügen: "freuen" NICHT zu "sich freuen" ändern
• Kein "zu" hinzufügen: "gehen" NICHT zu "zu gehen" ändern
• Keine Konjugation: "loben" NICHT zu "lobt" oder "er lobt" ändern
• Regionale Varianten akzeptieren: österreichisches Deutsch ist korrekt

NUR korrigieren:
• Eindeutige Tippfehler: "gehn" → "gehen", "Krirg" → "Krieg"
• Komplett falsche Übersetzung: "Wasser" für "ignis" (Feuer)
• Fehlende Perfekt-Form beim perf-Feld (wichtigste Aufgabe!)

ZEICHENSATZ-REGEL (sehr wichtig!):
• Verwende NUR diese Zeichen: a-z, A-Z, Zahlen, Leerzeichen, Komma, Punkt, Bindestrich
• Erlaubte Sonderzeichen im Deutschen: ä, ö, ü, Ä, Ö, Ü, ß
• VERBOTEN: ā, ē, ī, ō, ū (Längezeichen), â, ê, î, ô, û (Zirkumflex), und alle anderen Sonderzeichen
• Schreibe einfach: a statt ā, e statt ē, o statt ō usw.
• Beispiel: "amāre" → "amare", "lēx" → "lex", "mōns" → "mons"

AUSGABE-REGELN:
• Ist ein Feld korrekt → null (nicht den gleichen Wert zurückgeben!)
• Nur bei echtem Fehler einen Korrekturwert angeben
• "ok": false nur wenn wirklich etwas falsch ist
• "fehler": kurze Liste der Probleme auf Deutsch

Vokabeln:
${JSON.stringify(items)}

Format: [{"id":"tableId|rowIdx","lat":null,"f2":null,"de":null,"perf":null,"fehler":[],"ok":true}]`;

    let resp;
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        })
      });
    } catch(e) { throw new Error('Netzwerkfehler: ' + e.message); }

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message + (data.error.type === 'authentication_error' ? ' – Key ungültig?' : ''));
    if (!data.content?.[0]) throw new Error('Leere API-Antwort');

    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    // Strip any forbidden special chars (macrons etc.) from all string fields
    const stripSpecial = s => s ? s.replace(/[āēīōūĀĒĪŌŪâêîôûÂÊÎÔÛàèìòùÀÈÌÒÙáéíóúÁÉÍÓÚãõñÃÕÑ]/g, c => {
      const map = {ā:'a',ē:'e',ī:'i',ō:'o',ū:'u',Ā:'A',Ē:'E',Ī:'I',Ō:'O',Ū:'U',
                   â:'a',ê:'e',î:'i',ô:'o',û:'u',Â:'A',Ê:'E',Î:'I',Ô:'O',Û:'U',
                   à:'a',è:'e',ì:'i',ò:'o',ù:'u',À:'A',È:'E',Ì:'I',Ò:'O',Ù:'U',
                   á:'a',é:'e',í:'i',ó:'o',ú:'u',Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U',
                   ã:'a',õ:'o',ñ:'n',Ã:'A',Õ:'O',Ñ:'N'};
      return map[c] || c;
    }) : s;

    // Map id back to tableId/rowIdx, and f2 back to fall2
    return parsed.map(r => {
      const [tableId, rowIdxStr] = r.id.split('|');
      return {
        tableId, rowIdx: parseInt(rowIdxStr),
        lat:   r.lat  ? stripSpecial(r.lat)  : null,
        fall2: r.f2   ? stripSpecial(r.f2)   : null,
        de:    r.de   ? stripSpecial(r.de)   : null,
        perf:  r.perf ? stripSpecial(r.perf) : null,
        fehler: r.fehler||[], ok: r.ok !== false
      };
    });
  },

  // ── Changes List & Undo ───────────────────────────────────
  _renderChangesList() {
    const el = document.getElementById('ai-changes-list');
    if (!el) return;
    if (!this._changes.length) {
      el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:0.5rem;">Noch keine automatischen Korrekturen.</div>';
      return;
    }
    el.innerHTML = this._changes.map((c, i) =>
      `<div class="ai-change-item">
        <span class="ai-change-word">${escHtml(c.word)}</span>
        <span class="ai-change-table">${escHtml(c.table)}</span>
        <span class="ai-change-field">${c.field}</span>
        <span class="ai-old">${escHtml(c.oldVal||'–')}</span>
        <span>→</span>
        <span class="ai-new">${escHtml(c.newVal)}</span>
        <button class="ai-undo-single" onclick="AiCheck.undoSingle(${i})">↩</button>
      </div>`
    ).join('');
  },

  async undoSingle(idx) {
    const c = this._changes[idx];
    if (!c) return;
    const t = state.vokabel.find(x => x.id === c.tableId);
    if (!t) return;
    const rows = [...(t.rows||[])];
    if (!rows[c.rowIdx]) return;
    rows[c.rowIdx] = { ...rows[c.rowIdx], [c.field]: c.oldVal };
    t.rows = rows;
    await COL.vokabel.doc(c.tableId).update({ rows });
    this._changes.splice(idx, 1);
    this._renderChangesList();
    // Also remove from checkedKeys so it gets re-checked
    state.vokabel.forEach(table => {
      (table.rows||[]).forEach((r, i) => {
        if (table.id === c.tableId && i === c.rowIdx) {
          const hash = table.id+'_'+i+'_'+(r.lat||'')+(r.fall2||'')+(r.de||'')+(r.perf||'');
          delete this._checkedKeys[hash];
        }
      });
    });
  },

  async undoAll() {
    if (!this._changes.length || !confirm(`Alle ${this._changes.length} Korrekturen rückgängig machen?`)) return;
    // Group by table
    const byTable = {};
    this._changes.forEach(c => {
      if (!byTable[c.tableId]) byTable[c.tableId] = [];
      byTable[c.tableId].push(c);
    });
    for (const tableId of Object.keys(byTable)) {
      const t = state.vokabel.find(x => x.id === tableId);
      if (!t) continue;
      const rows = [...(t.rows||[])];
      byTable[tableId].forEach(c => {
        if (rows[c.rowIdx]) rows[c.rowIdx] = { ...rows[c.rowIdx], [c.field]: c.oldVal };
      });
      t.rows = rows;
      await COL.vokabel.doc(tableId).update({ rows });
    }
    this._changes = [];
    this._checkedKeys = {};
    this._saveCheckedKeys();
    this._renderChangesList();
    this._log('info', '↩ Alle Korrekturen rückgängig gemacht.');
  }
};
