// html/html_load.js
console.log("[html_load.js] script loaded.");

window.addEventListener("DOMContentLoaded", () => {
  const htmlTabPane = document.getElementById("htmlTab");    // <div id="htmlTab">
  const htmlTabButton = document.getElementById("html-tab"); // タブボタン
  let htmlTabLoaded = false;

  if (!htmlTabPane || !htmlTabButton) {
    console.error("[html_load.js] htmlTabPane or htmlTabButton not found");
    return;
  }

  // shown.bs.tab: Bootstrapのタブ表示イベント
  htmlTabButton.addEventListener("shown.bs.tab", async () => {
    // 2回目以降は再ロードしない
    if (htmlTabLoaded) return;

    try {
      // 1) ストレージから Local API のURLとトークンを取得
      const { apiKeys, customSettings } = await chrome.storage.local.get(["apiKeys", "customSettings"]);
      const localToken = apiKeys?.local;
      const localUrl   = customSettings?.local?.url;

      if (!localToken || !localUrl) {
        htmlTabPane.innerHTML = `<p style="color:red;">Local APIの設定がありません</p>`;
        return;
      }

      // 2) アクティブなタブのURLを取得 → このURLをサーバに送る場合
      const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
      const currentUrl   = activeTab?.url || "";

      // 3) widget/html を叩いてHTMLデータを取得
      console.log("[html_load.js] Fetching local /widget/html...");
      const baseUrl = localUrl.replace(/\/+$/, ''); // 末尾スラッシュを除去
      const resp = await fetch(`${baseUrl}/widget/html`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localToken}`
        },
        body: JSON.stringify({ url: currentUrl })
      });

      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }

      const data = await resp.json();
      // 想定: data.status === "success" && data.htmls[0].htmlContent にJSONが入っている
      if (data.status !== "success" || !data.htmls || data.htmls.length === 0) {
        htmlTabPane.innerHTML = `<p>該当データがありません</p>`;
        return;
      }

      // 4) サーバ側に保存されている JSON文字列をパース
      const firstRow = data.htmls[0];
      const rawJsonStr = firstRow.htmlContent;
      const parsed = JSON.parse(rawJsonStr);

      // 5) 実際のHTMLを描画
      htmlTabPane.innerHTML = parsed.html;
      const popupScript = document.createElement('script');
      popupScript.type = 'text/javascript'; // もしくは 'module'
      popupScript.src = chrome.runtime.getURL('html/popup.js');
      htmlTabPane.appendChild(popupScript);
      popupScript.onload = () => {
        // たとえば下記のように同じ関数を呼ぶか、
        // あるいは setupPopupCheckboxEvents(...) を再定義する
        setupPopupCheckboxEvents(window.currentUrl);
      };





      // 6) instructions があれば content script に送信
      if (Array.isArray(parsed.instructions)) {
        chrome.tabs.sendMessage(activeTab.id, {
          action: "executeInstructions",
          instructions: parsed.instructions,
          url: currentUrl
        });
      }

      // 必要に応じて 動的CSSやJSをさらに読み込む場合はここで

      htmlTabLoaded = true;
      console.log("[html_load.js] /widget/html loaded successfully.");

    } catch (err) {
      console.error("[html_load.js] Error loading widget/html:", err);
      htmlTabPane.innerHTML = `<p style="color:red;">HTMLの読み込みに失敗しました: ${err.message}</p>`;
    }
  });
});
