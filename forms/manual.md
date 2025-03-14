# フォームナビ 詳細仕様書 v3

---

## 1. 製品概要

### 1.1 製品名
- **フォームナビ** (Form Navi)

### 1.2 目的
- Webページ上のフォーム要素を自動的に検出し、**OpenAI API** (GPT) と連携して入力候補を生成し、ユーザが簡単にフォームへ反映できるよう支援する **Chrome拡張機能** です。
- 追加で **PDFドキュメントのテキスト抽出** や **Webページ本文抽出** (Readability) を行い、フォーム入力に役立つ情報を自動収集・AIサジェストに活用することを想定しています。

### 1.3 機能概要
1. **フォーム要素の自動検出**: `content.js` の `FormObserver` クラスが、現在のタブに存在するフォーム要素を取得し、整理して保管。
2. **PDF解析**: `popup.js` で `pdf.js` を使用し、選択(アップロード)されたPDFファイルをテキスト抽出する。
3. **Webページ内容抽出**: `web_list.js` で Readability.js 等を用い、必要に応じてWebページのテキストを抽出。
4. **GPT連携**: `gpt.js` で OpenAI APIを呼び出し、フォームへの入力候補 (AIサジェスト) を取得。
5. **フォームへの入力反映**: ポップアップからコンテンツスクリプト (`content.js`) へメッセージを送り、実際のHTMLフォームに値をセットする。
6. **状態保持**: `chrome.storage.local` に抽出データやユーザ入力値を保存・復元することで、ポップアップを閉じても途中状態が継続可能。

---

## 2. ディレクトリ構成

```
PJフォルダ
│  content.css       // コンテンツスクリプト用のスタイル(ハイライト等)
│  content.js        // フォーム検出 & 適用ロジック (コンテンツスクリプト)
│  gpt.js            // GPTサービスとの連携 (API呼び出し、プロンプト生成等)
│  manifest.json     // Chrome拡張のマニフェスト設定ファイル
│  manual.md         // ドキュメント（ユーザ用簡易マニュアル等）
│  popup.html        // 拡張機能ポップアップUI
│  popup.js          // ポップアップUIのメインロジック (フォーム制御クラス)
│  styles.css        // ポップアップUIのスタイル
│  web_list.js       // Webページの内容抽出( Readability.js 連携 )
│
├─assets
│  └─js
│      ├─ pdf.min.js        // pdf.js本体
│      ├─ pdf.worker.min.js // pdf.jsワーカー
│      └─ Readability.js    // Mozilla Readability
│
├─doc
│      20250204_115215_Direct.pdf   // (任意) サンプルのドキュメント
│      ルール_年間ーコミュ.md
│      ルール_年間ーコミュ.pdf
│      ルール_月額ーコミュ.md
│      ルール_月額ーコミュ.pdf
│
└─images
    ├─ icon128.png
    ├─ icon16.png
    ├─ icon48.png
    └─ 旧アイコン
        ├─ icon.html
        ├─ icon128.png
        ├─ icon16.png
        ├─ icon48.png
        └─ 名称未設定-1.png
```

- **注**: `doc` フォルダ以下はプロダクト動作に必須ではないサンプルドキュメント等が含まれています。

---

## 3. マニフェスト (manifest.json)

```jsonc
{
  "manifest_version": 3,
  "name": "Form Navi",
  "version": "0.2",
  "description": "Automatically control and fill forms on web pages using GPT",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "images/icon16.png",
      "48": "images/icon48.png",
      "128": "images/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "content.js",
        "web_list.js",
        "assets/js/Readability.js"
      ]
    }
  ],
  "web_accessible_resources": [{
    "resources": [
      "assets/js/pdf.min.js",
      "assets/js/pdf.worker.min.js",
      "assets/js/Readability.js"
    ],
    "matches": ["<all_urls>"]
  }],
  "icons": {
    "16": "images/icon16.png",
    "48": "images/icon48.png",
    "128": "images/icon128.png"
  }
}
```

