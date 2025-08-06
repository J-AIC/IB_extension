/**
 * フォーム検出と操作の状態管理モジュール
 * アクションタイプ、アクションクリエーター、リデューサー、セレクターを含む
 */

import { createAction, createReducer, createSelector } from '../stateManagement.js';

/**
 * アクションタイプ
 */
export const ActionTypes = {
    INITIALIZE: 'forms/INITIALIZE',
    COLLECT_FORMS: 'forms/COLLECT_FORMS',
    SET_FORMS: 'forms/SET_FORMS',
    HIGHLIGHT_FORMS: 'forms/HIGHLIGHT_FORMS',
    REMOVE_HIGHLIGHT: 'forms/REMOVE_HIGHLIGHT',
    SET_DEBUG: 'forms/SET_DEBUG'
};

/**
 * アクションクリエーター
 */
export const initialize = createAction(ActionTypes.INITIALIZE);
export const collectForms = createAction(ActionTypes.COLLECT_FORMS);
export const setForms = createAction(ActionTypes.SET_FORMS);
export const highlightForms = createAction(ActionTypes.HIGHLIGHT_FORMS);
export const removeHighlight = createAction(ActionTypes.REMOVE_HIGHLIGHT);
export const setDebug = createAction(ActionTypes.SET_DEBUG);

/**
 * 初期状態
 */
const initialState = {
    forms: {},
    initialized: false,
    debug: true,
    highlightedElements: []
};

/**
 * リデューサー
 */
export const reducer = createReducer(initialState, {
    [ActionTypes.INITIALIZE]: (state) => ({
        ...state,
        initialized: true
    }),
    [ActionTypes.SET_FORMS]: (state, action) => ({
        ...state,
        forms: action.payload
    }),
    [ActionTypes.HIGHLIGHT_FORMS]: (state, action) => ({
        ...state,
        highlightedElements: action.payload
    }),
    [ActionTypes.REMOVE_HIGHLIGHT]: (state) => ({
        ...state,
        highlightedElements: []
    }),
    [ActionTypes.SET_DEBUG]: (state, action) => ({
        ...state,
        debug: action.payload
    })
});

/**
 * セレクター
 */
export const selectForms = createSelector(state => state.forms.forms);
export const selectInitialized = createSelector(state => state.forms.initialized);
export const selectDebug = createSelector(state => state.forms.debug);
export const selectHighlightedElements = createSelector(state => state.forms.highlightedElements);

/**
 * ヘルパー関数
 */
const isElementVisible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.offsetParent !== null &&
           element.getBoundingClientRect().height > 0 &&
           element.getBoundingClientRect().width > 0;
};

const findLabel = (element) => {
    let label = '';
    try {
        if (element.id) {
            const escapedId = CSS.escape(element.id);
            const labelElement = document.querySelector(`label[for="${escapedId}"]`);
            if (labelElement) {
                label = labelElement.textContent.trim();
            }
        }
        
        if (!label && element.parentElement?.tagName === 'LABEL') {
            label = element.parentElement.textContent.trim();
            if (element.type === 'checkbox' || element.type === 'radio') {
                label = label.replace(element.value || '', '').trim();
            }
        }
        
        if (!label) {
            const previousElement = element.previousElementSibling;
            if (previousElement &&
                !['INPUT','SELECT','TEXTAREA'].includes(previousElement.tagName)) {
                label = previousElement.textContent.trim();
            }
        }
    } catch (error) {
        console.error('Error finding label', error);
    }
    
    return label;
};

const extractFormData = (element, index, forcedType = null) => {
    try {
        const label = findLabel(element);
        
        const fieldContainer = element.closest('[class*="field-"]');
        let fieldIdNumber = '';
        if (fieldContainer) {
            const match = fieldContainer.className.match(/field-(\d+)/);
            if (match) {
                fieldIdNumber = match[1];
            }
        }
        
        const formData = {
            id: element.id || element.name || `form-element-${index}`,
            tagName: element.tagName.toLowerCase(),
            type: forcedType || (element.type || element.tagName.toLowerCase()),
            name: element.name || '',
            label: label || '',
            placeholder: element.placeholder || '',
            required: element.required || false,
            kintoneFieldId: fieldIdNumber
        };
        
        if (formData.type === 'select' || formData.type === 'select-multiple') {
            const selectEl = element;
            formData.options = Array.from(selectEl.options).map(opt => ({
                value: opt.value,
                label: opt.text,
                selected: opt.selected
            }));
        } else {
            formData.value = element.value || '';
        }
        
        return formData;
    } catch (error) {
        console.error('Error extracting form data', error);
        return null;
    }
};

/**
 * サンクアクション
 */
export const initializeForms = () => (dispatch, getState) => {
    const state = getState();
    
    if (state.forms.initialized) {
        return;
    }
    
    dispatch(initialize());
    dispatch(collectFormsFromPage());
};

