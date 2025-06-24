document.addEventListener('DOMContentLoaded', function() {
    // Firebase will be initialized from config.js
    const database = firebase.database();

    // DOM Elements
    const welcomeScreen = document.getElementById('welcomeScreen');
    const chatContainer = document.getElementById('chatContainer');
    const createChatBtn = document.getElementById('createChatBtn');
    const joinChatBtn = document.getElementById('joinChatBtn');
    const chatIdInput = document.getElementById('chatIdInput');
    const displayChatId = document.getElementById('displayChatId');
    const copyChatIdBtn = document.getElementById('copyChatIdBtn');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const leaveChatBtn = document.getElementById('leaveChatBtn');
    const sessionExpiring = document.getElementById('sessionExpiring');
    const countdownElement = document.getElementById('countdown');
    const closeNowBtn = document.getElementById('closeNowBtn');
    const statusText = document.getElementById('statusText');
    const shareBtn = document.getElementById('shareBtn');
    const shareModal = document.getElementById('shareModal');
    const closeShareBtn = document.getElementById('closeShareBtn');
    const shareLinkInput = document.getElementById('shareLinkInput');
    const copyShareBtn = document.getElementById('copyShareBtn');
    const shareWhatsApp = document.getElementById('shareWhatsApp');
    const shareTelegram = document.getElementById('shareTelegram');
    const shareEmail = document.getElementById('shareEmail');
    const qrCodeCanvas = document.getElementById('qrCodeCanvas');
    const participantsBtn = document.getElementById('participantsBtn');
    const participantsModal = document.getElementById('participantsModal');
    const closeParticipantsBtn = document.getElementById('closeParticipantsBtn');
    const participantsList = document.getElementById('participantsList');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const notificationToggle = document.getElementById('notificationToggle');
    const soundToggle = document.getElementById('soundToggle');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const messageSound = document.getElementById('messageSound');
    const notificationSound = document.getElementById('notificationSound');

    // Firebase references
    let chatRef;
    let messagesRef;
    let presenceRef;
    let participantsRef;
    
    // State variables
    let currentChatId = '';
    let isHost = false;
    let userId;
    let otherUserPresent = false;
    let countdownInterval = null;
    let expirationTimeout = null;
    let connectionStatus = false;
    let qrCode = null;
    let emojiMart;

    // Initialize the app
    init();

    function init() {
        // Generate unique user ID
        userId = generateUserId();
        
        // Set up event listeners
        createChatBtn.addEventListener('click', createNewChat);
        joinChatBtn.addEventListener('click', joinExistingChat);
        copyChatIdBtn.addEventListener('click', copyChatIdToClipboard);
        sendMessageBtn.addEventListener('click', sendMessage);
        leaveChatBtn.addEventListener('click', leaveChat);
        closeNowBtn.addEventListener('click', expireSession);
        shareBtn.addEventListener('click', showShareModal);
        closeShareBtn.addEventListener('click', hideShareModal);
        copyShareBtn.addEventListener('click', copyShareLink);
        shareWhatsApp.addEventListener('click', shareViaWhatsApp);
        shareTelegram.addEventListener('click', shareViaTelegram);
        shareEmail.addEventListener('click', shareViaEmail);
        participantsBtn.addEventListener('click', showParticipantsModal);
        closeParticipantsBtn.addEventListener('click', hideParticipantsModal);
        settingsBtn.addEventListener('click', showSettingsModal);
        closeSettingsBtn.addEventListener('click', hideSettingsModal);
        clearChatBtn.addEventListener('click', clearChatHistory);
        emojiBtn.addEventListener('click', toggleEmojiPicker);
        
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Check for existing chat in URL hash
        const hashId = window.location.hash.substring(1);
        if (hashId && hashId.length === 6) {
            chatIdInput.value = hashId;
            joinExistingChat();
        } else if (hashId) {
            window.location.hash = '';
        }
        
        // Set up connection state listener
        const connectedRef = database.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            connectionStatus = snap.val();
            updateConnectionStatus();
        });

        // Initialize emoji picker
        initEmojiPicker();

        // Load settings
        loadSettings();
    }

    function createNewChat() {
        currentChatId = generateChatId();
        isHost = true;
        otherUserPresent = false;
        window.location.hash = currentChatId;
        
        setupFirebaseReferences();
        updatePresence(true);
        
        displayChatId.textContent = currentChatId;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        addSystemMessage('You created a new temporary chat. Share the ID to start chatting!');
        addSystemMessage(`Chat ID: ${currentChatId}`);
        
        updateShareLink();
        listenForParticipants();
    }

    function joinExistingChat() {
        const chatId = chatIdInput.value.trim().toUpperCase();
        
        if (!chatId || chatId.length !== 6) {
            showError('Please enter a valid 6-character chat ID');
            return;
        }
        
        currentChatId = chatId;
        isHost = false;
        window.location.hash = currentChatId;
        
        setupFirebaseReferences();
        updatePresence(true);
        
        displayChatId.textContent = currentChatId;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        addSystemMessage(`You joined chat ${currentChatId}`);
        
        updateShareLink();
        checkHostPresence();
    }

    function setupFirebaseReferences() {
        chatRef = database.ref(`chats/${currentChatId}`);
        messagesRef = chatRef.child('messages');
        presenceRef = chatRef.child('presence');
        participantsRef = chatRef.child('participants');
        
        messagesRef.limitToLast(100).on('child_added', (snapshot) => {
            const message = snapshot.val();
            addMessageToUI(message);
            
            if (soundToggle.checked && message.senderId !== userId) {
                messageSound.currentTime = 0;
                messageSound.play();
            }
            
            if (notificationToggle.checked && message.senderId !== userId && !document.hasFocus()) {
                showNotification('New message', message.text);
                notificationSound.currentTime = 0;
                notificationSound.play();
            }
        });
    }

    function updatePresence(isOnline) {
        if (!currentChatId) return;
        
        const myPresenceRef = presenceRef.child(userId);
        
        if (isOnline) {
            myPresenceRef.set(true);
            myPresenceRef.onDisconnect().set(false);
        } else {
            myPresenceRef.remove();
            myPresenceRef.onDisconnect().cancel();
        }
    }

    function listenForParticipants() {
        presenceRef.on('value', (snapshot) => {
            const participants = snapshot.val() || {};
            updateParticipantsList(participants);
            
            const newOtherUserPresent = Object.keys(participants).length > 1;
            
            if (newOtherUserPresent && !otherUserPresent) {
                otherUserPresent = true;
                addSystemMessage('Someone joined the chat!');
                
                if (expirationTimeout) {
                    clearTimeout(expirationTimeout);
                    expirationTimeout = null;
                }
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
                sessionExpiring.classList.add('hidden');
            } else if (!newOtherUserPresent && otherUserPresent) {
                otherUserPresent = false;
                addSystemMessage('The other participant left the chat');
                
                if (isHost) {
                    startSessionExpiration();
                }
            }
        });
    }

    function checkHostPresence() {
        presenceRef.once('value').then((snapshot) => {
            const participants = snapshot.val() || {};
            
            if (Object.keys(participants).length === 0) {
                addSystemMessage('The chat host is not available. They may return or this chat will expire soon.');
                startSessionExpiration();
            } else {
                otherUserPresent = true;
                listenForParticipants();
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
        
        expirationTimeout = setTimeout(() => {
            expireSession();
        }, 10000);
    }

    function expireSession() {
        if (countdownInterval) clearInterval(countdownInterval);
        if (expirationTimeout) clearTimeout(expirationTimeout);
        
        if (isHost) {
            chatRef.remove();
        }
        
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
        currentChatId = '';
        isHost = false;
        otherUserPresent = false;
        
        window.location.hash = '';
    }

    function sendMessage() {
        const messageText = messageInput.value.trim();
        
        if (!messageText || !currentChatId) return;
        
        const message = {
            text: messageText,
            senderId: userId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        messagesRef.push(message);
        messageInput.value = '';
    }

    function addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        
        if (message.senderId === userId) {
            messageElement.classList.add('sent');
        } else {
            messageElement.classList.add('received');
        }
        
        const timeString = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
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

    function updateParticipantsList(participants) {
        participantsList.innerHTML = '';
        
        Object.keys(participants).forEach((participantId) => {
            if (participantId !== userId) {
                const participantElement = document.createElement('li');
                participantElement.textContent = `Participant ${participantId.substring(0, 4)}`;
                participantsList.appendChild(participantElement);
            }
        });
    }

    function updateShareLink() {
        const shareLink = `${window.location.origin}${window.location.pathname}#${currentChatId}`;
        shareLinkInput.value = shareLink;
        
        if (qrCode) {
            qrCode.clear();
            qrCode.makeCode(shareLink);
        } else {
            qrCode = new QRCode(qrCodeCanvas, {
                text: shareLink,
                width: 128,
                height: 128
            });
        }
    }

    function showShareModal() {
        shareModal.classList.remove('hidden');
    }

    function hideShareModal() {
        shareModal.classList.add('hidden');
    }

    function copyShareLink() {
        shareLinkInput.select();
        document.execCommand('copy');
        showToast('Link copied to clipboard!');
    }

    function shareViaWhatsApp() {
        const text = `Join me in this temporary chat: ${shareLinkInput.value}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }

    function shareViaTelegram() {
        const text = `Join me in this temporary chat: ${shareLinkInput.value}`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareLinkInput.value)}&text=${encodeURIComponent(text)}`, '_blank');
    }

    function shareViaEmail() {
        const subject = 'Join me in this temporary chat';
        const body = `Click this link to join the chat: ${shareLinkInput.value}`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    }

    function showParticipantsModal() {
        participantsModal.classList.remove('hidden');
    }

    function hideParticipantsModal() {
        participantsModal.classList.add('hidden');
    }

    function showSettingsModal() {
        settingsModal.classList.remove('hidden');
    }

    function hideSettingsModal() {
        settingsModal.classList.add('hidden');
        saveSettings();
    }

    function clearChatHistory() {
        if (confirm('Are you sure you want to clear all chat messages?')) {
            messagesRef.remove();
        }
    }

    function toggleEmojiPicker() {
        emojiPicker.classList.toggle('hidden');
    }

    function initEmojiPicker() {
        emojiMart = new EmojiMart.Picker({
            data: EmojiMartData,
            onEmojiSelect: (emoji) => {
                messageInput.value += emoji.native;
                emojiPicker.classList.add('hidden');
                messageInput.focus();
            }
        });
        emojiPicker.appendChild(emojiMart);
    }

    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem('chatSettings')) || {};
        
        if (settings.darkMode !== undefined) {
            darkModeToggle.checked = settings.darkMode;
            toggleDarkMode(settings.darkMode);
        }
        
        if (settings.notifications !== undefined) {
            notificationToggle.checked = settings.notifications;
        }
        
        if (settings.sounds !== undefined) {
            soundToggle.checked = settings.sounds;
        }
    }

    function saveSettings() {
        const settings = {
            darkMode: darkModeToggle.checked,
            notifications: notificationToggle.checked,
            sounds: soundToggle.checked
        };
        
        localStorage.setItem('chatSettings', JSON.stringify(settings));
        toggleDarkMode(settings.darkMode);
    }

    function toggleDarkMode(enable) {
        document.body.classList.toggle('dark-mode', enable);
    }

    function updateConnectionStatus() {
        if (connectionStatus) {
            statusText.textContent = 'Connected';
            statusText.style.color = '#4CAF50';
        } else {
            statusText.textContent = 'Disconnected';
            statusText.style.color = '#F44336';
        }
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

    function showToast(message) {
        const toast = document.createElement('div');
        toast.classList.add('toast');
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 2000);
    }

    function showNotification(title, body) {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'granted') {
            new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body });
                }
            });
        }
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

    function copyChatIdToClipboard() {
        navigator.clipboard.writeText(currentChatId)
            .then(() => showToast('Chat ID copied!'))
            .catch(() => showError('Failed to copy chat ID'));
    }
});
