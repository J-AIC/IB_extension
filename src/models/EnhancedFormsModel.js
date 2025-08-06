/**
 * EnhancedFormsModel.js
 * 
 * Enhanced form data model with comprehensive support for all HTML form elements,
 * validation, accessibility, and advanced form operations.
 */

import { Model } from '../architecture.js';
import AdvancedFormExtractor from '../utils/AdvancedFormExtractor.js';

export class EnhancedFormsModel extends Model {
  constructor(data = {}) {
    try {
      const defaultData = {
        forms: new Map(),
        fieldGroups: new Map(),
        validationRules: new Map(),
        extractionHistory: [],
        watchedElements: new Set(),
        changeCallbacks: new Map(),
        initialized: false,
        debug: true,
        lastExtraction: null,
        statistics: {},
        ...data
      };
      
      super(defaultData);
      
      // Create extractor with error handling
      try {
        this.extractor = new AdvancedFormExtractor({
          includeHidden: false,
          includeDisabled: false,
          extractFileMetadata: true,
          includeValidation: true,
          includeAccessibility: true,
          includeShadowDOM: true,
          extractCustomData: true,
          groupRelatedElements: true,
          detectDynamicForms: true
        });
      } catch (extractorError) {
        console.error('Failed to create AdvancedFormExtractor:', extractorError);
        // Create a minimal fallback extractor
        this.extractor = {
          extractAllFormData: () => ({ forms: [], statistics: { totalElements: 0 } }),
          options: {}
        };
      }

      this.mutationObserver = null;
      this.formChangeDebouncer = null;
      this.eventHandlers = new Map();
      
    } catch (error) {
      console.error('EnhancedFormsModel constructor failed:', error);
      throw error;
    }
  }

  /**
   * Initialize the enhanced forms model
   * @param {Object} options - Initialization options
   * @returns {EnhancedFormsModel} Model instance for chaining
   */
  initialize(options = {}) {
    if (this.get('initialized')) {
      this.debugLog('initialize', 'Already initialized, skipping');
      return this;
    }

    this.debugLog('initialize', 'Initializing EnhancedFormsModel');
    
    // Configure extractor with options
    if (options.extractorConfig) {
      this.extractor.options = { ...this.extractor.options, ...options.extractorConfig };
    }

    // Perform initial extraction
    this.extractAllForms();

    // Set up dynamic form detection
    this.setupDynamicFormDetection();

    // Set up form change monitoring
    this.setupFormChangeMonitoring();

    this.set('initialized', true);
    this.debugLog('initialize', 'EnhancedFormsModel initialized successfully');

    return this;
  }

  /**
   * Extract all forms using the advanced extractor
   * @param {Element} root - Root element to extract from
   * @returns {Object} Extraction results
   */
  extractAllForms(root = document) {
    this.debugLog('extractAllForms', 'Starting comprehensive form extraction');

    try {
      const extractionResult = this.extractor.extractAllFormData(root);
      
      // Store forms in Map for efficient access
      const formsMap = new Map();
      extractionResult.forms.forEach(form => {
        formsMap.set(form.id, form);
      });

      // Store field groups
      const groupsMap = new Map();
      extractionResult.fieldGroups.forEach(group => {
        groupsMap.set(group.id, group);
      });

      // Store validation rules
      const rulesMap = new Map();
      extractionResult.validationRules.forEach(rule => {
        rulesMap.set(rule.id, rule);
      });

      // Update model state
      this.set('forms', formsMap);
      this.set('fieldGroups', groupsMap);
      this.set('validationRules', rulesMap);
      this.set('lastExtraction', extractionResult);
      this.set('statistics', extractionResult.statistics);

      // Add to extraction history
      const history = this.get('extractionHistory');
      history.push({
        timestamp: extractionResult.timestamp,
        formsCount: extractionResult.forms.length,
        elementsCount: extractionResult.statistics.totalElements,
        extractionTime: extractionResult.extractionTime
      });

      // Keep only last 10 extractions in history
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      this.debugLog('extractAllForms', `Extracted ${formsMap.size} forms with ${extractionResult.statistics.totalElements} elements`);

      // Trigger change event
      this.trigger('formsExtracted', {
        forms: Array.from(formsMap.values()),
        statistics: extractionResult.statistics
      });

      return extractionResult;

    } catch (error) {
      this.debugLog('extractAllForms', 'Error during form extraction', error);
      throw error;
    }
  }

