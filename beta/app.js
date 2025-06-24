            addMessageToUI(message);
            
            // Play sound if enabled and message is from another user
            if (soundToggle.checked && message.senderId !== userId) {
                messageSound.currentTime = 0;
                messageSound.play();
            }
            
            // Show notification if window is not focused
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
            // Set presence to true and create onDisconnect to set to false
            myPresenceRef.set(true);
            myPresenceRef.onDisconnect().set(false);
        } else {
            // Remove presence
            myPresenceRef.remove();
            myPresenceRef.onDisconnect().cancel();
        }
    }

    function listenForParticipants() {
        presenceRef.on('value', (snapshot) => {
            const participants = snapshot.val() || {};
            const participantCount = Object.keys(participants).length;
            
            // Update participants list
            updateParticipantsList(participants);
            
            // Check if other users are present
            const newOtherUserPresent = participantCount > 1;
            
            if (newOtherUserPresent && !otherUserPresent) {
                // Another user joined
                otherUserPresent = true;
                addSystemMessage('Someone joined the chat!');
                
                // Cancel any pending expiration
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
                // Last other user left
                otherUserPresent = false;
                addSystemMessage('The other participant left the chat');
                
                // Start expiration countdown if host
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
                // Host not present
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
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        if (expirationTimeout) {
            clearTimeout(expirationTimeout);
        }
        
        // Clear chat data if host
        if (isHost) {
            chatRef.remove();
        }
        
        // Leave chat
        leaveChat();
    }

    function leaveChat() {
        // Update presence
        updatePresence(false);
        
        // Clear references
        if (messagesRef) messagesRef.off();
        if (presenceRef) presenceRef.off();
        
        // Reset UI
        chatContainer.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
        chatMessages.innerHTML = '';
        messageInput.value = '';
        currentChatId = '';
        isHost = false;
        otherUserPresent = false;
        
        // Remove hash from URL
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
        
        // Update QR code
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
        if (emojiPicker.classList.contains('hidden')) {
            emojiPicker.classList.remove('hidden');
        } else {
            emojiPicker.classList.add('hidden');
        }
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
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
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
