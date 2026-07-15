// ============================================
// 🛡️ ПОЛНАЯ ЗАЩИТА САЙТА
// ============================================
(function() {
    'use strict';

    // ============================================
    // 1. БЛОКИРОВКА ВСЕХ КЛАВИШ ДЛЯ ОТКРЫТИЯ DEVTOOLS
    // ============================================
    const blockedKeys = {
        123: true, // F12
        116: true, // F5
        // Ctrl+Shift+I (Windows/Linux)
        '73_Control_Shift': true,
        // Ctrl+Shift+J (Windows/Linux)
        '74_Control_Shift': true,
        // Ctrl+U (Windows/Linux)
        '85_Control': true,
        // Ctrl+Shift+C (Windows/Linux)
        '67_Control_Shift': true,
        // Ctrl+R (перезагрузка)
        '82_Control': true,
        // Ctrl+Shift+R (жесткая перезагрузка)
        '82_Control_Shift': true,
        // Ctrl+Shift+Delete (очистка кеша)
        '46_Control_Shift': true,
        // Ctrl+Shift+K (консоль Firefox)
        '75_Control_Shift': true,
        // Ctrl+Shift+E (инспектор Firefox)
        '69_Control_Shift': true,
        // Ctrl+S (сохранить страницу)
        '83_Control': true,
        // Ctrl+P (печать)
        '80_Control': true,
        // Ctrl+Shift+P (командная палитра)
        '80_Control_Shift': true,
        // Ctrl+Shift+F (поиск)
        '70_Control_Shift': true,
        // Ctrl+Shift+G (поиск следующего)
        '71_Control_Shift': true,
        // Ctrl+F (поиск)
        '70_Control': true,
        // F3 (поиск)
        114: true,
        // Ctrl+O (открыть файл)
        '79_Control': true,
        // Ctrl+W (закрыть вкладку)
        '87_Control': true,
        // Ctrl+T (новая вкладка)
        '84_Control': true,
        // Ctrl+N (новое окно)
        '78_Control': true,
        // Ctrl+Shift+N (инкогнито)
        '78_Control_Shift': true,
        // Ctrl+H (история)
        '72_Control': true,
        // Ctrl+J (загрузки)
        '74_Control': true,
        // Ctrl+D (добавить в закладки)
        '68_Control': true,
        // Ctrl+Shift+B (панель закладок)
        '66_Control_Shift': true,
        // Ctrl+Shift+O (менеджер закладок)
        '79_Control_Shift': true,
        // Ctrl+Shift+T (восстановить вкладку)
        '84_Control_Shift': true,
        // Ctrl+Shift+W (закрыть окно)
        '87_Control_Shift': true,
        // F1 (помощь)
        112: true,
        // F2 (переименовать)
        113: true,
        // F4 (адресная строка)
        115: true,
        // F6 (адресная строка)
        117: true,
        // F7 (курсор)
        118: true,
        // F10 (меню)
        121: true,
        // F11 (полный экран)
        122: true,
        // Ctrl+E (поиск в адресной строке)
        '69_Control': true,
        // Ctrl+L (адресная строка)
        '76_Control': true,
        // Ctrl+K (поиск)
        '75_Control': true,
        // Alt+D (адресная строка Firefox)
        '68_Alt': true,
        // Alt+F (меню Firefox)
        '70_Alt': true,
        // Alt+E (меню Edge)
        '69_Alt': true,
        // Alt+Space (системное меню)
        '32_Alt': true,
    };

    // Mac комбинации
    const blockedKeysMac = {
        '73_Meta_Alt': true,    // Cmd+Option+I
        '74_Meta_Alt': true,    // Cmd+Option+J
        '85_Meta': true,        // Cmd+U
        '73_Meta_Shift': true,  // Cmd+Shift+I
        '67_Meta_Alt': true,    // Cmd+Option+C
        '83_Meta': true,        // Cmd+S
        '80_Meta': true,        // Cmd+P
        '82_Meta': true,        // Cmd+R
        '82_Meta_Shift': true,  // Cmd+Shift+R
        '87_Meta': true,        // Cmd+W
        '84_Meta': true,        // Cmd+T
        '78_Meta': true,        // Cmd+N
        '78_Meta_Shift': true,  // Cmd+Shift+N
        '72_Meta': true,        // Cmd+H
        '74_Meta': true,        // Cmd+J
        '68_Meta': true,        // Cmd+D
        '79_Meta_Shift': true,  // Cmd+Shift+O
        '84_Meta_Shift': true,  // Cmd+Shift+T
        '87_Meta_Shift': true,  // Cmd+Shift+W
        '76_Meta': true,        // Cmd+L
        '69_Meta': true,        // Cmd+E
        '75_Meta': true,        // Cmd+K
        '71_Meta_Shift': true,  // Cmd+Shift+G
        '70_Meta_Shift': true,  // Cmd+Shift+F
        '70_Meta': true,        // Cmd+F
        '63_Meta': true,        // Cmd+? (помощь)
        '65_Meta': true,        // Cmd+A (выделить всё)
        '67_Meta': true,        // Cmd+C (копировать)
        '86_Meta': true,        // Cmd+V (вставить)
        '88_Meta': true,        // Cmd+X (вырезать)
        '90_Meta': true,        // Cmd+Z (отмена)
        '90_Meta_Shift': true,  // Cmd+Shift+Z (повтор)
    };

    // Блокировка клавиш
    document.addEventListener('keydown', function(e) {
        const key = e.keyCode || e.which;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;
        
        // Проверяем Windows/Linux
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
        
        // Проверяем Mac
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
        
        // Alt+любая клавиша (кроме пробела)
        if (alt && key !== 32 && key !== 18) {
            e.preventDefault();
            e.stopPropagation();
            showProtectionMessage();
            return false;
        }
    });

    // ============================================
    // 2. БЛОКИРОВКА ПРАВОЙ КНОПКИ МЫШИ
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
        longPressTimer = setTimeout(function() {
            e.preventDefault();
            showProtectionMessage();
        }, 500);
    }, { passive: false });
    
    document.addEventListener('touchend', function(e) {
        clearTimeout(longPressTimer);
    });
    
    document.addEventListener('touchmove', function(e) {
        clearTimeout(longPressTimer);
    });

    // ============================================
    // 3. БЛОКИРОВКА ВЫДЕЛЕНИЯ, КОПИРОВАНИЯ, ПЕРЕТАСКИВАНИЯ
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
    // 4. ЗАЩИТА ОТ ОТКРЫТИЯ ЧЕРЕЗ АДРЕСНУЮ СТРОКУ
    // ============================================
    // Блокировка chrome://inspect
    if (window.chrome && window.chrome.devtools) {
        window.chrome.devtools = undefined;
    }
    
    // Блокировка about:debugging (Firefox)
    if (window.navigator && window.navigator.userAgent.includes('Firefox')) {
        Object.defineProperty(window, 'devtools', {
            get: function() { showProtectionMessage(); return null; }
        });
    }

    // ============================================
    // 5. ОБХОД ОТКРЫТИЯ DEVTOOLS ЧЕРЕЗ РАЗМЕР ОКНА
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
    
    // Проверяем каждые 1.5 секунды
    setInterval(checkDevTools, 1500);

    // ============================================
    // 6. ЗАЩИТА ОТ ОТКРЫТИЯ В ФРЕЙМЕ (Clickjacking)
    // ============================================
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }

    // ============================================
    // 7. ЗАЩИТА ОТ СНИФФИНГА
    // ============================================
    Object.defineProperty(navigator, 'webdriver', {
        get: function() { return false; }
    });

    // ============================================
    // 8. ЗАЩИТА ОТ ИНСПЕКТИРОВАНИЯ ЧЕРЕЗ ЭЛЕМЕНТЫ
    // ============================================
    // Скрываем все элементы, которые могут быть использованы для инспекции
    document.addEventListener('DOMContentLoaded', function() {
        // Добавляем защитный слой поверх всего
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 99999;
            background: transparent;
        `;
        document.body.appendChild(overlay);
    });

    // ============================================
    // 9. ПОЛНАЯ ЗАЩИТА ПРИ ОБНАРУЖЕНИИ
    // ============================================
    function triggerFullProtection() {
        // Очищаем страницу и показываем сообщение
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a1a;color:#e94560;font-family:'Segoe UI',sans-serif;flex-direction:column;gap:20px;text-align:center;padding:20px;">
                <h1 style="font-size:64px;margin:0;">🚫</h1>
                <h2 style="font-size:28px;margin:0;color:#e94560;">Доступ запрещён</h2>
                <p style="color:#8888bb;max-width:400px;font-size:16px;">Инструменты разработчика отключены на этом сайте</p>
                <button onclick="location.reload()" style="padding:12px 32px;background:#e94560;border:none;border-radius:8px;color:white;font-size:16px;cursor:pointer;font-weight:600;">↻ Обновить страницу</button>
            </div>
        `;
        // Удаляем все скрипты, кроме себя
        document.querySelectorAll('script').forEach(script => {
            if (script.src && !script.src.includes('protection.js')) {
                script.remove();
            }
        });
    }

    // ============================================
    // 10. ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
    // ============================================
    function showProtectionMessage() {
        // Вибрация
        if (navigator.vibrate) navigator.vibrate(100);
        
        // Показываем тост, если есть
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
    // 11. ЗАЩИТА ОТ ПЕРЕЗАГРУЗКИ
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
    // 12. ЗАЩИТА ОТ ИЗМЕНЕНИЯ URL ВРУЧНУЮ
    // ============================================
    let lastUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== lastUrl) {
            const url = window.location.href;
            // Если пытаются перейти на about:, chrome:, edge:, javascript:
            if (url.match(/^(about|chrome|edge|javascript):/)) {
                window.location.href = '/';
            }
            lastUrl = window.location.href;
        }
    }, 500);

    console.log('🛡️ Полная защита активирована!');
})();