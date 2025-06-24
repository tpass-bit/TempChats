document.addEventListener('DOMContentLoaded', function() {
    // Firebase will be initialized from config.js
    const database = firebase.database();
    const MAX_PARTICIPANTS = 2; // Set maximum participants to 2 (1:1 chat)
    const REJOIN_DELAY = 10000; // 10 seconds delay before rejoining

    // DOM Elements
    const welcomeScreen = document.getElementById('welcomeScreen');
    const chatContainer = document.getElementById('chatContainer');
    const createChatBtn = document.getElementById('createChatBtn');
    const joinChatBtn = document.getElementById('joinChatBtn');
    const chatIdInput = document.getElementById('chatIdInput');
    const displayChatId = document.getElementById('displayChatId');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const leaveChatBtn = document.getElementById('leaveChatBtn');
    const sessionExpiring = document.getElementById('sessionExpiring');
    const countdownElement = document.getElementById('countdown');

    // Firebase references
    let chatRef;
    let messagesRef;
    let presenceRef;
    let participantsRef;
    
    // State variables
    let currentChatId = '';
    let isHost = false;
    let userId;
    let countdownInterval = null;
    let expirationTimeout = null;
    let lastLeftTime = 0;
    let rejoinTimeout = null;

    // Initialize the app
    init();

    function init() {
        // Generate unique user ID
        userId = generateUserId();
        
        // Set up event listeners
        createChatBtn.addEventListener('click', createNewChat);
        joinChatBtn.addEventListener('click', joinExistingChat);
        leaveChatBtn.addEventListener('click', leaveChat);
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendMessage();
        });

        // Check for existing chat in URL hash
        const hashId = window.location.hash.substring(1);
        if (hashId && hashId.length === 6) {
            if (Date.now() - lastLeftTime > REJOIN_DELAY) {
                chatIdInput.value = hashId;
                joinExistingChat();
            } else {
                showError('Please wait 10 seconds before rejoining');
            }
        }
    }

    function createNewChat() {
        currentChatId = generateChatId();
        isHost = true;
        window.location.hash = currentChatId;
        
        setupFirebaseReferences();
        updatePresence(true);
        
        displayChatId.textContent = currentChatId;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        sessionExpiring.classList.add('hidden');
        
        addSystemMessage('You created a new chat. Share the ID to invite others!');
    }

    function joinExistingChat() {
        const chatId = chatIdInput.value.trim().toUpperCase();
        
        if (!chatId || chatId.length !== 6) {
            showError('Please enter a valid 6-character chat ID');
            return;
        }

        if (Date.now() - lastLeftTime < REJOIN_DELAY) {
            showError('Please wait 10 seconds before rejoining');
            return;
        }
        
        currentChatId = chatId;
        isHost = false;
        window.location.hash = currentChatId;
        
        // Check if chat is full before joining
        checkChatCapacity().then((canJoin) => {
            if (canJoin) {
                setupFirebaseReferences();
                updatePresence(true);
                
                displayChatId.textContent = currentChatId;
                welcomeScreen.classList.add('hidden');
                chatContainer.classList.remove('hidden');
                
                addSystemMessage(`You joined chat ${currentChatId}`);
                listenForParticipants();
            } else {
                showError('Sorry, this chat is already full');
                window.location.hash = '';
            }
        });
    }

    function checkChatCapacity() {
        return new Promise((resolve) => {
            database.ref(`chats/${currentChatId}/presence`).once('value').then((snapshot) => {
                const participants = snapshot.val() || {};
                resolve(Object.keys(participants).length < MAX_PARTICIPANTS);
            });
        });
    }

    function setupFirebaseReferences() {
        chatRef = database.ref(`chats/${currentChatId}`);
        messagesRef = chatRef.child('messages');
        presenceRef = chatRef.child('presence');
        
        // Initialize chat if host
        if (isHost) {
            chatRef.set({
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: userId,
                active: true
            });
        }
        
        // Listen for messages
        messagesRef.limitToLast(100).on('child_added', (snapshot) => {
            const message = snapshot.val();
            addMessageToUI(message);
        });
    }

    function updatePresence(isOnline) {
        if (!currentChatId) return;
        
        const myPresenceRef = presenceRef.child(userId);
        
        if (isOnline) {
            myPresenceRef.set(true);
            myPresenceRef.onDisconnect().remove().then(() => {
                // When disconnected, check if chat should be closed
                database.ref(`chats/${currentChatId}/presence`).once('value').then((snapshot) => {
                    const participants = snapshot.val() || {};
                    if (Object.keys(participants).length === 0) {
                        // No participants left, close chat
                        chatRef.remove();
                    }
                });
            });
        } else {
            myPresenceRef.remove();
        }
    }

    function listenForParticipants() {
        presenceRef.on('value', (snapshot) => {
            const participants = snapshot.val() || {};
            const participantCount = Object.keys(participants).length;
            
            if (participantCount >= MAX_PARTICIPANTS && !participants[userId]) {
                // Chat is full and current user isn't in it
                showError('Sorry, this chat is already full');
                leaveChat();
                return;
            }
            
            if (participantCount === 0 && !isHost) {
                // Host left, start expiration
                startSessionExpiration();
            }
        });
    }

    function startSessionExpiration() {
        sessionExpiring.classList.remove('hidden');
        
        let seconds = 10;
        countdownElement.textContent = seconds;
        
        countdownInterval = setInterval(() => {
            seconds--;
            countdownElement.textContent = seconds;
            
            if (seconds <= 0) {
                clearInterval(countdownInterval);
                expireSession();
            }
        }, 1000);
    }

    function expireSession() {
        if (countdownInterval) clearInterval(countdownInterval);
        leaveChat();
    }

    function leaveChat() {
        updatePresence(false);
        
        if (messagesRef) messagesRef.off();
        if (presenceRef) presenceRef.off();
        
        chatContainer.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
        chatMessages.innerHTML = '';
        messageInput.value = '';
        
        lastLeftTime = Date.now();
        currentChatId = '';
        isHost = false;
        
        // Clear any pending rejoin timeout
        if (rejoinTimeout) clearTimeout(rejoinTimeout);
        
        // Set timeout to prevent immediate rejoining
        rejoinTimeout = setTimeout(() => {
            window.location.hash = '';
        }, REJOIN_DELAY);
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || !currentChatId) return;
        
        const message = {
            text: text,
            senderId: userId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        messagesRef.push(message);
        messageInput.value = '';
    }

    function addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(message.senderId === userId ? 'sent' : 'received');
        
        const timeString = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        messageElement.innerHTML = `
            <div class="message-content">${message.text}</div>
            <div class="message-time">${timeString}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addSystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'system');
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.classList.add('error-message');
        errorElement.textContent = message;
        document.body.appendChild(errorElement);
        
        setTimeout(() => {
            errorElement.remove();
        }, 3000);
    }

    function generateUserId() {
        return 'user-' + Math.random().toString(36).substr(2, 9);
    }

    function generateChatId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
});
