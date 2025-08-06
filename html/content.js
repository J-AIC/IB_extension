/**
 * html/content.js
 * 
 * 【概要】
 *  - Chrome拡張のContent Scriptとして、ホストページのDOMにアクセス・操作を行う。
 *  - popup.js から「instructions」が送られてくるので、それを受け取り処理する。
 *  
 * 【instructionsの考え方】
 *  - API から取得したJSONの "instructions" は、以下の形を想定:
 * 
 *    [
 *      {
 *        "action": "highlightXPath",
 *        "params": { "xpath": "...", "color": "#ff0000" }
 *      },
 *      {
 *        "action": "monitorFormField",
 *        "params": { "xpath": "...", "popupCheckboxId": "help_name" }
 *      },
 *      ...
 *    ]
 * 
 *  - "action" が処理内容を表す(例: highlightXPath, monitorFormField等)。
 *  - "params" が各処理の具体的パラメータ(XPathや色、チェックボックスIDなど)。
 * 
 * 【APIとの連携】
 *  - popup.js 側で API を呼び出し -> JSONを取得 -> "instructions" を content.js に送信
 *  - content.js は onMessage で受け取り、action毎に処理を実行
 * 
 * 【機能追加】
 *  1) エクステンション（popup）がアクティブになったら instructions を実行し、各要素をハイライト
 *  2) ポップアップのチェックボックスをONにしたら、ホスト側のハイライト表示を消す
 *  3) チェックボックス切り替えに応じてカウントアップ (n / 6 等)
 *  4) ホスト側フォームに文字を入力すると、対応するチェックボックスがONになる
 *  5) ポップアップ上のチェックボックスは手動でON/OFF可能
 */

/**
 * Basic HTML Controller for content script
 * This is a simplified version that doesn't rely on imports
 */
class BasicHtmlController {
  constructor() {
    this.highlightedElements = new Map();
    this.initialize();
  }

  initialize() {
    // Basic initialization
  }

  highlight(xpath, color = '#ff0000') {
    try {
      const elem = getElementByXPath(xpath);
      if (elem) {
        const highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const originalStyle = { outline: elem.style.outline };
        
        elem.style.outline = `2px solid ${color}`;
        
        this.highlightedElements.set(xpath, { 
          element: elem, 
          originalStyle,
          highlightId
        });
      }
    } catch (error) {
      console.error('Error highlighting element:', error);
    }
  }

  removeHighlight(xpath) {
    try {
      if (this.highlightedElements.has(xpath)) {
        const { element, originalStyle } = this.highlightedElements.get(xpath);
        element.style.outline = originalStyle.outline;
        this.highlightedElements.delete(xpath);
      }
    } catch (error) {
      console.error('Error removing highlight:', error);
    }
  }
}

/**
 * Basic error handling for content script
 */
function handleError(error, options = {}) {
  console.error(`[${options.context || 'Unknown'}] Error:`, error);
  secureLogger.error(`Error in ${options.context || 'Unknown'}:`, error);
}

const ErrorCategory = {
  STORAGE: 'storage',
  UI: 'ui',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
};

secureLogger.log("[html/content.js] Content script loaded");

// Create HTML controller instance
const htmlController = new BasicHtmlController();

// チェックボックスIDとXPathの対応表をグローバルに保持
const monitoredFields = {};

