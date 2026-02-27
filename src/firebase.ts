import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCvqBmEnsx9oanYg6EWJfrkc8UEhtuEJeU",
  authDomain: "hirely-8c42f.firebaseapp.com",
  projectId: "hirely-8c42f",
  storageBucket: "hirely-8c42f.firebasestorage.app",
  messagingSenderId: "112531504936",
  appId: "1:112531504936:web:26982f5a895baea5c5da1d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
