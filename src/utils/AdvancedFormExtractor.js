/**
 * AdvancedFormExtractor.js
 * 
 * Advanced form data extraction system that handles all modern HTML form elements,
 * validation, accessibility, and complex form structures.
 */

export class AdvancedFormExtractor {
  constructor(options = {}) {
    this.options = {
      includeHidden: false,
      includeDisabled: false,
      extractFileMetadata: true,
      includeValidation: true,
      includeAccessibility: true,
      includeShadowDOM: true,
      extractCustomData: true,
      groupRelatedElements: true,
      detectDynamicForms: true,
      ...options
    };
    
    this.supportedInputTypes = new Set([
      'text', 'password', 'email', 'url', 'tel', 'search', 'number', 'range',
      'date', 'time', 'datetime-local', 'month', 'week',
      'checkbox', 'radio', 'file', 'hidden', 'color', 'image', 'button',
      'submit', 'reset'
    ]);
    
    this.modernValidationAttributes = [
      'required', 'pattern', 'min', 'max', 'step', 'minlength', 'maxlength',
      'accept', 'multiple', 'autocomplete', 'autofocus', 'readonly', 'disabled'
    ];
    
    this.accessibilityAttributes = [
      'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-required',
      'aria-invalid', 'aria-expanded', 'aria-hidden', 'role', 'title'
    ];
    
    this.formGroups = new Map();
    this.detectedPatterns = new Map();
    this.validationRules = new Map();
  }

  /**
   * Extract all form data from the document
   * @param {Document|Element} root - Root element to extract from
   * @returns {Object} Complete form data structure
   */
  extractAllFormData(root = document) {
    const startTime = performance.now();
    
    const result = {
      timestamp: new Date().toISOString(),
      extractionTime: 0,
      metadata: this.extractDocumentMetadata(root),
      forms: [],
      fieldGroups: [],
      validationRules: [],
      accessibilityInfo: {},
      statistics: {
        totalElements: 0,
        byType: {},
        hasValidation: 0,
        hasAccessibility: 0,
        hasCustomData: 0
      }
    };

    // Extract form containers
    const formContainers = this.findFormContainers(root);
    
    for (const container of formContainers) {
      const formData = this.extractFormContainer(container);
      if (formData) {
        result.forms.push(formData);
      }
    }

    // Extract standalone form elements
    const standaloneElements = this.findStandaloneElements(root);
    if (standaloneElements.length > 0) {
      result.forms.push({
        id: 'standalone-elements',
        type: 'standalone',
        elements: standaloneElements.map(el => this.extractElementData(el)),
        metadata: {
          isStandalone: true,
          elementCount: standaloneElements.length
        }
      });
    }

    // Group related elements
    if (this.options.groupRelatedElements) {
      result.fieldGroups = this.detectFieldGroups(result.forms);
    }

    // Extract validation rules
    if (this.options.includeValidation) {
      result.validationRules = this.extractValidationRules(result.forms);
    }

    // Calculate statistics
    result.statistics = this.calculateStatistics(result.forms);
    result.extractionTime = performance.now() - startTime;

    return result;
  }

  /**
   * Extract metadata from document
   * @param {Document|Element} root - Root element
   * @returns {Object} Document metadata
   */
  extractDocumentMetadata(root) {
    const doc = root.ownerDocument || root;
    
    return {
      url: doc.location?.href || '',
      title: doc.title || '',
      charset: doc.characterSet || '',
      language: doc.documentElement?.lang || '',
      viewport: this.extractViewportInfo(doc),
      frameworks: this.detectFrameworks(doc),
      formLibraries: this.detectFormLibraries(doc),
      hasShadowDOM: this.hasShadowDOMElements(root),
      hasCustomElements: this.hasCustomElements(root)
    };
  }

  /**
   * Find all form containers in the document
   * @param {Document|Element} root - Root element
   * @returns {Array<Element>} Form container elements
   */
  findFormContainers(root) {
    const containers = [];
    
    // Standard form elements
    containers.push(...root.querySelectorAll('form'));
    
    // Elements with form-like patterns
    const formLikeSelectors = [
      '[class*="form"]',
      '[class*="Form"]',
      '[id*="form"]',
      '[id*="Form"]',
      '[role="form"]',
      '[data-form]',
      '.form-container',
      '.form-wrapper'
    ];
    
    for (const selector of formLikeSelectors) {
      try {
        const elements = root.querySelectorAll(selector);
        for (const el of elements) {
          if (this.containsFormElements(el) && !containers.includes(el)) {
            containers.push(el);
          }
        }
      } catch (error) {
        console.warn(`Error with selector ${selector}:`, error);
      }
    }

    // Shadow DOM forms
    if (this.options.includeShadowDOM) {
      containers.push(...this.findShadowDOMForms(root));
    }

    return containers;
  }

