// ============================================
// ОСНОВНОЙ СКРИПТ ФОРУМА
// ============================================

import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
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
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

const auth = getAuth();
const db = getFirestore();

let currentUser = null;
let currentThreadId = null;
let isAdmin = false;

// ============================================
// PRELOADER
// ============================================

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('preloader').classList.add('hidden');
    }, 1000);
});

// ============================================
// HEADER SCROLL EFFECT
// ============================================

window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ============================================
// АУТЕНТИФИКАЦИЯ
// ============================================

// Слушатель состояния авторизации
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        checkAdminStatus(user.uid);
        updateUI();
        loadStats();
        renderCategories();
        showToast('Добро пожаловать!', 'success');
    } else {
        currentUser = null;
        isAdmin = false;
        updateUI();
        renderCategories();
    }
});

// Проверка статуса администратора
async function checkAdminStatus(uid) {
    try {
        const adminDoc = await getDoc(doc(db, 'admins', uid));
        isAdmin = adminDoc.exists();
        if (isAdmin) {
            localStorage.setItem('isAdmin', 'true');
        } else {
            localStorage.removeItem('isAdmin');
        }
        updateUI();
    } catch (error) {
        console.error('Ошибка проверки админа:', error);
    }
}

// Регистрация
async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regPasswordConfirm').value;

    // Валидация
    if (!username || !email || !password || !confirmPassword) {
        showToast('Заполните все поля', 'error');
        return;
    }

    if (username.length < 3) {
        showToast('Имя пользователя должно быть минимум 3 символа', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Пароль должен быть минимум 6 символов', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showToast('Пароли не совпадают', 'error');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Сохраняем данные пользователя
        await setDoc(doc(db, 'users', user.uid), {
            username: username,
            email: email,
            createdAt: serverTimestamp(),
            uid: user.uid
        });

        closeModal('registerModal');
        showToast('Регистрация успешна! Добро пожаловать!', 'success');
        
        // Очищаем форму
        document.getElementById('regUsername').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regPasswordConfirm').value = '';
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Этот email уже используется', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Пароль слишком слабый', 'error');
        } else {
            showToast('Ошибка регистрации: ' + error.message, 'error');
        }
    }
}

// Вход
async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Заполните все поля', 'error');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('loginModal');
        
        // Очищаем форму
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        
        showToast('Добро пожаловать!', 'success');
    } catch (error) {
        console.error('Ошибка входа:', error);
        if (error.code === 'auth/user-not-found') {
            showToast('Пользователь не найден', 'error');
        } else if (error.code === 'auth/wrong-password') {
            showToast('Неверный пароль', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Неверный формат email', 'error');
        } else {
            showToast('Ошибка входа: ' + error.message, 'error');
        }
    }
}

