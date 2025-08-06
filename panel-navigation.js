/**
 * Navigation system for Chrome Side Panel API
 * Handles switching between different panel views
 */

// Panel configuration
const PANELS = {
    chat: 'panel-chat.html',
    history: 'panel-history.html',
    forms: 'panel-forms.html',
    home: 'panel-home.html'
};

/**
 * Initialize navigation when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
});

/**
 * Initialize navigation event listeners
 */
function initializeNavigation() {
    // Add click handlers to all navigation items
    const navItems = document.querySelectorAll('.nav-item[data-panel]');
    navItems.forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Add click handlers to action cards that navigate
    const actionCards = document.querySelectorAll('.action-card[data-panel]');
    actionCards.forEach(card => {
        card.addEventListener('click', handleNavigation);
    });

    console.log('Panel navigation initialized');
}

/**
 * Handle navigation between panels
 * @param {Event} event - Click event
 */
async function handleNavigation(event) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Navigation click detected');
    
    const panelName = event.currentTarget.getAttribute('data-panel');
    console.log('Panel name from data attribute:', panelName);
    
    if (!panelName) {
        console.warn('No panel name specified');
        return;
    }

    // Special handling for home button - open settings directly
    if (panelName === 'home') {
        console.log('Home button clicked - opening settings page');
        try {
            const settingsUrl = chrome.runtime.getURL('api_settings.html');
            await chrome.tabs.create({ url: settingsUrl });
            console.log('Settings page opened in new tab');
        } catch (error) {
            console.error('Error opening settings page:', error);
        }
        return;
    }

    if (!PANELS[panelName]) {
        console.warn('Invalid panel name:', panelName);
        return;
    }

    try {
        await navigateToPanel(panelName);
    } catch (error) {
        console.error('Navigation error:', error);
        // Fallback: open in new tab
        chrome.tabs.create({
            url: chrome.runtime.getURL(PANELS[panelName])
        });
    }
}

/**
 * Navigate to a specific panel using Chrome Side Panel API
 * @param {string} panelName - Name of the panel to navigate to
 */
async function navigateToPanel(panelName) {
    console.log('Attempting to navigate to:', panelName);
    
    if (!chrome.sidePanel) {
        console.error('Side Panel API not available');
        return;
    }

    const panelPath = PANELS[panelName];
    if (!panelPath) {
        console.error('Invalid panel name:', panelName);
        return;
    }
    
    try {
        // Use message passing to background script for navigation
        await chrome.runtime.sendMessage({
            type: 'navigate-panel',
            panel: panelName
        });
        
        console.log(`Navigation request sent for ${panelName} panel`);
    } catch (error) {
        console.error('Failed to send navigation message:', error);
        
        // Direct fallback if message passing fails
        try {
            await chrome.sidePanel.setOptions({
                path: panelPath,
                enabled: true
            });
            console.log(`Direct navigation to ${panelName} successful`);
        } catch (directError) {
            console.error('Direct navigation also failed:', directError);
        }
    }
}

/**
 * Get current panel name from URL
 * @returns {string|null} Current panel name
 */
function getCurrentPanel() {
    const currentPath = window.location.pathname;
    const fileName = currentPath.split('/').pop();
    
    for (const [panelName, panelPath] of Object.entries(PANELS)) {
        if (panelPath === fileName) {
            return panelName;
        }
    }
    
    return null;
}

/**
 * Update active navigation state
 * @param {string} activePanelName - Name of the active panel
 */
function updateActiveNavigation(activePanelName) {
    // Remove active class from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to current panel nav item
    const activeNavItem = document.querySelector(`.nav-item[data-panel="${activePanelName}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
}

/**
 * Initialize active state on page load
 */
function initializeActiveState() {
    const currentPanel = getCurrentPanel();
    if (currentPanel) {
        updateActiveNavigation(currentPanel);
    }
}

// Initialize active state when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeActiveState();
});

/**
 * Handle messages from other parts of the extension
 */
if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'navigate') {
            navigateToPanel(message.panel)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Indicates async response
        }
    });
}

// Export for use in other scripts
window.PanelNavigation = {
    navigateToPanel,
    getCurrentPanel,
    updateActiveNavigation,
    PANELS
};