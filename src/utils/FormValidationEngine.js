/**
 * FormValidationEngine.js
 * 
 * Comprehensive form validation engine with support for HTML5 validation,
 * custom rules, accessibility validation, and real-time feedback.
 */

export class FormValidationEngine {
  constructor(options = {}) {
    this.options = {
      realTimeValidation: true,
      validateOnBlur: true,
      validateOnChange: false,
      showInlineErrors: true,
      highlightErrors: true,
      accessibilityMode: false,
      customErrorMessages: {},
      ...options
    };

    this.validators = new Map();
    this.customRules = new Map();
    this.fieldGroups = new Map();
    this.validationResults = new Map();
    this.errorElements = new Map();
    
    this.setupBuiltInValidators();
  }

  /**
   * Set up built-in validators for common validation scenarios
   */
  setupBuiltInValidators() {
    // Email validator with enhanced patterns
    this.addValidator('email', {
      validate: (value) => {
        if (!value) return { valid: true };
        const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return {
          valid: emailPattern.test(value),
          message: 'Please enter a valid email address'
        };
      },
      priority: 1
    });

    // Phone number validator
    this.addValidator('phone', {
      validate: (value) => {
        if (!value) return { valid: true };
        const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
        const cleanValue = value.replace(/[\s\-\(\)\.]/g, '');
        return {
          valid: phonePattern.test(cleanValue),
          message: 'Please enter a valid phone number'
        };
      },
      priority: 1
    });

    // URL validator
    this.addValidator('url', {
      validate: (value) => {
        if (!value) return { valid: true };
        try {
          new URL(value);
          return { valid: true };
        } catch {
          return {
            valid: false,
            message: 'Please enter a valid URL'
          };
        }
      },
      priority: 1
    });

    // Credit card validator (Luhn algorithm)
    this.addValidator('creditcard', {
      validate: (value) => {
        if (!value) return { valid: true };
        const cleanValue = value.replace(/\s/g, '');
        if (!/^\d+$/.test(cleanValue)) {
          return { valid: false, message: 'Credit card must contain only numbers' };
        }
        
        const luhnCheck = this.luhnCheck(cleanValue);
        return {
          valid: luhnCheck,
          message: luhnCheck ? '' : 'Please enter a valid credit card number'
        };
      },
      priority: 1
    });

    // Password strength validator
    this.addValidator('password-strength', {
      validate: (value, element) => {
        if (!value) return { valid: true };
        
        const minLength = element.getAttribute('data-min-length') || 8;
        const requireUppercase = element.hasAttribute('data-require-uppercase');
        const requireLowercase = element.hasAttribute('data-require-lowercase');
        const requireNumbers = element.hasAttribute('data-require-numbers');
        const requireSpecial = element.hasAttribute('data-require-special');
        
        const issues = [];
        
        if (value.length < minLength) {
          issues.push(`at least ${minLength} characters`);
        }
        
        if (requireUppercase && !/[A-Z]/.test(value)) {
          issues.push('uppercase letter');
        }
        
        if (requireLowercase && !/[a-z]/.test(value)) {
          issues.push('lowercase letter');
        }
        
        if (requireNumbers && !/\d/.test(value)) {
          issues.push('number');
        }
        
        if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
          issues.push('special character');
        }
        
        return {
          valid: issues.length === 0,
          message: issues.length > 0 ? `Password must contain ${issues.join(', ')}` : '',
          severity: this.calculatePasswordStrength(value)
        };
      },
      priority: 2
    });

    // Date range validator
    this.addValidator('date-range', {
      validate: (value, element) => {
        if (!value) return { valid: true };
        
        const minDate = element.getAttribute('data-min-date');
        const maxDate = element.getAttribute('data-max-date');
        const inputDate = new Date(value);
        
        if (isNaN(inputDate.getTime())) {
          return { valid: false, message: 'Please enter a valid date' };
        }
        
        if (minDate && inputDate < new Date(minDate)) {
          return { valid: false, message: `Date must be after ${minDate}` };
        }
        
        if (maxDate && inputDate > new Date(maxDate)) {
          return { valid: false, message: `Date must be before ${maxDate}` };
        }
        
        return { valid: true };
      },
      priority: 1
    });

