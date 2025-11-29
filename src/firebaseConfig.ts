// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFunctions } from "firebase/functions";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "haarmonie-bonus.firebaseapp.com",
  projectId: "haarmonie-bonus",
  storageBucket: "haarmonie-bonus.firebasestorage.app",
  messagingSenderId: "940040973972",
  appId: "1:940040973972:web:8eca6cbaeab6ad7ec90e81",
};

if (!firebaseConfig.apiKey) {
  throw new Error("Firebase API Key (EXPO_PUBLIC_FIREBASE_API_KEY) fehlt.");
}

const app = initializeApp(firebaseConfig);

export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
export const db = getFirestore(app);
export const functions = getFunctions(app);