### 3.1 主な設定項目
- **`permissions`**:
  - `activeTab`: 現在アクティブなタブの操作。
  - `scripting`: コンテンツスクリプト注入等。
  - `storage`: `chrome.storage` APIの使用。
  - `tabs`: タブID参照等。
- **`content_scripts`**: すべてのURLに対して、`content.js`, `web_list.js`, `Readability.js` を読み込む。

---

## 4. アーキテクチャ概要

### 4.1 全体フロー
1. **ユーザが拡張機能アイコンをクリック** → `popup.html` が表示 → `popup.js` (`FormController`) が動作開始。
2. `FormController` は、`chrome.tabs.sendMessage` により現在アクティブなタブのDOMを操作するため、`content.js` にメッセージを送る。
3. `content.js` (`FormObserver`) が、ページ上のフォーム要素を解析・抽出して返す。
4. ユーザがPDFファイルをアップロードすれば、`pdf.js` を用いてテキストを抽出し、`FormController` が内部保持。
5. ユーザが「Web抽出」ボタン押下 → `web_list.js` で Readability.js を利用してページ本文を抽出・格納。
6. 「GPT連携実行」ボタン押下 → `gpt.js` (`GPTService`) が OpenAI APIに問い合わせ、フォームの入力候補を生成。
7. 生成されたサジェストをポップアップUIでユーザに提示し、選択・編集可能。
8. 「フォームに反映」ボタン押下 → 再度 `content.js` にメッセージを送信し、実ページのフォームに値をセットする。

### 4.2 主なデータフロー
- **`chrome.storage.local`** を利用し、以下を保持:
  - 抽出した PDFテキスト (`manualRulesContent`, `processDocContent`)
  - 抽出した Web本文 (`webExtractContent`)
  - ユーザの入力 (APIキー、プロンプトテキスト等)
  - AIサジェスト結果、およびユーザが最終的に選択した値

---

## 5. モジュール別仕様

### 5.1 popup.js (FormController)

#### 5.1.1 概要
- 拡張機能のポップアップで動作するメインクラス **`FormController`** を定義し、UI要素操作・状態管理・PDF読込・GPT連携などの中核を担う。

#### 5.1.2 主要プロパティ
- `STATE_KEY`: Chromeストレージでのキー接頭辞。
- `cachedForms`: 抽出済みフォーム定義のキャッシュ。
- `suggestions`: GPTからのサジェスト情報(複数フォーム分)。
- `selectedValues`: ユーザが最終的に選択した入力値。
- `manualRulesContent`: ルールPDFから抽出したテキスト。
- `processDocContent`: 手続き・処理PDFから抽出したテキスト。
- `webExtractContent`: Web抽出したテキスト。
- `manualRulesFileName`, `processDocFileName`: PDFファイル名をUI表示用に保持。
- `gptService`: GPT連携用のインスタンス (`GPTService` from gpt.js)。
- `elements`: 各種UI要素参照をまとめたオブジェクト。

#### 5.1.3 初期化フロー
1. **コンストラクタ**: 状態変数の初期化、UI要素参照の取得、`GPTService` 初期化、`pdf.js` ワーカー設定。
2. **`initialize()`**:
   1. `initializeNavigationListener()` - タブ更新監視 (ページ遷移時にサジェスト等をクリア)  
   2. `initializeEventListeners()` - ユーザ操作に対するイベントハンドラ登録  
   3. `initializeModelSelect()` - APIキーがあればモデル一覧を取得し、UIに反映  
   4. `loadState()` - `chrome.storage.local` から状態を復元  
   5. `autoLoadForms()` - ページ内フォーム自動読込  
   6. 完了後「Initialization complete」

#### 5.1.4 主なメソッド

1. **`saveState()`** / **`loadState()`**
   - `chrome.storage.local` へ状態を保存・読込する。
   - `formState`: フォーム関連 (cachedForms, selectedValues など)
   - `suggestionState`: AIサジェスト関連 (suggestions)
   - `persistentState`: 永続情報 (PDFやWeb抽出内容、APIキー、モデル等)

