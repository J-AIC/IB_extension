// html/popup.js
const containerRoot = document.getElementById('htmlTab');
// メッセージリスナーを追加
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setPopupCheckbox") {
    const checkbox = document.getElementById(request.checkboxId);
    if (checkbox) {
      checkbox.checked = request.checked;
      updateCheckedCount();
      // 状態を保存
      saveCheckboxStates(window.currentUrl);  // currentUrlをグローバルに保存しておく必要があります
    }
    sendResponse({ status: "success" });
    return true;
  }

  if (request.action === "getPopupCheckboxState") {
    const checkbox = document.getElementById(request.checkboxId);
    sendResponse({ checked: checkbox ? checkbox.checked : false });
    return true;
  }
});


// DOMContentLoaded イベントハンドラの冒頭で currentUrl をグローバルに保存
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    window.currentUrl = tab.url;  // グローバルに保存
  }
  const statusArea = document.getElementById("statusArea");
  const apiContent = document.getElementById("apiContent");

  statusArea.textContent = "Loading...";

  try {
    // 1) アクティブタブのURLを取得
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      statusArea.innerHTML = "<span class='error'>アクティブタブのURLが取得できません</span>";
      return;
    }

    const currentUrl = tab.url;

    // 2) 拡張機能のストレージから local API のURLとトークンを取得
    const { apiProvider, apiKeys, customSettings } = await chrome.storage.local.get([
      "apiProvider",
      "apiKeys",
      "customSettings"
    ]);

    // 今回は "local" を使うケース想定 (apiProviderが local でなければスキップなど)
    if (apiProvider !== "local") {
      statusArea.textContent = "Local APIが選択されていません (apiProviderは " + apiProvider + ")";
      return;
    }

    if (!apiKeys?.local || !customSettings?.local?.url) {
      statusArea.textContent = "Local APIの設定がありません";
      return;
    }

    // fetch先のベースURLとトークン
    const baseUrl = customSettings.local.url.replace(/\/+$/, ""); // 末尾スラッシュ除去
    const token   = apiKeys.local;

    // 3) local API呼び出し
    const resp = await fetch(`${baseUrl}/widget/html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // ストレージから取得したトークン
      },
      body: JSON.stringify({ url: currentUrl })
    });

    const data = await resp.json();
    if (!resp.ok || data.status !== "success") {
      statusArea.innerHTML = `<span class='error'>Error: ${data.message || 'Unknown'}</span>`;
      return;
    }

    if (!data.htmls || data.htmls.length === 0) {
      statusArea.textContent = "該当データなし (このURLに対応するデータがありません)";
      return;
    }

    // 4) DBにある JSON文字列を取得
    const firstRow = data.htmls[0];
    const rawJsonStr = firstRow.htmlContent; 
    const parsed = JSON.parse(rawJsonStr);

    // 5) popup.html 上に HTML を描画
    apiContent.innerHTML = parsed.html;

    // 6) 保存されたチェックボックスの状態を復元
    await restoreCheckboxStates(currentUrl);

    // 7) instructions を content script に送信
    if (Array.isArray(parsed.instructions)) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id != null) {
        chrome.tabs.sendMessage(activeTab.id, {
          action: "executeInstructions",
          instructions: parsed.instructions,
          url: currentUrl
        });
      }
    }

    // 8) ポップアップ内のチェックボックスのイベントを設定
    setupPopupCheckboxEvents(currentUrl);

    statusArea.textContent = "HTML & instructionsを取得しました。";
  } catch (err) {
    console.error(err);
    statusArea.innerHTML = `<span class='error'>通信エラー: ${err.message}</span>`;
  }
});


// チェックボックスの状態を保存
async function saveCheckboxStates(url) {
  const checkboxes = document.querySelectorAll(".help-checkbox");
  const states = {};
  
  checkboxes.forEach(chk => {
    states[chk.id] = chk.checked;
  });

  await chrome.storage.local.set({
    [`checkboxStates_${url}`]: states
  });
}

// チェックボックスの状態を復元
async function restoreCheckboxStates(url) {
  const result = await chrome.storage.local.get(`checkboxStates_${url}`);
  const states = result[`checkboxStates_${url}`];
  
  if (states) {
    const checkboxes = document.querySelectorAll(".help-checkbox");
    checkboxes.forEach(chk => {
      if (states.hasOwnProperty(chk.id)) {
        chk.checked = states[chk.id];
      }
    });
    updateCheckedCount();
  }
}

function setupPopupCheckboxEvents(url) {
  const checkboxes = document.querySelectorAll(".help-checkbox");
  checkboxes.forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const checkboxId = e.target.id;
      const isChecked = e.target.checked;

      if (isChecked) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id != null) {
          // チェックされた→ハイライトを消すよう content script に通知
          chrome.tabs.sendMessage(tab.id, {
            action: "removeHighlightByCheckbox",
            checkboxId: checkboxId
          });
        }
      }

      // 状態を保存
      await saveCheckboxStates(url);
      updateCheckedCount();
    });
  });

  updateCheckedCount();
}

function updateCheckedCount() {
  const checkboxes = document.querySelectorAll(".help-checkbox");
  let checkedCount = 0;
  checkboxes.forEach(chk => {
    if (chk.checked) checkedCount++;
  });

  const checkedCountEl = document.getElementById("checkedCount");
  if (checkedCountEl) {
    checkedCountEl.textContent = checkedCount;
  }
}
