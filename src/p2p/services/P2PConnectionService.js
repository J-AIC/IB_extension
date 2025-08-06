/**
 * P2P Connection Service
 * Handles WebRTC peer-to-peer connections for image transfer
 */

class P2PConnectionService {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.peerId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isConnected = false;
        this.connectionListeners = [];
        this.dataListeners = [];
        this.errorListeners = [];
    }

    /**
     * Initialize the P2P connection with a fixed peer ID
     * @returns {Promise<string>} The peer ID
     */
    async initialize() {
        try {
            // Get or generate a fixed peer ID
            this.peerId = await this.getOrGeneratePeerId();
            
            // Initialize PeerJS with the fixed ID
            this.peer = new Peer(this.peerId, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            // Set up peer event handlers
            this.setupPeerEventHandlers();

            return new Promise((resolve, reject) => {
                this.peer.on('open', (id) => {
                    console.log('P2P Connection initialized with ID:', id);
                    this.peerId = id;
                    resolve(id);
                });

                this.peer.on('error', (error) => {
                    console.error('P2P initialization error:', error);
                    reject(error);
                });

                // Timeout after 10 seconds
                setTimeout(() => {
                    reject(new Error('P2P initialization timeout'));
                }, 10000);
            });
        } catch (error) {
            console.error('Failed to initialize P2P connection:', error);
            throw error;
        }
    }

    /**
     * Get or generate a fixed peer ID for persistent connections
     * @returns {Promise<string>}
     */
    async getOrGeneratePeerId() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['p2pPeerId'], (result) => {
                if (result.p2pPeerId) {
                    resolve(result.p2pPeerId);
                } else {
                    // Generate a new peer ID
                    const newPeerId = 'ib-' + Math.random().toString(36).substr(2, 9);
                    chrome.storage.local.set({ p2pPeerId: newPeerId }, () => {
                        resolve(newPeerId);
                    });
                }
            });
        });
    }

    /**
     * Set up event handlers for the peer connection
     */
    setupPeerEventHandlers() {
        this.peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer);
            this.handleIncomingConnection(conn);
        });

        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
            this.isConnected = false;
            this.notifyConnectionListeners('disconnected');
            this.attemptReconnect();
        });

        this.peer.on('close', () => {
            console.log('Peer connection closed');
            this.isConnected = false;
            this.notifyConnectionListeners('closed');
        });

        this.peer.on('error', (error) => {
            console.error('Peer error:', error);
            this.notifyErrorListeners(error);
        });
    }

    /**
     * Handle incoming connections
     * @param {DataConnection} conn
     */
    handleIncomingConnection(conn) {
        this.connection = conn;

        conn.on('open', () => {
            console.log('Connection opened with:', conn.peer);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.notifyConnectionListeners('connected');
        });

        conn.on('data', (data) => {
            console.log('Received data:', data.type);
            this.notifyDataListeners(data);
        });

        conn.on('close', () => {
            console.log('Connection closed');
            this.isConnected = false;
            this.notifyConnectionListeners('disconnected');
        });

        conn.on('error', (error) => {
            console.error('Connection error:', error);
            this.notifyErrorListeners(error);
        });
    }

    /**
     * Attempt to reconnect to the peer network
     */
    async attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            if (!this.peer.destroyed) {
                this.peer.reconnect();
            }
        }, 2000 * this.reconnectAttempts);
    }

    /**
     * Send data through the connection
     * @param {Object} data
     */
    sendData(data) {
        if (!this.connection || !this.isConnected) {
            throw new Error('No active connection');
        }

        this.connection.send(data);
    }

    /**
     * Add a connection status listener
     * @param {Function} listener
     */
    onConnectionChange(listener) {
        this.connectionListeners.push(listener);
    }

    /**
     * Add a data reception listener
     * @param {Function} listener
     */
    onDataReceived(listener) {
        this.dataListeners.push(listener);
    }

    /**
     * Add an error listener
     * @param {Function} listener
     */
    onError(listener) {
        this.errorListeners.push(listener);
    }

    /**
     * Notify connection status listeners
     * @param {string} status
     */
    notifyConnectionListeners(status) {
        this.connectionListeners.forEach(listener => {
            try {
                listener(status);
            } catch (error) {
                console.error('Error in connection listener:', error);
            }
        });
    }

    /**
     * Notify data listeners
     * @param {Object} data
     */
    notifyDataListeners(data) {
        this.dataListeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error('Error in data listener:', error);
            }
        });
    }

    /**
     * Notify error listeners
     * @param {Error} error
     */
    notifyErrorListeners(error) {
        this.errorListeners.forEach(listener => {
            try {
                listener(error);
            } catch (error) {
                console.error('Error in error listener:', error);
            }
        });
    }

    /**
     * Get the current connection status
     * @returns {Object}
     */
    getStatus() {
        return {
            peerId: this.peerId,
            isConnected: this.isConnected,
            connectedPeer: this.connection?.peer || null,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Close the P2P connection
     */
    close() {
        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.isConnected = false;
        this.connection = null;
        this.peer = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = P2PConnectionService;
}

// Also expose to global scope for script tag usage
if (typeof window !== 'undefined') {
    window.P2PConnectionService = P2PConnectionService;
} else if (typeof global !== 'undefined') {
    global.P2PConnectionService = P2PConnectionService;
}