2. **`initializeEventListeners()`**
   - UI上の各ボタン/入力変更に対し、処理を紐づける。
   - 例: 
     - PDFアップロード (`manualPdf`, `processPdf`)
     - PDF削除ボタン押下
     - Web抽出ボタン (`extractButton`)
     - GPT連携実行ボタン (`gptButton`)
     - フォーム適用ボタン (`applyButton`)
     - プロンプト入力の更新
     - クリアボタン (`clearFormDataButton`)

3. **`handlePdfUpload(event, targetProperty)`**
   - PDFファイルを読み込み、`parsePdfFile()` によりテキスト抽出
   - 抽出結果テキストを `manualRulesContent` または `processDocContent` に保存
   - UI表示 (ファイル名表示/削除ボタンなど)

4. **`parsePdfFile(file)`**
   - `pdf.js` を使ってページごとのテキスト抽出。
   - 全文を連結しテキストを返す。

5. **`handleWebExtract()`**
   - `web_list.js` の `getPageContents()` を呼び出し、Webページ抽出結果を保持 (`webExtractContent`)。
   - 併せてフォームの再読込 (`autoLoadForms()`) も行う場合あり。

6. **`handleGptSuggestions()`**
   - GPT用のプロンプトを `gptService.generatePrompt()` で生成。
   - `gptService.sendToGPT()` でOpenAI APIをコールし、結果を受け取る。
   - 得られた `form_suggestions` を `suggestions` プロパティに格納。
   - 既存の `selectedValues` が無い場合は、一番確信度の高い候補を自動選択。

7. **`handleFormApply()`**
   - ユーザが選択した `selectedValues` を `content.js` にメッセージ送信 → 実際のフォームへ適用。
   - 適用後、ハイライト解除要求 (`removeHighlight`) も行う。

8. **`autoLoadForms()`**
   - 現在のタブに `getForms` メッセージを送り、フォーム定義配列を取得。
   - `cachedForms` に格納し、UIを再描画。

9. **`clearFormData()`**
   - AIサジェストとユーザ選択情報をクリア。  
   - UIやストレージ上のサジェスト状態をすべて初期化。

10. **フォーム描画系**
    - `renderFormElements()`: `cachedForms` をもとにUIカードを生成。
    - `renderSuggestions()`: `suggestions` をもとにフォーム候補セレクトを更新し、推薦理由等を表示。
    - `renderSelectedValues()`: 選択された値を一覧表示。
    - `updateStatus(type, message)`: ステータス表示の更新 (アイコン/文言等)。

---

### 5.2 content.js (FormObserver)

#### 5.2.1 概要
- ページ内で動作する **コンテンツスクリプト**。DOMを直接走査し、フォーム要素を抽出または適用する。
- `FormObserver` クラスにより管理される。

#### 5.2.2 主な動作
1. **`observeForms()`**:
   - ページに存在する `input`, `select`, `textarea` を可視状態かつユニークに取得し、`this.forms` (Map) に保持。
   - ラジオ/チェックボックスはグループ単位でまとめる (`name` をキーにするなど)。
   - MutationObserver でDOM変化を監視し、新たにフォームが追加されたら再収集。

2. **`getFormsData()`**:
   - `this.forms` (Map) を配列形式にして返却。  
   - `popup.js` → `chrome.tabs.sendMessage({action: 'getForms'})` で呼ばれた際に使用。

3. **`applyValues(values)`**:
   - 各フォームに対して、指定された値をセットする。  
   - ラジオ/チェックボックス/セレクト(単一・複数)/テキストなどで処理を分岐し、該当DOM要素に `dispatchEvent` も含めて適用。

4. **ハイライト制御**:
   - `highlightForms()`: 取得したフォーム要素に `.form-control-highlight` クラスを付与して可視化。
   - `removeHighlight()`: 全 `.form-control-highlight` を削除。

