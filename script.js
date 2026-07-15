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
        showToast('Please fill all fields', 'error');
        return;
    }

    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
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
        showToast('Account created successfully!', 'success');
        
        document.getElementById('regUsername').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regPasswordConfirm').value = '';
        
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Email already in use', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Password is too weak', 'error');
        } else {
            showToast('Registration failed: ' + error.message, 'error');
        }
    }
};

window.loginUser = async function() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('loginModal');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        showToast('Welcome back!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') {
            showToast('User not found', 'error');
        } else if (error.code === 'auth/wrong-password') {
            showToast('Invalid password', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email format', 'error');
        } else {
            showToast('Login failed: ' + error.message, 'error');
        }
    }
};

window.logoutUser = async function() {
    try {
        await signOut(auth);
        showToast('Logged out successfully', 'warning');
    } catch (error) {
        console.error('Logout error:', error);
    }
};

// ============================================
// ADMIN FUNCTIONS
// ============================================
window.verifyAdminAccess = async function() {
    const password = document.getElementById('adminPassword').value.trim();
    const btn = document.querySelector('#adminModal .admin-verify .btn-admin');
    const label = document.getElementById('adminVerifyLabel');
    const originalText = label.textContent;

    if (password === '1267') {
        if (currentUser) {
            label.textContent = 'Verifying...';
            btn.disabled = true;

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
                showToast('Admin privileges granted!', 'success');
                label.textContent = '✓ Granted';
                setTimeout(() => {
                    label.textContent = originalText;
                    btn.disabled = false;
                }, 2000);
            } catch (error) {
                showToast('Error: ' + error.message, 'error');
                label.textContent = originalText;
                btn.disabled = false;
            }
        }
    } else {
        showToast('Invalid admin code', 'error');
        label.textContent = '✗ Invalid';
        setTimeout(() => {
            label.textContent = originalText;
        }, 2000);
    }
};

// ============================================
// CATEGORY FUNCTIONS
// ============================================
window.addCategory = async function() {
    if (!isAdmin) {
        showToast('Admin privileges required', 'error');
        return;
    }

    const name = document.getElementById('newCategoryName').value.trim();
    const description = document.getElementById('newCategoryDesc').value.trim();

    if (!name) {
        showToast('Please enter category name', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'categories'), {
            name: name,
            description: description || 'No description',
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
        });

        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryDesc').value = '';
        showToast('Category created successfully!', 'success');
        renderCategories();
        updateAdminCategorySelect();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
};