export const collectFormsFromPage = () => (dispatch, getState) => {
    const state = getState();
    const debug = state.forms.debug;
    
    if (debug) {
        console.log('[FormObserver][collectForms] Starting form collection');
    }
    
    const formElements = document.querySelectorAll('input, select, textarea');
    
    if (debug) {
        console.log(`[FormObserver][collectForms] Found ${formElements.length} total form elements`);
    }
    
    const forms = {};
    
    const radioCheckboxGroupMap = new Map();
    const individualElements = [];
    
    formElements.forEach((el, index) => {
        if (!isElementVisible(el)) return;
        
        const tagName = el.tagName.toLowerCase();
        let type = (el.type || tagName).toLowerCase();
        
        if (type === 'radio' || type === 'checkbox') {
            const groupKey = el.name || el.id || `group-${index}`;
            if (!radioCheckboxGroupMap.has(groupKey)) {
                radioCheckboxGroupMap.set(groupKey, {
                    id: groupKey,
                    tagName: 'input-group',
                    type: type,
                    name: el.name || el.id || '',
                    label: '',
                    options: []
                });
            }
            
            const groupData = radioCheckboxGroupMap.get(groupKey);
            if (!groupData.label) {
                groupData.label = findLabel(el);
            }
            
            groupData.options.push({
                value: el.value,
                label: findLabel(el) || el.value,
                checked: el.checked
            });
        } else {
            individualElements.push({ el, index });
        }
    });
    
    individualElements.forEach(({ el, index }) => {
        const tagName = el.tagName.toLowerCase();
        let type = (el.type || tagName).toLowerCase();
        
        if (tagName === 'select') {
            type = el.multiple ? 'select-multiple' : 'select';
        }
        
        const formData = extractFormData(el, index, type);
        if (formData?.id) {
            forms[formData.id] = formData;
        }
    });
    
    radioCheckboxGroupMap.forEach((groupData, groupKey) => {
        forms[groupKey] = groupData;
    });
    
    dispatch(setForms(forms));
    
    if (debug) {
        console.log(`[FormObserver][collectForms] Collected ${Object.keys(forms).length} visible form items/groups`);
    }
};

export const highlightFormElements = (formIds, options = {}) => (dispatch, getState) => {
    const state = getState();
    const debug = state.forms.debug;
    const forms = state.forms.forms;
    
    if (debug) {
        console.log(`[FormObserver][highlight] Highlighting ${formIds.length} forms`, formIds);
    }
    
    const defaultOptions = {
        color: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderColor: '#4CAF50',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '4px',
        padding: '2px',
        transition: 'all 0.3s ease',
        pulseAnimation: true
    };
    
    const highlightOptions = { ...defaultOptions, ...options };
    
    dispatch(removeHighlightElements());
    
    if (highlightOptions.pulseAnimation) {
        createPulseAnimationStyle();
    }
    
    const highlightedElements = [];
    
    formIds.forEach(id => {
        const formData = forms[id];
        if (!formData) {
            if (debug) {
                console.log(`[FormObserver][highlight] Form with ID ${id} not found`);
            }
            return;
        }
        
        if (formData.type === 'radio' || formData.type === 'checkbox') {
            const groupName = formData.name || formData.id;
            const escapedName = CSS.escape(groupName);
            const inputs = document.querySelectorAll(`input[name="${escapedName}"]`);
            
            inputs.forEach(inputEl => {
                const originalStyles = highlightElement(inputEl, highlightOptions);
                highlightedElements.push({
                    element: inputEl,
                    originalStyles
                });
            });
        } else {
            const element = document.getElementById(id) || document.getElementsByName(id)[0];
            if (element) {
                const originalStyles = highlightElement(element, highlightOptions);
                highlightedElements.push({
                    element,
                    originalStyles
                });
            } else if (debug) {
                console.log(`[FormObserver][highlight] Element with ID ${id} not found in DOM`);
            }
        }
    });
    
    dispatch(highlightForms(highlightedElements));
};

export const removeHighlightElements = () => (dispatch, getState) => {
    const state = getState();
    const debug = state.forms.debug;
    const highlightedElements = state.forms.highlightedElements;
    
    if (debug) {
        console.log('[FormObserver][removeHighlight] Removing all highlights');
    }
    
    highlightedElements.forEach(({ element, originalStyles }) => {
        Object.entries(originalStyles).forEach(([prop, value]) => {
            element.style[prop] = value;
        });
        
        element.classList.remove('form-highlight-pulse');
    });
    
    dispatch(removeHighlight());
};

/**
 * パルスアニメーションスタイルを作成するヘルパー関数
 */
const createPulseAnimationStyle = () => {
    if (document.getElementById('form-highlight-pulse-animation')) {
        return;
    }
    
    const styleEl = document.createElement('style');
    styleEl.id = 'form-highlight-pulse-animation';
    styleEl.textContent = `
        @keyframes formHighlightPulse {
            0% {
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
            }
            70% {
                box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
            }
        }
        
        .form-highlight-pulse {
            animation: formHighlightPulse 2s infinite;
        }
    `;
    
    document.head.appendChild(styleEl);
};

/**
 * 要素をハイライトするヘルパー関数
 */
const highlightElement = (element, options) => {
    const originalStyles = {
        outline: element.style.outline,
        outlineOffset: element.style.outlineOffset,
        backgroundColor: element.style.backgroundColor,
        borderColor: element.style.borderColor,
        borderWidth: element.style.borderWidth,
        borderStyle: element.style.borderStyle,
        borderRadius: element.style.borderRadius,
        padding: element.style.padding,
        transition: element.style.transition
    };
    
    element.style.outline = `${options.borderWidth} ${options.borderStyle} ${options.borderColor}`;
    element.style.outlineOffset = '2px';
    element.style.backgroundColor = options.backgroundColor;
    element.style.borderColor = options.borderColor;
    element.style.borderWidth = options.borderWidth;
    element.style.borderStyle = options.borderStyle;
    element.style.borderRadius = options.borderRadius;
    element.style.padding = options.padding;
    element.style.transition = options.transition;
    
    if (options.pulseAnimation) {
        element.classList.add('form-highlight-pulse');
    }
    
    return originalStyles;
};