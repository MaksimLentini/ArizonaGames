// ============================================
// ФУНКЦИИ ДЛЯ СТРАНИЦ (Rules, Help, Contact, Privacy)
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
            subtitle: 'Основные правила поведения на форуме Arizona RP',
            sections: [
                {
                    title: '1. Уважение к участникам',
                    content: 'Относитесь с уважением ко всем участникам сообщества. Запрещены: оскорбления, угрозы, дискриминация, травля и любое другое неуважительное поведение.'
                },
                {
                    title: '2. Запрещенный контент',
                    content: 'Запрещена публикация: порнографического контента, материалов, пропагандирующих насилие или экстремизм, спама, рекламы без разрешения администрации.'
                },
                {
                    title: '3. Правила общения',
                    content: '• Общайтесь на русском языке в основных разделах\n• Используйте понятные заголовки для тем\n• Не создавайте дублирующиеся темы\n• Не флудите и не офтопьте'
                },
                {
                    title: '4. Нарушения и наказания',
                    content: 'За нарушение правил предусмотрены: предупреждение, временный бан или перманентная блокировка аккаунта.'
                }
            ]
        },
        help: {
            title: '❓ Помощь',
            subtitle: 'Часто задаваемые вопросы и руководства',
            sections: [
                {
                    title: 'Как зарегистрироваться?',
                    content: 'Нажмите на кнопку "Регистрация" в правом верхнем углу, заполните форму с указанием имени пользователя, email и пароля. После регистрации вы сможете создавать темы и отвечать на сообщения.'
                },
                {
                    title: 'Как создать тему?',
                    content: 'Чтобы создать тему, вам нужно получить права администратора (пароль 1267). После этого в админ-панели выберите раздел, введите название и содержание темы.'
                },
                {
                    title: 'Как получить права администратора?',
                    content: 'Нажмите на кнопку "Админ" и введите пароль 1267. После этого вы сможете создавать разделы и темы, а также удалять темы.'
                },
                {
                    title: 'Что делать, если я забыл пароль?',
                    content: 'Напишите администратору через раздел "Контакты" для восстановления доступа.'
                }
            ]
        },
        contact: {
            title: '📞 Контакты',
            subtitle: 'Свяжитесь с администрацией форума',
            contacts: [
                { icon: '📧', label: 'Email', value: 'support@arizona-rp.com' },
                { icon: '💬', label: 'Discord', value: 'discord.gg/arizona-rp' },
                { icon: '📱', label: 'Telegram', value: '@arizona_rp_support' },
                { icon: '🌐', label: 'Веб-сайт', value: 'https://arizona-rp.com' }
            ],
            info: 'Обращайтесь по любым вопросам. Мы отвечаем в течение 24 часов.'
        },
        privacy: {
            title: '🔒 Политика конфиденциальности',
            subtitle: 'Как мы обрабатываем ваши данные',
            sections: [
                {
                    title: 'Какие данные мы собираем',
                    content: 'При регистрации мы собираем: имя пользователя, email и пароль. Также мы собираем данные о вашей активности на форуме (темы, сообщения, просмотры).'
                },
                {
                    title: 'Как мы используем данные',
                    content: 'Ваши данные используются для: авторизации на форуме, отображения вашего профиля, улучшения работы сервиса, связи с вами по вопросам поддержки.'
                },
                {
                    title: 'Передача данных третьим лицам',
                    content: 'Мы не передаем ваши данные третьим лицам, за исключением случаев, предусмотренных законодательством РФ.'
                },
                {
                    title: 'Безопасность данных',
                    content: 'Мы используем Firebase для хранения данных. Все данные защищены шифрованием. Пароли хранятся в зашифрованном виде.'
                },
                {
                    title: 'Ваши права',
                    content: 'Вы имеете право: запросить копию ваших данных, изменить или удалить их, отозвать согласие на обработку данных.'
                }
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
        if (pageData.info) {
            html += `<p style="color:var(--text-muted);margin-top:16px;">${pageData.info}</p>`;
        }
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
// ОБНОВЛЕНИЕ СТАТИСТИКИ (ДЛЯ СТРАНИЦ)
// ============================================

// Обновляем онлайн статус
setInterval(() => {
    const online = document.getElementById('heroOnline');
    if (online) {
        online.textContent = Math.floor(Math.random() * 30) + 5;
    }
}, 10000);

// ============================================
// ОБНОВЛЕНИЕ В РЕАЛЬНОМ ВРЕМЕНИ
// ============================================

window.refreshForum = function() {
    showToast('Обновление...', 'success');
    renderCategories();
};

// Слушаем изменения в реальном времени
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

console.log('🚀 Arizona RP Форум загружен!');