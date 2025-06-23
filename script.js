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

    // State variables
    let currentChatId = '';
    let peerConnection = null;
    let dataChannel = null;
    let isHost = false;
    let countdownInterval = null;
    let expirationTimeout = null;

    // Event Listeners
    createChatBtn.addEventListener('click', createNewChat);
    joinChatBtn.addEventListener('click', joinExistingChat);
    copyChatIdBtn.addEventListener('click', copyChatIdToClipboard);
    sendMessageBtn.addEventListener('click', sendMessage);
    leaveChatBtn.addEventListener('click', leaveChat);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Functions
    function createNewChat() {
        // Generate a random 6-character chat ID
        currentChatId = generateChatId();
        isHost = true;
        
        // Simulate connection setup (in a real app, this would use WebRTC or similar)
        setupConnection();
        
        // Update UI
        displayChatId.textContent = `Chat ID: ${currentChatId}`;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('fade-in');
        
        // Add welcome message
        addSystemMessage(`You created a new chat with ID: ${currentChatId}. Share this ID with someone to start chatting!`);
    }

    function joinExistingChat() {
        const chatId = chatIdInput.value.trim();
        
        if (!chatId) {
            alert('Please enter a chat ID');
            return;
        }
        
        currentChatId = chatId;
        isHost = false;
        
        // Simulate connection setup
        setupConnection();
        
        // Update UI
        displayChatId.textContent = `Chat ID: ${currentChatId}`;
        welcomeScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('fade-in');
        
        // Add welcome message
        addSystemMessage(`You joined chat with ID: ${currentChatId}`);
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
            // Show temporary feedback
            const originalText = copyChatIdBtn.innerHTML;
            copyChatIdBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyChatIdBtn.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }

    function setupConnection() {
        // In a real app, this would set up WebRTC connection
        // For this demo, we'll simulate it with local storage
        
        // Listen for messages (simulated)
        window.addEventListener('storage', handleStorageEvent);
        
        // If host, set up a "room" in localStorage
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
        } else if (event.key === `tempchat_${currentChatId}_leave`) {
            // Other user left
            if (isHost) {
                startSessionExpiration();
            } else {
                addSystemMessage('Host has left the chat. This chat will expire soon.');
                startSessionExpiration();
            }
        }
    }

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;
        
        // Add to local chat
        addMessage(messageText, 'sent');
        messageInput.value = '';
        
        // In a real app, this would send via WebRTC data channel
        // For demo, we'll use localStorage to simulate
        const messageData = {
            text: messageText,
            timestamp: new Date().toISOString(),
            sender: 'user'
        };
        
        localStorage.setItem(`tempchat_${currentChatId}_message`, JSON.stringify(messageData));
        // Trigger storage event for other tab
        window.dispatchEvent(new Event('storage'));
    }

    function addMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-text">${text}</div>
            <div class="message-info">${timestamp}</div>
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

    function leaveChat() {
        // Notify other user (if any) that we're leaving
        localStorage.setItem(`tempchat_${currentChatId}_leave`, Date.now());
        window.dispatchEvent(new Event('storage'));
        
        // Clean up
        if (isHost) {
            localStorage.removeItem(`tempchat_${currentChatId}_host`);
        }
        
        // Clear any pending timeouts
        if (countdownInterval) clearInterval(countdownInterval);
        if (expirationTimeout) clearTimeout(expirationTimeout);
        
        // Return to welcome screen
        chatContainer.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
        chatMessages.innerHTML = '';
        currentChatId = '';
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
        
        // Clean up
        localStorage.removeItem(`tempchat_${currentChatId}_host`);
        localStorage.removeItem(`tempchat_${currentChatId}_message`);
        localStorage.removeItem(`tempchat_${currentChatId}_leave`);
        
        // Return to welcome screen
        sessionExpiring.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
        chatMessages.innerHTML = '';
        currentChatId = '';
    }
});
