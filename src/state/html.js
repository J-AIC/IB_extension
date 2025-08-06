/**
 * HTML表示と操作の状態管理モジュール
 * アクションタイプ、アクションクリエーター、リデューサー、セレクターを含む
 */

import { createAction, createReducer, createSelector } from '../stateManagement.js';

/**
 * アクションタイプ
 */
export const ActionTypes = {
    INITIALIZE: 'html/INITIALIZE',
    REGISTER_TEMPLATE: 'html/REGISTER_TEMPLATE',
    RENDER_ELEMENT: 'html/RENDER_ELEMENT',
    REMOVE_ELEMENT: 'html/REMOVE_ELEMENT',
    ADD_OVERLAY: 'html/ADD_OVERLAY',
    REMOVE_OVERLAY: 'html/REMOVE_OVERLAY',
    REMOVE_ALL_OVERLAYS: 'html/REMOVE_ALL_OVERLAYS',
    SET_DEBUG: 'html/SET_DEBUG'
};

/**
 * アクションクリエーター
 */
export const initialize = createAction(ActionTypes.INITIALIZE);
export const registerTemplate = createAction(ActionTypes.REGISTER_TEMPLATE);
export const renderElement = createAction(ActionTypes.RENDER_ELEMENT);
export const removeElement = createAction(ActionTypes.REMOVE_ELEMENT);
export const addOverlay = createAction(ActionTypes.ADD_OVERLAY);
export const removeOverlay = createAction(ActionTypes.REMOVE_OVERLAY);
export const removeAllOverlays = createAction(ActionTypes.REMOVE_ALL_OVERLAYS);
export const setDebug = createAction(ActionTypes.SET_DEBUG);

/**
 * 初期状態
 */
const initialState = {
    templates: {},
    renderedElements: {},
    activeOverlays: [],
    initialized: false,
    debug: true
};

/**
 * デフォルトテンプレート
 */
const defaultTemplates = {
    tooltip: `
      <div class="ib-tooltip" role="tooltip">
        <div class="ib-tooltip-arrow"></div>
        <div class="ib-tooltip-inner"></div>
      </div>
    `,
    modal: `
      <div class="ib-modal-backdrop"></div>
      <div class="ib-modal" role="dialog" aria-modal="true">
        <div class="ib-modal-dialog">
          <div class="ib-modal-content">
            <div class="ib-modal-header">
              <h5 class="ib-modal-title"></h5>
              <button type="button" class="ib-close" aria-label="Close">&times;</button>
            </div>
            <div class="ib-modal-body"></div>
            <div class="ib-modal-footer"></div>
          </div>
        </div>
      </div>
    `,
    notification: `
      <div class="ib-notification">
        <div class="ib-notification-icon"></div>
        <div class="ib-notification-content">
          <div class="ib-notification-title"></div>
          <div class="ib-notification-message"></div>
        </div>
        <button type="button" class="ib-notification-close" aria-label="Close">&times;</button>
      </div>
    `,
    overlay: `
      <div class="ib-overlay">
        <div class="ib-overlay-content"></div>
      </div>
    `,
    popover: `
      <div class="ib-popover" role="tooltip">
        <div class="ib-popover-arrow"></div>
        <h3 class="ib-popover-header"></h3>
        <div class="ib-popover-body"></div>
      </div>
    `
};

/**
 * リデューサー
 */
export const reducer = createReducer(initialState, {
    [ActionTypes.INITIALIZE]: (state) => {
        if (state.initialized) {
            return state;
        }
        
        return {
            ...state,
            initialized: true,
            templates: { ...state.templates, ...defaultTemplates }
        };
    },
    [ActionTypes.REGISTER_TEMPLATE]: (state, action) => {
        const { name, html } = action.payload;
        
        return {
            ...state,
            templates: {
                ...state.templates,
                [name]: html.trim()
            }
        };
    },
    [ActionTypes.RENDER_ELEMENT]: (state, action) => {
        const { id, element, templateName, data } = action.payload;
        
        return {
            ...state,
            renderedElements: {
                ...state.renderedElements,
                [id]: { element, templateName, data }
            }
        };
    },
    [ActionTypes.REMOVE_ELEMENT]: (state, action) => {
        const id = action.payload;
        const { [id]: removed, ...remainingElements } = state.renderedElements;
        
        return {
            ...state,
            renderedElements: remainingElements
        };
    },
    [ActionTypes.ADD_OVERLAY]: (state, action) => {
        const { element, options } = action.payload;
        
        return {
            ...state,
            activeOverlays: [...state.activeOverlays, { element, options }]
        };
    },
    [ActionTypes.REMOVE_OVERLAY]: (state, action) => {
        const overlayElement = action.payload;
        
        return {
            ...state,
            activeOverlays: state.activeOverlays.filter(overlay => overlay.element !== overlayElement)
        };
    },
    [ActionTypes.REMOVE_ALL_OVERLAYS]: (state) => ({
        ...state,
        activeOverlays: []
    }),
    [ActionTypes.SET_DEBUG]: (state, action) => ({
        ...state,
        debug: action.payload
    })
});

