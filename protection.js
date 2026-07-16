// ============================================
// 🛡️ ПОЛНАЯ ЗАЩИТА САЙТА
// ============================================
(function() {
    'use strict';

    // ============================================
    // 1. ПОЛНАЯ БЛОКИРОВКА КОНСОЛИ
    // ============================================
    
    // Заменяем все методы console на пустышки
    const noop = function() {};
    const consoleMethods = [
        'log', 'warn', 'error', 'info', 'debug', 'trace', 
        'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd',
        'assert', 'count', 'clear', 'table', 'groupCollapsed',
        'profile', 'profileEnd'
    ];
    
    consoleMethods.forEach(method => {
        if (console[method]) {
            console[method] = noop;
        }
    });

    // ============================================
    // 2. БЛОКИРОВКА ИЗМЕНЕНИЯ ПЕРЕМЕННЫХ
    // ============================================
    
    // Блокируем isAdmin
    Object.defineProperty(window, 'isAdmin', {
        get: function() { 
            showProtectionMessage();
            return false; 
        },
        set: function() { 
            showProtectionMessage();
            return false; 
        },
        configurable: false,
        enumerable: true
    });

    // Блокируем currentUser
    Object.defineProperty(window, 'currentUser', {
        get: function() { 
            showProtectionMessage();
            return null; 
        },
        set: function() { 
            showProtectionMessage();
            return false; 
        },
        configurable: false,
        enumerable: true
    });

    // Блокируем firebase
    Object.defineProperty(window, 'firebase', {
        get: function() { 
            showProtectionMessage();
            return null; 
        },
        set: function() { 
            showProtectionMessage();
            return false; 
        },
        configurable: false,
        enumerable: true
    });

    // Блокируем auth
    Object.defineProperty(window, 'auth', {
        get: function() { 
            showProtectionMessage();
            return null; 
        },
        set: function() { 
            showProtectionMessage();
            return false; 
        },
        configurable: false,
        enumerable: true
    });

    // Блокируем db
    Object.defineProperty(window, 'db', {
        get: function() { 
            showProtectionMessage();
            return null; 
        },
        set: function() { 
            showProtectionMessage();
            return false; 
        },
        configurable: false,
        enumerable: true
    });

    // Блокируем userRank
    Object.defineProperty(window, 'userRank', {
        get: function() { 
            showProtectionMessage();
            return 'player'; 
        },
        set: function() { 
            showProtectionMessage();
            return false; 
        },
        configurable: false,
        enumerable: true
    });

    // ============================================
    // 3. БЛОКИРОВКА eval И Function
    // ============================================
    
    window.eval = function() {
        showProtectionMessage();
        return null;
    };
    
    window.Function = function() {
        showProtectionMessage();
        return null;
    };

    // ============================================
    // 4. БЛОКИРОВКА ВСЕХ КЛАВИШ ДЛЯ ОТКРЫТИЯ DEVTOOLS
    // ============================================
    
    const blockedKeys = {
        123: true, // F12
        116: true, // F5
        '73_Control_Shift': true, // Ctrl+Shift+I
        '74_Control_Shift': true, // Ctrl+Shift+J
        '85_Control': true, // Ctrl+U
        '67_Control_Shift': true, // Ctrl+Shift+C
        '82_Control': true, // Ctrl+R
        '82_Control_Shift': true, // Ctrl+Shift+R
        '46_Control_Shift': true, // Ctrl+Shift+Delete
        '75_Control_Shift': true, // Ctrl+Shift+K (Firefox)
        '69_Control_Shift': true, // Ctrl+Shift+E (Firefox)
        '83_Control': true, // Ctrl+S
        '80_Control': true, // Ctrl+P
        '70_Control_Shift': true, // Ctrl+Shift+F
        '71_Control_Shift': true, // Ctrl+Shift+G
        '70_Control': true, // Ctrl+F
        114: true, // F3
        '79_Control': true, // Ctrl+O
        '87_Control': true, // Ctrl+W
        '84_Control': true, // Ctrl+T
        '78_Control': true, // Ctrl+N
        '78_Control_Shift': true, // Ctrl+Shift+N
        '72_Control': true, // Ctrl+H
        '74_Control': true, // Ctrl+J
        '68_Control': true, // Ctrl+D
        '66_Control_Shift': true, // Ctrl+Shift+B
        '79_Control_Shift': true, // Ctrl+Shift+O
        '84_Control_Shift': true, // Ctrl+Shift+T
        '87_Control_Shift': true, // Ctrl+Shift+W
        112: true, // F1
        113: true, // F2
        115: true, // F4
        117: true, // F6
        118: true, // F7
        121: true, // F10
        122: true, // F11
        '69_Control': true, // Ctrl+E
        '76_Control': true, // Ctrl+L
        '75_Control': true, // Ctrl+K
        '68_Alt': true, // Alt+D (Firefox)
        '70_Alt': true, // Alt+F (Firefox)
        '69_Alt': true, // Alt+E (Edge)
        '32_Alt': true, // Alt+Space
    };

    // Mac комбинации
    const blockedKeysMac = {
        '73_Meta_Alt': true, // Cmd+Option+I
        '74_Meta_Alt': true, // Cmd+Option+J
        '85_Meta': true, // Cmd+U
        '73_Meta_Shift': true, // Cmd+Shift+I
        '67_Meta_Alt': true, // Cmd+Option+C
        '83_Meta': true, // Cmd+S
        '80_Meta': true, // Cmd+P
        '82_Meta': true, // Cmd+R
        '82_Meta_Shift': true, // Cmd+Shift+R
        '87_Meta': true, // Cmd+W
        '84_Meta': true, // Cmd+T
        '78_Meta': true, // Cmd+N
        '78_Meta_Shift': true, // Cmd+Shift+N
        '72_Meta': true, // Cmd+H
        '74_Meta': true, // Cmd+J
        '68_Meta': true, // Cmd+D
        '79_Meta_Shift': true, // Cmd+Shift+O
        '84_Meta_Shift': true, // Cmd+Shift+T
        '87_Meta_Shift': true, // Cmd+Shift+W
        '76_Meta': true, // Cmd+L
        '69_Meta': true, // Cmd+E
        '75_Meta': true, // Cmd+K
        '71_Meta_Shift': true, // Cmd+Shift+G
        '70_Meta_Shift': true, // Cmd+Shift+F
        '70_Meta': true, // Cmd+F
        '63_Meta': true, // Cmd+? (помощь)
        '65_Meta': true, // Cmd+A
        '67_Meta': true, // Cmd+C
        '86_Meta': true, // Cmd+V
        '88_Meta': true, // Cmd+X
        '90_Meta': true, // Cmd+Z
        '90_Meta_Shift': true, // Cmd+Shift+Z
    };

    document.addEventListener('keydown', function(e) {
        const key = e.keyCode || e.which || 0;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;

        // Проверка Windows/Linux
        let comboKey = key.toString();
        if (ctrl) comboKey += '_Control';
        if (shift) comboKey += '_Shift';
        if (alt) comboKey += '_Alt';

        if (blockedKeys[key] || blockedKeys[comboKey]) {
            e.preventDefault();
            e.stopPropagation();
            showProtectionMessage();
            return false;
        }

        // Проверка Mac
        let comboKeyMac = key.toString();
        if (e.metaKey) comboKeyMac += '_Meta';
        if (alt) comboKeyMac += '_Alt';
        if (shift) comboKeyMac += '_Shift';

        if (blockedKeysMac[comboKeyMac]) {
            e.preventDefault();
            e.stopPropagation();
            showProtectionMessage();
            return false;
        }

        // Дополнительно: Ctrl+Shift+цифра
        if (ctrl && shift && key >= 48 && key <= 57) {
            e.preventDefault();
            e.stopPropagation();
            showProtectionMessage();
            return false;
        }

        // Alt+любая клавиша (кроме пробела и Alt)
        if (alt && key !== 32 && key !== 18) {
            e.preventDefault();
            e.stopPropagation();
            showProtectionMessage();
            return false;
        }
    });

    // ============================================
    // 5. БЛОКИРОВКА ПРАВОЙ КНОПКИ МЫШИ
    // ============================================
    
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showProtectionMessage();
        return false;
    });

    // Блокировка долгого нажатия (мобильные)
    let longPressTimer = null;
    document.addEventListener('touchstart', function(e) {
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(function() {
            e.preventDefault();
            showProtectionMessage();
        }, 500);
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    document.addEventListener('touchmove', function(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    // ============================================
    // 6. БЛОКИРОВКА ВЫДЕЛЕНИЯ, КОПИРОВАНИЯ, ПЕРЕТАСКИВАНИЯ
    // ============================================
    
    document.addEventListener('selectstart', function(e) {
        e.preventDefault();
        return false;
    });

    document.addEventListener('copy', function(e) {
        e.preventDefault();
        showProtectionMessage();
        return false;
    });

    document.addEventListener('cut', function(e) {
        e.preventDefault();
        showProtectionMessage();
        return false;
    });

    document.addEventListener('paste', function(e) {
        e.preventDefault();
        showProtectionMessage();
        return false;
    });

    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
        return false;
    });

    document.addEventListener('drop', function(e) {
        e.preventDefault();
        return false;
    });

    // ============================================
    // 7. ЗАЩИТА ОТ ОТКРЫТИЯ В ФРЕЙМЕ (Clickjacking)
    // ============================================
    
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }

    // ============================================
    // 8. ЗАЩИТА ОТ СНИФФИНГА
    // ============================================
    
    Object.defineProperty(navigator, 'webdriver', {
        get: function() { return false; }
    });

    // ============================================
    // 9. ОБХОД ОТКРЫТИЯ DEVTOOLS ЧЕРЕЗ РАЗМЕР ОКНА
    // ============================================
    
    let devtoolsOpen = false;
    let protectionTriggered = false;

    const checkDevTools = function() {
        const widthThreshold = window.outerWidth - window.innerWidth > 160;
        const heightThreshold = window.outerHeight - window.innerHeight > 160;
        
        if (widthThreshold || heightThreshold) {
            if (!devtoolsOpen && !protectionTriggered) {
                devtoolsOpen = true;
                protectionTriggered = true;
                showProtectionMessage();
                triggerFullProtection();
            }
        } else {
            devtoolsOpen = false;
        }
    };
    
    setInterval(checkDevTools, 1500);

    // ============================================
    // 10. ПОЛНАЯ ЗАЩИТА ПРИ ОБНАРУЖЕНИИ
    // ============================================
    
    function triggerFullProtection() {
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a1a;color:#e94560;font-family:'Segoe UI',sans-serif;flex-direction:column;gap:20px;text-align:center;padding:20px;">
                <h1 style="font-size:64px;margin:0;">🚫</h1>
                <h2 style="font-size:28px;margin:0;color:#e94560;">Доступ запрещён</h2>
                <p style="color:#8888bb;max-width:400px;font-size:16px;">Инструменты разработчика отключены на этом сайте</p>
                <button onclick="location.reload()" style="padding:12px 32px;background:#e94560;border:none;border-radius:8px;color:white;font-size:16px;cursor:pointer;font-weight:600;">↻ Обновить страницу</button>
            </div>
        `;
        document.querySelectorAll('script').forEach(script => {
            if (script.src && !script.src.includes('protection.js')) {
                script.remove();
            }
        });
    }

    // ============================================
    // 11. ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
    // ============================================
    
    function showProtectionMessage() {
        if (navigator.vibrate) navigator.vibrate(100);
        
        const toast = document.getElementById('toast');
        if (toast) {
            const indicator = document.querySelector('.toast-indicator');
            const title = document.getElementById('toastTitle');
            const msg = document.getElementById('toastMessage');
            
            if (title) title.textContent = '🔒 Защита';
            if (msg) msg.textContent = 'Действие заблокировано';
            if (indicator) indicator.style.background = '#fdcb6e';
            
            toast.className = 'toast show warning';
            clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        }
    }

    // ============================================
    // 12. ЗАЩИТА ОТ ПЕРЕЗАГРУЗКИ
    // ============================================
    
    let reloadAttempts = 0;
    window.addEventListener('beforeunload', function(e) {
        reloadAttempts++;
        if (reloadAttempts > 3) {
            e.preventDefault();
            e.returnValue = 'Вы уверены, что хотите выйти?';
            return 'Вы уверены, что хотите выйти?';
        }
    });

    // ============================================
    // 13. ЗАЩИТА ОТ ИЗМЕНЕНИЯ URL ВРУЧНУЮ
    // ============================================
    
    let lastUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== lastUrl) {
            const url = window.location.href;
            if (url.match(/^(about|chrome|edge|javascript):/)) {
                window.location.href = '/';
            }
            lastUrl = window.location.href;
        }
    }, 500);

    // ============================================
    // 14. БЛОКИРОВКА ОТКРЫТИЯ ЧЕРЕЗ АДРЕСНУЮ СТРОКУ
    // ============================================
    
    if (window.chrome && window.chrome.devtools) {
        window.chrome.devtools = undefined;
    }
    
    if (window.navigator && window.navigator.userAgent.includes('Firefox')) {
        Object.defineProperty(window, 'devtools', {
            get: function() { showProtectionMessage(); return null; }
        });
    }

    // ============================================
    // 15. БЛОКИРОВКА import (динамические импорты)
    // ============================================
    
    window.import = function() {
        showProtectionMessage();
        return null;
    };

    console.log('🛡️ Полная защита активирована!');
})();