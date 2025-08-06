/**
 * IntegratedFormsController.js
 * 
 * Integration layer that bridges the existing basic forms system with the enhanced 
 * forms system, providing backward compatibility while enabling advanced features.
 */

import { Controller } from '../architecture.js';
import { FormsController } from './FormsController.js';
import { EnhancedFormsController } from './EnhancedFormsController.js';
import { FormValidationEngine } from '../utils/FormValidationEngine.js';

/**
 * Integrated forms controller that combines basic and enhanced form handling
 */
export class IntegratedFormsController extends Controller {
  constructor(options = {}) {
    // Don't pass options as model to super, pass null instead
    super(null, null);

    this.options = {
      useEnhancedFeatures: true,
      fallbackToBasic: true,
      autoUpgrade: true,
      validationEnabled: true,
      accessibilityMode: false,
      ...options
    };

    // Initialize both controllers with error handling
    try {
      this.basicController = new FormsController();
      console.log('Basic controller initialized successfully');
    } catch (error) {
      console.error('Failed to initialize basic controller:', error);
      throw new Error('Basic forms controller initialization failed');
    }

    this.enhancedController = null;
    if (this.options.useEnhancedFeatures) {
      try {
        this.enhancedController = new EnhancedFormsController({
          accessibilityMode: this.options.accessibilityMode,
          smartFill: true,
          validateOnApply: this.options.validationEnabled
        });
        console.log('Enhanced controller initialized successfully');
      } catch (error) {
        console.warn('Enhanced controller initialization failed, will use basic only:', error);
        this.options.useEnhancedFeatures = false;
        this.enhancedController = null;
      }
    }

    // Initialize validation engine
    this.validationEngine = this.options.validationEnabled 
      ? new FormValidationEngine({
          accessibilityMode: this.options.accessibilityMode,
          realTimeValidation: false // We'll handle validation manually
        })
      : null;

    this.activeController = this.determineActiveController();
    this.setupEventListeners();
  }

  /**
   * Determine which controller to use based on capabilities and options
   * @returns {Controller} Active controller instance
   */
  determineActiveController() {
    if (!this.options.useEnhancedFeatures || !this.enhancedController) {
      console.log('Using basic controller: enhanced features disabled or not available');
      return this.basicController;
    }

    // Test if enhanced features are working
    try {
      // Don't actually call refresh during initialization, just check if it exists
      if (typeof this.enhancedController.refresh === 'function' && this.enhancedController.model) {
        console.log('Using enhanced controller: all checks passed');
        return this.enhancedController;
      } else {
        console.warn('Enhanced controller missing required methods or model, falling back to basic');
        return this.basicController;
      }
    } catch (error) {
      console.warn('Enhanced forms controller failed, falling back to basic controller:', error);
      return this.options.fallbackToBasic ? this.basicController : this.basicController;
    }
  }

  /**
   * Set up event listeners for controller switching and validation
   */
  setupEventListeners() {
    if (this.enhancedController && typeof this.enhancedController.on === 'function') {
      try {
        this.enhancedController.on('formsUpdated', (data) => {
          this.trigger('formsUpdated', data);
        });

        this.enhancedController.on('valuesUpdated', (results) => {
          this.trigger('valuesUpdated', results);
        });
      } catch (error) {
        console.warn('Failed to set up enhanced controller event listeners:', error);
      }
    }
  }

  /**
   * Get all forms data with optional enhancement features
   * @param {Object} options - Options for data retrieval
   * @returns {Array|Object} Forms data
   */
  getFormsData(options = {}) {
    if (this.activeController === this.enhancedController && options.includeAnalysis) {
      return this.enhancedController.getFormsData(options);
    }
    
    return this.activeController.getFormsData();
  }

  /**
   * Get specific form by ID with optional enhancements
   * @param {string} id - Form ID
   * @param {Object} options - Options for form retrieval
   * @returns {Object|null} Form data
   */
  getForm(id, options = {}) {
    if (this.activeController === this.enhancedController && Object.keys(options).length > 0) {
      return this.enhancedController.getForm(id, options);
    }
    
    return this.activeController.getForm(id);
  }