  /**
   * Extract data from a form container
   * @param {Element} container - Form container element
   * @returns {Object} Form data
   */
  extractFormContainer(container) {
    const elements = this.findFormElements(container);
    if (elements.length === 0) return null;

    const formData = {
      id: this.generateFormId(container),
      type: container.tagName.toLowerCase(),
      name: container.name || container.id || '',
      action: container.action || '',
      method: container.method || 'get',
      enctype: container.enctype || '',
      target: container.target || '',
      autocomplete: container.autocomplete || '',
      novalidate: container.hasAttribute('novalidate'),
      acceptCharset: container.acceptCharset || '',
      elements: elements.map(el => this.extractElementData(el)),
      metadata: this.extractContainerMetadata(container),
      structure: this.analyzeFormStructure(container),
      accessibility: this.extractAccessibilityInfo(container)
    };

    return formData;
  }

  /**
   * Extract comprehensive data from a form element
   * @param {Element} element - Form element
   * @returns {Object} Element data
   */
  extractElementData(element) {
    const baseData = this.extractBaseElementData(element);
    const validationData = this.extractValidationData(element);
    const accessibilityData = this.extractElementAccessibility(element);
    const customData = this.extractCustomData(element);
    const contextData = this.extractContextualData(element);

    return {
      ...baseData,
      validation: validationData,
      accessibility: accessibilityData,
      custom: customData,
      context: contextData,
      dependencies: this.findElementDependencies(element),
      events: this.extractEventHandlers(element)
    };
  }

  /**
   * Extract base element data
   * @param {Element} element - Form element
   * @returns {Object} Base element data
   */
  extractBaseElementData(element) {
    const tagName = element.tagName.toLowerCase();
    const type = this.getElementType(element);
    
    const data = {
      id: element.id || this.generateElementId(element),
      tagName,
      type,
      name: element.name || '',
      value: this.getElementValue(element),
      defaultValue: this.getDefaultValue(element),
      label: this.findElementLabel(element),
      placeholder: element.placeholder || '',
      className: element.className || '',
      dataset: { ...element.dataset },
      attributes: this.extractAllAttributes(element),
      position: this.getElementPosition(element),
      dimensions: this.getElementDimensions(element),
      visibility: this.getVisibilityInfo(element),
      selector: this.generateUniqueSelector(element)
    };

    // Type-specific data extraction
    switch (type) {
      case 'select':
      case 'select-multiple':
        data.options = this.extractSelectOptions(element);
        data.selectedOptions = this.getSelectedOptions(element);
        data.optgroups = this.extractOptgroups(element);
        break;
        
      case 'radio':
      case 'checkbox':
        data.checked = element.checked;
        data.group = this.findGroupData(element);
        data.relatedElements = this.findRelatedRadioCheckbox(element);
        break;
        
      case 'file':
        data.files = this.extractFileData(element);
        data.accept = element.accept || '';
        data.multiple = element.multiple;
        data.webkitdirectory = element.webkitdirectory;
        break;
        
      case 'range':
      case 'number':
        data.min = element.min || '';
        data.max = element.max || '';
        data.step = element.step || '';
        data.valueAsNumber = element.valueAsNumber || null;
        break;
        
      case 'date':
      case 'time':
      case 'datetime-local':
      case 'month':
      case 'week':
        data.min = element.min || '';
        data.max = element.max || '';
        data.step = element.step || '';
        data.valueAsDate = element.valueAsDate || null;
        data.valueAsNumber = element.valueAsNumber || null;
        break;
        
      case 'textarea':
        data.rows = element.rows || 0;
        data.cols = element.cols || 0;
        data.wrap = element.wrap || '';
        data.selectionStart = element.selectionStart || 0;
        data.selectionEnd = element.selectionEnd || 0;
        break;
        
      case 'color':
        data.list = element.list?.id || '';
        break;
        
      case 'email':
      case 'url':
        data.multiple = element.multiple;
        break;
    }

    return data;
  }

