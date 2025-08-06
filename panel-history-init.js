/**
 * History panel initialization script
 * Handles loading and displaying chat history
 */

// Initialize history when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('History panel initializing...');
    
    try {
        // Initialize ChatHistory if available
        if (typeof ChatHistory !== 'undefined') {
            console.log('ChatHistory class found, creating instance...');
            const chatHistory = new ChatHistory();
            
            // Make it globally available
            window.chatHistoryInstance = chatHistory;
            
            // Render the history list
            await renderHistoryList(chatHistory);
            
        } else {
            console.log('ChatHistory class not found, checking immediately...');
            // Check immediately without delay
            if (typeof ChatHistory !== 'undefined') {
                console.log('ChatHistory class found on immediate check...');
                const chatHistory = new ChatHistory();
                window.chatHistoryInstance = chatHistory;
                await renderHistoryList(chatHistory);
            } else {
                console.error('ChatHistory class still not available');
                showEmptyState('ChatHistory functionality not available');
            }
        }
        
    } catch (error) {
        console.error('Error initializing history:', error);
        showEmptyState('Error loading history');
    }
});

/**
 * Render the history list
 * @param {ChatHistory} chatHistory - ChatHistory instance
 */
async function renderHistoryList(chatHistory) {
    try {
        console.log('Rendering history list...');
        
        // Get history data
        const historyData = await chatHistory.getHistory();
        console.log('History data retrieved:', historyData ? historyData.length : 0, 'items');
        
        const historyList = document.getElementById('historyList');
        const emptyState = document.getElementById('emptyState');
        
        if (!historyList) {
            console.error('History list element not found');
            return;
        }
        
        if (!historyData || historyData.length === 0) {
            console.log('No history data, showing empty state');
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
            return;
        }
        
        // Hide empty state
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
        
        // Clear existing content
        historyList.innerHTML = '';
        
        // Create history items
        historyData.forEach((item, index) => {
            const historyItem = createHistoryItem(item, index);
            historyList.appendChild(historyItem);
        });
        
        console.log('History list rendered successfully');
        
    } catch (error) {
        console.error('Error rendering history list:', error);
        showEmptyState('Error displaying history');
    }
}

/**
 * Create a history item element
 * @param {Object} item - History item data
 * @param {number} index - Item index
 * @returns {HTMLElement} History item element
 */
function createHistoryItem(item, index) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.setAttribute('data-index', index);
    
    // Use existing title or extract from first message
    const title = item.title || (item.messages && item.messages.length > 0 
        ? item.messages[0].content.substring(0, 100) + (item.messages[0].content.length > 100 ? '...' : '')
        : 'Untitled Conversation');
    
    // Extract preview from assistant response
    const preview = item.messages && item.messages.length > 1
        ? item.messages[1].content.substring(0, 150) + (item.messages[1].content.length > 150 ? '...' : '')
        : 'No response yet';
    
    // Format date
    const date = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown date';
    
    historyItem.innerHTML = `
        <input type="text" class="history-title" value="${title}" readonly>
        <div class="history-preview">${preview}</div>
        <div class="history-meta">
            <div class="history-date">
                <i class="bi bi-clock"></i>
                <span>${date}</span>
            </div>
            <div class="history-actions">
                <button class="history-action-btn" title="Load conversation" onclick="event.stopPropagation(); loadHistoryItem(${index})">
                    <i class="bi bi-arrow-right"></i>
                </button>
                <button class="history-action-btn" title="Delete" onclick="event.stopPropagation(); deleteHistoryItem(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    // Get the title input element
    const titleInput = historyItem.querySelector('.history-title');
    
    // Add double-click handler to enable editing
    titleInput.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        titleInput.readOnly = false;
        titleInput.focus();
        titleInput.select();
    });
    
    // Prevent single click from triggering navigation
    titleInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Save on Enter or blur
    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            titleInput.blur();
        }
    });
    
    titleInput.addEventListener('blur', async () => {
        titleInput.readOnly = true;
        // Save the title here if needed
        console.log('Title changed to:', titleInput.value);
    });
    
    // Add click handler to load conversation
    historyItem.addEventListener('click', () => loadHistoryItem(index));
    
    return historyItem;
}

/**
 * Show empty state
 * @param {string} message - Message to display
 */
function showEmptyState(message = 'No chat history yet') {
    const historyList = document.getElementById('historyList');
    if (historyList) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-clock-history"></i>
                <h3>${message}</h3>
                <p>Your conversations will appear here</p>
            </div>
        `;
    }
}

/**
 * Load a history item (navigate to chat with this conversation)
 * @param {number} index - History item index
 */
async function loadHistoryItem(index) {
    try {
        console.log('Loading history item:', index);
        
        // Store the selected history item
        await chrome.storage.local.set({
            selectedHistoryItem: index,
            loadHistoryOnChatOpen: true
        });
        
        // Navigate to chat panel
        if (window.PanelNavigation && typeof window.PanelNavigation.navigateToPanel === 'function') {
            await window.PanelNavigation.navigateToPanel('chat');
        } else {
            console.error('PanelNavigation not available');
        }
        
    } catch (error) {
        console.error('Error loading history item:', error);
    }
}

/**
 * Delete a history item
 * @param {number} index - History item index
 */
async function deleteHistoryItem(index) {
    try {
        console.log('Deleting history item:', index);
        
        if (window.chatHistoryInstance && typeof window.chatHistoryInstance.deleteHistoryItem === 'function') {
            await window.chatHistoryInstance.deleteHistoryItem(index);
            
            // Re-render the list
            await renderHistoryList(window.chatHistoryInstance);
        } else {
            console.error('ChatHistory instance not available for deletion');
        }
        
    } catch (error) {
        console.error('Error deleting history item:', error);
    }
}


// Make functions globally available
window.loadHistoryItem = loadHistoryItem;
window.deleteHistoryItem = deleteHistoryItem;