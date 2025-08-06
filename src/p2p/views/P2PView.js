/**
 * P2P View
 * Handles the UI for P2P image reception functionality
 */

class P2PView extends View {
    constructor(element, model) {
        super(element, model);
        
        this.qrCodeContainer = null;
        this.statusContainer = null;
        this.imagePreviewContainer = null;
        this.logsContainer = null;
        this.shotButton = null;
    }

    initialize() {
        console.log('P2PView: initialize() called');
        this.render();
        this.attachEventListeners();
        console.log('P2PView: initialization complete, qrCodeContainer:', this.qrCodeContainer);
    }

    render() {
        const html = `
            <!-- QR Code Section -->
            <div class="connection-section">
                <div class="qr-container" id="qr-container">
                    <div class="qr-placeholder">
                        <div class="qr-loading">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">
                                <i class="bi bi-qr-code"></i>
                                <span>QRコード生成中...</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="qr-instructions">
                    <i class="bi bi-phone"></i>
                    スマートフォンでQRコードをスキャンしてP2P接続<br>
                    このページを閉じるとP2P接続は切断されます<br>
                </div>
            </div>
            <!-- Shot Button -->
            <div class="shot-section">
                <button class="shot-button" id="shot-button" ${!this.model.get('isConnected') ? 'disabled' : ''}>
                    <i class="bi bi-camera"></i> Shot
                </button>
            </div>
            <!-- 利用条件 -->
            <div class="usage-instructions">
                <strong>（ご利用条件）</strong><br>
                同じWi‑Fi／LAN（同一ネットワークセグメント）で<br>
                ご利用ください。<br>
                接続できない場合は、スマートフォンの 広告ブロッカーを<br>
                一時的に無効化するか、本サイトを除外設定してください。<br>
            </div>
            <!-- Image Preview -->
            <div class="image-preview-card" id="image-preview-section" style="${!this.model.get('currentImage') ? 'display: none;' : ''}">
                <div class="preview-header">
                    <i class="bi bi-image"></i>
                    受信した画像
                </div>
                <div class="image-preview" id="image-preview">
                    <!-- Image will be displayed here -->
                </div>
                <div class="image-actions">
                    <button class="action-btn btn-primary-action" id="save-image-btn">
                        <i class="bi bi-download"></i> 保存
                    </button>
                </div>
            </div>

            <!-- Image Transfer Progress -->
            <div class="progress-card" id="progress-section" style="${!this.model.get('isReceivingImage') ? 'display: none;' : ''}">
                <div class="progress-label">
                    <i class="bi bi-cloud-download"></i>
                    画像を受信中... ${this.model.get('imageTransferProgress')}%
                </div>
                <div class="progress">
                    <div class="progress-bar progress-bar-animated" 
                         style="width: ${this.model.get('imageTransferProgress')}%">
                    </div>
                </div>
            </div>

            <!-- Error Display -->
            <div class="error-card" id="error-section" style="${!this.model.get('lastError') ? 'display: none;' : ''}">
                <div class="error-header">
                    <i class="bi bi-exclamation-triangle"></i>
                    エラーが発生しました
                </div>
                <div id="error-message">${this.model.get('lastError')}</div>
            </div>

            <!-- Debug Logs (Hidden by default) -->
            <div class="debug-panel" id="logs-section" style="${!this.model.get('debugMode') ? 'display: none;' : ''}">
                <div class="debug-header">
                    <span><i class="bi bi-terminal"></i> Debug Logs</span>
                    <button class="action-btn btn-secondary-action" id="clear-logs-btn" style="padding: 4px 8px; font-size: 12px;">
                        <i class="bi bi-trash"></i> Clear
                    </button>
                </div>
                <div class="logs-container" id="logs-container">
                    <pre style="margin: 0; font-size: 11px; line-height: 1.4;">${this.model.getFormattedLogs()}</pre>
                </div>
            </div>
        `;

        this.element.innerHTML = html;
        console.log('P2PView: HTML rendered');
        
        // Store references to key elements
        this.qrCodeContainer = this.element.querySelector('#qr-container');
        this.imagePreviewContainer = this.element.querySelector('#image-preview');
        this.logsContainer = this.element.querySelector('#logs-container');
        this.shotButton = this.element.querySelector('#shot-button');
        
        console.log('P2PView: Element references set up');
        console.log('qrCodeContainer:', this.qrCodeContainer);
        console.log('shotButton:', this.shotButton);
        
        // Generate QR code if peer ID is available
        if (this.model.get('peerId')) {
            console.log('Generating QR code on render with peer ID:', this.model.get('peerId'));
            this.generateQRCode();
        } else {
            console.log('No peer ID available yet for QR code generation');
        }
    }

