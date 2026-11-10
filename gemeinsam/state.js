'use strict';

// ── Globaler Zustand einer Seite ──────────────────────────────
// Jede Themenseite lädt nur die Sammlungen, die sie braucht (App.init).
const state = {
  // Daten aus Firestore
  vokabel: [], vokabelDrafts: [], pronomen: [], pronomenDrafts: [],
  goetter: [], unregelmaessige: [],

  // Admin
  adminLoggedIn: false,
  currentAdmin: null,        // { uid, name, username, isSuperAdmin }

  // Quiz
  currentQuiz: null, lastQuizId: null, lastQuizSource: null,
  quizType: 'pronomen',      // 'pronomen' | 'vokabel'
  _quizOrigin: null,         // 'table' | 'alle' | 'custom'
  currentVokabelTable: null,
  _pendingQuizConfig: null,
  _customQuizIds: null,

  // Tabellen-Ansicht und Editoren
  tableViewId: null, tableViewType: null,
  editingId: null, editingSource: null,
  actionId: null, actionType: null, actionIsDraft: false,
  editingGottId: null
};
