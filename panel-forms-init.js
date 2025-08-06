/**
 * Forms panel initialization script
 * Handles loading forms content and initializing the comprehensive FormController
 */

// Initialize forms content when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Forms panel initializing...');
    
    try {
        // Load forms popup content
        const response = await fetch(chrome.runtime.getURL('forms/popup.html'));
        const htmlText = await response.text();
        
        // Parse and insert content
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        const formsContent = document.getElementById('formsContent');
        if (formsContent) {
            formsContent.innerHTML = doc.body.innerHTML;
            
            // Get loading state element once
            const loadingState = document.getElementById('loadingState');
            
            // Hide initial loading and show content
            if (loadingState) {
                loadingState.classList.add('hidden');
            }
            formsContent.classList.remove('hidden');
            
            console.log('Forms content loaded successfully');
            
            // Check if we need to refresh the tab to get page access
            const needsRefresh = await checkIfTabNeedsRefresh();
            
            if (needsRefresh) {
                // Show loading message while refreshing
                if (loadingState) {
                    loadingState.innerHTML = `
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <p>Refreshing page to get access to content...</p>
                        </div>
                    `;
                    loadingState.classList.remove('hidden');
                }
                
                // Refresh the active tab to get content access
                await refreshActiveTab();
                
                // Hide loading message
                if (loadingState) {
                    loadingState.classList.add('hidden');
                }
            } else {
                console.log('Page context already available - skipping refresh');
            }
            
            // Load required scripts dynamically
            await loadFormsScripts();
            
            // Set up tab switch listener
            setupTabSwitchListener();
            
            // Set up visibility change listener for when switching between panels
            setupPanelVisibilityListener();
            
            // Set up refresh button
            setupRefreshButton();
            
            console.log('Forms initialization complete');
        }
        
    } catch (error) {
        console.error('Error loading forms content:', error);
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.innerHTML = `
                <div class="status-error">
                    <strong>Error loading forms content</strong><br>
                    Please try refreshing the panel.
                </div>
            `;
        }
    }
});

/**
 * Load required scripts for forms functionality
 */
async function loadFormsScripts() {
    console.log('Loading forms scripts...');
    
    const scriptList = [
        'assets/js/pdf.min.js',
        'assets/js/Readability.js',
        'forms/web_list.js',
        'src/p2p/integration/FormsIntegration.js'
    ];
    
    // Load scripts sequentially to handle dependencies
    for (const scriptPath of scriptList) {
        try {
            await loadScript(scriptPath);
            console.log(`Loaded script: ${scriptPath}`);
        } catch (error) {
            console.warn(`Failed to load script: ${scriptPath}`, error);
        }
    }
    
    // Load module scripts that use import statements
    const moduleScripts = [
        'forms/gpt.js',
        'forms/popup.js'
    ];
    
    for (const scriptPath of moduleScripts) {
        try {
            await loadScript(scriptPath, true);
            console.log(`Loaded module script: ${scriptPath}`);
        } catch (error) {
            console.warn(`Failed to load module script: ${scriptPath}`, error);
        }
    }
    
    // Wait a bit for the FormController to initialize
    setTimeout(() => {
        if (window.formController) {
            console.log('FormController is ready and initialized');
        } else {
            console.warn('FormController not found on window object');
        }
    }, 1000);
}

/**
 * Load a script dynamically
 * @param {string} src - Script source path
 * @param {boolean} isModule - Whether to load as module
 */
function loadScript(src, isModule = false) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(src);
        script.type = isModule ? 'module' : 'text/javascript';
        
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        
        document.head.appendChild(script);
    });
}

/**
 * Check if the tab needs to be refreshed to get page access
 * @returns {boolean} Whether the tab needs to be refreshed
 */
