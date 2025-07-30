// utils.js
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

function sanitizeInput(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showCopiedFeedback(button) {
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
        button.innerHTML = originalHTML;
    }, 2000);
}

function scrollToBottom(element) {
    setTimeout(() => {
        element.scrollTop = element.scrollHeight;
    }, 50);
}

function showError(message, parentElement) {
    const errorElement = document.createElement('div');
    errorElement.classList.add('message', 'system');
    errorElement.textContent = message;
    errorElement.style.color = 'var(--danger)';
    errorElement.style.animation = 'shake 0.5s ease-in-out';
    
    parentElement.parentNode.insertBefore(errorElement, parentElement.nextSibling);
    
    setTimeout(() => {
        errorElement.remove();
    }, 3000);
}
