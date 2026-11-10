'use strict';

// ── Deutsches Grammatik-Engine ────────────────────────────────
const German = {

  conjugateVerb(de) {
    if (!de) return null;
    let base = de.toLowerCase()
      .replace(/^(ich|du|er|sie|es|wir|ihr)\s+/, '')
      .trim();

    const irregulars = {
      'sein':   ['bin','bist','ist','sind','seid','sind'],
      'haben':  ['habe','hast','hat','haben','habt','haben'],
      'werden': ['werde','wirst','wird','werden','werdet','werden'],
      'gehen':  ['gehe','gehst','geht','gehen','geht','gehen'],
      'kommen': ['komme','kommst','kommt','kommen','kommt','kommen'],
      'geben':  ['gebe','gibst','gibt','geben','gebt','geben'],
      'stehen': ['stehe','stehst','steht','stehen','steht','stehen'],
      'sehen':  ['sehe','siehst','sieht','sehen','seht','sehen'],
      'wissen': ['weiß','weißt','weiß','wissen','wisst','wissen'],
    };

    let inf = base;
    if (!inf.endsWith('en') && !inf.endsWith('ern') && !inf.endsWith('eln')) {
      if      (inf.endsWith('t')) inf = inf.slice(0,-1) + 'en';
      else if (inf.endsWith('e')) inf = inf + 'n';
      else                        inf = inf + 'en';
    }

    if (irregulars[inf]) return irregulars[inf];

    const stem = inf.endsWith('eln') ? inf.slice(0,-2)
               : inf.endsWith('ern') ? inf.slice(0,-2)
               : inf.endsWith('en')  ? inf.slice(0,-2)
               : inf;

    const needsE = /[td]$/.test(stem) || /[^aeiou][nm]$/.test(stem);
    const s2 = needsE ? stem + 'e' : stem;

    return [
      stem  + 'e',
      s2    + 'st',
      s2    + 't',
      inf.endsWith('eln') ? stem + 'ln' : stem + 'en',
      s2    + 't',
      inf.endsWith('eln') ? stem + 'ln' : stem + 'en',
    ];
  },

  imperativVerb(de) {
    if (!de) return null;
    let base = de.toLowerCase().replace(/^(ich|du|er|sie|es|wir|ihr)\s+/, '').trim();
    let inf  = base;
    if (!inf.endsWith('en')) {
      if      (inf.endsWith('t')) inf = inf.slice(0,-1) + 'en';
      else if (inf.endsWith('e')) inf = inf + 'n';
      else                        inf = inf + 'en';
    }
    const irregImp = {
      'sein':   ['sei','seid'],
      'haben':  ['hab','habt'],
      'werden': ['werd','werdet'],
      'geben':  ['gib','gebt'],
      'sehen':  ['sieh','seht'],
    };
    if (irregImp[inf]) return irregImp[inf];
    const stem   = inf.endsWith('en') ? inf.slice(0,-2) : inf;
    const needsE = /[td]$/.test(stem);
    return [
      stem + (needsE ? 'e'  : ''),
      stem + (needsE ? 'et' : 't')
    ];
  },

  declineNoun(word, genus) {
    if (!word || word === '–') return null;
    const w   = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    const art = genus === 'm.' ? 'der' : genus === 'f.' ? 'die' : genus === 'n.' ? 'das' : null;
    if (!art) return null;

    let sg, pl;
    if (genus === 'm.') {
      sg = [`der ${w}`, `des ${w}s`, `dem ${w}`, `den ${w}`, `der ${w}`, `dem ${w}`];
      pl = [`die ${w}`, `der ${w}`, `den ${w}n`, `die ${w}`, `die ${w}`, `den ${w}n`];
    } else if (genus === 'f.') {
      sg = [`die ${w}`, `der ${w}`, `der ${w}`, `die ${w}`, `die ${w}`, `der ${w}`];
      pl = [`die ${w}n`, `der ${w}n`, `den ${w}n`, `die ${w}n`, `die ${w}n`, `den ${w}n`];
    } else {
      sg = [`das ${w}`, `des ${w}s`, `dem ${w}`, `das ${w}`, `das ${w}`, `dem ${w}`];
      pl = [`die ${w}`, `der ${w}`, `den ${w}n`, `die ${w}`, `die ${w}`, `den ${w}n`];
    }
    return { sg, pl };
  }
};