/**
 * popup.js からのメッセージを受け取り、instructionsを処理 or ハイライト解除等を行う
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === "executeInstructions" && Array.isArray(request.instructions)) {
            const url = request.url;

            chrome.storage.local.get(`checkboxStates_${url}`, (result) => {
                try {
                    if (chrome.runtime.lastError) {
                        handleError(
                            new Error(`Storage error: ${chrome.runtime.lastError.message}`),
                            {
                                category: ErrorCategory.STORAGE,
                                context: 'onMessage.executeInstructions.storage',
                                showToUser: false
                            }
                        );
                        sendResponse({ status: "Error", error: chrome.runtime.lastError.message });
                        return;
                    }

                    const savedStates = result[`checkboxStates_${url}`] || {};

                    request.instructions.forEach(instr => {
                        try {
                            if (instr.action === "monitorFormField") {
                                const isChecked = savedStates[instr.params.popupCheckboxId];
                                dispatchInstruction(instr.action, { ...instr.params, initialChecked: isChecked });
                            } else {
                                dispatchInstruction(instr.action, instr.params);
                            }
                        } catch (instrError) {
                            handleError(instrError, {
                                category: ErrorCategory.UI,
                                context: `onMessage.executeInstructions.forEach(${instr.action})`,
                                showToUser: false
                            });
                        }
                    });

                    sendResponse({ status: "Instructions executed" });
                } catch (storageError) {
                    handleError(storageError, {
                        category: ErrorCategory.STORAGE,
                        context: 'onMessage.executeInstructions.storage.callback',
                        showToUser: false
                    });
                    sendResponse({ status: "Error", error: storageError.message });
                }
            });

            return true; // Indicate async response
        }

        if (request.action === "removeHighlightByCheckbox") {
            try {
                const checkboxId = request.checkboxId;
                const xpath = monitoredFields[checkboxId];
                if (xpath) {
                    removeHighlightXPath(xpath);
                } else {
                    secureLogger.log(`No XPath found for checkbox ID: ${checkboxId}`);
                }
                sendResponse({ status: "Highlight removed by checkbox" });
            } catch (removeError) {
                handleError(removeError, {
                    category: ErrorCategory.UI,
                    context: 'onMessage.removeHighlightByCheckbox',
                    showToUser: false
                });
                sendResponse({ status: "Error", error: removeError.message });
            }
            return true; // Indicate async response
        }

        // Handle ping action for content script accessibility check
        if (request.action === 'ping') {
            sendResponse({ success: true });
            return true;
        }

        // Check if this is a form-related action that should be handled by forms/content.js
        const formActions = ['getForms', 'highlightForms', 'removeHighlight', 'applyValues', 'findFormsByLabel', 'findFormsByType', 'findRequiredForms', 'getFormValues'];
        if (formActions.includes(request.action)) {
            // This action should be handled by forms/content.js, not html/content.js
            // We'll just ignore it silently since forms/content.js will handle it
            return false; // Don't send a response, let forms/content.js handle it
        }

        // Check if this is a chat panel action that should be handled by main content.js
        const chatActions = ['toggleChatPanel'];
        if (chatActions.includes(request.action)) {
            // This action should be handled by main content.js, not html/content.js
            // We'll just ignore it silently since main content.js will handle it
            return false; // Don't send a response, let main content.js handle it
        }

        // Unknown action for html/content.js
        handleError(
            new Error(`Unknown message action for html/content.js: ${request.action}`),
            {
                category: ErrorCategory.VALIDATION,
                context: 'onMessage',
                showToUser: false
            }
        );
        sendResponse({ status: "Error", error: `Unknown action for html/content.js: ${request.action}` });
    } catch (error) {
        handleError(error, {
            category: ErrorCategory.UNKNOWN,
            context: 'onMessage',
            showToUser: false
        });
        sendResponse({ status: "Error", error: error.message });
    }

    return true; // Indicate async response
});

/**
 * 指示(action)を振り分けるメイン関数
 */
function dispatchInstruction(action, params) {
    try {
        switch (action) {
            case "highlightXPath":
                highlightXPath(params.xpath, params.color);
                break;

            case "monitorFormField":
                monitorFormField(params.xpath, params.popupCheckboxId, params.initialChecked);
                break;

            default:
                handleError(
                    new Error(`Unknown action: ${action}`),
                    { 
                        category: ErrorCategory.VALIDATION,
                        context: 'dispatchInstruction'
                    }
                );
        }
    } catch (error) {
        handleError(error, {
            category: ErrorCategory.UI,
            context: `dispatchInstruction(${action})`,
            showToUser: false
        });
    }
}

/**
 * 1) 指定のXPathを持つ要素にアウトラインを付けてハイライト
 */
function highlightXPath(xpath, color = "#ff0000") {
    try {
        const elem = getElementByXPath(xpath);
        if (elem) {
            // Create a unique ID for this highlight
            const highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Store original style
            const originalStyle = {
                outline: elem.style.outline
            };
            
            // Apply highlight using the controller
            elem.style.outline = `2px solid ${color}`;
            
            // Store reference to the element and its original style
            htmlController.highlightedElements.set(xpath, { 
                element: elem, 
                originalStyle,
                highlightId
            });
        } else {
            handleError(
                new Error(`Element not found for XPath: ${xpath}`),
                {
                    category: ErrorCategory.UI,
                    context: 'highlightXPath',
                    showToUser: false
                }
            );
        }
    } catch (error) {
        handleError(error, {
            category: ErrorCategory.UI,
            context: 'highlightXPath',
            showToUser: false
        });
    }
}

/**
 * 2) ハイライトを解除する(アウトラインを消す)
 */