#### 5.2.3 イベント受信メッセージ例
- **`getForms`**: 現在のフォーム情報を返す。
- **`applyValues`**: 指定された値をセット。
- **`highlightForms`**: フォーム要素をハイライト。
- **`removeHighlight`**: ハイライト削除。

---

### 5.3 gpt.js (GPTService)

#### 5.3.1 概要
- OpenAI APIとの通信およびプロンプト生成を担当するクラス **`GPTService`** を提供。

#### 5.3.2 主要メソッド

1. **`setApiKey(apiKey)`**, **`setModel(model)`**:
   - APIキーおよび利用モデル (例: `gpt-3.5-turbo` 等) を設定。

2. **`fetchAvailableModels()`**:
   - `GET https://api.openai.com/v1/models` を呼び出し、利用可能なモデル一覧を取得。
   - `gpt-` で始まるモデルのみ抽出し、配列に格納。
   - エラー時は例外。

3. **`generatePrompt(formData, manualRules, processDoc, webExtract, userPrompt)`**:
   - **システムプロンプト** (System Role) と **ユーザープロンプト** (User Role) の2つを生成。
   - システムプロンプト内部でフォームの定義や入力出力形式を指定し、ユーザープロンプトで実際の業務文書やWeb抽出内容をまとめて指示。

4. **`sendToGPT(prompt)`**:
   - `POST https://api.openai.com/v1/chat/completions` を行う。
   - `prompt.systemPrompt` (role=system) と `prompt.userPrompt` (role=user) をmessagesに含める。
   - 返却されたJSONから `choices[0].message.content` を取得 → JSON.parse → `form_suggestions` 構造を取り出す。

5. **`_parseGPTResponse(response)`**:
   - GPTレスポンスの `choices[0].message.content` を JSONパースし、`{ form_suggestions: [...] }` 構造を返す。
   - パース失敗時は例外を投げる。

#### 5.3.3 期待するGPT出力形式
```jsonc
{
  "form_suggestions": [
    {
      "form_id": "フォームの識別子",
      "suggestions": [
        {
          "value": "入力候補の値1",
          "confidence": 0.95,
          "reason": "この値を提案する理由1"
        },
        {
          "value": "入力候補の値2",
          "confidence": 0.90,
          "reason": "この値を提案する理由2"
        },
        {
          "value": "入力候補の値3",
          "confidence": 0.85,
          "reason": "この値を提案する理由3"
        }
      ]
    },
    ...
  ]
}
```
- **form_id**: フォーム要素の `id` もしくは `name`。  
- **suggestions**: 上位3つ程度の候補。確信度 (`confidence`)、理由(`reason`) を添えて返す。

---

### 5.4 web_list.js (WebListManager)

#### 5.4.1 概要
- 拡張ポップアップ内で、**Webページ(もしくはPDF) の本文抽出を管理** する機能を提供。
- Readability.js を活用して本文テキストを取得したり、PDFの場合は `pdf.js` によりテキスト抽出。

#### 5.4.2 主要プロパティ
- `STATE_KEY = 'web_list_state'`: chrome.storage.local での管理キー
- `MAX_PAGES = 5`: 最大保存数
- `pages`: 抽出したページの情報 `{ url, title, content, timestamp }` の配列
- `container`: UI表示先 (`#webPagesContainer`)
- `modal`: ページ内容プレビュー用モーダル (動的生成)

#### 5.4.3 主なメソッド
1. **`initialize()`**:
   - `loadState()` で既存抽出済みのページ情報を読み込み
   - `renderList()` で一覧をUI表示
   - イベントリスナ設定 (抽出ボタンなど)

2. **`handleExtract()`**:
   - 現在タブのURLとタイトルを取得
   - 既に保存済みでない & 上限未達 → `extractWebContent()` or `extractPdfContent()` で本文抽出
   - `pages.unshift(...)` で先頭追加 → `saveState()` → `renderList()`

3. **`extractPdfContent(url)`**:
   - PDFのURL (オンラインPDF) を `pdf.js` で読み込み・テキスト抽出。  
   - 全ページ走査し文字連結。