// Выход
async function logout() {
    try {
        await signOut(auth);
        localStorage.removeItem('isAdmin');
        showToast('Вы вышли из аккаунта', 'warning');
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// ============================================
// АДМИН-ПАНЕЛЬ
// ============================================

function showAdminPanel() {
    if (!currentUser) {
        showToast('Сначала войдите в аккаунт', 'error');
        return;
    }
    document.getElementById('adminModal').classList.add('active');
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminActions').style.display = isAdmin ? 'block' : 'none';
    if (isAdmin) {
        updateAdminCategorySelect();
    }
}

function closeAdminPanel() {
    document.getElementById('adminModal').classList.remove('active');
}

function verifyAdmin() {
    const password = document.getElementById('adminPassword').value.trim();
    const btn = document.querySelector('#adminModal .admin-verify .btn-admin');
    const originalText = btn.innerHTML;
    
    if (password === '1267') {
        if (currentUser) {
            btn.innerHTML = '⏳ Проверка...';
            btn.disabled = true;
            
            setDoc(doc(db, 'admins', currentUser.uid), {
                uid: currentUser.uid,
                grantedAt: serverTimestamp()
            }).then(() => {
                isAdmin = true;
                localStorage.setItem('isAdmin', 'true');
                document.getElementById('adminActions').style.display = 'block';
                document.getElementById('adminPassword').value = '';
                updateUI();
                updateAdminCategorySelect();
                showToast('Вы получили права администратора!', 'success');
                btn.innerHTML = '✅ Права получены';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }, 3000);
            }).catch(error => {
                showToast('Ошибка: ' + error.message, 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
            });
        }
    } else {
        showToast('Неверный пароль', 'error');
        btn.innerHTML = '❌ Неверный пароль';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    }
}

// ============================================
// РАБОТА С КАТЕГОРИЯМИ
// ============================================

async function addCategory() {
    if (!isAdmin) {
        showToast('Только администраторы могут создавать разделы', 'error');
        return;
    }

    const name = document.getElementById('newCategoryName').value.trim();
    const description = document.getElementById('newCategoryDesc').value.trim();

    if (!name) {
        showToast('Введите название раздела', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'categories'), {
            name: name,
            description: description || 'Описание отсутствует',
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
        });

        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryDesc').value = '';
        showToast('Раздел создан успешно!', 'success');
        renderCategories();
        updateAdminCategorySelect();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// ============================================
// РАБОТА С ТЕМАМИ
// ============================================

async function addThread() {
    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }

    const categoryId = document.getElementById('adminCategorySelect').value;
    const title = document.getElementById('newThreadTitle').value.trim();
    const content = document.getElementById('newThreadContent').value.trim();

    if (!title || !content) {
        showToast('Заполните все поля', 'error');
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const username = userDoc.exists() ? userDoc.data().username : currentUser.email;

        await addDoc(collection(db, 'threads'), {
            categoryId: categoryId,
            title: title,
            content: content,
            author: username,
            authorId: currentUser.uid,
            createdAt: serverTimestamp(),
            views: 0,
            replies: 0
        });

        document.getElementById('newThreadTitle').value = '';
        document.getElementById('newThreadContent').value = '';
        showToast('Тема создана успешно!', 'success');
        renderCategories();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
}

async function deleteThread(threadId) {
    if (!isAdmin) {
        showToast('Только администраторы могут удалять темы', 'error');
        return;
    }

    if (!confirm('🗑️ Удалить эту тему и все ответы?')) return;

    try {
        await deleteDoc(doc(db, 'threads', threadId));

        const postsQuery = query(collection(db, 'posts'), where('threadId', '==', threadId));
        const postsSnapshot = await getDocs(postsQuery);
        const deletePromises = postsSnapshot.docs.map(d => deleteDoc(doc(db, 'posts', d.id)));
        await Promise.all(deletePromises);

        showToast('Тема удалена', 'warning');
        renderCategories();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
}

// ============================================
// ОТОБРАЖЕНИЕ
// ============================================

function updateUI() {
    const userInfo = document.getElementById('userInfo');
    const currentUserSpan = document.getElementById('currentUser');
    const avatarLetter = document.getElementById('avatarLetter');
    const adminBadge = document.getElementById('adminBadge');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminPanelBtn = document.getElementById('adminPanelBtn');

    if (currentUser) {
        // Получаем username из базы
        getDoc(doc(db, 'users', currentUser.uid)).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentUserSpan.textContent = data.username || currentUser.email;
                avatarLetter.textContent = (data.username || currentUser.email)[0].toUpperCase();
            } else {
                currentUserSpan.textContent = currentUser.email;
                avatarLetter.textContent = currentUser.email[0].toUpperCase();
            }
        });
        
        userInfo.style.display = 'flex';
        adminBadge.style.display = isAdmin ? 'inline' : 'none';
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
        adminPanelBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    } else {
        userInfo.style.display = 'none';
        loginBtn.style.display = 'inline-flex';
        registerBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
        adminPanelBtn.style.display = 'none';
    }
}

