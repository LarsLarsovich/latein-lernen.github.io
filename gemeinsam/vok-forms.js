'use strict';

// ── Formentabellen einer Vokabel ──────────────────────────────
// Eine Stelle für alle Formen: Detailansicht, Formen-Editor und Suche
// lesen von hier.
//
// Woher kommen die Formen?
//   1. r.forms       – vom Admin bei dieser Vokabel eingetragen. Dann gilt NUR das.
//   2. unregelmäßig  – das Verb steht auf der Seite „Unregelmäßige Verben": dann
//                      gelten die dort von Hand eingetragenen Formen.
//   3. legacy        – alte Teil-Überschreibungen (t.overrides[index]); leere Felder
//                      werden weiter automatisch gebildet.
//   4. sonst         – automatisch aus grammar.js.
//
// Feldnamen (= Schlüssel in r.forms): Spalten-Präfix + Zeile, z.B.
//   praes_p1sg · impf_p3pl · fut_p1sg · perf_p2sg · plqpf_p1pl · imp_sg
//   sg_nom · pl_abl · m_sg_gen · n_pl_akk · de_praes_p1sg · de_sg_nom
const VokForms = {

  PERSONS: [['p1sg', '1. Sg. (ich)'], ['p2sg', '2. Sg. (du)'], ['p3sg', '3. Sg. (er/sie/es)'],
            ['p1pl', '1. Pl. (wir)'], ['p2pl', '2. Pl. (ihr)'], ['p3pl', '3. Pl. (sie)']],
  CASES:   [['nom', 'Nominativ'], ['gen', 'Genitiv'], ['dat', 'Dativ'],
            ['akk', 'Akkusativ'], ['vok', 'Vokativ'], ['abl', 'Ablativ']],
  NUMERI:  [['sg', 'Singular (du)'], ['pl', 'Plural (ihr)']],
  INFS:    [['praes', 'Präsens'], ['perf', 'Perfekt']],

  TYPE_LABEL: { noun: 'Nomen', verb: 'Verb', adj: 'Adjektiv', indecl: 'Anderes' },

  // Aufbau der Tabellen je Wortart. de:true = deutsche Spalte.
  layout(type) {
    const lat = prefix => [{ label: 'Latein', prefix }];
    if (type === 'verb') return [
      { id: 'praes', title: 'Präsens Aktiv', rows: this.PERSONS, first: 'Person',
        cols: [{ label: 'Latein', prefix: 'praes_' }, { label: 'Deutsch', prefix: 'de_praes_', de: true }] },
      { id: 'impf',  title: 'Imperfekt Aktiv',       rows: this.PERSONS, first: 'Person', cols: lat('impf_') },
      { id: 'fut',   title: 'Futur I Aktiv',         rows: this.PERSONS, first: 'Person', cols: lat('fut_') },
      { id: 'perf',  title: 'Perfekt Aktiv',         rows: this.PERSONS, first: 'Person', cols: lat('perf_') },
      { id: 'plqpf', title: 'Plusquamperfekt Aktiv', rows: this.PERSONS, first: 'Person', cols: lat('plqpf_') },
      { id: 'imp',   title: 'Imperativ Präsens',     rows: this.NUMERI,  first: 'Form',
        cols: [{ label: 'Latein', prefix: 'imp_' }, { label: 'Deutsch', prefix: 'de_imp_', de: true }] }
    ];
    if (type === 'noun') return [
      { id: 'dekl', title: 'Deklination', rows: this.CASES, first: 'Kasus',
        cols: [{ label: 'Lat. Sg.', prefix: 'sg_' }, { label: 'Lat. Pl.', prefix: 'pl_' },
               { label: 'Dt. Sg.', prefix: 'de_sg_', de: true }, { label: 'Dt. Pl.', prefix: 'de_pl_', de: true }] }
    ];
    if (type === 'adj') return [
      { id: 'dekl', title: 'Deklination', rows: this.CASES, first: 'Kasus',
        cols: [{ label: 'M Sg.', prefix: 'm_sg_' }, { label: 'F Sg.', prefix: 'f_sg_' }, { label: 'N Sg.', prefix: 'n_sg_' },
               { label: 'M Pl.', prefix: 'm_pl_' }, { label: 'F Pl.', prefix: 'f_pl_' }, { label: 'N Pl.', prefix: 'n_pl_' }] }
    ];
    return [
      { id: 'dekl', title: 'Formen', rows: this.CASES, first: 'Kasus',
        cols: [{ label: 'Singular', prefix: 'sg_' }, { label: 'Plural', prefix: 'pl_' }] }
    ];
  },

  // Tabellen eines unregelmäßigen Verbs: wie ein normales Verb, dazu die Infinitive
  layoutIrregular() {
    return [...this.layout('verb'),
      { id: 'inf', title: 'Infinitive', rows: this.INFS, first: 'Form',
        cols: [{ label: 'Latein', prefix: 'inf_' }, { label: 'Deutsch', prefix: 'de_inf_', de: true }] }];
  },

  // Aus einer Formen-Sammlung (schlüssel → form) fertige Tabellen machen
  fill(layout, value) {
    return layout.map(sec => {
      const rows = sec.rows.map(([rk, label]) => ({
        label, cells: sec.cols.map(col => ({ key: col.prefix + rk, de: !!col.de, value: value(col.prefix + rk) || '' }))
      }));
      return { ...sec, rows, empty: !rows.some(row => row.cells.some(c => !c.de && c.value)) };
    });
  },

  // Steht dieses Verb auf der Seite „Unregelmäßige Verben"? (Vergleich über den Infinitiv)
  irregularFor(r) {
    const inf = Latin._inf(r.lat).toLowerCase();
    return inf ? (state.unregelmaessige || []).find(v => (v.inf || '').trim().toLowerCase() === inf) || null : null;
  },

  _deBase(r) { return (r.de || '').split('%')[0].replace(/\(.*?\)/g, '').trim(); },

  // Automatisch gebildete Formen: { schlüssel: form }, dazu die Klasse für die Überschrift
  auto(r, type) {
    const f = {};
    const put = (prefix, rows, values) => { if (values) rows.forEach(([k], i) => { if (values[i]) f[prefix + k] = values[i]; }); };
    let klass = '';

    if (type === 'verb') {
      const c = Latin.conjugate(r.lat, r.fall2, r.perf);
      klass = Latin.KONJ[c.klass || 'irr'].long;
      ['praes', 'impf', 'fut', 'perf', 'plqpf'].forEach(t => put(t + '_', this.PERSONS, c[t]));
      put('imp_', this.NUMERI, c.imp);
      const de = this._deBase(r);
      if (c.praes) put('de_praes_', this.PERSONS, German.conjugateVerb(de));
      if (c.imp)   put('de_imp_',   this.NUMERI,  German.imperativVerb(de));
    } else if (type === 'noun') {
      const d = Latin.declineNoun(r.lat, r.fall2, r.genus, r.dekl);
      if (d) {
        klass = d.decl + '. Deklination';
        put('sg_', this.CASES, d.sg); put('pl_', this.CASES, d.pl);
        const de = German.declineNoun(this._deBase(r), r.deGenus || r.genus || '');   // deGenus: deutsches Geschlecht, falls es abweicht
        if (de) { put('de_sg_', this.CASES, de.sg); put('de_pl_', this.CASES, de.pl); }
      }
    } else if (type === 'adj') {
      const d = Latin.declineAdj(r.lat || '');
      if (d) {
        klass = d.klass;
        ['m_sg', 'f_sg', 'n_sg', 'm_pl', 'f_pl', 'n_pl'].forEach(k => put(k + '_', this.CASES, d[k]));
      }
    }
    return { forms: f, klass };
  },

  // Alte Überschreibungen auf die heutigen Feldnamen bringen ("-" hieß: nichts anzeigen)
  _legacy(legacy, type) {
    const out = {};
    Object.entries(legacy || {}).forEach(([k, v]) => {
      if (!v) return;
      const key = (type === 'verb' && /^p[123](sg|pl)$/.test(k)) ? 'praes_' + k : k;
      out[key] = ['-', '–'].includes(v.trim()) ? '' : v;
    });
    return out;
  },

  // Fertige Tabellen einer Vokabel.
  // legacy = alter Eintrag aus t.overrides[index] (falls vorhanden)
  build(r, legacy) {
    const type   = Latin.detectType(r);
    const auto   = this.auto(r, type);
    const manual = !!r.forms;
    const irr    = (!manual && type === 'verb') ? this.irregularFor(r) : null;
    const old    = (manual || irr) ? null : this._legacy(legacy, type);
    const value  = key => {
      if (manual) return r.forms[key];
      if (irr)    return (irr.forms || {})[key];
      if (old && key in old) return old[key];
      return auto.forms[key];
    };
    return {
      type, manual, irregular: irr,
      partlyManual: !!old && Object.keys(old).length > 0,
      klass: irr ? Latin.KONJ.irr.long : auto.klass,
      sections: this.fill(irr ? this.layoutIrregular() : this.layout(type), value)
    };
  },

  // Alle lateinischen und deutschen Formen als flache Liste (für die Suche)
  allValues(r, legacy) {
    const out = [];
    this.build(r, legacy).sections.forEach(sec => sec.rows.forEach(row => row.cells.forEach(c => {
      if (c.value) out.push(c.value);
    })));
    return out;
  },

  // Momentaufnahme aller aktuell angezeigten Formen → kann als r.forms gespeichert werden
  snapshot(r, legacy) {
    const forms = {};
    this.build(r, legacy).sections.forEach(sec => sec.rows.forEach(row => row.cells.forEach(c => {
      if (c.value) forms[c.key] = c.value;
    })));
    return forms;
  }
};