4. **`extractWebContent(tabId)`**:
   - `Readability` を実行するために `chrome.scripting.executeScript()` で実際のタブDOM上にて記事本文を抽出 (fallbackで `document.body.innerText`)。

5. **`renderList()`**:
   - ページのリストを `<details>` 要素 (アコーディオン) で表示。削除ボタン、プレビュー機能を提供。
   
6. **`deletePage(index)`**:
   - 指定Indexのデータを `pages` から削除 → `saveState()` → `renderList()` で更新。

7. **`getPageContents()`**:
   - サジェスト連携用などに、 `{ url, content }` のみの配列を返す。

---

## 6. UI仕様 (popup.html & styles.css)

### 6.1 画面構成

1. **設定セクション**  
   - **OpenAI APIキー** (input type="password")  
   - **モデル選択** (select)  
   - **マニュアル・ルールPDFアップロード** (input type="file")  

2. **プロンプト入力セクション**  
   - **手続き・処理PDFアップロード**  
   - **Web画面抽出** ボタン (`#extractButton`)  
     - 抽出結果が下部にリスト表示 (`#webPagesContainer`)  
   - **プロンプト入力テキストエリア** (`#promptInput`)  
   - **GPT連携実行ボタン** (`#gptButton`)  

3. **ステータス表示**  
   - `#statusDisplay`, `#statusIcon`, `#statusText`  
   - 処理状態やエラー・成功をアイコン付きで表示

4. **フォーム制御セクション**  
   - **フォーム要素一覧** (`#formElementsContainer`)  
     - テンプレート (`#formElementTemplate`) から動的生成  
     - 各フォームごとに候補セレクトボックスと推薦理由が表示  
   - **選択された値** (カード下部)  
   - **フォームに反映ボタン** (`#applyFormButton`)  
   - **AI候補リセット(クリア)ボタン** (`#clearFormDataButton`)  

### 6.2 テンプレート: `#formElementTemplate`
```html
<template id="formElementTemplate">
  <div class="card">
    <div class="card-content">
      <div class="text-lg font-medium mb-4 element-identifier"></div>
      <div class="space-y-4">
        <div>
          <div class="text-sm font-medium mb-2">入力候補:</div>
          <select class="form-select w-full">
            <option value="">候補を選択してください</option>
          </select>
        </div>
        <div class="suggestion-reason hidden">
          <div class="text-sm font-medium text-gray-700">推薦理由:</div>
          <div class="mt-1 p-3 bg-gray-50 rounded-md text-sm text-gray-600 suggestion-reason-content"></div>
        </div>
      </div>
    </div>
  </div>
</template>
```
- **`.element-identifier`**: フォーム名やIDを表示
- **`.form-select`**: 候補を選択するための `select`
- **`.suggestion-reason`**: 選択した候補の理由を表示する領域

---

## 7. ステート管理

### 7.1 `chrome.storage.local` のキー構成
1. **`form_controller_state_form`**  
   - `cachedForms`, `selectedValues`, `status`, `processingTabId`
2. **`form_controller_state_suggestions`**  
   - `suggestions`, `lastUpdated`
3. **`form_controller_state_persistent`**  
   - `manualRulesContent`, `processDocContent`, `webExtractContent`,  
   - `promptInput`, `apiKey`, `selectedModel`,  
   - `manualRulesFileName`, `processDocFileName`
4. **`web_list_state`**  
   - `pages`: [{ url, title, content, timestamp }, ...]  
   - `lastUpdated`

### 7.2 データ保存タイミング
- ポップアップUI操作 (入力変更、ファイルアップロード等) → 即座に `saveState()`
- GPT連携後 → サジェストが更新された段階で `saveState()`
- ページ遷移検知 → (該当タブIDの場合) `form_controller_state_form`, `form_controller_state_suggestions` を削除 (ナビゲーションリスナ)

---

## 8. イベントフロー詳細