  /**
   * Extract validation data from element
   * @param {Element} element - Form element
   * @returns {Object} Validation data
   */
  extractValidationData(element) {
    if (!this.options.includeValidation) return {};

    const validation = {
      required: element.required,
      pattern: element.pattern || '',
      patternMismatch: false,
      min: element.min || '',
      max: element.max || '',
      minLength: element.minLength || 0,
      maxLength: element.maxLength || 0,
      step: element.step || '',
      accept: element.accept || '',
      multiple: element.multiple,
      customValidationMessage: element.validationMessage || '',
      validity: {},
      constraints: this.extractConstraints(element),
      customRules: this.extractCustomValidationRules(element)
    };

    // Extract HTML5 validity state
    if (element.validity) {
      validation.validity = {
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
    }

    return validation;
  }

  /**
   * Extract accessibility information
   * @param {Element} element - Form element
   * @returns {Object} Accessibility data
   */
  extractElementAccessibility(element) {
    if (!this.options.includeAccessibility) return {};

    return {
      label: element.getAttribute('aria-label') || '',
      labelledBy: element.getAttribute('aria-labelledby') || '',
      describedBy: element.getAttribute('aria-describedby') || '',
      required: element.getAttribute('aria-required') === 'true',
      invalid: element.getAttribute('aria-invalid') === 'true',
      expanded: element.getAttribute('aria-expanded') || '',
      hidden: element.getAttribute('aria-hidden') === 'true',
      role: element.getAttribute('role') || '',
      title: element.title || '',
      tabIndex: element.tabIndex,
      accessKey: element.accessKey || '',
      associatedLabels: this.findAssociatedLabels(element),
      describingElements: this.findDescribingElements(element),
      landmarks: this.findAccessibilityLandmarks(element),
      keyboardNavigable: this.isKeyboardNavigable(element),
      screenReaderText: this.extractScreenReaderText(element)
    };
  }

  /**
   * Find form elements within a container
   * @param {Element} container - Container element
   * @returns {Array<Element>} Form elements
   */
  findFormElements(container) {
    const elements = [];
    
    // Standard form elements
    const standardSelectors = [
      'input', 'select', 'textarea', 'button',
      'meter', 'progress', 'output'
    ];
    
    for (const selector of standardSelectors) {
      elements.push(...container.querySelectorAll(selector));
    }

    // Elements with contenteditable
    elements.push(...container.querySelectorAll('[contenteditable="true"]'));
    
    // Custom form elements
    elements.push(...container.querySelectorAll('[role="textbox"]'));
    elements.push(...container.querySelectorAll('[role="combobox"]'));
    elements.push(...container.querySelectorAll('[role="listbox"]'));
    elements.push(...container.querySelectorAll('[role="slider"]'));
    elements.push(...container.querySelectorAll('[role="spinbutton"]'));

    // Filter out elements that should be excluded
    return elements.filter(el => this.shouldIncludeElement(el));
  }

  /**
   * Determine if an element should be included
   * @param {Element} element - Element to check
   * @returns {boolean} Whether to include the element
   */
  shouldIncludeElement(element) {
    // Check visibility
    if (!this.isElementVisible(element) && element.type !== 'hidden') {
      return false;
    }

    // Check if disabled elements should be included
    if (element.disabled && !this.options.includeDisabled) {
      return false;
    }

    // Check if hidden elements should be included
    if (element.type === 'hidden' && !this.options.includeHidden) {
      return false;
    }

    // Exclude script and style elements
    if (['script', 'style', 'noscript'].includes(element.tagName.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Get element type including modern input types
   * @param {Element} element - Form element
   * @returns {string} Element type
   */
  getElementType(element) {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'input') {
      const type = (element.type || 'text').toLowerCase();
      return this.supportedInputTypes.has(type) ? type : 'text';
    }
    
    if (tagName === 'select') {
      return element.multiple ? 'select-multiple' : 'select';
    }
    
    if (element.hasAttribute('contenteditable')) {
      return 'contenteditable';
    }
    
    // Handle custom elements and ARIA roles
    const role = element.getAttribute('role');
    if (role) {
      const roleTypeMap = {
        'textbox': 'textbox',
        'combobox': 'combobox',
        'listbox': 'listbox',
        'slider': 'slider',
        'spinbutton': 'spinbutton'
      };
      return roleTypeMap[role] || tagName;
    }
    
    return tagName;
  }

  /**
   * Get element value with type-specific handling
   * @param {Element} element - Form element
   * @returns {*} Element value
   */
  getElementValue(element) {
    const type = this.getElementType(element);
    
    switch (type) {
      case 'checkbox':
      case 'radio':
        return element.checked ? element.value : null;
        
      case 'select-multiple':
        return Array.from(element.selectedOptions).map(opt => opt.value);
        
      case 'file':
        return element.files ? Array.from(element.files).map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        })) : [];
        
      case 'number':
      case 'range':
        return element.valueAsNumber || element.value;
        
      case 'date':
      case 'time':
      case 'datetime-local':
      case 'month':
      case 'week':
        return {
          value: element.value,
          valueAsDate: element.valueAsDate,
          valueAsNumber: element.valueAsNumber
        };
        
      case 'contenteditable':
        return {
          textContent: element.textContent,
          innerHTML: element.innerHTML
        };
        
      default:
        return element.value || '';
    }
  }

