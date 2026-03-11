// config/firebase.js
import { initializeApp } from 'firebase/app';
// 1. Swap getAuth for initializeAuth and getReactNativePersistence
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; 
import { getStorage } from 'firebase/storage';
// 2. Import AsyncStorage so Firebase can use it
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// 3. Initialize Auth WITH AsyncStorage attached as its memory bank
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app); 
export const storage = getStorage(app);