// Firebase settings that make the app live: every phone sees the same records as they change.
// Leave this as null to keep records only on each phone. See FIREBASE_SETUP.md for how to fill it in.
// (These settings are meant to be public; the database rules in firestore.rules protect the data.)
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyBQRRXgONDgHgrEMkTKL5GKO1pNMbD8KDk",
  authDomain: "poultry-tracker-be144.firebaseapp.com",
  projectId: "poultry-tracker-be144",
  storageBucket: "poultry-tracker-be144.firebasestorage.app",
  messagingSenderId: "655292934578",
  appId: "1:655292934578:web:ea13e48ef05b5ea2605cab",
  measurementId: "G-SZ8REMJJ1N"
};
