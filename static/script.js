//Функция принудительной остановки загрузки
console.log("Проверка остановки");
let stoploadstatus = false
if (stoploadstatus) {
    console.warn("Управляемая остановка загрузки");
    error.innerHTML = 'Создание ошибки'
}
console.log("Остановки нет");
let loader = document.querySelector('.loader');
if (loader) {
    setTimeout(function () {
        loader.style.animation = '1.3s closeLoader forwards';
    }, 1000);
}
console.log("Инициализация объектов...");
let chatList = document.querySelector('.chat_list');
let chat_header = document.querySelector('.chat_header');
let form = document.querySelector('form');
let msg_list = document.querySelector('.chat-container');
let chatArea = document.querySelector('.chat_area');
let chatName = document.querySelector('.chatName');
let chatId = document.querySelector('.chatId');
var chat_list = [];
var userID = localStorage.getItem('userID');
var savedChatId = localStorage.getItem('currentChatId');
var user_name = '';
let chatUpdateInterval = null;
let currentChatId = null;
let lastMessagesHash = '';
let retryCount = 0;
const maxRetries = 3;
let modal = null;
let usersSelection = null;
let createChatForm = null;
let messagesCache = [];
console.log("Инициализация объектов завершена");
console.log("Проверка авторизации...");
if (userID == null) {
    window.location = '/'
} else {
    console.log("User ID:", userID);
}
console.log("Проверка авторизации завершена");
console.log("Загрузка функций...");
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(endpoint, options);
        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        return { success: false, error: 'Ошибка сети' };
    }
}

