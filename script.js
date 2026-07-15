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
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

let currentUser = null;
let currentThreadId = null;
let currentUserData = null;
let isAdmin = false;
let userRank = 'player';

// ============================================
// РАНГИ
// ============================================
const RANKS = {
    owner: {
        id: 'owner',
        name: 'Владелец',
        icon: '👑',
        level: 5,
        permissions: ['all']
    },
    admin: {
        id: 'admin',
        name: 'Администратор',
        icon: '⚡',
        level: 4,
        permissions: ['manage_users', 'manage_ranks', 'delete_threads', 'manage_categories', 'close_threads']
    },
    moderator: {
        id: 'moderator',
        name: 'Модератор',
        icon: '🛡️',
        level: 3,
        permissions: ['delete_threads', 'close_threads']
    },
    leader: {
        id: 'leader',
        name: 'Лидер',
        icon: '⭐',
        level: 2,
        permissions: ['create_threads', 'reply_threads']
    },
    player: {
        id: 'player',
        name: 'Игрок',
        icon: '🎮',
        level: 1,
        permissions: ['create_threads', 'reply_threads', 'view_profiles']
    },
    banned: {
        id: 'banned',
        name: 'Заблокирован',
        icon: '🚫',
        level: 0,
        permissions: []
    }
};

function getRankName(rankId) {
    return RANKS[rankId] ? RANKS[rankId].name : 'Игрок';
}

function getRankIcon(rankId) {
    return RANKS[rankId] ? RANKS[rankId].icon : '🎮';
}

function hasPermission(permission) {
    if (userRank === 'owner') return true;
    const rank = RANKS[userRank];
    if (!rank) return false;
    return rank.permissions.includes(permission) || rank.permissions.includes('all');
}

// ============================================
// PRELOADER
// ============================================
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('preloader').classList.add('hidden');
    }, 800);
});

window.addEventListener('scroll', () => {
    const header = document.getElementById('mainHeader');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ============================================
// AUTH
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData(user.uid);
        await checkAdminStatus(user.uid);
        updateUI();
        loadStats();
        renderCategories();
    } else {
        currentUser = null;
        currentUserData = null;
        isAdmin = false;
        userRank = 'player';
        updateUI();
        renderCategories();
    }
});

async function loadUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            userRank = currentUserData.rank || 'player';
        } else {
            await setDoc(doc(db, 'users', uid), {
                username: currentUser.email.split('@')[0],
                email: currentUser.email,
                bio: 'Новый игрок',
                avatar: '',
                rank: 'player',
                createdAt: serverTimestamp(),
                uid: uid,
                postsCount: 0,
                threadsCount: 0,
                reputation: 0,
                followers: [],
                following: []
            });
            currentUserData = {
                username: currentUser.email.split('@')[0],
                email: currentUser.email,
                bio: 'Новый игрок',
                avatar: '',
                rank: 'player',
                followers: [],
                following: []
            };
            userRank = 'player';
        }
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

async function checkAdminStatus(uid) {
    try {
        const adminDoc = await getDoc(doc(db, 'admins', uid));
        isAdmin = adminDoc.exists();
        if (isAdmin && userRank !== 'owner' && userRank !== 'admin') {
            await updateDoc(doc(db, 'users', uid), { rank: 'admin' });
            userRank = 'admin';
        }
        updateUI();
    } catch (error) {
        console.error('Admin check error:', error);
        isAdmin = false;
    }
}

// ============================================
// ПОДПИСКИ
// ============================================
window.toggleFollow = async function(targetUid) {
    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }
    if (targetUid === currentUser.uid) {
        showToast('Нельзя подписаться на себя', 'warning');
        return;
    }

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const following = userData.following || [];

        const targetRef = doc(db, 'users', targetUid);
        const targetSnap = await getDoc(targetRef);
        const targetData = targetSnap.data();
        const followers = targetData.followers || [];

        if (following.includes(targetUid)) {
            await updateDoc(userRef, { following: arrayRemove(targetUid) });
            await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
            showToast('Вы отписались', 'warning');
        } else {
            await updateDoc(userRef, { following: arrayUnion(targetUid) });
            await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
            showToast('Вы подписались!', 'success');
        }
        openProfile(null, targetUid);
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

