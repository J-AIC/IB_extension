//----------------------
// forms/web_list.js
// Webページの内容を抽出・管理するクラス
//----------------------
class WebListManager {
  constructor() {
    this.STATE_KEY = 'web_list_state';
    this.MAX_PAGES = 5; // TODO: Make configurable via settings
    this.pages = [];
    this.container = document.getElementById('webPagesContainer');
    this.modal = null;
    this.processingStatusElement = null; // Cache status element
    this.initializeModal();
  }

  // 初期化処理
  // モーダルの初期化
  initializeModal() {
    // モーダル要素の作成
    this.modal = document.createElement('div');
    this.modal.className = 'fixed inset-0 z-50 flex items-center justify-center hidden';
    this.modal.id = 'pageContentModal';
    
    // モーダルの内容
    this.modal.innerHTML = `
      <div class="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm"></div>
      <div class="bg-white rounded-lg shadow-xl w-11/12 max-w-2xl z-50 relative">
        <div class="border-b p-4 flex justify-between items-center">
          <h3 class="text-lg font-medium text-gray-900 modal-title-ellipsis" id="modalTitle"></h3>
          <button class="modal-close text-gray-400 hover:text-gray-500 transition-colors">
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>
        <div class="p-6 max-h-[60vh] overflow-y-auto">
          <pre id="modalContent" class="text-sm text-gray-600 whitespace-pre-wrap font-sans"></pre>
        </div>
      </div>
    `;

    // bodyに追加
    document.body.appendChild(this.modal);

    // 閉じるボタンのイベントリスナー
    this.modal.querySelector('.modal-close').addEventListener('click', () => {
      this.hideModal();
    });

    // モーダルの外側をクリックして閉じる
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideModal();
      }
    });
  }

  // モーダルを表示
  showModal(title, content) {
    const modalTitle = this.modal.querySelector('#modalTitle');
    const modalContent = this.modal.querySelector('#modalContent');
    const modalDialog = this.modal.querySelector('.bg-white');
    
    modalTitle.textContent = title;
    modalContent.textContent = content || 'コンテンツがありません';
    
    // アニメーション用のクラスを追加
    this.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // スクロール防止
    
    // スケールアニメーション
    if (modalDialog) {
      modalDialog.style.transform = 'scale(0.9)';
      modalDialog.style.transition = 'transform 0.2s ease-out';
      
      requestAnimationFrame(() => {
        modalDialog.style.transform = 'scale(1)';
      });
    }
  }

  // モーダルを非表示
  hideModal() {
    const modalDialog = this.modal.querySelector('.bg-white');
    
    if (modalDialog) {
      modalDialog.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
        this.modal.classList.add('hidden');
        document.body.style.overflow = ''; // スクロール制御を解除
        modalDialog.style.transform = ''; // リセット
      }, 150);
    } else {
      this.modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  // エラー表示
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg transition-opacity duration-300 z-50';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
  }
  
  // 成功表示
  showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed bottom-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg transition-opacity duration-300 z-50';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.opacity = '0';
      setTimeout(() => successDiv.remove(), 300);
    }, 3000);
  }
  
  // 情報表示
  showInfo(message) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'fixed bottom-4 right-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded shadow-lg transition-opacity duration-300 z-50';
    infoDiv.textContent = message;
    
    document.body.appendChild(infoDiv);
    
    setTimeout(() => {
      infoDiv.style.opacity = '0';
      setTimeout(() => infoDiv.remove(), 300);
    }, 3000);
  }
  
  // 処理中ステータス表示
  showProcessingStatus(message) {
    // Remove existing status if any
    this.hideProcessingStatus();
    
    const statusDiv = document.createElement('div');
    statusDiv.id = 'webExtractProcessingStatus';
    statusDiv.className = 'fixed bottom-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg z-50 flex items-center gap-2';
    statusDiv.innerHTML = `
      <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>${message}</span>
    `;
    
    document.body.appendChild(statusDiv);
  }
  
  // 処理中ステータス非表示
  hideProcessingStatus() {
    const statusDiv = document.getElementById('webExtractProcessingStatus');
    if (statusDiv) {
      statusDiv.remove();
    }
  }

  // ページ内容の表示
  showPageContent(index) {
    const page = this.pages[index];
    this.showModal(page.title, page.content);
  }

  async initialize() {
    await this.loadState();
    this.renderList();
    this.setupEventListeners();
  }

  // 状態の保存
  async saveState() {
    await chrome.storage.local.set({
      [this.STATE_KEY]: {
        pages: this.pages,
        lastUpdated: new Date().toISOString()
      }
    });
  }

  // 状態の読み込み
  async loadState() {
    const data = await chrome.storage.local.get([this.STATE_KEY]);
    if (data[this.STATE_KEY]) {
      this.pages = data[this.STATE_KEY].pages || [];
    }
  }

  // イベントリスナーの設定
  setupEventListeners() {
    // 抽出ボタンのイベントリスナー
    const extractButton = document.getElementById('extractButton');
    extractButton?.addEventListener('click', () => this.handleExtract());
  }

  // Webページ内容の抽出処理
  async handleExtract() {
    try {
      // Show processing status
      this.showProcessingStatus('Web画面を抽出中...');
      
      // アクティブなタブの情報を取得
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 既に保存済みかチェック
      const existingIndex = this.pages.findIndex(p => p.url === tab.url);
      if (existingIndex !== -1) {
        // Update existing content instead of throwing error
        const updateConfirm = confirm('このページは既に保存されています。内容を更新しますか？');
        if (!updateConfirm) {
          this.hideProcessingStatus();
          return;
        }
        // Remove existing entry
        this.pages.splice(existingIndex, 1);
      }

      // 最大数チェック
      if (this.pages.length >= this.MAX_PAGES) {
        // Remove oldest page automatically
        this.pages.pop();
        this.showInfo('最大保存数に達したため、最も古いページを削除しました');
      }

      // コンテンツの取得
      let content;
      if (tab.url.toLowerCase().endsWith('.pdf')) {
        content = await this.extractPdfContent(tab.url);
      } else {
        content = await this.extractWebContent(tab.id);
      }
      
      // If content extraction failed (returned null), exit early
      if (!content) {
        this.hideProcessingStatus();
        return;
      }
      
      // Ensure content is not empty
      if (!content.trim()) {
        throw new Error('ページから有効なコンテンツを抽出できませんでした');
      }

      // ページ情報の保存
      this.pages.unshift({
        url: tab.url,
        title: tab.title,
        content: content,
        timestamp: new Date().toISOString()
      });

      await this.saveState();
      this.renderList();
      
      // Notify FormController to sync
      if (window.formController && typeof window.formController.syncWebExtractContent === 'function') {
        window.formController.syncWebExtractContent();
      }
      
      this.hideProcessingStatus();
      this.showSuccess(`「${tab.title}」のコンテンツを抽出しました`);

    } catch (error) {
      console.error('Extract error:', error);
      this.hideProcessingStatus();
      // Show user-friendly error message
      this.showError(error.message);
    }
  }

  // PDF内容の抽出
  async extractPdfContent(url) {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/js/pdf.worker.min.js');

    try {
      const pdf = await pdfjsLib.getDocument(url).promise;
      let content = '';
      
      // 全ページのテキストを抽出
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        content += textContent.items.map(item => item.str).join(' ') + '\n';
      }

      return content;
    } catch (error) {
      throw new Error('PDFの解析に失敗しました: ' + error.message);
    }
  }

  // Web内容の抽出
  async extractWebContent(tabId) {
    try {
      // Get tab info to check if it's an extension page
      const tab = await chrome.tabs.get(tabId);
      
      // Check if it's an extension page (chrome-extension://)
      if (tab.url.startsWith('chrome-extension://')) {
        this.showError('拡張機能のページは抽出できません');
        return null;
      }
      
      // Check if it's a restricted URL
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        this.showError('このページは抽出できません（システムページ）');
        return null;
      }
      
      // (A) ページ側に Readability.js を先に注入
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['assets/js/Readability.js']
      });
  
      // (B) 注入完了後、メイン関数を実行
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          try {
            // Try Readability first for article content
            const reader = new Readability(document.cloneNode(true));
            const article = reader.parse();
            
            if (article && article.textContent && article.textContent.trim().length > 100) {
              return article.textContent;
            }
            
            // Fallback: Extract all text content with better formatting
            const extractTextContent = (element) => {
              let text = '';
              
              // Skip script and style elements
              if (element.tagName && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) {
                return '';
              }
              
              // Extract form labels and values
              if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                const label = element.labels?.[0]?.textContent || element.placeholder || element.name || '';
                const value = element.value || '';
                if (label || value) {
                  text += `${label}: ${value}\n`;
                }
              }
              
              // Extract select options
              if (element.tagName === 'SELECT') {
                const label = element.labels?.[0]?.textContent || element.name || '';
                const selectedOption = element.selectedOptions?.[0]?.textContent || '';
                if (label || selectedOption) {
                  text += `${label}: ${selectedOption}\n`;
                }
              }
              
              // Extract text nodes
              if (element.nodeType === Node.TEXT_NODE) {
                const nodeText = element.textContent.trim();
                if (nodeText) {
                  text += nodeText + ' ';
                }
              }
              
              // Process child nodes
              for (const child of element.childNodes) {
                text += extractTextContent(child);
              }
              
              // Add line breaks for block elements
              if (element.tagName && ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'BR'].includes(element.tagName)) {
                text += '\n';
              }
              
              return text;
            };
            
            // Extract structured data from the page
            let content = '';
            
            // Get page title
            const title = document.title;
            if (title) {
              content += `ページタイトル: ${title}\n\n`;
            }
            
            // Get meta description
            const metaDesc = document.querySelector('meta[name="description"]')?.content;
            if (metaDesc) {
              content += `説明: ${metaDesc}\n\n`;
            }
            
            // Extract main content
            const mainContent = extractTextContent(document.body);
            content += mainContent;
            
            // Clean up the content
            content = content
              .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
              .replace(/\s{2,}/g, ' ')    // Remove excessive spaces
              .trim();
            
            return content || document.body.innerText;
          } catch (error) {
            console.error('Content extraction error:', error);
            return document.body.innerText;
          }
        }
      });
  
      return result.result; // array形式で返るので result.result
    } catch (error) {
      throw new Error('ページ内容の抽出に失敗しました: ' + error.message);
    }
  }

  // リストの描画
  renderList() {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    
    this.pages.forEach((page, index) => {
      // <details>要素をカード風にラップ
      const details = document.createElement('details');
      details.className = 'accordion card';
      
      // ヘッダー部分（<summary>）
      const summary = document.createElement('summary');
      summary.className = 'accordion-header flex items-center justify-between';
      // ブラウザ標準の三角アイコンの表示を無効にする
      summary.style.listStyle = 'none';
      
      // ヘッダー左側：タイトル、URL、タイムスタンプ
      const headerInfo = document.createElement('div');
      headerInfo.innerHTML = `
        <div class="font-medium">${page.title}</div>
        <div class="text-sm text-gray-500 modal-title-ellipsis">${page.url}</div>
        <div class="text-xs text-gray-400">${new Date(page.timestamp).toLocaleString()}</div>
      `;
      
      // ヘッダー右側：矢印アイコンと削除ボタン
      const headerRight = document.createElement('div');
      headerRight.className = 'flex items-center gap-2';
      
      // 矢印アイコン（展開状態により回転）
      const arrow = document.createElement('span');
      arrow.className = 'accordion-arrow';
      arrow.innerHTML = '&#9662;'; // 下向き矢印
      arrow.style.transition = 'transform 0.3s ease';
      
      // 削除ボタン（クリックでアコーディオン開閉を防止）
      const deleteButton = document.createElement('button');
      deleteButton.className = 'text-red-500 hover:text-red-700';
      deleteButton.innerHTML = '×';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 開閉イベントを発生させない
        this.deletePage(index);
      });
      
      headerRight.appendChild(arrow);
      headerRight.appendChild(deleteButton);
      
      summary.appendChild(headerInfo);
      summary.appendChild(headerRight);
      
      // アコーディオンの展開状態に応じて矢印を回転
      details.addEventListener('toggle', function () {
        if (details.open) {
          arrow.style.transform = 'rotate(180deg)';
        } else {
          arrow.style.transform = 'rotate(0deg)';
        }
      });
      
      // 展開時に表示する内容部分
      const contentContainer = document.createElement('div');
      contentContainer.className = 'accordion-content card-content border-t p-4';
      contentContainer.innerHTML = `<pre class="text-sm text-gray-600 whitespace-pre-wrap font-sans">${page.content}</pre>`;
      
      details.appendChild(summary);
      details.appendChild(contentContainer);
      
      this.container.appendChild(details);
    });
  }

  // ページの削除
  async deletePage(index) {
    this.pages.splice(index, 1);
    await this.saveState();
    this.renderList();
    if (window.formController && typeof window.formController.syncWebExtractContent === 'function') {
      window.formController.syncWebExtractContent();
    }
  }

  // 保存されたページの内容を取得
  getPageContents() {
    return this.pages.map(page => ({
      url: page.url,
      content: page.content
    }));
  }
}

// ▼ファイルが読み込まれたら即時に初期化 (IIFE形式でもOK)
(() => {
  console.log('[web_list.js] Loaded. Creating WebListManager...');
  window.webListManager = new WebListManager();
  window.webListManager.initialize();
})();