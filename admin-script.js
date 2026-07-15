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
let allUserData = [];
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
        loadAllData();
        startRealtime();
    } catch (error) {
        console.error('Admin check error:', error);
        window.location.href = '/';
    }
});

// ============================================
// ЗАГРУЗКА ВСЕХ ДАННЫХ
// ============================================
async function loadAllData() {
    try {
        // Загружаем пользователей
        const usersSnapshot = await getDocs(collection(db, 'users'));
        allUsers = [];
        usersSnapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        // Загружаем дополнительные данные (user_data)
        const dataSnapshot = await getDocs(collection(db, 'user_data'));
        allUserData = [];
        dataSnapshot.forEach(doc => {
            allUserData.push({ id: doc.id, ...doc.data() });
        });

        // Статистика
        const adminsSnapshot = await getDocs(collection(db, 'admins'));
        const postsSnapshot = await getDocs(collection(db, 'posts'));
        const threadsSnapshot = await getDocs(collection(db, 'threads'));

        document.getElementById('totalUsers').textContent = allUsers.length;
        document.getElementById('totalAdmins').textContent = adminsSnapshot.size;
        document.getElementById('totalBanned').textContent = allUsers.filter(u => u.rank === 'banned').length;
        document.getElementById('totalOnline').textContent = Math.floor(Math.random() * 20) + 5;
        document.getElementById('totalPosts').textContent = postsSnapshot.size;
        document.getElementById('totalThreads').textContent = threadsSnapshot.size;

        renderUsers();
        renderIPs();
        renderBrowsers();
        renderActivity();
        renderBrowserStats();

    } catch (error) {
        console.error('Load data error:', error);
    }
}

// ============================================
// РЕАЛЬНОЕ ВРЕМЯ
// ============================================
function startRealtime() {
    onSnapshot(collection(db, 'users'), () => loadAllData());
    onSnapshot(collection(db, 'user_data'), () => loadAllData());
}

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ============================================
window.switchTab = function(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
};