    attachEventListeners() {
        // Debug toggle (moved to global button in HTML)
        const debugToggle = document.querySelector('#debug-toggle');
        if (debugToggle) {
            debugToggle.addEventListener('click', () => {
                this.controller.toggleDebugMode();
            });
        }

        // Shot button
        this.shotButton.addEventListener('click', () => {
            this.controller.requestImageCapture();
        });

        // Save image button
        const saveBtn = this.element.querySelector('#save-image-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.controller.saveCurrentImage();
            });
        }

        // Use image for form button
        const useBtn = this.element.querySelector('#use-image-btn');
        if (useBtn) {
            useBtn.addEventListener('click', () => {
                this.controller.useImageForForm();
            });
        }

        // Clear logs button
        const clearLogsBtn = this.element.querySelector('#clear-logs-btn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.controller.clearLogs();
            });
        }

        // Error dismiss
        const errorSection = this.element.querySelector('#error-section');
        if (errorSection) {
            errorSection.addEventListener('closed.bs.alert', () => {
                this.model.clearError();
            });
        }
    }

    onModelChange(change) {
        console.log('Model change detected:', change.key, change.newValue);
        switch (change.key) {
            case 'connectionStatus':
            case 'isConnected':
                this.updateConnectionStatus();
                break;
            case 'qrCodeData':
                console.log('QR code data changed, generating QR code');
                this.generateQRCode();
                break;
            case 'currentImage':
                this.updateImagePreview();
                break;
            case 'imageTransferProgress':
            case 'isReceivingImage':
                this.updateProgress();
                break;
            case 'lastError':
                this.updateError();
                break;
            case 'debugMode':
                this.toggleDebugView();
                break;
            case 'connectionLogs':
                this.updateLogs();
                break;
        }
    }

    generateQRCode() {
        console.log('generateQRCode called');
        const qrData = this.model.get('qrCodeData');
        console.log('QR Data:', qrData);
        
        // Find QR container if not cached
        if (!this.qrCodeContainer) {
            this.qrCodeContainer = this.element.querySelector('#qr-container');
            console.log('Found QR Container:', this.qrCodeContainer);
        }
        
        if (!qrData || !this.qrCodeContainer) {
            console.log('Missing qrData or container, returning');
            console.log('qrData:', !!qrData, 'container:', !!this.qrCodeContainer);
            return;
        }

        // Clear existing QR code
        this.qrCodeContainer.innerHTML = '';
        console.log('Generating QR code with data:', qrData);

        // Create modern QR code container
        const qrWrapper = document.createElement('div');
        qrWrapper.style.cssText = `
            position: relative;
            display: inline-block;
            padding: 20px;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 20px;
            box-shadow: 
                0 10px 25px rgba(0, 0, 0, 0.1),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
        `;

        // Check if QRCode library is available
        if (typeof QRCode === 'undefined') {
            console.error('QRCode library not available');
            qrWrapper.innerHTML = '<div style="color: red; text-align: center;">QRCode library not loaded</div>';
            this.qrCodeContainer.appendChild(qrWrapper);
            return;
        }

        // Generate QR code with modern styling
        console.log('Creating QR code with QRCode library');
        try {
            new QRCode(qrWrapper, {
                text: qrData,
                width: 180,
                height: 180,
                colorDark: '#1f2937',
                colorLight: 'transparent',
                correctLevel: QRCode.CorrectLevel.H
            });
            console.log('QR code created successfully');
        } catch (error) {
            console.error('Error creating QR code:', error);
            qrWrapper.innerHTML = '<div style="color: red; text-align: center;">Failed to generate QR code</div>';
        }

        // Add modern corner indicators
        const corners = ['top-left', 'top-right', 'bottom-left'];
        corners.forEach(corner => {
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: absolute;
                width: 20px;
                height: 20px;
                border: 3px solid #6366f1;
                ${corner.includes('top') ? 'top: 15px;' : 'bottom: 15px;'}
                ${corner.includes('left') ? 'left: 15px;' : 'right: 15px;'}
                ${corner.includes('top') && corner.includes('left') ? 'border-right: none; border-bottom: none;' : ''}
                ${corner.includes('top') && corner.includes('right') ? 'border-left: none; border-bottom: none;' : ''}
                ${corner.includes('bottom') && corner.includes('left') ? 'border-right: none; border-top: none;' : ''}
                border-radius: 4px;
                opacity: 0.8;
            `;
            qrWrapper.appendChild(indicator);
        });

        // Add center logo placeholder
        const centerLogo = document.createElement('div');
        centerLogo.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            border: 3px solid white;
        `;
        centerLogo.innerHTML = '<i class="bi bi-camera"></i>';
        qrWrapper.appendChild(centerLogo);

        // Add scan animation ring
        const scanRing = document.createElement('div');
        scanRing.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            bottom: 10px;
            border: 2px solid #6366f1;
            border-radius: 16px;
            opacity: 0.3;
            animation: pulse 2s infinite;
        `;
        qrWrapper.appendChild(scanRing);

        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); opacity: 0.3; }
                50% { transform: scale(1.02); opacity: 0.1; }
                100% { transform: scale(1); opacity: 0.3; }
            }
        `;
        document.head.appendChild(style);

        this.qrCodeContainer.appendChild(qrWrapper);
    }

    updateConnectionStatus() {
        const isConnected = this.model.get('isConnected');
        const status = this.model.get('connectionStatus');
        
        // Update status badge in header
        const statusBadge = document.querySelector('#status-badge');
        if (statusBadge) {
            statusBadge.className = `status-badge ${isConnected ? 'connected' : 'disconnected'}`;
            statusBadge.textContent = this.getStatusText();
        }
        
        // Update shot button state
        this.shotButton.disabled = !isConnected;
    }

    getStatusText() {
        const status = this.model.get('connectionStatus');
        const deviceName = this.model.get('connectedDeviceName');
        
        switch (status) {
            case 'connected':
                return `接続済み`;
            case 'connecting':
                return '接続中...';
            case 'disconnected':
                return '待機中';
            case 'error':
                return 'エラー';
            default:
                return '待機中';
        }
    }

    updateImagePreview() {
        const currentImage = this.model.get('currentImage');
        const section = this.element.querySelector('#image-preview-section');
        
        if (!currentImage) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        
        // Get image data URL from controller
        const imageDataUrl = this.controller.getImageDataUrl(currentImage.id);
        
        if (imageDataUrl) {
            this.imagePreviewContainer.innerHTML = `
                <img src="${imageDataUrl}" alt="Received image" class="img-fluid">
                <div class="image-info">
                    <small>${currentImage.filename} - ${this.formatFileSize(currentImage.size)}</small>
                </div>
            `;
        }
    }

    updateProgress() {
        const isReceiving = this.model.get('isReceivingImage');
        const progress = this.model.get('imageTransferProgress');
        const section = this.element.querySelector('#progress-section');
        
        section.style.display = isReceiving ? 'block' : 'none';
        
        if (isReceiving) {
            const progressBar = section.querySelector('.progress-bar');
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
        }
    }

    updateError() {
        const error = this.model.get('lastError');
        const section = this.element.querySelector('#error-section');
        
        if (error) {
            section.style.display = 'block';
            this.element.querySelector('#error-message').textContent = error;
        } else {
            section.style.display = 'none';
        }
    }

    toggleDebugView() {
        const debugMode = this.model.get('debugMode');
        const logsSection = this.element.querySelector('#logs-section');
        const debugToggle = document.querySelector('#debug-toggle');
        
        logsSection.style.display = debugMode ? 'block' : 'none';
        
        if (debugToggle) {
            debugToggle.style.display = debugMode ? 'block' : 'none';
        }
        
        if (debugMode) {
            this.updateLogs();
        }
    }

    updateLogs() {
        if (this.logsContainer) {
            this.logsContainer.innerHTML = `<pre>${this.model.getFormattedLogs()}</pre>`;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Add styles for the P2P view (now handled in HTML)
     */
    static getStyles() {
        return '';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = P2PView;
}

// Also expose to global scope for script tag usage
if (typeof window !== 'undefined') {
    window.P2PView = P2PView;
} else if (typeof global !== 'undefined') {
    global.P2PView = P2PView;
}