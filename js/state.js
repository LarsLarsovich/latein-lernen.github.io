'use strict';

// ── Globaler App-State ────────────────────────────────────────
const state = {
  published: [], drafts: [], pronomen: [], vokabel: [],
  pronomenDrafts: [], vokabelDrafts: [],
  adminLoggedIn: false,
  currentTab: 'quizes',
  currentQuiz: null, lastQuizId: null, lastQuizSource: null,
  quizType: 'pronomen',
  _quizOrigin: null,       // 'table' | 'alle' | 'custom'
  currentAdmin: null,
  currentVokabelTable: null,
  editingId: null, editingSource: null,
  actionId: null, actionType: null,
  tableViewId: null, tableViewType: null,
  pickerMode: null,
  goetter: [],
  editingGottId: null,
  stammbaumUrl: 'https://miro.com/app/live-embed/uXjVGtIatxo=/?embedMode=view_only_without_ui&moveToViewport=-2021,-241,2861,1623&embedId=292432411735',
  _pendingQuizConfig: null,
  unsubs: {}
};