// ============================================
// ПРОФИЛЬ С ГОСТЕВОЙ КНИГОЙ
// ============================================
window.openProfile = async function(e, userId = null) {
    if (e) e.stopPropagation();
    
    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }
    
    const targetUid = userId || currentUser.uid;
    const isOwnProfile = targetUid === currentUser.uid;
    
    const forumView = document.getElementById('forumView');
    const profileView = document.getElementById('profileView');
    const container = document.getElementById('profileContainer');
    
    forumView.style.display = 'none';
    document.getElementById('pageView').style.display = 'none';
    profileView.style.display = 'block';
    
    try {
        const userDoc = await getDoc(doc(db, 'users', targetUid));
        if (!userDoc.exists()) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>Пользователь не найден</p></div>`;
            return;
        }
        
        const data = userDoc.data();
        const avatarUrl = data.avatar || '';
        const username = data.username || 'Неизвестно';
        const bio = data.bio || 'Пользователь пока ничего не рассказал о себе';
        const createdAt = data.createdAt ? formatDate(data.createdAt) : 'Неизвестно';
        const rank = data.rank || 'player';
        const rankDisplay = getRankName(rank);
        const rankIcon = getRankIcon(rank);
        const isAdminUser = rank === 'admin' || rank === 'owner';
        const followers = data.followers || [];
        const following = data.following || [];
        const isFollowing = followers.includes(currentUser.uid);

        // Получаем записи в гостевой книге
        const postsQuery = query(
            collection(db, 'profile_posts'),
            where('toUid', '==', targetUid),
            orderBy('createdAt', 'desc')
        );
        const postsSnapshot = await getDocs(postsQuery);
        const profilePosts = [];
        postsSnapshot.forEach(doc => {
            profilePosts.push({ id: doc.id, ...doc.data() });
        });

        let postsHtml = `
            <div class="profile-posts">
                <div class="profile-posts-header">
                    <h4>📝 Записи в профиле (${profilePosts.length})</h4>
                    ${!isOwnProfile ? `
                        <form onsubmit="event.preventDefault(); addProfilePost('${targetUid}');">
                            <div class="profile-post-input">
                                <input type="text" id="profilePostInput" placeholder="Написать запись..." />
                                <button type="submit" class="btn btn-primary btn-sm">📤</button>
                            </div>
                        </form>
                    ` : ''}
                </div>
                ${profilePosts.length === 0 ? 
                    `<div class="empty-state" style="padding:20px 0;font-size:14px;">Нет записей в профиле</div>` :
                    profilePosts.map(post => `
                        <div class="profile-post-item">
                            <div class="profile-post-head">
                                <div class="profile-post-author">
                                    <span class="profile-post-author-name">${post.fromName}</span>
                                    <span class="profile-post-rank">${getRankName(post.fromRank || 'player')}</span>
                                </div>
                                <span class="profile-post-date">${formatDate(post.createdAt)}</span>
                            </div>
                            <div class="profile-post-content">${post.content}</div>
                        </div>
                    `).join('')
                }
            </div>
        `;

        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-header">
                    <div class="profile-avatar-wrapper">
                        ${avatarUrl ? 
                            `<img src="${avatarUrl}" alt="Avatar" class="profile-avatar-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />` : 
                            ''
                        }
                        <div class="profile-avatar-letter" ${avatarUrl ? 'style="display:none;"' : ''}>
                            ${username[0].toUpperCase()}
                        </div>
                        <div class="profile-rank-badge ${isAdminUser ? 'rank-admin' : 'rank-player'}">
                            ${rankIcon} ${rankDisplay}
                        </div>
                        <div class="profile-follow-stats">
                            <span>👥 ${followers.length} подписчиков</span>
                            <span>📌 ${following.length} подписок</span>
                        </div>
                        ${!isOwnProfile ? `
                            <button class="btn ${isFollowing ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="toggleFollow('${targetUid}')">
                                ${isFollowing ? '❌ Отписаться' : '➕ Подписаться'}
                            </button>
                        ` : ''}
                        ${isOwnProfile ? `
                            <button class="btn btn-outline btn-sm profile-edit-btn" onclick="openProfileEdit()">
                                ✏️ Редактировать
                            </button>
                        ` : ''}
                        ${isAdmin ? `
                            <button class="btn btn-admin btn-sm" onclick="openRankModal('${targetUid}', '${username}', '${rank}')">
                                ⚡ Ранг
                            </button>
                        ` : ''}
                    </div>
                    <div class="profile-info">
                        <h1 class="profile-name">${username}</h1>
                        <div class="profile-rank">${rankIcon} ${rankDisplay}</div>
                        <div class="profile-bio">${bio}</div>
                        <div class="profile-meta">
                            <span>📅 Присоединился: ${createdAt}</span>
                            ${isAdminUser ? '<span class="role-badge">Администратор</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="profile-stat">
                        <span class="profile-stat-number">${data.postsCount || 0}</span>
                        <span class="profile-stat-label">Сообщений</span>
                    </div>
                    <div class="profile-stat">
                        <span class="profile-stat-number">${data.threadsCount || 0}</span>
                        <span class="profile-stat-label">Тем создано</span>
                    </div>
                    <div class="profile-stat">
                        <span class="profile-stat-number">${data.reputation || 0}</span>
                        <span class="profile-stat-label">Репутация</span>
                    </div>
                </div>
                ${postsHtml}
            </div>
        `;
    } catch (error) {
        console.error('Profile render error:', error);
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>Ошибка загрузки профиля</p></div>`;
    }
};