  /**
   * Get all forms data
   * @returns {Array} Array of form data objects
   */
  getFormsData() {
    return Array.from(this.get('forms').values());
  }

  /**
   * Get form by ID
   * @param {string} id - Form ID
   * @returns {Object|null} Form data or null
   */
  getForm(id) {
    return this.get('forms').get(id) || null;
  }

  /**
   * Get all elements across all forms
   * @returns {Array} Array of all form elements
   */
  getAllElements() {
    const elements = [];
    const forms = this.get('forms');
    
    forms.forEach(form => {
      if (form.elements) {
        elements.push(...form.elements);
      }
    });

    return elements;
  }

  /**
   * Find elements by various criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array} Matching elements
   */
  findElements(criteria) {
    const elements = this.getAllElements();
    
    return elements.filter(element => {
      // Type filter
      if (criteria.type && element.type !== criteria.type) {
        return false;
      }

      // Tag filter
      if (criteria.tagName && element.tagName !== criteria.tagName) {
        return false;
      }

      // Label filter (fuzzy match)
      if (criteria.label) {
        const labelMatch = element.label.toLowerCase().includes(criteria.label.toLowerCase());
        if (!labelMatch) return false;
      }

      // Name filter
      if (criteria.name && element.name !== criteria.name) {
        return false;
      }

      // Required filter
      if (criteria.required !== undefined && element.validation?.required !== criteria.required) {
        return false;
      }

      // Validation filter
      if (criteria.hasValidation && !Object.keys(element.validation || {}).length) {
        return false;
      }

      // Accessibility filter
      if (criteria.hasAccessibility && !Object.keys(element.accessibility || {}).length) {
        return false;
      }

      // Custom data filter
      if (criteria.hasCustomData && !Object.keys(element.custom || {}).length) {
        return false;
      }

      // Value filter
      if (criteria.value !== undefined) {
        if (Array.isArray(element.value)) {
          if (!element.value.includes(criteria.value)) return false;
        } else if (element.value !== criteria.value) {
          return false;
        }
      }

      // Class filter
      if (criteria.className && !element.className.includes(criteria.className)) {
        return false;
      }

      // Custom filter function
      if (criteria.custom && typeof criteria.custom === 'function') {
        if (!criteria.custom(element)) return false;
      }

      return true;
    });
  }