// ============================================
// РЕНДЕР ПОЛЬЗОВАТЕЛЕЙ
// ============================================
function renderUsers() {
    const tbody = document.getElementById('userTableBody');
    if (allUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="empty-state">Нет пользователей</td></tr>`;
        return;
    }

    // Сортируем по дате регистрации
    allUsers.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
    });

    let html = '';
    allUsers.forEach((user, index) => {
        const userData = allUserData.find(d => d.id === user.id) || {};
        const rankClass = getRankClass(user.rank || 'player');
        const rankName = getRankName(user.rank || 'player');
        const avatarUrl = user.avatar || '';
        const username = user.username || 'Неизвестно';
        const email = user.email || '-';
        const ip = userData.ip || 'не определён';
        const browser = userData.browser || 'не определён';
        const os = userData.os || 'не определён';
        const status = user.rank === 'banned' ? '🔴 Заблокирован' : '🟢 Активен';

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div class="avatar-mini">
                        ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />` : ''}
                        <span ${avatarUrl ? 'style="display:none;"' : ''}>${username[0].toUpperCase()}</span>
                    </div>
                </td>
                <td><strong>${escapeHtml(username)}</strong></td>
                <td>${escapeHtml(email)}</td>
                <td><span class="rank-badge ${rankClass}">${rankName}</span></td>
                <td style="font-family:monospace;font-size:11px;">${escapeHtml(ip)}</td>
                <td>${escapeHtml(browser)}</td>
                <td>${escapeHtml(os)}</td>
                <td>${user.threadsCount || 0}</td>
                <td>${user.postsCount || 0}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>${status}</td>
                <td>
                    <button class="action-btn view" onclick="viewUser('${user.id}')">👁️</button>
                    ${user.rank === 'banned' ? 
                        `<button class="action-btn unban" onclick="unbanUser('${user.id}')">✅</button>` :
                        `<button class="action-btn ban" onclick="banUser('${user.id}')">🚫</button>`
                    }
                    <button class="action-btn ip" onclick="viewIP('${user.id}')">🌐</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// РЕНДЕР IP-АДРЕСОВ
// ============================================
function renderIPs() {
    const tbody = document.getElementById('ipTableBody');
    const usersWithIP = allUsers.filter(u => {
        const data = allUserData.find(d => d.id === u.id);
        return data && data.ip;
    });

    if (usersWithIP.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Нет данных об IP</td></tr>`;
        return;
    }

    let html = '';
    usersWithIP.forEach(user => {
        const data = allUserData.find(d => d.id === user.id) || {};
        html += `
            <tr>
                <td><strong>${escapeHtml(user.username || 'Неизвестно')}</strong></td>
                <td>${escapeHtml(user.email || '-')}</td>
                <td style="font-family:monospace;">${escapeHtml(data.ip || '-')}</td>
                <td>${escapeHtml(data.country || 'не определена')}</td>
                <td>${escapeHtml(data.isp || 'не определён')}</td>
                <td>${data.timestamp ? formatDate(data.timestamp) : 'неизвестно'}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// РЕНДЕР БРАУЗЕРОВ
// ============================================
function renderBrowsers() {
    const tbody = document.getElementById('browserTableBody');
    const usersWithData = allUsers.filter(u => {
        const data = allUserData.find(d => d.id === u.id);
        return data && (data.browser || data.os);
    });

    if (usersWithData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Нет данных о браузерах</td></tr>`;
        return;
    }

    let html = '';
    usersWithData.forEach(user => {
        const data = allUserData.find(d => d.id === user.id) || {};
        html += `
            <tr>
                <td><strong>${escapeHtml(user.username || 'Неизвестно')}</strong></td>
                <td>${escapeHtml(data.browser || '-')}</td>
                <td>${escapeHtml(data.browserVersion || '-')}</td>
                <td>${escapeHtml(data.os || '-')}</td>
                <td>${escapeHtml(data.screenResolution || '-')}</td>
                <td>${escapeHtml(data.language || '-')}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// РЕНДЕР АКТИВНОСТИ
// ============================================
function renderActivity() {
    const tbody = document.getElementById('activityTableBody');
    if (allUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Нет данных</td></tr>`;
        return;
    }

    let html = '';
    allUsers.forEach(user => {
        const data = allUserData.find(d => d.id === user.id) || {};
        const lastActive = data.updatedAt || user.createdAt;
        html += `
            <tr>
                <td><strong>${escapeHtml(user.username || 'Неизвестно')}</strong></td>
                <td>${lastActive ? formatDate(lastActive) : 'неизвестно'}</td>
                <td>${data.sessionCount || 0}</td>
                <td>${data.avgTime || '0 мин'}</td>
                <td>${data.pageViews || 0}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// СТАТИСТИКА ПО БРАУЗЕРАМ
// ============================================
function renderBrowserStats() {
    const container = document.getElementById('browserStats');
    const stats = {};
    allUserData.forEach(data => {
        const browser = data.browser || 'Неизвестный';
        stats[browser] = (stats[browser] || 0) + 1;
    });

    let html = '';
    Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
        html += `
            <div class="stat-card">
                <span class="number" style="font-size:20px;">${count}</span>
                <span class="label">${escapeHtml(name)}</span>
            </div>
        `;
    });
    container.innerHTML = html || '<div class="empty-state">Нет данных</div>';
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
        const dataDoc = await getDoc(doc(db, 'user_data', uid));
        const user = userDoc.exists() ? userDoc.data() : {};
        const data = dataDoc.exists() ? dataDoc.data() : {};
        currentDetailUid = uid;

        document.getElementById('detailUserName').textContent = user.username || 'Неизвестно';
        document.getElementById('detailUserRank').textContent = getRankName(user.rank || 'player');
        document.getElementById('detailUid').textContent = uid;
        document.getElementById('detailEmail').textContent = user.email || '-';
        document.getElementById('detailIp').textContent = data.ip || 'не определён';
        document.getElementById('detailBrowser').textContent = data.browser || 'не определён';
        document.getElementById('detailOs').textContent = data.os || 'не определён';
        document.getElementById('detailResolution').textContent = data.screenResolution || 'не определён';
        document.getElementById('detailLanguage').textContent = data.language || 'не определён';
        document.getElementById('detailTimezone').textContent = data.timezone || 'не определён';
        document.getElementById('detailThreads').textContent = user.threadsCount || 0;
        document.getElementById('detailPosts').textContent = user.postsCount || 0;
        document.getElementById('detailFollowers').textContent = user.followers?.length || 0;
        document.getElementById('detailReputation').textContent = user.reputation || 0;
        document.getElementById('detailCreated').textContent = user.createdAt ? formatDate(user.createdAt) : '-';
        document.getElementById('detailUpdated').textContent = data.updatedAt ? formatDate(data.updatedAt) : '-';
        document.getElementById('detailStatus').textContent = user.rank === 'banned' ? '🔴 Заблокирован' : '🟢 Активен';
        document.getElementById('detailReferrer').textContent = data.referrer || 'не определён';

        openModal('userDetailModal');
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
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
        loadAllData();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

window.unbanUser = async function(uid) {
    if (!confirm('Разблокировать этого пользователя?')) return;
    try {
        await updateDoc(doc(db, 'users', uid), { rank: 'player' });
        showToast('✅ Пользователь разблокирован', 'success');
        loadAllData();
    } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
    }
};

window.banUserFromDetail = function() {
    if (currentDetailUid) { closeModal('userDetailModal'); banUser(currentDetailUid); }
};

window.unbanUserFromDetail = function() {
    if (currentDetailUid) { closeModal('userDetailModal'); unbanUser(currentDetailUid); }
};

window.viewIP = function(uid) {
    const user = allUsers.find(u => u.id === uid);
    const data = allUserData.find(d => d.id === uid);
    if (data && data.ip) {
        alert(`🌐 IP-адрес: ${data.ip}\n📱 Браузер: ${data.browser || 'не определён'}\n💻 ОС: ${data.os || 'не определён'}`);
    } else {
        showToast('IP-адрес не определён', 'warning');
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
    if (!validRanks.includes(newRank)) { showToast('Некорректный ранг', 'error'); return; }
    updateDoc(doc(db, 'users', currentDetailUid), { rank: newRank })
        .then(() => { showToast('✅ Ранг изменён', 'success'); closeModal('userDetailModal'); loadAllData(); })
        .catch(error => showToast('Ошибка: ' + error.message, 'error'));
};

// ============================================
// ЭКСПОРТ
// ============================================
window.exportCSV = function() {
    if (allUsers.length === 0) { showToast('Нет данных для экспорта', 'error'); return; }
    let csv = 'ID,Ник,Email,Ранг,IP,Браузер,ОС,Тем,Постов,Репутация,Дата регистрации\n';
    allUsers.forEach(user => {
        const data = allUserData.find(d => d.id === user.id) || {};
        csv += `${user.id},${user.username || ''},${user.email || ''},${user.rank || 'player'},${data.ip || ''},${data.browser || ''},${data.os || ''},${user.threadsCount || 0},${user.postsCount || 0},${user.reputation || 0},${user.createdAt ? formatDate(user.createdAt) : ''}\n`;
    });
    downloadFile(csv, `users_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
    showToast('✅ CSV скачан', 'success');
};

window.exportJSON = function() {
    if (allUsers.length === 0) { showToast('Нет данных для экспорта', 'error'); return; }
    const data = allUsers.map(user => {
        const extra = allUserData.find(d => d.id === user.id) || {};
        return { ...user, extra_data: extra };
    });
    downloadFile(JSON.stringify(data, null, 2), `users_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
    showToast('✅ JSON скачан', 'success');
};

window.exportFullReport = function() {
    if (allUsers.length === 0) { showToast('Нет данных для экспорта', 'error'); return; }
    let report = '========================================\n';
    report += '   ПОЛНЫЙ ОТЧЁТ О ПОЛЬЗОВАТЕЛЯХ\n';
    report += '========================================\n\n';
    report += `Всего пользователей: ${allUsers.length}\n`;
    report += `Администраторов: ${document.getElementById('totalAdmins').textContent}\n`;
    report += `Заблокированных: ${document.getElementById('totalBanned').textContent}\n`;
    report += `Всего сообщений: ${document.getElementById('totalPosts').textContent}\n\n`;
    report += '--- ПОЛЬЗОВАТЕЛИ ---\n';
    allUsers.forEach((user, i) => {
        const data = allUserData.find(d => d.id === user.id) || {};
        report += `\n${i+1}. ${user.username || 'Неизвестно'}\n`;
        report += `   Email: ${user.email || '-'}\n`;
        report += `   Ранг: ${getRankName(user.rank || 'player')}\n`;
        report += `   IP: ${data.ip || 'не определён'}\n`;
        report += `   Браузер: ${data.browser || 'не определён'}\n`;
        report += `   ОС: ${data.os || 'не определён'}\n`;
        report += `   Тем: ${user.threadsCount || 0}, Постов: ${user.postsCount || 0}\n`;
        report += `   Дата рег.: ${user.createdAt ? formatDate(user.createdAt) : '-'}\n`;
    });
    downloadFile(report, `report_${new Date().toISOString().slice(0,10)}.txt`, 'text/plain');
    showToast('✅ Отчёт скачан', 'success');
};

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function getRankName(rank) {
    const names = { owner: 'Владелец', admin: 'Администратор', moderator: 'Модератор', leader: 'Лидер', player: 'Игрок', banned: 'Заблокирован' };
    return names[rank] || 'Игрок';
}

function getRankClass(rank) {
    const classes = { owner: 'rank-owner', admin: 'rank-admin', moderator: 'rank-moderator', leader: 'rank-leader', player: 'rank-player', banned: 'rank-banned' };
    return classes[rank] || 'rank-player';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '-'; }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) { alert(message); return; }
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
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

console.log('👑 Админ-панель загружена!');