// ============================================
// ДОБАВЛЕНИЕ ЗАПИСИ В ПРОФИЛЬ
// ============================================
window.addProfilePost = async function(toUid) {
    const input = document.getElementById('profilePostInput');
    const content = input.value.trim();
    
    if (!content) {
        showToast('Введите текст записи', 'error');
        return;
    }
    
    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'profile_posts'), {
            toUid: toUid,
            fromUid: currentUser.uid,
            fromName: currentUserData?.username || currentUser.email,
            fromRank: currentUserData?.rank || 'player',
            content: content,
            createdAt: serverTimestamp()
        });
        
        input.value = '';
        showToast('Запись добавлена!', 'success');
        openProfile(null, toUid);
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

// ============================================
// РЕДАКТИРОВАНИЕ ПРОФИЛЯ
// ============================================
window.openProfileEdit = function() {
    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }
    
    getDoc(doc(db, 'users', currentUser.uid)).then(docSnap => {
        const data = docSnap.exists() ? docSnap.data() : {};
        document.getElementById('editUsername').value = data.username || '';
        document.getElementById('editBio').value = data.bio || '';
        document.getElementById('editAvatar').value = data.avatar || '';
        openModal('profileEditModal');
    });
};

window.saveProfile = async function() {
    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }
    
    const username = document.getElementById('editUsername').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    const avatar = document.getElementById('editAvatar').value.trim();
    
    if (!username) {
        showToast('Введите имя пользователя', 'error');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            username: username,
            bio: bio || 'Пользователь пока ничего не рассказал о себе',
            avatar: avatar || '',
            updatedAt: serverTimestamp()
        });
        
        closeModal('profileEditModal');
        showToast('Профиль обновлён!', 'success');
        updateUI();
        openProfile();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

window.closeProfile = function() {
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('forumView').style.display = 'block';
    renderCategories();
};

