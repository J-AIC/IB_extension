/**
 * P2P Receiver Initialization Script (ES6 Module)
 * Proper module-based initialization for P2P Image Receiver
 */

// Import architecture components
import { Model, View, Controller, container, eventBus } from './src/architecture.js';

// Wait for DOM to be ready
function waitForDOM() {
    return new Promise(resolve => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

// Load a script dynamically as a regular script (not module)
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log(`Loaded: ${src}`);
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load: ${src}`);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
}

async function initializeP2P() {
    try {
        console.log('P2P Receiver: Starting module-based initialization...');
        
        // Wait for DOM
        await waitForDOM();
        
        // First ensure base architecture classes are available globally
        window.Model = Model;
        window.View = View;
        window.Controller = Controller;
        window.container = container;
        window.eventBus = eventBus;
        
        console.log('P2P Receiver: Base classes exposed to global scope');
        
        // Load P2P modules (these need to be loaded as regular scripts since they use global classes)
        const scriptsToLoad = [
            'src/p2p/services/P2PConnectionService.js',
            'src/p2p/services/ImageStorageService.js',
            'src/p2p/models/P2PModel.js',
            'src/p2p/views/P2PView.js',
            'src/p2p/controllers/P2PController.js'
        ];
        
        for (const script of scriptsToLoad) {
            await loadScript(script);
        }
        
        // Wait a bit for scripts to be processed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check if all required classes are available on window/global scope
        if (typeof window.P2PConnectionService === 'undefined') {
            throw new Error('P2PConnectionService not available');
        }
        if (typeof window.ImageStorageService === 'undefined') {
            throw new Error('ImageStorageService not available');
        }
        if (typeof window.P2PModel === 'undefined') {
            throw new Error('P2PModel not available');
        }
        if (typeof window.P2PView === 'undefined') {
            throw new Error('P2PView not available');
        }
        if (typeof window.P2PController === 'undefined') {
            throw new Error('P2PController not available');
        }
        
        console.log('P2P Receiver: All classes available, initializing components...');
        
        // Get container element
        const containerElement = document.getElementById('p2p-container');
        if (!containerElement) {
            throw new Error('P2P container element not found');
        }
        
        // Create services using global classes
        const connectionService = new window.P2PConnectionService();
        const storageService = new window.ImageStorageService();
        
        // Create MVC components using global classes
        const model = new window.P2PModel();
        const view = new window.P2PView(containerElement, model);
        const controller = new window.P2PController(model, view, connectionService, storageService);
        
        // Set controller reference in view
        view.controller = controller;
        
        // Ensure view is properly initialized
        if (typeof view.initialize === 'function') {
            view.initialize();
        }
        
        // Add styles
        if (typeof window.P2PView.getStyles === 'function') {
            const style = document.createElement('style');
            style.textContent = window.P2PView.getStyles();
            document.head.appendChild(style);
        }
        
        // Initialize
        await controller.initializeAsync();
        
        console.log('P2P Image Receiver initialized successfully');
        
        // Update status badge to show successful initialization
        const statusBadge = document.querySelector('#status-badge');
        if (statusBadge && !controller.model.get('isConnected')) {
            statusBadge.textContent = '準備完了';
            statusBadge.className = 'status-badge disconnected';
        }
        
    } catch (error) {
        console.error('Failed to initialize P2P Image Receiver:', error);
        
        // Show error message
        const container = document.getElementById('p2p-container');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <h4 class="alert-heading">初期化エラー</h4>
                    <p>P2P Image Receiverの初期化に失敗しました。</p>
                    <hr>
                    <p class="mb-0">${error.message}</p>
                    <small class="text-muted">詳細はブラウザのコンソールをご確認ください。</small>
                </div>
            `;
        }
    }
}

// Start initialization
initializeP2P();