async function renderCategories() {
    const container = document.getElementById('categoriesContainer');
    const countElement = document.getElementById('categoriesCount');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка разделов...</p></div>';

    try {
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });

        countElement.textContent = `${categories.length} разделов`;

        if (categories.length === 0) {
            container.innerHTML = `
                <div class="forum-section">
                    <div class="empty-message">
                        <span class="empty-icon">📭</span>
                        <p>Нет созданных разделов</p>
                        ${isAdmin ? '<p style="color: var(--primary-light);">Используйте админ-панель для создания разделов</p>' : ''}
                    </div>
                </div>
            `;
            return;
        }

        const threadsSnapshot = await getDocs(collection(db, 'threads'));
        const threads = [];
        threadsSnapshot.forEach(doc => {
            threads.push({ id: doc.id, ...doc.data() });
        });

        let html = '';
        for (const category of categories) {
            const categoryThreads = threads.filter(t => t.categoryId === category.id);
            
            html += `
                <div class="forum-section">
                    <div class="forum-section-header">
                        <div>
                            <h2>${category.name}</h2>
                            <span class="subtitle">${category.description || 'Описание отсутствует'}</span>
                        </div>
                        <span class="topic-count">${categoryThreads.length} тем</span>
                    </div>
                    ${categoryThreads.length === 0 ? 
                        `<div class="empty-message" style="padding:15px;font-size:14px;">В этом разделе пока нет тем</div>` :
                        `<ul class="topic-list">
                            ${categoryThreads.map(thread => `
                                <li class="topic-item" onclick="openThread('${thread.id}')">
                                    <div class="topic-info">
                                        <h3>${thread.title}</h3>
                                        <div class="topic-meta">
                                            <span>👤 ${thread.author}</span>
                                            <span>📅 ${formatDate(thread.createdAt)}</span>
                                            <span>👁 ${thread.views || 0}</span>
                                            <span>💬 ${thread.replies || 0}</span>
                                        </div>
                                    </div>
                                    <div class="topic-actions">
                                        ${isAdmin ? `
                                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteThread('${thread.id}')">🗑</button>
                                        ` : ''}
                                    </div>
                                </li>
                            `).join('')}
                        </ul>`
                    }
                </div>
            `;
        }

        container.innerHTML = html;
        loadStats();
        updateBannerStats();
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        container.innerHTML = `<div class="empty-message"><span class="empty-icon">⚠️</span><p>Ошибка загрузки данных</p></div>`;
    }
}

async function openThread(threadId) {
    currentThreadId = threadId;
    const container = document.getElementById('threadContainer');
    const threadView = document.getElementById('threadView');
    const categoriesView = document.getElementById('categoriesView');

    categoriesView.style.display = 'none';
    threadView.style.display = 'block';
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Загрузка темы...</p></div>';

    try {
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (!threadDoc.exists()) {
            showToast('Тема не найдена', 'error');
            showCategories();
            return;
        }
        const thread = { id: threadDoc.id, ...threadDoc.data() };

        await updateDoc(doc(db, 'threads', threadId), {
            views: (thread.views || 0) + 1
        });

        const postsQuery = query(
            collection(db, 'posts'),
            where('threadId', '==', threadId),
            orderBy('createdAt', 'asc')
        );
        const postsSnapshot = await getDocs(postsQuery);
        const posts = [];
        postsSnapshot.forEach(doc => {
            posts.push({ id: doc.id, ...doc.data() });
        });

        const userDoc = await getDoc(doc(db, 'users', thread.authorId));
        const authorName = userDoc.exists() ? userDoc.data().username : thread.author;

        container.innerHTML = `
            <div class="thread-header">
                <h2>${thread.title}</h2>
                <div class="thread-meta">
                    <span>👤 ${authorName}</span>
                    <span>📅 ${formatDate(thread.createdAt)}</span>
                    <span>👁 ${(thread.views || 0) + 1}</span>
                    <span>💬 ${posts.length}</span>
                </div>
                <div class="thread-content">${thread.content}</div>
            </div>
            
            <div class="posts-header">
                <h3>💬 Ответы</h3>
                <span class="posts-count">${posts.length} сообщений</span>
            </div>
            
            <div id="postsContainer">
                ${posts.length === 0 ? 
                    '<div class="empty-message"><span class="empty-icon">💭</span><p>Пока нет ответов. Будьте первым!</p></div>' :
                    posts.map(post => `
                        <div class="post-item">
                            <div class="post-header">
                                <span class="post-author">
                                    <span class="post-avatar">${post.author[0].toUpperCase()}</span>
                                    ${post.author}
                                </span>
                                <span class="post-date">${formatDate(post.createdAt)}</span>
                            </div>
                            <div class="post-content">${post.content}</div>
                        </div>
                    `).join('')
                }
            </div>
            
            ${currentUser ? `
                <div class="reply-section">
                    <h4>✏️ Написать ответ</h4>
                    <textarea id="newPostContent" placeholder="Введите текст ответа..."></textarea>
                    <button class="btn btn-primary" onclick="addPost('${threadId}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/></svg>
                        Отправить
                    </button>
                </div>
            ` : `
                <div style="margin-top:20px;padding:20px;background:var(--dark-card);border-radius:var(--radius-sm);text-align:center;border:1px solid var(--border);">
                    <p style="color:var(--text-muted);">🔑 Войдите в аккаунт, чтобы оставить ответ</p>
                </div>
            `}
        `;
    } catch (error) {
        console.error('Ошибка загрузки темы:', error);
        container.innerHTML = `<div class="empty-message"><span class="empty-icon">⚠️</span><p>Ошибка загрузки темы</p></div>`;
    }
}