  /**
   * Apply values to form elements with comprehensive validation
   * @param {Object} values - Values to apply
   * @param {Object} options - Application options
   * @returns {Object} Application results
   */
  applyValues(values, options = {}) {
    this.debugLog('applyValues', `Applying values to ${Object.keys(values).length} elements`);

    const defaultOptions = {
      validate: true,
      triggerEvents: true,
      skipReadonly: true,
      skipDisabled: true,
      forceFocus: false,
      ...options
    };

    const results = {
      success: [],
      failed: [],
      warnings: [],
      validationResults: {},
      totalAttempted: Object.keys(values).length,
      startTime: performance.now()
    };

    for (const [identifier, value] of Object.entries(values)) {
      try {
        const element = this.findElement(identifier);
        
        if (!element) {
          results.failed.push({
            identifier,
            reason: 'Element not found',
            value,
            suggestions: this.suggestSimilarElements(identifier)
          });
          continue;
        }

        // Check if element should be skipped
        if (this.shouldSkipElement(element, defaultOptions)) {
          results.warnings.push({
            identifier,
            reason: 'Element skipped due to state or options',
            element: element,
            value
          });
          continue;
        }

        // Apply value with type-specific handling
        const applicationResult = this.applyValueToElement(element, value, defaultOptions);
        
        if (applicationResult.success) {
          results.success.push({
            identifier,
            element: element,
            value,
            previousValue: applicationResult.previousValue,
            method: applicationResult.method
          });

          // Trigger events if requested
          if (defaultOptions.triggerEvents) {
            this.triggerElementEvents(element, applicationResult.events || ['change']);
          }

        } else {
          results.failed.push({
            identifier,
            element: element,
            reason: applicationResult.reason,
            value,
            error: applicationResult.error
          });
        }

        // Validate if requested
        if (defaultOptions.validate) {
          const validation = this.validateElement(element);
          results.validationResults[identifier] = validation;
          
          if (!validation.valid) {
            results.warnings.push({
              identifier,
              reason: 'Validation failed',
              validation: validation
            });
          }
        }

      } catch (error) {
        this.debugLog('applyValues', `Error applying value to ${identifier}`, error);
        results.failed.push({
          identifier,
          reason: `Exception: ${error.message}`,
          value,
          error: error
        });
      }
    }

    results.endTime = performance.now();
    results.executionTime = results.endTime - results.startTime;

    this.debugLog('applyValues', `Completed: ${results.success.length} success, ${results.failed.length} failed, ${results.warnings.length} warnings`);

    // Trigger change event
    this.trigger('valuesApplied', results);

    return results;
  }