// ============================================
// УПРАВЛЕНИЕ РАНГАМИ
// ============================================
window.openRankModal = function(uid, username, currentRank) {
    if (!isAdmin) {
        showToast('Только администраторы могут менять ранги', 'error');
        return;
    }
    
    document.getElementById('rankTargetUid').value = uid;
    document.getElementById('rankTargetName').textContent = username;
    
    const select = document.getElementById('rankSelect');
    select.innerHTML = '';
    const rankOptions = ['player', 'leader', 'moderator', 'admin'];
    if (userRank === 'owner') {
        rankOptions.push('owner');
    }
    
    rankOptions.forEach(r => {
        const option = document.createElement('option');
        option.value = r;
        option.textContent = getRankName(r);
        if (r === currentRank) option.selected = true;
        select.appendChild(option);
    });
    
    openModal('rankModal');
};

window.setUserRank = async function() {
    const uid = document.getElementById('rankTargetUid').value;
    const newRank = document.getElementById('rankSelect').value;
    
    if (!isAdmin) {
        showToast('Только администраторы могут менять ранги', 'error');
        return;
    }
    
    if (newRank === 'owner' && userRank !== 'owner') {
        showToast('Только владелец может назначить владельца', 'error');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', uid), { rank: newRank });
        closeModal('rankModal');
        showToast('Ранг изменён!', 'success');
        openProfile(null, uid);
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

// ============================================
// AUTH
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
            bio: 'Новый игрок',
            avatar: '',
            rank: 'player',
            createdAt: serverTimestamp(),
            uid: user.uid,
            postsCount: 0,
            threadsCount: 0,
            reputation: 0,
            followers: [],
            following: []
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
// ADMIN (БЕЗ ПОДСКАЗОК ПРО ПАРОЛЬ)
// ============================================
window.verifyAdmin = async function() {
    const password = document.getElementById('adminPassword').value.trim();

    if (password === '1267') {
        if (currentUser) {
            try {
                const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
                if (adminDoc.exists()) {
                    showToast('Вы уже администратор', 'warning');
                    return;
                }
                
                await setDoc(doc(db, 'admins', currentUser.uid), {
                    uid: currentUser.uid,
                    grantedAt: serverTimestamp()
                });
                
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    rank: 'admin'
                });
                
                isAdmin = true;
                userRank = 'admin';
                document.getElementById('adminActions').style.display = 'block';
                document.getElementById('adminPassword').value = '';
                updateUI();
                updateAdminCategorySelect();
                showToast('Права администратора получены!', 'success');
            } catch (error) {
                showToast('Ошибка: ' + error.message, 'error');
            }
        } else {
            showToast('Сначала войдите в аккаунт', 'error');
        }
    } else {
        showToast('Неверный код', 'error');
    }
};

// ============================================
// CATEGORIES
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
            createdBy: currentUser ? currentUser.uid : 'anonymous'
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
// THREADS
// ============================================
window.addThread = async function() {
    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }
    
    if (!hasPermission('create_threads')) {
        showToast('У вас нет прав на создание тем', 'error');
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
        await addDoc(collection(db, 'threads'), {
            categoryId: categoryId,
            title: title,
            content: content,
            author: currentUserData?.username || currentUser.email,
            authorId: currentUser.uid,
            authorRank: userRank,
            createdAt: serverTimestamp(),
            views: 0,
            replies: 0,
            closed: false
        });

        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            await updateDoc(userRef, {
                threadsCount: (data.threadsCount || 0) + 1
            });
        }

        document.getElementById('newThreadTitle').value = '';
        document.getElementById('newThreadContent').value = '';
        showToast('Тема создана!', 'success');
        renderCategories();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

