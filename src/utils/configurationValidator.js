/**
 * Configuration Validator Utility
 * 
 * Provides utilities for validating and checking API configuration status.
 */

/**
 * Check if the current API configuration is valid
 * @param {Object} settings - Settings object from storage
 * @returns {Object} Configuration validation result
 */
export function validateApiConfiguration(settings) {
    const result = {
        isValid: false,
        provider: 'unknown',
        model: 'unknown',
        hasApiKey: false,
        issues: []
    };

    if (!settings) {
        result.issues.push('No settings provided');
        return result;
    }

    // Check provider
    const provider = settings.apiProvider;
    if (!provider || provider === 'unknown') {
        result.issues.push('No API provider configured');
    } else {
        result.provider = provider;
    }

    // Check API key
    const apiKeys = settings.apiKeys || {};
    const hasApiKey = provider && apiKeys[provider] && apiKeys[provider].trim().length > 0;
    result.hasApiKey = hasApiKey;
    
    if (!hasApiKey) {
        result.issues.push(`No API key configured for ${provider || 'provider'}`);
    }

    // Check model
    const selectedModels = settings.selectedModels || {};
    const model = provider ? selectedModels[provider] : null;
    
    if (!model || model === 'unknown') {
        result.issues.push(`No model selected for ${provider || 'provider'}`);
    } else {
        result.model = model;
    }

    // Configuration is valid if we have provider, model, and API key
    result.isValid = result.provider !== 'unknown' && 
                     result.model !== 'unknown' && 
                     result.hasApiKey;

    return result;
}

/**
 * Get a human-readable status message for configuration
 * @param {Object} validationResult - Result from validateApiConfiguration
 * @returns {string} Status message
 */
export function getConfigurationStatusMessage(validationResult) {
    if (validationResult.isValid) {
        return `Ready to chat with ${validationResult.provider} (${validationResult.model})`;
    }

    if (validationResult.issues.length === 0) {
        return 'Unknown configuration status';
    }

    if (validationResult.issues.length === 1) {
        return validationResult.issues[0];
    }

    return `Multiple issues: ${validationResult.issues.join(', ')}`;
}

/**
 * Get provider display name
 * @param {string} provider - Provider identifier
 * @returns {string} Display name
 */
export function getProviderDisplayName(provider) {
    const displayNames = {
        'openai': 'OpenAI',
        'anthropic': 'Anthropic',
        'gemini': 'Google Gemini',
        'deepseek': 'DeepSeek',
        'azureOpenai': 'Azure OpenAI',
        'local': 'Local API',
        'compatible': 'OpenAI Compatible',
        'unknown': 'No Provider'
    };

    return displayNames[provider] || provider;
}

/**
 * Get model display name (shortened for UI)
 * @param {string} model - Model identifier
 * @returns {string} Display name
 */
export function getModelDisplayName(model) {
    if (!model || model === 'unknown') {
        return 'No Model';
    }

    // Shorten common model names for display
    const shortNames = {
        'gpt-3.5-turbo': 'GPT-3.5',
        'gpt-4': 'GPT-4',
        'gpt-4-turbo': 'GPT-4 Turbo',
        'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
        'claude-3-opus-20240229': 'Claude 3 Opus',
        'claude-3-haiku-20240307': 'Claude 3 Haiku',
        'gemini-pro': 'Gemini Pro',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',
        'deepseek-chat': 'DeepSeek Chat',
        'gpt-35-turbo': 'GPT-3.5 (Azure)'
    };

    return shortNames[model] || model;
}