    // File validation
    this.addValidator('file', {
      validate: (value, element) => {
        if (!element.files || element.files.length === 0) {
          if (element.required) {
            return { valid: false, message: 'Please select a file' };
          }
          return { valid: true };
        }
        
        const maxSize = element.getAttribute('data-max-size');
        const allowedTypes = element.getAttribute('data-allowed-types');
        const maxFiles = element.getAttribute('data-max-files');
        
        const files = Array.from(element.files);
        const issues = [];
        
        // Check file count
        if (maxFiles && files.length > parseInt(maxFiles)) {
          issues.push(`maximum ${maxFiles} files allowed`);
        }
        
        // Check each file
        for (const file of files) {
          // Check file size
          if (maxSize) {
            const maxBytes = this.parseFileSize(maxSize);
            if (file.size > maxBytes) {
              issues.push(`${file.name} exceeds maximum size of ${maxSize}`);
            }
          }
          
          // Check file type
          if (allowedTypes) {
            const allowed = allowedTypes.split(',').map(t => t.trim());
            if (!allowed.includes(file.type) && !allowed.some(a => file.name.endsWith(a))) {
              issues.push(`${file.name} is not an allowed file type`);
            }
          }
        }
        
        return {
          valid: issues.length === 0,
          message: issues.join('; ')
        };
      },
      priority: 1
    });

    // Numeric range validator
    this.addValidator('numeric-range', {
      validate: (value, element) => {
        if (!value) return { valid: true };
        
        const num = parseFloat(value);
        if (isNaN(num)) {
          return { valid: false, message: 'Please enter a valid number' };
        }
        
        const min = element.getAttribute('data-min') || element.min;
        const max = element.getAttribute('data-max') || element.max;
        
        if (min && num < parseFloat(min)) {
          return { valid: false, message: `Value must be at least ${min}` };
        }
        
        if (max && num > parseFloat(max)) {
          return { valid: false, message: `Value must be no more than ${max}` };
        }
        
        return { valid: true };
      },
      priority: 1
    });