  /**
   * Extract file data with metadata
   * @param {Element} fileInput - File input element
   * @returns {Array} File data array
   */
  extractFileData(fileInput) {
    if (!this.options.extractFileMetadata || !fileInput.files) return [];
    
    return Array.from(fileInput.files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      lastModifiedDate: new Date(file.lastModified),
      webkitRelativePath: file.webkitRelativePath || '',
      isImage: file.type.startsWith('image/'),
      isVideo: file.type.startsWith('video/'),
      isAudio: file.type.startsWith('audio/'),
      isPDF: file.type === 'application/pdf',
      extension: file.name.split('.').pop()?.toLowerCase() || '',
      sizeFormatted: this.formatFileSize(file.size),
      metadata: this.extractFileMetadata(file)
    }));
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extract select options with enhanced data
   * @param {Element} selectElement - Select element
   * @returns {Array} Options data
   */
  extractSelectOptions(selectElement) {
    return Array.from(selectElement.options).map((option, index) => ({
      index,
      value: option.value,
      text: option.text,
      label: option.label || option.text,
      selected: option.selected,
      disabled: option.disabled,
      hidden: option.hidden,
      dataset: { ...option.dataset },
      className: option.className,
      title: option.title,
      group: option.parentElement.tagName.toLowerCase() === 'optgroup' 
        ? option.parentElement.label 
        : null
    }));
  }

  /**
   * Extract optgroups information
   * @param {Element} selectElement - Select element
   * @returns {Array} Optgroups data
   */
  extractOptgroups(selectElement) {
    const optgroups = selectElement.querySelectorAll('optgroup');
    return Array.from(optgroups).map(group => ({
      label: group.label,
      disabled: group.disabled,
      options: Array.from(group.options).map(opt => opt.value)
    }));
  }

  /**
   * Find element label using multiple strategies
   * @param {Element} element - Form element
   * @returns {string} Element label
   */
  findElementLabel(element) {
    // Strategy 1: aria-label
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }

    // Strategy 2: aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        return labelElement.textContent.trim();
      }
    }

    // Strategy 3: associated label element
    const labels = element.labels;
    if (labels && labels.length > 0) {
      return labels[0].textContent.trim();
    }

    // Strategy 4: wrapping label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      // Remove the input element from clone to get just the label text
      const inputInClone = clone.querySelector('input, select, textarea');
      if (inputInClone) {
        inputInClone.remove();
      }
      return clone.textContent.trim();
    }

    // Strategy 5: nearby text (sibling or parent text)
    const nearbyText = this.findNearbyText(element);
    if (nearbyText) {
      return nearbyText;
    }

    // Strategy 6: placeholder as fallback
    if (element.placeholder) {
      return element.placeholder;
    }

    // Strategy 7: title attribute
    if (element.title) {
      return element.title;
    }

    // Strategy 8: name or id as last resort
    return element.name || element.id || '';
  }

  /**
   * Generate comprehensive statistics
   * @param {Array} forms - Extracted forms data
   * @returns {Object} Statistics
   */
  calculateStatistics(forms) {
    const stats = {
      totalForms: forms.length,
      totalElements: 0,
      byType: {},
      byTag: {},
      hasValidation: 0,
      hasAccessibility: 0,
      hasCustomData: 0,
      hasEvents: 0,
      complexityScore: 0,
      frameworks: new Set(),
      patterns: new Set()
    };

    for (const form of forms) {
      for (const element of form.elements || []) {
        stats.totalElements++;
        
        // Count by type
        stats.byType[element.type] = (stats.byType[element.type] || 0) + 1;
        stats.byTag[element.tagName] = (stats.byTag[element.tagName] || 0) + 1;
        
        // Count features
        if (Object.keys(element.validation || {}).length > 0) {
          stats.hasValidation++;
        }
        
        if (Object.keys(element.accessibility || {}).length > 0) {
          stats.hasAccessibility++;
        }
        
        if (Object.keys(element.custom || {}).length > 0) {
          stats.hasCustomData++;
        }
        
        if (element.events && element.events.length > 0) {
          stats.hasEvents++;
        }
      }
    }

    // Calculate complexity score
    stats.complexityScore = this.calculateComplexityScore(stats);

    return stats;
  }

  /**
   * Apply values to form elements with validation
   * @param {Object} values - Values to apply
   * @param {Object} options - Application options
   * @returns {Object} Application results
   */
  applyValues(values, options = {}) {
    const results = {
      success: [],
      failed: [],
      warnings: [],
      validation: {}
    };

    for (const [identifier, value] of Object.entries(values)) {
      try {
        const element = this.findElement(identifier);
        if (!element) {
          results.failed.push({
            identifier,
            reason: 'Element not found',
            value
          });
          continue;
        }

        const applicationResult = this.applyValueToElement(element, value, options);
        if (applicationResult.success) {
          results.success.push({
            identifier,
            element: element,
            value,
            previousValue: applicationResult.previousValue
          });
        } else {
          results.failed.push({
            identifier,
            element: element,
            reason: applicationResult.reason,
            value
          });
        }

        // Validate after setting value
        if (options.validate !== false) {
          const validation = this.validateElement(element);
          results.validation[identifier] = validation;
        }

      } catch (error) {
        results.failed.push({
          identifier,
          reason: error.message,
          value
        });
      }
    }

    return results;
  }

  /**
   * Validate element value
   * @param {Element} element - Element to validate
   * @returns {Object} Validation results
   */
  validateElement(element) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      htmlValidity: null
    };

    // HTML5 validation
    if (element.validity) {
      validation.htmlValidity = { ...element.validity };
      validation.valid = element.validity.valid;
      
      if (!element.validity.valid) {
        validation.errors.push({
          type: 'html5',
          message: element.validationMessage
        });
      }
    }

    // Custom validation rules
    const customRules = this.validationRules.get(element.id || element.name);
    if (customRules) {
      for (const rule of customRules) {
        const result = rule.validate(element.value, element);
        if (!result.valid) {
          validation.valid = false;
          validation.errors.push({
            type: 'custom',
            rule: rule.name,
            message: result.message
          });
        }
      }
    }

    return validation;
  }

  /**
   * Detect field groups and relationships
   * @param {Array} forms - Forms data
   * @returns {Array} Field groups
   */
  detectFieldGroups(forms) {
    const groups = [];
    
    for (const form of forms) {
      // Detect fieldsets
      const fieldsets = this.extractFieldsets(form);
      groups.push(...fieldsets);
      
      // Detect radio/checkbox groups
      const radioGroups = this.extractRadioGroups(form);
      groups.push(...radioGroups);
      
      // Detect related fields by naming patterns
      const nameGroups = this.detectNamePatternGroups(form);
      groups.push(...nameGroups);
      
      // Detect address/contact groups
      const semanticGroups = this.detectSemanticGroups(form);
      groups.push(...semanticGroups);
    }
    
    return groups;
  }

  /**
   * Generate unique element ID
   * @param {Element} element - Form element
   * @returns {string} Unique ID
   */
  generateElementId(element) {
    if (element.id) return element.id;
    if (element.name) return `name_${element.name}`;
    
    const selector = this.generateUniqueSelector(element);
    return `element_${this.hashString(selector)}`;
  }

  /**
   * Generate unique CSS selector for element
   * @param {Element} element - Target element
   * @returns {string} Unique CSS selector
   */
  generateUniqueSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    const path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      
      if (current.className) {
        selector += '.' + current.className.trim().split(/\s+/).join('.');
      }
      
      // Add position among siblings if needed
      const parent = current.parentNode;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          sibling => sibling.nodeName === current.nodeName
        );
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentNode;
      
      // Stop if we reach a unique identifier
      if (current && (current.id || current === document.body)) {
        if (current.id) {
          path.unshift(`#${current.id}`);
        }
        break;
      }
    }

    return path.join(' > ');
  }

  // Helper methods for comprehensive form analysis...
  
  /**
   * Check if element is visible
   * @param {Element} element - Element to check
   * @returns {boolean} Visibility status
   */
  isElementVisible(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.width > 0 &&
           rect.height > 0 &&
           element.offsetParent !== null;
  }

  /**
   * Hash string for generating consistent IDs
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract viewport information
   * @param {Document} doc - Document object
   * @returns {Object} Viewport information
   */
  extractViewportInfo(doc) {
    try {
      const viewport = doc.querySelector('meta[name="viewport"]');
      return {
        content: viewport?.content || '',
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
        devicePixelRatio: window.devicePixelRatio || 1
      };
    } catch (error) {
      return { content: '', width: 0, height: 0, devicePixelRatio: 1 };
    }
  }

  /**
   * Detect JavaScript frameworks
   * @param {Document} doc - Document object
   * @returns {Array} Detected frameworks
   */
  detectFrameworks(doc) {
    const frameworks = [];
    try {
      if (window.React) frameworks.push('React');
      if (window.Vue) frameworks.push('Vue');
      if (window.angular) frameworks.push('Angular');
      if (window.jQuery || window.$) frameworks.push('jQuery');
      if (doc.querySelector('[ng-app]')) frameworks.push('AngularJS');
      if (doc.querySelector('[data-reactroot]')) frameworks.push('React');
      if (doc.querySelector('[data-v-]')) frameworks.push('Vue');
    } catch (error) {
      console.warn('Error detecting frameworks:', error);
    }
    return frameworks;
  }

  /**
   * Detect form libraries
   * @param {Document} doc - Document object
   * @returns {Array} Detected form libraries
   */
  detectFormLibraries(doc) {
    const libraries = [];
    try {
      if (doc.querySelector('.formik')) libraries.push('Formik');
      if (doc.querySelector('[data-form]')) libraries.push('React Hook Form');
      if (doc.querySelector('.form-group')) libraries.push('Bootstrap Forms');
      if (doc.querySelector('.field')) libraries.push('Semantic UI');
      if (window.Formik) libraries.push('Formik');
    } catch (error) {
      console.warn('Error detecting form libraries:', error);
    }
    return libraries;
  }

  /**
   * Check if document has Shadow DOM elements
   * @param {Element} root - Root element
   * @returns {boolean} Has shadow DOM elements
   */
  hasShadowDOMElements(root) {
    try {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            return node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        }
      );
      return walker.nextNode() !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if document has custom elements
   * @param {Element} root - Root element
   * @returns {boolean} Has custom elements
   */
  hasCustomElements(root) {
    try {
      const elements = root.querySelectorAll('*');
      for (const element of elements) {
        if (element.tagName.includes('-')) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find nearby text for element labeling
   * @param {Element} element - Target element
   * @returns {string} Nearby text
   */
  findNearbyText(element) {
    try {
      // Check previous sibling
      let sibling = element.previousElementSibling;
      if (sibling && sibling.textContent.trim()) {
        return sibling.textContent.trim();
      }

      // Check parent's previous text
      const parent = element.parentElement;
      if (parent) {
        const textNodes = Array.from(parent.childNodes).filter(
          node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        );
        if (textNodes.length > 0) {
          return textNodes[textNodes.length - 1].textContent.trim();
        }
      }

      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Find radio group elements
   * @param {string} name - Radio group name
   * @returns {Array} Radio group elements
   */
  findRadioGroup(name) {
    try {
      return Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`));
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract file metadata
   * @param {File} file - File object
   * @returns {Object} File metadata
   */
  extractFileMetadata(file) {
    try {
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        extension: file.name.split('.').pop()?.toLowerCase() || ''
      };
    } catch (error) {
      return { name: '', size: 0, type: '', lastModified: 0, extension: '' };
    }
  }

  /**
   * Get element position
   * @param {Element} element - Target element
   * @returns {Object} Element position
   */
  getElementPosition(element) {
    try {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right
      };
    } catch (error) {
      return { top: 0, left: 0, bottom: 0, right: 0 };
    }
  }

  /**
   * Get element dimensions
   * @param {Element} element - Target element
   * @returns {Object} Element dimensions
   */
  getElementDimensions(element) {
    try {
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height
      };
    } catch (error) {
      return { width: 0, height: 0 };
    }
  }

  /**
   * Get element visibility information
   * @param {Element} element - Target element
   * @returns {Object} Visibility information
   */
  getVisibilityInfo(element) {
    try {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      return {
        visible: this.isElementVisible(element),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        inViewport: rect.top >= 0 && rect.left >= 0 && 
                   rect.bottom <= window.innerHeight && 
                   rect.right <= window.innerWidth
      };
    } catch (error) {
      return { visible: false, display: 'none', visibility: 'hidden', opacity: '0', inViewport: false };
    }
  }

  /**
   * Extract all attributes from element
   * @param {Element} element - Target element
   * @returns {Object} All attributes
   */
  extractAllAttributes(element) {
    try {
      const attributes = {};
      for (const attr of element.attributes) {
        attributes[attr.name] = attr.value;
      }
      return attributes;
    } catch (error) {
      return {};
    }
  }

  /**
   * Get default value of element
   * @param {Element} element - Target element
   * @returns {*} Default value
   */
  getDefaultValue(element) {
    try {
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.defaultChecked;
      }
      return element.defaultValue || '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Get selected options from select element
   * @param {Element} selectElement - Select element
   * @returns {Array} Selected options
   */
  getSelectedOptions(selectElement) {
    try {
      return Array.from(selectElement.selectedOptions).map(option => ({
        value: option.value,
        text: option.text,
        index: option.index
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Find group data for radio/checkbox
   * @param {Element} element - Target element
   * @returns {Object} Group data
   */
  findGroupData(element) {
    try {
      const name = element.name;
      if (!name) return null;

      const siblings = document.querySelectorAll(`input[name="${name}"]`);
      return {
        name: name,
        count: siblings.length,
        type: element.type
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Find related radio/checkbox elements
   * @param {Element} element - Target element
   * @returns {Array} Related elements
   */
  findRelatedRadioCheckbox(element) {
    try {
      if (element.type === 'radio' && element.name) {
        return Array.from(document.querySelectorAll(`input[type="radio"][name="${element.name}"]`));
      } else if (element.type === 'checkbox' && element.name) {
        return Array.from(document.querySelectorAll(`input[type="checkbox"][name="${element.name}"]`));
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract constraints from element
   * @param {Element} element - Target element
   * @returns {Object} Validation constraints
   */
  extractConstraints(element) {
    try {
      return {
        required: element.required,
        minLength: element.minLength || null,
        maxLength: element.maxLength || null,
        min: element.min || null,
        max: element.max || null,
        step: element.step || null,
        pattern: element.pattern || null
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Extract custom validation rules
   * @param {Element} element - Target element
   * @returns {Array} Custom validation rules
   */
  extractCustomValidationRules(element) {
    try {
      const rules = [];
      
      // Look for data attributes that might indicate custom validation
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-validate-')) {
          rules.push({
            type: attr.name.replace('data-validate-', ''),
            value: attr.value
          });
        }
      }
      
      return rules;
    } catch (error) {
      return [];
    }
  }

  /**
   * Find associated labels
   * @param {Element} element - Target element
   * @returns {Array} Associated labels
   */
  findAssociatedLabels(element) {
    try {
      const labels = [];
      
      // Direct labels
      if (element.labels) {
        labels.push(...Array.from(element.labels));
      }
      
      // aria-labelledby
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelElement = document.getElementById(labelledBy);
        if (labelElement) {
          labels.push(labelElement);
        }
      }
      
      return labels;
    } catch (error) {
      return [];
    }
  }

  /**
   * Find describing elements
   * @param {Element} element - Target element
   * @returns {Array} Describing elements
   */
  findDescribingElements(element) {
    try {
      const describedBy = element.getAttribute('aria-describedby');
      if (describedBy) {
        const ids = describedBy.split(/\s+/);
        return ids.map(id => document.getElementById(id)).filter(Boolean);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Find accessibility landmarks
   * @param {Element} element - Target element
   * @returns {Array} Accessibility landmarks
   */
  findAccessibilityLandmarks(element) {
    try {
      const landmarks = [];
      let current = element.parentElement;
      
      while (current && current !== document.body) {
        const role = current.getAttribute('role');
        if (role && ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'form'].includes(role)) {
          landmarks.push({
            element: current,
            role: role,
            label: current.getAttribute('aria-label') || ''
          });
        }
        current = current.parentElement;
      }
      
      return landmarks;
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if element is keyboard navigable
   * @param {Element} element - Target element
   * @returns {boolean} Is keyboard navigable
   */
  isKeyboardNavigable(element) {
    try {
      return element.tabIndex !== -1 && !element.disabled;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract screen reader text
   * @param {Element} element - Target element
   * @returns {string} Screen reader text
   */
  extractScreenReaderText(element) {
    try {
      const srOnly = element.querySelector('.sr-only, .screen-reader-text, .visually-hidden');
      return srOnly ? srOnly.textContent.trim() : '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Extract contextual data
   * @param {Element} element - Target element
   * @returns {Object} Contextual data
   */
  extractContextualData(element) {
    try {
      const fieldset = element.closest('fieldset');
      const form = element.closest('form');
      
      return {
        fieldset: fieldset ? {
          legend: fieldset.querySelector('legend')?.textContent.trim() || '',
          disabled: fieldset.disabled
        } : null,
        form: form ? {
          action: form.action,
          method: form.method,
          name: form.name || form.id
        } : null,
        section: element.closest('section')?.getAttribute('aria-label') || '',
        container: element.closest('[role="group"]')?.getAttribute('aria-label') || ''
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Find element dependencies
   * @param {Element} element - Target element
   * @returns {Array} Element dependencies
   */
  findElementDependencies(element) {
    try {
      const dependencies = [];
      
      // Look for elements that control this element's visibility/state
      const controls = document.querySelectorAll(`[aria-controls="${element.id}"]`);
      dependencies.push(...Array.from(controls));
      
      // Look for elements described by this element
      const describes = document.querySelectorAll(`[aria-describedby~="${element.id}"]`);
      dependencies.push(...Array.from(describes));
      
      return dependencies.map(dep => ({
        element: dep,
        relationship: dep.getAttribute('aria-controls') === element.id ? 'controls' : 'describes'
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract event handlers
   * @param {Element} element - Target element
   * @returns {Array} Event handlers
   */
  extractEventHandlers(element) {
    try {
      const events = [];
      
      // Common form events
      const eventTypes = ['change', 'input', 'focus', 'blur', 'click', 'submit'];
      
      for (const eventType of eventTypes) {
        const handler = element[`on${eventType}`];
        if (handler) {
          events.push({
            type: eventType,
            hasHandler: true
          });
        }
      }
      
      return events;
    } catch (error) {
      return [];
    }
  }

  /**
   * Calculate complexity score
   * @param {Object} stats - Statistics object
   * @returns {number} Complexity score
   */
  calculateComplexityScore(stats) {
    try {
      let score = 0;
      
      // Base score from element count
      score += stats.totalElements * 2;
      
      // Add points for different element types
      score += Object.keys(stats.byType).length * 5;
      
      // Add points for validation
      score += stats.hasValidation * 3;
      
      // Add points for accessibility
      score += stats.hasAccessibility * 2;
      
      // Add points for custom data
      score += stats.hasCustomData * 1;
      
      return Math.min(score, 100); // Cap at 100
    } catch (error) {
      return 0;
    }
  }

  // Additional helper methods for field groups
  
  /**
   * Extract fieldsets
   * @param {Object} form - Form object
   * @returns {Array} Fieldset groups
   */
  extractFieldsets(form) {
    // Implementation would go here
    return [];
  }

  /**
   * Extract radio groups
   * @param {Object} form - Form object
   * @returns {Array} Radio groups
   */
  extractRadioGroups(form) {
    // Implementation would go here
    return [];
  }

  /**
   * Detect name pattern groups
   * @param {Object} form - Form object
   * @returns {Array} Name pattern groups
   */
  detectNamePatternGroups(form) {
    // Implementation would go here
    return [];
  }

  /**
   * Detect semantic groups
   * @param {Object} form - Form object
   * @returns {Array} Semantic groups
   */
  detectSemanticGroups(form) {
    // Implementation would go here
    return [];
  }
}

export default AdvancedFormExtractor;