// DOM elements
const welcomeScreen = document.getElementById('welcomeScreen');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const createChatBtn = document.getElementById('createChatBtn');
const joinChatBtn = document.getElementById('joinChatBtn');
const chatIdInput = document.getElementById('chatIdInput');
const leaveChatBtn = document.getElementById('leaveChatBtn');
const displayChatId = document.getElementById('displayChatId');
const copyChatIdBtn = document.getElementById('copyChatIdBtn');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');
const shareBtn = document.getElementById('shareBtn');
const settingsBtn = document.getElementById('settingsBtn');
const infoModal = document.getElementById('infoModal');
const closeInfoBtn = document.getElementById('closeInfoBtn');
const infoChatId = document.getElementById('infoChatId');
const infoUserId = document.getElementById('infoUserId');
const infoParticipants = document.getElementById('infoParticipants');
const shareLinkInput = document.getElementById('shareLinkInput');
const copyShareBtn = document.getElementById('copyShareBtn');
const shareModal = document.getElementById('shareModal');
const closeShareBtn = document.getElementById('closeShareBtn');
const directShareInput = document.getElementById('directShareInput');
const copyDirectShareBtn = document.getElementById('copyDirectShareBtn');
const sessionExpiring = document.getElementById('sessionExpiring');
const countdown = document.getElementById('countdown');
const closeNowBtn = document.getElementById('closeNowBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const expireTimeSelect = document.getElementById('expireTimeSelect');
const maxUsersInput = document.getElementById('maxUsersInput');
const waitForRejoinCheckbox = document.getElementById('waitForRejoinCheckbox');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Add Delete Room button for host
const deleteRoomBtn = document.createElement('button');
deleteRoomBtn.textContent = "Delete Room";
deleteRoomBtn.className = "btn danger";
document.querySelector('.settings-actions').appendChild(deleteRoomBtn);

// App state
let chatId = '';
let userId = '';
let chatRef;
let messagesRef;
let usersRef;
let settingsRef;
let isHost = false;
let countdownInterval;
let hostCheckTimer;
let chatSettings = {
    expireTime: 24,
    maxUsers: 2,
    waitForRejoin: true
};

// Initialize app
function init() {
    userId = generateId();
    setupEventListeners();

    // Auto join if ?chat= in URL
    const urlParams = new URLSearchParams(window.location.search);
    const chatParam = urlParams.get('chat');
    if (chatParam) {
        chatIdInput.value = chatParam;
        joinChat();
    }
}

// Event listeners
function setupEventListeners() {
    createChatBtn.addEventListener('click', createNewChat);
    joinChatBtn.addEventListener('click', joinChat);
    leaveChatBtn.addEventListener('click', leaveChat);
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    copyChatIdBtn.addEventListener('click', copyChatId);
    refreshBtn.addEventListener('click', refreshChat);
    shareBtn.addEventListener('click', showShareModal);
    settingsBtn.addEventListener('click', showSettingsModal);
    closeInfoBtn.addEventListener('click', () => infoModal.classList.add('hidden'));
    copyShareBtn.addEventListener('click', copyShareLink);
    closeShareBtn.addEventListener('click', () => shareModal.classList.add('hidden'));
    copyDirectShareBtn.addEventListener('click', copyDirectShareLink);
    closeNowBtn.addEventListener('click', closeChatNow);
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    saveSettingsBtn.addEventListener('click', saveSettings);

    deleteRoomBtn.addEventListener('click', () => {
        if (isHost) {
            if (confirm("Delete this chat room permanently?")) {
                chatRef.remove();
                leaveChat();
            }
        }
    });

    window.addEventListener('beforeunload', handleHostTabClose);
}

// Create chat
function createNewChat() {
    chatId = generateId();
    isHost = true;
    setupChat();
}

// Join chat
function joinChat() {
    const inputId = chatIdInput.value.trim();
    if (!inputId) {
        alert('Please enter a chat ID');
        return;
    }
    chatId = inputId;
    isHost = false;
    setupChat();
}

// Setup chat
function setupChat() {
    chatRef = database.ref(`chats/${chatId}`);
    messagesRef = chatRef.child('messages');
    usersRef = chatRef.child('users');
    settingsRef = chatRef.child('settings');

    chatRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
            if (snapshot.child('settings').exists()) {
                chatSettings = snapshot.child('settings').val();
                updateSettingsUI();
            }
            checkUserLimitAndJoin();
        } else {
            if (isHost) {
                settingsRef.set(chatSettings);
                joinChatAsUser();
            } else {
                alert('Chat does not exist');
            }
        }
    });

    settingsRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            chatSettings = snapshot.val();
            updateSettingsUI();
        }
    });
}

// Check user limit
function checkUserLimitAndJoin() {
    usersRef.once('value').then((snapshot) => {
        const users = snapshot.val() || {};
        if (Object.keys(users).length >= chatSettings.maxUsers) {
            alert('This chat is full');
            return;
        }
        joinChatAsUser();
    });
}

