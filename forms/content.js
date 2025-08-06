//------------------------
// forms/content.js
//------------------------
// import { FormsController } from '../src/controllers/FormsController.js';

/**
 * Debug logging function
 * 
 * @param {string} section - The section of the code
 * @param {string} message - The message to log
 * @param {*} data - Optional data to log
 */
function debugLog(section, message, data = null) {
  const DEBUG = true;
  if (!DEBUG) return;
  
  const log = `[FormsContent][${section}] ${message}`;
  secureLogger.log(log);
  
  if (data) {
    secureLogger.log('Data:', data);
  }
}

/**
 * Check if a node contains form elements
 * 
 * @param {MutationRecord} mutation - The mutation record
 * @returns {boolean} - Whether the mutation contains form elements
 */
function hasForms(mutation) {
  const elements = Array.from(mutation.addedNodes);
  return elements.some(node => {
    if (node.querySelectorAll) {
      return node.querySelectorAll('input, select, textarea').length > 0;
    }
    return false;
  });
}

/**
 * Create a MutationObserver to watch for form changes
 * 
 * @param {FormsController} formsController - The forms controller instance
 * @returns {MutationObserver} - The mutation observer
 */
function createFormObserver(formsController) {
  return new MutationObserver((mutations) => {
    let needsUpdate = false;
    
    for (const mutation of mutations) {
      if (hasForms(mutation)) {
        needsUpdate = true;
        break;
      }
    }
    
    if (needsUpdate) {
      debugLog('mutationObserver', 'Detected form changes, refreshing forms');
      formsController.refresh();
    }
  });
}

/**
 * Set up message listeners for communication with other parts of the extension
 * 
 * @param {FormsController} formsController - The forms controller instance
 */
function setupMessageListeners(formsController) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog('messageListener', 'Received message', request);
    
    try {
      switch (request.action) {
        case 'getForms':
          debugLog('getForms', 'Getting form data');
          const formsData = formsController.getFormsData();
          debugLog('getForms', 'Retrieved form data', formsData);
          sendResponse(formsData);
          break;
          
        case 'applyValues':
          debugLog('applyValues', 'Applying values to forms', request.values);
          formsController.applyValues(request.values);
          sendResponse({ success: true });
          break;
          
        case 'highlightForms':
          debugLog('highlightForms', 'Highlighting form elements');
          if (request.formIds) {
            formsController.highlight(request.formIds, request.options || {});
          } else {
            // Highlight all forms if no specific IDs are provided
            const allFormIds = formsController.getFormsData().map(form => form.id);
            formsController.highlight(allFormIds, request.options || {});
          }
          sendResponse({ success: true });
          break;
          
        case 'removeHighlight':
          debugLog('removeHighlight', 'Removing form highlights');
          formsController.removeHighlight();
          sendResponse({ success: true });
          break;
          
        case 'findFormsByLabel':
          debugLog('findFormsByLabel', 'Finding forms by label', request.label);
          const formsByLabel = formsController.findFormsByLabel(
            request.label, 
            request.exactMatch || false
          );
          sendResponse(formsByLabel);
          break;
          
        case 'findFormsByType':
          debugLog('findFormsByType', 'Finding forms by type', request.type);
          const formsByType = formsController.findFormsByType(request.type);
          sendResponse(formsByType);
          break;
          
        case 'findRequiredForms':
          debugLog('findRequiredForms', 'Finding required forms');
          const requiredForms = formsController.findRequiredForms();
          sendResponse(requiredForms);
          break;
          
        case 'getFormValues':
          debugLog('getFormValues', 'Getting form values');
          const formValues = formsController.getFormValues();
          sendResponse(formValues);
          break;
          
        case 'ping':
          debugLog('ping', 'Content script ping check');
          sendResponse({ success: true, message: 'Content script is accessible' });
          break;
      }
    } catch (error) {
      debugLog('messageListener', 'Error processing message', error);
      sendResponse({ error: error.message });
    }
    
    return true; // For async response
  });
}

/**
 * Basic Forms Controller for content script
 * This is a simplified version that doesn't rely on imports
 */
class BasicFormsController {
  constructor() {
    this.forms = [];
    this.initialize();
  }

  initialize() {
    this.refresh();
  }

