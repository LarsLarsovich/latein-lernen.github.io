'use strict';

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

const SF_COL = {
  users:    db.collection('sommerferien_users'),
  progress: db.collection('sommerferien_progress'),
};
