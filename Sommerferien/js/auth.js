'use strict';

const Auth = (() => {
  const SESSION_KEY = 'sf_user_email';

  let _currentUser = null;

  function getCurrentUser() {
    return _currentUser;
  }

  function getStoredEmail() {
    return sessionStorage.getItem(SESSION_KEY);
  }

  async function loginWithEmail(email) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
    }

    const docRef = SF_COL.users.doc(trimmed);
    const snap = await docRef.get();

    if (!snap.exists) {
      await docRef.set({
        email:     trimmed,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen:  firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await docRef.update({
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    _currentUser = { email: trimmed };
    sessionStorage.setItem(SESSION_KEY, trimmed);
    return _currentUser;
  }

  async function tryAutoLogin() {
    const email = getStoredEmail();
    if (!email) return null;
    try {
      const snap = await SF_COL.users.doc(email).get();
      if (snap.exists) {
        _currentUser = { email };
        return _currentUser;
      }
    } catch (e) {
      // ignore
    }
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }

  function logout() {
    _currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
  }

  return { getCurrentUser, loginWithEmail, tryAutoLogin, logout };
})();
