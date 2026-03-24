'use strict';

// ── Firebase Config ───────────────────────────────────────────
// Der API-Key ist öffentlich — das ist normal für Firebase Web-Apps.
// Die Sicherheit kommt über Firestore Security Rules (nicht über den Key).
const firebaseConfig = {
  apiKey:            "AIzaSyDfIOQMo95TufbHY_f1EXHKhgP8FCu2PR4",
  authDomain:        "latein-lernen.firebaseapp.com",
  projectId:         "latein-lernen",
  storageBucket:     "latein-lernen.firebasestorage.app",
  messagingSenderId: "976723559385",
  appId:             "1:976723559385:web:efcf9b5176fa84676c8fc8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const COL = {
  published:      db.collection('quizes'),
  drafts:         db.collection('drafts'),
  pronomen:       db.collection('tables_pronomen'),
  vokabel:        db.collection('tables_vokabel'),
  pronomenDrafts: db.collection('drafts_pronomen'),
  vokabelDrafts:  db.collection('drafts_vokabel'),
  reports:        db.collection('reports'),
  admins:         db.collection('admins')
};
