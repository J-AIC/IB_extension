// forms/form_load.js
console.log('[form_load.js] script loaded.');

window.addEventListener('DOMContentLoaded', () => {
  const formTabPane = document.getElementById('formTab');  // chat.html 側の <div id="formTab">
  const formTabButton = document.getElementById('form-tab'); // chat.html 側のタブボタン
  let formTabLoaded = false;

  if (!formTabPane || !formTabButton) {
    console.error('[form_load.js] formTabPane or formTabButton not found');
    return;
  }

  formTabButton.addEventListener('shown.bs.tab', async () => {
    // 2回目以降は再ロードしない
    if (formTabLoaded) return;

    try {
      console.log('[form_load.js] Fetching popup.html...');
      // 1) popup.html を fetch
      const resp = await fetch('forms/popup.html');
      const htmlText = await resp.text();

      // 2) HTMLパースして body のみ抽出
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      // formTabPaneは chat.html 内の <div id="formTab">
      formTabPane.innerHTML = doc.body.innerHTML;

      console.log('[form_load.js] Inserting dynamic CSS...');
      // ============================
      // (A) CSS を動的に読み込み
      // ============================
      // 例: 追加で読みたいCSSファイルを配列で
      const cssFiles = [
        'styles.css',        // ルート直下
        'forms/styles.css'   // formsフォルダ内
      ];
      cssFiles.forEach(file => {
        const linkEl = document.createElement('link');
        linkEl.rel = 'stylesheet';
        linkEl.href = chrome.runtime.getURL(file);
        document.head.appendChild(linkEl);
      });

      console.log('[form_load.js] Inserting dynamic scripts (JS) ...');
      // ============================
      // (B) JSライブラリを動的に読み込み
      // ============================
      // 順番があるなら1つずつ await しても良い
      // ここでは例示のため順次appendのみ

      const scriptList = [
        'assets/js/Readability.js',
        'assets/js/pdf.min.js',
        'assets/js/pdf.worker.min.js',
        'forms/web_list.js',
        // 最後に popup.js (type=module)
      ];

      // 依存関係があるかもしれないので順番にロード
      for (let i = 0; i < scriptList.length; i++) {
        const file = scriptList[i];
        const scriptEl = document.createElement('script');

        if (file.endsWith('.js') && file.includes('popup')) {
          // popup.js なら module にする(例)
          scriptEl.type = 'module';
        } else {
          scriptEl.type = 'text/javascript';
        }

        scriptEl.src = chrome.runtime.getURL(file);
        formTabPane.appendChild(scriptEl);

        // "popup.js" が含まれていれば type="module"
      }

      // (C) 最後に popup.js を追加 (もしリスト順でなく明示したいならこう書く)
      const popupScript = document.createElement('script');
      popupScript.type = 'module';
      popupScript.src = chrome.runtime.getURL('forms/popup.js');
      formTabPane.appendChild(popupScript);

      formTabLoaded = true;
      console.log('[form_load.js] popup.html + CSS/JS loaded successfully.');
    } catch (err) {
      console.error('[form_load.js] Error loading popup.html:', err);
      formTabPane.innerHTML = '<p style="color:red;">フォームUIの読み込みに失敗しました</p>';
    }
  });
});
