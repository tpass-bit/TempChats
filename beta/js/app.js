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
const roomInfoSection = document.getElementById('roomInfoSection');

// Create Delete Room button
const deleteRoomBtn = document.createElement('button');
deleteRoomBtn.textContent = "Delete Room";
deleteRoomBtn.className = "btn danger hidden";
document.querySelector('.header-actions').appendChild(deleteRoomBtn);

// App state
let chatId = '';
let userId = '';
let chatRef;
let messagesRef;
let usersRef;
let settingsRef;
let isHost = false;
let countdownInterval;
let chatSettings = {
    expireTime: 24,
    maxUsers: 100, // Changed from 2 to 100 as requested
    waitForRejoin: true
};

// Firebase presence
let connectedRef = firebase.database().ref(".info/connected");

// Init
function init() {
    userId = generateId();
    setupEventListeners();

    // Auto join via ?chat= param
    const params = new URLSearchParams(window.location.search);
    if (params.get('chat')) {
        chatIdInput.value = params.get('chat');
        joinChat();
    }
}

function setupEventListeners() {
    createChatBtn.addEventListener('click', createNewChat);
    joinChatBtn.addEventListener('click', joinChat);
    leaveChatBtn.addEventListener('click', leaveChat);
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    copyChatIdBtn.addEventListener('click', copyChatId);
    refreshBtn.addEventListener('click', refreshChat);
    shareBtn.addEventListener('click', showShareModal);
    closeShareBtn.addEventListener('click', () => shareModal.classList.add('hidden'));
    copyShareBtn.addEventListener('click', copyShareLink);
    copyDirectShareBtn.addEventListener('click', copyDirectShareLink);
    closeNowBtn.addEventListener('click', closeChatNow);
    settingsBtn.addEventListener('click', showSettingsModal);
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    saveSettingsBtn.addEventListener('click', saveSettings);

    deleteRoomBtn.addEventListener('click', () => {
        if (isHost && confirm("Are you sure you want to delete this chat room?")) {
            chatRef.remove();
            leaveChat();
        }
    });

    window.addEventListener('beforeunload', () => {
        if (isHost && chatRef) {
            chatRef.child('hostOffline').set(Date.now());
        }
    });
}

function createNewChat() {
    chatId = generateId();
    isHost = true;
    deleteRoomBtn.classList.remove('hidden');
    setupChat();
}

function joinChat() {
    if (!chatIdInput.value.trim()) return alert("Enter a chat ID");
    chatId = chatIdInput.value.trim();
    isHost = false;
    deleteRoomBtn.classList.add('hidden');
    setupChat();
}

function setupChat() {
    chatRef = database.ref(`chats/${chatId}`);
    messagesRef = chatRef.child('messages');
    usersRef = chatRef.child('users');
    settingsRef = chatRef.child('settings');

    // Show room info section
    roomInfoSection.classList.remove('hidden');

    chatRef.once('value').then(snap => {
        if (snap.exists()) {
            chatSettings = snap.child('settings').val() || chatSettings;
            
            // Ensure minimum 2 users and maximum 100 users
            chatSettings.maxUsers = Math.max(2, Math.min(100, chatSettings.maxUsers));
            
            checkUserLimitAndJoin();
            
            // Check if host is offline
            if (snap.child('hostOffline').exists()) {
                sendSystemMessage("The host has left the chat. This room will expire soon.");
            }
        } else if (isHost) {
            // Set default settings with min 2 and max 100 users
            chatSettings.maxUsers = 100;
            settingsRef.set(chatSettings);
            joinChatAsUser();
        } else {
            alert("Chat does not exist!");
        }
    });

    settingsRef.on('value', snap => {
        if (snap.exists()) {
            chatSettings = snap.val();
            // Ensure min 2 and max 100 users
            chatSettings.maxUsers = Math.max(2, Math.min(100, chatSettings.maxUsers));
            updateSettingsUI();
        }
    });
}

function checkUserLimitAndJoin() {
    usersRef.once('value').then(snap => {
        const users = snap.val() || {};
        if (Object.keys(users).length >= chatSettings.maxUsers) {
            alert("This chat is full (maximum " + chatSettings.maxUsers + " users)");
            return;
        }
        joinChatAsUser();
    });
}