  /**
   * Apply values to forms with validation and error handling
   * @param {Object} values - Values to apply
   * @param {Object} options - Application options
   * @returns {Promise<Object>} Application results
   */
  async applyValues(values, options = {}) {
    const applyOptions = {
      validate: this.options.validationEnabled,
      useSmartFill: this.activeController === this.enhancedController,
      ...options
    };

    try {
      let results;

      if (this.activeController === this.enhancedController && applyOptions.useSmartFill) {
        // Use enhanced smart fill with validation
        results = await this.enhancedController.smartFillForms(values, applyOptions);
      } else {
        // Use basic application
        this.activeController.applyValues(values);
        results = {
          success: Object.keys(values).map(key => ({ identifier: key, value: values[key] })),
          failed: [],
          warnings: []
        };
      }

      // Run additional validation if enabled
      if (applyOptions.validate && this.validationEngine) {
        await this.validateAppliedValues(values, results);
      }

      return results;

    } catch (error) {
      console.error('Error applying values:', error);
      
      // Fallback to basic controller if enhanced fails
      if (this.activeController === this.enhancedController && this.options.fallbackToBasic) {
        console.warn('Enhanced application failed, falling back to basic controller');
        this.basicController.applyValues(values);
        return {
          success: Object.keys(values).map(key => ({ identifier: key, value: values[key] })),
          failed: [],
          warnings: [{ message: 'Fell back to basic form application due to enhanced controller error' }],
          fallbackUsed: true
        };
      }
      
      throw error;
    }
  }

  /**
   * Validate applied values using the validation engine
   * @param {Object} values - Values that were applied
   * @param {Object} results - Application results to enhance
   */
  async validateAppliedValues(values, results) {
    if (!this.validationEngine) return;

    for (const [identifier, value] of Object.entries(values)) {
      try {
        const element = this.findElementByIdentifier(identifier);
        if (element) {
          const validation = await this.validationEngine.validateElement(element);
          
          if (!validation.valid) {
            // Move from success to failed if validation fails
            const successIndex = results.success.findIndex(s => s.identifier === identifier);
            if (successIndex !== -1) {
              const successItem = results.success.splice(successIndex, 1)[0];
              results.failed.push({
                ...successItem,
                reason: 'Validation failed',
                validationErrors: validation.errors
              });
            }
          }

          // Add validation warnings
          if (validation.warnings && validation.warnings.length > 0) {
            results.warnings.push({
              identifier,
              type: 'validation',
              warnings: validation.warnings
            });
          }
        }
      } catch (error) {
        console.warn(`Validation error for ${identifier}:`, error);
      }
    }
  }

  /**
   * Find element by various identifier strategies
   * @param {string} identifier - Element identifier
   * @returns {Element|null} Found element
   */
  findElementByIdentifier(identifier) {
    // Try enhanced controller first
    if (this.activeController === this.enhancedController && this.enhancedController.model) {
      try {
        if (typeof this.enhancedController.model.findElement === 'function') {
          return this.enhancedController.model.findElement(identifier);
        }
      } catch (error) {
        // Fall through to basic approach
      }
    }

    // Basic element finding
    try {
      return document.getElementById(identifier) || 
             document.querySelector(`[name="${identifier}"]`) ||
             document.querySelector(identifier);
    } catch (error) {
      console.warn('Error finding element by identifier:', error);
      return null;
    }
  }

  /**
   * Find elements with enhanced search capabilities
   * @param {Object} criteria - Search criteria
   * @returns {Array} Matching elements
   */
  findElements(criteria) {
    if (this.activeController === this.enhancedController) {
      return this.enhancedController.findElements(criteria);
    }

    // Basic search implementation
    const forms = this.basicController.getFormsData();
    return forms.filter(form => {
      if (criteria.type && form.type !== criteria.type) return false;
      if (criteria.label && !form.label.toLowerCase().includes(criteria.label.toLowerCase())) return false;
      if (criteria.name && form.name !== criteria.name) return false;
      if (criteria.required !== undefined && form.required !== criteria.required) return false;
      return true;
    });
  }

  /**
   * Highlight elements with optional enhancement features
   * @param {Array|string} targets - Elements to highlight
   * @param {Object} options - Highlight options
   * @returns {IntegratedFormsController} Controller instance for chaining
   */
  highlight(targets, options = {}) {
    if (this.activeController === this.enhancedController) {
      this.enhancedController.highlight(targets, options);
    } else {
      const targetArray = Array.isArray(targets) ? targets : [targets];
      this.basicController.highlight(targetArray, options);
    }
    
    return this;
  }

  /**
   * Remove all highlights
   * @returns {IntegratedFormsController} Controller instance for chaining
   */
  removeHighlight() {
    this.activeController.removeHighlight();
    
    if (this.enhancedController && this.activeController !== this.enhancedController) {
      this.enhancedController.removeHighlight();
    }
    
    return this;
  }