/**
 * セレクター
 */
export const selectTemplates = createSelector(state => state.html.templates);
export const selectRenderedElements = createSelector(state => state.html.renderedElements);
export const selectActiveOverlays = createSelector(state => state.html.activeOverlays);
export const selectInitialized = createSelector(state => state.html.initialized);
export const selectDebug = createSelector(state => state.html.debug);

export const selectTemplate = (name) => createSelector(state => state.html.templates[name] || null);

/**
 * ヘルパー関数
 */
const debugLog = (debug, section, message, data = null) => {
    if (!debug) return;
    
    const log = `[HtmlModel][${section}] ${message}`;
    console.log(log);
    
    if (data) {
        console.log('Data:', data);
    }
};

const renderTemplateWithData = (template, data = {}) => {
    if (!template) {
        throw new Error('Template not found');
    }
    
    let rendered = template;
    Object.entries(data).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        rendered = rendered.replace(regex, value);
    });
    
    return rendered;
};

const createElementFromHtml = (html) => {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
};

const positionElement = (element, target, position) => {
    const targetRect = target.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    let top, left;
    
    switch (position) {
        case 'top':
            top = targetRect.top - elementRect.height;
            left = targetRect.left + (targetRect.width / 2) - (elementRect.width / 2);
            break;
        case 'right':
            top = targetRect.top + (targetRect.height / 2) - (elementRect.height / 2);
            left = targetRect.right;
            break;
        case 'bottom':
            top = targetRect.bottom;
            left = targetRect.left + (targetRect.width / 2) - (elementRect.width / 2);
            break;
        case 'left':
            top = targetRect.top + (targetRect.height / 2) - (elementRect.height / 2);
            left = targetRect.left - elementRect.width;
            break;
    }
    
    top += window.scrollY;
    left += window.scrollX;
    
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
};

/**
 * サンクアクション
 */
export const initializeHtml = () => (dispatch, getState) => {
    const state = getState();
    
    if (state.html.initialized) {
        return;
    }
    
    dispatch(initialize());
};

export const registerTemplateThunk = (name, html) => (dispatch, getState) => {
    const state = getState();
    const debug = state.html.debug;
    
    dispatch(registerTemplate({ name, html }));
    
    debugLog(debug, 'registerTemplate', `Registered template: ${name}`);
};

export const renderElementThunk = (templateName, data = {}, targetSelector = 'body', position = 'beforeend') => (dispatch, getState) => {
    const state = getState();
    const debug = state.html.debug;
    const template = state.html.templates[templateName];
    
    if (!template) {
        throw new Error(`Template not found: ${templateName}`);
    }
    
    const renderedHtml = renderTemplateWithData(template, data);
    const element = createElementFromHtml(renderedHtml);
    
    const target = document.querySelector(targetSelector);
    if (!target) {
        throw new Error(`Target element not found: ${targetSelector}`);
    }
    
    target.insertAdjacentElement(position, element);
    
    const id = `${templateName}-${Date.now()}`;
    
    element.setAttribute('data-ib-id', id);
    
    dispatch(renderElement({ id, element, templateName, data }));
    
    debugLog(debug, 'renderElement', `Rendered element: ${templateName}`, { id, element });
    
    return element;
};