  /**
   * Apply value to a specific element with type-specific handling
   * @param {Element} element - Target element
   * @param {*} value - Value to apply
   * @param {Object} options - Application options
   * @returns {Object} Application result
   */
  applyValueToElement(element, value, options = {}) {
    const elementData = this.findElementData(element);
    if (!elementData) {
      return {
        success: false,
        reason: 'Element data not found',
        method: 'none'
      };
    }

    const type = elementData.type;
    const previousValue = this.extractor.getElementValue(element);

    try {
      let method = 'setValue';
      let events = ['input', 'change'];

      switch (type) {
        case 'text':
        case 'password':
        case 'email':
        case 'url':
        case 'tel':
        case 'search':
        case 'textarea':
          element.value = String(value);
          if (options.forceFocus) element.focus();
          break;

        case 'number':
        case 'range':
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            element.value = value;
            // Also set valueAsNumber if supported
            if (element.valueAsNumber !== undefined) {
              element.valueAsNumber = numValue;
            }
          } else {
            return {
              success: false,
              reason: 'Invalid number value',
              method: 'number'
            };
          }
          break;

        case 'date':
        case 'time':
        case 'datetime-local':
        case 'month':
        case 'week':
          if (value instanceof Date) {
            element.valueAsDate = value;
            method = 'setValueAsDate';
          } else if (typeof value === 'string') {
            element.value = value;
          } else {
            return {
              success: false,
              reason: 'Invalid date/time value',
              method: 'dateTime'
            };
          }
          break;

        case 'checkbox':
          element.checked = Boolean(value);
          events = ['change'];
          method = 'setChecked';
          break;

        case 'radio':
          // For radio buttons, value should be the value to select
          if (element.value === String(value)) {
            element.checked = true;
            method = 'setRadioChecked';
          } else {
            // Try to find the correct radio in the group
            const radioGroup = this.findRadioGroup(element.name);
            const targetRadio = radioGroup.find(radio => radio.value === String(value));
            if (targetRadio) {
              targetRadio.checked = true;
              method = 'setRadioGroupValue';
            } else {
              return {
                success: false,
                reason: 'Radio value not found in group',
                method: 'radio'
              };
            }
          }
          events = ['change'];
          break;

        case 'select':
          element.value = String(value);
          events = ['change'];
          break;

        case 'select-multiple':
          // Clear all selections first
          Array.from(element.options).forEach(option => {
            option.selected = false;
          });
          
          // Set new selections
          const values = Array.isArray(value) ? value : [value];
          values.forEach(val => {
            const option = Array.from(element.options).find(opt => opt.value === String(val));
            if (option) {
              option.selected = true;
            }
          });
          events = ['change'];
          method = 'setMultipleSelect';
          break;

        case 'file':
          // File inputs are read-only from script, warn user
          return {
            success: false,
            reason: 'File inputs cannot be set programmatically for security reasons',
            method: 'file'
          };

        case 'color':
          // Validate hex color format
          if (/^#[0-9A-F]{6}$/i.test(value)) {
            element.value = value;
          } else {
            return {
              success: false,
              reason: 'Invalid color format (expected #RRGGBB)',
              method: 'color'
            };
          }
          break;

        case 'contenteditable':
          if (typeof value === 'object' && value.innerHTML !== undefined) {
            element.innerHTML = value.innerHTML;
            method = 'setInnerHTML';
          } else {
            element.textContent = String(value);
            method = 'setTextContent';
          }
          events = ['input'];
          break;

        default:
          element.value = String(value);
          break;
      }

      return {
        success: true,
        previousValue,
        method,
        events
      };

    } catch (error) {
      return {
        success: false,
        reason: `Exception during value application: ${error.message}`,
        method: type,
        error
      };
    }
  }

  /**
   * Validate element using HTML5 validation and custom rules
   * @param {Element} element - Element to validate
   * @returns {Object} Validation results
   */
  validateElement(element) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      htmlValidity: null,
      customRules: [],
      accessibility: {}
    };

    try {
      // HTML5 validation
      if (element.validity) {
        validation.htmlValidity = {
          valid: element.validity.valid,
          badInput: element.validity.badInput,
          customError: element.validity.customError,
          patternMismatch: element.validity.patternMismatch,
          rangeOverflow: element.validity.rangeOverflow,
          rangeUnderflow: element.validity.rangeUnderflow,
          stepMismatch: element.validity.stepMismatch,
          tooLong: element.validity.tooLong,
          tooShort: element.validity.tooShort,
          typeMismatch: element.validity.typeMismatch,
          valueMissing: element.validity.valueMissing
        };

        if (!element.validity.valid) {
          validation.valid = false;
          validation.errors.push({
            type: 'html5',
            message: element.validationMessage,
            validity: validation.htmlValidity
          });
        }
      }

      // Custom validation rules
      const elementId = element.id || element.name;
      const customRules = this.get('validationRules').get(elementId);
      
      if (customRules) {
        for (const rule of customRules) {
          try {
            const result = rule.validate(element.value, element);
            validation.customRules.push({
              name: rule.name,
              valid: result.valid,
              message: result.message
            });
            
            if (!result.valid) {
              validation.valid = false;
              validation.errors.push({
                type: 'custom',
                rule: rule.name,
                message: result.message
              });
            }
          } catch (ruleError) {
            validation.warnings.push({
              type: 'rule_error',
              rule: rule.name,
              message: `Validation rule error: ${ruleError.message}`
            });
          }
        }
      }

      // Accessibility validation
      validation.accessibility = this.validateAccessibility(element);

    } catch (error) {
      validation.errors.push({
        type: 'validation_error',
        message: `Validation process error: ${error.message}`
      });
      validation.valid = false;
    }

    return validation;
  }

  /**
   * Validate accessibility of an element
   * @param {Element} element - Element to validate
   * @returns {Object} Accessibility validation
   */
  validateAccessibility(element) {
    const accessibility = {
      valid: true,
      issues: [],
      suggestions: []
    };

    // Check for label
    if (!element.labels || element.labels.length === 0) {
      if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
        accessibility.valid = false;
        accessibility.issues.push({
          type: 'missing_label',
          message: 'Element has no accessible label',
          severity: 'high'
        });
        accessibility.suggestions.push('Add a <label> element or aria-label attribute');
      }
    }

    // Check required fields
    if (element.required && !element.getAttribute('aria-required')) {
      accessibility.suggestions.push('Add aria-required="true" for better screen reader support');
    }

    // Check invalid state
    if (element.validity && !element.validity.valid && element.getAttribute('aria-invalid') !== 'true') {
      accessibility.suggestions.push('Add aria-invalid="true" when field is invalid');
    }

    // Check keyboard accessibility
    if (element.tabIndex === -1 && element.type !== 'hidden') {
      accessibility.issues.push({
        type: 'keyboard_inaccessible',
        message: 'Element is not keyboard accessible',
        severity: 'medium'
      });
    }

    return accessibility;
  }

  /**
   * Set up dynamic form detection using MutationObserver
   */
  setupDynamicFormDetection() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    this.mutationObserver = new MutationObserver((mutations) => {
      let hasFormChanges = false;

      for (const mutation of mutations) {
        // Check for added nodes
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (this.isFormElement(node) || this.containsFormElements(node)) {
              hasFormChanges = true;
              break;
            }
          }
        }

        // Check for removed nodes
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (this.isFormElement(node) || this.containsFormElements(node)) {
              hasFormChanges = true;
              break;
            }
          }
        }

        // Check for attribute changes on form elements
        if (mutation.type === 'attributes' && mutation.target) {
          if (this.isFormElement(mutation.target)) {
            hasFormChanges = true;
            break;
          }
        }

        if (hasFormChanges) break;
      }

      if (hasFormChanges) {
        this.debouncedFormRefresh();
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type', 'name', 'id', 'class', 'required', 'disabled', 'readonly']
    });

    this.debugLog('setupDynamicFormDetection', 'Dynamic form detection enabled');
  }

  /**
   * Set up form change monitoring for real-time updates
   */
  setupFormChangeMonitoring() {
    // Debounced refresh function
    this.debouncedFormRefresh = this.debounce(() => {
      this.debugLog('debouncedFormRefresh', 'Refreshing forms due to DOM changes');
      this.extractAllForms();
    }, 500);

    this.debugLog('setupFormChangeMonitoring', 'Form change monitoring enabled');
  }

  /**
   * Find element by various identifiers
   * @param {string} identifier - Element identifier (id, name, selector)
   * @returns {Element|null} Found element
   */
  findElement(identifier) {
    // Try by ID first
    let element = document.getElementById(identifier);
    if (element) return element;

    // Try by name
    element = document.querySelector(`[name="${identifier}"]`);
    if (element) return element;

    // Try as CSS selector
    try {
      element = document.querySelector(identifier);
      if (element) return element;
    } catch (e) {
      // Invalid selector, continue
    }

    // Try by data attributes
    element = document.querySelector(`[data-id="${identifier}"]`);
    if (element) return element;

    // Try by aria-label
    element = document.querySelector(`[aria-label="${identifier}"]`);
    if (element) return element;

    return null;
  }

  /**
   * Utility functions
   */

  isFormElement(element) {
    const formTags = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'METER', 'PROGRESS', 'OUTPUT'];
    return formTags.includes(element.tagName) || 
           element.hasAttribute('contenteditable') ||
           element.getAttribute('role') === 'textbox';
  }

  containsFormElements(element) {
    return element.querySelector && (
      element.querySelector('input') ||
      element.querySelector('select') ||
      element.querySelector('textarea') ||
      element.querySelector('button') ||
      element.querySelector('[contenteditable]') ||
      element.querySelector('[role="textbox"]')
    );
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  debugLog(section, message, data = null) {
    if (!this.get('debug')) return;
    
    const timestamp = new Date().toISOString();
    console.log(`[EnhancedFormsModel][${section}][${timestamp}] ${message}`);
    
    if (data) {
      console.log('Data:', data);
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.formChangeDebouncer) {
      clearTimeout(this.formChangeDebouncer);
    }

    this.eventHandlers.clear();
    this.debugLog('destroy', 'EnhancedFormsModel destroyed');
  }
}

export default EnhancedFormsModel;