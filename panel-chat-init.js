/**
 * Chat panel initialization script
 * Handles loading history items when navigating from history panel
 */

// Initialize chat panel
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Chat panel initializing...');
    
    try {
        // Check if we should load a history item
        const storage = await chrome.storage.local.get(['selectedHistoryItem', 'loadHistoryOnChatOpen']);
        
        if (storage.loadHistoryOnChatOpen && storage.selectedHistoryItem !== undefined) {
            console.log('Loading history item on chat open:', storage.selectedHistoryItem);
            
            // Clear the flags
            await chrome.storage.local.remove(['selectedHistoryItem', 'loadHistoryOnChatOpen']);
            
            // Wait for chat to be ready then load the history
            setTimeout(() => {
                loadHistoryIntoChat(storage.selectedHistoryItem);
            }, 100);
        }
        
    } catch (error) {
        console.error('Error initializing chat panel:', error);
    }
});

/**
 * Load a history item into the chat using the main event system
 * @param {number} historyIndex - Index of history item to load
 */
async function loadHistoryIntoChat(historyIndex) {
    try {
        console.log('Loading history item into chat:', historyIndex);
        
        // Get chat history instance
        let chatHistory;
        if (window.chatHistoryInstance) {
            chatHistory = window.chatHistoryInstance;
        } else if (typeof ChatHistory !== 'undefined') {
            chatHistory = new ChatHistory();
            window.chatHistoryInstance = chatHistory;
        } else {
            console.error('ChatHistory not available');
            return;
        }
        
        // Get the history data
        const historyData = await chatHistory.getHistory();
        if (!historyData || !historyData[historyIndex]) {
            console.error('History item not found:', historyIndex);
            return;
        }
        
        const historyItem = historyData[historyIndex];
        console.log('Loading conversation with', historyItem.messages?.length || 0, 'messages');
        
        // Use the main event system instead of direct DOM manipulation
        console.log('Dispatching loadConversation event from panel with:', historyItem);
        window.dispatchEvent(new CustomEvent('loadConversation', {
            detail: {
                ...historyItem,
                source: 'panel'
            }
        }));
        console.log('loadConversation event dispatched from panel');
        
    } catch (error) {
        console.error('Error loading history into chat:', error);
    }
}

/**
 * Add a message to the chat UI
 * @param {Object} message - Message object with role and content
 */
function addMessageToChat(message) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    const timestamp = new Date().toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${message.role === 'user' ? 'U' : 'AI'}
        </div>
        <div class="message-content">
            <div class="message-text">${message.content}</div>
            <div class="message-timestamp">${timestamp}</div>
        </div>
    `;
    
    messagesList.appendChild(messageDiv);
}

// Make functions globally available
window.loadHistoryIntoChat = loadHistoryIntoChat;