// Join as user
function joinChatAsUser() {
    const userRef = usersRef.child(userId);
    userRef.set(true);
    userRef.onDisconnect().remove();

    usersRef.on('value', (snapshot) => {
        const users = snapshot.val() || {};
        infoParticipants.textContent = Object.keys(users).length;

        showChatScreen();

        if (!isHost && !Object.keys(users).includes(Object.keys(users)[0])) {
            startHostCheck();
        }
    });

    messagesRef.on('child_added', (snapshot) => {
        displayMessage(snapshot.val());
        scrollToBottom();
    });

    statusText.textContent = 'Connected';
    statusText.previousElementSibling.className = 'fas fa-circle connected';

    infoChatId.textContent = chatId;
    infoUserId.textContent = userId;
    displayChatId.textContent = chatId;

    const shareLink = `${window.location.origin}${window.location.pathname}?chat=${chatId}`;
    shareLinkInput.value = shareLink;
    directShareInput.value = shareLink;

    new QRCode(document.getElementById('qrCodeCanvas'), {
        text: shareLink,
        width: 150,
        height: 150,
        colorDark: "#000",
        colorLight: "#fff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

// Update settings UI
function updateSettingsUI() {
    expireTimeSelect.value = chatSettings.expireTime;
    maxUsersInput.value = Math.max(2, chatSettings.maxUsers);
    waitForRejoinCheckbox.checked = chatSettings.waitForRejoin;
}

// Save settings
function saveSettings() {
    const newMaxUsers = Math.max(2, parseInt(maxUsersInput.value));
    const newSettings = {
        expireTime: parseInt(expireTimeSelect.value),
        maxUsers: newMaxUsers,
        waitForRejoin: waitForRejoinCheckbox.checked
    };
    settingsRef.set(newSettings).then(() => {
        chatSettings = newSettings;
        settingsModal.classList.add('hidden');
    });
}

// Host tab close detection
function handleHostTabClose() {
    if (isHost) chatRef.child('hostOffline').set(Date.now());
}

// Start host check for participants
function startHostCheck() {
    if (hostCheckTimer) return;
    hostCheckTimer = setTimeout(() => {
        sessionExpiring.classList.remove('hidden');
        let seconds = 10;
        countdown.textContent = seconds;

        countdownInterval = setInterval(() => {
            seconds--;
            countdown.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(countdownInterval);
                chatRef.remove();
                leaveChat();
            }
        }, 1000);
    }, 5000);
}

// Send message
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    messagesRef.push({
        id: generateId(),
        text,
        sender: userId,
        timestamp: Date.now()
    });
    messageInput.value = '';
}

// Display message
function displayMessage(msg) {
    const el = document.createElement('div');
    el.className = `message ${msg.sender === userId ? 'sent' : 'received'}`;
    el.innerHTML = `
        <div class="message-content">${escapeHtml(msg.text)}</div>
        <div class="message-time">${formatTime(msg.timestamp)}</div>
    `;
    chatMessages.appendChild(el);
}

// Leave chat
function leaveChat() {
    if (usersRef) usersRef.child(userId).remove();
    if (messagesRef) messagesRef.off();
    if (usersRef) usersRef.off();
    if (settingsRef) settingsRef.off();
    if (chatRef) chatRef.off();

    clearInterval(countdownInterval);
    clearTimeout(hostCheckTimer);

    showWelcomeScreen();
}

// Refresh messages
function refreshChat() {
    chatMessages.innerHTML = '';
    messagesRef.once('value').then((snapshot) => {
        snapshot.forEach((child) => displayMessage(child.val()));
        scrollToBottom();
    });
}

// UI helpers
function showChatScreen() {
    welcomeScreen.classList.add('hidden');
    chatContainer.classList.remove('hidden');
}
function showWelcomeScreen() {
    welcomeScreen.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    sessionExpiring.classList.add('hidden');
    chatIdInput.value = '';
}
function copyChatId() {
    navigator.clipboard.writeText(chatId);
    showTooltip(copyChatIdBtn, 'Copied!');
}
function copyShareLink() {
    navigator.clipboard.writeText(shareLinkInput.value);
    showTooltip(copyShareBtn, 'Copied!');
}
function copyDirectShareLink() {
    navigator.clipboard.writeText(directShareInput.value);
    showTooltip(copyDirectShareBtn, 'Copied!');
}
function showShareModal() {
    shareModal.classList.remove('hidden');
}
function closeChatNow() {
    clearInterval(countdownInterval);
    if (isHost) chatRef.remove();
    leaveChat();
}

// Utilities
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}
function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function showTooltip(el, text) {
    const t = document.createElement('div');
    t.className = 'tooltip';
    t.textContent = text;
    el.appendChild(t);
    setTimeout(() => t.remove(), 1000);
}

init();
