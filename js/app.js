// app.js
class TempChatApp {
    constructor() {
        this.initDomElements();
        this.initState();
        this.initEventListeners();
        this.checkUrlHash();
        this.setupConnectionListener();
    }

    // ---------------- DOM Elements ----------------
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
            joinSection: document.querySelector('.join-section'),
            refreshBtn: document.getElementById('refreshBtn')
        };
    }

    // ---------------- State ----------------
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
            firebase: {}
        };
    }

    // ---------------- Events ----------------
    initEventListeners() {
        const safe = (el, ev, fn) => el && el.addEventListener(ev, fn);

        safe(this.dom.createChatBtn, 'click', () => this.createNewChat());
        safe(this.dom.joinChatBtn, 'click', () => this.joinExistingChat());
        safe(this.dom.copyChatIdBtn, 'click', () => this.copyChatIdToClipboard());
        safe(this.dom.sendMessageBtn, 'click', () => this.sendMessage());
        safe(this.dom.leaveChatBtn, 'click', () => this.leaveChat());
        safe(this.dom.closeNowBtn, 'click', () => this.expireSession());
        safe(this.dom.infoBtn, 'click', () => this.showInfoModal());
        safe(this.dom.closeInfoBtn, 'click', () => this.hideInfoModal());
        safe(this.dom.shareBtn, 'click', () => this.showShareModal());
        safe(this.dom.closeShareBtn, 'click', () => this.hideShareModal());
        safe(this.dom.copyShareBtn, 'click', () => this.copyShareLink());
        safe(this.dom.copyDirectShareBtn, 'click', () => this.copyDirectShareLink());
        safe(this.dom.shareWhatsApp, 'click', () => this.shareViaWhatsApp());
        safe(this.dom.shareTelegram, 'click', () => this.shareViaTelegram());
        safe(this.dom.shareEmail, 'click', () => this.shareViaEmail());
        safe(this.dom.refreshBtn, 'click', () => location.reload());

        if (this.dom.messageInput) {
            this.dom.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
    }

    // ---------------- Connection ----------------
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
        this.state.firebase.connectedRef = firebase.database().ref('.info/connected');
        this.state.firebase.connectedRef.on('value', (snap) => {
            this.state.connectionStatus = snap.val();
            this.updateConnectionStatus();
        });
    }

    // ---------------- Chat Logic ----------------
    createNewChat() {
        this.state.currentChatId = generateChatId();
        this.state.isHost = true;
        window.location.hash = this.state.currentChatId;

        this.setupFirebaseReferences();
        this.updatePresence(true);

        this.dom.displayChatId.textContent = this.state.currentChatId;
        this.dom.welcomeScreen.classList.add('hidden');
        this.dom.chatContainer.classList.remove('hidden');

        this.addSystemMessage('You created a new temporary chat. Share the ID!');
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
        const db = firebase.database();
        this.state.firebase.chatRef = db.ref(`chats/${this.state.currentChatId}`);
        this.state.firebase.messagesRef = this.state.firebase.chatRef.child('messages');
        this.state.firebase.presenceRef = this.state.firebase.chatRef.child('presence');
        this.state.firebase.participantsRef = this.state.firebase.chatRef.child('participants');

        // Messages
        this.state.firebase.messagesRef.limitToLast(100).on('child_added', (snapshot) => {
            const msg = snapshot.val();
            if (msg.senderId !== this.state.userId) {
                this.addMessage(msg.text, 'received');
            }
        });

        // Participants
        this.state.firebase.participantsRef.child(this.state.userId).set({
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            isHost: this.state.isHost
        });

        this.state.firebase.participantsRef.child(this.state.userId).onDisconnect().remove();
        this.state.firebase.presenceRef.child(this.state.userId).onDisconnect().set(false);
    }

    // ---------------- Sharing ----------------
    updateShareLinks() {
        const link = `${window.location.origin}${window.location.pathname}#${this.state.currentChatId}`;
        this.dom.shareLinkInput.value = link;
        this.dom.directShareInput.value = link;
        this.initQRCode(link);
    }

    initQRCode(link) {
        if (this.state.qrCode) {
            this.state.qrCode.clear();
            this.state.qrCode.makeCode(link);
        } else {
            this.state.qrCode = new QRCode(this.dom.qrCodeCanvas, {
                text: link,
                width: 150,
                height: 150,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    shareViaWhatsApp() {
        const link = this.dom.directShareInput.value;
        window.open(`https://wa.me/?text=${encodeURIComponent(`Join this chat: ${link}`)}`, '_blank');
    }
    shareViaTelegram() {
        const link = this.dom.directShareInput.value;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=Join this chat`, '_blank');
    }
    shareViaEmail() {
        const link = this.dom.directShareInput.value;
        window.location.href = `mailto:?subject=Join my temp chat&body=Click this link: ${encodeURIComponent(link)}`;
    }

    // ---------------- Clipboard ----------------
    copyShareLink() {
        this.copyToClipboard(this.dom.shareLinkInput.value, this.dom.copyShareBtn);
    }
    copyDirectShareLink() {
        this.copyToClipboard(this.dom.directShareInput.value, this.dom.copyDirectShareBtn);
    }
    copyChatIdToClipboard() {
        this.copyToClipboard(this.state.currentChatId, this.dom.copyChatIdBtn);
    }
    copyToClipboard(text, btn) {
        navigator.clipboard?.writeText(text).then(() => {
            showCopiedFeedback(btn);
        }).catch(() => {
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        });
    }

    // ---------------- Messages ----------------
    sendMessage() {
        const now = Date.now();
        if (now - this.state.lastMessageTime < this.state.MESSAGE_RATE_LIMIT) {
            this.addSystemMessage('Please wait before sending another message');
            return;
        }

        const text = sanitizeInput(this.dom.messageInput.value.trim());
        if (!text) return;

        this.addMessage(text, 'sent');
        this.dom.messageInput.value = '';
        this.state.lastMessageTime = now;

        this.state.firebase.messagesRef.push({
            text,
            senderId: this.state.userId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {
            this.addSystemMessage('Failed to send message.');
        });
    }

    addMessage(text, type) {
        const el = document.createElement('div');
        el.classList.add('message', type);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        el.innerHTML = `<div class="message-text">${text}</div><div class="message-time">${time}</div>`;
        this.dom.chatMessages.appendChild(el);
        scrollToBottom(this.dom.chatMessages);
    }

    addSystemMessage(text) {
        const el = document.createElement('div');
        el.classList.add('message', 'system');
        el.textContent = text;
        this.dom.chatMessages.appendChild(el);
        scrollToBottom(this.dom.chatMessages);
    }

    // ---------------- Presence ----------------
    listenForParticipants() {
        this.state.firebase.presenceRef.on('value', (snap) => {
            const data = snap.val() || {};
            const others = Object.keys(data).filter(uid => uid !== this.state.userId && data[uid]);
            if (others.length > 0 && !this.state.otherUserPresent) {
                this.state.otherUserPresent = true;
                this.addSystemMessage('Someone joined the chat!');
                this.updateParticipantsCount();
            } else if (others.length === 0 && this.state.otherUserPresent) {
                this.state.otherUserPresent = false;
                this.addSystemMessage('Other participant left');
                this.updateParticipantsCount();
                if (this.state.isHost) this.startSessionExpiration();
            }
        });
    }

    checkHostPresence() {
        this.state.firebase.presenceRef.on('value', (snap) => {
            const data = snap.val() || {};
            this.state.firebase.participantsRef.orderByChild('isHost').equalTo(true).once('value', (hostSnap) => {
                const hosts = hostSnap.val() || {};
                const hostIds = Object.keys(hosts);
                const hostPresent = hostIds.some(id => id !== this.state.userId && data[id]);
                if (!hostPresent) {
                    this.addSystemMessage('Host has left. Chat will expire soon.');
                    this.startSessionExpiration();
                }
            });
        });
    }

    updateParticipantsCount() {
        this.state.firebase.presenceRef.once('value').then(snap => {
            const data = snap.val() || {};
            const count = Object.keys(data).filter(uid => data[uid]).length;
            this.dom.infoParticipants.textContent = count;
        });
    }

    updatePresence(isPresent) {
        this.state.firebase.presenceRef.child(this.state.userId).set(isPresent);
        this.updateParticipantsCount();
    }

    // ---------------- Expiration ----------------
    startSessionExpiration() {
        this.dom.chatContainer.classList.add('hidden');
        this.dom.sessionExpiring.classList.remove('hidden');

        let seconds = 10;
        this.dom.countdownElement.textContent = seconds;

        this.state.countdownInterval = setInterval(() => {
            seconds--;
            this.dom.countdownElement.textContent = seconds;
            if (seconds <= 0) {
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

    // ---------------- Reset ----------------
    leaveChat() {
        this.updatePresence(false);
        this.resetChat();
    }

    resetChat() {
        if (this.state.firebase.presenceRef) {
            this.state.firebase.presenceRef.child(this.state.userId).set(false);
            this.state.firebase.presenceRef.off();
        }
        if (this.state.firebase.messagesRef) this.state.firebase.messagesRef.off();
        if (this.state.firebase.participantsRef) this.state.firebase.participantsRef.child(this.state.userId).remove();
        if (this.state.firebase.connectedRef) this.state.firebase.connectedRef.off();

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

    // ---------------- UI ----------------
    showShareModal() { this.updateShareLinks(); this.dom.shareModal.classList.remove('hidden'); }
    hideShareModal() { this.dom.shareModal.classList.add('hidden'); }
    showInfoModal() {
        this.dom.infoChatId.textContent = this.state.currentChatId;
        this.dom.infoUserId.textContent = this.state.userId;
        this.updateParticipantsCount();
        this.updateShareLinks();
        this.dom.infoModal.classList.remove('hidden');
    }
    hideInfoModal() { this.dom.infoModal.classList.add('hidden'); }

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

// Start app
document.addEventListener('DOMContentLoaded', () => {
    new TempChatApp();
});
