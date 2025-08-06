/**
 * P2P Controller
 * Handles business logic for P2P image reception functionality
 */

class P2PController extends Controller {
    constructor(model, view, connectionService, storageService) {
        super(model, view);
        
        this.connectionService = connectionService;
        this.storageService = storageService;
        this.isInitialized = false;
    }

    initialize() {
        // Base class initialize - called synchronously
        // Don't do async operations here
    }

    async initializeAsync() {
        try {
            console.log('P2P Controller: Starting async initialization');
            console.log('Connection service:', this.connectionService);
            
            // Initialize P2P connection
            console.log('P2P Controller: Calling connectionService.initialize()');
            const peerId = await this.connectionService.initialize();
            console.log('P2P Controller: Got peer ID:', peerId);
            
            this.model.setPeerId(peerId);
            
            // Set up connection event handlers
            this.setupConnectionHandlers();
            
            // Load previous images metadata
            const recentImages = await this.storageService.getRecentImageMetadata();
            if (recentImages.length > 0) {
                this.model.set('receivedImages', recentImages);
            }
            
            this.isInitialized = true;
            this.model.updateConnectionStatus('disconnected', { message: 'Ready to accept connections' });
            
        } catch (error) {
            console.error('Failed to initialize P2P controller:', error);
            this.model.setError('Failed to initialize P2P connection');
            this.model.updateConnectionStatus('error', { error: error.message });
        }
    }

    /**
     * Set up handlers for connection events
     */
    setupConnectionHandlers() {
        // Connection status changes
        this.connectionService.onConnectionChange((status) => {
            this.model.updateConnectionStatus(status);
            
            if (status === 'connected') {
                // Enable features when connected
                this.model.clearError();
            }
        });

        // Data reception
        this.connectionService.onDataReceived(async (data) => {
            await this.handleReceivedData(data);
        });

        // Errors
        this.connectionService.onError((error) => {
            this.model.setError(error);
            this.model.updateConnectionStatus('error', { error: error.message });
        });
    }

    /**
     * Handle received data from P2P connection
     * @param {Object} data
     */
    async handleReceivedData(data) {
        try {
            switch (data.type) {
                case 'image':
                    await this.handleImageReception(data);
                    break;
                
                case 'device-info':
                    this.handleDeviceInfo(data);
                    break;
                
                case 'ping':
                    this.handlePing(data);
                    break;
                
                default:
                    console.warn('Unknown data type received:', data.type);
            }
        } catch (error) {
            console.error('Error handling received data:', error);
            this.model.setError('Failed to process received data');
        }
    }

    /**
     * Handle image reception
     * @param {Object} data
     */
    async handleImageReception(data) {
        try {
            console.log('Receiving image:', data.filename);
            
            // Update progress
            this.model.updateImageTransferProgress(20);
            
            // Process and store the image
            const result = await this.storageService.processReceivedImage({
                data: data.imageData,
                filename: data.filename,
                timestamp: data.timestamp
            });

            this.model.updateImageTransferProgress(80);

            // Add to model
            this.model.addReceivedImage(result);

            this.model.updateImageTransferProgress(100);

            // Reset progress after a short delay
            setTimeout(() => {
                this.model.updateImageTransferProgress(0);
            }, 2000);

            // Send acknowledgment
            this.connectionService.sendData({
                type: 'ack',
                messageId: data.messageId,
                status: 'success'
            });

            // Log success silently
            this.model.addConnectionLog('Image received successfully', {
                filename: data.filename,
                size: this.calculateImageSize(data.imageData)
            });
            
            // Automatically prepare image for form use
            await this.handleBackToForm();

        } catch (error) {
            console.error('Failed to handle image reception:', error);
            this.model.setError('Failed to receive image');
            this.model.updateImageTransferProgress(0);
            
            // Send error acknowledgment
            this.connectionService.sendData({
                type: 'ack',
                messageId: data.messageId,
                status: 'error',
                error: error.message
            });
        }
    }
    
    /**
     * Calculate image size from base64 data
     * @param {string} base64Data
     * @returns {number}
     */
    calculateImageSize(base64Data) {
        const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const padding = (base64.match(/=/g) || []).length;
        return Math.floor((base64.length * 3) / 4) - padding;
    }

    /**
     * Handle device information
     * @param {Object} data
     */
    handleDeviceInfo(data) {
        this.model.set('connectedDeviceName', data.deviceName || 'Unknown Device');
        this.model.addConnectionLog('Device info received', {
            deviceName: data.deviceName,
            platform: data.platform
        });
    }

    /**
     * Handle ping messages
     * @param {Object} data
     */
    handlePing(data) {
        // Respond with pong
        this.connectionService.sendData({
            type: 'pong',
            timestamp: Date.now(),
            messageId: data.messageId
        });
    }

    /**
     * Request image capture from connected device
     */
    requestImageCapture() {
        if (!this.model.get('isConnected')) {
            this.model.setError('No device connected');
            return;
        }

        try {
            this.connectionService.sendData({
                type: 'capture-request',
                timestamp: Date.now(),
                messageId: this.generateMessageId()
            });
            
            this.model.addConnectionLog('Image capture requested');
        } catch (error) {
            console.error('Failed to request image capture:', error);
            this.model.setError('Failed to request image capture');
        }
    }