// ── Lateinisches Grammatik-Engine ────────────────────────────
// Bildet Formen nach Regeln. Was ein Admin in der Detailansicht von Hand
// einträgt (r.forms), hat immer Vorrang – siehe vok-forms.js.
const Latin = {

  // Konjugationsklassen: Kurzname für Tabellen, Langname für Überschriften/Filter
  KONJ: {
    a:     { short: 'a-Konj.',     long: 'a-Konjugation (1.)' },
    e:     { short: 'e-Konj.',     long: 'e-Konjugation (2.)' },
    kons:  { short: 'kons. Konj.', long: 'konsonantische Konjugation (3.)' },
    i:     { short: 'i-Konj.',     long: 'i-Konjugation (4.)' },
    misch: { short: 'Misch-Konj.', long: 'Mischkonjugation (3., capio-Typ)' },
    irr:   { short: 'unregelm.',   long: 'unregelmäßiges Verb' }
  },

  _has(v) { return !!v && !['–', '-', '#'].includes(String(v).trim()); },

  // Wortart: 'noun' | 'verb' | 'adj' | 'indecl' (= alles andere)
  detectType(r) {
    if (['noun', 'verb', 'adj', 'indecl'].includes(r.type)) return r.type;   // vom Admin festgelegt
    const lat   = (r.lat   || '').trim();
    const fall2 = this._has(r.fall2) ? r.fall2.trim() : '';
    const genus = (r.genus || '').trim();
    if (lat.includes('/') && !/\s/.test(lat)) return this.adjForms(lat) ? 'adj' : 'indecl';
    if (['m.', 'f.', 'n.'].includes(genus)) return 'noun';
    if (/^[1-5]\. Dekl\.$/.test((r.dekl || '').trim())) return 'noun';
    if (/(o|m|or)$/.test(fall2)) return 'verb';
    if (/(are|ere|ire)$/.test(lat) && !/\s/.test(lat)) return 'verb';
    return 'indecl';
  },

  // ── Verben ────────────────────────────────────────────────
  // "petere a/ab" → "petere": nur das erste Wort ist der Infinitiv
  _inf(lat) { return (lat || '').trim().split(/\s+/)[0] || ''; },

  // Klasse aus Infinitiv + 1. Person Präsens; null = unregelmäßig (esse, ire, ferre …)
  verbClass(inf, sg1) {
    inf = this._inf(inf).toLowerCase();
    sg1 = this._has(sg1) ? sg1.trim().toLowerCase() : '';
    if (inf.endsWith('are')) return (!sg1 || sg1.endsWith('o')) ? 'a' : null;
    if (inf.endsWith('ire')) {
      if (sg1.endsWith('eo')) return null;                 // ire und Komposita: eo, adeo, exeo
      return (!sg1 || sg1.endsWith('io')) ? 'i' : null;
    }
    if (inf.endsWith('ere')) {
      if (sg1.endsWith('eo')) return 'e';
      if (sg1.endsWith('io')) return 'misch';
      if (!sg1 || sg1.endsWith('o')) return 'kons';
    }
    return null;
  },

  // Alle Zeiten eines Verbs. Jede Zeit: 6 Formen (1. Sg. … 3. Pl.) oder null.
  conjugate(inf, sg1, perf) {
    inf  = this._inf(inf);
    sg1  = this._has(sg1)  ? sg1.trim()  : '';
    perf = this._has(perf) ? perf.trim() : '';
    const klass = this.verbClass(inf, sg1);
    const out = { klass, praes: null, impf: null, fut: null, perf: null, plqpf: null, imp: null };

    if (klass) {
      const b   = inf.slice(0, -3);
      const add = (stem, ends) => ends.map(e => stem + e);
      const bam = ['bam', 'bas', 'bat', 'bamus', 'batis', 'bant'];
      const bo  = ['bo', 'bis', 'bit', 'bimus', 'bitis', 'bunt'];
      const am  = ['am', 'es', 'et', 'emus', 'etis', 'ent'];
      if (klass === 'a') {
        out.praes = add(b, ['o', 'as', 'at', 'amus', 'atis', 'ant']);
        out.impf  = add(b + 'a', bam);  out.fut = add(b + 'a', bo);  out.imp = [b + 'a', b + 'ate'];
      } else if (klass === 'e') {
        out.praes = add(b, ['eo', 'es', 'et', 'emus', 'etis', 'ent']);
        out.impf  = add(b + 'e', bam);  out.fut = add(b + 'e', bo);  out.imp = [b + 'e', b + 'ete'];
      } else if (klass === 'i') {
        out.praes = add(b, ['io', 'is', 'it', 'imus', 'itis', 'iunt']);
        out.impf  = add(b + 'ie', bam); out.fut = add(b + 'i', am);  out.imp = [b + 'i', b + 'ite'];
      } else if (klass === 'kons') {
        const s = sg1 ? sg1.slice(0, -1) : b;
        out.praes = add(s, ['o', 'is', 'it', 'imus', 'itis', 'unt']);
        out.impf  = add(s + 'e', bam);  out.fut = add(s, am);        out.imp = [s + 'e', s + 'ite'];
      } else {   // misch: capere, capio
        const s = sg1.slice(0, -2);
        out.praes = add(s, ['io', 'is', 'it', 'imus', 'itis', 'iunt']);
        out.impf  = add(s + 'ie', bam); out.fut = add(s + 'i', am);  out.imp = [s + 'e', s + 'ite'];
      }
      if (sg1) out.praes[0] = sg1;
      const shortImp = { dicere: 'dic', ducere: 'duc', facere: 'fac' };
      if (shortImp[inf.toLowerCase()]) out.imp[0] = shortImp[inf.toLowerCase()];
    }

    // Perfekt und Plusquamperfekt hängen nur am Perfektstamm – auch bei unregelmäßigen Verben
    if (/i$/.test(perf) && !/\s/.test(perf)) {
      const s = perf.slice(0, -1);
      out.perf  = ['i', 'isti', 'it', 'imus', 'istis', 'erunt'].map(e => s + e);
      out.plqpf = ['eram', 'eras', 'erat', 'eramus', 'eratis', 'erant'].map(e => s + e);
    } else if (/us sum$/.test(perf)) {          // Deponentien: gavisus sum
      const sg = perf.slice(0, -4), pl = sg.slice(0, -2) + 'i';
      out.perf  = [sg + ' sum', sg + ' es', sg + ' est', pl + ' sumus', pl + ' estis', pl + ' sunt'];
      out.plqpf = [sg + ' eram', sg + ' eras', sg + ' erat', pl + ' eramus', pl + ' eratis', pl + ' erant'];
    }
    return out;
  },

  // ── Nomen ─────────────────────────────────────────────────
  // Liefert { decl, sg[6], pl[6] } in der Reihenfolge Nom, Gen, Dat, Akk, Vok, Abl
  declineNoun(nom, gen, genus, dekl) {
    nom = (nom || '').trim(); gen = this._has(gen) ? gen.trim() : '';
    if (!nom || !gen || /\s/.test(nom)) return null;
    const none = ['', '', '', '', '', ''];

    // Pluralwörter: litterae, litterarum · liberi, liberorum
    if (gen.endsWith('arum')) {
      const s = gen.slice(0, -4);
      return { decl: 1, sg: none, pl: [nom, gen, s + 'is', s + 'as', nom, s + 'is'] };
    }
    if (gen.endsWith('orum')) {
      const s = gen.slice(0, -4), n = genus === 'n.';
      return { decl: 2, sg: none, pl: [nom, gen, s + 'is', n ? nom : s + 'os', nom, s + 'is'] };
    }

    let decl = parseInt(dekl, 10) || 0;
    if (!decl) {
      if      (gen.endsWith('ae')) decl = 1;
      else if (gen.endsWith('ei')) decl = 5;
      else if (gen.endsWith('i'))  decl = 2;
      else if (gen.endsWith('is')) decl = 3;
      else if (gen.endsWith('us')) decl = 4;
    }

    const n = genus === 'n.';
    let sg = [], pl = [];

    if (decl === 1) {
      const s = gen.slice(0, -2);
      sg = [nom, gen, s + 'ae', s + 'am', nom, s + 'a'];
      pl = [s + 'ae', s + 'arum', s + 'is', s + 'as', s + 'ae', s + 'is'];
    } else if (decl === 2) {
      const s = gen.slice(0, -1);
      if (n) {
        sg = [nom, gen, s + 'o', nom, nom, s + 'o'];
        pl = [s + 'a', s + 'orum', s + 'is', s + 'a', s + 'a', s + 'is'];
      } else {
        // Vokativ: dominus → domine, filius → fili, puer → puer
        const vok = nom.endsWith('ius') ? s : nom.endsWith('us') ? s + 'e' : nom;
        sg = [nom, gen, s + 'o', s + 'um', vok, s + 'o'];
        pl = [s + 'i', s + 'orum', s + 'is', s + 'os', s + 'i', s + 'is'];
      }
    } else if (decl === 3) {
      const s = gen.slice(0, -2);
      if (n) {
        sg = [nom, gen, s + 'i', nom, nom, s + 'e'];
        pl = [s + 'a', s + 'um', s + 'ibus', s + 'a', s + 'a', s + 'ibus'];
      } else {
        sg = [nom, gen, s + 'i', s + 'em', nom, s + 'e'];
        pl = [s + 'es', s + 'um', s + 'ibus', s + 'es', s + 'es', s + 'ibus'];
      }
    } else if (decl === 4) {
      const s = gen.slice(0, -2);
      if (n) {
        sg = [nom, gen, s + 'u', nom, nom, s + 'u'];
        pl = [s + 'ua', s + 'uum', s + 'ibus', s + 'ua', s + 'ua', s + 'ibus'];
      } else {
        sg = [nom, gen, s + 'ui', s + 'um', nom, s + 'u'];
        pl = [s + 'us', s + 'uum', s + 'ibus', s + 'us', s + 'us', s + 'ibus'];
      }
    } else if (decl === 5) {
      const s  = gen.slice(0, -2);
      const ps = nom.endsWith('es') ? nom.slice(0, -2) : nom.endsWith('s') ? nom.slice(0, -1) : nom;
      sg = [nom, gen, s + 'ei', s + 'em', nom, s + 'e'];
      pl = [nom, ps + 'erum', ps + 'ebus', nom, nom, ps + 'ebus'];
    }

    return sg.length ? { decl, sg, pl } : null;
  },

  // ── Adjektive ─────────────────────────────────────────────
  // Zerlegt "bonus/a/um", "pulcher/ra/rum", "nobilis/e", "multi/ae/a" in volle Nominative.
  // null = kein Adjektiv (z.B. hic/haec/hoc, me/te/se).
  adjForms(lat) {
    const p = (lat || '').split('/').map(s => s.trim().replace(/^-/, '')).filter(Boolean);
    if (p.length < 2 || p.length > 3) return null;
    const m = p[0], ml = m.toLowerCase(), lo = p.map(s => s.toLowerCase());
    const isFull = s => s.length >= m.length - 1 && s.slice(0, 2).toLowerCase() === ml.slice(0, 2);
    // Endung ans Maskulinum hängen: vester + tra → vestra, miser + era → misera, pulcher + ra → pulchra
    const join = suf => {
      if (isFull(suf)) return suf;
      if (ml.endsWith('er') && suf[0].toLowerCase() === 'r') return m.slice(0, -2) + suf;
      const i = ml.lastIndexOf(suf[0].toLowerCase());
      return i > 0 ? m.slice(0, i) + suf : m + suf;
    };

    if (p.length === 3) {
      if (ml.endsWith('us') && lo[1].endsWith('a') && lo[2].endsWith('um')) {
        const s = m.slice(0, -2);
        return { kind: 'o', stem: s, m, f: s + 'a', n: s + 'um' };
      }
      if (ml.endsWith('er') && lo[1].endsWith('a') && lo[2].endsWith('um')) {
        const f = join(p[1]), s = f.slice(0, -1);
        return { kind: 'o', stem: s, m, f, n: s + 'um' };
      }
      if (ml.endsWith('i') && lo[1].endsWith('ae') && lo[2].endsWith('a')) {
        const s = m.slice(0, -1);
        return { kind: 'o-pl', stem: s, m, f: s + 'ae', n: s + 'a' };
      }
      if (ml.endsWith('er') && lo[1].endsWith('is') && lo[2].endsWith('e')) {
        const f = join(p[1]), s = f.slice(0, -2);
        return { kind: 'i', stem: s, m, f, n: s + 'e' };
      }
      return null;
    }
    if (ml.endsWith('is') && lo[1].endsWith('e')) {
      const s = m.slice(0, -2);
      return { kind: 'i', stem: s, m, f: m, n: s + 'e' };
    }
    return null;
  },

  // Liefert { klass, m_sg, f_sg, n_sg, m_pl, f_pl, n_pl } (je Nom, Gen, Dat, Akk, Vok, Abl)
  declineAdj(lat) {
    const a = this.adjForms(lat);
    if (!a) return null;
    const s = a.stem, add = ends => ends.map(e => s + e), none = ['', '', '', '', '', ''];

    if (a.kind === 'i') {
      return {
        klass: '3. Dekl.',
        m_sg: [a.m, s + 'is', s + 'i', s + 'em', a.m, s + 'i'],
        f_sg: [a.f, s + 'is', s + 'i', s + 'em', a.f, s + 'i'],
        n_sg: [a.n, s + 'is', s + 'i', a.n, a.n, s + 'i'],
        m_pl: add(['es', 'ium', 'ibus', 'es', 'es', 'ibus']),
        f_pl: add(['es', 'ium', 'ibus', 'es', 'es', 'ibus']),
        n_pl: add(['ia', 'ium', 'ibus', 'ia', 'ia', 'ibus'])
      };
    }

    const pl = {
      m_pl: add(['i', 'orum', 'is', 'os', 'i', 'is']),
      f_pl: add(['ae', 'arum', 'is', 'as', 'ae', 'is']),
      n_pl: add(['a', 'orum', 'is', 'a', 'a', 'is'])
    };
    if (a.kind === 'o-pl') return { klass: '1./2. Dekl.', m_sg: none, f_sg: none, n_sg: none, ...pl };

    const ml  = a.m.toLowerCase();
    const vok = ml === 'meus' ? 'mi' : ml.endsWith('us') ? s + 'e' : a.m;
    const res = {
      klass: '1./2. Dekl.',
      m_sg: [a.m, s + 'i', s + 'o', s + 'um', vok, s + 'o'],
      f_sg: add(['a', 'ae', 'ae', 'am', 'a', 'a']),
      n_sg: add(['um', 'i', 'o', 'um', 'um', 'o']),
      ...pl
    };
    // unus, solus, totus …: Genitiv -ius, Dativ -i in allen Geschlechtern
    if (['unus', 'solus', 'totus', 'ullus', 'nullus', 'alter', 'uter', 'neuter'].includes(ml)) {
      ['m_sg', 'f_sg', 'n_sg'].forEach(k => { res[k][1] = s + 'ius'; res[k][2] = s + 'i'; });
    }
    return res;
  },

  // Eintrag für die Spalte „Dekl./Konj." in den Vokabellisten
  klassShort(r, type) {
    type = type || this.detectType(r);
    if (type === 'verb') return this.KONJ[this.verbClass(r.lat, r.fall2) || 'irr'].short;
    return this._has(r.dekl) ? r.dekl.trim() : '';
  }
};
