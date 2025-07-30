import {
    generateUserId,
    generateChatId,
    sanitizeInput,
    showCopiedFeedback,
    scrollToBottom,
    showError
} from './utils.js';

class TempChatApp {
    constructor() {
        this.initDomElements();
        this.initState();
        this.initEventListeners();
        this.checkUrlHash();
        this.setupConnectionListener();
    }

    initDomElements() {
        this.dom = {
            welcomeScreen: document.getElementById('welcomeScreen'),
            chatContainer: document.getElementById('chatContainer'),
            createChatBtn: document.getElementById('createChatBtn'),
            joinChatBtn: document.getElementById('joinChatBtn'),
            chatIdInput: document.getElementById('chatIdInput'),
            displayChatId: document.getElementById('displayChatId'),
            copyChatIdBtn: document.getElementById('copyChatIdBtn'),
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendMessageBtn: document.getElementById('sendMessageBtn'),
            leaveChatBtn: document.getElementById('leaveChatBtn'),
            sessionExpiring: document.getElementById('sessionExpiring'),
            countdownElement: document.getElementById('countdown'),
            closeNowBtn: document.getElementById('closeNowBtn'),
            statusText: document.getElementById('statusText'),
            infoBtn: document.getElementById('infoBtn'),
            infoModal: document.getElementById('infoModal'),
            closeInfoBtn: document.getElementById('closeInfoBtn'),
            infoChatId: document.getElementById('infoChatId'),
            infoUserId: document.getElementById('infoUserId'),
            infoParticipants: document.getElementById('infoParticipants'),
            shareBtn: document.getElementById('shareBtn'),
            shareModal: document.getElementById('shareModal'),
            closeShareBtn: document.getElementById('closeShareBtn'),
            shareLinkInput: document.getElementById('shareLinkInput'),
            copyShareBtn: document.getElementById('copyShareBtn'),
            directShareInput: document.getElementById('directShareInput'),
            copyDirectShareBtn: document.getElementById('copyDirectShareBtn'),
            shareWhatsApp: document.getElementById('shareWhatsApp'),
            shareTelegram: document.getElementById('shareTelegram'),
            shareEmail: document.getElementById('shareEmail'),
            qrCodeCanvas: document.getElementById('qrCodeCanvas'),
            joinSection: document.querySelector('.join-section')
        };
    }

    initState() {
        this.state = {
            currentChatId: '',
            isHost: false,
            userId: generateUserId(),
            otherUserPresent: false,
            countdownInterval: null,
            expirationTimeout: null,
            connectionStatus: false,
            qrCode: null,
            lastMessageTime: 0,
            MESSAGE_RATE_LIMIT: 1000,
            firebase: {
                chatRef: null,
                messagesRef: null,
                presenceRef: null,
                participantsRef: null,
                connectedRef: null
            }
        };
    }