    /**
     * Save the current image to disk
     */
    async saveCurrentImage() {
        const currentImage = this.model.get('currentImage');
        if (!currentImage) {
            this.model.setError('No image to save');
            return;
        }

        try {
            await this.storageService.downloadImage(currentImage.id);
            this.model.addConnectionLog('Image saved', {
                filename: currentImage.filename
            });
        } catch (error) {
            console.error('Failed to save image:', error);
            this.model.setError('Failed to save image');
        }
    }

    /**
     * Use the current image for form filling
     */
    async useImageForForm() {
        const currentImage = this.model.get('currentImage');
        if (!currentImage) {
            this.model.setError('No image to use');
            return;
        }

        try {
            // Get the image data URL
            const imageDataUrl = this.storageService.getImageDataUrl(currentImage.id);
            
            if (imageDataUrl) {
                // Store image for form use
                await this.storeImageForForm(currentImage.id, imageDataUrl, currentImage.filename);
                
                // Don't close tab or switch - just store the image
                
                this.model.addConnectionLog('Image prepared for form use', {
                    filename: currentImage.filename
                });
            }
        } catch (error) {
            console.error('Failed to prepare image for form:', error);
            this.model.setError('Failed to prepare image for form use');
        }
    }

    /**
     * Store image data for form system to use
     */
    async storeImageForForm(imageId, imageDataUrl, filename) {
        return new Promise((resolve, reject) => {
            const imageData = {
                id: imageId,
                dataUrl: imageDataUrl,
                filename: filename,
                timestamp: Date.now(),
                source: 'p2p-shot'
            };

            chrome.storage.local.set({
                'p2p_image_ready': imageData,
                'shot_image_notification': true  // Add notification flag to trigger forms integration
            }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    console.log('Image stored for form use:', filename);
                    
                    // Also try to notify forms integration directly
                    try {
                        chrome.runtime.sendMessage({
                            type: 'P2P_IMAGE_FOR_FORM',
                            imageId: imageId,
                            filename: filename,
                            imageData: imageDataUrl
                        });
                    } catch (error) {
                        console.log('Could not send direct message to forms integration:', error);
                    }
                    
                    resolve();
                }
            });
        });
    }

    /**
     * Handle back to form action (automatically called after image reception)
     */
    async handleBackToForm() {
        const currentImage = this.model.get('currentImage');
        if (!currentImage) {
            console.log('No current image to prepare for form');
            return;
        }

        try {
            // Prepare the image for form use
            await this.useImageForForm();
            
            // Switch back to form tab
            await this.switchBackToFormTab();
        } catch (error) {
            console.error('Failed to handle back to form:', error);
        }
    }

    /**
     * Switch back to the original form tab and close P2P receiver
     */
    async switchBackToFormTab() {
        return new Promise((resolve) => {
            // Get the tab that opened the P2P receiver
            chrome.storage.local.get(['p2p_source_tab_id'], (result) => {
                const sourceTabId = result.p2p_source_tab_id;
                
                if (sourceTabId) {
                    // Switch to the source tab
                    chrome.tabs.update(sourceTabId, { active: true }, (tab) => {
                        if (chrome.runtime.lastError) {
                            console.log('Source tab not found, staying on P2P receiver');
                        } else {
                            // Image automatically stored for form use
                            
                            // Close the P2P receiver tab after a short delay
                            setTimeout(() => {
                                chrome.tabs.getCurrent((currentTab) => {
                                    if (currentTab) {
                                        chrome.tabs.remove(currentTab.id);
                                    }
                                });
                            }, 100); // Short delay to ensure smooth transition
                        }
                        resolve();
                    });
                } else {
                    console.log('No source tab ID found');
                    resolve();
                }
            });
        });
    }





    /**
     * Toggle debug mode
     */
    toggleDebugMode() {
        this.model.toggleDebugMode();
    }

    /**
     * Clear connection logs
     */
    clearLogs() {
        this.model.set('connectionLogs', []);
    }

    /**
     * Get image data URL for display
     * @param {string} imageId
     * @returns {string|null}
     */
    getImageDataUrl(imageId) {
        return this.storageService.getImageDataUrl(imageId);
    }

    /**
     * Generate a unique message ID
     * @returns {string}
     */
    generateMessageId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Handle user actions from the view
     * @param {string} action
     * @param {Object} data
     */
    handleAction(action, data) {
        switch (action) {
            case 'requestCapture':
                this.requestImageCapture();
                break;
            
            case 'saveImage':
                this.saveCurrentImage();
                break;
            
            case 'useForForm':
                this.useImageForForm();
                break;
            
            case 'toggleDebug':
                this.toggleDebugMode();
                break;
            
            case 'clearLogs':
                this.clearLogs();
                break;
            
            case 'reconnect':
                this.reconnect();
                break;
            
            default:
                console.warn('Unknown action:', action);
        }
    }

    /**
     * Attempt to reconnect
     */
    async reconnect() {
        try {
            this.model.updateConnectionStatus('connecting');
            await this.connectionService.attemptReconnect();
        } catch (error) {
            console.error('Reconnection failed:', error);
            this.model.setError('Reconnection failed');
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.connectionService) {
            this.connectionService.close();
        }
        
        if (this.storageService) {
            this.storageService.clearAllImages();
        }
        
        super.dispose();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = P2PController;
}

// Also expose to global scope for script tag usage
if (typeof window !== 'undefined') {
    window.P2PController = P2PController;
} else if (typeof global !== 'undefined') {
    global.P2PController = P2PController;
}