window.deleteThread = async function(threadId) {
    if (!hasPermission('delete_threads')) {
        showToast('У вас нет прав на удаление тем', 'error');
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

window.closeThread = async function(threadId) {
    if (!hasPermission('close_threads')) {
        showToast('У вас нет прав на закрытие тем', 'error');
        return;
    }

    try {
        const threadRef = doc(db, 'threads', threadId);
        const threadDoc = await getDoc(threadRef);
        if (threadDoc.exists()) {
            const data = threadDoc.data();
            await updateDoc(threadRef, {
                closed: !data.closed
            });
            showToast(data.closed ? 'Тема открыта!' : 'Тема закрыта!', 'success');
            openThread(threadId);
        }
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

// ============================================
// RENDER
// ============================================
function updateUI() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('currentUser');
    const avatarLetter = document.getElementById('avatarLetter');
    const avatarImg = document.getElementById('avatarImg');
    const adminBadge = document.getElementById('adminBadge');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminPanelBtn = document.getElementById('adminPanelBtn');

    if (currentUser) {
        const displayName = currentUserData?.username || currentUser.email;
        userName.textContent = displayName;
        
        if (currentUserData?.avatar) {
            avatarImg.src = currentUserData.avatar;
            avatarImg.style.display = 'block';
            avatarLetter.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarLetter.style.display = 'flex';
            avatarLetter.textContent = displayName[0].toUpperCase();
        }
        
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
                            ${categoryThreads.map(thread => {
                                const isClosed = thread.closed || false;
                                return `
                                    <li class="topic-item ${isClosed ? 'topic-closed' : ''}" onclick="openThread('${thread.id}')">
                                        <div class="topic-info">
                                            <h5>${isClosed ? '🔒 ' : ''}${thread.title}</h5>
                                            <div class="topic-meta">
                                                <span>${getRankIcon(thread.authorRank || 'player')} ${thread.author}</span>
                                                <span>${getRankName(thread.authorRank || 'player')}</span>
                                                <span>📅 ${formatDate(thread.createdAt)}</span>
                                                <span>👁 ${thread.views || 0}</span>
                                                <span>💬 ${thread.replies || 0}</span>
                                                ${isClosed ? '<span style="color:var(--danger);">Закрыта</span>' : ''}
                                            </div>
                                        </div>
                                        <div class="topic-actions">
                                            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openProfile(event, '${thread.authorId}')">👤</button>
                                            ${isAdmin ? `
                                                <button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); closeThread('${thread.id}')">
                                                    ${isClosed ? '🔓 Открыть' : '🔒 Закрыть'}
                                                </button>
                                                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteThread('${thread.id}')">🗑️</button>
                                            ` : ''}
                                        </div>
                                    </li>
                                `;
                            }).join('')}
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
        container.innerHTML = `
            <div class="forum-category">
                <div class="empty-state">
                    <span class="empty-icon">⚠️</span>
                    <p>Ошибка загрузки данных</p>
                    <button class="btn btn-primary" onclick="renderCategories()" style="margin-top: 12px;">Обновить</button>
                </div>
            </div>
        `;
    }
}

// ============================================
// OPEN THREAD
// ============================================
window.openThread = async function(threadId) {
    if (!threadId) {
        showToast('Ошибка: ID темы не указан', 'error');
        return;
    }
    
    currentThreadId = threadId;
    const container = document.getElementById('threadContainer');
    const threadView = document.getElementById('threadView');
    const categoriesView = document.getElementById('categoriesView');

    categoriesView.style.display = 'none';
    threadView.style.display = 'block';
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Загрузка темы...</p></div>';

    try {
        const threadRef = doc(db, 'threads', threadId);
        const threadDoc = await getDoc(threadRef);
        
        if (!threadDoc.exists()) {
            showToast('Тема не найдена', 'error');
            showCategoriesView();
            return;
        }
        
        const thread = { id: threadDoc.id, ...threadDoc.data() };
        const isClosed = thread.closed || false;

        try {
            await updateDoc(threadRef, {
                views: (thread.views || 0) + 1
            });
        } catch (e) {}

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
            <div class="thread-detail ${isClosed ? 'thread-closed' : ''}">
                <div class="thread-header">
                    <h2>${isClosed ? '🔒 ' : ''}${thread.title || 'Без названия'}</h2>
                    <div class="thread-meta">
                        <span>${getRankIcon(thread.authorRank || 'player')} ${thread.author || 'Неизвестен'}</span>
                        <span>${getRankName(thread.authorRank || 'player')}</span>
                        <span>📅 ${formatDate(thread.createdAt)}</span>
                        <span>👁 ${(thread.views || 0) + 1}</span>
                        <span>💬 ${posts.length}</span>
                        ${isClosed ? '<span style="color:var(--danger);font-weight:700;">🔒 Тема закрыта</span>' : ''}
                    </div>
                </div>
                <div class="thread-body">${thread.content || 'Содержание отсутствует'}</div>
                <div class="thread-admin-actions">
                    <button class="btn btn-outline btn-sm" onclick="openProfile(event, '${thread.authorId}')">👤 Профиль автора</button>
                    ${isAdmin ? `
                        <button class="btn btn-warning btn-sm" onclick="closeThread('${threadId}')">
                            ${isClosed ? '🔓 Открыть' : '🔒 Закрыть'}
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteThread('${threadId}')">🗑️ Удалить</button>
                    ` : ''}
                </div>
            </div>
            
            <div class="posts-header">
                <h3>💬 Ответы (${posts.length})</h3>
            </div>
            
            <div id="postsContainer">
                ${posts.length === 0 ? 
                    '<div class="empty-state"><span class="empty-icon">💬</span><p>Пока нет ответов</p></div>' :
                    posts.map(post => `
                        <div class="post-item">
                            <div class="post-head">
                                <div class="post-author-info">
                                    <span class="post-author">${getRankIcon(post.authorRank || 'player')} ${post.author || 'Неизвестен'}</span>
                                    <span class="post-rank">${getRankName(post.authorRank || 'player')}</span>
                                </div>
                                <div class="post-actions">
                                    <button class="btn btn-outline btn-sm" onclick="openProfile(event, '${post.authorId}')">👤</button>
                                    <span class="post-date">${formatDate(post.createdAt)}</span>
                                </div>
                            </div>
                            <div class="post-content">${post.content || ''}</div>
                        </div>
                    `).join('')
                }
            </div>
            
            ${currentUser ? `
                ${isClosed ? `
                    <div style="margin-top:20px;padding:20px;background:var(--dark-card);border-radius:var(--radius);text-align:center;border:1px solid var(--danger);">
                        <p style="color:var(--danger);">🔒 Эта тема закрыта для ответов</p>
                    </div>
                ` : `
                    <div class="reply-section">
                        <h4>✏️ Написать ответ</h4>
                        <textarea id="newPostContent" placeholder="Введите текст..."></textarea>
                        <button class="btn btn-primary" onclick="addPost('${threadId}')">📤 Отправить</button>
                    </div>
                `}
            ` : `
                <div style="margin-top:20px;padding:20px;background:var(--dark-card);border-radius:var(--radius);text-align:center;border:1px solid var(--border);">
                    <p style="color:var(--text-muted);">🔑 Войдите в аккаунт, чтобы ответить</p>
                </div>
            `}
        `;
    } catch (error) {
        console.error('Open thread error:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>Ошибка загрузки темы: ${error.message}</p>
                <button class="btn btn-primary" onclick="showCategoriesView()" style="margin-top: 12px;">← Назад</button>
            </div>
        `;
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
        await addDoc(collection(db, 'posts'), {
            threadId: threadId,
            author: currentUserData?.username || currentUser.email,
            authorId: currentUser.uid,
            authorRank: userRank,
            content: content,
            createdAt: serverTimestamp()
        });

        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            await updateDoc(userRef, {
                postsCount: (data.postsCount || 0) + 1
            });
        }

        try {
            const threadDoc = await getDoc(doc(db, 'threads', threadId));
            if (threadDoc.exists()) {
                const thread = threadDoc.data();
                await updateDoc(doc(db, 'threads', threadId), {
                    replies: (thread.replies || 0) + 1
                });
            }
        } catch (e) {}

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
        return date.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        }) + ' ' + date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
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
// PAGES
// ============================================
window.showPage = function(page) {
    const forumView = document.getElementById('forumView');
    const pageView = document.getElementById('pageView');
    const container = document.getElementById('pageContainer');
    
    forumView.style.display = 'none';
    pageView.style.display = 'block';
    
    const pages = {
        rules: {
            title: '📜 Правила сообщества',
            subtitle: 'Основные правила поведения на форуме',
            sections: [
                { title: '1. Уважение к участникам', content: 'Относитесь с уважением ко всем участникам сообщества. Запрещены: оскорбления, угрозы, дискриминация, травля.' },
                { title: '2. Запрещенный контент', content: 'Запрещена публикация: порнографического контента, материалов, пропагандирующих насилие, спама, рекламы без разрешения.' },
                { title: '3. Правила общения', content: 'Общайтесь на русском языке в основных разделах. Используйте понятные заголовки для тем.' }
            ]
        },
        help: {
            title: '❓ Помощь',
            subtitle: 'Часто задаваемые вопросы',
            sections: [
                { title: 'Как зарегистрироваться?', content: 'Нажмите на кнопку "Регистрация" в правом верхнем углу, заполните форму.' },
                { title: 'Как создать тему?', content: 'Войдите в аккаунт и используйте админ-панель.' },
                { title: 'Как получить права администратора?', content: 'Обратитесь к действующему администратору.' }
            ]
        },
        contact: {
            title: '📞 Контакты',
            subtitle: 'Свяжитесь с администрацией',
            contacts: [
                { icon: '📧', label: 'Email', value: 'support@arizona-rp.com' },
                { icon: '💬', label: 'Discord', value: 'discord.gg/arizona-rp' },
                { icon: '📱', label: 'Telegram', value: '@arizona_rp_support' }
            ]
        },
        privacy: {
            title: '🔒 Конфиденциальность',
            subtitle: 'Как мы обрабатываем ваши данные',
            sections: [
                { title: 'Какие данные мы собираем', content: 'Имя пользователя, email, пароль. Данные о активности на форуме.' },
                { title: 'Как мы используем данные', content: 'Для авторизации, отображения профиля, улучшения работы сервиса.' },
                { title: 'Безопасность данных', content: 'Все данные защищены шифрованием. Пароли хранятся в зашифрованном виде.' }
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
// REAL-TIME
// ============================================
try {
    onSnapshot(collection(db, 'categories'), () => {
        if (!document.getElementById('threadView').style.display || 
            document.getElementById('threadView').style.display === 'none') {
            if (!document.getElementById('pageView').style.display || 
                document.getElementById('pageView').style.display === 'none') {
                if (!document.getElementById('profileView').style.display || 
                    document.getElementById('profileView').style.display === 'none') {
                    renderCategories();
                }
            }
        }
    });
} catch (e) {}

try {
    onSnapshot(collection(db, 'threads'), () => {
        if (!document.getElementById('threadView').style.display || 
            document.getElementById('threadView').style.display === 'none') {
            if (!document.getElementById('pageView').style.display || 
                document.getElementById('pageView').style.display === 'none') {
                if (!document.getElementById('profileView').style.display || 
                    document.getElementById('profileView').style.display === 'none') {
                    renderCategories();
                }
            }
        }
    });
} catch (e) {}

// ============================================
// ONLINE
// ============================================
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

console.log('🚀 Arizona RP Forum loaded!');
setTimeout(() => { renderCategories(); }, 500);