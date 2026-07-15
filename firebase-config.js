// ============================================
// 🔥 КОНФИГУРАЦИЯ FIREBASE
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Ваша конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDBeypd4mT0sIxDTPJnQ1_HSg8TioceY58",
    authDomain: "arizonagames-2c62c.firebaseapp.com",
    projectId: "arizonagames-2c62c",
    storageBucket: "arizonagames-2c62c.firebasestorage.app",
    messagingSenderId: "397871706452",
    appId: "1:397871706452:web:0d8524313a77b60ccd18c1",
    measurementId: "G-DMBYN7V8MP"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Делаем объекты доступными глобально
window.firebaseApp = app;
window.analytics = analytics;
window.auth = auth;
window.db = db;

console.log('🔥 Firebase инициализирован успешно!');
console.log('📊 Проект:', firebaseConfig.projectId);