// Функция для получения JSON данных напрямую (для обратной совместимости)
async function getJsonValue(path = '') {
    try {
        const response = await fetch('static/memory.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!path) return data;
        const value = path.split('.').reduce((obj, key) => obj?.[key], data);
        return value !== undefined ? value : null;
    } catch (error) {
        console.error('Error loading JSON:', error);
        return null;
    }
}
function generateChatId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Функция для отправки сообщения через AJAX
async function sendMessage(event) {
    event.preventDefault();

    if (!currentChatId) {
        alert('Выберите чат для отправки сообщения');
        return;
    }

    // Проверяем, может ли пользователь отправлять сообщения в этом чате
    const canSend = await canUserSendMessage(currentChatId, userID, user_name);
    if (!canSend) {
        alert('У вас нет прав для отправки сообщений в этом чате');
        return;
    }

    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();

    if (!messageText) {
        alert('Введите текст сообщения');
        return;
    }

    // Блокируем форму на время отправки
    messageInput.disabled = true;
    const sendButton = document.getElementById('send-button');
    let originalButtonHTML = '';

    if (sendButton) {
        originalButtonHTML = sendButton.innerHTML;
        sendButton.disabled = true;
        sendButton.innerHTML = '<span style="font-size: 14px;">Отправка...</span>';
    }

    try {
        const result = await apiRequest('/api/send_message', 'POST', {
            chat_id: currentChatId,
            user_id: userID,
            text: messageText
        });

        if (result.success) {
            setTimeout(function () {
                messageInput.value = '';
                messageInput.focus()
            }, 10);


            // Создаем объект сообщения для добавления в UI
            const newMessage = {
                id: result.message_id,
                sender: result.sender || user_name,
                text: result.text || messageText,
                timestamp: result.timestamp
            };

            // Добавляем сообщение в UI
            addMessageToUI(newMessage);

            // Добавляем в кэш
            if (Array.isArray(messagesCache)) {
                messagesCache.push(newMessage);
                lastMessagesHash = JSON.stringify(messagesCache.map(msg => msg.id));
            }

            // Фокус на поле ввода
            messageInput.focus();
        } else {
            alert('Ошибка при отправке сообщения: ' + result.error);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось отправить сообщение. Проверьте подключение к интернету.');
    } finally {
        // Разблокируем форму
        messageInput.disabled = false;
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.innerHTML = originalButtonHTML;
        }
    }
}
// Функция для добавления сообщения в UI
function addMessageToUI(message) {
    if (!msg_list) return;

    const isMyMessage = message.sender === user_name;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${isMyMessage ? 'my-message' : ''}`;
    messageElement.dataset.id = message.id;
    messageElement.dataset.timestamp = message.timestamp;

    // Экранируем текст для безопасности
    const safeText = escapeHtml(message.text);

    // Добавляем кнопку копирования
    const copyBtnHTML = `<img src='static/img/copy.png' class="copy_btn" onclick="copyMessageText('${escapeSingleQuotes(message.text)}')" title="Копировать">`;

    messageElement.innerHTML = `
        <div class='up'>
            <div class="message-text">${safeText}</div>
            <div class="message-info">${escapeHtml(message.sender)} • ${formatTime(message.timestamp)}</div>
        </div>
        ${copyBtnHTML}
    `;

    msg_list.appendChild(messageElement);

    // Прокручиваем вниз
    setTimeout(() => {
        msg_list.scrollTop = msg_list.scrollHeight;
    }, 50);
}
console.log("Загрузка функций завершена");
// Функции для экранирования HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeSingleQuotes(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
console.log("Настройка копирования...");
// Функция для копирования текста сообщения
function copyMessageText(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Анимация подтверждения копирования
        const copyBtns = document.querySelectorAll('.copy_btn');
        copyBtns.forEach(btn => {
            if (btn.parentElement.querySelector('.message-text')?.textContent === text) {
                btn.style.animation = 'done 1.5s';
                setTimeout(() => {
                    btn.style.animation = 'none';
                }, 1500);
            }
        });
    }).catch(err => {
        console.error('Ошибка при копировании:', err);
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (e) {
            console.error('Fallback copy failed:', e);
        }
        document.body.removeChild(textArea);
    });
}

console.log("Настройка копирования завершена");
// Функция для проверки, доступен ли чат для пользователя
async function isChatAvailableForUser(chatId, userId) {
    const data = await getJsonValue();
    if (!data?.Chats) return false;

    const chat = data.Chats[chatId];
    if (!chat) return false;

    const rules = chat.Rules || {};

    // Проверяем правило EveryoneShouldBeInChat
    if (rules.EveryoneShouldBeInChat === "1") {
        return true; // Чат доступен всем пользователям
    }

    // Иначе проверяем, есть ли пользователь в списке участников
    return chat.PeoplesNames && chat.PeoplesNames.includes(userId);
}

// Функция для проверки, может ли пользователь отправлять сообщения
async function canUserSendMessage(chatId, userId, userName) {
    const data = await getJsonValue();
    if (!data?.Chats) return false;

    const chat = data.Chats[chatId];
    if (!chat) return false;

    const rules = chat.Rules || {};

    // Проверяем правило AllPeopleCanSandMsg
    if (rules.AllPeopleCanSandMsg === "1") {
        return true; // Все могут отправлять сообщения
    }

    // Проверяем правило TrueChat
    if (rules.TrueChat === "1") {
        // В настоящем чате сообщения могут отправлять только участники
        return chat.PeoplesNames && chat.PeoplesNames.includes(userId);
    }

    // По умолчанию - могут отправлять только участники чата
    return chat.PeoplesNames && chat.PeoplesNames.includes(userId);
}

// Функция для проверки правил чата
async function getChatRules(chatId) {
    const data = await getJsonValue();
    if (!data?.Chats) return null;

    const chat = data.Chats[chatId];
    if (!chat) return null;

    return chat.Rules || {};
}
console.log("Загрузка функций создания чатов...");
// Модальное окно создания чата
async function openCreateChatModal() {
    chatList.style.display = 'none';
    chatArea.style.display = 'flex';
    form.style.visibility = 'hidden';
    chatName.textContent = 'Создать новый чат';
    chatId.textContent = '';

    msg_list.innerHTML = `
        <div id="createChatModal" class="modal">
            <div class="modal-content">
                <form id="createChatForm">
                    <h3>Создать новый чат</h3>
                    <input type="text" id="chatName" name="chatName" placeholder="Название чата" required>
                    
                    <div class="rules-section">
                        <h4>Правила чата:</h4>
                        <label class="rule-option">
                            <input type="checkbox" id="ruleTrueChat" name="ruleTrueChat" checked>
                            <span>Настоящий чат (TrueChat) - только участники могут видеть и отправлять сообщения</span>
                        </label>
                        <label class="rule-option">
                            <input type="checkbox" id="ruleEveryoneInChat" name="ruleEveryoneInChat">
                            <span>Доступен всем (EveryoneShouldBeInChat) - чат видят все пользователи</span>
                        </label>
                        <label class="rule-option">
                            <input type="checkbox" id="ruleAllCanSend" name="ruleAllCanSend">
                            <span>Все могут отправлять сообщения (AllPeopleCanSandMsg) - даже не участники</span>
                        </label>
                    </div>
                    
                    <label>Участники чата:</label>
                    <div class="users-selection" id="usersSelection">
                        <div class="loading-small">Загрузка пользователей...</div>
                    </div>
                    
                    <div class="modal-buttons">
                        <button type="button" class="close-btn" onclick="closeCreateChatModal()">Отмена</button>
                        <button type="submit" class="submit-btn">Создать чат</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    modal = document.getElementById('createChatModal');
    usersSelection = document.getElementById('usersSelection');
    createChatForm = document.getElementById('createChatForm');

    await loadAllUsers();
    modal.style.display = 'flex';
    createChatForm.onsubmit = handleCreateChat;
}
async function loadAllUsers() {
    try {
        const data = await getJsonValue();
        const accounts = data?.accounts || {};

        if (Object.keys(accounts).length === 0) {
            usersSelection.innerHTML = '<div class="error">Нет доступных пользователей</div>';
            return;
        }

        usersSelection.innerHTML = '';

        // Добавляем текущего пользователя (только для отображения)
        const currentUser = Object.values(accounts).find(user => user.ID === userID);
        if (currentUser) {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-option current-user';
            userDiv.innerHTML = `
                <span class="user-label">
                    ${escapeHtml(currentUser.Name)} (Вы)
                </span>
            `;
            usersSelection.appendChild(userDiv);
        }

        // Добавляем других пользователей
        Object.values(accounts).forEach(user => {
            if (user.ID !== userID) {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-option';
                userDiv.innerHTML = `
                    <input type="checkbox" id="user_${user.ID}" name="users" value="${user.ID}">
                    <label class="user-label" for="user_${user.ID}">
                        ${escapeHtml(user.Name)}
                    </label>
                `;
                usersSelection.appendChild(userDiv);
            }
        });
    } catch (error) {
        console.error('Ошибка при загрузке пользователей:', error);
        usersSelection.innerHTML = '<div class="error">Ошибка загрузки пользователей</div>';
    }
}

async function handleCreateChat(event) {
    event.preventDefault();

    const chatNameInput = document.getElementById('chatName');
    const chatName = chatNameInput.value.trim();

    if (!chatName) {
        alert('Введите название чата');
        chatNameInput.focus();
        return;
    }

    // Получаем правила чата
    const ruleTrueChat = document.getElementById('ruleTrueChat').checked ? "1" : "0";
    const ruleEveryoneInChat = document.getElementById('ruleEveryoneInChat').checked ? "1" : "0";
    const ruleAllCanSend = document.getElementById('ruleAllCanSend').checked ? "1" : "0";

    const selectedUsers = [];
    const checkboxes = usersSelection.querySelectorAll('input[type="checkbox"]:checked');

    checkboxes.forEach(checkbox => {
        selectedUsers.push(checkbox.value);
    });

    // Добавляем текущего пользователя в список участников
    selectedUsers.push(userID);

    const chatId = generateChatId();

    try {
        const result = await apiRequest('/create_chat', 'POST', {
            chat_id: chatId,
            chat_name: chatName,
            users: selectedUsers,
            rules: {
                TrueChat: ruleTrueChat,
                EveryoneShouldBeInChat: ruleEveryoneInChat,
                AllPeopleCanSandMsg: ruleAllCanSend
            }
        });

        if (result.success) {
            closeCreateChatModal();
            // Обновляем список чатов
            await loadUserChats();
            // Открываем созданный чат
            setTimeout(() => openChat(chatId), 300);
        } else {
            alert('Ошибка при создании чата: ' + result.error);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось создать чат. Проверьте подключение к интернету.');
    }
}

function closeCreateChatModal() {
    if (modal) {
        modal.style.display = 'none';
    }
    // Возвращаемся к списку чатов
    closechat();
}

// Закрытие модального окна при клике вне его
window.addEventListener('click', function (event) {
    if (modal && event.target === modal) {
        closeCreateChatModal();
    }
});

// Загрузка при загрузке страницы
document.addEventListener('DOMContentLoaded', async function () {
    // Получаем имя пользователя
    const data = await getJsonValue();
    if (data?.accounts) {
        Object.values(data.accounts).forEach(account => {
            if (account.ID === userID) {
                user_name = account.Name;
                // Обновляем отображение имени
                const loginNameEl = document.querySelector('.login_name');
                if (loginNameEl) {
                    loginNameEl.textContent = `Вход выполнен: ${user_name}`;
                }
            }
        });
    }

    // Загружаем чаты пользователя
    await loadUserChats();
});
console.log("Загрузка функций завершена");
// Загрузка чатов пользователя
async function loadUserChats() {
    try {
        const result = await apiRequest(`/api/get_chats?user_id=${userID}`);

        if (result.success) {
            displayChats(result.chats);
        } else {
            // Fallback: загружаем из JSON файла
            await loadChatsFromJSON();
        }
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
        await loadChatsFromJSON();
    }
}
console.log("Отображение чатов пользователя...");
// Отображение списка чатов
function displayChats(chats) {
    const chatListContainer = document.querySelector('.chat_list');
    console.log('Вход выполнен:',user_name);
    const headerHTML = `
    <div style='display:flex;'>
    <h2>ChatApp</h2>
    <button class="create-btn" onclick="openCreateChatModal()">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="272727">
            <path d="M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z"/>
        </svg>
    </button></div>
    `;

    chatListContainer.innerHTML = headerHTML;

    // Добавляем информацию о правилах чата в отображение

    chats.forEach(async chat => {
        const chatElement = document.createElement('div');
        chatElement.className = 'chat';
        chatElement.onclick = () => openChat(chat.id);
        chatElement.innerHTML = `
            <div class="chat-info">
                <p class="name">${escapeHtml(chat.name)}</p>
                <p class="id">USER:${((await apiRequest(`/api/get_messages/${chat.id}`)).messages?.at(-1)?.text || '').substring(0, 50) + (((await apiRequest(`/api/get_messages/${chat.id}`)).messages?.at(-1)?.text || '').length > 50 ? '...' : '')}</p>
            </div>
        `;
        chatListContainer.appendChild(chatElement);
    });
    console.log("Загрузка чатов завершена");

}
console.log("Подготовка на загрузку сообщений...");

// Fallback: загрузка чатов из JSON
async function loadChatsFromJSON() {
    const data = await getJsonValue();
    if (!data?.accounts) return;

    const accounts = data.accounts;
    const allChats = data.Chats || {};

    // Получаем чаты, доступные пользователю
    const availableChats = [];

    // Сначала добавляем чаты из списка пользователя
    Object.values(accounts).forEach(account => {
        if (account.ID === userID) {
            const userChats = account.AvaliableChatsID || [];
            userChats.forEach(chatId => {
                if (allChats[chatId] && !availableChats.includes(chatId)) {
                    availableChats.push(chatId);
                }
            });
        }
    });

    // Добавляем публичные чаты (EveryoneShouldBeInChat = 1)
    Object.entries(allChats).forEach(([chatId, chat]) => {
        const rules = chat.Rules || {};
        if (rules.EveryoneShouldBeInChat === "1" && !availableChats.includes(chatId)) {
            availableChats.push(chatId);
        }
    });

    if (availableChats.length === 0) {
        displayChats([]);
        return;
    }

    const chats = availableChats.map(chatId => {
        const chat = allChats[chatId];
        if (!chat) return null;

        return {
            id: chatId,
            name: chat.ChatName || `Чат ${chatId}`,
            last_message_time: getLastMessageTimeFromChat(chat),
            rules: chat.Rules || {}
        };
    }).filter(chat => chat !== null);

    chats.sort((a, b) => b.last_message_time - a.last_message_time);

    displayChats(chats);
}
console.log("Подготовка на загрузку сообщений завершена");

function getLastMessageTimeFromChat(chat) {
    const msgs = chat.Msgs || {};
    const timestamps = Object.values(msgs).map(msg => msg.timestamp || 0);
    return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}
console.log("Подготовка интерфейса для открытия чата...");

// Открытие чата
async function openChat(id) {
    // Проверяем, доступен ли чат для пользователя
    const isAvailable = await isChatAvailableForUser(id, userID);
    if (!isAvailable) {
        alert('Этот чат вам недоступен');
        return;
    }

    chatList.style.transform = 'translateX(-50px)';
    chatList.style.opacity = '0';

    setTimeout(() => {
        chatArea.style.display = 'flex';
        chatList.style.display = 'none';
        chatArea.style.transform = 'translateX(70px)';

        setTimeout(() => {
            chatArea.style.transform = 'translateX(0px)';
        }, 10);
    }, 200);

    currentChatId = id;
    chatId.textContent = `ID: ${currentChatId}`;

    // Устанавливаем ID чата в скрытое поле формы
    const chatIdInput = document.querySelector('.chat_id');
    if (chatIdInput) {
        chatIdInput.value = currentChatId;
    }

    localStorage.setItem('currentChatId', id);

    // Проверяем правила чата и настраиваем интерфейс
    const rules = await getChatRules(id);
    const canSend = await canUserSendMessage(id, userID, user_name);
    if (form) {
        if (canSend) {
            form.onsubmit = sendMessage;
            form.style.opacity = "1";
        } else {
            form.onsubmit = (e) => {
                e.preventDefault();
                alert('Вы не можете отправлять сообщения в этом чате');
            };
            form.style.opacity = "0.5";
        }
    }

    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.onkeypress = handleKeyPress;
        messageInput.disabled = !canSend;
        if (canSend) {
            messageInput.focus();
        } else {
            messageInput.placeholder = 'Вы не можете отправлять сообщения в этом чате';
        }
    }

    // Загружаем сообщения
    loadChatMessages(id, true);

    // Запускаем обновление чата
    if (chatUpdateInterval) {
        clearInterval(chatUpdateInterval);
    }

    chatUpdateInterval = setInterval(() => {
        if (currentChatId === id) {
            loadChatMessages(id, false);
        }
    }, 2000); // Обновляем каждые 2 секунды
}
console.log("Подготовка интерфейса для открытия чата завершена");
// Закрытие чата
console.log("Подготовка интерфейса для закрытия чата...");
function closechat() {
    setTimeout(() => {
        chatArea.style.display = 'none';
        chatList.style.transform = 'translateX(0px)';
        chatList.style.opacity = '1';
        chatList.style.display = 'flex';

        if (form) {
            form.onsubmit = null;
            form.style.opacity = "1";
        }

        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.onkeypress = null;
            messageInput.disabled = true;
            messageInput.value = '';
            messageInput.placeholder = 'Введите сообщение';
        }

        stopChatUpdates();
    }, 200);
}
console.log("Подготовка интерфейса для закрытия чата завершена");
// Обработка нажатия Enter
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage(event);
    }
}
console.log("Загрузка сообщений...");
// Загрузка сообщений чата
async function loadChatMessages(id, showLoading = true) {
    if (showLoading) {
        msg_list.innerHTML = '<div class="loading">Загрузка сообщений...</div>';
    }

    const form = document.querySelector('form');
    if (form) {
        form.style.visibility = "visible";
    }

    try {
        const result = await apiRequest(`/api/get_messages/${id}`);

        if (!result.success) {
            throw new Error(result.error || 'Не удалось получить сообщения');
        }

        retryCount = 0;
        const messages = result.messages || [];
        messagesCache = messages;

        const currentHash = JSON.stringify(messages.map(msg => msg.id));
        if (currentHash === lastMessagesHash && !showLoading) {
            return;
        }

        lastMessagesHash = currentHash;

        // Получаем название чата и правила
        const chatData = await getJsonValue(`Chats.${id}`);
        if (chatData) {
            if (chatData.ChatName) {
                chatName.innerHTML = escapeHtml(chatData.ChatName);
            }

            // Добавляем информацию о правилах в заголовок
            const rules = chatData.Rules || {};
            let rulesInfo = [];
            //if (rules.EveryoneShouldBeInChat === "1") rulesInfo.push("Публичный");
            //if (rules.AllPeopleCanSandMsg === "1") rulesInfo.push("Все могут писать");
            if (rules.TrueChat === "1") rulesInfo.push(`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="m382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z"/></svg>`);

            if (rulesInfo.length > 0) {
                chatName.innerHTML += ` <span class="chat-rules-badge">${rulesInfo}</span>`;
            }
        }

        msg_list.innerHTML = '';

        messages.forEach(message => {
            addMessageToUI(message);
        });

        setTimeout(() => {
            msg_list.scrollTop = msg_list.scrollHeight;
        }, 100);
    } catch (error) {
        console.error("Ошибка при получении чата:", error);

        if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Повторная попытка загрузки (${retryCount}/${maxRetries})...`);
            setTimeout(() => loadChatMessages(id, false), 2000);
        } else {
            msg_list.innerHTML = '<div class="error">Не удалось загрузить сообщения.</div>';
        }
    }
}
console.log("Загрузка сообщений завершена");
// Форматирование времени
console.log("Подготовка к форматированию времени...");
function formatTime(timestamp) {
    if (!timestamp || timestamp <= 0) return '';

    const date = new Date(timestamp * 1000);
    const now = new Date();

    // Проверяем, сегодня ли было сообщение
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    // Проверяем, вчера ли было сообщение
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
        return 'вчера ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    // Проверяем, было ли сообщение на этой неделе
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (date > weekAgo) {
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[date.getDay()] + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    // Для более старых сообщений показываем дату
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
console.log("Подготовка к форматированию времени завершена");
// Остановка обновления чата
function stopChatUpdates() {
    if (chatUpdateInterval) {
        clearInterval(chatUpdateInterval);
        chatUpdateInterval = null;
    }
    currentChatId = null;
}
console.log("Завершение загрузки приложения...");
setTimeout(function () {
    console.log("Приложение загружено!");
    console.log("----------Работа приложения---------------");
}, 100);