### 8.1 フォーム抽出 → GPT連携 → フォーム適用
1. **拡張機能起動**  
   - ユーザが拡張機能アイコンをクリック → `popup.js` の `FormController.initialize()` 実行。
2. **フォーム自動読み込み**  
   - `autoLoadForms()` → `chrome.tabs.query({active:true})` でタブ取得 → `sendMessage(tab.id, {action:'getForms'})` → `content.js` がフォームデータ配列を返却 → `cachedForms` へ保存。
   - UI表示 (`renderFormElements()`)。
3. **PDFやWeb情報の抽出 (任意)**  
   - ユーザがPDFをアップロード → `handlePdfUpload()` → `parsePdfFile()` でテキスト抽出 → `manualRulesContent` / `processDocContent` に格納。
   - 「Web画面抽出」 → `handleWebExtract()` → `web_list.js` の `getPageContents()` 呼び出し → テキストを `webExtractContent` に格納。
4. **GPT連携**  
   - ユーザが `#gptButton` をクリック → `handleGptSuggestions()` → `gptService.generatePrompt()` でプロンプト作成 → `sendToGPT()` → 結果 JSON をパース → `suggestions` に格納 → `renderSuggestions()` でUIに反映。
5. **ユーザが候補を調整**  
   - 各フォームのセレクトボックスで候補を選択 → `selectedValues` を更新。
6. **フォーム適用**  
   - 「フォームに反映」ボタン → `handleFormApply()` → `content.js` へ `applyValues()` メッセージを送る → 該当DOMに値をセットしイベントを発火 → `removeHighlight()` でハイライト解除。

### 8.2 クリアボタン押下
- `clearFormData()` → サジェストやユーザ選択状態を全部初期化 → ステータス表示

### 8.3 ページ遷移 (同一タブ)
- `chrome.tabs.onUpdated.addListener` を利用
- `processingTabId` に紐づくタブが `loading` 状態へ移行 → その場合、サジェスト状態を消去 → 次ページでは再度フォームを読み込み直す

---

## 9. セキュリティ・注意事項

1. **APIキーの管理**  
   - 現状、APIキーは `chrome.storage.local` と `localStorage` に平文で保存しており、拡張機能を導入した環境のユーザには読み取り可能性がある。  
   - セキュリティ上の懸念がある場合は、より安全な方法でAPIキーを保管するか、都度入力するよう運用設計する必要がある。

2. **CORS制限**  
   - `fetch()` でOpenAI APIを呼び出す際、`manifest.json` 上に特別な設定は不要ですが、`https://api.openai.com/` がクロスサイトになる点に留意。  
   - 現行では問題なく使用できるが、将来的にOpenAI側ポリシー変更等があれば適宜対応。

3. **PDF.js の動作**  
   - PDFのバイナリをすべてメモリにロードし、ページごとにテキスト抽出。大容量PDFや特殊PDFでは処理時間やパース失敗の可能性がある。

4. **Readability.js での本文抽出**  
   - 特殊なWebサイトやSPAなどでは期待通りに本文が取得できない場合がある。  
   - PDFとして認識できないURLでも `.pdf` 末尾なら `extractPdfContent` が呼ばれるため注意。

---

## 10. 今後の拡張

1. **マルチPDFアップロード対応**  
   - 現状はマニュアルPDFと手続きPDF2種類のみ想定。将来的に複数ファイルに対応可能。
2. **モデル選択の拡張**  
   - 現在はOpenAI側に存在するGPT系モデルのみ取得。特定モデル（例: `gpt-4`）で大きい入力コンテキストにも対応。
3. **より高度なサジェスト**  
   - セマンティック解析や外部DB連携を行い、確信度や理由の根拠をより詳細に提示。
4. **UI改善**  
   - 推薦理由の折りたたみ表示、フォーム編集のリアルタイム反映など。

---

## 11. 動作環境

- **ブラウザ**: Google Chrome (Manifest V3対応)
- **必須ライブラリ**:
  - pdf.js (assets/js/pdf.min.js, pdf.worker.min.js)
  - Readability.js