// ============================================
// THREAD FUNCTIONS
// ============================================
window.addThread = async function() {
    if (!currentUser) {
        showToast('Please sign in first', 'error');
        return;
    }

    const categoryId = document.getElementById('adminCategorySelect').value;
    const title = document.getElementById('newThreadTitle').value.trim();
    const content = document.getElementById('newThreadContent').value.trim();

    if (!title || !content) {
        showToast('Please fill all fields', 'error');
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
        showToast('Topic created successfully!', 'success');
        renderCategories();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
};

window.deleteThread = async function(threadId) {
    if (!isAdmin) {
        showToast('Admin privileges required', 'error');
        return;
    }

    if (!confirm('Delete this topic and all replies?')) return;

    try {
        await deleteDoc(doc(db, 'threads', threadId));
        const postsQuery = query(collection(db, 'posts'), where('threadId', '==', threadId));
        const postsSnapshot = await getDocs(postsQuery);
        const deletePromises = postsSnapshot.docs.map(d => deleteDoc(doc(db, 'posts', d.id)));
        await Promise.all(deletePromises);
        showToast('Topic deleted', 'warning');
        renderCategories();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
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
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading categories...</p></div>';

    try {
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({ id: doc.id, ...doc.data() });
        });

        counter.textContent = `${categories.length} categories`;

        if (categories.length === 0) {
            container.innerHTML = `
                <div class="forum-category">
                    <div class="empty-state">
                        <span class="empty-icon">📋</span>
                        <p>No categories created yet</p>
                        ${isAdmin ? '<p style="color: var(--primary-light); font-size: 13px;">Use admin panel to create categories</p>' : ''}
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
                        <span class="category-meta">${categoryThreads.length} topics</span>
                    </div>
                    <div class="category-desc">${category.description || 'No description'}</div>
                    ${categoryThreads.length === 0 ? 
                        `<div class="empty-state" style="padding:16px 0;font-size:14px;">No topics in this category</div>` :
                        `<ul class="topic-list">
                            ${categoryThreads.map(thread => `
                                <li class="topic-item" onclick="openThread('${thread.id}')">
                                    <div class="topic-info">
                                        <h5>${thread.title}</h5>
                                        <div class="topic-meta">
                                            <span>By ${thread.author}</span>
                                            <span>${formatDate(thread.createdAt)}</span>
                                            <span>Views ${thread.views || 0}</span>
                                            <span>Replies ${thread.replies || 0}</span>
                                        </div>
                                    </div>
                                    <div class="topic-actions">
                                        ${isAdmin ? `
                                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteThread('${thread.id}')">Delete</button>
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
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>Error loading data</p></div>`;
    }
}

window.openThread = async function(threadId) {
    currentThreadId = threadId;
    const container = document.getElementById('threadContainer');
    const threadView = document.getElementById('threadView');
    const categoriesView = document.getElementById('categoriesView');

    categoriesView.style.display = 'none';
    threadView.style.display = 'block';
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading topic...</p></div>';

    try {
        const threadDoc = await getDoc(doc(db, 'threads', threadId));
        if (!threadDoc.exists()) {
            showToast('Topic not found', 'error');
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
                    <span>Author: ${thread.author}</span>
                    <span>${formatDate(thread.createdAt)}</span>
                    <span>Views: ${(thread.views || 0) + 1}</span>
                    <span>Replies: ${posts.length}</span>
                </div>
                <div class="thread-body">${thread.content}</div>
            </div>
            
            <div class="posts-header">
                <h3>Replies</h3>
                <span class="posts-count">${posts.length} posts</span>
            </div>
            
            <div id="postsContainer">
                ${posts.length === 0 ? 
                    '<div class="empty-state"><span class="empty-icon">💬</span><p>No replies yet</p></div>' :
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
                    <h4>Write a reply</h4>
                    <textarea id="newPostContent" placeholder="Enter your reply..."></textarea>
                    <button class="btn btn-primary" onclick="addPost('${threadId}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/></svg>
                        Send Reply
                    </button>
                </div>
            ` : `
                <div style="margin-top:20px;padding:20px;background:var(--dark-card);border-radius:var(--radius);text-align:center;border:1px solid var(--border);">
                    <p style="color:var(--text-muted);">Sign in to reply to this topic</p>
                </div>
            `}
        `;
    } catch (error) {
        console.error('Open thread error:', error);
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>Error loading topic</p></div>`;
    }
};

window.addPost = async function(threadId) {
    const content = document.getElementById('newPostContent').value.trim();
    if (!content) {
        showToast('Please enter your reply', 'error');
        return;
    }

    if (!currentUser) {
        showToast('Please sign in first', 'error');
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
        showToast('Reply sent!', 'success');
        openThread(threadId);
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
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
    if (!dateStr) return 'Unknown';
    try {
        const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
               ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'Unknown';
    }
}

window.showToast = function(message, type = 'success') {
    const toast = document.getElementById('toast');
    const indicator = document.getElementById('toastIndicator');
    const title = document.getElementById('toastTitle');
    const msg = document.getElementById('toastMessage');

    const config = {
        success: { title: 'Success', color: 'var(--success)' },
        error: { title: 'Error', color: 'var(--danger)' },
        warning: { title: 'Warning', color: 'var(--warning)' }
    };

    const c = config[type] || config.success;
    title.textContent = c.title;
    msg.textContent = message;
    indicator.style.background = c.color;

    toast.className = `toast show ${type}`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
};

window.closeToast = function() {
    document.getElementById('toast').classList.remove('show');
};

window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Hide';
    } else {
        input.type = 'password';
        btn.textContent = 'Show';
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
// REAL-TIME UPDATES
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

console.log('Arizona RP Forum initialized');