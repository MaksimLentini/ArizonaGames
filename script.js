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
let adminChecked = false;
let foundUserForAdmin = null;

// ============================================
// 📊 СБОР ДАННЫХ О ПОЛЬЗОВАТЕЛЕ
// ============================================

async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'не определён';
    } catch {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            return data.ip || 'не определён';
        } catch {
            return 'не определён';
        }
    }
}

function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Неизвестный';
    let version = '';

    if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) {
        browser = 'Chrome';
        version = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('Firefox')) {
        browser = 'Firefox';
        version = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Edg')) {
        browser = 'Safari';
        version = ua.match(/Version\/(\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('Edg')) {
        browser = 'Edge';
        version = ua.match(/Edg\/(\d+\.\d+)/)?.[1] || '';
    } else if (ua.includes('OPR') || ua.includes('Opera')) {
        browser = 'Opera';
        version = ua.match(/(?:OPR|Opera)\/(\d+\.\d+)/)?.[1] || '';
    }

    return `${browser} ${version}`.trim();
}

function getOSInfo() {
    const ua = navigator.userAgent;
    if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
    if (ua.includes('Windows NT 6.3')) return 'Windows 8.1';
    if (ua.includes('Windows NT 6.2')) return 'Windows 8';
    if (ua.includes('Windows NT 6.1')) return 'Windows 7';
    if (ua.includes('Mac OS X')) {
        const v = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.');
        return v ? `macOS ${v}` : 'macOS';
    }
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS') || ua.includes('iPhone')) return 'iOS';
    if (ua.includes('iPad')) return 'iPadOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('CrOS')) return 'Chrome OS';
    return 'Неизвестная';
}

async function collectUserData() {
    if (!currentUser) return;

    try {
        const consent = localStorage.getItem('userConsent');
        if (consent !== 'accepted') return;

        const ip = await getUserIP();
        const browser = getBrowserInfo();
        const os = getOSInfo();

        await setDoc(doc(db, 'user_data', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email,
            ip: ip,
            browser: browser,
            os: os,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language || navigator.userLanguage || 'не определён',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'не определена',
            referrer: document.referrer || 'прямой переход',
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        console.log('📊 Данные пользователя сохранены');
    } catch (error) {
        console.warn('⚠️ Не удалось сохранить данные:', error.message);
    }
}

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
    
    initAdminConfig();
    startRealtimeListeners();
    
    // Показываем уведомление о сборе данных
    setTimeout(() => {
        if (!localStorage.getItem('userConsent')) {
            const consent = document.getElementById('cookieConsent');
            if (consent) consent.style.display = 'flex';
        }
    }, 1500);
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
// АВТОСОЗДАНИЕ КОНФИГА
// ============================================
async function initAdminConfig() {
    try {
        const configRef = doc(db, 'config', 'admin');
        const configSnap = await getDoc(configRef);
        
        if (!configSnap.exists()) {
            await setDoc(configRef, {
                password: '67521488',
                createdAt: serverTimestamp(),
                createdBy: 'system'
            });
            console.log('🔐 Админ-пароль создан в Firebase');
        }
    } catch (error) {
        console.warn('⚠️ Не удалось создать конфиг:', error.message);
    }
}

// ============================================
// РЕАЛЬНОЕ ВРЕМЯ
// ============================================
let unsubscribeCategories = null;
let unsubscribeThreads = null;
let unsubscribePosts = null;

function startRealtimeListeners() {
    if (unsubscribeCategories) unsubscribeCategories();
    if (unsubscribeThreads) unsubscribeThreads();
    if (unsubscribePosts) unsubscribePosts();

    unsubscribeCategories = onSnapshot(
        collection(db, 'categories'),
        () => {
            if (!document.getElementById('threadView').style.display || 
                document.getElementById('threadView').style.display === 'none') {
                renderCategories();
            }
        },
        (error) => {
            console.warn('⚠️ Ошибка слушателя категорий:', error.message);
        }
    );

    unsubscribeThreads = onSnapshot(
        collection(db, 'threads'),
        () => {
            if (!document.getElementById('threadView').style.display || 
                document.getElementById('threadView').style.display === 'none') {
                renderCategories();
            }
        },
        (error) => {
            console.warn('⚠️ Ошибка слушателя тем:', error.message);
        }
    );

    unsubscribePosts = onSnapshot(
        collection(db, 'posts'),
        () => {
            if (document.getElementById('threadView').style.display !== 'none' && currentThreadId) {
                openThread(currentThreadId);
            }
        },
        (error) => {
            console.warn('⚠️ Ошибка слушателя постов:', error.message);
        }
    );
}

// ============================================
// AUTH + СБОР ДАННЫХ
// ============================================
onAuthStateChanged(auth, async (user) => {
    const usersListBtn = document.getElementById('usersListBtn');
    if (user) {
        currentUser = user;
        await loadUserData(user.uid);
        await checkAdminStatus(user.uid);
        updateUI();
        loadStats();
        renderCategories();
        updateAdminCategoryDeleteSelect();
        if (usersListBtn) usersListBtn.style.display = 'inline-flex';
        
        // 📊 СОБИРАЕМ ДАННЫЕ О ПОЛЬЗОВАТЕЛЕ
        collectUserData();
    } else {
        currentUser = null;
        currentUserData = null;
        isAdmin = false;
        userRank = 'player';
        adminChecked = false;
        updateUI();
        renderCategories();
        if (usersListBtn) usersListBtn.style.display = 'none';
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
        console.warn('⚠️ Оффлайн режим, использую кешированные данные');
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
}

async function checkAdminStatus(uid) {
    try {
        const adminDoc = await getDoc(doc(db, 'admins', uid));
        isAdmin = adminDoc.exists();
        adminChecked = true;
        
        if (isAdmin && userRank !== 'owner' && userRank !== 'admin') {
            await updateDoc(doc(db, 'users', uid), { rank: 'admin' });
            userRank = 'admin';
            document.getElementById('adminActions').style.display = 'block';
        }
        updateUI();
    } catch (error) {
        console.warn('⚠️ Оффлайн режим, проверка админа пропущена');
        isAdmin = false;
        adminChecked = true;
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

    if (!checkRateLimit(`follow_${currentUser.uid}`, 10, 60000)) {
        showToast('⏳ Слишком много запросов. Подождите минуту.', 'error');
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
// ПРОФИЛЬ
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
    document.getElementById('usersView').style.display = 'none';
    
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

        if (username) {
            const newUrl = `/${encodeURIComponent(username)}`;
            window.history.pushState({ username: username }, '', newUrl);
        }

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
                                    <span class="profile-post-author-name">${sanitizeInput(post.fromName)}</span>
                                    <span class="profile-post-rank">${getRankName(post.fromRank || 'player')}</span>
                                </div>
                                <span class="profile-post-date">${formatDate(post.createdAt)}</span>
                            </div>
                            <div class="profile-post-content">${sanitizeInput(post.content)}</div>
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
                        <h1 class="profile-name">${sanitizeInput(username)}</h1>
                        <div class="profile-rank">${rankIcon} ${rankDisplay}</div>
                        <div class="profile-bio">${sanitizeInput(bio)}</div>
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
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>Ошибка загрузки профиля</p>
                <button class="btn btn-primary" onclick="openProfile(event, '${targetUid}')" style="margin-top:12px;">Попробовать снова</button>
            </div>
        `;
    }
};

// ============================================
// ДОБАВЛЕНИЕ ЗАПИСИ В ПРОФИЛЬ
// ============================================
window.addProfilePost = async function(toUid) {
    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }

    if (!checkRateLimit(`profile_post_${currentUser.uid}`, 3, 30000)) {
        showToast('⏳ Слишком много записей. Подождите 30 секунд.', 'error');
        return;
    }

    const input = document.getElementById('profilePostInput');
    const content = input.value.trim();
    
    if (!content) {
        showToast('Введите текст записи', 'error');
        return;
    }

    if (!validateLength(content, 1, 500)) {
        showToast('Текст должен быть от 1 до 500 символов', 'error');
        return;
    }

    const safeContent = sanitizeInput(content);

    try {
        await addDoc(collection(db, 'profile_posts'), {
            toUid: toUid,
            fromUid: currentUser.uid,
            fromName: currentUserData?.username || currentUser.email,
            fromRank: currentUserData?.rank || 'player',
            content: safeContent,
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
    }).catch(() => {
        showToast('Ошибка загрузки данных профиля', 'error');
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

    if (!validateUsername(username)) {
        showToast('Имя должно содержать 3-20 символов (a-z, A-Z, 0-9, _, -, .)', 'error');
        return;
    }

    if (!validateLength(bio, 0, 500)) {
        showToast('Описание не должно превышать 500 символов', 'error');
        return;
    }

    if (avatar && !avatar.startsWith('https://')) {
        showToast('Ссылка должна начинаться с https://', 'error');
        return;
    }

    const safeUsername = sanitizeInput(username);
    const safeBio = sanitizeInput(bio);
    const safeAvatar = sanitizeInput(avatar);

    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            username: safeUsername,
            bio: safeBio || 'Пользователь пока ничего не рассказал о себе',
            avatar: safeAvatar || '',
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
    window.history.pushState({}, '', '/');
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
// ВЫДАЧА ПРАВ ПО НИКУ
// ============================================
window.searchUserForAdmin = async function() {
    if (!isAdmin) {
        showToast('Требуются права администратора', 'error');
        return;
    }

    if (!checkRateLimit(`search_user_${currentUser.uid}`, 5, 30000)) {
        showToast('⏳ Слишком много поисков. Подождите 30 секунд.', 'error');
        return;
    }

    const username = document.getElementById('adminUserSearch').value.trim();
    if (!username) {
        showToast('Введите ник пользователя', 'error');
        return;
    }

    if (!validateUsername(username)) {
        showToast('Некорректное имя пользователя', 'error');
        return;
    }

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let found = null;
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.username && data.username.toLowerCase() === username.toLowerCase()) {
                found = { id: doc.id, ...data };
            }
        });

        const resultDiv = document.getElementById('userSearchResult');
        const nameSpan = document.getElementById('userSearchName');

        if (found) {
            foundUserForAdmin = found;
            const currentRank = found.rank || 'player';
            nameSpan.innerHTML = `
                <strong>${sanitizeInput(found.username)}</strong> 
                (текущий ранг: ${getRankName(currentRank)})
                ${found.id === currentUser.uid ? ' <span style="color:var(--warning);">(это вы)</span>' : ''}
            `;
            resultDiv.style.display = 'flex';
            
            const grantBtn = resultDiv.querySelector('.btn-success');
            if (found.rank === 'admin' || found.rank === 'owner') {
                grantBtn.style.display = 'none';
                nameSpan.innerHTML += ' <span style="color:var(--success);">✅ Уже администратор</span>';
            } else {
                grantBtn.style.display = 'inline-block';
            }
        } else {
            foundUserForAdmin = null;
            nameSpan.textContent = `❌ Пользователь "${sanitizeInput(username)}" не найден`;
            resultDiv.style.display = 'flex';
            const grantBtn = resultDiv.querySelector('.btn-success');
            if (grantBtn) grantBtn.style.display = 'none';
        }
    } catch (error) {
        showToast('Ошибка поиска: ' + error.message, 'error');
    }
};

window.grantAdmin = async function() {
    if (!foundUserForAdmin) {
        showToast('Сначала найдите пользователя', 'error');
        return;
    }

    if (foundUserForAdmin.id === currentUser.uid) {
        showToast('Нельзя выдать права самому себе', 'error');
        return;
    }

    if (!isAdmin) {
        showToast('У вас нет прав для выдачи администратора', 'error');
        return;
    }

    try {
        await setDoc(doc(db, 'admins', foundUserForAdmin.id), {
            uid: foundUserForAdmin.id,
            grantedAt: serverTimestamp(),
            grantedBy: currentUser.uid
        });

        await updateDoc(doc(db, 'users', foundUserForAdmin.id), {
            rank: 'admin'
        });

        showToast(`✅ Пользователь ${sanitizeInput(foundUserForAdmin.username)} теперь администратор!`, 'success');
        
        document.getElementById('userSearchResult').style.display = 'none';
        document.getElementById('adminUserSearch').value = '';
        foundUserForAdmin = null;

        updateUI();
        renderCategories();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

// ============================================
// УДАЛЕНИЕ РАЗДЕЛА
// ============================================
window.deleteCategory = async function() {
    if (!isAdmin) {
        showToast('Требуются права администратора', 'error');
        return;
    }

    const categoryId = document.getElementById('adminCategoryDeleteSelect').value;
    if (!categoryId) {
        showToast('Выберите раздел для удаления', 'error');
        return;
    }

    if (!confirm('Удалить этот раздел и все темы в нём?')) return;

    try {
        const threadsQuery = query(collection(db, 'threads'), where('categoryId', '==', categoryId));
        const threadsSnapshot = await getDocs(threadsQuery);
        const deletePromises = threadsSnapshot.docs.map(d => deleteDoc(doc(db, 'threads', d.id)));
        await Promise.all(deletePromises);

        await deleteDoc(doc(db, 'categories', categoryId));

        showToast('Раздел удалён!', 'success');
        renderCategories();
        updateAdminCategorySelect();
        updateAdminCategoryDeleteSelect();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

function updateAdminCategoryDeleteSelect() {
    const select = document.getElementById('adminCategoryDeleteSelect');
    select.innerHTML = '<option value="">Выберите раздел</option>';
    getDocs(collection(db, 'categories')).then(snapshot => {
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = data.name;
            select.appendChild(option);
        });
    }).catch(error => {
        console.error('Category delete select error:', error);
    });
}

// ============================================
// СПИСОК ПОЛЬЗОВАТЕЛЕЙ
// ============================================
window.showUsersList = async function() {
    const forumView = document.getElementById('forumView');
    const usersView = document.getElementById('usersView');
    const container = document.getElementById('usersContainer');
    
    forumView.style.display = 'none';
    usersView.style.display = 'block';
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('pageView').style.display = 'none';
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Загрузка пользователей...</p></div>';

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let users = [];
        usersSnapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });

        users.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });

        let html = `
            <div class="users-grid">
                <div class="users-header">
                    <h2>👥 Все пользователи (${users.length})</h2>
                    <input type="text" id="userSearchInput" placeholder="Поиск по нику..." oninput="filterUsers()" style="max-width:300px;padding:8px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);">
                </div>
                <div id="usersListContainer">
        `;

        if (users.length === 0) {
            html += `<div class="empty-state"><span class="empty-icon">👤</span><p>Нет пользователей</p></div>`;
        } else {
            users.forEach(user => {
                const rankIcon = getRankIcon(user.rank || 'player');
                const rankName = getRankName(user.rank || 'player');
                const avatarUrl = user.avatar || '';
                const username = user.username || 'Неизвестно';
                
                html += `
                    <div class="user-card" data-username="${username.toLowerCase()}" onclick="openProfileByUsername('${username}')">
                        <div class="user-card-avatar">
                            ${avatarUrl ? 
                                `<img src="${avatarUrl}" alt="Avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />` : 
                                ''
                            }
                            <span class="user-card-avatar-letter" ${avatarUrl ? 'style="display:none;"' : ''}>${username[0].toUpperCase()}</span>
                        </div>
                        <div class="user-card-info">
                            <div class="user-card-name">${sanitizeInput(username)}</div>
                            <div class="user-card-rank">${rankIcon} ${rankName}</div>
                            <div class="user-card-meta">📅 ${formatDate(user.createdAt)}</div>
                        </div>
                        <div class="user-card-actions">
                            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openProfileByUsername('${username}')">👤 Открыть</button>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div></div>`;
        container.innerHTML = html;
    } catch (error) {
        console.error('Users list error:', error);
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>Ошибка загрузки пользователей</p></div>`;
    }
};

window.filterUsers = function() {
    const input = document.getElementById('userSearchInput');
    if (!input) return;
    const query = input.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.user-card');
    
    cards.forEach(card => {
        const username = card.dataset.username || '';
        if (username.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

window.openProfileByUsername = async function(username) {
    if (!username) {
        showToast('Введите ник', 'error');
        return;
    }

    if (!validateUsername(username)) {
        showToast('Некорректное имя пользователя', 'error');
        return;
    }

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let foundUser = null;
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.username && data.username.toLowerCase() === username.toLowerCase()) {
                foundUser = { id: doc.id, ...data };
            }
        });

        if (foundUser) {
            document.getElementById('usersView').style.display = 'none';
            document.getElementById('forumView').style.display = 'none';
            openProfile(null, foundUser.id);
        } else {
            showToast(`Пользователь "${sanitizeInput(username)}" не найден`, 'error');
        }
    } catch (error) {
        showToast('Ошибка поиска: ' + error.message, 'error');
    }
};

// ============================================
// МАРШРУТИЗАЦИЯ ПО НИКУ
// ============================================
function handleRoute() {
    const path = window.location.pathname;
    if (path && path !== '/') {
        const username = decodeURIComponent(path.substring(1));
        if (username) {
            setTimeout(() => {
                if (currentUser) {
                    openProfileByUsername(username);
                } else {
                    const checkAuth = setInterval(() => {
                        if (currentUser) {
                            clearInterval(checkAuth);
                            openProfileByUsername(username);
                        }
                    }, 500);
                }
            }, 1000);
        }
    }
}

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.username) {
        openProfileByUsername(event.state.username);
    } else {
        document.getElementById('profileView').style.display = 'none';
        document.getElementById('forumView').style.display = 'block';
        renderCategories();
    }
});

// ============================================
// AUTH С ЗАЩИТОЙ
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

    if (!validateUsername(username)) {
        showToast('Имя должно содержать 3-20 символов (a-z, A-Z, 0-9, _, -, .)', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Пароль должен быть минимум 6 символов', 'error');
        return;
    }

    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordStrength.test(password)) {
        showToast('Пароль должен содержать заглавные, строчные буквы и цифры', 'error');
        return;
    }

    if (password !== confirm) {
        showToast('Пароли не совпадают', 'error');
        return;
    }

    if (!checkRateLimit(`register_${email}`, 3, 60000)) {
        showToast('⏳ Слишком много попыток регистрации. Подождите минуту.', 'error');
        return;
    }

    const safeUsername = sanitizeInput(username);
    const safeEmail = sanitizeInput(email);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, safeEmail, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            username: safeUsername,
            email: safeEmail,
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

    if (!checkRateLimit(`login_${email}`, 5, 60000)) {
        showToast('⏳ Слишком много попыток входа. Подождите минуту.', 'error');
        return;
    }

    const safeEmail = sanitizeInput(email);

    try {
        await signInWithEmailAndPassword(auth, safeEmail, password);
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
// ADMIN - ПАРОЛЬ ТОЛЬКО ИЗ FIREBASE
// ============================================
window.verifyAdmin = async function() {
    const password = document.getElementById('adminPassword').value.trim();

    if (isAdmin) {
        document.getElementById('adminActions').style.display = 'block';
        document.getElementById('adminPassword').value = '';
        showToast('Вы уже администратор', 'warning');
        return;
    }

    if (!currentUser) {
        showToast('Сначала войдите в аккаунт', 'error');
        return;
    }

    if (!checkRateLimit(`admin_${currentUser.uid}`, 3, 30000)) {
        showToast('⏳ Слишком много попыток. Подождите 30 секунд.', 'error');
        return;
    }

    try {
        const configDoc = await getDoc(doc(db, 'config', 'admin'));
        
        if (!configDoc.exists()) {
            showToast('Ошибка: пароль не настроен в Firebase. Обратитесь к администратору.', 'error');
            return;
        }
        
        const adminPassword = configDoc.data().password;
        
        if (!adminPassword) {
            showToast('Ошибка: пароль не найден в базе данных', 'error');
            return;
        }

        if (password === adminPassword) {
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
            updateAdminCategoryDeleteSelect();
            showToast('Права администратора получены!', 'success');
        } else {
            showToast('Неверный код', 'error');
        }
    } catch (error) {
        console.error('Admin verify error:', error);
        showToast('Ошибка подключения к базе данных. Проверьте интернет.', 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const adminModal = document.getElementById('adminModal');
    const observer = new MutationObserver(() => {
        if (adminModal.classList.contains('active') && isAdmin) {
            document.getElementById('adminActions').style.display = 'block';
        }
    });
    observer.observe(adminModal, { attributes: true, attributeFilter: ['class'] });
});

// ============================================
// 🛡️ ЗАЩИТА: САНИТАЙЗЕР И ВАЛИДАЦИЯ
// ============================================
function sanitizeInput(input) {
    if (!input) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    return String(input).replace(/[&<>"'`=\/]/g, function(s) {
        return map[s];
    });
}

function validateLength(input, min = 1, max = 1000) {
    if (!input) return false;
    const len = String(input).length;
    return len >= min && len <= max;
}

function validateUsername(username) {
    if (!username) return false;
    const regex = /^[a-zA-Z0-9_.-]{3,20}$/;
    return regex.test(username);
}

const rateLimits = {};

function checkRateLimit(key, limit = 5, window = 60000) {
    const now = Date.now();
    if (!rateLimits[key]) {
        rateLimits[key] = [];
    }
    rateLimits[key] = rateLimits[key].filter(t => now - t < window);
    if (rateLimits[key].length >= limit) {
        return false;
    }
    rateLimits[key].push(now);
    return true;
}

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

    if (!validateLength(name, 1, 50)) {
        showToast('Название должно быть от 1 до 50 символов', 'error');
        return;
    }

    const safeName = sanitizeInput(name);
    const safeDescription = sanitizeInput(description || '');

    try {
        await addDoc(collection(db, 'categories'), {
            name: safeName,
            description: safeDescription || 'Описание отсутствует',
            createdAt: serverTimestamp(),
            createdBy: currentUser ? currentUser.uid : 'anonymous'
        });

        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryDesc').value = '';
        showToast('Раздел создан!', 'success');
        renderCategories();
        updateAdminCategorySelect();
        updateAdminCategoryDeleteSelect();
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

    if (!checkRateLimit(`thread_${currentUser.uid}`, 5, 30000)) {
        showToast('⏳ Слишком много тем. Подождите 30 секунд.', 'error');
        return;
    }

    const categoryId = document.getElementById('adminCategorySelect').value;
    const title = document.getElementById('newThreadTitle').value.trim();
    const content = document.getElementById('newThreadContent').value.trim();

    if (!title || !content) {
        showToast('Заполните все поля', 'error');
        return;
    }

    if (!validateLength(title, 1, 100)) {
        showToast('Название должно быть от 1 до 100 символов', 'error');
        return;
    }
    if (!validateLength(content, 1, 10000)) {
        showToast('Содержание должно быть от 1 до 10000 символов', 'error');
        return;
    }

    const safeTitle = sanitizeInput(title);
    const safeContent = sanitizeInput(content);

    try {
        await addDoc(collection(db, 'threads'), {
            categoryId: categoryId,
            title: safeTitle,
            content: safeContent,
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
        adminBadge.style.display = (userRank === 'admin' || userRank === 'owner') ? 'inline' : 'none';
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
        adminPanelBtn.style.display = (userRank === 'admin' || userRank === 'owner') ? 'inline-flex' : 'none';
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
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Загрузка...</p></div>';

    try {
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });

        counter.textContent = `${categories.length}`;

        if (categories.length === 0) {
            container.innerHTML = `
                <div class="forum-category">
                    <div class="empty-state">
                        <span class="empty-icon">📋</span>
                        <p>Нет разделов</p>
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
                        <h4>${sanitizeInput(category.name)}</h4>
                        <span class="category-meta">${categoryThreads.length}</span>
                    </div>
                    <div class="category-desc">${sanitizeInput(category.description || '')}</div>
                    ${categoryThreads.length === 0 ? 
                        `<div class="empty-state" style="padding:12px 0;font-size:13px;">Нет тем</div>` :
                        `<ul class="topic-list">
                            ${categoryThreads.map(thread => {
                                const isClosed = thread.closed || false;
                                return `
                                    <li class="topic-item ${isClosed ? 'topic-closed' : ''}" onclick="openThread('${thread.id}')">
                                        <div class="topic-info">
                                            <h5>${isClosed ? '🔒 ' : ''}${sanitizeInput(thread.title)}</h5>
                                            <div class="topic-meta">
                                                <span>${getRankIcon(thread.authorRank || 'player')} ${sanitizeInput(thread.author)}</span>
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
                                                    ${isClosed ? '🔓' : '🔒'}
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
                    <p>Ошибка загрузки</p>
                    <button class="btn btn-primary" onclick="renderCategories()" style="margin-top:12px;">Обновить</button>
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
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('usersView').style.display = 'none';
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Загрузка...</p></div>';

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
                    <h2>${isClosed ? '🔒 ' : ''}${sanitizeInput(thread.title || 'Без названия')}</h2>
                    <div class="thread-meta">
                        <span>${getRankIcon(thread.authorRank || 'player')} ${sanitizeInput(thread.author || 'Неизвестен')}</span>
                        <span>${getRankName(thread.authorRank || 'player')}</span>
                        <span>📅 ${formatDate(thread.createdAt)}</span>
                        <span>👁 ${(thread.views || 0) + 1}</span>
                        <span>💬 ${posts.length}</span>
                        ${isClosed ? '<span style="color:var(--danger);font-weight:700;">🔒 Закрыта</span>' : ''}
                    </div>
                </div>
                <div class="thread-body">${sanitizeInput(thread.content || '')}</div>
                <div class="thread-admin-actions">
                    <button class="btn btn-outline btn-sm" onclick="openProfile(event, '${thread.authorId}')">👤</button>
                    ${isAdmin ? `
                        <button class="btn btn-warning btn-sm" onclick="closeThread('${threadId}')">
                            ${isClosed ? '🔓 Открыть' : '🔒 Закрыть'}
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteThread('${threadId}')">🗑️</button>
                    ` : ''}
                </div>
            </div>
            
            <div class="posts-header">
                <h3>💬 Ответы (${posts.length})</h3>
            </div>
            
            <div id="postsContainer">
                ${posts.length === 0 ? 
                    '<div class="empty-state"><span class="empty-icon">💬</span><p>Нет ответов</p></div>' :
                    posts.map(post => `
                        <div class="post-item">
                            <div class="post-head">
                                <div class="post-author-info">
                                    <span class="post-author">${getRankIcon(post.authorRank || 'player')} ${sanitizeInput(post.author || 'Неизвестен')}</span>
                                    <span class="post-rank">${getRankName(post.authorRank || 'player')}</span>
                                </div>
                                <div class="post-actions">
                                    <button class="btn btn-outline btn-sm" onclick="openProfile(event, '${post.authorId}')">👤</button>
                                    <span class="post-date">${formatDate(post.createdAt)}</span>
                                </div>
                            </div>
                            <div class="post-content">${sanitizeInput(post.content || '')}</div>
                        </div>
                    `).join('')
                }
            </div>
            
            ${currentUser ? `
                ${isClosed ? `
                    <div style="margin-top:20px;padding:20px;background:var(--dark-card);border-radius:var(--radius);text-align:center;border:1px solid var(--danger);">
                        <p style="color:var(--danger);">🔒 Тема закрыта</p>
                    </div>
                ` : `
                    <div class="reply-section">
                        <h4>✏️ Ответ</h4>
                        <textarea id="newPostContent" placeholder="Введите текст..."></textarea>
                        <button class="btn btn-primary" onclick="addPost('${threadId}')">📤 Отправить</button>
                    </div>
                `}
            ` : `
                <div style="margin-top:20px;padding:20px;background:var(--dark-card);border-radius:var(--radius);text-align:center;border:1px solid var(--border);">
                    <p style="color:var(--text-muted);">🔑 Войдите чтобы ответить</p>
                </div>
            `}
        `;
    } catch (error) {
        console.error('Open thread error:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>Ошибка: ${error.message}</p>
                <button class="btn btn-primary" onclick="showCategoriesView()" style="margin-top:12px;">← Назад</button>
            </div>
        `;
    }
};

window.addPost = async function(threadId) {
    const content = document.getElementById('newPostContent').value.trim();
    if (!content) {
        showToast('Введите текст', 'error');
        return;
    }

    if (!currentUser) {
        showToast('Войдите в аккаунт', 'error');
        return;
    }

    if (!checkRateLimit(`post_${currentUser.uid}`, 10, 60000)) {
        showToast('⏳ Слишком много сообщений. Подождите минуту.', 'error');
        return;
    }

    if (!validateLength(content, 1, 5000)) {
        showToast('Текст должен быть от 1 до 5000 символов', 'error');
        return;
    }

    const safeContent = sanitizeInput(content);

    try {
        await addDoc(collection(db, 'posts'), {
            threadId: threadId,
            author: currentUserData?.username || currentUser.email,
            authorId: currentUser.uid,
            authorRank: userRank,
            content: safeContent,
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
    document.getElementById('usersView').style.display = 'none';
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('pageView').style.display = 'none';
    window.history.pushState({}, '', '/');
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
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('usersView').style.display = 'none';
    
    const pages = {
        rules: {
            title: '📜 Правила',
            subtitle: 'Правила поведения на форуме',
            sections: [
                { title: '1. Уважение', content: 'Относитесь с уважением ко всем. Запрещены: оскорбления, угрозы, дискриминация.' },
                { title: '2. Запрещенный контент', content: 'Запрещена публикация: порнографии, материалов с насилием, спама, рекламы.' },
                { title: '3. Общение', content: 'Общайтесь на русском языке. Используйте понятные заголовки.' }
            ]
        },
        help: {
            title: '❓ Помощь',
            subtitle: 'Часто задаваемые вопросы',
            sections: [
                { title: 'Как зарегистрироваться?', content: 'Нажмите "Регистрация" в правом верхнем углу.' },
                { title: 'Как создать тему?', content: 'Войдите в аккаунт и используйте админ-панель.' },
                { title: 'Как получить права администратора?', content: 'Обратитесь к администратору.' }
            ]
        },
        contact: {
            title: '📞 Контакты',
            subtitle: 'Связь с администрацией',
            contacts: [
                { icon: '💬', label: 'Discord', value: 'lentini321321' }
            ]
        },
        privacy: {
            title: '🔒 Конфиденциальность',
            subtitle: 'Обработка данных',
            sections: [
                { title: 'Какие данные мы собираем', content: 'Имя пользователя, email, пароль. Данные о активности.' },
                { title: 'Как мы используем данные', content: 'Для авторизации, отображения профиля, улучшения работы.' },
                { title: 'Безопасность', content: 'Все данные защищены шифрованием. Пароли хранятся в зашифрованном виде.' }
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
                    if (!document.getElementById('usersView').style.display || 
                        document.getElementById('usersView').style.display === 'none') {
                        renderCategories();
                        updateAdminCategoryDeleteSelect();
                    }
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
                    if (!document.getElementById('usersView').style.display || 
                        document.getElementById('usersView').style.display === 'none') {
                        renderCategories();
                    }
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
    updateAdminCategoryDeleteSelect();
};

// ============================================
// МАРШРУТИЗАЦИЯ
// ============================================
window.addEventListener('load', () => {
    setTimeout(handleRoute, 1500);
});

console.log('🚀 Forum Sell loaded!');
setTimeout(() => { 
    renderCategories(); 
    updateAdminCategoryDeleteSelect();
}, 500);