- **OpenAIアカウント**: 有効なAPIキー (sk-... 形式)

---

## 12. テスト項目例

1. **フォーム検出テスト**  
   - 通常の `<input type="text">` などが正しく検出されるか  
   - ラジオ・チェックボックスがグループ化されるか
2. **PDF抽出テスト**  
   - 単ページPDF/複数ページPDF/文字以外が多いPDF等で抽出が正常に完了するか
3. **GPT連携テスト**  
   - APIキーが正しく設定されていない場合のエラーメッセージ表示  
   - モデルが選択されていない場合の挙動  
   - 大量のテキスト(PDF + Web + User Prompt)でもサジェストが生成可能か
4. **フォーム反映テスト**  
   - ラジオ・チェックボックス・セレクト(単一/複数)・テキストへの値適用動作
5. **クリア処理・ページ遷移処理**  
   - クリアボタン押下でサジェストと選択値が消えるか  
   - ページ遷移後、サジェストが破棄されるか

---

## 13. まとめ

本ドキュメントでは、**フォームナビ (Form Navi)** Chrome拡張の設計・実装詳細について解説しました。  
- **popup.js** でのUI制御・状態管理  
- **content.js** での実際のフォーム検出/適用  
- **gpt.js** でのOpenAI API連携  
- **web_list.js** でのWebページ本文抽出  

---
# フォームナビ ユーザー向け概要・マニュアル

## 1. はじめに
**フォームナビ**は、従来のフォーム自動入力（オートコンプリート）をさらに高度化し、業務システムや各種SaaS、OCRなどとの接続を強化することで、**「ラストワンマイル」**の手間を削減することを目的とした新しいツールです。

### 1.1 コンセプト
1. **フォームのオートコンプリートの強化版**  
   従来の「定型文入力」や「過去入力値の補完」とは異なり、AIの自然言語処理や学習モデルを活用して、フォームに最適な入力候補を提案・自動入力します。  
2. **SaaSとのオーバーラップ**  
   業務システムやクラウドサービスと連携し、フォームの入力・送信までシームレスに行うことを想定しています。  
3. **システム間の“接続部”を強化する**  
   以前はOCRで読み取ったデータをSaaSに連携する際など、最後の調整や入力が人手に頼っていました。フォームナビはこの接続を強化し、自動化や効率化を実現します。  
4. **AIの活用ステップ**  
   - **Step 1**: まずは「人の作業をAIが補助」  
   - **Step 2**: AIの精度が高まるにつれ、「AIを人が少し補助」  
   - **Step 3**: 将来的には「AIが単独で処理」し、人は業務設計や付加価値創出に専念  
5. **業務処理はAIが担当**  
   AIが単純かつ繰り返しの多い処理を担い、ユーザーは業務の設計・分析・改善や収益拡大など、よりクリエイティブな作業に集中できます。

---

## 2. 使い方概要

### 2.1 セットアップ
1. **Chrome拡張のインストール**  
   - Chromeウェブストア、または提供されたパッケージからフォームナビをインストールします。
2. **初回設定**  
   - 「OpenAI APIキー」など、AI連携に必要な情報を拡張機能ポップアップで設定します。  
   - 連携したいSaaSや社内システムがある場合は、適宜その接続設定を行います。

### 2.2 基本の流れ
1. **フォームページを開く**  
   対象サイトのフォーム画面に移動し、フォームナビのアイコン（拡張機能）をクリックします。
2. **AI候補の取得**  
   - フォームナビのポップアップ上で「AI連携」や「入力候補取得」などのボタンを押すと、AIが最適な入力を提案します。  
   - 必要に応じてPDFやWebページ情報をアップロード・抽出し、AIの判断材料に加えることも可能です。  
3. **入力内容の微調整**  
   - AIが提案する候補が複数ある場合、ユーザーが適切なものを選択・修正できます。  
4. **一括適用**  
   - 「フォームに反映」ボタンなどを押すと、ブラウザ上のフォームにAI候補が自動入力されます。  
