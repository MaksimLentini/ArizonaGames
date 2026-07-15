// ============================================
// ОСНОВНОЙ СКРИПТ ФОРУМА
// ============================================

import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
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
    setDoc
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
            // Сохраняем в localStorage для быстрого доступа
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

    if (!username || !email || !password) {
        showToast('Заполните все поля', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Пароль должен быть минимум 6 символов', 'error');
        return;
    }

    try {
        // Создаем пользователя в Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Сохраняем username в Firestore
        await setDoc(doc(db, 'users', user.uid), {
            username: username,
            email: email,
            createdAt: new Date().toISOString()
        });

        closeModal('registerModal');
        showToast('Регистрация успешна! Добро пожаловать!');
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Этот email уже используется', 'error');
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
        showToast('Добро пожаловать!');
    } catch (error) {
        console.error('Ошибка входа:', error);
        if (error.code === 'auth/user-not-found') {
            showToast('Пользователь не найден', 'error');
        } else if (error.code === 'auth/wrong-password') {
            showToast('Неверный пароль', 'error');
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
        showToast('Вы вышли из аккаунта');
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
    if (password === '1267') {
        if (currentUser) {
            // Сохраняем в Firestore
            setDoc(doc(db, 'admins', currentUser.uid), {
                uid: currentUser.uid,
                grantedAt: new Date().toISOString()
            }).then(() => {
                isAdmin = true;
                localStorage.setItem('isAdmin', 'true');
                document.getElementById('adminActions').style.display = 'block';
                document.getElementById('adminPassword').value = '';
                updateUI();
                updateAdminCategorySelect();
                showToast('Вы получили права администратора!');
            }).catch(error => {
                showToast('Ошибка: ' + error.message, 'error');
            });
        }
    } else {
        showToast('Неверный пароль', 'error');
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
            createdAt: new Date().toISOString(),
            createdBy: currentUser.uid
        });

        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryDesc').value = '';
        showToast('Раздел создан успешно!');
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
        // Получаем username пользователя
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const username = userDoc.exists() ? userDoc.data().username : currentUser.email;

        await addDoc(collection(db, 'threads'), {
            categoryId: categoryId,
            title: title,
            content: content,
            author: username,
            authorId: currentUser.uid,
            createdAt: new Date().toISOString(),
            views: 0,
            replies: 0
        });

        document.getElementById('newThreadTitle').value = '';
        document.getElementById('newThreadContent').value = '';
        showToast('Тема создана успешно!');
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

    if (!confirm('Удалить эту тему и все ответы?')) return;

    try {
        // Удаляем тему
        await deleteDoc(doc(db, 'threads', threadId));

        // Удаляем все посты в теме
        const postsQuery = query(collection(db, 'posts'), where('threadId', '==', threadId));
        const postsSnapshot = await getDocs(postsQuery);
        const deletePromises = postsSnapshot.docs.map(d => deleteDoc(doc(db, 'posts', d.id)));
        await Promise.all(deletePromises);

        showToast('Тема удалена');
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
    const adminBadge = document.getElementById('adminBadge');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminPanelBtn = document.getElementById('adminPanelBtn');

    if (currentUser) {
        userInfo.style.display = 'flex';
        currentUserSpan.textContent = currentUser.email || 'User';
        adminBadge.style.display = isAdmin ? 'inline' : 'none';
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        adminPanelBtn.style.display = isAdmin ? 'inline-block' : 'none';
    } else {
        userInfo.style.display = 'none';
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        adminPanelBtn.style.display = 'none';
    }
}

async function renderCategories() {
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '<div class="loading-spinner">Загрузка</div>';

    try {
        // Получаем категории
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });

        if (categories.length === 0) {
            container.innerHTML = `
                <div class="forum-section">
                    <div class="empty-message">
                        <p>📭 Нет созданных разделов</p>
                        ${isAdmin ? '<p style="color:#e94560;">Используйте админ-панель для создания разделов</p>' : ''}
                    </div>
                </div>
            `;
            return;
        }

        // Получаем все темы
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
                    <h2>${category.name}</h2>
                    <p class="subtitle">${category.description} · Тем: ${categoryThreads.length}</p>
                    ${categoryThreads.length === 0 ? 
                        '<div class="empty-message" style="padding:10px;font-size:14px;">В этом разделе пока нет тем</div>' :
                        `<ul class="topic-list">
                            ${categoryThreads.map(thread => `
                                <li class="topic-item">
                                    <div class="topic-info" onclick="openThread('${thread.id}')">
                                        <h3>${thread.title}</h3>
                                        <div class="meta">
                                            Автор: ${thread.author} · ${formatDate(thread.createdAt)} · 👁 ${thread.views || 0} · 💬 ${thread.replies || 0}
                                        </div>
                                    </div>
                                    <div class="topic-actions">
                                        ${isAdmin ? `
                                            <button class="btn btn-danger btn-sm" onclick="deleteThread('${thread.id}')">🗑</button>
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
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        container.innerHTML = `<div class="empty-message">⚠️ Ошибка загрузки данных</div>`;
    }
}

async function openThread(threadId) {
    currentThreadId = threadId;
    const container = document.getElementById('threadContainer');
    const threadView = document.getElementById('threadView');
    const categoriesView = document.getElementById('categoriesView');

    categoriesView.style.display = 'none';
    threadView.style.display = 'block';
    container.innerHTML = '<div class="loading-spinner">Загрузка темы</div>';

    try {
        // Получаем тему
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (!threadDoc.exists()) {
            showToast('Тема не найдена', 'error');
            showCategories();
            return;
        }
        const thread = { id: threadDoc.id, ...threadDoc.data() };

        // Увеличиваем счетчик просмотров
        await updateDoc(doc(db, 'threads', threadId), {
            views: (thread.views || 0) + 1
        });

        // Получаем посты
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

        container.innerHTML = `
            <div class="thread-header">
                <h2>${thread.title}</h2>
                <div class="meta">
                    Автор: ${thread.author} · ${formatDate(thread.createdAt)} · 👁 ${(thread.views || 0) + 1} · 💬 ${posts.length}
                </div>
                <div class="thread-content">${thread.content}</div>
            </div>
            <h3 style="color:#e94560;margin:20px 0;">Ответы (${posts.length})</h3>
            <div id="postsContainer">
                ${posts.length === 0 ? 
                    '<div class="empty-message">Пока нет ответов. Будьте первым!</div>' :
                    posts.map(post => `
                        <div class="post-item">
                            <div class="post-header">
                                <span class="post-author">${post.author}</span>
                                <span class="post-date">${formatDate(post.createdAt)}</span>
                            </div>
                            <div class="post-content">${post.content}</div>
                        </div>
                    `).join('')
                }
            </div>
            ${currentUser ? `
                <div style="margin-top:25px;">
                    <h4 style="color:#aaa;margin-bottom:10px;">✏️ Написать ответ</h4>
                    <textarea id="newPostContent" style="width:100%;padding:12px;background:#1a1a2e;border:1px solid #333;border-radius:8px;color:white;min-height:100px;resize:vertical;font-family:inherit;"></textarea>
                    <button class="btn btn-primary" onclick="addPost('${threadId}')" style="margin-top:10px;">Отправить</button>
                </div>
            ` : `
                <div style="margin-top:20px;padding:20px;background:#1a1a2e;border-radius:8px;text-align:center;opacity:0.7;">
                    🔑 Войдите в аккаунт, чтобы оставить ответ
                </div>
            `}
        `;
    } catch (error) {
        console.error('Ошибка загрузки темы:', error);
        container.innerHTML = `<div class="empty-message">⚠️ Ошибка загрузки темы</div>`;
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
        // Получаем username
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const username = userDoc.exists() ? userDoc.data().username : currentUser.email;

        await addDoc(collection(db, 'posts'), {
            threadId: threadId,
            author: username,
            authorId: currentUser.uid,
            content: content,
            createdAt: new Date().toISOString()
        });

        // Увеличиваем счетчик ответов
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (threadDoc.exists()) {
            const thread = threadDoc.data();
            await updateDoc(doc(db, 'threads', threadId), {
                replies: (thread.replies || 0) + 1
            });
        }

        document.getElementById('newPostContent').value = '';
        showToast('Ответ отправлен!');
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
        // Пользователи
        const usersSnapshot = await getDocs(collection(db, 'users'));
        document.getElementById('totalUsers').textContent = usersSnapshot.size;

        // Темы
        const threadsSnapshot = await getDocs(collection(db, 'threads'));
        document.getElementById('totalThreads').textContent = threadsSnapshot.size;

        // Посты
        const postsSnapshot = await getDocs(collection(db, 'posts'));
        document.getElementById('totalPosts').textContent = postsSnapshot.size;

        // Онлайн (приблизительно)
        document.getElementById('onlineUsers').textContent = Math.floor(Math.random() * 30) + 5;
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
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

function showRegisterModal() {
    document.getElementById('registerModal').classList.add('active');
    document.getElementById('regUsername').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
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
        } else if (document.getElementById('adminModal').classList.contains('active')) {
            const password = document.getElementById('adminPassword');
            if (document.activeElement === password) {
                verifyAdmin();
            }
        }
    }
});

// ============================================
// АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ
// ============================================

// Подписка на изменения категорий
onSnapshot(collection(db, 'categories'), () => {
    if (!document.getElementById('threadView').style.display || 
        document.getElementById('threadView').style.display === 'none') {
        renderCategories();
    }
});

// Подписка на изменения тем
onSnapshot(collection(db, 'threads'), () => {
    if (!document.getElementById('threadView').style.display || 
        document.getElementById('threadView').style.display === 'none') {
        renderCategories();
    }
});

console.log('🚀 Arizona RP Forum загружен!');