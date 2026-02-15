// config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; 

const firebaseConfig = {
  apiKey: "AIzaSyBNhdyamoJ2IB6chxV8VQSuE_QOgbJz2DA",
  authDomain: "occasio-866c3.firebaseapp.com",
  projectId: "occasio-866c3",
  storageBucket: "occasio-866c3.firebasestorage.app",
  messagingSenderId: "982786283947",
  appId: "1:982786283947:web:ff5a4db6acb119fac61aee",
  measurementId: "G-VN1WKPML5F"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app); 