async function checkIfTabNeedsRefresh() {
    try {
        // Get the active tab
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!activeTab || !activeTab.id) {
            console.log('No active tab found');
            return false;
        }
        
        // Skip refresh check for special URLs
        if (!shouldRefreshTab(activeTab)) {
            console.log('Special URL - no refresh needed');
            return false;
        }
        
        // Try to send a message to the content script to check if it's accessible
        try {
            const response = await chrome.tabs.sendMessage(activeTab.id, { 
                action: 'ping' 
            });
            
            if (response && response.success) {
                console.log('Content script is accessible - no refresh needed');
                return false;
            }
        } catch (error) {
            console.log('Content script not accessible - refresh needed');
            return true;
        }
        
        // If we get here, assume we need a refresh
        return true;
        
    } catch (error) {
        console.warn('Error checking tab access:', error);
        // If we can't check, assume we don't need to refresh
        return false;
    }
}

/**
 * Refresh the active tab to get the most recent content
 */
async function refreshActiveTab() {
    try {
        console.log('Refreshing active tab for latest content...');
        
        // Get the active tab
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (activeTab && activeTab.id) {
            // Check if we should refresh this tab
            if (!shouldRefreshTab(activeTab)) {
                console.log('Skipping tab refresh for special URL:', activeTab.url);
                return;
            }
            
            // Reload the tab
            await chrome.tabs.reload(activeTab.id);
            console.log('Active tab refreshed successfully');
            
            // Wait a moment for the page to start loading
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Wait for the tab to finish loading
            await waitForTabToLoad(activeTab.id);
            
        } else {
            console.warn('No active tab found to refresh');
        }
        
    } catch (error) {
        console.warn('Could not refresh active tab:', error);
        // Don't throw error, just continue with form loading
    }
}

/**
 * Check if a tab should be refreshed
 * @param {object} tab - Chrome tab object
 * @returns {boolean} Whether the tab should be refreshed
 */
function shouldRefreshTab(tab) {
    if (!tab.url) return false;
    
    // Skip refreshing for these URL patterns
    const skipPatterns = [
        'chrome://',
        'chrome-extension://',
        'edge://',
        'about:',
        'moz-extension://',
        'file://',
        'data:',
        'blob:'
    ];
    
    // Check if URL starts with any skip pattern
    for (const pattern of skipPatterns) {
        if (tab.url.startsWith(pattern)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Wait for a tab to finish loading
 * @param {number} tabId - ID of the tab to wait for
 */
function waitForTabToLoad(tabId) {
    return new Promise((resolve) => {
        const checkTabStatus = () => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    console.warn('Tab check error:', chrome.runtime.lastError);
                    resolve(); // Continue even if there's an error
                    return;
                }
                
                if (tab.status === 'complete') {
                    console.log('Tab finished loading');
                    resolve();
                } else {
                    // Check again after a short delay
                    setTimeout(checkTabStatus, 200);
                }
            });
        };
        
        // Start checking
        checkTabStatus();
        
        // Set a maximum wait time to avoid hanging
        setTimeout(() => {
            console.log('Tab load wait timeout - continuing anyway');
            resolve();
        }, 5000); // Maximum 5 seconds wait
    });
}

/**
 * Set up tab switch listener to automatically refresh tabs when needed
 */
function setupTabSwitchListener() {
    if (!chrome.tabs || !chrome.tabs.onActivated) {
        console.warn('Tab switch listener not supported');
        return;
    }
    
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        console.log('Tab switched to:', activeInfo.tabId);
        
        // Only check if we're in the forms panel
        if (window.location.pathname.includes('panel-forms.html')) {
            try {
                const tab = await chrome.tabs.get(activeInfo.tabId);
                
                // Check if this tab needs refresh
                if (shouldRefreshTab(tab)) {
                    const needsRefresh = await checkIfTabNeedsRefresh();
                    
                    if (needsRefresh) {
                        console.log('Tab switch detected - refreshing tab for forms access');
                        
                        // Show loading indicator
                        const loadingState = document.getElementById('loadingState');
                        if (loadingState) {
                            loadingState.innerHTML = `
                                <div class="loading-state">
                                    <div class="loading-spinner"></div>
                                    <p>Tab switched - refreshing to get latest content...</p>
                                </div>
                            `;
                            loadingState.classList.remove('hidden');
                        }
                        
                        // Refresh the tab
                        await refreshActiveTab();
                        
                        // Hide loading indicator
                        if (loadingState) {
                            loadingState.classList.add('hidden');
                        }
                    } else {
                        // Tab doesn't need refresh but we should still reload forms
                        console.log('Tab switch detected - reloading forms');
                        if (window.formController && window.formController.autoLoadForms) {
                            try {
                                await window.formController.autoLoadForms();
                            } catch (error) {
                                console.warn('Error reloading forms on tab switch:', error);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('Error handling tab switch:', error);
            }
        }
    });
    
    console.log('Tab switch listener set up successfully');
}

/**
 * Set up visibility change listener to reload forms when panel becomes visible
 */
function setupPanelVisibilityListener() {
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden) {
            console.log('Forms panel became visible');
            
            // Trigger form reload when panel becomes visible
            if (window.formController && window.formController.autoLoadForms) {
                try {
                    console.log('Reloading forms after panel visibility change');
                    await window.formController.autoLoadForms();
                } catch (error) {
                    console.warn('Error reloading forms on visibility change:', error);
                }
            }
        }
    });
    
    console.log('Panel visibility listener set up successfully');
}