function removeHighlightXPath(xpath) {
    try {
        // Check if we have this element in our tracked highlights
        if (htmlController.highlightedElements.has(xpath)) {
            const { element, originalStyle } = htmlController.highlightedElements.get(xpath);
            
            // Restore original style
            element.style.outline = originalStyle.outline;
            
            // Remove from tracked highlights
            htmlController.highlightedElements.delete(xpath);
        } else {
            // Try to find the element directly
            const elem = getElementByXPath(xpath);
            if (elem) {
                elem.style.outline = "none";
            } else {
                // Just log at debug level since this might be called for elements that don't exist anymore
                secureLogger.log(`Element not found for XPath when removing highlight: ${xpath}`);
            }
        }
    } catch (error) {
        handleError(error, {
            category: ErrorCategory.UI,
            context: 'removeHighlightXPath',
            showToUser: false
        });
    }
}

/**
 * 3) 指定のXPathのinput要素等を監視し、
 *    - 入力があればハイライトを非表示＆ポップアップ側チェックをON
 *    - 入力が無ければハイライトを表示＆ポップアップ側チェックをOFF
 */
function monitorFormField(xpath, popupCheckboxId, initialChecked = false) {
    try {
        const elem = getElementByXPath(xpath);
        if (!elem) {
            handleError(
                new Error(`Element not found for XPath: ${xpath}`),
                {
                    category: ErrorCategory.UI,
                    context: 'monitorFormField',
                    showToUser: false
                }
            );
            return;
        }

        // 連動関係を記録
        monitoredFields[popupCheckboxId] = xpath;

        // 初期状態の確認
        const value = elem.value || "";
        const isFilled = value.trim().length > 0;

        // 入力済みまたはチェック済みの場合はハイライトしない
        if (isFilled || initialChecked) {
            removeHighlightXPath(xpath);
            // 入力済みの場合はポップアップ側のチェックボックスもONにする
            if (isFilled) {
                try {
                    chrome.runtime.sendMessage({
                        action: "setPopupCheckbox",
                        checkboxId: popupCheckboxId,
                        checked: true
                    }, response => {
                        if (chrome.runtime.lastError) {
                            handleError(
                                new Error(`Message error: ${chrome.runtime.lastError.message}`),
                                {
                                    category: ErrorCategory.NETWORK,
                                    context: 'monitorFormField.sendMessage',
                                    showToUser: false
                                }
                            );
                        }
                    });
                } catch (msgError) {
                    handleError(msgError, {
                        category: ErrorCategory.NETWORK,
                        context: 'monitorFormField.sendMessage',
                        showToUser: false
                    });
                }
            }
        } else {
            // 未入力かつチェックされていない場合のみハイライト
            highlightXPath(xpath);
        }

        // 入力イベントの監視
        const handler = () => {
            try {
                const currentValue = elem.value || "";
                const isCurrentlyFilled = currentValue.trim().length > 0;

                if (isCurrentlyFilled) {
                    // 入力がある => ハイライト消し、チェックON
                    removeHighlightXPath(xpath);
                    chrome.runtime.sendMessage({
                        action: "setPopupCheckbox",
                        checkboxId: popupCheckboxId,
                        checked: true
                    }, response => {
                        if (chrome.runtime.lastError) {
                            handleError(
                                new Error(`Message error: ${chrome.runtime.lastError.message}`),
                                {
                                    category: ErrorCategory.NETWORK,
                                    context: 'monitorFormField.handler.sendMessage',
                                    showToUser: false
                                }
                            );
                        }
                    });
                } else {
                    // チェックボックスの現在の状態を確認
                    chrome.runtime.sendMessage({
                        action: "getPopupCheckboxState",
                        checkboxId: popupCheckboxId
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            handleError(
                                new Error(`Message error: ${chrome.runtime.lastError.message}`),
                                {
                                    category: ErrorCategory.NETWORK,
                                    context: 'monitorFormField.handler.getState',
                                    showToUser: false
                                }
                            );
                            return;
                        }

                        // チェックされていない場合のみハイライト
                        if (!response.checked) {
                            highlightXPath(xpath);
                        }
                    });
                }
            } catch (handlerError) {
                handleError(handlerError, {
                    category: ErrorCategory.UI,
                    context: 'monitorFormField.handler',
                    showToUser: false
                });
            }
        };

        // イベント登録（input と change の両方を監視）
        elem.addEventListener("input", handler);
        elem.addEventListener("change", handler);
    } catch (error) {
        handleError(error, {
            category: ErrorCategory.UI,
            context: 'monitorFormField',
            showToUser: false
        });
    }
}

/**
 * XPath 文字列から対象要素を取得するヘルパー
 */
function getElementByXPath(xpath) {
    try {
        const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        return result.singleNodeValue;
    } catch (error) {
        handleError(error, {
            category: ErrorCategory.UI,
            context: 'getElementByXPath',
            showToUser: false
        });
        return null;
    }
}