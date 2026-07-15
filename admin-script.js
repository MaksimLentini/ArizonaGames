import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

let allUsers = [];
let currentDetailUid = null;
let isAdmin = false;

// ============================================
// ПРОВЕРКА АДМИНА
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '/';
        return;
    }
    
    try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (!adminDoc.exists()) {
            alert('⛔ Доступ запрещён! Только для администраторов.');
            window.location.href = '/';
            return;
        }
        isAdmin = true;
        loadData();
        startRealtime();
    } catch (error) {
        console.error('Admin check error:', error);
        window.location.href = '/';
    }
});

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================
async function loadData() {
    try {
        // Загружаем всех пользователей
        const usersSnapshot = await getDocs(collection(db, 'users'));
        allUsers = [];
        usersSnapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        // Загружаем админов
        const adminsSnapshot = await getDocs(collection(db, 'admins'));
        const adminIds = new Set();
        adminsSnapshot.forEach(doc => {
            adminIds.add(doc.id);
        });

        // Загружаем статистику по постам
        const postsSnapshot = await getDocs(collection(db, 'posts'));

        // Обновляем статистику
        document.getElementById('totalUsers').textContent = allUsers.length;
        document.getElementById('totalAdmins').textContent = adminIds.size;
        document.getElementById('totalBanned').textContent = allUsers.filter(u => u.rank === 'banned').length;
        document.getElementById('totalPosts').textContent = postsSnapshot.size;

        // Рендерим таблицу
        renderTable(allUsers, adminIds);
    } catch (error) {
        console.error('Load data error:', error);
        document.getElementById('userTableBody').innerHTML = 
            `<tr><td colspan="10" class="empty-state">⚠️ Ошибка загрузки данных</td></tr>`;
    }
}

// ============================================
// РЕАЛЬНОЕ ВРЕМЯ
// ============================================
function startRealtime() {
    onSnapshot(collection(db, 'users'), () => {
        loadData();
    });
}

// ============================================
// РЕНДЕР ТАБЛИЦЫ
// ============================================
function renderTable(users, adminIds) {
    const tbody = document.getElementById('userTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state">Нет пользователей</td></tr>`;
        return;
    }

    // Сортируем по дате регистрации (новые сверху)
    users.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
    });

    let html = '';
    users.forEach((user, index) => {
        const isAdminUser = adminIds.has(user.id) || user.rank === 'admin' || user.rank === 'owner';
        const rankClass = getRankClass(user.rank || 'player');
        const rankName = getRankName(user.rank || 'player');
        const avatarUrl = user.avatar || '';
        const username = user.username || 'Неизвестно';
        const email = user.email || '-';
        const threadsCount = user.threadsCount || 0;
        const postsCount = user.postsCount || 0;
        const followers = user.followers?.length || 0;
        const createdAt = user.createdAt ? formatDate(user.createdAt) : '-';

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div class="avatar-mini">
                        ${avatarUrl ? 
                            `<img src="${avatarUrl}" alt="Avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />` : 
                            ''
                        }
                        <span ${avatarUrl ? 'style="display:none;"' : ''}>${username[0].toUpperCase()}</span>
                    </div>
                </td>
                <td><strong>${escapeHtml(username)}</strong></td>
                <td>${escapeHtml(email)}</td>
                <td><span class="rank-badge ${rankClass}">${rankName}</span></td>
                <td>${threadsCount}</td>
                <td>${postsCount}</td>
                <td>${followers}</td>
                <td>${createdAt}</td>
                <td>
                    <button class="action-btn view" onclick="viewUser('${user.id}')">👁️</button>
                    ${user.rank === 'banned' ? 
                        `<button class="action-btn" style="background:var(--success);color:white;" onclick="unbanUser('${user.id}')">✅</button>` :
                        `<button class="action-btn ban" onclick="banUser('${user.id}')">🚫</button>`
                    }
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ============================================
// ПОИСК
// ============================================
window.filterUsers = function() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#userTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
};

// ============================================
// ПРОСМОТР ПОЛЬЗОВАТЕЛЯ
// ============================================
window.viewUser = async function(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            showToast('Пользователь не найден', 'error');
            return;
        }
        
        const data = userDoc.data();
        currentDetailUid = uid;
        
        document.getElementById('detailUserName').textContent = data.username || 'Неизвестно';
        document.getElementById('detailUserRank').textContent = getRankName(data.rank || 'player');
        document.getElementById('detailUid').textContent = uid;
        document.getElementById('detailEmail').textContent = data.email || '-';
        document.getElementById('detailBio').textContent = data.bio || 'Не указано';
        document.getElementById('detailAvatar').textContent = data.avatar || 'Не установлена';
        document.getElementById('detailThreads').textContent = data.threadsCount || 0;
        document.getElementById('detailPosts').textContent = data.postsCount || 0;
        document.getElementById('detailFollowers').textContent = data.followers?.length || 0;
        document.getElementById('detailFollowing').textContent = data.following?.length || 0;
        document.getElementById('detailReputation').textContent = data.reputation || 0;
        document.getElementById('detailCreated').textContent = data.createdAt ? formatDate(data.createdAt) : '-';
        document.getElementById('detailUpdated').textContent = data.updatedAt ? formatDate(data.updatedAt) : '-';
        document.getElementById('detailBanned').textContent = data.rank === 'banned' ? '✅ Да' : '❌ Нет';
        
        openModal('userDetailModal');
    } catch (error) {
        showToast('Ошибка загрузки: ' + error.message, 'error');
    }
};

