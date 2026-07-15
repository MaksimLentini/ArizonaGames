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
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    }, 800);
});

// ============================================
// HEADER SCROLL
// ============================================
window.addEventListener('scroll', () => {
    const header = document.getElementById('mainHeader');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ============================================
// AUTH STATE
// ============================================
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

async function checkAdminStatus(uid) {
    try {
        const adminDoc = await getDoc(doc(db, 'admins', uid));
        isAdmin = adminDoc.exists();
        updateUI();
    } catch (error) {
        console.error('Admin check error:', error);
    }
}

// ============================================
// AUTH FUNCTIONS
// ============================================
window.registerUser = async function() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regPasswordConfirm').value;

    if (!username || !email || !password || !confirm) {
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

    if (password !== confirm) {
        showToast('Пароли не совпадают', 'error');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            username: username,
            email: email,
            createdAt: serverTimestamp(),
            uid: user.uid
        });

        closeModal('registerModal');
        showToast('Аккаунт создан!', 'success');
        
        document.getElementById('regUsername').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regPasswordConfirm').value = '';
        
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Email уже используется', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Слишком слабый пароль', 'error');
        } else {
            showToast('Ошибка: ' + error.message, 'error');
        }
    }
};

window.loginUser = async function() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Заполните все поля', 'error');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('loginModal');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        showToast('Добро пожаловать!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') {
            showToast('Пользователь не найден', 'error');
        } else if (error.code === 'auth/wrong-password') {
            showToast('Неверный пароль', 'error');
        } else {
            showToast('Ошибка: ' + error.message, 'error');
        }
    }
};

window.logoutUser = async function() {
    try {
        await signOut(auth);
        showToast('Вы вышли', 'warning');
    } catch (error) {
        console.error('Logout error:', error);
    }
};

// ============================================
// ADMIN FUNCTIONS
// ============================================
window.verifyAdmin = async function() {
    const password = document.getElementById('adminPassword').value.trim();
    const btn = document.querySelector('#adminModal .admin-verify .btn-admin');
    const label = document.querySelector('#adminModal .admin-verify .btn-admin span');
    const originalText = label ? label.textContent : 'Получить права';

    if (password === '1267') {
        if (currentUser) {
            try {
                await setDoc(doc(db, 'admins', currentUser.uid), {
                    uid: currentUser.uid,
                    grantedAt: serverTimestamp()
                });
                isAdmin = true;
                document.getElementById('adminActions').style.display = 'block';
                document.getElementById('adminPassword').value = '';
                updateUI();
                updateAdminCategorySelect();
                showToast('Права администратора получены!', 'success');
            } catch (error) {
                showToast('Ошибка: ' + error.message, 'error');
            }
        }
    } else {
        showToast('Неверный код', 'error');
    }
};

