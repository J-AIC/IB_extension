/**
 * P2P Forms Integration
 * Integrates P2P image reception with the form filling feature
 */

class P2PFormsIntegration {
    constructor() {
        this.isIntegrated = false;
        this.p2pImageData = null;
        this.p2pImageId = null;
    }

    /**
     * Initialize the P2P integration in forms popup
     */
    initialize() {
        if (this.isIntegrated) return;
        
        console.log('P2P FormsIntegration: Initializing...');
        
        // Setup event listeners for existing P2P button
        this.setupP2PEventListeners();
        
        // Listen for P2P image messages
        this.setupMessageListener();
        
        // Listen for storage changes (new shot images)
        this.setupStorageListener();
        
        this.isIntegrated = true;
        console.log('P2P FormsIntegration: Initialization complete');
    }

    /**
     * Setup event listeners for existing P2P button
     */
    setupP2PEventListeners() {
        console.log('P2P FormsIntegration: Setting up event listeners...');
        
        // Find existing P2P button and remove button
        const p2pButton = document.getElementById('p2pImageButton');
        const removeBtn = document.getElementById('p2pImageRemoveBtn');
        
        console.log('P2P FormsIntegration: Found p2pButton:', p2pButton);
        console.log('P2P FormsIntegration: Found removeBtn:', removeBtn);
        
        if (p2pButton) {
            // Remove any existing listeners first
            p2pButton.removeEventListener('click', this.handleP2PButtonClick);
            
            // Add new listener
            this.handleP2PButtonClick = (event) => {
                console.log('P2P FormsIntegration: Button clicked!', event);
                event.preventDefault();
                event.stopPropagation();
                this.openP2PReceiver();
            };
            
            p2pButton.addEventListener('click', this.handleP2PButtonClick);
            
            // Also add a global click listener as fallback
            document.addEventListener('click', (event) => {
                if (event.target && event.target.id === 'p2pImageButton') {
                    console.log('P2P FormsIntegration: Button clicked via global listener!', event);
                    event.preventDefault();
                    event.stopPropagation();
                    this.openP2PReceiver();
                }
            });
            
            console.log('P2P FormsIntegration: Event listener added successfully');
        } else {
            console.error('P2P button not found in DOM');
        }
        
        if (removeBtn) {
            removeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.removeP2PImage();
            });
        } else {
            console.error('P2P remove button not found in DOM');
        }

        // Update the note about mutual exclusivity
        this.updateExclusivityNote();
    }

    /**
     * Update the exclusivity note for process PDF and P2P images
     */
    updateExclusivityNote() {
        const processPdfGroup = document.querySelector('#processPdfUploadSection').closest('.form-group');
        if (!processPdfGroup) return;

        const note = document.createElement('div');
        note.className = 'text-sm text-gray-600 mt-1';
        note.textContent = '※ 手続き・処理PDFとP2P画像は相互排他的です（どちらか一方のみ使用）';
        processPdfGroup.appendChild(note);
    }

    /**
     * Set up message listener for P2P images
     */
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'P2P_IMAGE_FOR_FORM') {
                this.handleP2PImage(event.data);
            }
        });

        if (chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.type === 'P2P_IMAGE_FOR_FORM') {
                    this.handleP2PImage(request);
                    sendResponse({ success: true });
                }
            });
        }
    }

    /**
     * Set up storage listener for shot images
     */
    setupStorageListener() {
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local') {
                    // Listen for shot_image_notification changes
                    if (changes.shot_image_notification && changes.shot_image_notification.newValue) {
                        console.log('P2P FormsIntegration: shot_image_notification change detected');
                        chrome.storage.local.get(['p2p_image_ready'], (result) => {
                            if (result.p2p_image_ready) {
                                console.log('P2P FormsIntegration: Found p2p_image_ready in storage');
                                this.handleNewShotImage(result.p2p_image_ready);
                            }
                        });
                    }
                    
                    // Also listen directly for p2p_image_ready changes
                    if (changes.p2p_image_ready && changes.p2p_image_ready.newValue) {
                        console.log('P2P FormsIntegration: p2p_image_ready change detected directly');
                        this.handleNewShotImage(changes.p2p_image_ready.newValue);
                    }
                }
            });
        }
    }

    /**
     * Handle received P2P image
     * @param {Object} data
     */
    handleP2PImage(data) {
        this.p2pImageData = data.imageData;
        this.p2pImageId = data.imageId;
        
        // Clear process PDF if selected
        const processPdfInput = document.getElementById('processPdf');
        if (processPdfInput) {
            processPdfInput.value = '';
            const processPdfSelectedSection = document.getElementById('processPdfSelectedSection');
            const processPdfUploadSection = document.getElementById('processPdfUploadSection');
            if (processPdfSelectedSection) processPdfSelectedSection.classList.add('hidden');
            if (processPdfUploadSection) processPdfUploadSection.classList.remove('hidden');
        }

        // Update UI to show P2P image is selected
        this.showP2PImageStatus(data.filename);

        // Store in chrome storage for persistence
        chrome.storage.local.set({
            'p2p_image_for_form': {
                imageId: data.imageId,
                filename: data.filename,
                timestamp: new Date().toISOString()
            }
        });
    }

    /**
     * Open P2P receiver window/tab
     */
    openP2PReceiver() {
        console.log('P2P FormsIntegration: Opening P2P Receiver...');
        
        // Button click confirmed working, opening P2P Image Receiver
        
        try {
            // Try to send message to background script
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    type: 'OPEN_P2P_RECEIVER'
                }, (response) => {
                    console.log('P2P FormsIntegration: Background response:', response);
                    if (chrome.runtime.lastError) {
                        console.error('P2P FormsIntegration: Runtime error:', chrome.runtime.lastError);
                        this.openP2PReceiverDirectly();
                    }
                });
            } else {
                throw new Error('Chrome runtime not available');
            }
        } catch (error) {
            console.error('P2P FormsIntegration: Failed to send message to background:', error);
            this.openP2PReceiverDirectly();
        }
    }

    /**
     * Directly open P2P receiver page
     */
    openP2PReceiverDirectly() {
        try {
            // Store current tab ID for later reference
            chrome.tabs.getCurrent((currentTab) => {
                if (currentTab) {
                    chrome.storage.local.set({
                        'p2p_source_tab_id': currentTab.id,
                        'p2p_source_url': window.location.href
                    });
                    console.log('P2P FormsIntegration: Stored source tab ID:', currentTab.id);
                }
            });

            const p2pUrl = chrome.runtime.getURL('p2p_receiver.html');
            console.log('P2P FormsIntegration: Opening URL:', p2pUrl);
            window.open(p2pUrl, '_blank', 'width=800,height=600');
            console.log('P2P FormsIntegration: Opened P2P receiver directly');
        } catch (fallbackError) {
            console.error('P2P FormsIntegration: Fallback failed:', fallbackError);
            
            // Last resort: try to open with extension URL pattern
            try {
                const extensionId = chrome.runtime.id;
                const fallbackUrl = `chrome-extension://${extensionId}/p2p_receiver.html`;
                console.log('P2P FormsIntegration: Trying fallback URL:', fallbackUrl);
                window.open(fallbackUrl, '_blank');
            } catch (finalError) {
                console.error('P2P FormsIntegration: All methods failed:', finalError);
                alert('P2P Image Receiverを開けませんでした。拡張機能を再読み込みしてください。');
            }
        }
    }

    /**
     * Show P2P image status
     * @param {string} filename
     */
    showP2PImageStatus(filename) {
        const statusDiv = document.getElementById('p2pImageStatus');
        const fileNameSpan = document.getElementById('p2pImageFileName');
        const p2pButton = document.getElementById('p2pImageButton');

        if (statusDiv && fileNameSpan) {
            fileNameSpan.textContent = `画像を受信しました: ${filename}`;
            statusDiv.classList.remove('hidden');
            p2pButton.classList.add('hidden');
        }
    }

    /**
     * Remove P2P image
     */
    removeP2PImage() {
        this.p2pImageData = null;
        this.p2pImageId = null;

        const statusDiv = document.getElementById('p2pImageStatus');
        const p2pButton = document.getElementById('p2pImageButton');

        if (statusDiv) statusDiv.classList.add('hidden');
        if (p2pButton) p2pButton.classList.remove('hidden');

        // Clear all P2P image related data from storage
        chrome.storage.local.remove([
            'p2p_image_for_form',
            'p2p_image_ready',
            'shot_image_notification'
        ], () => {
            console.log('P2P image data cleared from all storage locations');
            
            // Dispatch event to notify form controller
            window.dispatchEvent(new CustomEvent('p2pImageRemoved', {
                detail: { source: 'P2PFormsIntegration' }
            }));
        });
    }

    /**
     * Get P2P image data for form processing
     * @returns {Object|null}
     */
    getP2PImageData() {
        if (!this.p2pImageData) return null;

        return {
            type: 'image',
            data: this.p2pImageData,
            id: this.p2pImageId
        };
    }

    /**
     * Get P2P image data URL for LLM vision processing
     * @returns {Promise<string|null>}
     */
    async getP2PImageDataUrl() {
        return new Promise((resolve) => {
            // First try to get from current instance
            if (this.p2pImageData) {
                resolve(this.p2pImageData);
                return;
            }

            // Try to get from storage
            chrome.storage.local.get(['p2p_image_ready', 'p2p_image_for_form'], (result) => {
                if (result.p2p_image_ready && result.p2p_image_ready.dataUrl) {
                    // Update instance data
                    this.p2pImageData = result.p2p_image_ready.dataUrl;
                    this.p2pImageId = result.p2p_image_ready.id;
                    resolve(result.p2p_image_ready.dataUrl);
                } else if (result.p2p_image_for_form && result.p2p_image_for_form.imageId) {
                    // Try to retrieve from P2P storage service
                    this.retrieveImageFromP2PStorage(result.p2p_image_for_form.imageId).then(resolve);
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Retrieve image data URL from P2P storage service
     * @param {string} imageId
     * @returns {Promise<string|null>}
     */
    async retrieveImageFromP2PStorage(imageId) {
        try {
            // Since we can't directly access the P2P storage service from here,
            // we'll try to find the image data in chrome storage
            return new Promise((resolve) => {
                chrome.storage.local.get(['p2p_images_metadata'], (result) => {
                    const metadata = result.p2p_images_metadata || [];
                    const imageInfo = metadata.find(img => img.id === imageId);
                    
                    if (imageInfo && imageInfo.dataUrl) {
                        resolve(imageInfo.dataUrl);
                    } else {
                        console.log('P2P image not found in storage:', imageId);
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            console.error('Failed to retrieve P2P image from storage:', error);
            return null;
        }
    }

    /**
     * Check if P2P image is selected
     * @returns {boolean}
     */
    hasP2PImage() {
        return this.p2pImageData !== null;
    }

    /**
     * Add styles for P2P integration
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .p2p-image-section {
                margin-top: 20px;
            }

            .p2p-divider {
                text-align: center;
                margin: 15px 0;
                position: relative;
            }

            .p2p-divider::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                height: 1px;
                background: #e5e7eb;
            }

            .divider-text {
                background: white;
                padding: 0 10px;
                position: relative;
                color: #6b7280;
                font-size: 14px;
            }

            .p2p-status {
                padding: 10px;
                background: #f3f4f6;
                border-radius: 5px;
            }

            .p2p-status .alert {
                margin: 0;
                padding: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            #p2pImageButton {
                background: #2563eb;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.2s;
            }

            #p2pImageButton:hover {
                background: #1d4ed8;
            }

            #p2pImageButton.hidden {
                display: none;
            }

            #p2pImageRemoveBtn {
                background: #ef4444;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            }

            #p2pImageRemoveBtn:hover {
                background: #dc2626;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Load saved P2P image from storage
     */
    async loadSavedP2PImage() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['p2p_image_for_form', 'p2p_image_ready'], (result) => {
                // Check for new shot image first
                if (result.p2p_image_ready) {
                    this.handleNewShotImage(result.p2p_image_ready);
                    resolve(result.p2p_image_ready);
                    return;
                }

                // Fallback to old P2P image
                if (result.p2p_image_for_form) {
                    // Check if image is recent (within last hour)
                    const timestamp = new Date(result.p2p_image_for_form.timestamp);
                    const now = new Date();
                    const hourAgo = new Date(now - 60 * 60 * 1000);

                    if (timestamp > hourAgo) {
                        this.showP2PImageStatus(result.p2p_image_for_form.filename);
                        resolve(result.p2p_image_for_form);
                    } else {
                        // Clear old image
                        chrome.storage.local.remove('p2p_image_for_form');
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Handle new shot image from P2P receiver
     */
    handleNewShotImage(imageData) {
        console.log('P2P FormsIntegration: New shot image received:', imageData.filename);
        console.log('P2P FormsIntegration: Image data:', imageData);
        
        // Set the image data
        this.p2pImageData = imageData.dataUrl;
        this.p2pImageId = imageData.id;
        
        // No longer showing notification - image automatically prepared
        
        // Update form UI
        this.showP2PImageStatus(imageData.filename);
        
        // Clear process PDF if selected (mutual exclusivity)
        this.clearProcessPdf();
        
        // Clear the notification flag
        chrome.storage.local.remove('shot_image_notification');
        
        // Store in the forms system format
        chrome.storage.local.set({
            'p2p_image_for_form': {
                imageId: imageData.id,
                filename: imageData.filename,
                timestamp: new Date().toISOString()
            }
        });
    }


    /**
     * Clear process PDF selection
     */
    clearProcessPdf() {
        const processPdfInput = document.getElementById('processPdf');
        if (processPdfInput) {
            processPdfInput.value = '';
            const processPdfSelectedSection = document.getElementById('processPdfSelectedSection');
            const processPdfUploadSection = document.getElementById('processPdfUploadSection');
            if (processPdfSelectedSection) processPdfSelectedSection.classList.add('hidden');
            if (processPdfUploadSection) processPdfUploadSection.classList.remove('hidden');
        }
    }
}

// Export for use in forms
if (typeof module !== 'undefined' && module.exports) {
    module.exports = P2PFormsIntegration;
}

// Auto-initialize when forms popup loads
function initializeP2PIntegration() {
    console.log('P2P FormsIntegration: Starting initialization...');
    console.log('Document ready state:', document.readyState);
    
    const integration = new P2PFormsIntegration();
    integration.initialize();
    integration.loadSavedP2PImage();
    
    // Set up periodic check for P2P images (in case storage events are missed)
    setInterval(() => {
        chrome.storage.local.get(['p2p_image_ready'], (result) => {
            if (result.p2p_image_ready && !integration.hasP2PImage()) {
                console.log('P2P FormsIntegration: Found pending P2P image, handling it now');
                integration.handleNewShotImage(result.p2p_image_ready);
            }
        });
    }, 2000); // Check every 2 seconds
    
    // Make integration globally accessible for forms popup
    window.p2pFormsIntegration = integration;
    console.log('P2P FormsIntegration: Global instance created');
}

if (document.readyState === 'loading') {
    console.log('P2P FormsIntegration: Document still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initializeP2PIntegration);
} else {
    console.log('P2P FormsIntegration: Document already loaded, initializing immediately...');
    // Add a small delay to ensure all elements are rendered
    setTimeout(initializeP2PIntegration, 100);
}