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
const userOfflineModal = document.getElementById('userOfflineModal');
const waitForRejoinBtn = document.getElementById('waitForRejoinBtn');
const closeChatNowBtn = document.getElementById('closeChatNowBtn');

// App state
let chatId = '';
let userId = '';
let chatRef;
let messagesRef;
let usersRef;
let settingsRef;
let isHost = false;
let expirationTimer;
let offlineTimer;
let countdownInterval;
let chatSettings = {
    expireTime: 24, // hours
    maxUsers: 2,
    waitForRejoin: true
};

// Initialize the app
function init() {
    userId = generateId();
    setupEventListeners();
    monitorConnectionStatus();
}

// Monitor Firebase connection status
function monitorConnectionStatus() {
    const connectedRef = database.ref(".info/connected");
    connectedRef.on("value", (snap) => {
        if (snap.val() === true) {
            statusText.textContent = "Online";
            statusText.previousElementSibling.className = "fas fa-circle connected";
        } else {
            statusText.textContent = "Offline";
            statusText.previousElementSibling.className = "fas fa-circle disconnected";
        }
    });
}

// Set up event listeners
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
    waitForRejoinBtn.addEventListener('click', waitForUserRejoin);
    closeChatNowBtn.addEventListener('click', closeChatNow);
}

// Create a new chat
function createNewChat() {
    chatId = generateId();
    isHost = true;
    setupChat();
}

// Join an existing chat
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

// Set up chat references and listeners
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
                return;
            }
        }
    });

    setupChatListeners();
    showChatScreen();
}

// Check user limit before joining
function checkUserLimitAndJoin() {
    usersRef.once('value').then((snapshot) => {
        const users = snapshot.val() || {};
        const userCount = Object.keys(users).length;
        if (userCount >= chatSettings.maxUsers) {
            alert('This chat has reached the maximum number of participants');
            return;
        }
        joinChatAsUser();
    });
}

// Join chat as a user
function joinChatAsUser() {
    const userRef = usersRef.child(userId);
    userRef.set(true);
    userRef.onDisconnect().remove();

    usersRef.on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const userCount = Object.keys(users).length;
        infoParticipants.textContent = userCount;

        if (isHost && userCount === 1 && Object.keys(users)[0] === userId) {
            // Grace period before showing "User Offline"
            setTimeout(() => {
                usersRef.once('value').then((latestSnapshot) => {
                    const latestUsers = latestSnapshot.val() || {};
                    const latestUserCount = Object.keys(latestUsers).length;

                    if (latestUserCount === 1 && Object.keys(latestUsers)[0] === userId) {
                        if (chatSettings.waitForRejoin) {
                            showUserOfflineModal();
                        } else {
                            startSessionExpiration();
                        }
                    }
                });
            }, 3000);
        }
    });

    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
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
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

// Chat listeners
function setupChatListeners() {
    settingsRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            chatSettings = snapshot.val();
            updateSettingsUI();
        }
    });
}

function updateSettingsUI() {
    expireTimeSelect.value = chatSettings.expireTime;
    maxUsersInput.value = chatSettings.maxUsers;
    waitForRejoinCheckbox.checked = chatSettings.waitForRejoin;
}

// User offline modal
function showUserOfflineModal() {
    userOfflineModal.classList.remove('hidden');
    let seconds = 10;
    waitForRejoinBtn.textContent = `Wait (${seconds} seconds)`;
    offlineTimer = setInterval(() => {
        seconds--;
        waitForRejoinBtn.textContent = `Wait (${seconds} seconds)`;
        if (seconds <= 0) {
            clearInterval(offlineTimer);
            userOfflineModal.classList.add('hidden');
            startSessionExpiration();
        }
    }, 1000);
}

function waitForUserRejoin() {
    clearInterval(offlineTimer);
    userOfflineModal.classList.add('hidden');
}

// Session expiration
function startSessionExpiration() {
    sessionExpiring.classList.remove('hidden');
    let seconds = 10;
    countdown.textContent = seconds;
    countdownInterval = setInterval(() => {
        seconds--;
        countdown.textContent = seconds;
        if (seconds <= 0) {
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

// Settings modal
function showSettingsModal() {
    if (!isHost) {
        alert('Only the chat host can change settings');
        return;
    }
    updateSettingsUI();
    settingsModal.classList.remove('hidden');
}

function saveSettings() {
    const newSettings = {
        expireTime: parseInt(expireTimeSelect.value),
        maxUsers: parseInt(maxUsersInput.value),
        waitForRejoin: waitForRejoinCheckbox.checked
    };
    settingsRef.set(newSettings).then(() => {
        chatSettings = newSettings;
        settingsModal.classList.add('hidden');
    });
}

// Messaging
function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    const message = {
        id: generateId(),
        text: messageText,
        sender: userId,
        timestamp: Date.now()
    };
    messagesRef.push(message);
    messageInput.value = '';
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender === userId ? 'sent' : 'received'}`;
    messageElement.innerHTML = `
        <div class="message-content">${escapeHtml(message.text)}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
    `;
    chatMessages.appendChild(messageElement);
}

// Leave chat
function leaveChat() {
    if (usersRef) usersRef.child(userId).remove();
    if (messagesRef) messagesRef.off();
    if (usersRef) usersRef.off();
    if (settingsRef) settingsRef.off();
    if (chatRef) chatRef.off();
    clearInterval(expirationTimer);
    clearInterval(offlineTimer);
    clearInterval(countdownInterval);
    showWelcomeScreen();
}

// Refresh chat
function refreshChat() {
    chatMessages.innerHTML = '';
    messagesRef.once('value').then((snapshot) => {
        snapshot.forEach((childSnapshot) => displayMessage(childSnapshot.val()));
        scrollToBottom();
    });
}

// Show/hide screens
function showChatScreen() {
    welcomeScreen.classList.add('hidden');
    chatContainer.classList.remove('hidden');
}
function showWelcomeScreen() {
    welcomeScreen.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    sessionExpiring.classList.add('hidden');
    userOfflineModal.classList.add('hidden');
    chatIdInput.value = '';
}

// Copy functions
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

// Helpers
function generateId() {
    return Math.random().toString(36).substring(2, 9);
}
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function showTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    element.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), 1500);
}

// Start app
document.addEventListener('DOMContentLoaded', init);
        