  refresh() {
    this.forms = this.scanForForms();
  }

  scanForForms() {
    const forms = [];
    const formElements = document.querySelectorAll('input, select, textarea');
    
    formElements.forEach((element, index) => {
      const formData = {
        id: element.id || `form-element-${index}`,
        type: element.type || element.tagName.toLowerCase(),
        name: element.name,
        value: element.value,
        placeholder: element.placeholder,
        required: element.required,
        element: element
      };

      if (element.tagName.toLowerCase() === 'select') {
        formData.options = Array.from(element.options).map(option => ({
          value: option.value,
          text: option.text,
          label: option.label || option.text,
          selected: option.selected
        }));
        debugLog('scanForForms', `Captured select element with ${formData.options.length} options`, {
          elementId: formData.id,
          options: formData.options
        });
      }

      forms.push(formData);
    });
    
    return forms;
  }

  getFormsData() {
    return this.forms.map(form => {
      const formData = {
        id: form.id,
        type: form.type,
        name: form.name,
        value: form.value,
        placeholder: form.placeholder,
        required: form.required
      };

      if (form.options) {
        formData.options = form.options;
      }

      return formData;
    });
  }

  applyValues(values) {
    if (Array.isArray(values)) {
    values.forEach(valueData => {
      const form = this.forms.find(f => f.id === valueData.id || f.name === valueData.name);
      if (form && form.element) {
        // Special handling for select elements
        if (form.element.tagName.toLowerCase() === 'select') {
          this._setSelectValue(form.element, valueData.value);
        } else {
          form.element.value = valueData.value;
        }
        form.value = valueData.value;
      }
    });
    } else {
      Object.entries(values).forEach(([id, val]) => {
        const form = this.forms.find(f => f.id === id || f.name === id);
        if (form && form.element) {
          if (form.element.tagName.toLowerCase() === 'select') {
            this._setSelectValue(form.element, val);
          } else {
            form.element.value = val;
          }
          form.value = val;
          // Trigger change and input events
          form.element.dispatchEvent(new Event('change', { bubbles: true }));
          form.element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
  }

  // Helper method for setting select element values
  _setSelectValue(selectElement, value) {
    debugLog('_setSelectValue', `Setting select value to "${value}"`, { selectElement });

    if (!value) {
      debugLog('_setSelectValue', 'Empty value provided, skipping selection');
      return;
    }

    // Gather all available options first for better understanding of the dropdown
    const options = Array.from(selectElement.options);
    const optionData = options.map((opt, index) => ({
      index: index,
      value: opt.value,
      text: opt.text,
      label: opt.label || opt.text
    }));

    debugLog('_setSelectValue', 'Available options in dropdown', optionData);

    // Try to find an exact match first by value (most reliable)
    let matchIndex = optionData.findIndex(opt => opt.value === value);

    // If not found, try matching by visible text
    if (matchIndex === -1) {
      matchIndex = optionData.findIndex(opt => opt.text === value);
      if (matchIndex !== -1) {
        debugLog('_setSelectValue', `Found match by text at index ${matchIndex}`);
      }
    } else {
      debugLog('_setSelectValue', `Found exact match by value at index ${matchIndex}`);
    }

    // If still not found, try case-insensitive match
    if (matchIndex === -1 && typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      matchIndex = optionData.findIndex(opt =>
        (typeof opt.value === 'string' && opt.value.toLowerCase() === lowerValue) ||
        (typeof opt.text === 'string' && opt.text.toLowerCase() === lowerValue)
      );
      if (matchIndex !== -1) {
        debugLog('_setSelectValue', `Found case-insensitive match at index ${matchIndex}`);
      }
    }

    // If still not found, try partial match in text or value
    if (matchIndex === -1 && typeof value === 'string') {
      matchIndex = optionData.findIndex(opt =>
        (typeof opt.text === 'string' && opt.text.includes(value)) ||
        (typeof opt.value === 'string' && opt.value.includes(value))
      );
      if (matchIndex !== -1) {
        debugLog('_setSelectValue', `Found partial match at index ${matchIndex}`);
      }
    }

    // If still not found, try fuzzy matching (checks if value contains any part of the option or vice versa)
    if (matchIndex === -1 && typeof value === 'string') {
      // First check if any option contains parts of our value
      const valueParts = value.split(/[\s-_,;]+/).filter(part => part.length > 2);
      if (valueParts.length > 0) {
        for (let i = 0; i < optionData.length; i++) {
          const opt = optionData[i];
          const optTextLower = typeof opt.text === 'string' ? opt.text.toLowerCase() : '';
          const optValueLower = typeof opt.value === 'string' ? opt.value.toLowerCase() : '';

          // Check if any meaningful part of our value is in this option
          const foundPart = valueParts.some(part => {
            const lowerPart = part.toLowerCase();
            return optTextLower.includes(lowerPart) || optValueLower.includes(lowerPart);
          });

          if (foundPart) {
            matchIndex = i;
            debugLog('_setSelectValue', `Found fuzzy match at index ${matchIndex} using value parts`);
            break;
          }
        }
      }

      // If still not found, check if our value contains parts of any option
      if (matchIndex === -1) {
        const valueLower = value.toLowerCase();
        let bestMatchScore = 0;
        let bestMatchIndex = -1;

        optionData.forEach((opt, index) => {
          const optTextLower = typeof opt.text === 'string' ? opt.text.toLowerCase() : '';
          if (optTextLower.length > 2) { // Only consider non-trivial options
            // Calculate a rough similarity score
            let score = 0;
            const parts = optTextLower.split(/[\s-_,;]+/).filter(part => part.length > 2);
            parts.forEach(part => {
              if (valueLower.includes(part)) {
                score += part.length;
              }
            });

            if (score > bestMatchScore) {
              bestMatchScore = score;
              bestMatchIndex = index;
            }
          }
        });

        if (bestMatchIndex !== -1) {
          matchIndex = bestMatchIndex;
          debugLog('_setSelectValue', `Found best fuzzy match at index ${matchIndex} with score ${bestMatchScore}`);
        }
      }
    }

    // Apply the selection if we found a match
    if (matchIndex !== -1) {
      selectElement.selectedIndex = matchIndex;
      debugLog('_setSelectValue', `Selected option at index ${matchIndex}: "${optionData[matchIndex].text}" (${optionData[matchIndex].value})`);

      // Trigger events to ensure any dependent logic executes
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } else if (selectElement.options.length > 0) {
      // If no match found, log the issue but don't change the selection
      debugLog('_setSelectValue', `No match found for "${value}" among ${options.length} options - keeping current selection`);
      return false;
    } else {
      debugLog('_setSelectValue', 'Dropdown has no options, cannot select anything');
      return false;
    }
  }

  highlight(formIds, options = {}) {
    const color = options.color || '#ff0000';
    formIds.forEach(id => {
      const form = this.forms.find(f => f.id === id);
      if (form && form.element) {
        form.element.style.outline = `2px solid ${color}`;
      }
    });
  }

  removeHighlight() {
    this.forms.forEach(form => {
      if (form.element) {
        form.element.style.outline = '';
      }
    });
  }

  findFormsByLabel(label, exactMatch = false) {
    return this.forms.filter(form => {
      const labelElement = document.querySelector(`label[for="${form.id}"]`);
      if (labelElement) {
        const labelText = labelElement.textContent;
        return exactMatch ? labelText === label : labelText.includes(label);
      }
      return false;
    });
  }

  findFormsByType(type) {
    return this.forms.filter(form => form.type === type);
  }

  findRequiredForms() {
    return this.forms.filter(form => form.required);
  }

  getFormValues() {
    return this.forms.reduce((values, form) => {
      values[form.id || form.name] = form.value;
      return values;
    }, {});
  }
}

/**
 * Initialize the forms controller and set up observers and listeners
 */
function initFormsContent() {
  try {
    debugLog('init', 'Initializing FormsContent');
    
    // Create the forms controller
    const formsController = new BasicFormsController();
    
    // Set up mutation observer to watch for form changes
    const observer = createFormObserver(formsController);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Set up message listeners
    setupMessageListeners(formsController);
    
    debugLog('init', 'FormsContent initialized successfully');
  } catch (error) {
    debugLog('init', 'Error initializing FormsContent', error);
    secureLogger.error('FormsContent initialization error:', error);
  }
}

// Initialize when the content script loads
initFormsContent();