5. **送信**  
   - フォームの内容を確認し、必要であれば送信。  
   - 送信完了後、状況に応じて結果がSaaSや他システムに共有され、必要な処理が自動化されます。

---

## 3. 主なメリット

1. **入力作業の効率化**  
   - 住所や氏名などの定型入力だけでなく、書類内のルールや文脈をAIが判断するので、複雑なフォームでも入力作業が大幅に削減されます。
2. **システム間連携の強化**  
   - OCRなどで読み取ったデータを自動的にフォームナビ経由で反映したり、他システムから取得した情報をSaaSフォームに入力したり、接続部の作業を効率化します。
3. **「ラストワンマイル」を埋める**  
   - Excelや手作業のコピペで繋いでいた部分（システム～システム間の最終調整）をAIが補うことで、人的ミスや工数を削減できます。
4. **段階的なAI活用**  
   - 初期段階はAIが補助程度でも、使い込むことでAIの精度が上がり、やがて人の手間は大幅に減少。最終的には人は「監督や業務設計」に注力できます。
5. **人的リソースの価値向上**  
   - AIが定型作業を担うことで、スタッフはビジネスモデルの検討や新たな収益源の創出など、より価値の高い業務に集中できます。

---

## 4. 使用上の注意・推奨環境

1. **AIキーの管理**  
   - OpenAIなどのAPIキーを使用します。キーの管理には十分ご注意ください。
2. **モデル精度**  
   - AIの提案精度は、業務ドメイン・学習データなどに左右されます。必要に応じて補正や確認を行ってください。
3. **動作環境**  
   - **Chromeブラウザ**（最新バージョン推奨）。  
   - 大容量PDFや特殊なレイアウトのページではPDF抽出が正しく行えない場合があります。
4. **段階的導入**  
   - いきなりフルオート運用ではなく、最初は人が必ずチェックする運用から開始し、徐々にAIへの依存度を高めることを推奨します。

---

## 5. 今後の展望

- **マルチシステム・マルチフォーム連携**  
  より多くのSaaS/業務システムとの自動連携機能を拡充し、導入ハードルを下げる予定です。
- **ドメイン特化型AIモデルへの最適化**  
  特定業種や特定業務（保険、医療、会計など）向けにAIモデルをチューニングし、さらに高精度な自動入力を実現する構想があります。
- **完全自動化への移行**  
  ヒトが監督するステップを減らし、ルーチン処理をすべてAIが担う「ノータッチ運用」へ移行できるよう支援します。

---

## 6. よくある質問 (FAQ)

### Q1. フォームナビの導入メリットは何ですか？
A1. 従来のオートコンプリートを超えたAIによる高度な入力支援・システム連携の強化が大きな特徴です。ラストワンマイルの手作業を削減し、人は企画・改善など付加価値の高い仕事に集中できます。

### Q2. どのようなシステムと連携できますか？
A2. 基本的にChrome上で動作するWebフォームであれば対応可能です。追加でOCRツールやPDF文書から取得したデータの取り込み、SaaSとのAPI連携も今後順次強化します。

### Q3. セキュリティ面が心配です。
A3. OpenAI APIキーはユーザー管理になりますが、Chrome拡張内やブラウザローカルストレージに保管されます。業務情報は社内ルールやセキュリティポリシーに従って運用ください。

### Q4. AIが勝手に誤った値を入れてしまうことはありませんか？
A4. 自動入力でも常に人が最終確認できるようになっています。導入初期は人が適宜チェックしながら調整し、次第に誤り率も低減していきます。

---

## 7. おわりに
フォームナビは、「AIを使って業務を自動化したいが、最後の微妙な部分がどうしても人手で…」という悩みを解消するツールです。まずは補助的に運用いただき、AIの精度向上とともに人が関わる作業を減らしていく――この段階的導入が鍵となります。  
最終的にはAIに大半の定型処理を任せ、人は創造性が必要な業務に注力する未来を目指しています。ぜひフォームナビを活用し、業務効率化と新たな価値創出にお役立てください。