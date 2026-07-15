// ============================================
// 🔥 ИМПОРТЫ FIREBASE SDK
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore,
    collection,
    doc,
    addDoc,
    getDocs,
    getDoc,
    deleteDoc,
    updateDoc,
    setDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// 🔥 ТВОЯ КОНФИГУРАЦИЯ
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyDBeypd4mT0sIxDTPJnQ1_HSg8TioceY58",
    authDomain: "arizonagames-2c62c.firebaseapp.com",
    projectId: "arizonagames-2c62c",
    storageBucket: "arizonagames-2c62c.firebasestorage.app",
    messagingSenderId: "397871706452",
    appId: "1:397871706452:web:0d8524313a77b60ccd18c1",
    measurementId: "G-DMBYN7V8MP"
};

// ============================================
// 🔥 ИНИЦИАЛИЗАЦИЯ
// ============================================
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================
// 🔥 ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ
// ============================================
window.app = app;
window.analytics = analytics;
window.auth = auth;
window.db = db;

// Делаем всё доступным глобально
window.firebase = {
    app,
    analytics,
    auth,
    db,
    // Auth functions
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail,
    // Firestore functions
    collection,
    doc,
    addDoc,
    getDocs,
    getDoc,
    deleteDoc,
    updateDoc,
    setDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    arrayUnion,
    arrayRemove
};

// ============================================
// 🔥 ПРОВЕРКА ПОДКЛЮЧЕНИЯ
// ============================================
console.log('🔥 Firebase инициализирован успешно!');
console.log('📊 Проект:', firebaseConfig.projectId);
console.log('🔑 Auth:', auth ? '✅' : '❌');
console.log('🗄️ Firestore:', db ? '✅' : '❌');

// Проверяем подключение к Firestore (читаем тестовый документ)
try {
    const testDoc = doc(db, '_test', 'test');
    getDoc(testDoc).then(() => {
        console.log('✅ Подключение к Firestore установлено');
    }).catch((error) => {
        console.warn('⚠️ Firestore недоступна:', error.message);
        console.log('📌 Проверьте правила безопасности в Firebase Console → Firestore → Rules');
    });
} catch (error) {
    console.warn('⚠️ Ошибка проверки Firestore:', error.message);
}

// Проверяем авторизацию
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('👤 Пользователь авторизован:', user.email);
    } else {
        console.log('👤 Пользователь не авторизован');
    }
});

console.log('✅ Firebase готов к работе!');