    initEventListeners() {
        this.dom.createChatBtn.addEventListener('click', () => this.createNewChat());
        this.dom.joinChatBtn.addEventListener('click', () => this.joinExistingChat());
        this.dom.copyChatIdBtn.addEventListener('click', () => this.copyChatIdToClipboard());
        this.dom.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.dom.leaveChatBtn.addEventListener('click', () => this.leaveChat());
        this.dom.closeNowBtn.addEventListener('click', () => this.expireSession());
        this.dom.infoBtn.addEventListener('click', () => this.showInfoModal());
        this.dom.closeInfoBtn.addEventListener('click', () => this.hideInfoModal());
        this.dom.shareBtn.addEventListener('click', () => this.showShareModal());
        this.dom.closeShareBtn.addEventListener('click', () => this.hideShareModal());
        this.dom.copyShareBtn.addEventListener('click', () => this.copyShareLink());
        this.dom.copyDirectShareBtn.addEventListener('click', () => this.copyDirectShareLink());
        this.dom.shareWhatsApp.addEventListener('click', () => this.shareViaWhatsApp());
        this.dom.shareTelegram.addEventListener('click', () => this.shareViaTelegram());
        this.dom.shareEmail.addEventListener('click', () => this.shareViaEmail());
        
        this.dom.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    checkUrlHash() {
        const hashId = window.location.hash.substring(1);
        if (hashId && hashId.length === 6) {
            this.dom.chatIdInput.value = hashId;
            this.joinExistingChat();
        } else if (hashId) {
            window.location.hash = '';
        }
    }

    setupConnectionListener() {
        this.state.firebase.connectedRef = database.ref('.info/connected');
        this.state.firebase.connectedRef.on('value', (snap) => {
            this.state.connectionStatus = snap.val();
            this.updateConnectionStatus();
        });
    }

    createNewChat() {
        this.state.currentChatId = generateChatId();
        this.state.isHost = true;
        this.state.otherUserPresent = false;
        window.location.hash = this.state.currentChatId;
        
        this.setupFirebaseReferences();
        this.updatePresence(true);
        
        this.dom.displayChatId.textContent = this.state.currentChatId;
        this.dom.welcomeScreen.classList.add('hidden');
        this.dom.chatContainer.classList.remove('hidden');
        
        this.addSystemMessage('You created a new temporary chat. Share the ID with someone to start chatting!');
        this.addSystemMessage(`Chat ID: ${this.state.currentChatId}`);
        
        this.updateShareLinks();
        this.listenForParticipants();
    }

    joinExistingChat() {
        const chatId = this.dom.chatIdInput.value.trim().toUpperCase();
        
        if (!chatId || chatId.length !== 6) {
            showError('Please enter a valid 6-character chat ID', this.dom.joinSection);
            return;
        }
        
        this.state.currentChatId = chatId;
        this.state.isHost = false;
        window.location.hash = this.state.currentChatId;
        
        this.setupFirebaseReferences();
        this.updatePresence(true);
        
        this.dom.displayChatId.textContent = this.state.currentChatId;
        this.dom.welcomeScreen.classList.add('hidden');
        this.dom.chatContainer.classList.remove('hidden');
        
        this.addSystemMessage(`You joined chat ${this.state.currentChatId}`);
        this.updateShareLinks();
        this.checkHostPresence();
    }

    setupFirebaseReferences() {
        this.state.firebase.chatRef = database.ref(`chats/${this.state.currentChatId}`);
        this.state.firebase.messagesRef = this.state.firebase.chatRef.child('messages');
        this.state.firebase.presenceRef = this.state.firebase.chatRef.child('presence');
        this.state.firebase.participantsRef = this.state.firebase.chatRef.child('participants');
        
        this.state.firebase.messagesRef.limitToLast(100).on('child_added', (snapshot) => {
            const message = snapshot.val();
            if (message.senderId !== this.state.userId) {
                this.addMessage(message.text, 'received');
            }
        });
        
        this.state.firebase.participantsRef.child(this.state.userId).set({
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            isHost: this.state.isHost
        });
        
        this.state.firebase.participantsRef.child(this.state.userId).onDisconnect().remove();
        this.state.firebase.presenceRef.child(this.state.userId).onDisconnect().set(false);
    }

    updateShareLinks() {
        const shareLink = `${window.location.origin}${window.location.pathname}#${this.state.currentChatId}`;
        this.dom.shareLinkInput.value = shareLink;
        this.dom.directShareInput.value = shareLink;
        this.initQRCode(shareLink);
    }

    initQRCode(shareLink) {
        if (this.state.qrCode) {
            this.state.qrCode.clear();
            this.state.qrCode.makeCode(shareLink);
        } else {
            this.state.qrCode = new QRCode(this.dom.qrCodeCanvas, {
                text: shareLink,
                width: 150,
                height: 150,
                colorDark: "#f8fafc",
                colorLight: "transparent",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    shareViaWhatsApp() {
        const shareLink = this.dom.directShareInput.value;
        window.open(`https://wa.me/?text=${encodeURIComponent(`Join this temp chat: ${shareLink}`)}`, '_blank');
    }

    shareViaTelegram() {
        const shareLink = this.dom.directShareInput.value;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('Join this temp chat')}`, '_blank');
    }

    shareViaEmail() {
        const shareLink = this.dom.directShareInput.value;
        window.location.href = `mailto:?subject=Join my temp chat&body=Click this link to join the chat: ${encodeURIComponent(shareLink)}`;
    }

    copyShareLink() {
        navigator.clipboard.writeText(this.dom.shareLinkInput.value).then(() => {
            showCopiedFeedback(this.dom.copyShareBtn);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }

    copyDirectShareLink() {
        navigator.clipboard.writeText(this.dom.directShareInput.value).then(() => {
            showCopiedFeedback(this.dom.copyDirectShareBtn);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }

    showShareModal() {
        this.updateShareLinks();
        this.dom.shareModal.classList.remove('hidden');
    }

    hideShareModal() {
        this.dom.shareModal.classList.add('hidden');
    }

    showInfoModal() {
        this.dom.infoChatId.textContent = this.state.currentChatId;
        this.dom.infoUserId.textContent = this.state.userId;
        this.updateParticipantsCount();
        this.updateShareLinks();
        this.dom.infoModal.classList.remove('hidden');
    }

    hideInfoModal() {
        this.dom.infoModal.classList.add('hidden');
    }

    listenForParticipants() {
        this.state.firebase.presenceRef.on('value', (snapshot) => {
            const presenceData = snapshot.val() || {};
            const participants = Object.keys(presenceData).filter(uid => presenceData[uid] === true);
            
            const otherParticipants = participants.filter(uid => uid !== this.state.userId).length;
            
            if (otherParticipants > 0) {
                if (!this.state.otherUserPresent) {
                    this.state.otherUserPresent = true;
                    this.addSystemMessage('Someone joined the chat!');
                    this.updateParticipantsCount();
                }
            } else {
                if (this.state.otherUserPresent) {
                    this.state.otherUserPresent = false;
                    this.addSystemMessage('Other participant left');
                    this.updateParticipantsCount();
                    if (this.state.isHost) {
                        this.startSessionExpiration();
                    }
                }
            }
        });
    }

    checkHostPresence() {
        this.state.firebase.presenceRef.on('value', (snapshot) => {
            const presenceData = snapshot.val() || {};
            
            this.state.firebase.participantsRef.orderByChild('isHost').equalTo(true).once('value', (hostSnapshot) => {
                const hosts = hostSnapshot.val() || {};
                const hostIds = Object.keys(hosts);
                
                const hostPresent = hostIds.some(hostId => 
                    hostId !== this.state.userId && presenceData[hostId] === true
                );
                
                if (!hostPresent) {
                    this.addSystemMessage('Host has left the chat. This chat will expire soon.');
                    this.startSessionExpiration();
                }
            });
        });
    }

    updateParticipantsCount() {
        this.state.firebase.presenceRef.once('value').then(snapshot => {
            const presenceData = snapshot.val() || {};
            const activeParticipants = Object.keys(presenceData).filter(uid => presenceData[uid] === true).length;
            this.dom.infoParticipants.textContent = activeParticipants;
        });
    }

    updatePresence(isPresent) {
        this.state.firebase.presenceRef.child(this.state.userId).set(isPresent);
        this.updateParticipantsCount();
    }

    sendMessage() {
        const now = Date.now();
        if (now - this.state.lastMessageTime < this.state.MESSAGE_RATE_LIMIT) {
            this.addSystemMessage('Please wait before sending another message');
            return;
        }
        
        const messageText = sanitizeInput(this.dom.messageInput.value.trim());
        if (!messageText) return;
        
        this.addMessage(messageText, 'sent');
        this.dom.messageInput.value = '';
        this.state.lastMessageTime = now;
        
        const messageData = {
            text: messageText,
            senderId: this.state.userId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        this.state.firebase.messagesRef.push(messageData).catch(error => {
            this.addSystemMessage('Failed to send message. Please check your connection.');
            console.error('Message send error:', error);
        });
    }

    addMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-text">${text}</div>
            <div class="message-time">${timestamp}</div>
        `;
        
        this.dom.chatMessages.appendChild(messageElement);
        scrollToBottom(this.dom.chatMessages);
    }

    addSystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'system');
        messageElement.textContent = text;
        this.dom.chatMessages.appendChild(messageElement);
        scrollToBottom(this.dom.chatMessages);
    }

    leaveChat() {
        this.updatePresence(false);
        this.resetChat();
    }

    startSessionExpiration() {
        this.dom.chatContainer.classList.add('hidden');
        this.dom.sessionExpiring.classList.remove('hidden');
        
        let secondsLeft = 10;
        this.dom.countdownElement.textContent = secondsLeft;
        
        this.state.countdownInterval = setInterval(() => {
            secondsLeft--;
            this.dom.countdownElement.textContent = secondsLeft;
            
            if (secondsLeft <= 0) {
                clearInterval(this.state.countdownInterval);
                this.expireSession();
            }
        }, 1000);
        
        this.state.expirationTimeout = setTimeout(() => this.expireSession(), 10000);
    }

    expireSession() {
        clearInterval(this.state.countdownInterval);
        this.resetChat();
    }

    resetChat() {
        if (this.state.firebase.presenceRef) {
            this.state.firebase.presenceRef.child(this.state.userId).set(false);
            this.state.firebase.presenceRef.off();
        }
        
        if (this.state.firebase.messagesRef) {
            this.state.firebase.messagesRef.off();
        }
        
        if (this.state.firebase.participantsRef) {
            this.state.firebase.participantsRef.child(this.state.userId).remove();
        }
        
        if (this.state.firebase.connectedRef) {
            this.state.firebase.connectedRef.off();
        }
        
        this.state.currentChatId = '';
        this.state.isHost = false;
        this.state.otherUserPresent = false;
        
        this.dom.chatMessages.innerHTML = '';
        this.dom.messageInput.value = '';
        this.dom.sessionExpiring.classList.add('hidden');
        this.dom.chatContainer.classList.add('hidden');
        this.dom.welcomeScreen.classList.remove('hidden');
        
        history.pushState("", document.title, window.location.pathname);
    }

    copyChatIdToClipboard() {
        navigator.clipboard.writeText(this.state.currentChatId).then(() => {
            showCopiedFeedback(this.dom.copyChatIdBtn);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }

    updateConnectionStatus() {
        if (this.state.connectionStatus) {
            this.dom.statusText.textContent = 'Connected';
            this.dom.statusText.style.color = 'var(--success)';
            document.querySelector('.connection-status i').className = 'fas fa-circle connected';
            this.dom.sendMessageBtn.disabled = false;
        } else {
            this.dom.statusText.textContent = 'Disconnected';
            this.dom.statusText.style.color = 'var(--danger)';
            document.querySelector('.connection-status i').className = 'fas fa-circle disconnected';
            this.dom.sendMessageBtn.disabled = true;
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new TempChatApp();
});
