document.addEventListener('DOMContentLoaded', function() {
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
    const infoBtn = document.getElementById('infoBtn');
    const infoModal = document.getElementById('infoModal');
    const closeInfoBtn = document.getElementById('closeInfoBtn');
    const infoChatId = document.getElementById('infoChatId');
    const infoUserId = document.getElementById('infoUserId');
    const infoParticipants = document.getElementById('infoParticipants');
    const shareBtn = document.getElementById('shareBtn');
    const shareModal = document.getElementById('shareModal');
    const closeShareBtn = document.getElementById('closeShareBtn');
    const shareLinkInput = document.getElementById('shareLinkInput');
    const copyShareBtn = document.getElementById('copyShareBtn');
    const directShareInput = document.getElementById('directShareInput');
    const copyDirectShareBtn = document.getElementById('copyDirectShareBtn');
    const shareWhatsApp = document.getElementById('shareWhatsApp');
    const shareTelegram = document.getElementById('shareTelegram');
    const shareEmail = document.getElementById('shareEmail');
    const qrCodeCanvas = document.getElementById('qrCodeCanvas');

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

    // Initialize
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
        infoBtn.addEventListener('click', showInfoModal);
        closeInfoBtn.addEventListener('click', hideInfoModal);
        shareBtn.addEventListener('click', showShareModal);
        closeShareBtn.addEventListener('click', hideShareModal);
        copyShareBtn.addEventListener('click', copyShareLink);
        copyDirectShareBtn.addEventListener('click', copyDirectShareLink);
        shareWhatsApp.addEventListener('click', shareViaWhatsApp);
        shareTelegram.addEventListener('click', shareViaTelegram);
        shareEmail.addEventListener('click', shareViaEmail);
        
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Check for existing chat in URL hash
        const hashId = window.location.hash.substring(1);
        if (hashId && hashId.length === 6) {
            // Auto-join chat if ID is in URL
            chatIdInput.value = hashId;
            joinExistingChat();
        } else if (hashId) {
            // Invalid hash, clear it
            window.location.hash = '';
        }
        
        // Set up connection state listener
        const connectedRef = database.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            connectionStatus = snap.val();
            updateConnectionStatus();
        });
    }

    function createNewChat() {
        currentChatId = generateChatId();
        isHost = true;
        otherUserPresent = false;
        window.location.hash = currentChatId;
        
        // Initialize Firebase references
        setupFirebaseReferences();
        
        // Set host presence
        updatePresence(true);
        
        // Update UI
        displayChatId.textContent = currentChatId;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        addSystemMessage('You created a new temporary chat. Share the ID with someone to start chatting!');
        addSystemMessage(`Chat ID: ${currentChatId}`);
        
        // Generate share link
        updateShareLinks();
        
        // Listen for participants
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
        
        // Initialize Firebase references
        setupFirebaseReferences();
        
        // Set participant presence
        updatePresence(true);
        
        // Update UI
        displayChatId.textContent = currentChatId;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        addSystemMessage(`You joined chat ${currentChatId}`);
        
        // Generate share link
        updateShareLinks();
        
        // Listen for host presence
        checkHostPresence();
    }

    function setupFirebaseReferences() {
        chatRef = database.ref(`chats/${currentChatId}`);
        messagesRef = chatRef.child('messages');
        presenceRef = chatRef.child('presence');
        participantsRef = chatRef.child('participants');
        
        // Set up message listener
        messagesRef.limitToLast(100).on('child_added', (snapshot) => {
            const message = snapshot.val();
            if (message.senderId !== userId) {
                addMessage(message.text, 'received');
            }
        });
        
        // Add user to participants list
        participantsRef.child(userId).set({
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            isHost: isHost
        });
        
        // Set up disconnect cleanup
        participantsRef.child(userId).onDisconnect().remove();
    }

    function updateShareLinks() {
        const shareLink = `${window.location.origin}${window.location.pathname}#${currentChatId}`;
        shareLinkInput.value = shareLink;
        directShareInput.value = shareLink;
        
        // Generate QR code
        if (qrCode) {
            qrCode.clear();
            qrCode.makeCode(shareLink);
        } else {
            qrCode = new QRCode(qrCodeCanvas, {
                text: shareLink,
                width: 150,
                height: 150,
                colorDark: "#f8fafc",
                colorLight: "transparent",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    function shareViaWhatsApp() {
        const shareLink = directShareInput.value;
        window.open(`https://wa.me/?text=${encodeURIComponent(`Join this temp chat: ${shareLink}`)}`, '_blank');
    }

    function shareViaTelegram() {
        const shareLink = directShareInput.value;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('Join this temp chat')}`, '_blank');
    }

    function shareViaEmail() {
        const shareLink = directShareInput.value;
        window.location.href = `mailto:?subject=Join my temp chat&body=Click this link to join the chat: ${encodeURIComponent(shareLink)}`;
    }

    function copyShareLink() {
        navigator.clipboard.writeText(shareLinkInput.value).then(() => {
            showCopiedFeedback(copyShareBtn);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }

    function copyDirectShareLink() {
        navigator.clipboard.writeText(directShareInput.value).then(() => {
            showCopiedFeedback(copyDirectShareBtn);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }

    function showCopiedFeedback(button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            button.innerHTML = originalHTML;
        }, 2000);
    }

    function showShareModal() {
        updateShareLinks();
        shareModal.classList.remove('hidden');
    }

    function hideShareModal() {
        shareModal.classList.add('hidden');
    }

    function showInfoModal() {
        infoChatId.textContent = currentChatId;
        infoUserId.textContent = userId;
        updateParticipantsCount();
        updateShareLinks();
        infoModal.classList.remove('hidden');
    }

    function hideInfoModal() {
        infoModal.classList.add('hidden');
    }

    function listenForParticipants() {
        presenceRef.on('value', (snapshot) => {
            const presenceData = snapshot.val() || {};
            const participants = Object.keys(presenceData).filter(uid => presenceData[uid] === true);
            
            // Count other participants (excluding self)
            const otherParticipants = participants.filter(uid => uid !== userId).length;
            
            if (otherParticipants > 0) {
                if (!otherUserPresent) {
                    otherUserPresent = true;
                    addSystemMessage('Someone joined the chat!');
                    updateParticipantsCount();
                }
            } else {
                if (otherUserPresent) {
                    otherUserPresent = false;
                    addSystemMessage('Other participant left');
                    updateParticipantsCount();
                    if (isHost) {
                        startSessionExpiration();
                    }
                }
            }
        });
    }

    function checkHostPresence() {
        presenceRef.on('value', (snapshot) => {
            const presenceData = snapshot.val() || {};
            
            // Check if any host is present
            participantsRef.orderByChild('isHost').equalTo(true).once('value', (hostSnapshot) => {
                const hosts = hostSnapshot.val() || {};
                const hostIds = Object.keys(hosts);
                
                const hostPresent = hostIds.some(hostId => 
                    hostId !== userId && presenceData[hostId] === true
                );
                
                if (!hostPresent) {
                    addSystemMessage('Host has left the chat. This chat will expire soon.');
                    startSessionExpiration();
                }
            });
        });
    }

    function updateParticipantsCount() {
        presenceRef.once('value').then(snapshot => {
            const presenceData = snapshot.val() || {};
            const activeParticipants = Object.keys(presenceData).filter(uid => presenceData[uid] === true).length;
            infoParticipants.textContent = activeParticipants;
        });
    }

    function updatePresence(isPresent) {
        presenceRef.child(userId).set(isPresent);
        
        // Set up disconnect cleanup
        if (isPresent) {
            presenceRef.child(userId).onDisconnect().set(false);
        }
        
        updateParticipantsCount();
    }

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;
        
        // Add to local chat
        addMessage(messageText, 'sent');
        messageInput.value = '';
        
        // Push to Firebase
        const messageData = {
            text: messageText,
            senderId: userId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        messagesRef.push(messageData).catch(error => {
            addSystemMessage('Failed to send message. Please check your connection.');
            console.error('Message send error:', error);
        });
    }

    function addMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-text">${text}</div>
            <div class="message-time">${timestamp}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }

    function addSystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'system');
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }

    function scrollToBottom() {
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 50);
    }

    function leaveChat() {
        // Update presence
        updatePresence(false);
        
        // Clean up
        resetChat();
    }

    function startSessionExpiration() {
        chatContainer.classList.add('hidden');
        sessionExpiring.classList.remove('hidden');
        
        let secondsLeft = 10;
        countdownElement.textContent = secondsLeft;
        
        countdownInterval = setInterval(() => {
            secondsLeft--;
            countdownElement.textContent = secondsLeft;
            
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                expireSession();
            }
        }, 1000);
        
        expirationTimeout = setTimeout(expireSession, 10000);
    }

    function expireSession() {
        clearInterval(countdownInterval);
        resetChat();
    }

    function resetChat() {
        // Clean up Firebase references
        if (presenceRef) {
            presenceRef.child(userId).set(false);
            presenceRef.off();
        }
        
        if (messagesRef) {
            messagesRef.off();
        }
        
        if (participantsRef) {
            participantsRef.child(userId).remove();
        }
        
        // Reset state
        currentChatId = '';
        isHost = false;
        otherUserPresent = false;
        
        // Clear UI
        chatMessages.innerHTML = '';
        messageInput.value = '';
        sessionExpiring.classList.add('hidden');
        chatContainer.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
        
        // Remove hash from URL
        history.pushState("", document.title, window.location.pathname);
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
        navigator.clipboard.writeText(currentChatId).then(() => {
            // Show feedback
            const originalHTML = copyChatIdBtn.innerHTML;
            copyChatIdBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyChatIdBtn.innerHTML = originalHTML;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }

    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.classList.add('message', 'system');
        errorElement.textContent = message;
        errorElement.style.color = 'var(--danger)';
        errorElement.style.animation = 'shake 0.5s ease-in-out';
        
        const joinSection = document.querySelector('.join-section');
        joinSection.parentNode.insertBefore(errorElement, joinSection.nextSibling);
        
        setTimeout(() => {
            errorElement.remove();
        }, 3000);
    }

    function updateConnectionStatus() {
        if (connectionStatus) {
            statusText.textContent = 'Connected';
            statusText.style.color = 'var(--success)';
            document.querySelector('.connection-status i').className = 'fas fa-circle connected';
            sendMessageBtn.disabled = false;
        } else {
            statusText.textContent = 'Disconnected';
            statusText.style.color = 'var(--danger)';
            document.querySelector('.connection-status i').className = 'fas fa-circle disconnected';
            sendMessageBtn.disabled = true;
        }
    }
});
