// Mobile sidebar toggle functionality and real-time history sync
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('historySidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebarClose = document.getElementById('sidebarClose');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            sidebarOverlay.classList.add('active');
            // Load latest history when opening sidebar
            loadHistoryInSidebar();
        });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // Real-time history synchronization
    setupHistorySynchronization();
});

/**
 * Setup real-time history synchronization for standalone chat
 */
function setupHistorySynchronization() {
    // Listen for storage changes from other tabs/windows
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && (changes.chatHistory || changes.recentConversation)) {
                console.log('Chat history changed in another tab, refreshing...');
                refreshHistoryDisplay();
            }
        });
    }

    // Listen for EventBus events from the main chat system
    if (window.eventBus) {
        window.eventBus.on('history:updated', () => {
            console.log('History updated via EventBus, refreshing...');
            refreshHistoryDisplay();
        });

        window.eventBus.on('conversation:saved', (data) => {
            console.log('Conversation saved via EventBus:', data.id);
            refreshHistoryDisplay();
        });

        window.eventBus.on('conversation:deleted', (data) => {
            console.log('Conversation deleted via EventBus:', data.id);
            refreshHistoryDisplay();
        });
    }

    // Poll for changes as fallback (every 30 seconds)
    setInterval(() => {
        refreshHistoryDisplay();
    }, 30000);

    // Initial load
    loadHistoryInSidebar();
    
    // Initialize configuration status for standalone
    initializeConfigurationStatusForStandalone();
}

/**
 * Load history in the sidebar
 */
async function loadHistoryInSidebar() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    try {
        let conversations = [];
        
        // Direct Chrome storage access
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['chatHistory']);
                conversations = result.chatHistory || [];
                console.log('Loaded history from direct storage:', conversations.length);
            }
        } catch (error) {
            console.error('Failed to load history:', error);
            conversations = [];
        }

        renderHistoryInSidebar(conversations);
    } catch (error) {
        console.error('Error loading history in sidebar:', error);
        historyList.innerHTML = '<div class="p-3 text-center text-muted">Error loading history</div>';
    }
}

/**
 * Render history in the sidebar
 */