    // Confirmation field validator (e.g., password confirmation)
    this.addValidator('confirmation', {
      validate: (value, element) => {
        const confirmField = element.getAttribute('data-confirm-field');
        if (!confirmField) return { valid: true };
        
        const originalField = document.getElementById(confirmField) || 
                             document.querySelector(`[name="${confirmField}"]`);
        
        if (!originalField) {
          return { valid: false, message: 'Original field not found' };
        }
        
        return {
          valid: value === originalField.value,
          message: 'Values do not match'
        };
      },
      priority: 2
    });
  }

  /**
   * Add custom validator
   * @param {string} name - Validator name
   * @param {Object} validator - Validator configuration
   */
  addValidator(name, validator) {
    this.validators.set(name, {
      validate: validator.validate,
      priority: validator.priority || 1,
      async: validator.async || false,
      message: validator.message || '',
      ...validator
    });
  }

  /**
   * Add custom validation rule to specific field
   * @param {string} fieldId - Field identifier
   * @param {Object} rule - Validation rule
   */
  addCustomRule(fieldId, rule) {
    if (!this.customRules.has(fieldId)) {
      this.customRules.set(fieldId, []);
    }
    
    this.customRules.get(fieldId).push({
      name: rule.name || 'custom',
      validate: rule.validate,
      message: rule.message || 'Validation failed',
      priority: rule.priority || 1,
      async: rule.async || false
    });
  }

  /**
   * Validate single element
   * @param {Element} element - Element to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateElement(element, options = {}) {
    const validationOptions = {
      includeHTML5: true,
      includeCustom: true,
      includeAccessibility: this.options.accessibilityMode,
      showErrors: this.options.showInlineErrors,
      ...options
    };

    const result = {
      elementId: element.id || element.name || 'unnamed',
      valid: true,
      errors: [],
      warnings: [],
      info: [],
      html5Validity: null,
      customResults: [],
      accessibilityIssues: [],
      score: 100
    };

    // HTML5 validation
    if (validationOptions.includeHTML5 && element.validity) {
      result.html5Validity = this.validateHTML5(element);
      if (!result.html5Validity.valid) {
        result.valid = false;
        result.errors.push(...result.html5Validity.errors);
      }
    }

    // Custom validators
    if (validationOptions.includeCustom) {
      const customResults = await this.runCustomValidators(element);
      result.customResults = customResults;
      
      const customErrors = customResults.filter(r => !r.valid);
      if (customErrors.length > 0) {
        result.valid = false;
        result.errors.push(...customErrors.map(e => ({
          type: 'custom',
          validator: e.validator,
          message: e.message,
          severity: e.severity || 'error'
        })));
      }
    }

    // Field-specific custom rules
    const fieldId = element.id || element.name;
    if (fieldId && this.customRules.has(fieldId)) {
      const ruleResults = await this.runCustomRules(element, fieldId);
      result.customResults.push(...ruleResults);
      
      const ruleErrors = ruleResults.filter(r => !r.valid);
      if (ruleErrors.length > 0) {
        result.valid = false;
        result.errors.push(...ruleErrors.map(e => ({
          type: 'rule',
          rule: e.name,
          message: e.message,
          severity: 'error'
        })));
      }
    }

    // Accessibility validation
    if (validationOptions.includeAccessibility) {
      result.accessibilityIssues = this.validateAccessibility(element);
      
      const accessibilityErrors = result.accessibilityIssues.filter(i => i.severity === 'error');
      if (accessibilityErrors.length > 0) {
        result.valid = false;
        result.errors.push(...accessibilityErrors);
      }
      
      const accessibilityWarnings = result.accessibilityIssues.filter(i => i.severity === 'warning');
      result.warnings.push(...accessibilityWarnings);
    }

    // Calculate overall score
    result.score = this.calculateValidationScore(result);

    // Store result
    this.validationResults.set(element, result);

    // Show errors if enabled
    if (validationOptions.showErrors && !result.valid) {
      this.showValidationErrors(element, result);
    } else if (result.valid) {
      this.clearValidationErrors(element);
    }

    return result;
  }

  /**
   * Validate HTML5 constraints
   * @param {Element} element - Element to validate
   * @returns {Object} HTML5 validation result
   */
  validateHTML5(element) {
    const result = {
      valid: element.validity.valid,
      errors: [],
      constraints: {}
    };

    if (!element.validity.valid) {
      const validity = element.validity;
      
      if (validity.valueMissing) {
        result.errors.push({
          type: 'html5',
          constraint: 'required',
          message: this.getCustomMessage(element, 'required') || 'This field is required'
        });
      }
      
      if (validity.typeMismatch) {
        result.errors.push({
          type: 'html5',
          constraint: 'type',
          message: this.getCustomMessage(element, 'type') || `Please enter a valid ${element.type}`
        });
      }
      
      if (validity.patternMismatch) {
        result.errors.push({
          type: 'html5',
          constraint: 'pattern',
          message: this.getCustomMessage(element, 'pattern') || 'Please match the requested format'
        });
      }
      
      if (validity.tooLong) {
        result.errors.push({
          type: 'html5',
          constraint: 'maxlength',
          message: this.getCustomMessage(element, 'maxlength') || `Maximum length is ${element.maxLength} characters`
        });
      }
      
      if (validity.tooShort) {
        result.errors.push({
          type: 'html5',
          constraint: 'minlength',
          message: this.getCustomMessage(element, 'minlength') || `Minimum length is ${element.minLength} characters`
        });
      }
      
      if (validity.rangeOverflow) {
        result.errors.push({
          type: 'html5',
          constraint: 'max',
          message: this.getCustomMessage(element, 'max') || `Maximum value is ${element.max}`
        });
      }
      
      if (validity.rangeUnderflow) {
        result.errors.push({
          type: 'html5',
          constraint: 'min',
          message: this.getCustomMessage(element, 'min') || `Minimum value is ${element.min}`
        });
      }
      
      if (validity.stepMismatch) {
        result.errors.push({
          type: 'html5',
          constraint: 'step',
          message: this.getCustomMessage(element, 'step') || `Please enter a valid value`
        });
      }
      
      if (validity.badInput) {
        result.errors.push({
          type: 'html5',
          constraint: 'input',
          message: this.getCustomMessage(element, 'input') || 'Please enter a valid value'
        });
      }
    }

    return result;
  }

  /**
   * Run custom validators on element
   * @param {Element} element - Element to validate
   * @returns {Promise<Array>} Validation results
   */
  async runCustomValidators(element) {
    const results = [];
    const elementType = element.type || element.tagName.toLowerCase();
    const validatorAttributes = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-validate-'))
      .map(attr => attr.name.replace('data-validate-', ''));

    // Add type-based validators
    if (this.validators.has(elementType)) {
      validatorAttributes.push(elementType);
    }

    // Run applicable validators
    for (const validatorName of validatorAttributes) {
      if (this.validators.has(validatorName)) {
        const validator = this.validators.get(validatorName);
        
        try {
          let result;
          if (validator.async) {
            result = await validator.validate(element.value, element);
          } else {
            result = validator.validate(element.value, element);
          }
          
          results.push({
            validator: validatorName,
            valid: result.valid,
            message: result.message || '',
            severity: result.severity || 'error',
            priority: validator.priority
          });
        } catch (error) {
          results.push({
            validator: validatorName,
            valid: false,
            message: `Validation error: ${error.message}`,
            severity: 'error',
            priority: validator.priority
          });
        }
      }
    }

    return results.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Run custom rules for specific field
   * @param {Element} element - Element to validate
   * @param {string} fieldId - Field identifier
   * @returns {Promise<Array>} Rule results
   */
  async runCustomRules(element, fieldId) {
    const rules = this.customRules.get(fieldId) || [];
    const results = [];

    for (const rule of rules) {
      try {
        let result;
        if (rule.async) {
          result = await rule.validate(element.value, element);
        } else {
          result = rule.validate(element.value, element);
        }
        
        results.push({
          name: rule.name,
          valid: result.valid,
          message: result.message || rule.message,
          priority: rule.priority
        });
      } catch (error) {
        results.push({
          name: rule.name,
          valid: false,
          message: `Rule error: ${error.message}`,
          priority: rule.priority
        });
      }
    }

    return results.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate accessibility of element
   * @param {Element} element - Element to validate
   * @returns {Array} Accessibility issues
   */
  validateAccessibility(element) {
    const issues = [];

    // Check for label
    if (!this.hasAccessibleLabel(element)) {
      issues.push({
        type: 'accessibility',
        constraint: 'label',
        message: 'Element should have an accessible label',
        severity: 'warning',
        wcagCriterion: '1.3.1'
      });
    }

    // Check required field indication
    if (element.required && !element.getAttribute('aria-required')) {
      issues.push({
        type: 'accessibility',
        constraint: 'required-indication',
        message: 'Required fields should have aria-required="true"',
        severity: 'warning',
        wcagCriterion: '3.3.2'
      });
    }

    // Check error indication
    const hasErrors = this.validationResults.get(element)?.errors?.length > 0;
    if (hasErrors && element.getAttribute('aria-invalid') !== 'true') {
      issues.push({
        type: 'accessibility',
        constraint: 'error-indication',
        message: 'Invalid fields should have aria-invalid="true"',
        severity: 'error',
        wcagCriterion: '3.3.1'
      });
    }

    // Check keyboard accessibility
    if (element.tabIndex === -1 && element.type !== 'hidden') {
      issues.push({
        type: 'accessibility',
        constraint: 'keyboard-access',
        message: 'Form elements should be keyboard accessible',
        severity: 'error',
        wcagCriterion: '2.1.1'
      });
    }

    return issues;
  }

  /**
   * Show validation errors for element
   * @param {Element} element - Target element
   * @param {Object} result - Validation result
   */
  showValidationErrors(element, result) {
    this.clearValidationErrors(element);

    const errorContainer = this.createErrorContainer(element);
    const errorList = document.createElement('ul');
    errorList.className = 'validation-errors';

    for (const error of result.errors) {
      const errorItem = document.createElement('li');
      errorItem.className = `validation-error severity-${error.severity || 'error'}`;
      errorItem.textContent = error.message;
      errorList.appendChild(errorItem);
    }

    errorContainer.appendChild(errorList);

    // Add ARIA attributes for accessibility
    const errorId = `${element.id || 'field'}-errors`;
    errorContainer.id = errorId;
    element.setAttribute('aria-describedby', errorId);
    element.setAttribute('aria-invalid', 'true');

    // Highlight element if enabled
    if (this.options.highlightErrors) {
      this.highlightElement(element, 'error');
    }

    this.errorElements.set(element, errorContainer);
  }

  /**
   * Clear validation errors for element
   * @param {Element} element - Target element
   */
  clearValidationErrors(element) {
    const existingErrors = this.errorElements.get(element);
    if (existingErrors) {
      existingErrors.remove();
      this.errorElements.delete(element);
    }

    element.removeAttribute('aria-describedby');
    element.removeAttribute('aria-invalid');
    this.removeHighlight(element);
  }

  /**
   * Create error container for element
   * @param {Element} element - Target element
   * @returns {Element} Error container
   */
  createErrorContainer(element) {
    const container = document.createElement('div');
    container.className = 'validation-error-container';
    
    // Insert after the element or its container
    const insertAfter = element.closest('.form-group') || 
                       element.closest('.field') || 
                       element.parentElement ||
                       element;
    
    insertAfter.insertAdjacentElement('afterend', container);
    return container;
  }

  /**
   * Highlight element with validation state
   * @param {Element} element - Element to highlight
   * @param {string} state - Validation state (error, warning, success)
   */
  highlightElement(element, state) {
    element.classList.remove('validation-error', 'validation-warning', 'validation-success');
    element.classList.add(`validation-${state}`);
    
    // Add CSS if not present
    this.ensureValidationStyles();
  }

  /**
   * Remove highlight from element
   * @param {Element} element - Element to remove highlight from
   */
  removeHighlight(element) {
    element.classList.remove('validation-error', 'validation-warning', 'validation-success');
  }

  /**
   * Ensure validation CSS styles are available
   */
  ensureValidationStyles() {
    if (document.getElementById('form-validation-styles')) return;

    const style = document.createElement('style');
    style.id = 'form-validation-styles';
    style.textContent = `
      .validation-error {
        border-color: #e53e3e !important;
        box-shadow: 0 0 0 1px #e53e3e !important;
      }
      
      .validation-warning {
        border-color: #dd6b20 !important;
        box-shadow: 0 0 0 1px #dd6b20 !important;
      }
      
      .validation-success {
        border-color: #38a169 !important;
        box-shadow: 0 0 0 1px #38a169 !important;
      }
      
      .validation-error-container {
        margin-top: 0.5rem;
      }
      
      .validation-errors {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      
      .validation-error {
        color: #e53e3e;
        font-size: 0.875rem;
        margin-bottom: 0.25rem;
      }
      
      .validation-error.severity-warning {
        color: #dd6b20;
      }
      
      .validation-error.severity-info {
        color: #3182ce;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Helper methods
   */

  hasAccessibleLabel(element) {
    return !!(
      element.labels?.length > 0 ||
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.closest('label')
    );
  }

  getCustomMessage(element, constraint) {
    const customAttr = `data-${constraint}-message`;
    return element.getAttribute(customAttr) || 
           this.options.customErrorMessages[constraint];
  }

  calculateValidationScore(result) {
    let score = 100;
    
    // Deduct points for errors
    score -= result.errors.length * 20;
    
    // Deduct points for warnings
    score -= result.warnings.length * 5;
    
    // Bonus for accessibility compliance
    if (result.accessibilityIssues?.length === 0) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/\d/.test(password)) strength += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 1;
    
    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  }

  luhnCheck(cardNumber) {
    let sum = 0;
    let alternate = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cardNumber.charAt(i), 10);
      
      if (alternate) {
        n *= 2;
        if (n > 9) n = (n % 10) + 1;
      }
      
      sum += n;
      alternate = !alternate;
    }
    
    return (sum % 10) === 0;
  }

  parseFileSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([A-Z]{1,2})$/i);
    
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    return value * (units[unit] || 1);
  }

  /**
   * Setup real-time validation
   * @param {Element} form - Form element to monitor
   */
  setupRealTimeValidation(form) {
    if (!this.options.realTimeValidation) return;

    const fields = form.querySelectorAll('input, select, textarea');
    
    fields.forEach(field => {
      if (this.options.validateOnBlur) {
        field.addEventListener('blur', () => {
          this.validateElement(field);
        });
      }
      
      if (this.options.validateOnChange) {
        field.addEventListener('change', () => {
          this.validateElement(field);
        });
      }
    });
  }

  /**
   * Validate entire form
   * @param {Element} form - Form to validate
   * @returns {Promise<Object>} Form validation result
   */
  async validateForm(form) {
    const fields = form.querySelectorAll('input, select, textarea');
    const results = [];
    
    for (const field of fields) {
      const result = await this.validateElement(field);
      results.push(result);
    }
    
    return {
      valid: results.every(r => r.valid),
      results,
      score: results.reduce((sum, r) => sum + r.score, 0) / results.length
    };
  }
}

export default FormValidationEngine;