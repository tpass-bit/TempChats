// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js";
import { 
    getDatabase, ref, onValue, set, push, onDisconnect, serverTimestamp, query 
} from "https://www.gstatic.com/firebasejs/9.17.2/firebase-database.js";

import firebaseConfig from './firebase-config.js'; // ✅ your config file
import {
    generateUserId,
    generateChatId,
    sanitizeInput,
    showCopiedFeedback,
    scrollToBottom,
    showError
} from './utils.js';

// Initialize Firebase using your config
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

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
        const addSafeListener = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };

        addSafeListener(this.dom.createChatBtn, 'click', () => this.createNewChat());
        addSafeListener(this.dom.joinChatBtn, 'click', () => this.joinExistingChat());
        addSafeListener(this.dom.copyChatIdBtn, 'click', () => this.copyChatIdToClipboard());
        addSafeListener(this.dom.sendMessageBtn, 'click', () => this.sendMessage());
        addSafeListener(this.dom.leaveChatBtn, 'click', () => this.leaveChat());
        addSafeListener(this.dom.closeNowBtn, 'click', () => this.expireSession());
        addSafeListener(this.dom.infoBtn, 'click', () => this.showInfoModal());
        addSafeListener(this.dom.closeInfoBtn, 'click', () => this.hideInfoModal());
        addSafeListener(this.dom.shareBtn, 'click', () => this.showShareModal());
        addSafeListener(this.dom.closeShareBtn, 'click', () => this.hideShareModal());
        addSafeListener(this.dom.copyShareBtn, 'click', () => this.copyShareLink());
        addSafeListener(this.dom.copyDirectShareBtn, 'click', () => this.copyDirectShareLink());
        addSafeListener(this.dom.shareWhatsApp, 'click', () => this.shareViaWhatsApp());
        addSafeListener(this.dom.shareTelegram, 'click', () => this.shareViaTelegram());
        addSafeListener(this.dom.shareEmail, 'click', () => this.shareViaEmail());

        if (this.dom.messageInput) {
            this.dom.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
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
        const connectedRef = ref(database, '.info/connected');
        onValue(connectedRef, (snap) => {
            this.state.connectionStatus = snap.val();
            this.updateConnectionStatus();
        });
        this.state.firebase.connectedRef = connectedRef;
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
        this.state.firebase.chatRef = ref(database, `chats/${this.state.currentChatId}`);
        this.state.firebase.messagesRef = ref(database, `chats/${this.state.currentChatId}/messages`);
        this.state.firebase.presenceRef = ref(database, `chats/${this.state.currentChatId}/presence`);
        this.state.firebase.participantsRef = ref(database, `chats/${this.state.currentChatId}/participants`);

        onValue(this.state.firebase.messagesRef, (snapshot) => {
            snapshot.forEach((child) => {
                const msg = child.val();
                if (msg.senderId !== this.state.userId) {
                    this.addMessage(msg.text, 'received');
                }
            });
        });

        set(ref(database, `chats/${this.state.currentChatId}/participants/${this.state.userId}`), {
            joinedAt: serverTimestamp(),
            isHost: this.state.isHost
        });

        onDisconnect(ref(database, `chats/${this.state.currentChatId}/participants/${this.state.userId}`)).remove();
        onDisconnect(ref(database, `chats/${this.state.currentChatId}/presence/${this.state.userId}`)).set(false);
    }

    // Clipboard fallback
    copyFallback(text) {
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.value = text;
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    }

    copyShareLink() {
        const text = this.dom.shareLinkInput.value;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(() => showCopiedFeedback(this.dom.copyShareBtn))
                .catch(() => this.copyFallback(text));
        } else this.copyFallback(text);
    }

    copyDirectShareLink() {
        const text = this.dom.directShareInput.value;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(() => showCopiedFeedback(this.dom.copyDirectShareBtn))
                .catch(() => this.copyFallback(text));
        } else this.copyFallback(text);
    }

    updateConnectionStatus() {
        if (this.state.connectionStatus) {
            this.dom.statusText.textContent = 'Connected';
            this.dom.statusText.style.color = 'var(--success)';
            const icon = document.querySelector('.connection-status i');
            if (icon) icon.className = 'fas fa-circle connected';
            if (this.dom.sendMessageBtn) this.dom.sendMessageBtn.disabled = false;
        } else {
            this.dom.statusText.textContent = 'Disconnected';
            this.dom.statusText.style.color = 'var(--danger)';
            const icon = document.querySelector('.connection-status i');
            if (icon) icon.className = 'fas fa-circle disconnected';
            if (this.dom.sendMessageBtn) this.dom.sendMessageBtn.disabled = true;
        }
    }
}

// Global error catcher
window.addEventListener('error', (e) => {
    console.error("Global Error:", e.message, e.error);
});

// Start app
document.addEventListener('DOMContentLoaded', () => {
    new TempChatApp();
});