function renderHistoryInSidebar(conversations) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    if (!conversations || conversations.length === 0) {
        historyList.innerHTML = '<div class="p-3 text-center text-muted">No conversations found</div>';
        return;
    }

    // Sort by timestamp (newest first)
    const sortedConversations = conversations.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    const historyItems = sortedConversations.map(conversation => {
        const timestamp = new Date(conversation.timestamp).toLocaleString();
        const title = conversation.title || 'Untitled Conversation';
        const provider = (conversation.provider || 'unknown').toUpperCase();
        let model = conversation.model || 'unknown';
        
        // Remove "models/" prefix if it already exists to avoid duplication
        if (model.startsWith('models/')) {
            model = model.substring(7); // Remove "models/" prefix
        }

        return `
            <div class="history-item" data-conversation-id="${conversation.id || ''}">
                <input type="text" class="history-title" value="${title}" readonly data-conversation-id="${conversation.id || ''}">
                <div class="history-preview">${conversation.messages && conversation.messages.length > 1 ? conversation.messages[1].content.substring(0, 150) + '...' : 'No response yet'}</div>
                <div class="history-meta">
                    <div class="history-date">
                        <i class="bi bi-clock"></i>
                        <span>${timestamp}</span>
                    </div>
                    <div class="history-actions">
                        <button class="history-action-btn" title="Load conversation" data-conversation-id="${conversation.id || ''}">
                            <i class="bi bi-arrow-right"></i>
                        </button>
                        <button class="history-action-btn" title="Delete" data-conversation-id="${conversation.id || ''}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    historyList.innerHTML = historyItems;

    // Add click handlers to load conversations
    historyList.querySelectorAll('.history-item').forEach(item => {
        const titleInput = item.querySelector('.history-title');
        const conversationId = item.dataset.conversationId;
        const conversation = sortedConversations.find(c => (c.id || '') === conversationId);
        
        // Add double-click handler for title editing
        titleInput.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent navigation on single click
        });
        
        titleInput.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            titleInput.readOnly = false;
            titleInput.focus();
            titleInput.select();
        });
        
        titleInput.addEventListener('blur', async () => {
            titleInput.readOnly = true;
            if (titleInput.value.trim() !== conversation.title) {
                await updateTitleInStandalone(conversationId, titleInput.value.trim());
            }
        });
        
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                titleInput.blur();
            }
        });
        
        // Main item click handler
        item.addEventListener('click', (e) => {
            // Check if click is on action button or its icon
            const actionBtn = e.target.closest('.history-action-btn');
            
            if (actionBtn) {
                e.stopPropagation();
                const actionConversationId = actionBtn.getAttribute('data-conversation-id');
                if (actionBtn.title === 'Load conversation') {
                    const conversation = sortedConversations.find(c => (c.id || '') === actionConversationId);
                    if (conversation) {
                        loadConversationInStandalone(conversation);
                        // Close sidebar on mobile after selection
                        if (window.innerWidth <= 768) {
                            sidebar.classList.remove('mobile-open');
                            sidebarOverlay.classList.remove('active');
                        }
                    }
                } else if (actionBtn.title === 'Delete') {
                    deleteConversationInStandalone(actionConversationId);
                }
            } else if (!e.target.closest('.history-title')) {
                // Click on history item itself (but not on title)
                const conversation = conversations.find(c => (c.id || '') === conversationId);
                if (conversation) {
                    loadConversationInStandalone(conversation);
                    // Close sidebar on mobile after selection
                    if (window.innerWidth <= 768) {
                        sidebar.classList.remove('mobile-open');
                        sidebarOverlay.classList.remove('active');
                    }
                }
            }
        });
    });
}

/**
 * Load a conversation in standalone chat
 */
function loadConversationInStandalone(conversation) {
    try {
        // Dispatch the load event that the main chat system listens for
        console.log('Dispatching loadConversation event from standalone with:', conversation);
        window.dispatchEvent(new CustomEvent('loadConversation', {
            detail: {
                ...conversation,
                source: 'standalone'
            }
        }));
        console.log('loadConversation event dispatched from standalone');
    } catch (error) {
        console.error('Error loading conversation in standalone:', error);
    }
}

/**
 * Delete a conversation in standalone chat
 */
async function deleteConversationInStandalone(conversationId) {
    try {
        // Get current history
        const result = await chrome.storage.local.get(['chatHistory']);
        const history = result.chatHistory || [];
        
        // Filter out the conversation to delete
        const updatedHistory = history.filter(h => h.id !== conversationId);
        
        // Save updated history
        await chrome.storage.local.set({ chatHistory: updatedHistory });
        
        // Refresh the display
        refreshHistoryDisplay();
        
        console.log('Deleted conversation in standalone:', conversationId);
    } catch (error) {
        console.error('Error deleting conversation in standalone:', error);
    }
}

/**
 * Update conversation title in standalone chat
 */
async function updateTitleInStandalone(conversationId, newTitle) {
    try {
        // Get current history
        const result = await chrome.storage.local.get(['chatHistory']);
        const history = result.chatHistory || [];
        
        // Find and update the conversation
        const conversation = history.find(h => h.id === conversationId);
        if (conversation) {
            conversation.title = newTitle.trim() || 'Untitled Conversation';
            
            // Save updated history
            await chrome.storage.local.set({ chatHistory: history });
            
            console.log('Updated conversation title in standalone:', conversationId, newTitle);
        }
    } catch (error) {
        console.error('Error updating conversation title in standalone:', error);
    }
}

/**
 * Refresh history display
 */
function refreshHistoryDisplay() {
    // Debounce rapid updates
    if (refreshHistoryDisplay.timeout) {
        clearTimeout(refreshHistoryDisplay.timeout);
    }
    
    refreshHistoryDisplay.timeout = setTimeout(() => {
        loadHistoryInSidebar();
    }, 250);
}

/**
 * Initialize configuration status for standalone chat
 */
async function initializeConfigurationStatusForStandalone() {
    try {
        // Wait for chat controller to be available
        const waitForController = () => {
            return new Promise((resolve) => {
                const checkController = () => {
                    if (window.container) {
                        try {
                            const controller = window.container.get('chatController');
                            if (controller && controller.updateCurrentProviderAndModel) {
                                resolve(controller);
                                return;
                            }
                        } catch (error) {
                            // Controller not ready yet
                        }
                    }
                    setTimeout(checkController, 100);
                };
                checkController();
            });
        };

        const controller = await waitForController();
        
        // Initialize configuration status
        await controller.updateCurrentProviderAndModel();
        
        console.log('Configuration status initialized for standalone chat');
    } catch (error) {
        console.error('Failed to initialize configuration status for standalone:', error);
    }
}