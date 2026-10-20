// Firebase settings that make the app live: every phone sees the same records as they change.
// Leave this as null to keep records only on each phone. See FIREBASE_SETUP.md for how to fill it in.
// (These settings are meant to be public; the database rules in firestore.rules protect the data.)
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || null;