export const removeElementThunk = (id) => (dispatch, getState) => {
    const state = getState();
    const debug = state.html.debug;
    const elementData = state.html.renderedElements[id];
    
    if (elementData) {
        const { element } = elementData;
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
        
        dispatch(removeElement(id));
        
        debugLog(debug, 'removeElement', `Removed element: ${id}`);
    }
};

export const createOverlayThunk = (options = {}) => (dispatch, getState) => {
    const state = getState();
    const debug = state.html.debug;
    
    const defaultOptions = {
        content: '',
        className: '',
        closeOnClick: true,
        closeOnEscape: true,
        zIndex: 1000,
        duration: 300
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    const overlay = createElementFromHtml(`
        <div class="ib-overlay ${mergedOptions.className}" style="z-index: ${mergedOptions.zIndex}">
            <div class="ib-overlay-content">${mergedOptions.content}</div>
        </div>
    `);
    
    document.body.appendChild(overlay);
    
    dispatch(addOverlay({ element: overlay, options: mergedOptions }));
    
    if (mergedOptions.closeOnClick) {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                dispatch(removeOverlayThunk(overlay));
            }
        });
    }
    
    if (mergedOptions.closeOnEscape) {
        const escapeHandler = (event) => {
            if (event.key === 'Escape') {
                dispatch(removeOverlayThunk(overlay));
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    setTimeout(() => {
        overlay.classList.add('ib-overlay-visible');
    }, 10);
    
    debugLog(debug, 'createOverlay', 'Created overlay', { overlay, options: mergedOptions });
    
    return overlay;
};

export const removeOverlayThunk = (overlay) => (dispatch, getState) => {
    const state = getState();
    const debug = state.html.debug;
    const overlayData = state.html.activeOverlays.find(data => data.element === overlay);
    
    if (overlayData) {
        const { element, options } = overlayData;
        
        element.classList.remove('ib-overlay-visible');
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            
            dispatch(removeOverlay(element));
            
            debugLog(debug, 'removeOverlay', 'Removed overlay', { element });
        }, options.duration);
    }
};

export const removeAllOverlaysThunk = () => (dispatch, getState) => {
    const state = getState();
    const debug = state.html.debug;
    const activeOverlays = state.html.activeOverlays;
    
    activeOverlays.forEach(({ element }) => {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });
    
    dispatch(removeAllOverlays());
    
    debugLog(debug, 'removeAllOverlays', 'Removed all overlays');
};

export const createTooltipThunk = (target, options = {}) => (dispatch, getState) => {
    const state = getState();
    const debug = state.html.debug;
    
    const defaultOptions = {
        content: '',
        position: 'top',
        className: '',
        duration: 200,
        showDelay: 200,
        hideDelay: 200
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    const tooltip = createElementFromHtml(`
        <div class="ib-tooltip ib-tooltip-${mergedOptions.position} ${mergedOptions.className}">
            <div class="ib-tooltip-arrow"></div>
            <div class="ib-tooltip-inner">${mergedOptions.content}</div>
        </div>
    `);
    
    document.body.appendChild(tooltip);
    
    positionElement(tooltip, target, mergedOptions.position);
    
    setTimeout(() => {
        tooltip.classList.add('ib-tooltip-visible');
    }, mergedOptions.showDelay);
    
    const id = `tooltip-${Date.now()}`;
    
    tooltip.setAttribute('data-ib-id', id);
    
    dispatch(renderElement({
        id,
        element: tooltip,
        templateName: 'tooltip',
        data: { target, options: mergedOptions }
    }));
    
    debugLog(debug, 'createTooltip', 'Created tooltip', { tooltip, target, options: mergedOptions });
    
    return tooltip;
};

export const removeTooltipThunk = (tooltip) => (dispatch, getState) => {
    const state = getState();
    const debug = state.html.debug;
    const renderedElements = state.html.renderedElements;
    
    let tooltipId = null;
    for (const id in renderedElements) {
        if (renderedElements[id].element === tooltip) {
            tooltipId = id;
            break;
        }
    }
    
    if (tooltipId) {
        const tooltipData = renderedElements[tooltipId];
        const { options } = tooltipData.data;
        
        tooltip.classList.remove('ib-tooltip-visible');
        
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
            
            dispatch(removeElement(tooltipId));
            
            debugLog(debug, 'removeTooltip', 'Removed tooltip', { tooltipId });
        }, options.duration);
    }
};