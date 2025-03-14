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

console.log("[html/content.js] Content script loaded");
// チェックボックスIDとXPathの対応表をグローバルに保持
const monitoredFields = {};

/**
 * popup.js からのメッセージを受け取り、instructionsを処理 or ハイライト解除等を行う
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "executeInstructions" && Array.isArray(request.instructions)) {
        const url = request.url;

        chrome.storage.local.get(`checkboxStates_${url}`, (result) => {
            const savedStates = result[`checkboxStates_${url}`] || {};

            request.instructions.forEach(instr => {
                if (instr.action === "monitorFormField") {
                    const isChecked = savedStates[instr.params.popupCheckboxId];
                    dispatchInstruction(instr.action, { ...instr.params, initialChecked: isChecked });
                } else {
                    dispatchInstruction(instr.action, instr.params);
                }
            });
        });

        sendResponse({ status: "Instructions executed" });
        return;
    }

    if (request.action === "removeHighlightByCheckbox") {
        const checkboxId = request.checkboxId;
        const xpath = monitoredFields[checkboxId];
        if (xpath) {
            removeHighlightXPath(xpath);
        }
        sendResponse({ status: "Highlight removed by checkbox" });
        return;
    }
});

/**
 * 指示(action)を振り分けるメイン関数
 */
function dispatchInstruction(action, params) {
    switch (action) {
        case "highlightXPath":
            highlightXPath(params.xpath, params.color);
            break;

        case "monitorFormField":
            monitorFormField(params.xpath, params.popupCheckboxId, params.initialChecked);
            break;

        default:
            console.warn("Unknown action:", action);
    }
}

/**
 * 1) 指定のXPathを持つ要素にアウトラインを付けてハイライト
 */
function highlightXPath(xpath, color = "#ff0000") {
    const elem = getElementByXPath(xpath);
    if (elem) {
        elem.style.outline = `2px solid ${color}`;
    }
}

/**
 * 2) ハイライトを解除する(アウトラインを消す)
 */
function removeHighlightXPath(xpath) {
    const elem = getElementByXPath(xpath);
    if (elem) {
        elem.style.outline = "none";
    }
}

/**
 * 3) 指定のXPathのinput要素等を監視し、
 *    - 入力があればハイライトを非表示＆ポップアップ側チェックをON
 *    - 入力が無ければハイライトを表示＆ポップアップ側チェックをOFF
 */

function monitorFormField(xpath, popupCheckboxId, initialChecked = false) {
    const elem = getElementByXPath(xpath);
    if (!elem) return;

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
            chrome.runtime.sendMessage({
                action: "setPopupCheckbox",
                checkboxId: popupCheckboxId,
                checked: true
            });
        }
    } else {
        // 未入力かつチェックされていない場合のみハイライト
        highlightXPath(xpath);
    }

    // 入力イベントの監視
    const handler = () => {
        const currentValue = elem.value || "";
        const isCurrentlyFilled = currentValue.trim().length > 0;

        if (isCurrentlyFilled) {
            // 入力がある => ハイライト消し、チェックON
            removeHighlightXPath(xpath);
            chrome.runtime.sendMessage({
                action: "setPopupCheckbox",
                checkboxId: popupCheckboxId,
                checked: true
            });
        } else {
            // チェックボックスの現在の状態を確認
            chrome.runtime.sendMessage({
                action: "getPopupCheckboxState",
                checkboxId: popupCheckboxId
            }, (response) => {
                // チェックされていない場合のみハイライト
                if (!response.checked) {
                    highlightXPath(xpath);
                }
            });
        }
    };

    // イベント登録（input と change の両方を監視）
    elem.addEventListener("input", handler);
    elem.addEventListener("change", handler);
}

/**
 * XPath 文字列から対象要素を取得するヘルパー
 */
function getElementByXPath(xpath) {
    const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    );
    return result.singleNodeValue;
}
