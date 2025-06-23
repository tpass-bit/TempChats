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

    // State variables
    let currentChatId = '';
    let isHost = false;
    let countdownInterval = null;
    let expirationTimeout = null;
    let otherUserActive = true;

    // Initialize
    init();

    function init() {
        // Event Listeners
        createChatBtn.addEventListener('click', createNewChat);
        joinChatBtn.addEventListener('click', joinExistingChat);
        copyChatIdBtn.addEventListener('click', copyChatIdToClipboard);
        sendMessageBtn.addEventListener('click', sendMessage);
        leaveChatBtn.addEventListener('click', leaveChat);
        closeNowBtn.addEventListener('click', expireSession);
        
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Check for existing chat in URL hash
        if (window.location.hash) {
            const hashId = window.location.hash.substring(1);
            if (hashId.length === 6) {
                chatIdInput.value = hashId;
            }
        }
    }

    function createNewChat() {
        currentChatId = generateChatId();
        isHost = true;
        otherUserActive = false;
        
        // Update URL
        window.location.hash = currentChatId;
        
        // Setup connection simulation
        setupConnection();
        
        // Update UI
        displayChatId.textContent = currentChatId;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        // Add welcome message
        addSystemMessage('You created a new temporary chat. Share the ID with someone to start chatting!');
        addSystemMessage(`Chat ID: ${currentChatId}`);
        
        // Start checking for participants
        checkForParticipants();
    }

    function joinExistingChat() {
        const chatId = chatIdInput.value.trim().toUpperCase();
        
        if (!chatId || chatId.length !== 6) {
            showError('Please enter a valid 6-character chat ID');
            return;
        }
        
        currentChatId = chatId;
        isHost = false;
        otherUserActive = true;
        
        // Update URL
        window.location.hash = currentChatId;
        
        // Setup connection simulation
        setupConnection();
        
        // Update UI
        displayChatId.textContent = currentChatId;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        // Add welcome message
        addSystemMessage(`You joined chat ${currentChatId}`);
        
        // Notify host that someone joined
        localStorage.setItem(`tempchat_${currentChatId}_join`, Date.now());
        window.dispatchEvent(new Event('storage'));
    }

    function generateChatId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function setupConnection() {
        // Simulate connection with localStorage
        window.addEventListener('storage', handleStorageEvent);
        
        // If host, set up the chat room
        if (isHost) {
            localStorage.setItem(`tempchat_${currentChatId}_host`, 'active');
        }
    }

    function handleStorageEvent(event) {
        if (event.key === `tempchat_${currentChatId}_message`) {
            // New message received
            const messageData = JSON.parse(event.newValue);
            if (messageData.sender === 'system') return;
            
            addMessage(messageData.text, 'received');
            
            // If host and first message, set other user as active
            if (isHost && !otherUserActive) {
                otherUserActive = true;
            }
        } 
        else if (event.key === `tempchat_${currentChatId}_join`) {
            // Someone joined the chat
            if (isHost) {
                otherUserActive = true;
                addSystemMessage('Someone joined the chat!');
            }
        }
        else if (event.key === `tempchat_${currentChatId}_leave`) {
            // Other user left
            if (isHost) {
                otherUserActive = false;
                startSessionExpiration();
            } else {
                addSystemMessage('Host has left the chat. This chat will expire soon.');
                startSessionExpiration();
            }
        }
    }

    function checkForParticipants() {
        // Simulate checking for participants
        setTimeout(() => {
            if (!otherUserActive) {
                addSystemMessage('Waiting for someone to join... Share the chat ID:');
                addSystemMessage(currentChatId);
                checkForParticipants();
            }
        }, 5000);
    }

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;
        
        // Add to local chat
        addMessage(messageText, 'sent');
        messageInput.value = '';
        
        // Simulate sending via localStorage
        const messageData = {
            text: messageText,
            timestamp: new Date().toISOString(),
            sender: 'user'
        };
        
        localStorage.setItem(`tempchat_${currentChatId}_message`, JSON.stringify(messageData));
        // Trigger storage event
        window.dispatchEvent(new Event('storage'));
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
        chatMessages.scrollTop = chatMessages.scrollHeight;
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

    function leaveChat() {
        // Notify other user
        localStorage.setItem(`tempchat_${currentChatId}_leave`, Date.now());
        window.dispatchEvent(new Event('storage'));
        
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
        // Clean up
        if (isHost) {
            localStorage.removeItem(`tempchat_${currentChatId}_host`);
        }
        localStorage.removeItem(`tempchat_${currentChatId}_message`);
        localStorage.removeItem(`tempchat_${currentChatId}_join`);
        localStorage.removeItem(`tempchat_${currentChatId}_leave`);
        
        // Reset state
        currentChatId = '';
        isHost = false;
        otherUserActive = true;
        
        // Clear UI
        chatMessages.innerHTML = '';
        messageInput.value = '';
        sessionExpiring.classList.add('hidden');
        chatContainer.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
        
        // Remove hash from URL
        history.pushState("", document.title, window.location.pathname + window.location.search);
    }

    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.classList.add('message', 'system');
        errorElement.textContent = message;
        errorElement.style.color = 'var(--danger)';
        errorElement.style.animation = 'shake 0.5s ease-in-out';
        
        // Insert after the join section
        const joinSection = document.querySelector('.join-section');
        joinSection.parentNode.insertBefore(errorElement, joinSection.nextSibling);
        
        // Remove after 3 seconds
        setTimeout(() => {
            errorElement.remove();
        }, 3000);
    }
});
