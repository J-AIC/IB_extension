/**
 * EnhancedFormsController.js
 * 
 * Enhanced forms controller with comprehensive form handling capabilities,
 * advanced validation, accessibility support, and intelligent form operations.
 */

import { Controller } from '../architecture.js';
import EnhancedFormsModel from '../models/EnhancedFormsModel.js';

export class EnhancedFormsController extends Controller {
  constructor(options = {}) {
    try {
      // Don't pass options as model to super, pass null instead
      super(null, null);
      
      this.options = {
        autoRefresh: true,
        validateOnApply: true,
        highlightErrors: true,
        triggerEvents: true,
        accessibilityMode: false,
        smartFill: true,
        ...options
      };

      this.highlightedElements = new Set();
      this.animationFrameId = null;
      this.eventListeners = new Map();
      
      // Create a new EnhancedFormsModel with error handling
      try {
        this.model = new EnhancedFormsModel();
        console.log('EnhancedFormsModel created successfully');
      } catch (modelError) {
        console.error('Failed to create EnhancedFormsModel:', modelError);
        throw new Error(`EnhancedFormsModel creation failed: ${modelError.message}`);
      }
      
      // Initialize the model with error handling
      try {
        if (typeof this.model.initialize === 'function') {
          this.model.initialize({
            extractorConfig: {
              includeHidden: this.options.includeHidden || false,
              includeDisabled: this.options.includeDisabled || false,
              extractFileMetadata: true,
              includeValidation: true,
              includeAccessibility: this.options.accessibilityMode,
              includeShadowDOM: true,
              extractCustomData: true,
              groupRelatedElements: true,
              detectDynamicForms: this.options.autoRefresh
            }
          });
          console.log('EnhancedFormsModel initialized successfully');
        } else {
          console.error('EnhancedFormsModel does not have initialize method');
          throw new Error('Model initialization method not found');
        }
      } catch (initError) {
        console.error('Failed to initialize EnhancedFormsModel:', initError);
        throw new Error(`Model initialization failed: ${initError.message}`);
      }

      this.setupEventListeners();
      console.log('EnhancedFormsController initialization complete');
      
    } catch (error) {
      console.error('EnhancedFormsController constructor failed:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for model changes
   */
  setupEventListeners() {
    this.model.on('formsExtracted', (data) => {
      this.handleFormsExtracted(data);
    });

    this.model.on('valuesApplied', (results) => {
      this.handleValuesApplied(results);
    });
  }

  /**
   * Get comprehensive forms data with analysis
   * @param {Object} options - Options for data retrieval
   * @returns {Object} Complete forms data with analysis
   */
  getFormsData(options = {}) {
    const rawData = this.model.getFormsData();
    const statistics = this.model.get('statistics');
    const lastExtraction = this.model.get('lastExtraction');

    if (options.includeAnalysis) {
      return {
        forms: rawData,
        statistics,
        analysis: this.analyzeFormsData(rawData),
        recommendations: this.generateRecommendations(rawData),
        extractionInfo: {
          timestamp: lastExtraction?.timestamp,
          extractionTime: lastExtraction?.extractionTime,
          totalElements: statistics?.totalElements || 0
        }
      };
    }

    return rawData;
  }

  /**
   * Get detailed form by ID with enhanced information
   * @param {string} id - Form ID
   * @param {Object} options - Options for form retrieval
   * @returns {Object|null} Enhanced form data
   */
  getForm(id, options = {}) {
    const form = this.model.getForm(id);
    if (!form) return null;

    if (options.includeValidation) {
      form.validationStatus = this.validateForm(form);
    }

    if (options.includeAccessibility) {
      form.accessibilityScore = this.assessAccessibility(form);
    }

    if (options.includeUsability) {
      form.usabilityScore = this.assessUsability(form);
    }

    return form;
  }

  /**
   * Find elements with advanced search capabilities
   * @param {Object} criteria - Search criteria
   * @returns {Array} Matching elements with metadata
   */
  findElements(criteria) {
    const elements = this.model.findElements(criteria);
    
    return elements.map(element => ({
      ...element,
      accessibility: this.assessElementAccessibility(element),
      usability: this.assessElementUsability(element),
      recommendations: this.getElementRecommendations(element)
    }));
  }

  /**
   * Smart form filling with validation and error handling
   * @param {Object} values - Values to apply
   * @param {Object} options - Application options
   * @returns {Promise<Object>} Application results
   */
  async smartFillForms(values, options = {}) {
    const fillOptions = {
      validate: this.options.validateOnApply,
      triggerEvents: this.options.triggerEvents,
      highlightErrors: this.options.highlightErrors,
      smartMatching: this.options.smartFill,
      retryFailed: true,
      maxRetries: 3,
      ...options
    };

    // Pre-process values with smart matching
    const processedValues = fillOptions.smartMatching 
      ? await this.preprocessValuesWithSmartMatching(values)
      : values;

    // Apply values
    const results = this.model.applyValues(processedValues, fillOptions);

    // Handle errors with retry logic
    if (fillOptions.retryFailed && results.failed.length > 0) {
      const retryResults = await this.retryFailedApplications(results.failed, fillOptions);
      results.retryResults = retryResults;
      
      // Merge successful retries
      results.success.push(...retryResults.success);
      results.failed = retryResults.failed;
    }

    // Highlight validation errors
    if (fillOptions.highlightErrors) {
      this.highlightValidationErrors(results.validationResults);
    }

    // Generate completion report
    results.completionReport = this.generateCompletionReport(results);

    return results;
  }

  /**
   * Validate entire form or specific elements
   * @param {string|Object} target - Form ID or form object
   * @param {Object} options - Validation options
   * @returns {Object} Validation results
   */
  validateForm(target, options = {}) {
    const form = typeof target === 'string' ? this.model.getForm(target) : target;
    if (!form) {
      throw new Error('Form not found');
    }

    const validationOptions = {
      includeWarnings: true,
      includeAccessibility: this.options.accessibilityMode,
      includeUsability: options.includeUsability || false,
      customRules: options.customRules || [],
      ...options
    };

    const results = {
      formId: form.id,
      valid: true,
      score: 0,
      elements: {},
      summary: {
        totalElements: form.elements?.length || 0,
        validElements: 0,
        invalidElements: 0,
        warnings: 0
      },
      issues: [],
      recommendations: []
    };

    // Validate each element
    if (form.elements) {
      for (const element of form.elements) {
        try {
          const elementValidation = this.model.validateElement(
            this.model.findElement(element.id)
          );
          
          results.elements[element.id] = elementValidation;
          
          if (elementValidation.valid) {
            results.summary.validElements++;
          } else {
            results.summary.invalidElements++;
            results.valid = false;
          }
          
          results.summary.warnings += elementValidation.warnings?.length || 0;
          
        } catch (error) {
          results.issues.push({
            elementId: element.id,
            type: 'validation_error',
            message: `Validation failed: ${error.message}`
          });
        }
      }
    }

    // Calculate overall score
    results.score = this.calculateValidationScore(results);

    // Generate recommendations
    results.recommendations = this.generateValidationRecommendations(results);

    return results;
  }

  /**
   * Assess accessibility of forms
   * @param {string|Object} target - Form ID or form object
   * @returns {Object} Accessibility assessment
   */
  assessAccessibility(target) {
    const form = typeof target === 'string' ? this.model.getForm(target) : target;
    if (!form) return null;

    const assessment = {
      formId: form.id,
      score: 0,
      maxScore: 0,
      issues: [],
      recommendations: [],
      wcagCompliance: {
        level: 'none',
        passedCriteria: [],
        failedCriteria: []
      }
    };

    if (!form.elements) return assessment;

    for (const element of form.elements) {
      const elementAssessment = this.assessElementAccessibility(element);
      assessment.score += elementAssessment.score;
      assessment.maxScore += elementAssessment.maxScore;
      assessment.issues.push(...elementAssessment.issues);
      assessment.recommendations.push(...elementAssessment.recommendations);
    }

    // Calculate percentage score
    assessment.percentage = assessment.maxScore > 0 
      ? Math.round((assessment.score / assessment.maxScore) * 100)
      : 0;

    // Determine WCAG compliance level
    assessment.wcagCompliance = this.assessWCAGCompliance(assessment);

    return assessment;
  }

  /**
   * Assess element accessibility
   * @param {Object} element - Element data
   * @returns {Object} Element accessibility assessment
   */
  assessElementAccessibility(element) {
    const assessment = {
      elementId: element.id,
      score: 0,
      maxScore: 0,
      issues: [],
      recommendations: []
    };

    // Check for label (5 points)
    assessment.maxScore += 5;
    if (element.label || element.accessibility?.label || element.accessibility?.labelledBy) {
      assessment.score += 5;
    } else {
      assessment.issues.push({
        type: 'missing_label',
        severity: 'high',
        message: 'Element lacks accessible label'
      });
      assessment.recommendations.push('Add a label element or aria-label attribute');
    }

    // Check for required indication (3 points)
    if (element.validation?.required) {
      assessment.maxScore += 3;
      if (element.accessibility?.required) {
        assessment.score += 3;
      } else {
        assessment.issues.push({
          type: 'missing_required_indication',
          severity: 'medium',
          message: 'Required field not properly indicated for screen readers'
        });
        assessment.recommendations.push('Add aria-required="true" attribute');
      }
    }

    // Check for error indication (4 points)
    assessment.maxScore += 4;
    if (element.accessibility?.invalid === false) {
      assessment.score += 4;
    } else if (element.accessibility?.invalid === true) {
      if (element.accessibility?.describedBy) {
        assessment.score += 2; // Partial score for having error indication
      }
      assessment.recommendations.push('Ensure error messages are associated with aria-describedby');
    }

    // Check keyboard accessibility (3 points)
    assessment.maxScore += 3;
    if (element.accessibility?.keyboardNavigable) {
      assessment.score += 3;
    } else {
      assessment.issues.push({
        type: 'keyboard_inaccessible',
        severity: 'high',
        message: 'Element is not keyboard accessible'
      });
      assessment.recommendations.push('Ensure element is focusable and keyboard navigable');
    }

    return assessment;
  }

  /**
   * Highlight elements with visual indicators
   * @param {Array|string} targets - Element IDs or selectors to highlight
   * @param {Object} options - Highlight options
   * @returns {EnhancedFormsController} Controller instance for chaining
   */
  highlight(targets, options = {}) {
    const highlightOptions = {
      color: '#3b82f6',
      style: 'outline',
      duration: 0, // 0 = permanent until removed
      animation: 'pulse',
      zIndex: 9999,
      ...options
    };

    const targetArray = Array.isArray(targets) ? targets : [targets];

    for (const target of targetArray) {
      const element = this.model.findElement(target);
      if (element) {
        this.applyHighlight(element, highlightOptions);
        this.highlightedElements.add(element);
      }
    }

    return this;
  }

  /**
   * Remove all highlights
   * @returns {EnhancedFormsController} Controller instance for chaining
   */
  removeHighlight() {
    this.highlightedElements.forEach(element => {
      this.removeElementHighlight(element);
    });
    this.highlightedElements.clear();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    return this;
  }

  /**
   * Apply visual highlight to element
   * @param {Element} element - Element to highlight
   * @param {Object} options - Highlight options
   */
  applyHighlight(element, options) {
    // Store original styles
    if (!element.dataset.originalOutline) {
      element.dataset.originalOutline = element.style.outline || '';
      element.dataset.originalBoxShadow = element.style.boxShadow || '';
    }

    // Apply highlight styles
    switch (options.style) {
      case 'outline':
        element.style.outline = `2px solid ${options.color}`;
        element.style.outlineOffset = '2px';
        break;
      case 'border':
        element.style.border = `2px solid ${options.color}`;
        break;
      case 'shadow':
        element.style.boxShadow = `0 0 0 3px ${options.color}40, 0 0 0 6px ${options.color}20`;
        break;
      case 'background':
        element.style.backgroundColor = options.color + '20';
        break;
    }

    // Apply animation
    if (options.animation) {
      this.applyHighlightAnimation(element, options);
    }
  }

  /**
   * Apply highlight animation
   * @param {Element} element - Element to animate
   * @param {Object} options - Animation options
   */
  applyHighlightAnimation(element, options) {
    if (options.animation === 'pulse') {
      element.style.animation = 'form-highlight-pulse 2s infinite';
      
      // Add CSS animation if not already present
      if (!document.getElementById('form-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'form-highlight-styles';
        style.textContent = `
          @keyframes form-highlight-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.02); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }

  /**
   * Remove highlight from element
   * @param {Element} element - Element to remove highlight from
   */
  removeElementHighlight(element) {
    // Restore original styles
    if (element.dataset.originalOutline !== undefined) {
      element.style.outline = element.dataset.originalOutline;
      delete element.dataset.originalOutline;
    }
    
    if (element.dataset.originalBoxShadow !== undefined) {
      element.style.boxShadow = element.dataset.originalBoxShadow;
      delete element.dataset.originalBoxShadow;
    }

    // Remove animation
    element.style.animation = '';
  }

  /**
   * Generate smart recommendations for forms
   * @param {Array} forms - Forms data
   * @returns {Array} Recommendations
   */
  generateRecommendations(forms) {
    const recommendations = [];

    for (const form of forms) {
      if (!form.elements) continue;

      // Check for missing labels
      const unlabeledElements = form.elements.filter(el => !el.label);
      if (unlabeledElements.length > 0) {
        recommendations.push({
          type: 'accessibility',
          severity: 'high',
          formId: form.id,
          message: `${unlabeledElements.length} elements missing labels`,
          elements: unlabeledElements.map(el => el.id),
          suggestion: 'Add labels for better accessibility'
        });
      }

      // Check for validation issues
      const requiredWithoutIndication = form.elements.filter(el => 
        el.validation?.required && !el.accessibility?.required
      );
      if (requiredWithoutIndication.length > 0) {
        recommendations.push({
          type: 'validation',
          severity: 'medium',
          formId: form.id,
          message: `${requiredWithoutIndication.length} required fields lack aria-required`,
          elements: requiredWithoutIndication.map(el => el.id),
          suggestion: 'Add aria-required="true" to required fields'
        });
      }

      // Check for usability issues
      const longForms = form.elements.length > 20;
      if (longForms) {
        recommendations.push({
          type: 'usability',
          severity: 'low',
          formId: form.id,
          message: 'Form has many fields, consider grouping or multi-step approach',
          suggestion: 'Use fieldsets or break into multiple steps'
        });
      }
    }

    return recommendations;
  }

  /**
   * Preprocess values with smart matching
   * @param {Object} values - Original values
   * @returns {Promise<Object>} Processed values
   */
  async preprocessValuesWithSmartMatching(values) {
    const processed = {};
    const allElements = this.model.getAllElements();

    for (const [key, value] of Object.entries(values)) {
      let targetElement = this.model.findElement(key);
      
      if (!targetElement) {
        // Try fuzzy matching
        const matches = this.fuzzyMatchElement(key, allElements);
        if (matches.length > 0) {
          targetElement = matches[0].element;
          processed[matches[0].element.id] = value;
          continue;
        }
      }
      
      processed[key] = value;
    }

    return processed;
  }

  /**
   * Fuzzy match element by label or name
   * @param {string} query - Search query
   * @param {Array} elements - Elements to search
   * @returns {Array} Matching elements with confidence scores
   */
  fuzzyMatchElement(query, elements) {
    const matches = [];
    const queryLower = query.toLowerCase();

    for (const element of elements) {
      let score = 0;
      
      // Exact matches
      if (element.id === query || element.name === query) {
        score = 100;
      }
      // Label matches
      else if (element.label.toLowerCase().includes(queryLower)) {
        score = 80;
      }
      // Partial matches
      else if (element.label.toLowerCase().indexOf(queryLower) !== -1) {
        score = 60;
      }
      // Name similarity
      else if (element.name.toLowerCase().includes(queryLower)) {
        score = 40;
      }

      if (score > 0) {
        matches.push({ element, score });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Handle forms extracted event
   * @param {Object} data - Extraction data
   */
  handleFormsExtracted(data) {
    this.debugLog('handleFormsExtracted', `Processed ${data.forms.length} forms`);
    
    // Trigger custom event for external listeners
    this.trigger('formsUpdated', {
      forms: data.forms,
      statistics: data.statistics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle values applied event
   * @param {Object} results - Application results
   */
  handleValuesApplied(results) {
    this.debugLog('handleValuesApplied', 
      `Applied ${results.success.length}/${results.totalAttempted} values successfully`
    );

    // Trigger custom event
    this.trigger('valuesUpdated', results);
  }

  /**
   * Refresh forms data
   * @returns {Promise<Object>} Extraction results
   */
  async refresh() {
    return this.model.extractAllForms();
  }

  /**
   * Get model statistics
   * @returns {Object} Current statistics
   */
  getStatistics() {
    return this.model.get('statistics');
  }

  /**
   * Get extraction history
   * @returns {Array} Extraction history
   */
  getExtractionHistory() {
    return this.model.get('extractionHistory');
  }

  /**
   * Debug logging
   * @param {string} section - Code section
   * @param {string} message - Log message
   * @param {*} data - Optional data
   */
  debugLog(section, message, data = null) {
    this.model.debugLog(section, message, data);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.removeHighlight();
    this.model.destroy();
    this.eventListeners.clear();
  }
}

export default EnhancedFormsController;