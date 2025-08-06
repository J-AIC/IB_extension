/**
 * P2P Model
 * Manages the state and data for P2P image reception functionality
 */

class P2PModel extends Model {
    constructor() {
        super({
            // Connection state
            peerId: null,
            isConnected: false,
            connectionStatus: 'disconnected', // disconnected, connecting, connected, error
            connectedDeviceName: null,
            lastConnectionTime: null,
            
            // QR Code state
            qrCodeData: null,
            qrCodeUrl: null,
            
            // Image reception state
            receivedImages: [],
            currentImage: null,
            isReceivingImage: false,
            imageTransferProgress: 0,
            
            // Error state
            lastError: null,
            errorCount: 0,
            
            // Settings
            autoReconnect: true,
            saveLocation: 'InsightBuddy-extension/shot',
            maxStoredImages: 10,
            
            // Debug/Logging
            connectionLogs: [],
            debugMode: false
        });
    }

    /**
     * Update connection status
     * @param {string} status
     * @param {Object} details
     */
    updateConnectionStatus(status, details = {}) {
        this.set('connectionStatus', status);
        this.set('isConnected', status === 'connected');
        
        if (status === 'connected') {
            this.set('lastConnectionTime', new Date().toISOString());
            this.set('connectedDeviceName', details.deviceName || 'Unknown Device');
            this.set('errorCount', 0);
        }
        
        this.addConnectionLog(`Connection ${status}`, details);
    }

    /**
     * Set peer ID and generate QR code data
     * @param {string} peerId
     */
    setPeerId(peerId) {
        console.log('Setting peer ID:', peerId);
        this.set('peerId', peerId);
        
        // Generate QR code with web-accessible URL
        const SENDER_BASE_URL = 'https://shot-extension.akt.support/extension'; // Updated to new deployment URL
        const senderUrl = `${SENDER_BASE_URL}/?peer=${peerId}`;
        
        console.log('Setting QR code data:', senderUrl);
        this.set('qrCodeData', senderUrl);
    }

    /**
     * Add a received image
     * @param {Object} imageData
     */
    addReceivedImage(imageData) {
        const images = this.get('receivedImages') || [];
        
        // Add image with metadata
        const imageEntry = {
            id: imageData.imageId,
            filename: imageData.filename,
            size: imageData.size,
            timestamp: new Date().toISOString(),
            status: 'received'
        };
        
        images.unshift(imageEntry); // Add to beginning
        
        // Limit stored images
        const maxImages = this.get('maxStoredImages');
        if (images.length > maxImages) {
            images.splice(maxImages);
        }
        
        this.set('receivedImages', images);
        this.set('currentImage', imageEntry);
        
        this.addConnectionLog('Image received', {
            filename: imageData.filename,
            size: imageData.size
        });
    }

    /**
     * Update image transfer progress
     * @param {number} progress - Progress percentage (0-100)
     */
    updateImageTransferProgress(progress) {
        this.set('imageTransferProgress', progress);
        this.set('isReceivingImage', progress > 0 && progress < 100);
    }

    /**
     * Set error state
     * @param {Error|string} error
     */
    setError(error) {
        const errorMessage = error instanceof Error ? error.message : error;
        this.set('lastError', errorMessage);
        this.set('errorCount', this.get('errorCount') + 1);
        
        this.addConnectionLog('Error occurred', { error: errorMessage });
    }

    /**
     * Clear error state
     */
    clearError() {
        this.set('lastError', null);
    }

    /**
     * Add a connection log entry
     * @param {string} message
     * @param {Object} details
     */
    addConnectionLog(message, details = {}) {
        if (!this.get('debugMode')) return;
        
        const logs = this.get('connectionLogs') || [];
        
        logs.push({
            timestamp: new Date().toISOString(),
            message: message,
            details: details
        });
        
        // Keep only last 100 log entries
        if (logs.length > 100) {
            logs.shift();
        }
        
        this.set('connectionLogs', logs);
    }

    /**
     * Get formatted connection logs
     * @returns {string}
     */
    getFormattedLogs() {
        const logs = this.get('connectionLogs') || [];
        return logs.map(log => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            const details = Object.keys(log.details).length > 0 
                ? ' - ' + JSON.stringify(log.details) 
                : '';
            return `[${time}] ${log.message}${details}`;
        }).join('\n');
    }

    /**
     * Toggle debug mode
     */
    toggleDebugMode() {
        const currentMode = this.get('debugMode');
        this.set('debugMode', !currentMode);
        
        if (!currentMode) {
            this.addConnectionLog('Debug mode enabled');
        }
    }

    /**
     * Get connection statistics
     * @returns {Object}
     */
    getConnectionStats() {
        return {
            totalImagesReceived: (this.get('receivedImages') || []).length,
            errorCount: this.get('errorCount'),
            lastConnectionTime: this.get('lastConnectionTime'),
            isConnected: this.get('isConnected'),
            uptime: this.calculateUptime()
        };
    }

    /**
     * Calculate connection uptime
     * @returns {string}
     */
    calculateUptime() {
        const lastConnectionTime = this.get('lastConnectionTime');
        if (!lastConnectionTime || !this.get('isConnected')) {
            return 'Not connected';
        }
        
        const start = new Date(lastConnectionTime);
        const now = new Date();
        const diff = now - start;
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    /**
     * Reset model to initial state
     */
    reset() {
        super.reset({
            peerId: this.get('peerId'), // Keep peer ID
            isConnected: false,
            connectionStatus: 'disconnected',
            connectedDeviceName: null,
            lastConnectionTime: null,
            qrCodeData: this.get('qrCodeData'), // Keep QR code
            qrCodeUrl: this.get('qrCodeUrl'),
            receivedImages: [],
            currentImage: null,
            isReceivingImage: false,
            imageTransferProgress: 0,
            lastError: null,
            errorCount: 0,
            autoReconnect: this.get('autoReconnect'),
            saveLocation: this.get('saveLocation'),
            maxStoredImages: this.get('maxStoredImages'),
            connectionLogs: [],
            debugMode: this.get('debugMode')
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = P2PModel;
}

// Also expose to global scope for script tag usage
if (typeof window !== 'undefined') {
    window.P2PModel = P2PModel;
} else if (typeof global !== 'undefined') {
    global.P2PModel = P2PModel;
}