import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAeoScw5UK53ElBnNdhtJVAETb3_isOEKs",
  authDomain: "fram-and-go.firebaseapp.com",
  databaseURL: "https://fram-and-go-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fram-and-go",
  storageBucket: "fram-and-go.firebasestorage.app",
  messagingSenderId: "781295119002",
  appId: "1:781295119002:web:4be2d54934395b491c0d23",
  measurementId: "G-TKPPF986Z0",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);
