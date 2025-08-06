// form-reader.js
(() => {
    // DOM要素の取得
    const readFormButton = document.getElementById('readFormButton');
    const sendButton = document.getElementById('sendButton');
    let lastFormContent = null;

    // PDFテキスト抽出関数
    async function extractPDFText(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            
            // PDF.jsの設定
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('assets/js/pdf.worker.min.js');

            try {
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const text = textContent.items.map(item => item.str).join(' ');
                    fullText += text + '\n';
                }
                return fullText;
            } catch (error) {
                console.error('PDF parsing error:', error);
                return '';
            }
        } catch (error) {
            console.error('PDF fetch error:', error);
            return '';
        }
    }

    // フォーム内容を読み取る関数
    async function readFormContent() {
        // 必要な要素を都度チェック
        const messageInput = document.getElementById('messageInput');
        if (!messageInput || !readFormButton) {
            // 必要な要素がなければ黙って処理を終わらせる
            return;
        }

        // 読み取り中の表示
        messageInput.value = "内容を読み取っています...";
        messageInput.disabled = true;
        readFormButton.disabled = true;

        // 親ウィンドウに要素の取得をリクエスト
        window.parent.postMessage({
            type: 'GET_FORM_CONTENT',
            xpath: '/html/body/div[1]/div/div/div/div[2]/div'
        }, '*');
    }

    // メッセージイベントリスナー
    window.addEventListener('message', async (event) => {
        if (event.data.type === 'FORM_CONTENT') {
            const messageInput = document.getElementById('messageInput');
            if (!messageInput || !readFormButton) {
                // 必要な要素が無ければスキップ
                return;
            }

            try {
                const formElement = event.data.content;
                const baseUrl = event.data.baseUrl || '';
                let pdfText = '';

                // PDFリンクを探してテキストを抽出
                const parser = new DOMParser();
                const doc = parser.parseFromString(formElement, 'text/html');
                const pdfLinks = doc.querySelectorAll('a[href$=".pdf"]');

                for (const link of pdfLinks) {
                    const pdfRelativeUrl = link.getAttribute('href');
                    // 相対パスを完全なURLに変換
                    const pdfFullUrl = new URL(pdfRelativeUrl, baseUrl).href;
                    
                    console.log('Processing PDF:', pdfFullUrl);
                    const extractedText = await extractPDFText(pdfFullUrl);
                    
                    if (extractedText) {
                        pdfText += `\n\n=== PDF内容: ${pdfRelativeUrl} ===\n${extractedText}`;
                    }
                }

                const fullContent = `フォーム内容:\n${formElement}${pdfText}`;
                lastFormContent = fullContent;

                messageInput.value = fullContent;
                messageInput.disabled = false;
                readFormButton.disabled = false;

                adjustTextareaHeight(messageInput);

            } catch (error) {
                console.error('Content processing error:', error);
                messageInput.value = "内容の読み取りに失敗しました。";
                messageInput.disabled = false;
                readFormButton.disabled = false;
            }
        }
    });

    // テキストエリアの高さ調整関数
    function adjustTextareaHeight(element) {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
    }

    // フォーム内容を表示する関数
    function showFormContent() {
        if (!lastFormContent) return;
        const modal = document.getElementById('formContentModal');
        const contentBody = document.getElementById('formContentBody');
        if (!modal || !contentBody) return;

        contentBody.innerHTML = lastFormContent.replace(/\n/g, '<br>');
        modal.classList.add('active');
    }

    // モーダルを閉じる関数
    window.closeFormModal = function() {
        const modal = document.getElementById('formContentModal');
        if (modal) {
            modal.classList.remove('active');
        }
    };

    // フォーム読み取りボタンのイベントリスナー登録
    // 必要な要素が存在する場合のみ登録する
    if (readFormButton) {
        readFormButton.addEventListener('click', readFormContent);
    }

    // 送信後のフォームアイコン追加
    if (sendButton) {
        sendButton.addEventListener('click', function() {
            if (lastFormContent) {
                setTimeout(() => {
                    const lastMessage = document.querySelector('.chat-messages .message:last-child');
                    if (!lastMessage) return;

                    const messageContent = lastMessage.querySelector('.message-content');
                    if (!messageContent) return;

                    const formIcon = document.createElement('span');
                    formIcon.className = 'form-icon';
                    formIcon.innerHTML = '<i class="bi bi-file-text"></i>';
                    formIcon.onclick = showFormContent;
                    messageContent.appendChild(formIcon);
                }, 100);
            }
        });
    }
})();
