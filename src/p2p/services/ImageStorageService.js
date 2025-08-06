/**
 * Image Storage Service
 * Handles saving and managing received images
 */

class ImageStorageService {
    constructor() {
        this.tempImages = new Map();
        this.maxTempImages = 10;
    }

    /**
     * Process and store received image data
     * @param {Object} imageData - Contains base64 image data and metadata
     * @returns {Promise<Object>} Stored image information
     */
    async processReceivedImage(imageData) {
        try {
            const { data, filename, timestamp } = imageData;
            
            // Generate filename if not provided
            const finalFilename = filename || this.generateFilename();
            
            // Store temporarily in memory
            const imageInfo = {
                id: this.generateImageId(),
                filename: finalFilename,
                data: data,
                timestamp: timestamp || new Date().toISOString(),
                size: this.calculateBase64Size(data)
            };

            this.tempImages.set(imageInfo.id, imageInfo);
            
            // Clean up old images if limit exceeded
            if (this.tempImages.size > this.maxTempImages) {
                this.cleanupOldImages();
            }

            // Save to chrome storage for persistence
            await this.saveToStorage(imageInfo);

            return {
                success: true,
                imageId: imageInfo.id,
                filename: imageInfo.filename,
                size: imageInfo.size
            };
        } catch (error) {
            console.error('Failed to process image:', error);
            throw error;
        }
    }

    /**
     * Generate a filename based on current timestamp
     * @returns {string}
     */
    generateFilename() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        return `${year}_${month}_${day}_${hours}${minutes}${seconds}_shot.jpg`;
    }

    /**
     * Generate a unique image ID
     * @returns {string}
     */
    generateImageId() {
        return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Calculate the size of base64 data
     * @param {string} base64Data
     * @returns {number} Size in bytes
     */
    calculateBase64Size(base64Data) {
        // Remove data URL prefix if present
        const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const padding = (base64.match(/=/g) || []).length;
        return Math.floor((base64.length * 3) / 4) - padding;
    }

    /**
     * Save image info to Chrome storage
     * @param {Object} imageInfo
     */
    async saveToStorage(imageInfo) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['p2pImages'], (result) => {
                const images = result.p2pImages || [];
                
                // Add new image (store only metadata, not the full data)
                images.push({
                    id: imageInfo.id,
                    filename: imageInfo.filename,
                    timestamp: imageInfo.timestamp,
                    size: imageInfo.size
                });

                // Keep only last 30 images metadata
                const recentImages = images.slice(-30);

                chrome.storage.local.set({ p2pImages: recentImages }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Get image by ID
     * @param {string} imageId
     * @returns {Object|null}
     */
    getImage(imageId) {
        return this.tempImages.get(imageId) || null;
    }

    /**
     * Get all temporary images
     * @returns {Array}
     */
    getAllImages() {
        return Array.from(this.tempImages.values());
    }

    /**
     * Get recent image metadata from storage
     * @returns {Promise<Array>}
     */
    async getRecentImageMetadata() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['p2pImages'], (result) => {
                resolve(result.p2pImages || []);
            });
        });
    }

    /**
     * Clean up old images from memory
     */
    cleanupOldImages() {
        const images = Array.from(this.tempImages.entries());
        const toRemove = images.slice(0, images.length - this.maxTempImages);
        
        toRemove.forEach(([id]) => {
            this.tempImages.delete(id);
        });
    }

    /**
     * Convert base64 to blob for downloading
     * @param {string} base64Data
     * @returns {Blob}
     */
    base64ToBlob(base64Data) {
        // Remove data URL prefix if present
        const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'image/jpeg' });
    }

    /**
     * Download image to user's computer
     * @param {string} imageId
     */
    async downloadImage(imageId) {
        const image = this.getImage(imageId);
        if (!image) {
            throw new Error('Image not found');
        }

        const blob = this.base64ToBlob(image.data);
        const url = URL.createObjectURL(blob);

        // Chrome downloads API limitation: Can only download to Downloads directory or subdirectories
        // The filename format has been fixed to YYYY_MM_DD_HHMMSS_shot.jpg
        chrome.downloads.download({
            url: url,
            filename: `InsightBuddy-extension/shot/${image.filename}`,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to download image:', chrome.runtime.lastError.message);
            } else {
                console.log(`Image downloaded: ${image.filename}`);
                console.log('Note: Due to browser security restrictions, images are saved to Downloads/InsightBuddy-extension/shot/');
                console.log('Please move files to Pictures/InsightBuddy-extension/shot/ manually if needed.');
                
                // Show notification to user if possible
                this.showDownloadNotification(image.filename);
            }
            // Clean up the object URL after download starts
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }

    /**
     * Show notification about download location
     * @param {string} filename 
     */
    showDownloadNotification(filename) {
        try {
            // Try to show a browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Image Downloaded', {
                    body: `${filename} saved to Downloads/InsightBuddy-extension/shot/\nNote: You can move it to Pictures/InsightBuddy-extension/shot/ if desired.`,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>'
                });
            } else if ('Notification' in window && Notification.permission !== 'denied') {
                // Request permission for future notifications
                Notification.requestPermission();
            }
        } catch (error) {
            console.log('Could not show notification:', error.message);
        }
    }

    /**
     * Clear all temporary images from memory and storage
     */
    async clearAllImages() {
        this.tempImages.clear();
        
        // Also clear from Chrome storage
        try {
            await chrome.storage.local.clear();
            console.log('Cleared all images from storage and memory');
        } catch (error) {
            console.error('Error clearing Chrome storage:', error);
        }
    }

    /**
     * Clear only temporary images from memory
     */
    clearTempImages() {
        this.tempImages.clear();
        console.log('Cleared temporary images from memory');
    }

    /**
     * Get image as data URL for display
     * @param {string} imageId
     * @returns {string|null}
     */
    getImageDataUrl(imageId) {
        const image = this.getImage(imageId);
        if (!image) return null;

        // Ensure data URL format
        if (!image.data.startsWith('data:')) {
            return `data:image/png;base64,${image.data}`;
        }
        return image.data;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageStorageService;
}

// Also expose to global scope for script tag usage
if (typeof window !== 'undefined') {
    window.ImageStorageService = ImageStorageService;
} else if (typeof global !== 'undefined') {
    global.ImageStorageService = ImageStorageService;
}