// ============================================
// CATEGORY FUNCTIONS
// ============================================
window.addCategory = async function() {
    if (!isAdmin) {
        showToast('Требуются права администратора', 'error');
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
        showToast('Раздел создан!', 'success');
        renderCategories();
        updateAdminCategorySelect();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

// ============================================
// THREAD FUNCTIONS
// ============================================
window.addThread = async function() {
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
        showToast('Тема создана!', 'success');
        renderCategories();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

window.deleteThread = async function(threadId) {
    if (!isAdmin) {
        showToast('Требуются права администратора', 'error');
        return;
    }

    if (!confirm('Удалить тему и все ответы?')) return;

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
};

// ============================================
// RENDER FUNCTIONS
// ============================================
function updateUI() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('currentUser');
    const avatar = document.getElementById('userAvatar');
    const adminBadge = document.getElementById('adminBadge');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminPanelBtn = document.getElementById('adminPanelBtn');

    if (currentUser) {
        getDoc(doc(db, 'users', currentUser.uid)).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                userName.textContent = data.username || currentUser.email;
                avatar.textContent = (data.username || currentUser.email)[0].toUpperCase();
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
    const counter = document.getElementById('categoriesCount');
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Загрузка разделов...</p></div>';

    try {
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });

        counter.textContent = `${categories.length} разделов`;

        if (categories.length === 0) {
            container.innerHTML = `
                <div class="forum-category">
                    <div class="empty-state">
                        <span class="empty-icon">📋</span>
                        <p>Нет созданных разделов</p>
                        ${isAdmin ? '<p style="color: var(--primary-light); font-size: 13px;">Используйте админ-панель для создания разделов</p>' : ''}
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
                <div class="forum-category">
                    <div class="category-header">
                        <h4>${category.name}</h4>
                        <span class="category-meta">${categoryThreads.length} тем</span>
                    </div>
                    <div class="category-desc">${category.description || 'Описание отсутствует'}</div>
                    ${categoryThreads.length === 0 ? 
                        `<div class="empty-state" style="padding:16px 0;font-size:14px;">В этом разделе пока нет тем</div>` :
                        `<ul class="topic-list">
                            ${categoryThreads.map(thread => `
                                <li class="topic-item" onclick="openThread('${thread.id}')">
                                    <div class="topic-info">
                                        <h5>${thread.title}</h5>
                                        <div class="topic-meta">
                                            <span>Автор: ${thread.author}</span>
                                            <span>${formatDate(thread.createdAt)}</span>
                                            <span>👁 ${thread.views || 0}</span>
                                            <span>💬 ${thread.replies || 0}</span>
                                        </div>
                                    </div>
                                    <div class="topic-actions">
                                        ${isAdmin ? `
                                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteThread('${thread.id}')">Удалить</button>
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
        updateHeroStats();
    } catch (error) {
        console.error('Render error:', error);
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>Ошибка загрузки данных</p></div>`;
    }
}

window.openThread = async function(threadId) {
    currentThreadId = threadId;
    const container = document.getElementById('threadContainer');
    const threadView = document.getElementById('threadView');
    const categoriesView = document.getElementById('categoriesView');

    categoriesView.style.display = 'none';
    threadView.style.display = 'block';
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Загрузка темы...</p></div>';

    try {
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (!threadDoc.exists()) {
            showToast('Тема не найдена', 'error');
            showCategoriesView();
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

        container.innerHTML = `
            <div class="thread-detail">
                <h2>${thread.title}</h2>
                <div class="thread-meta">
                    <span>Автор: ${thread.author}</span>
                    <span>${formatDate(thread.createdAt)}</span>
                    <span>👁 ${(thread.views || 0) + 1}</span>
                    <span>💬 ${posts.length}</span>
                </div>
                <div class="thread-body">${thread.content}</div>
            </div>
            
            <div class="posts-header">
                <h3>Ответы</h3>
                <span class="posts-count">${posts.length} сообщений</span>
            </div>
            
            <div id="postsContainer">
                ${posts.length === 0 ? 
                    '<div class="empty-state"><span class="empty-icon">💬</span><p>Пока нет ответов</p></div>' :
                    posts.map(post => `
                        <div class="post-item">
                            <div class="post-head">
                                <span class="post-author">${post.author}</span>
                                <span class="post-date">${formatDate(post.createdAt)}</span>
                            </div>
                            <div class="post-content">${post.content}</div>
                        </div>
                    `).join('')
                }
            </div>
            
            ${currentUser ? `
                <div class="reply-section">
                    <h4>Написать ответ</h4>
                    <textarea id="newPostContent" placeholder="Введите текст..."></textarea>
                    <button class="btn btn-primary" onclick="addPost('${threadId}')">Отправить</button>
                </div>
            ` : `
                <div style="margin-top:20px;padding:20px;background:var(--dark-card);border-radius:var(--radius);text-align:center;border:1px solid var(--border);">
                    <p style="color:var(--text-muted);">Войдите в аккаунт, чтобы ответить</p>
                </div>
            `}
        `;
    } catch (error) {
        console.error('Open thread error:', error);
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>Ошибка загрузки темы</p></div>`;
    }
};

window.addPost = async function(threadId) {
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
};

window.showCategoriesView = function() {
    document.getElementById('threadView').style.display = 'none';
    document.getElementById('categoriesView').style.display = 'block';
    renderCategories();
};

window.showPage = function(page) {
    const forumView = document.getElementById('forumView');
    const pageView = document.getElementById('pageView');
    const container = document.getElementById('pageContainer');
    
    forumView.style.display = 'none';
    pageView.style.display = 'block';
    
    const pages = {
        rules: {
            title: '📜 Правила сообщества',
            subtitle: 'Основные правила поведения на форуме Arizona RP',
            sections: [
                { title: '1. Уважение к участникам', content: 'Относитесь с уважением ко всем участникам сообщества. Запрещены: оскорбления, угрозы, дискриминация, травля и любое другое неуважительное поведение.' },
                { title: '2. Запрещенный контент', content: 'Запрещена публикация: порнографического контента, материалов, пропагандирующих насилие или экстремизм, спама, рекламы без разрешения администрации.' },
                { title: '3. Правила общения', content: 'Общайтесь на русском языке в основных разделах. Используйте понятные заголовки для тем. Не создавайте дублирующиеся темы. Не флудите и не офтопьте.' },
                { title: '4. Нарушения и наказания', content: 'За нарушение правил предусмотрены: предупреждение, временный бан или перманентная блокировка аккаунта.' }
            ]
        },
        help: {
            title: '❓ Помощь',
            subtitle: 'Часто задаваемые вопросы и руководства',
            sections: [
                { title: 'Как зарегистрироваться?', content: 'Нажмите на кнопку "Регистрация" в правом верхнем углу, заполните форму с указанием имени пользователя, email и пароля.' },
                { title: 'Как создать тему?', content: 'Вам нужно получить права администратора (пароль 1267). После этого в админ-панели выберите раздел, введите название и содержание темы.' },
                { title: 'Как получить права администратора?', content: 'Нажмите на кнопку "Админ" и введите пароль 1267. После этого вы сможете создавать разделы и темы, а также удалять темы.' }
            ]
        },
        contact: {
            title: '📞 Контакты',
            subtitle: 'Свяжитесь с администрацией форума',
            contacts: [
                { icon: '📧', label: 'Email', value: 'support@arizona-rp.com' },
                { icon: '💬', label: 'Discord', value: 'discord.gg/arizona-rp' },
                { icon: '📱', label: 'Telegram', value: '@arizona_rp_support' }
            ]
        },
        privacy: {
            title: '🔒 Политика конфиденциальности',
            subtitle: 'Как мы обрабатываем ваши данные',
            sections: [
                { title: 'Какие данные мы собираем', content: 'При регистрации мы собираем: имя пользователя, email и пароль. Также мы собираем данные о вашей активности на форуме.' },
                { title: 'Как мы используем данные', content: 'Ваши данные используются для: авторизации на форуме, отображения вашего профиля, улучшения работы сервиса.' },
                { title: 'Безопасность данных', content: 'Мы используем Firebase для хранения данных. Все данные защищены шифрованием. Пароли хранятся в зашифрованном виде.' }
            ]
        }
    };
    
    const pageData = pages[page];
    if (!pageData) return;
    
    let html = `
        <div class="page-content">
            <h1>${pageData.title}</h1>
            <div class="page-subtitle">${pageData.subtitle}</div>
    `;
    
    if (pageData.sections) {
        pageData.sections.forEach(section => {
            html += `
                <div class="page-section">
                    <h2>${section.title}</h2>
                    <p>${section.content.replace(/\n/g, '<br>')}</p>
                </div>
            `;
        });
    }
    
    if (pageData.contacts) {
        pageData.contacts.forEach(contact => {
            html += `
                <div class="contact-item">
                    <span class="contact-icon">${contact.icon}</span>
                    <div class="contact-info">
                        <div class="contact-label">${contact.label}</div>
                        <div class="contact-value">${contact.value}</div>
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    container.innerHTML = html;
};

window.closePage = function() {
    document.getElementById('pageView').style.display = 'none';
    document.getElementById('forumView').style.display = 'block';
    renderCategories();
};

// ============================================
// STATS
// ============================================
async function loadStats() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const threadsSnapshot = await getDocs(collection(db, 'threads'));
        const postsSnapshot = await getDocs(collection(db, 'posts'));
        document.getElementById('heroUsers').textContent = usersSnapshot.size;
        document.getElementById('heroThreads').textContent = threadsSnapshot.size;
        document.getElementById('heroPosts').textContent = postsSnapshot.size;
    } catch (error) {
        console.error('Stats error:', error);
    }
}

async function updateHeroStats() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const threadsSnapshot = await getDocs(collection(db, 'threads'));
        const postsSnapshot = await getDocs(collection(db, 'posts'));
        document.getElementById('heroUsers').textContent = usersSnapshot.size;
        document.getElementById('heroThreads').textContent = threadsSnapshot.size;
        document.getElementById('heroPosts').textContent = postsSnapshot.size;
    } catch (error) {
        console.error('Hero stats error:', error);
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
        console.error('Category select error:', error);
    });
}

// ============================================
// HELPERS
// ============================================
function formatDate(dateStr) {
    if (!dateStr) return 'Неизвестно';
    try {
        const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
        if (isNaN(date.getTime())) return 'Неизвестно';
        return date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', year: 'numeric' }) + 
               ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'Неизвестно';
    }
}

window.showToast = function(message, type = 'success') {
    const toast = document.getElementById('toast');
    const indicator = document.querySelector('.toast-indicator');
    const title = document.getElementById('toastTitle');
    const msg = document.getElementById('toastMessage');

    const config = {
        success: { title: 'Успех', color: 'var(--success)' },
        error: { title: 'Ошибка', color: 'var(--danger)' },
        warning: { title: 'Внимание', color: 'var(--warning)' }
    };

    const c = config[type] || config.success;
    title.textContent = c.title;
    msg.textContent = message;
    if (indicator) indicator.style.background = c.color;

    toast.className = `toast show ${type}`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
};

window.closeToast = function() {
    document.getElementById('toast').classList.remove('show');
};

window.togglePassword = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Скрыть';
    } else {
        input.type = 'password';
        btn.textContent = 'Показать';
    }
};

window.openModal = function(id) {
    document.getElementById(id).classList.add('active');
};

window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
};

window.switchModal = function(closeId, openId) {
    closeModal(closeId);
    setTimeout(() => openModal(openId), 200);
};

// ============================================
// REAL-TIME UPDATES (теперь onSnapshot определен!)
// ============================================
onSnapshot(collection(db, 'categories'), () => {
    if (!document.getElementById('threadView').style.display || 
        document.getElementById('threadView').style.display === 'none') {
        if (!document.getElementById('pageView').style.display || 
            document.getElementById('pageView').style.display === 'none') {
            renderCategories();
        }
    }
});

onSnapshot(collection(db, 'threads'), () => {
    if (!document.getElementById('threadView').style.display || 
        document.getElementById('threadView').style.display === 'none') {
        if (!document.getElementById('pageView').style.display || 
            document.getElementById('pageView').style.display === 'none') {
            renderCategories();
        }
    }
});

// Обновляем онлайн
setInterval(() => {
    const online = document.getElementById('heroOnline');
    if (online) {
        online.textContent = Math.floor(Math.random() * 30) + 5;
    }
}, 10000);

window.refreshForum = function() {
    showToast('Обновление...', 'success');
    renderCategories();
};

console.log('🚀 Arizona RP Форум загружен!');