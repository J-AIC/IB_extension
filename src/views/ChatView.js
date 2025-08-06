/**
 * ChatView.js
 * 
 * This file defines the ChatView class, which represents the view for the chat functionality.
 * It extends the base View class from the architecture.js file.
 */

import { View } from '../architecture.js';

/**
 * ChatView class
 * 
 * Represents the view for the chat functionality.
 * Renders messages and handles user interactions.
 */
export class ChatView extends View {
    /**
     * Constructor
     * 
     * @param {HTMLElement|string} element - The DOM element or selector for the view
     * @param {Object} model - The chat model
     * @param {Object} [options={}] - Additional options for the view
     */
    constructor(element, model, options = {}) {
        super(element, model);
        
        this.options = {
            inputSelector: '.chat-input',
            sendButtonSelector: '.chat-send-button',
            messagesContainerSelector: '.chat-messages',
            loadingIndicatorClass: 'is-processing',
            ...options
        };
        
        // Cache DOM elements
        this.inputElement = this.element.querySelector(this.options.inputSelector);
        this.sendButtonElement = this.element.querySelector(this.options.sendButtonSelector);
        this.messagesContainerElement = this.element.querySelector(this.options.messagesContainerSelector);
        
        // Cache modern interface elements
        this.welcomeStateElement = this.element.querySelector('#welcomeState');
        this.messagesListElement = this.element.querySelector('#messagesList');
        this.thinkingContainerElement = this.element.querySelector('#thinkingContainer');
        this.webContextBtnElement = this.element.querySelector('#webContextBtn');
        this.sendIconElement = this.element.querySelector('#sendIcon');
        this.loadingSpinnerElement = this.element.querySelector('#loadingSpinner');
        
        // Message storage for HTML content and editing
        this.messageHtmlContent = new Map();
        this.messages = [];
        
        // Bind event handlers
        this.handleSendClick = this.handleSendClick.bind(this);
        this.handleInputKeydown = this.handleInputKeydown.bind(this);
        this.handleWebContextClick = this.handleWebContextClick.bind(this);
        
        // Web context state
        this.webContextEnabled = false;
        
        // Initialize event listeners
        this.initializeEventListeners();
        
        // Initialize guide bubble after a short delay to ensure page context is available
        setTimeout(() => {
            this.updateGuideBubbleIfNeeded().catch(error => {
                console.error('Error initializing guide bubble:', error);
            });
        }, 500);
        
        // Listen for visibility changes to refresh guide bubble when extension is reopened
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Extension became visible, refresh guide bubble
                setTimeout(() => {
                    this.updateGuideBubbleIfNeeded().catch(error => {
                        console.error('Error refreshing guide bubble on visibility change:', error);
                    });
                }, 100);
            }
        });
        
        // Listen for tab URL changes to update guide bubble
        if (chrome?.tabs?.onUpdated) {
            chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
                // Only process if URL changed and tab is active
                if (changeInfo.url && tab.active) {
                    console.log('Tab URL changed:', changeInfo.url);
                    
                    // Update page context with new URL
                    const newPageContext = {
                        url: changeInfo.url,
                        title: tab.title || document.title || 'Current Page'
                    };
                    
                    // Update the model's page context
                    this.model.set('pageContext', newPageContext);
                    
                    // Update guide bubble for new URL
                    setTimeout(() => {
                        this.updateGuideBubbleIfNeeded().catch(error => {
                            console.error('Error updating guide bubble on URL change:', error);
                        });
                    }, 100);
                }
            });
        }
        
        // Also poll for URL changes as a fallback (for SPAs)
        this.lastCheckedUrl = null;
        this.urlCheckInterval = setInterval(async () => {
            if (chrome?.tabs?.query) {
                try {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tabs && tabs.length > 0) {
                        const currentUrl = tabs[0].url;
                        if (currentUrl && currentUrl !== this.lastCheckedUrl) {
                            this.lastCheckedUrl = currentUrl;
                            console.log('URL change detected via polling:', currentUrl);
                            
                            // Update page context
                            const newPageContext = {
                                url: currentUrl,
                                title: tabs[0].title || document.title || 'Current Page'
                            };
                            this.model.set('pageContext', newPageContext);
                            
                            // Update guide bubble
                            this.updateGuideBubbleIfNeeded().catch(error => {
                                console.error('Error updating guide bubble on polled URL change:', error);
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error polling for URL changes:', error);
                }
            }
        }, 1000); // Check every second
    }
    
    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        if (this.sendButtonElement) {
            this.sendButtonElement.addEventListener('click', this.handleSendClick);
        }
        
        if (this.inputElement) {
            this.inputElement.addEventListener('keydown', this.handleInputKeydown);
        }
        
        // Set up message container click delegation
        if (this.messagesContainerElement) {
            this.messagesContainerElement.addEventListener('click', (event) => {
                this.handleMessageClick(event);
            });
        }
        
        // Set up web context button
        if (this.webContextBtnElement) {
            this.webContextBtnElement.addEventListener('click', this.handleWebContextClick);
        }
        
        // Set up textarea auto-resize
        if (this.inputElement) {
            this.inputElement.addEventListener('input', () => {
                this.adjustTextareaHeight(this.inputElement);
            });
        }
    }
    
    /**
     * Handle message container clicks (delegation)
     */
    handleMessageClick(event) {
        const target = event.target;
        
        // Handle edit buttons
        if (target.classList.contains('edit-message-btn') || target.closest('.edit-message-btn')) {
            const button = target.classList.contains('edit-message-btn') ? target : target.closest('.edit-message-btn');
            const messageId = button.dataset.messageId;
            if (messageId) {
                this.enableEditMode(messageId);
            }
        }
        
        // Handle site info buttons
        if (target.classList.contains('site-info-btn') || target.closest('.site-info-btn')) {
            const button = target.classList.contains('site-info-btn') ? target : target.closest('.site-info-btn');
            const messageId = button.dataset.messageId;
            if (messageId) {
                this.showSiteInfoModal(messageId);
            }
        }
        
        // Handle recommendation buttons
        if (target.classList.contains('recommendation-button')) {
            const recommendation = target.textContent.trim();
            if (this.inputElement) {
                this.inputElement.value = recommendation;
                this.inputElement.focus();
            }
        }
        
        // Handle edit area buttons
        if (target.classList.contains('cancel-edit')) {
            const messageDiv = target.closest('.message');
            if (messageDiv) {
                this.cancelEditMode(messageDiv);
            }
        }
        
        if (target.classList.contains('save-edit')) {
            const messageDiv = target.closest('.message');
            if (messageDiv) {
                this.saveEditMode(messageDiv);
            }
        }
    }
    
    /**
     * Handle send button click
     * 
     * @param {Event} event - The click event
     */
    handleSendClick(event) {
        event.preventDefault();
        
        if (this.controller) {
            const message = this.inputElement.value.trim();
            
            if (message) {
                // Hide welcome state when first message is sent
                this.hideWelcomeState();
                
                // Show loading state
                this.showLoadingState();
                
                // Send message with guide context handled internally
                this.controller.sendMessage(message, {
                    guideContext: this.currentGuidedContext || null
                });
                
                this.inputElement.value = '';
                this.adjustTextareaHeight(this.inputElement);
                // Maintain focus on the input
                this.inputElement.focus();
            }
        }
    }
    
    /**
     * Handle input keydown
     * 
     * @param {KeyboardEvent} event - The keydown event
     */
    handleInputKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSendClick(event);
        }
    }
    
    /**
     * Handle web context button click
     * 
     * @param {Event} event - The click event
     */
    handleWebContextClick(event) {
        event.preventDefault();
        
        this.webContextEnabled = !this.webContextEnabled;
        
        console.log('Web context button clicked, enabled:', this.webContextEnabled);
        
        if (this.webContextBtnElement) {
            if (this.webContextEnabled) {
                this.webContextBtnElement.classList.add('active');
                this.webContextBtnElement.title = 'Web context enabled - page content will be included';
            } else {
                this.webContextBtnElement.classList.remove('active');
                this.webContextBtnElement.title = 'Add web page context';
            }
        }
        
        // Update model with web context setting
        if (this.model) {
            this.model.set('includePageContext', this.webContextEnabled);
            console.log('Model includePageContext set to:', this.model.get('includePageContext'));
        }
    }
    
    
    /**
     * Render a user message
     */
    renderUserMessage(messageDiv, message, messageTime) {
        let siteInfoButton = '';
        if (message.pageHTML) {
            this.messageHtmlContent.set(message.id, message.pageHTML);
            siteInfoButton = `
                <button class="site-info-btn" data-message-id="${message.id}">
                    <i class="bi bi-globe"></i>
                </button>
            `;
        }
        
        let editButton = '';
        const messages = this.model.get('messages') || [];
        // Only show edit button if this is not the first message and there are other messages
        if (messages.length > 1 && messages.findIndex(m => m.id === message.id) > 0) {
            editButton = `
                <button class="edit-message-btn" data-message-id="${message.id}" style="display: none;">
                    <i class="bi bi-pencil"></i>
                </button>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text" data-original-content="${message.content}">${message.content}</div>
                <div class="edit-area" data-has-listeners="false">
                    <textarea class="form-control">${message.content}</textarea>
                    <div class="edit-buttons">
                        <button class="btn btn-secondary cancel-edit">キャンセル</button>
                        <button class="btn btn-primary save-edit">保存</button>
                    </div>
                </div>
                <div class="message-footer">
                    <span class="timestamp">${messageTime}</span>
                    ${editButton}
                    ${siteInfoButton}
                </div>
            </div>
        `;
        
        // Set up textarea auto-resize
        const textarea = messageDiv.querySelector('textarea');
        if (textarea) {
            textarea.addEventListener('input', () => {
                this.adjustTextareaHeight(textarea);
            });
        }
        
        // Check edit permissions
        const editBtn = messageDiv.querySelector('.edit-message-btn');
        if (editBtn) {
            this.canEditMessage(message.timestamp || new Date().toISOString())
                .then(canEdit => {
                    editBtn.style.display = canEdit ? 'inline-block' : 'none';
                })
                .catch(error => {
                    console.error('Edit permission check failed:', error);
                    editBtn.style.display = 'none';
                });
        }
    }
    
    /**
     * Enable edit mode for a message
     */
    enableEditMode(messageId) {
        const messageDiv = document.getElementById(messageId);
        if (!messageDiv || messageDiv.classList.contains('editing')) return;

        messageDiv.classList.add('editing');
        const textarea = messageDiv.querySelector('.edit-area textarea');
        if (textarea) {
            const currentContent = messageDiv.querySelector('.message-text').textContent;
            textarea.value = currentContent;
            textarea.focus();
            this.adjustTextareaHeight(textarea);
        }
    }
    
    /**
     * Cancel edit mode
     */
    cancelEditMode(messageDiv) {
        messageDiv.classList.remove('editing');
        const textarea = messageDiv.querySelector('.edit-area textarea');
        const originalContent = messageDiv.querySelector('.message-text').dataset.originalContent;
        if (textarea && originalContent) {
            textarea.value = originalContent;
        }
    }
    
    /**
     * Save edit mode
     */
    async saveEditMode(messageDiv) {
        const textarea = messageDiv.querySelector('.edit-area textarea');
        const newContent = textarea.value.trim();
        if (!newContent) return;

        messageDiv.classList.add('processing');
        try {
            if (this.controller) {
                await this.controller.editMessage(messageDiv.id, newContent);
            }
            messageDiv.classList.remove('editing');
        } catch (error) {
            console.error('Message edit error:', error);
            // Add error message through the model/controller architecture
            if (this.controller) {
                const errorMessage = {
                    role: 'system',
                    content: `Edit error: ${error.message}`,
                    timestamp: new Date().toISOString(),
                    id: this.controller.generateMessageId(),
                    isError: true
                };
                this.model.addMessage(errorMessage);
                
                // Show error in the message
                messageDiv.classList.add('error');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = error.message;
                messageDiv.querySelector('.message-content').appendChild(errorDiv);
            }
        } finally {
            messageDiv.classList.remove('processing');
        }
    }
    
    /**
     * Show site info modal
     */
    showSiteInfoModal(messageId) {
        const pageHTML = this.messageHtmlContent.get(messageId);
        if (!pageHTML) return;

        // Create modal if it doesn't exist
        let modal = document.getElementById('siteInfoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'siteInfoModal';
            modal.className = 'form-content-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="m-0">Page Context</h5>
                        <button type="button" class="btn-close" id="closeSiteInfoModal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="site-info-content">
                            <pre id="siteInfoContent"></pre>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Set up close button
            modal.querySelector('#closeSiteInfoModal').addEventListener('click', () => {
                modal.classList.remove('active');
            });

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }

        // Update content and show
        const contentElement = modal.querySelector('#siteInfoContent');
        if (contentElement) {
            contentElement.textContent = pageHTML;
        }
        modal.classList.add('active');
    }
    
    /**
     * Check if message can be edited
     */
    async canEditMessage(messageTimestamp) {
        try {
            const storage = this.storage || (this.controller && this.controller.storage);
            if (storage) {
                const result = await storage.get(['apiProvider', 'selectedModels']);
                const currentProvider = result.apiProvider;
                const currentModel = result.selectedModels?.[currentProvider];
                
                // Check if we can edit based on provider and model
                return currentProvider === 'local' ||
                    (result.apiProvider === currentProvider &&
                        result.selectedModels?.[currentProvider] === currentModel);
            }
        } catch (error) {
            console.error('Error checking edit permissions:', error);
        }
        return false;
    }
    
    /**
     * Adjust textarea height based on content
     */
    adjustTextareaHeight(element) {
        element.style.height = 'auto';
        element.style.height = Math.min(element.scrollHeight, 150) + 'px';
    }
    
    /**
     * Handle model changes
     * 
     * @param {Object} change - The change object
     * @param {Object} model - The model
     */
    onModelChange(change, model) {
        if (change.key === 'messages') {
            this.renderMessages();
            // Update edit button visibility after rendering messages
            this.updateEditButtonVisibility().catch(error => {
                console.error('Error updating edit button visibility:', error);
            });
        } else if (change.key === 'isProcessing') {
            this.updateProcessingState(change.newValue);
        } else if (change.key === 'apiProvider' || change.key === 'selectedModels') {
            this.updateEditButtonVisibility().catch(error => {
                console.error('Error updating edit button visibility:', error);
            });
            this.updateApiStatus().catch(error => {
                console.error('Error updating API status:', error);
            });
        } else if (change.key === 'pageContext') {
            // When page context is updated, check for guided URLs
            console.log('Page context updated:', change.newValue);
            // Update guide bubble based on new page context
            this.updateGuideBubbleIfNeeded().catch(error => {
                console.error('Error updating guide bubble:', error);
            });
        }
    }
    
    /**
     * Render messages using the model data
     */
    renderMessages() {
        if (!this.messagesListElement) return;
        
        const messages = this.model.get('messages') || [];
        
        // Show/hide welcome state based on messages
        if (messages.length > 0) {
            this.hideWelcomeState();
        } else {
            this.showWelcomeState();
        }
        
        // Clear existing messages
        this.messagesListElement.innerHTML = '';
        
        // Check and update guide bubble for guided URLs (not in messages area)
        this.updateGuideBubbleIfNeeded();
        
        // Render each message using the model data
        messages.forEach(message => {
            this.renderMessage(message);
        });
        
        // Scroll to bottom
        this.scrollToBottom();
    }
    
    /**
     * Update guide bubble if needed (static above messages)
     */
    async updateGuideBubbleIfNeeded() {
        try {
            // Get current page URL
            const pageContext = this.model.get('pageContext');
            let currentUrl = pageContext?.url;
            
            // If no URL from page context, try to get from active tab
            if (!currentUrl && chrome?.tabs?.query) {
                try {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tabs && tabs.length > 0) {
                        currentUrl = tabs[0].url;
                        console.log('Got URL from active tab:', currentUrl);
                    }
                } catch (tabError) {
                    console.log('Could not get active tab:', tabError);
                }
            }
            
            // Fallback to window location
            if (!currentUrl) {
                currentUrl = window.location.href;
            }
            
            console.log('Guide bubble check - Current URL:', currentUrl);
            console.log('Page context:', pageContext);
            
            // Load guides from storage
            const guideData = await this.loadGuidesFromStorage();
            if (!guideData) {
                console.log('No guide data loaded');
                this.hideStaticGuideBubble();
                return;
            }
            
            console.log('Guide data loaded:', guideData);
            
            // Get matching guides for current URL
            const matchingGuides = this.getMatchingGuides(currentUrl, guideData);
            
            console.log('Matching guides found:', matchingGuides.length, matchingGuides);
            
            // Check if we have any guides (URL-specific or base)
            if (matchingGuides.length > 0) {
                // Show static guide bubble above messages
                this.showStaticGuideBubble(currentUrl, matchingGuides);
            } else {
                // Hide guide bubble if no matches
                this.hideStaticGuideBubble();
            }
        } catch (error) {
            console.error('Error updating guide bubble:', error);
        }
    }
    
    /**
     * Show static guide bubble above messages area
     */
    showStaticGuideBubble(currentUrl, matchingGuides) {
        // Look for existing static guide bubble
        let staticBubble = document.getElementById('static-guide-bubble');
        
        if (!staticBubble) {
            // Create new static bubble as a message from AI
            staticBubble = document.createElement('div');
            staticBubble.id = 'static-guide-bubble';
            staticBubble.className = 'message assistant';
            
            // Insert above messages container
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.insertBefore(staticBubble, messagesContainer.firstChild);
            }
        }
        
        // Get webpage title and site name
        const pageContext = this.model.get('pageContext');
        const pageTitle = pageContext?.title || document.title || 'Current Page';
        let siteName = '';
        
        // Extract site name from URL - only for valid URLs
        try {
            const url = new URL(currentUrl);
            // Only add site name if it's a proper HTTP/HTTPS URL
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                siteName = url.hostname.replace('www.', '');
            }
        } catch (error) {
            // Invalid URL, don't add site name
            siteName = '';
        }
        
        // Get current time
        const currentTime = new Date().toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Separate guides by type
        const urlGuides = matchingGuides.filter(guide => guide.type === 'url');
        const baseGuides = matchingGuides.filter(guide => guide.type === 'base');
        
        // Build content for different guide types
        let guideContent = '';
        
        if (urlGuides.length > 0) {
            guideContent += urlGuides.map((guide, index) => `
                <div class="guide-frame" data-guide-type="url" data-guide-index="${index}">
                    <div class="guide-title clickable">${this.escapeHtml(guide.title)}</div>
                </div>
            `).join('');
        }
        
        if (baseGuides.length > 0) {
            guideContent += baseGuides.map((guide, index) => `
                <div class="guide-frame" data-guide-type="base" data-guide-index="${index}">
                    <div class="guide-title clickable">${this.escapeHtml(guide.title)}</div>
                </div>
            `).join('');
        }
        
        staticBubble.innerHTML = `
            <div class="message-content">
                <div class="guide-webpage-title">${this.escapeHtml(siteName || pageTitle)}</div>
                ${guideContent}
                <div class="message-timestamp">${currentTime}</div>
            </div>
        `;
        
        staticBubble.style.display = 'block';
        this.addStaticGuideBubbleStyles();
        
        // Add click handlers to guide titles
        urlGuides.forEach((guide, index) => {
            const guideElement = staticBubble.querySelector(`[data-guide-type="url"][data-guide-index="${index}"] .guide-title`);
            if (guideElement) {
                guideElement.addEventListener('click', () => {
                    this.insertGuideIntoChat(guide);
                });
            }
        });
        
        baseGuides.forEach((guide, index) => {
            const guideElement = staticBubble.querySelector(`[data-guide-type="base"][data-guide-index="${index}"] .guide-title`);
            if (guideElement) {
                guideElement.addEventListener('click', () => {
                    this.insertGuideIntoChat(guide);
                });
            }
        });
        
        // Store matching guides for AI context
        this.currentGuidedContext = matchingGuides;
    }
    
    /**
     * Hide static guide bubble
     */
    hideStaticGuideBubble() {
        const staticBubble = document.getElementById('static-guide-bubble');
        if (staticBubble) {
            staticBubble.style.display = 'none';
        }
        
        // Clear guided context
        this.currentGuidedContext = null;
    }
    
    /**
     * Render the guide bubble as a message
     */
    renderGuideBubble(guides) {
        const pageContext = this.model.get('pageContext');
        const currentSite = pageContext?.url ? new URL(pageContext.url).hostname : 'this site';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message guide-bubble';
        
        let guidesHtml = '';
        guides.forEach((guide, index) => {
            guidesHtml += `
                <div class="guide-item" data-guide-index="${index}">
                    <div class="guide-title">${guide.title}</div>
                    <div class="guide-memo">${guide.memo}</div>
                </div>
            `;
        });
        
        bubbleDiv.innerHTML = `
            <div class="message-content">
                <div class="guide-bubble-header">
                    <span class="site-icon">🌐</span>
                    <span class="site-name">${currentSite}</span>
                </div>
                <div class="guide-list">
                    ${guidesHtml}
                </div>
            </div>
        `;
        
        // Add click handlers
        guides.forEach((guide, index) => {
            const guideItem = bubbleDiv.querySelector(`[data-guide-index="${index}"]`);
            if (guideItem) {
                guideItem.addEventListener('click', () => {
                    this.insertGuideIntoChat(guide);
                    bubbleDiv.remove();
                });
            }
        });
        
        this.messagesListElement.appendChild(bubbleDiv);
        this.addGuideBubbleStyles();
    }
    
    /**
     * Insert guide content into chat input
     */
    insertGuideIntoChat(guide) {
        if (!this.inputElement) return;
        
        const content = guide.title;
        
        if (this.inputElement.value.trim()) {
            this.inputElement.value += '\n\n' + content;
        } else {
            this.inputElement.value = content;
        }
        
        this.inputElement.focus();
        this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        this.adjustTextareaHeight(this.inputElement);
    }
    
    /**
     * Load guides from Chrome storage
     */
    async loadGuidesFromStorage() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['guides', 'guides_base'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Error loading guides:', chrome.runtime.lastError);
                    resolve(null);
                    return;
                }
                
                console.log('Loaded guides from storage:', {
                    guides: result.guides || [],
                    baseCards: result.guides_base || []
                });
                
                resolve({
                    guides: result.guides || [],
                    baseCards: result.guides_base || []
                });
            });
        });
    }
    
    /**
     * Get matching guides for a URL
     */
    getMatchingGuides(url, guideData) {
        const matchingGuides = [];
        let hasUrlGuides = false;
        
        // Check URL-specific guides
        if (guideData.guides && guideData.guides.length > 0 && url) {
            guideData.guides.forEach(guide => {
                if (guide.guideUrl && this.matchesUrlPattern(url, guide.guideUrl)) {
                    if (guide.guideCards && guide.guideCards.length > 0) {
                        guide.guideCards.forEach(card => {
                            if (card.title && card.title.trim()) {
                                matchingGuides.push({
                                    type: 'url',
                                    title: card.title,
                                    memo: card.memo || '',
                                    prompt: card.prompt || '',
                                    urlPattern: guide.guideUrl,
                                    guideUrl: guide.guideUrl
                                });
                                hasUrlGuides = true;
                            }
                        });
                    }
                }
            });
        }
        
        // Only include base guides if no URL guides are found
        if (!hasUrlGuides && guideData.baseCards && guideData.baseCards.length > 0) {
            guideData.baseCards.forEach(card => {
                if (card.title && card.title.trim()) {
                    matchingGuides.push({
                        type: 'base',
                        title: card.title,
                        memo: card.memo || '',
                        prompt: card.prompt || ''
                    });
                }
            });
        }
        
        return matchingGuides;
    }
    
    /**
     * Check if URL matches pattern
     */
    matchesUrlPattern(url, pattern) {
        if (!url || !pattern) return false;
        
        // Skip extension URLs and local files
        if (url.startsWith('chrome-extension://') || url.startsWith('file://') || url.startsWith('about:') || url.startsWith('chrome://')) {
            return false;
        }
        
        // Skip if pattern is too generic (would match everything)
        if (pattern === '*' || pattern === '**' || pattern === '*.*') {
            return false;
        }
        
        try {
            const regexPattern = pattern
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\\\*/g, '.*');
            
            const regex = new RegExp('^' + regexPattern + '$', 'i');
            const matches = regex.test(url);
            
            console.log(`URL matching: ${url} vs ${pattern} = ${matches}`);
            return matches;
        } catch (error) {
            console.error('Error in URL pattern matching:', error);
            return false;
        }
    }
    
    /**
     * Add styles for guide bubble
     */
    addGuideBubbleStyles() {
        if (document.getElementById('guide-bubble-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'guide-bubble-styles';
        style.textContent = `
            .guide-bubble {
                border-left: 4px solid #667eea;
                background: linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%);
                margin-bottom: 1rem;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .guide-bubble-header {
                background: rgba(102, 126, 234, 0.1);
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                border-bottom: 1px solid rgba(102, 126, 234, 0.2);
            }
            
            .site-icon {
                font-size: 16px;
            }
            
            .site-name {
                font-size: 14px;
                font-weight: 600;
                color: #4c51bf;
            }
            
            .guide-list {
                padding: 0;
            }
            
            .guide-item {
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                transition: background-color 0.2s ease;
            }
            
            .guide-item:hover {
                background: rgba(102, 126, 234, 0.05);
            }
            
            .guide-item:last-child {
                border-bottom: none;
            }
            
            .guide-title {
                font-size: 14px;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 4px;
            }
            
            .guide-memo {
                font-size: 12px;
                color: #6b7280;
                line-height: 1.4;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Add styles for static guide bubble
     */
    addStaticGuideBubbleStyles() {
        if (document.getElementById('static-guide-bubble-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'static-guide-bubble-styles';
        style.textContent = `
            .guide-section {
                background: rgba(248, 249, 250, 0.3);
                border-radius: 6px;
                border: 1px solid #e2e8f0;
                overflow: hidden;
                margin-bottom: 0.5rem;
            }
            
            .guides-list {
                padding: 0;
            }
            
            .guide-item {
                padding: 8px;
            }
            
            .guide-frame {
                background: rgba(248, 249, 250, 0.3);
                border-radius: 6px;
                border: 1px solid #e2e8f0;
                padding: 8px;
                margin-bottom: 6px;
                transition: all 0.2s;
            }
            
            .guide-frame:hover {
                background: rgba(248, 249, 250, 0.5);
                border-color: #cbd5e1;
            }
            
            .guide-frame:last-child {
                margin-bottom: 0;
            }
            
            .guide-title {
                font-size: 0.8rem;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 2px;
                line-height: 1.4;
            }
            
            .guide-title.clickable {
                cursor: pointer;
                transition: color 0.2s;
            }
            
            .guide-title.clickable:hover {
                color: #2563eb;
                text-decoration: underline;
            }
            
            .guide-memo {
                font-size: 0.75rem;
                color: #64748b;
                line-height: 1.4;
            }
            
            .guide-webpage-title {
                font-size: 0.85rem;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 0.5rem;
                padding-bottom: 0.5rem;
            }
            
            .message.assistant .message-timestamp {
                text-align: right;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Render a single message
     * 
     * @param {Object} message - The message object from the model
     */
    renderMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        messageDiv.id = message.id;
        
        if (message.isError) {
            messageDiv.classList.add('error');
        }
        
        const messageTime = message.timestamp
            ? new Date(message.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        
        if (message.role === 'user') {
            this.renderModernUserMessage(messageDiv, message, messageTime);
        } else if (message.role === 'assistant' || message.role === 'system') {
            this.renderModernAssistantMessage(messageDiv, message, messageTime);
        }
        
        this.messagesListElement.appendChild(messageDiv);
    }
    
    /**
     * Render a system/assistant message
     */
    renderSystemMessage(messageDiv, message, messageTime) {
        let messageHTML = `
            <div class="message-content">
                <div class="message-text">${message.content}</div>
        `;
        
        if (message.recommendations && message.recommendations.length > 0) {
            message.recommendations.forEach(rec => {
                messageHTML += `
                    <button class="recommendation-button">
                        <i class="bi bi-question-circle"></i>
                        ${rec}
                    </button>
                `;
            });
        }
        
        messageHTML += `
                <div class="message-footer">
                    <span class="timestamp">${messageTime}</span>
                </div>
            </div>`;
        messageDiv.innerHTML = messageHTML;
    }
    
    /**
     * Update processing state
     * 
     * @param {boolean} isProcessing - Whether the chat is processing a message
     */
    updateProcessingState(isProcessing) {
        if (isProcessing) {
            this.showLoadingState();
            
            if (this.inputElement) {
                this.inputElement.disabled = true;
            }
        } else {
            this.hideLoadingState();
            
            if (this.inputElement) {
                this.inputElement.disabled = false;
            }
        }
    }
    
    /**
     * Scroll to the bottom of the messages container
     */
    scrollToBottom() {
        if (this.messagesContainerElement) {
            this.messagesContainerElement.scrollTop = this.messagesContainerElement.scrollHeight;
        }
    }
    
    /**
     * Show welcome state
     */
    showWelcomeState() {
        if (this.welcomeStateElement) {
            this.welcomeStateElement.classList.remove('hidden');
        }
    }
    
    /**
     * Hide welcome state
     */
    hideWelcomeState() {
        if (this.welcomeStateElement) {
            this.welcomeStateElement.classList.add('hidden');
        }
    }
    
    /**
     * Show thinking animation with enhanced visual effects
     * @param {string} message - Custom thinking message (optional)
     * @param {string} variant - Animation variant ('default', 'modern', 'elegant', 'dark')
     */
    showThinkingAnimation(message = 'Thinking...', variant = 'default') {
        if (this.thinkingContainerElement) {
            // Remove any existing variant classes
            const bubbleElement = this.thinkingContainerElement.querySelector('.thinking-bubble');
            const textElement = this.thinkingContainerElement.querySelector('.thinking-text');
            
            if (bubbleElement) {
                bubbleElement.className = 'thinking-bubble';
                if (variant !== 'default') {
                    bubbleElement.classList.add(`variant-${variant}`);
                }
            }
            
            // Update thinking text with custom message
            if (textElement) {
                textElement.textContent = message;
            }
            
            // Add enhanced entrance animation
            this.thinkingContainerElement.classList.remove('hidden');
            this.thinkingContainerElement.style.animation = 'fadeInUp 0.4s ease-out';
            
            // Add random variation to dots animation timing
            const dots = this.thinkingContainerElement.querySelectorAll('.thinking-dots span');
            dots.forEach((dot, index) => {
                const delay = (index * 0.2) + (Math.random() * 0.1);
                dot.style.animationDelay = `${delay}s`;
            });
            
            this.scrollToBottom();
            
            // Optional: Cycle through different messages for longer waits
            this.startThinkingMessageCycle(textElement);
        }
    }
    
    /**
     * Hide thinking animation with smooth transition
     */
    hideThinkingAnimation() {
        if (this.thinkingContainerElement) {
            // Stop message cycling
            this.stopThinkingMessageCycle();
            
            // Add exit animation
            this.thinkingContainerElement.style.animation = 'fadeOut 0.3s ease-in';
            
            setTimeout(() => {
                if (this.thinkingContainerElement) {
                    this.thinkingContainerElement.classList.add('hidden');
                    this.thinkingContainerElement.style.animation = '';
                }
            }, 300);
        }
    }
    
    /**
     * Start cycling through different thinking messages
     * @param {HTMLElement} textElement - The text element to update
     */
    startThinkingMessageCycle(textElement) {
        const messages = [
            'Thinking...',
            'Processing your request...',
            'Analyzing context...',
            'Generating response...',
            'Almost ready...'
        ];
        
        let messageIndex = 0;
        this.thinkingMessageInterval = setInterval(() => {
            if (textElement && !this.thinkingContainerElement.classList.contains('hidden')) {
                messageIndex = (messageIndex + 1) % messages.length;
                textElement.textContent = messages[messageIndex];
                
                // Add subtle pulse effect when message changes
                textElement.style.animation = 'pulse 0.5s ease-in-out';
                setTimeout(() => {
                    if (textElement) textElement.style.animation = '';
                }, 500);
            }
        }, 2000); // Change message every 2 seconds
    }
    
    /**
     * Stop the thinking message cycle
     */
    stopThinkingMessageCycle() {
        if (this.thinkingMessageInterval) {
            clearInterval(this.thinkingMessageInterval);
            this.thinkingMessageInterval = null;
        }
    }
    
    /**
     * Show loading state in send button
     */
    showLoadingState() {
        if (this.sendIconElement && this.loadingSpinnerElement) {
            this.sendIconElement.classList.add('hidden');
            this.loadingSpinnerElement.classList.remove('hidden');
            this.loadingSpinnerElement.classList.add('active');
        }
        
        if (this.sendButtonElement) {
            this.sendButtonElement.disabled = true;
        }
        
        // Show thinking animation
        this.showThinkingAnimation();
    }
    
    /**
     * Hide loading state in send button
     */
    hideLoadingState() {
        if (this.sendIconElement && this.loadingSpinnerElement) {
            this.sendIconElement.classList.remove('hidden');
            this.loadingSpinnerElement.classList.add('hidden');
            this.loadingSpinnerElement.classList.remove('active');
        }
        
        if (this.sendButtonElement) {
            this.sendButtonElement.disabled = false;
        }
        
        // Hide thinking animation
        this.hideThinkingAnimation();
    }
    
    /**
     * Render modern user message
     */
    renderModernUserMessage(messageDiv, message, messageTime) {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message.content)}</div>
                <div class="message-timestamp">${messageTime}</div>
            </div>
        `;
    }
    
    /**
     * Render modern assistant message
     */
    renderModernAssistantMessage(messageDiv, message, messageTime) {
        // Use marked for markdown rendering if available, otherwise fallback to plain text
        let renderedContent;
        if (typeof marked !== 'undefined') {
            try {
                renderedContent = marked.parse(message.content || '');
            } catch (error) {
                console.warn('Marked parsing failed, falling back to plain text:', error);
                renderedContent = this.escapeHtml(message.content || '');
            }
        } else {
            renderedContent = this.escapeHtml(message.content || '');
        }

        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${renderedContent}</div>
                <div class="message-timestamp">${messageTime}</div>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Render the view
     * 
     * @returns {ChatView} - The view instance for chaining
     */
    render() {
        this.renderMessages();
        this.updateProcessingState(this.model.get('isProcessing'));
        return this;
    }
    
    /**
     * Dispose of the view
     */
    dispose() {
        // Remove event listeners
        if (this.sendButtonElement) {
            this.sendButtonElement.removeEventListener('click', this.handleSendClick);
        }
        
        if (this.inputElement) {
            this.inputElement.removeEventListener('keydown', this.handleInputKeydown);
        }
        
        if (this.messagesContainerElement) {
            this.messagesContainerElement.removeEventListener('click', this.handleMessageClick);
        }
        
        // Clear guide bubble
        this.hideStaticGuideBubble();
        
        // Clear URL polling interval
        if (this.urlCheckInterval) {
            clearInterval(this.urlCheckInterval);
            this.urlCheckInterval = null;
        }
        
        // Clear message content
        this.messageHtmlContent.clear();
        
        super.dispose();
    }
    
    /**
     * Update edit button visibility for all messages
     */
    async updateEditButtonVisibility() {
        const messages = this.model.get('messages') || [];
        const visibilityPromises = messages.map(async message => {
            if (message.role === 'user') {
                const messageDiv = document.getElementById(message.id);
                if (messageDiv) {
                    const editBtn = messageDiv.querySelector('.edit-message-btn');
                    if (editBtn) {
                        const canEdit = await this.canEditMessage(message.timestamp);
                        editBtn.style.display = canEdit ? 'inline-block' : 'none';
                    }
                }
            }
        });
        
        // Wait for all visibility updates to complete
        await Promise.all(visibilityPromises);
    }
    
    /**
     * Update API status in header
     */
    async updateApiStatus() {
        const apiStatus = this.element.querySelector('#apiStatus');
        const headerTitle = this.element.querySelector('.header-title');
        if (!apiStatus || !headerTitle) return;

        try {
            const storage = this.storage || (this.controller && this.controller.storage);
            if (!storage) return;

            const result = await storage.get([
                'apiProvider',
                'selectedModels',
                'apiKeys',
                'customSettings'
            ]);

            // Update header title using i18n
            headerTitle.setAttribute('data-i18n', 'extensionName');

            if (!result.apiProvider) {
                apiStatus.innerHTML = '<a href="api_settings.html" class="text-decoration-none" target="_blank">APIプロバイダー設定をしてください</a>';
                return;
            }

            let statusText = result.apiProvider.toUpperCase();
            if (result.apiProvider === 'local') {
                statusText = 'Local API';
            } else if (result.apiProvider === 'compatible') {
                const modelId = result.selectedModels?.compatible;
                if (modelId) {
                    statusText += ` (${modelId})`;
                }
            } else if (result.selectedModels && result.selectedModels[result.apiProvider]) {
                statusText += ` (${result.selectedModels[result.apiProvider]})`;
            }

            apiStatus.textContent = statusText;
        } catch (error) {
            console.error('Error updating API status:', error);
        }
    }
}

/**
 * ChatViewインスタンスを作成するファクトリ関数
 * 
 * @param {HTMLElement|string} container - コンテナ要素またはセレクタ
 * @returns {ChatView} ChatViewインスタンス
 */
export const createChatView = (container) => {
    return new ChatView(container);
};