/**
 * Set up the refresh button functionality
 */
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refreshFormsBtn');
    if (!refreshBtn) {
        console.warn('Refresh button not found');
        return;
    }
    
    refreshBtn.addEventListener('click', async () => {
        console.log('Manual refresh triggered');
        
        try {
            // Disable button and show loading state
            refreshBtn.disabled = true;
            const originalContent = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise" style="animation: spin 1s linear infinite;"></i> <span>Refreshing...</span>';
            
            // Get the active tab
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (activeTab && activeTab.id) {
                // Check if we should refresh this tab
                if (!shouldRefreshTab(activeTab)) {
                    console.log('Special URL - cannot refresh:', activeTab.url);
                    
                    // Show error message
                    const loadingState = document.getElementById('loadingState');
                    if (loadingState) {
                        loadingState.innerHTML = `
                            <div class="status-info">
                                <strong>Cannot refresh this page</strong><br>
                                This type of page cannot be refreshed. Please navigate to a regular webpage.
                            </div>
                        `;
                        loadingState.classList.remove('hidden');
                        setTimeout(() => {
                            loadingState.classList.add('hidden');
                        }, 3000);
                    }
                    
                    // Re-enable button
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = originalContent;
                    return;
                }
                
                // Show loading indicator
                const loadingState = document.getElementById('loadingState');
                if (loadingState) {
                    loadingState.innerHTML = `
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <p>Refreshing page to detect forms...</p>
                        </div>
                    `;
                    loadingState.classList.remove('hidden');
                }
                
                // Refresh the tab
                await chrome.tabs.reload(activeTab.id);
                console.log('Tab refreshed successfully');
                
                // Wait for the tab to finish loading
                await waitForTabToLoad(activeTab.id);
                
                // Wait a bit more for content scripts to initialize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Hide loading indicator
                if (loadingState) {
                    loadingState.classList.add('hidden');
                }
                
                // Reload forms after refresh
                if (window.formController && window.formController.autoLoadForms) {
                    console.log('Reloading forms after manual refresh');
                    await window.formController.autoLoadForms();
                    
                    // Show success message briefly
                    if (loadingState) {
                        loadingState.innerHTML = `
                            <div class="status-success">
                                <strong>Page refreshed successfully!</strong><br>
                                Forms have been detected and loaded.
                            </div>
                        `;
                        loadingState.classList.remove('hidden');
                        setTimeout(() => {
                            loadingState.classList.add('hidden');
                        }, 2000);
                    }
                } else {
                    console.warn('FormController not available for reloading forms');
                }
                
            } else {
                console.warn('No active tab found to refresh');
                throw new Error('No active tab found');
            }
            
        } catch (error) {
            console.error('Error during manual refresh:', error);
            
            // Show error message
            const loadingState = document.getElementById('loadingState');
            if (loadingState) {
                loadingState.innerHTML = `
                    <div class="status-error">
                        <strong>Error refreshing page</strong><br>
                        ${error.message || 'Please try again.'}
                    </div>
                `;
                loadingState.classList.remove('hidden');
                setTimeout(() => {
                    loadingState.classList.add('hidden');
                }, 3000);
            }
            
        } finally {
            // Re-enable button
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> <span>Refresh</span>';
        }
    });
    
    console.log('Refresh button set up successfully');
}