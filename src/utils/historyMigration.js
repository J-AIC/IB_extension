/**
 * historyMigration.js
 * 
 * Utility to migrate chat history data from old storage formats to the new
 * standardized ChatHistoryService format.
 */

/**
 * Migrate chat history from old storage keys and formats
 * @param {Object} storageService - Storage service instance
 * @param {Object} [options={}] - Migration options
 * @returns {Promise<Object>} Migration results
 */
export async function migrateChatHistory(storageService, options = {}) {
    const {
        oldKeys = ['chat_history', 'conversation_history'],
        newKey = 'chatHistory',
        recentOldKey = 'recent_conversation',
        recentNewKey = 'recentConversation',
        dryRun = false,
        cleanupOldKeys = true
    } = options;
    
    const results = {
        migratedConversations: 0,
        migratedRecent: false,
        errors: [],
        conversationsProcessed: 0,
        oldDataFound: false
    };
    
    try {
        console.log('Starting chat history migration...');
        
        // Get all storage data
        const allKeys = [...oldKeys, newKey, recentOldKey, recentNewKey];
        const storageData = await storageService.get(allKeys);
        
        let migratedHistory = storageData[newKey] || [];
        let foundOldData = false;
        
        // Migrate conversation history from old keys
        for (const oldKey of oldKeys) {
            const oldHistory = storageData[oldKey];
            
            if (oldHistory && Array.isArray(oldHistory) && oldHistory.length > 0) {
                console.log(`Found ${oldHistory.length} conversations in old key: ${oldKey}`);
                foundOldData = true;
                results.oldDataFound = true;
                
                for (const oldConversation of oldHistory) {
                    try {
                        const migratedConversation = await migrateConversation(oldConversation);
                        
                        if (migratedConversation) {
                            // Check if conversation already exists in new format
                            const existingIndex = migratedHistory.findIndex(c => 
                                c.id === migratedConversation.id || 
                                areSimilarConversations(c, migratedConversation)
                            );
                            
                            if (existingIndex === -1) {
                                migratedHistory.push(migratedConversation);
                                results.migratedConversations++;
                            } else {
                                console.log(`Skipping duplicate conversation: ${migratedConversation.id}`);
                            }
                        }
                        
                        results.conversationsProcessed++;
                    } catch (error) {
                        console.error('Error migrating conversation:', error);
                        results.errors.push({
                            type: 'conversation',
                            oldKey,
                            conversation: oldConversation,
                            error: error.message
                        });
                    }
                }
            }
        }
        
        // Migrate recent conversation
        const oldRecent = storageData[recentOldKey];
        if (oldRecent && !storageData[recentNewKey]) {
            try {
                const migratedRecent = await migrateConversation(oldRecent);
                
                if (migratedRecent && !dryRun) {
                    await storageService.set({ [recentNewKey]: migratedRecent });
                    results.migratedRecent = true;
                    foundOldData = true;
                    results.oldDataFound = true;
                    console.log('Migrated recent conversation');
                }
            } catch (error) {
                console.error('Error migrating recent conversation:', error);
                results.errors.push({
                    type: 'recent',
                    error: error.message
                });
            }
        }
        
        // Sort migrated history by timestamp (newest first)
        migratedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Limit history size
        const maxHistory = 30;
        if (migratedHistory.length > maxHistory) {
            const removed = migratedHistory.splice(maxHistory);
            console.log(`Trimmed ${removed.length} old conversations during migration`);
        }
        
        // Save migrated data
        if (foundOldData && results.migratedConversations > 0 && !dryRun) {
            await storageService.set({ [newKey]: migratedHistory });
            console.log(`Saved ${migratedHistory.length} conversations to new format`);
            
            // Clean up old storage keys if requested
            if (cleanupOldKeys) {
                try {
                    const keysToRemove = [];
                    for (const oldKey of oldKeys) {
                        if (storageData[oldKey]) {
                            keysToRemove.push(oldKey);
                        }
                    }
                    if (storageData[recentOldKey]) {
                        keysToRemove.push(recentOldKey);
                    }
                    
                    if (keysToRemove.length > 0) {
                        await storageService.remove(keysToRemove);
                        console.log(`Cleaned up old storage keys: ${keysToRemove.join(', ')}`);
                    }
                } catch (error) {
                    console.error('Error cleaning up old keys:', error);
                    results.errors.push({
                        type: 'cleanup',
                        error: error.message
                    });
                }
            }
        }
        
        if (dryRun) {
            console.log('Migration dry run completed:', results);
        } else if (foundOldData) {
            console.log('Migration completed successfully:', results);
        } else {
            console.log('No old data found, migration not needed');
        }
        
        return results;
    } catch (error) {
        console.error('Migration failed:', error);
        results.errors.push({
            type: 'migration',
            error: error.message
        });
        throw error;
    }
}