function joinChatAsUser() {
    const userRef = usersRef.child(userId);

    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            userRef.set({ online: true, joinedAt: Date.now() });
            userRef.onDisconnect().remove();

            sendSystemMessage(`${userId} joined the chat`);

            usersRef.on('value', (snapshot) => {
                const users = snapshot.val() || {};
                infoParticipants.textContent = Object.keys(users).length;

                // Show when user joins
                if (Object.keys(users).length > 1) {
                    sendSystemMessage(`${userId} has joined the chat`);
                }

                if (isHost && Object.keys(users).length === 1) {
                    startSessionExpiration();
                }

                if (!isHost && Object.keys(users).length > 0 && !users[Object.keys(users)[0]].online) {
                    sendSystemMessage("The host has gone offline. This room will expire soon.");
                    startSessionExpiration();
                }
            });
        }
    });

    messagesRef.on('child_added', (snap) => {
        displayMessage(snap.val());
        scrollToBottom();
    });

    statusText.textContent = "Connected";
    statusText.previousElementSibling.className = "fas fa-circle connected";

    infoChatId.textContent = chatId;
    infoUserId.textContent = userId;
    displayChatId.textContent = chatId;

    const shareLink = `${window.location.origin}${window.location.pathname}?chat=${chatId}`;
    shareLinkInput.value = shareLink;
    directShareInput.value = shareLink;

    // Fix share link functionality
    new QRCode(document.getElementById('qrCodeCanvas'), {
        text: shareLink,
        width: 150,
        height: 150
    });

    showChatScreen();
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    messagesRef.push({
        id: generateId(),
        text,
        sender: userId,
        timestamp: Date.now(),
        system: false
    });
    messageInput.value = '';
}

function sendSystemMessage(text) {
    messagesRef.push({
        id: generateId(),
        text,
        sender: "system",
        timestamp: Date.now(),
        system: true
    });
}

function displayMessage(msg) {
    const el = document.createElement('div');
    el.className = `message ${msg.sender === userId ? 'sent' : (msg.system ? 'system' : 'received')}`;
    el.innerHTML = `
        <div class="message-content">${escapeHtml(msg.text)}</div>
        <div class="message-time">${formatTime(msg.timestamp)}</div>
    `;
    chatMessages.appendChild(el);
}

function startSessionExpiration() {
    sessionExpiring.classList.remove('hidden');
    let sec = 10;
    countdown.textContent = sec;
    countdownInterval = setInterval(() => {
        sec--;
        countdown.textContent = sec;
        if (sec <= 0) {
            clearInterval(countdownInterval);
            closeChatNow();
        }
    }, 1000);
}

function closeChatNow() {
    clearInterval(countdownInterval);
    if (isHost) chatRef.remove();
    leaveChat();
}

function leaveChat() {
    if (usersRef) usersRef.child(userId).remove();
    if (messagesRef) messagesRef.off();
    if (usersRef) usersRef.off();
    if (settingsRef) settingsRef.off();
    if (chatRef) chatRef.off();
    clearInterval(countdownInterval);
    sendSystemMessage(`${userId} left the chat`);
    showWelcomeScreen();
}

function updateSettingsUI() {
    expireTimeSelect.value = chatSettings.expireTime;
    maxUsersInput.value = Math.max(2, Math.min(100, chatSettings.maxUsers)); // Ensure min 2 and max 100
    waitForRejoinCheckbox.checked = chatSettings.waitForRejoin;
}

function saveSettings() {
    const newMaxUsers = Math.max(2, Math.min(100, parseInt(maxUsersInput.value))); // Ensure min 2 and max 100
    const newSettings = {
        expireTime: parseInt(expireTimeSelect.value),
        maxUsers: newMaxUsers,
        waitForRejoin: waitForRejoinCheckbox.checked
    };
    settingsRef.set(newSettings);
    settingsModal.classList.add('hidden');
}

function refreshChat() {
    chatMessages.innerHTML = '';
    messagesRef.once('value').then(snap => {
        snap.forEach(c => displayMessage(c.val()));
        scrollToBottom();
    });
}

// UI helpers
function showChatScreen() {
    welcomeScreen.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    roomInfoSection.classList.remove('hidden'); // Show room info
}
function showWelcomeScreen() {
    welcomeScreen.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    roomInfoSection.classList.add('hidden'); // Hide room info
    sessionExpiring.classList.add('hidden');
    chatIdInput.value = '';
}
function copyChatId() { 
    navigator.clipboard.writeText(chatId).then(() => {
        alert("Chat ID copied to clipboard!");
    });
}
function copyShareLink() { 
    navigator.clipboard.writeText(shareLinkInput.value).then(() => {
        alert("Share link copied to clipboard!");
    });
}
function copyDirectShareLink() { 
    navigator.clipboard.writeText(directShareInput.value).then(() => {
        alert("Direct share link copied to clipboard!");
    });
}

// Utils
function generateId() { return Math.random().toString(36).substr(2, 9); }
function formatTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }

init();

