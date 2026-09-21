'use strict';

// ── Wörterbuch-Lookup (statische, aus Wiktionary exportierte JSON-Shards) ──
// Ersetzt die alte, fehleranfällige Fallabwandlung durch echte Nachschlage-Daten.
// Keine externe API/kein Key nötig: data/lookup/{la,de}/<shard>.json wird nur
// bei Bedarf per fetch() geladen (analog zu grammar-tables.js).
const Lookup = {
  _shardCache: { la: {}, de: {} },

  _stripDiacritics(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  },
  normLa(s) { return this._stripDiacritics((s || '').trim()).toLowerCase(); },
  normDe(s) { return (s || '').trim().toLowerCase(); },

  _foldAscii(s) {
    return s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 's');
  },
  _shardKeyFromFileNorm(fileNorm) {
    const k = (fileNorm.slice(0, 2) || '').replace(/[^a-z]/g, '_');
    return (k + '__').slice(0, 2);
  },

  async _fetchShard(lang, shardKey) {
    const cache = this._shardCache[lang];
    if (shardKey in cache) return cache[shardKey];
    const promise = fetch(`data/lookup/${lang}/${shardKey}.json`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    cache[shardKey] = promise;
    const resolved = await promise;
    cache[shardKey] = resolved;
    return resolved;
  },

  async _lookup(lang, key, shardKey, posHint) {
    const shard = await this._fetchShard(lang, shardKey);
    const entries = shard && shard[key];
    if (!entries || !entries.length) return null;
    if (posHint) {
      const match = entries.find(e => e.pos === posHint);
      if (match) return match;
    }
    return entries[0];
  },

  async latin(word, posHint) {
    const key = this.normLa(word);
    if (!key) return null;
    return this._lookup('la', key, this._shardKeyFromFileNorm(key), posHint);
  },

  async german(word, posHint) {
    const key = this.normDe(word);
    if (!key) return null;
    return this._lookup('de', key, this._shardKeyFromFileNorm(this._foldAscii(key)), posHint);
  }
};

// ── Deutsche Artikel (geschlossenes, nicht fehleranfälliges Regelsystem) ──
const GERMAN_ARTICLES = {
  sg: { nom: { m: 'der', f: 'die', n: 'das' }, gen: { m: 'des', f: 'der', n: 'des' },
        dat: { m: 'dem', f: 'der', n: 'dem' }, akk: { m: 'den', f: 'die', n: 'das' } },
  pl: { nom: 'die', gen: 'der', dat: 'den', akk: 'die' }
};
function germanArticle(gender, caseKey, number) {
  return number === 'pl' ? GERMAN_ARTICLES.pl[caseKey] : GERMAN_ARTICLES.sg[caseKey][gender];
}
function firstAlt(form) { return (form || '').split('/')[0]; }

// ── Vokabelzeile: Latein + Deutsch nachschlagen und Formentabelle bauen ──
const GramLookup = {
  setOverlay(show, text) {
    const overlay = document.getElementById('vok-lookup-overlay');
    const status  = document.getElementById('vok-lookup-status');
    if (!overlay) return;
    if (text && status) status.textContent = text;
    overlay.classList.toggle('hidden', !show);
  },

  async buildForRow(r, opts) {
    const checkLa = !opts || opts.checkLa !== false;
    const checkDe = !opts || opts.checkDe !== false;
    const out = { la: null, de: null };
    out.la = checkLa ? await this._buildLatin(r) : { status: 'skipped' };
    out.de = checkDe ? await this._buildGerman(r) : { status: 'skipped' };
    return out;
  },

  async _buildLatin(r) {
    const type = Latin.detectType(r);
    if (type === 'verb') {
      const fall2 = (r.fall2 || '').trim();
      let entry = fall2 && fall2 !== '#' && fall2 !== '–' ? await Lookup.latin(fall2, 'verb') : null;
      if (!entry) entry = await Lookup.latin(r.lat || '', 'verb');
      return entry ? { status: 'ok', pos: 'verb', klass: entry.klass, forms: entry.forms } : { status: 'not_found' };
    }
    if (type === 'noun') {
      const entry = await Lookup.latin(r.lat || '', 'noun');
      return entry ? { status: 'ok', pos: 'noun', klass: entry.klass, forms: entry.forms } : { status: 'not_found' };
    }
    if (type === 'adj') {
      const mNom = (r.lat || '').split('/')[0].trim();
      const entry = await Lookup.latin(mNom, 'adj');
      return entry ? { status: 'ok', pos: 'adj', klass: entry.klass, forms: entry.forms } : { status: 'not_found' };
    }
    return { status: 'skipped' };
  },

  _cleanDeWord(raw) {
    return (raw || '').split('%')[0].replace(/\([^)]*\)/g, '')
      .replace(/^(der|die|das|ein|eine)\s+/i, '').trim();
  },

  async _buildGerman(r) {
    const type = Latin.detectType(r);
    const word = this._cleanDeWord(r.de);
    if (!word) return { status: 'skipped' };
    if (type === 'verb') {
      const entry = await Lookup.german(word, 'verb');
      return entry ? { status: 'ok', pos: 'verb', forms: entry.forms } : { status: 'not_found' };
    }
    if (type === 'noun' || type === 'indecl') {
      const entry = await Lookup.german(word, 'noun');
      if (!entry) return type === 'noun' ? { status: 'not_found' } : { status: 'skipped' };
      const g = entry.gender;
      const nomSg = firstAlt(entry.forms.sg && entry.forms.sg.nom);
      const datSg = firstAlt(entry.forms.sg && entry.forms.sg.dat);
      const f5 = nomSg ? nomSg + '!' : null;
      const f6 = datSg ? `mit ${germanArticle(g, 'dat', 'sg')} ${datSg}` : null;
      return { status: 'ok', pos: 'noun', gender: g, forms: entry.forms, f5, f6 };
    }
    return { status: 'skipped' };
  },

  // Baut aus den DB-Formen + Genus eine 6-Zeilen-Anzeige (Nom..Abl-Slots),
  // damit sie 1:1 in die bestehende Kasus-Tabelle neben Latein passt:
  // Slot "Vokativ" = 5. Fall (1. Fall ohne Artikel + "!"), "Ablativ" = 6. Fall ("mit " + 3. Fall).
  deNounDisplay(forms, gender) {
    const art = (c, n) => germanArticle(gender, c, n);
    const build = (n) => {
      const f = forms[n] || {};
      const nom = firstAlt(f.nom), gen = firstAlt(f.gen), dat = firstAlt(f.dat), akk = firstAlt(f.akk);
      return [
        nom ? `${art('nom', n)} ${nom}` : '–',
        gen ? `${art('gen', n)} ${gen}` : '–',
        dat ? `${art('dat', n)} ${dat}` : '–',
        akk ? `${art('akk', n)} ${akk}` : '–',
        nom ? `${nom}!` : '–',
        dat ? `mit ${art('dat', n)} ${dat}` : '–'
      ];
    };
    return { sg: build('sg'), pl: build('pl') };
  }
};