async function addPost(threadId) {
    const content = document.getElementById('newPostContent').value.trim();
    if (!content) {
        showToast('Введите текст ответа', 'error');
        return;
    }

    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const username = userDoc.exists() ? userDoc.data().username : currentUser.email;

        await addDoc(collection(db, 'posts'), {
            threadId: threadId,
            author: username,
            authorId: currentUser.uid,
            content: content,
            createdAt: serverTimestamp()
        });

        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (threadDoc.exists()) {
            const thread = threadDoc.data();
            await updateDoc(doc(db, 'threads', threadId), {
                replies: (thread.replies || 0) + 1
            });
        }

        document.getElementById('newPostContent').value = '';
        showToast('Ответ отправлен!', 'success');
        openThread(threadId);
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
}

function showCategories() {
    document.getElementById('threadView').style.display = 'none';
    document.getElementById('categoriesView').style.display = 'block';
    renderCategories();
}

// ============================================
// СТАТИСТИКА
// ============================================

async function loadStats() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const threadsSnapshot = await getDocs(collection(db, 'threads'));
        const postsSnapshot = await getDocs(collection(db, 'posts'));

        document.getElementById('totalUsers').textContent = usersSnapshot.size;
        document.getElementById('totalThreads').textContent = threadsSnapshot.size;
        document.getElementById('totalPosts').textContent = postsSnapshot.size;
        
        // Онлайн (приблизительно)
        document.getElementById('onlineUsers').textContent = Math.floor(Math.random() * 25) + 5;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function updateBannerStats() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const threadsSnapshot = await getDocs(collection(db, 'threads'));
        const postsSnapshot = await getDocs(collection(db, 'posts'));

        document.getElementById('bannerUsers').textContent = usersSnapshot.size;
        document.getElementById('bannerThreads').textContent = threadsSnapshot.size;
        document.getElementById('bannerPosts').textContent = postsSnapshot.size;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

function updateAdminCategorySelect() {
    const select = document.getElementById('adminCategorySelect');
    select.innerHTML = '';
    
    getDocs(collection(db, 'categories')).then(snapshot => {
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = data.name;
            select.appendChild(option);
        });
    }).catch(error => {
        console.error('Ошибка загрузки категорий:', error);
    });
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function formatDate(dateStr) {
    if (!dateStr) return 'Неизвестно';
    try {
        const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
        if (isNaN(date.getTime())) return 'Неизвестно';
        return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
    } catch {
        return 'Неизвестно';
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const title = document.getElementById('toastTitle');
    const msg = document.getElementById('toastMessage');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    
    const titles = {
        success: 'Успех',
        error: 'Ошибка',
        warning: 'Внимание'
    };
    
    icon.textContent = icons[type] || '✅';
    title.textContent = titles[type] || 'Успех';
    msg.textContent = message;
    
    toast.className = `toast show ${type}`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

function closeToast() {
    document.getElementById('toast').classList.remove('show');
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function showRegisterModal() {
    document.getElementById('registerModal').classList.add('active');
}

function switchToRegister() {
    closeModal('loginModal');
    showRegisterModal();
}

function switchToLogin() {
    closeModal('registerModal');
    showLoginModal();
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Закрытие модальных окон по клику вне
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

// Enter для форм
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        if (document.getElementById('loginModal').classList.contains('active')) {
            login();
        } else if (document.getElementById('registerModal').classList.contains('active')) {
            register();
        }
    }
});

// ============================================
// РЕАЛЬНОЕ ВРЕМЯ (onSnapshot)
// ============================================

onSnapshot(collection(db, 'categories'), () => {
    if (!document.getElementById('threadView').style.display || 
        document.getElementById('threadView').style.display === 'none') {
        renderCategories();
    }
});

onSnapshot(collection(db, 'threads'), () => {
    if (!document.getElementById('threadView').style.display || 
        document.getElementById('threadView').style.display === 'none') {
        renderCategories();
    }
});

console.log('🚀 Arizona RP Forum загружен!');