  /**
   * Refresh forms data
   * @returns {Promise<Object>} Refresh results
   */
  async refresh() {
    try {
      if (this.activeController === this.enhancedController && typeof this.enhancedController.refresh === 'function') {
        return await this.enhancedController.refresh();
      } else if (this.activeController && typeof this.activeController.refresh === 'function') {
        const result = this.activeController.refresh();
        return result instanceof Promise ? await result : { success: true, controller: 'basic' };
      } else {
        console.warn('No refresh method available on active controller');
        return { success: false, error: 'No refresh method available' };
      }
    } catch (error) {
      console.error('Error refreshing forms:', error);
      // Try fallback to basic controller
      if (this.basicController && this.activeController !== this.basicController) {
        try {
          const result = this.basicController.refresh();
          return result instanceof Promise ? await result : { success: true, controller: 'basic-fallback' };
        } catch (fallbackError) {
          console.error('Fallback refresh also failed:', fallbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Validate forms using the validation engine
   * @param {string|Object} target - Form ID or form object
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateForms(target, options = {}) {
    if (!this.validationEngine) {
      throw new Error('Validation engine not initialized');
    }

    if (this.activeController === this.enhancedController) {
      return this.enhancedController.validateForm(target, options);
    }

    // Basic validation using validation engine
    const form = typeof target === 'string' ? this.getForm(target) : target;
    if (!form) {
      throw new Error('Form not found');
    }

    const results = {
      formId: form.id,
      valid: true,
      elements: {},
      summary: { validElements: 0, invalidElements: 0, warnings: 0 }
    };

    // Find form elements and validate them
    const element = this.findElementByIdentifier(form.id);
    if (element) {
      const validation = await this.validationEngine.validateElement(element, options);
      results.elements[form.id] = validation;
      results.valid = validation.valid;
      
      if (validation.valid) {
        results.summary.validElements++;
      } else {
        results.summary.invalidElements++;
      }
      
      results.summary.warnings += validation.warnings?.length || 0;
    }

    return results;
  }

  /**
   * Get controller statistics and information
   * @returns {Object} Controller information
   */
  getControllerInfo() {
    try {
      let formsCount = 0;
      
      // Safely get forms count
      if (this.activeController && typeof this.activeController.getFormsCount === 'function') {
        try {
          formsCount = this.activeController.getFormsCount();
        } catch (countError) {
          console.warn('Error getting forms count from active controller:', countError);
          // Try to get forms data length as fallback
          try {
            const formsData = this.getFormsData();
            formsCount = Array.isArray(formsData) ? formsData.length : 0;
          } catch (dataError) {
            console.warn('Error getting forms data:', dataError);
            formsCount = 0;
          }
        }
      }

      return {
        activeController: this.activeController === this.enhancedController ? 'enhanced' : 'basic',
        enhancedAvailable: !!this.enhancedController,
        validationEnabled: !!this.validationEngine,
        options: this.options,
        formsCount: formsCount,
        basicControllerReady: !!(this.basicController && this.basicController.model),
        enhancedControllerReady: !!(this.enhancedController && this.enhancedController.model)
      };
    } catch (error) {
      console.warn('Error getting controller info:', error);
      return {
        activeController: 'error',
        enhancedAvailable: !!this.enhancedController,
        validationEnabled: !!this.validationEngine,
        options: this.options,
        formsCount: 0,
        error: error.message,
        basicControllerReady: false,
        enhancedControllerReady: false
      };
    }
  }

  /**
   * Switch to enhanced controller if available
   * @returns {boolean} Success status
   */
  enableEnhancedMode() {
    if (!this.enhancedController) {
      this.enhancedController = new EnhancedFormsController({
        accessibilityMode: this.options.accessibilityMode,
        smartFill: true,
        validateOnApply: this.options.validationEnabled
      });
    }

    try {
      this.enhancedController.refresh();
      this.activeController = this.enhancedController;
      this.options.useEnhancedFeatures = true;
      return true;
    } catch (error) {
      console.error('Failed to enable enhanced mode:', error);
      return false;
    }
  }

  /**
   * Switch to basic controller
   * @returns {boolean} Success status
   */
  enableBasicMode() {
    this.activeController = this.basicController;
    this.options.useEnhancedFeatures = false;
    return true;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.enhancedController) {
      this.enhancedController.destroy();
    }
    
    if (this.validationEngine) {
      // Validation engine doesn't have destroy method, but we can clean up
      this.validationEngine = null;
    }
  }

  // Proxy methods for backward compatibility
  findFormsByLabel(labelText, exactMatch = false) {
    return this.basicController.findFormsByLabel(labelText, exactMatch);
  }

  findFormsByType(type) {
    return this.basicController.findFormsByType(type);
  }

  findFormsByName(name, exactMatch = false) {
    return this.basicController.findFormsByName(name, exactMatch);
  }

  findFormsByPlaceholder(placeholder, exactMatch = false) {
    return this.basicController.findFormsByPlaceholder(placeholder, exactMatch);
  }

  findRequiredForms() {
    return this.basicController.findRequiredForms();
  }

  fillForm(id, value) {
    return this.applyValues({ [id]: value });
  }

  fillForms(values) {
    return this.applyValues(values);
  }

  getFormValues() {
    return this.basicController.getFormValues();
  }

  formExists(id) {
    return this.basicController.formExists(id);
  }

  getFormsCount() {
    return this.basicController.getFormsCount();
  }
}

export default IntegratedFormsController;