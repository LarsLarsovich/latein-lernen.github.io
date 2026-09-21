'use strict';

const Progress = (() => {

  const STAGES = [
    { id: 1,  title: '1. Deklination',   sub: 'Formen & Endungen',      page: 'deklination' },
    { id: 2,  title: 'Vokabeln I',        sub: '1. Lektion',              page: 'vokabeln'    },
    { id: 3,  title: '2. Deklination',   sub: 'Formen & Endungen',      page: 'deklination' },
    { id: 4,  title: '1. Konjugation',   sub: 'Verbformen',              page: 'konjugation' },
    { id: 5,  title: '3. Deklination',   sub: 'Formen & Endungen',      page: 'deklination' },
    { id: 6,  title: 'Vokabeln II',       sub: '2. Lektion',              page: 'vokabeln'    },
    { id: 7,  title: 'Konjugation II',   sub: '2. & 3. Konjugation',   page: 'konjugation' },
    { id: 8,  title: 'Pronomina',         sub: 'Personen & Pronomen',    page: 'pronomina'   },
    { id: 9,  title: '4. Deklination',   sub: 'Formen & Endungen',      page: 'deklination' },
    { id: 10, title: 'Vokabeln III',      sub: '3. Lektion',              page: 'vokabeln'    },
    { id: 11, title: 'Übungen',           sub: 'Gemischte Aufgaben',     page: 'uebungen'    },
    { id: 12, title: 'Abschluss',         sub: 'Großer Abschlusstest',   page: 'uebungen'    },
  ];

  let _cache = null;

  function _docRef() {
    const user = Auth.getCurrentUser();
    if (!user) throw new Error('Nicht eingeloggt');
    return SF_COL.progress.doc(user.email);
  }

  async function load() {
    const snap = await _docRef().get();
    _cache = snap.exists ? snap.data() : {};
    if (!_cache.currentStage) _cache.currentStage = 1;
    return _cache;
  }

  function getCurrentStage() {
    return (_cache && _cache.currentStage) || 1;
  }

  async function completeStage(stageId) {
    const next   = stageId + 1;
    const newVal = Math.max(next, getCurrentStage());
    await _docRef().set({ currentStage: newVal }, { merge: true });
    if (_cache) _cache.currentStage = newVal;
  }

  function getStages() { return STAGES; }

  return { load, getCurrentStage, completeStage, getStages };
})();
