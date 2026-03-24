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
const Latin = {

  detectType(r) {
    const lat   = (r.lat   || '').trim();
    const fall2 = (r.fall2 || '').trim();
    const genus = (r.genus || '').trim();
    if (lat.includes('/')) return 'adj';
    if (['m.','f.','n.'].includes(genus)) return 'noun';
    if (fall2 && fall2 !== '#' && fall2 !== '–' &&
        (fall2.endsWith('o') || fall2.endsWith('m') || fall2.endsWith('or'))) return 'verb';
    if (lat.endsWith('are') || lat.endsWith('ere') || lat.endsWith('ire')) return 'verb';
    return 'indecl';
  },

  conjugateVerb(inf, form1sg) {
    let stem = '', endings = [], conj = '', impSg = '', impPl = '';
    if (inf.endsWith('are')) {
      stem     = inf.slice(0, -3);
      endings  = ['o','as','at','amus','atis','ant'];
      conj     = '1. Konjugation';
      impSg    = stem + 'a';
      impPl    = stem + 'ate';
    } else if (inf.endsWith('ire')) {
      stem     = inf.slice(0, -3);
      endings  = ['io','is','it','imus','itis','iunt'];
      conj     = '4. Konjugation';
      impSg    = stem + 'i';
      impPl    = stem + 'ite';
    } else if (inf.endsWith('ere')) {
      if (form1sg && form1sg.endsWith('eo')) {
        stem     = inf.slice(0, -3);
        endings  = ['eo','es','et','emus','etis','ent'];
        conj     = '2. Konjugation';
        impSg    = stem + 'e';
        impPl    = stem + 'ete';
      } else {
        stem = inf.slice(0, -3);
        const sg1   = (form1sg && form1sg !== '#' && form1sg !== '–') ? form1sg : stem + 'o';
        const stem3 = sg1.endsWith('o') ? sg1.slice(0,-1) : stem;
        return {
          conj: '3. Konjugation',
          forms: [
            ['1. Sg.', sg1],
            ['2. Sg.', stem3 + 'is'],
            ['3. Sg.', stem3 + 'it'],
            ['1. Pl.', stem3 + 'imus'],
            ['2. Pl.', stem3 + 'itis'],
            ['3. Pl.', stem3 + 'unt']
          ],
          imperativ: [
            ['Sg. (du)',  stem3 + 'e'],
            ['Pl. (ihr)', stem3 + 'ite']
          ]
        };
      }
    } else {
      return null;
    }
    const sg1 = (form1sg && form1sg !== '#' && form1sg !== '–') ? form1sg : stem + endings[0];
    return {
      conj,
      forms: [
        ['1. Sg. (ich)',       sg1],
        ['2. Sg. (du)',        stem + endings[1]],
        ['3. Sg. (er/sie/es)', stem + endings[2]],
        ['1. Pl. (wir)',       stem + endings[3]],
        ['2. Pl. (ihr)',       stem + endings[4]],
        ['3. Pl. (sie)',       stem + endings[5]]
      ],
      imperativ: [
        ['Sg. (du)',  impSg],
        ['Pl. (ihr)', impPl]
      ]
    };
  },

  declineNoun(nom, gen, genus) {
    let decl = 0;
    if      (gen.endsWith('ae'))  decl = 1;
    else if (gen.endsWith('ei'))  decl = 5;
    else if (gen.endsWith('i'))   decl = 2;
    else if (gen.endsWith('is'))  decl = 3;
    else if (gen.endsWith('us'))  decl = 4;

    const n = genus === 'n.';
    let sg = [], pl = [];

    if (decl === 1) {
      const stem = gen.slice(0, -2);
      sg = [nom, gen, stem+'ae', stem+'am', nom, stem+'a'];
      pl = [stem+'ae', stem+'arum', stem+'is', stem+'as', stem+'ae', stem+'is'];

    } else if (decl === 2) {
      const stem = gen.slice(0, -1);
      if (n) {
        sg = [nom, gen, stem+'o', nom, nom, stem+'o'];
        pl = [stem+'a', stem+'orum', stem+'is', stem+'a', stem+'a', stem+'is'];
      } else {
        const vokSg = stem + 'e';
        sg = [nom, gen, stem+'o', stem+'um', vokSg, stem+'o'];
        pl = [stem+'i', stem+'orum', stem+'is', stem+'os', stem+'i', stem+'is'];
      }

    } else if (decl === 3) {
      const stem = gen.slice(0, -2);
      if (n) {
        sg = [nom, gen, stem+'i', nom, nom, stem+'e'];
        pl = [stem+'a', stem+'um', stem+'ibus', stem+'a', stem+'a', stem+'ibus'];
      } else {
        sg = [nom, gen, stem+'i', stem+'em', nom, stem+'e'];
        pl = [stem+'es', stem+'um', stem+'ibus', stem+'es', stem+'es', stem+'ibus'];
      }

    } else if (decl === 4) {
      const stem = gen.slice(0, -2);
      if (n) {
        sg = [nom, gen, stem+'u', nom, nom, stem+'u'];
        pl = [stem+'ua', stem+'uum', stem+'ibus', stem+'ua', stem+'ua', stem+'ibus'];
      } else {
        sg = [nom, gen, stem+'ui', stem+'um', nom, stem+'u'];
        pl = [stem+'us', stem+'uum', stem+'ibus', stem+'us', stem+'us', stem+'ibus'];
      }

    } else if (decl === 5) {
      const stem    = gen.slice(0, -2);
      const plstem  = nom.endsWith('es') ? nom.slice(0,-2) : nom.endsWith('s') ? nom.slice(0,-1) : nom;
      sg = [nom, gen, stem+'ei', stem+'em', nom, stem+'e'];
      pl = [nom, plstem+'erum', plstem+'ebus', nom, nom, plstem+'ebus'];
    }

    if (!sg.length) return null;
    const cases = ['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
    return { decl, sg, pl, cases };
  },

  declineAdj(lat) {
    const parts = lat.split('/');
    if (parts.length < 2) return null;
    const mNom = parts[0].trim();
    let stem = mNom.endsWith('us') ? mNom.slice(0,-2)
             : mNom.endsWith('er') ? mNom
             : mNom;

    const cases = ['Nominativ','Genitiv','Dativ','Akkusativ','Vokativ','Ablativ'];
    const m_sg  = [mNom, stem+'i', stem+'o', stem+'um', mNom, stem+'o'];
    const f_sg  = [stem+'a', stem+'ae', stem+'ae', stem+'am', stem+'a', stem+'a'];
    const n_sg  = [stem+'um', stem+'i', stem+'o', stem+'um', stem+'um', stem+'o'];
    const m_pl  = [stem+'i', stem+'orum', stem+'is', stem+'os', stem+'i', stem+'is'];
    const f_pl  = [stem+'ae', stem+'arum', stem+'is', stem+'as', stem+'ae', stem+'is'];
    const n_pl  = [stem+'a', stem+'orum', stem+'is', stem+'a', stem+'a', stem+'is'];
    return { cases, m_sg, f_sg, n_sg, m_pl, f_pl, n_pl };
  }
};
