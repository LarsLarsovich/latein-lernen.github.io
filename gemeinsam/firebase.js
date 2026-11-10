'use strict';

// ── Firebase Config ───────────────────────────────────────────
// Der API-Key ist öffentlich — das ist normal für Firebase Web-Apps.
// Die Sicherheit kommt über die Firestore-Regeln (firestore.rules) und
// den Admin-Login über Firebase Authentication.
const firebaseConfig = {
  apiKey:            "AIzaSyDfIOQMo95TufbHY_f1EXHKhgP8FCu2PR4",
  authDomain:        "latein-lernen.firebaseapp.com",
  projectId:         "latein-lernen",
  storageBucket:     "latein-lernen.firebasestorage.app",
  messagingSenderId: "976723559385",
  appId:             "1:976723559385:web:efcf9b5176fa84676c8fc8"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

// Admins melden sich mit einem Benutzernamen an. Firebase braucht eine
// E-Mail-Adresse, deshalb wird aus "emil" intern "emil@<ADMIN_DOMAIN>".
const ADMIN_DOMAIN = 'latein-lernen.firebaseapp.com';

const COL = {
  vokabel:         db.collection('tables_vokabel'),
  vokabelDrafts:   db.collection('drafts_vokabel'),
  pronomen:        db.collection('tables_pronomen'),
  pronomenDrafts:  db.collection('drafts_pronomen'),
  goetter:         db.collection('goetter'),
  unregelmaessige: db.collection('unregelmaessige'),
  reports:         db.collection('reports'),
  admins:          db.collection('admins')     // Dokument-ID = Firebase-UID
};