// ============================================
// БАН / РАЗБАН
// ============================================
window.banUser = async function(uid) {
    if (!confirm('Заблокировать этого пользователя?')) return;
    try {
        await updateDoc(doc(db, 'users', uid), { rank: 'banned' });
        showToast('✅ Пользователь заблокирован', 'success');
        loadData();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

window.unbanUser = async function(uid) {
    if (!confirm('Разблокировать этого пользователя?')) return;
    try {
        await updateDoc(doc(db, 'users', uid), { rank: 'player' });
        showToast('✅ Пользователь разблокирован', 'success');
        loadData();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

window.banUserFromDetail = function() {
    if (currentDetailUid) {
        closeModal('userDetailModal');
        banUser(currentDetailUid);
    }
};

window.unbanUserFromDetail = function() {
    if (currentDetailUid) {
        closeModal('userDetailModal');
        unbanUser(currentDetailUid);
    }
};

// ============================================
// ИЗМЕНЕНИЕ РАНГА
// ============================================
window.changeRankFromDetail = function() {
    if (!currentDetailUid) return;
    const newRank = prompt('Введите новый ранг (player, leader, moderator, admin, owner, banned):');
    if (!newRank) return;
    
    const validRanks = ['player', 'leader', 'moderator', 'admin', 'owner', 'banned'];
    if (!validRanks.includes(newRank)) {
        showToast('Некорректный ранг', 'error');
        return;
    }
    
    updateDoc(doc(db, 'users', currentDetailUid), { rank: newRank })
        .then(() => {
            showToast('✅ Ранг изменён', 'success');
            closeModal('userDetailModal');
            loadData();
        })
        .catch(error => showToast('Ошибка: ' + error.message, 'error'));
};

// ============================================
// ЭКСПОРТ CSV
// ============================================
window.exportData = function() {
    if (allUsers.length === 0) {
        showToast('Нет данных для экспорта', 'error');
        return;
    }
    
    // Заголовки
    let csv = 'ID,Ник,Email,Ранг,Тем,Постов,Подписчиков,Репутация,Дата регистрации\n';
    
    allUsers.forEach(user => {
        csv += `${user.id},${user.username || ''},${user.email || ''},${user.rank || 'player'},${user.threadsCount || 0},${user.postsCount || 0},${user.followers?.length || 0},${user.reputation || 0},${user.createdAt ? formatDate(user.createdAt) : ''}\n`;
    });
    
    // Скачиваем
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ CSV скачан', 'success');
};

// ============================================
// ОЧИСТКА ВСЕХ
// ============================================
window.confirmClearAll = function() {
    if (!confirm('⚠️ УДАЛИТЬ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ? Это необратимо!')) return;
    if (!confirm('Вы уверены? Введите "ДА" для подтверждения')) return;
    if (prompt('Введите "УДАЛИТЬ ВСЕХ" для подтверждения') !== 'УДАЛИТЬ ВСЕХ') return;
    
    // Здесь логика удаления всех пользователей (осторожно!)
    showToast('Эта функция требует дополнительной настройки', 'warning');
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function getRankName(rank) {
    const names = {
        owner: 'Владелец',
        admin: 'Администратор',
        moderator: 'Модератор',
        leader: 'Лидер',
        player: 'Игрок',
        banned: 'Заблокирован'
    };
    return names[rank] || 'Игрок';
}

function getRankClass(rank) {
    const classes = {
        owner: 'rank-owner',
        admin: 'rank-admin',
        moderator: 'rank-moderator',
        leader: 'rank-leader',
        player: 'rank-player',
        banned: 'rank-banned'
    };
    return classes[rank] || 'rank-player';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return '-';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) {
        alert(message);
        return;
    }
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
}

console.log('👑 Админ-панель загружена!');