/**
 * Migrate a single conversation object to the new format
 * @param {Object} oldConversation - Old conversation object
 * @returns {Promise<Object>} Migrated conversation object
 */
async function migrateConversation(oldConversation) {
    if (!oldConversation) {
        return null;
    }
    
    // Handle different old formats
    let messages = [];
    let provider = 'unknown';
    let model = 'unknown';
    let timestamp = new Date().toISOString();
    let title = 'Untitled Conversation';
    let id = null;
    
    // Extract messages from various old formats
    if (oldConversation.messages && Array.isArray(oldConversation.messages)) {
        messages = oldConversation.messages;
    } else if (oldConversation.conversation && oldConversation.conversation.messages) {
        messages = oldConversation.conversation.messages;
    } else if (Array.isArray(oldConversation)) {
        // Some old formats stored messages directly as arrays
        messages = oldConversation;
    }
    
    // Skip conversations without messages
    if (!messages || messages.length === 0) {
        return null;
    }
    
    // Extract metadata
    if (oldConversation.provider) {
        provider = oldConversation.provider;
    } else if (oldConversation.conversation && oldConversation.conversation.provider) {
        provider = oldConversation.conversation.provider;
    }
    
    if (oldConversation.model) {
        model = oldConversation.model;
    } else if (oldConversation.conversation && oldConversation.conversation.model) {
        model = oldConversation.conversation.model;
    }
    
    if (oldConversation.timestamp) {
        timestamp = oldConversation.timestamp;
    } else if (oldConversation.conversation && oldConversation.conversation.timestamp) {
        timestamp = oldConversation.conversation.timestamp;
    } else if (messages.length > 0 && messages[0].timestamp) {
        timestamp = messages[0].timestamp;
    }
    
    if (oldConversation.title) {
        title = oldConversation.title;
    } else {
        // Generate title from first user message
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (firstUserMessage && firstUserMessage.content) {
            title = firstUserMessage.content.trim().slice(0, 50);
            if (firstUserMessage.content.length > 50) {
                title += '...';
            }
        }
    }
    
    if (oldConversation.id) {
        id = oldConversation.id;
    } else {
        // Generate new ID based on content hash
        const firstMessage = messages[0];
        if (firstMessage) {
            const contentHash = await simpleHash(firstMessage.content + timestamp);
            id = `migrated_${contentHash}_${Date.now()}`;
        } else {
            id = `migrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }
    
    return {
        id,
        title,
        provider,
        model,
        timestamp,
        messages: messages.filter(m => m && m.role && m.content), // Clean up invalid messages
        migrated: true, // Mark as migrated for tracking
        migratedAt: new Date().toISOString()
    };
}

/**
 * Check if two conversations are similar (likely duplicates)
 * @param {Object} conv1 - First conversation
 * @param {Object} conv2 - Second conversation
 * @returns {boolean} True if conversations are similar
 */
function areSimilarConversations(conv1, conv2) {
    if (!conv1 || !conv2 || !conv1.messages || !conv2.messages) {
        return false;
    }
    
    // Same number of messages
    if (conv1.messages.length !== conv2.messages.length) {
        return false;
    }
    
    // Same first message content
    const firstMsg1 = conv1.messages.find(m => m.role === 'user');
    const firstMsg2 = conv2.messages.find(m => m.role === 'user');
    
    if (firstMsg1 && firstMsg2) {
        return firstMsg1.content === firstMsg2.content;
    }
    
    return false;
}

/**
 * Simple hash function for generating consistent IDs
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hash string
 */
async function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Check if migration is needed
 * @param {Object} storageService - Storage service instance
 * @returns {Promise<boolean>} True if migration is needed
 */
export async function isMigrationNeeded(storageService) {
    try {
        const oldKeys = ['chat_history', 'conversation_history', 'recent_conversation'];
        const storageData = await storageService.get(oldKeys);
        
        for (const key of oldKeys) {
            if (storageData[key]) {
                console.log(`Old data found in key: ${key}`);
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error checking migration status:', error);
        return false;
    }
}

/**
 * Auto-migrate if needed during app initialization
 * @param {Object} storageService - Storage service instance
 * @param {Object} [options={}] - Migration options
 * @returns {Promise<Object>} Migration results or null if not needed
 */
export async function autoMigrate(storageService, options = {}) {
    try {
        const migrationNeeded = await isMigrationNeeded(storageService);
        
        if (migrationNeeded) {
            console.log('Auto-migration starting...');
            return await migrateChatHistory(storageService, {
                ...options,
                dryRun: false,
                cleanupOldKeys: true
            });
        } else {
            console.log('No migration needed');
            return null;
        }
    } catch (error) {
        console.error('Auto-migration failed:', error);
        throw error;
    }
}