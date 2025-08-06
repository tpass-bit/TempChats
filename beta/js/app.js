// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

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

    // Check if chat exists and get settings
    chatRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
            // Existing chat
            if (snapshot.child('settings').exists()) {
                chatSettings = snapshot.child('settings').val();
                updateSettingsUI();
            }
            checkUserLimitAndJoin();
        } else {
            // New chat - initialize settings
            if (isHost) {
                settingsRef.set(chatSettings);
                joinChatAsUser();
            } else {
                alert('Chat does not exist');
                return;
            }
        }
    });

    // Set up listeners
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
    // Set user presence
    const userRef = usersRef.child(userId);
    userRef.set(true);
    
    // Set up presence cleanup on disconnect
    userRef.onDisconnect().remove();
    
    // Listen for users
    usersRef.on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const userCount = Object.keys(users).length;
        infoParticipants.textContent = userCount;
        
        // If host and users drop to 1 (just you), start expiration process
        if (isHost && userCount === 1 && Object.keys(users)[0] === userId) {
            if (chatSettings.waitForRejoin) {
                showUserOfflineModal();
            } else {
                startSessionExpiration();
            }
        }
    });
    
    // Listen for messages
    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
        scrollToBottom();
    });
    
    // Update status
    statusText.textContent = 'Connected';
    statusText.previousElementSibling.className = 'fas fa-circle connected';
    
    // Update info modal
    infoChatId.textContent = chatId;
    infoUserId.textContent = userId;
    displayChatId.textContent = chatId;
    
    // Generate share link
    const shareLink = `${window.location.origin}${window.location.pathname}?chat=${chatId}`;
    shareLinkInput.value = shareLink;
    directShareInput.value = shareLink;
    
    // Generate QR code if not already exists
    if (!document.getElementById('qrCode')) {
        new QRCode(document.getElementById('qrCodeCanvas'), {
            text: shareLink,
            width: 150,
            height: 150,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

// Set up chat listeners
function setupChatListeners() {
    // Listen for settings changes
    settingsRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            chatSettings = snapshot.val();
            updateSettingsUI();
        }
    });
}

// Update settings UI
function updateSettingsUI() {
    if (!settingsModal.classList.contains('hidden')) {
        expireTimeSelect.value = chatSettings.expireTime;
        maxUsersInput.value = chatSettings.maxUsers;
        waitForRejoinCheckbox.checked = chatSettings.waitForRejoin;
    }
}

// Show user offline modal
function showUserOfflineModal() {
    userOfflineModal.classList.remove('hidden');
    
    // Start countdown
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

// Wait for user to rejoin
function waitForUserRejoin() {
    clearInterval(offlineTimer);
    userOfflineModal.classList.add('hidden');
}

// Start session expiration countdown
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

// Close chat immediately
function closeChatNow() {
    clearInterval(countdownInterval);
    if (isHost) {
        // Remove the entire chat
        chatRef.remove();
    }
    leaveChat();
}

// Show settings modal
function showSettingsModal() {
    if (!isHost) {
        alert('Only the chat host can change settings');
        return;
    }
    
    // Update UI with current settings
    expireTimeSelect.value = chatSettings.expireTime;
    maxUsersInput.value = chatSettings.maxUsers;
    waitForRejoinCheckbox.checked = chatSettings.waitForRejoin;
    
    settingsModal.classList.remove('hidden');
}

// Save settings
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

// Send a message
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

// Display a message
function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender === userId ? 'sent' : 'received'}`;
    messageElement.innerHTML = `
        <div class="message-content">${escapeHtml(message.text)}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
    `;
    chatMessages.appendChild(messageElement);
}

// Leave the chat
function leaveChat() {
    if (usersRef) {
        usersRef.child(userId).remove();
    }
    
    // Clean up
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
        snapshot.forEach((childSnapshot) => {
            displayMessage(childSnapshot.val());
        });
        scrollToBottom();
    });
}

// Show chat screen
function showChatScreen() {
    welcomeScreen.classList.add('hidden');
    chatContainer.classList.remove('hidden');
}

// Show welcome screen
function showWelcomeScreen() {
    welcomeScreen.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    sessionExpiring.classList.add('hidden');
    userOfflineModal.classList.add('hidden');
    chatIdInput.value = '';
}

// Copy chat ID to clipboard
function copyChatId() {
    navigator.clipboard.writeText(chatId);
    showTooltip(copyChatIdBtn, 'Copied!');
}

// Copy share link to clipboard
function copyShareLink() {
    navigator.clipboard.writeText(shareLinkInput.value);
    showTooltip(copyShareBtn, 'Copied!');
}

// Copy direct share link to clipboard
function copyDirectShareLink() {
    navigator.clipboard.writeText(directShareInput.value);
    showTooltip(copyDirectShareBtn, 'Copied!');
}

// Show share modal
function showShareModal() {
    shareModal.classList.remove('hidden');
}

// Helper functions
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
    
