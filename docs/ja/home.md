# 1. はじめに

登録不要・設定簡単！  
IB_extensionは、Webサイト上で利用できるAIチャットアシスタントです。OpenAI、Anthropic、Google など、お好みのAIプロバイダーのAPIキーを設定するだけで、すぐに利用を開始できます。  
さらに、自分で立てたOpenAI互換の環境にも接続が可能です。

- 2025年2月現在、Google社のGeminiが一部無料となっており、これをご利用頂ければ無料で生成AIをお使い頂けます
- 下記記事にてアカウント設定方法をまとめています（ https://j-aic.com/techblog/-PSfeaXS ）

## 1.1 主な特徴

- 複数のAIプロバイダーに対応
- Webサイトの内容を理解した上での対話が可能
- チャット履歴の保存機能
- ガイド機能を使うことで特定のサイトで、特定ののアクションを実行することが可能です

## 1.2 情報の取り扱い

- APIキーやチャット履歴などは端末内のみ保存します
- チャット機能を通じて送信されるデータの取り扱いは、各モデルプロバイダーの利用規約をご確認ください
- 当社は本機能単独で、利用状況やデータを収集することはありません

---

# 2. 初期設定

## 2.1 APIプロバイダーの設定手順

1. **API設定画面を開く**  
   - 画面右下のチャットウィジェットを開く  
   - 下部メニューの「家」アイコンをクリック  
   - 左メニューの「API設定」をクリック
2. **プロバイダーの選択とAPIキーの設定**  
   - 利用したいAIプロバイダーのカードを探す  
   - 歯車アイコンをクリックして設定モードに入る  
   - APIキーを入力  
   - 「保存」をクリック
3. **モデルの選択**  
   - プロバイダーカードの「モデルを選択」をクリック  
   - 利用可能なモデルのリストから選択
4. **プロバイダーの有効化**  
   - 設定完了後、トグルスイッチをオンにする  
   - 正しく設定されると、ステータス表示が更新される

## 2.2 対応プロバイダー一覧

### OpenAI

- キー形式: `sk-` で始まる文字列
- 主要モデル: GPT-4, GPT-3.5-turbo
- APIキーの取得: OpenAIのウェブサイトで取得可能

### Anthropic

- キー形式: `sk-ant-api` で始まる文字列
- 主要モデル: Claude-3-Opus, Claude-3-Sonnet
- APIキーの取得: Anthropicのウェブサイトで取得可能

### Google Gemini

- キー形式: `AIza` で始まる文字列
- 主要モデル: gemini-pro
- APIキーの取得: Google Cloud Consoleで取得可能

### Deepseek

- キー形式: `sk-ds-api` で始まる文字列
- 主要モデル: Deepseek-LLM, Deepseek-XL
- APIキーの取得: Deepseekのウェブサイトで取得可能

### OpenAI Compatible

- キー形式: 任意の文字列（プロバイダーの仕様に準拠）
- 主要モデル: プロバイダーが提供するOpenAI互換モデル
- APIキーの取得: 各プロバイダーのウェブサイトで取得
- 特記事項:
  - カスタムエンドポイントURLの設定が必要
  - 使用するモデル名の手動入力が必要
  - OpenAI互換APIを提供する任意のサービスで利用可能

### Local API

- InsightBuddy独自APIです
- 別途ご契約頂くことでご利用頂けます
- フォーム読み取り機能や、フォーム入力画面をご利用頂けます

---

# 3. 基本的な使い方

## 3.1 チャットの開始

1. ブラウザの右端にある青いタブをクリック
2. チャットウィジェットが開きます
3. 下部の入力欄にメッセージを入力
4. 送信ボタンをクリックまたはEnterキーで送信

## 3.2 チャット機能の活用

- **新規チャットの開始**  
  - 右上の「＋」アイコンをクリック
- **チャット履歴の確認**  
  - 下部メニューの「時計」アイコンをクリック  
  - 過去の会話を選択して表示
- **ウェブページ内容の活用**  
  - 「今見ているサイトを取得する」をオンにすると、現在のページの内容を考慮した回答が得られます

---

# 4. トラブルシューティング

## 4.1 よくあるエラーと対処方法

### APIキーエラー

- **症状**: 「APIキーが無効です」というエラー
- **対処**:
  1. APIキーの形式が正しいか確認
  2. APIキーの有効期限を確認
  3. 必要に応じて新しいAPIキーを取得

### 接続エラー

- **症状**: メッセージが送信できない
- **対処**:
  1. インターネット接続を確認
  2. ブラウザのリロード
  3. APIプロバイダーのステータスを確認

### モデル選択エラー

- **症状**: モデルが選択できない
- **対処**:
  1. APIキーの権限を確認
  2. プロバイダーの利用制限を確認
  3. 別のモデルを試す

### OpenAI Compatible接続エラー

- **症状**: 接続できない、応答がない
- **対処**:
  1. エンドポイントURLが正しいか確認
  2. 入力したモデル名がプロバイダーの仕様と一致しているか確認
  3. APIキーの形式がプロバイダーの要件を満たしているか確認
  4. プロバイダーのサービス状態を確認

## 4.2 設定のリセット

1. API設定画面を開く
2. 各プロバイダーの設定をオフに
3. APIキーを再設定
4. モデルを再選択

---

# 5. セキュリティとプライバシー

## 5.1 データの取り扱い

- APIキーは端末内に暗号化して保存
- チャット履歴は端末内にのみ保存
- サイト情報は必要な範囲でのみ使用

## 5.2 推奨されるセキュリティ対策

- APIキーの定期的な更新
- 使用しないプロバイダーの無効化
- ブラウザのプライバシー設定の確認

## 5.3 更新情報の確認

- Chrome拡張機能の自動更新を確認
- 定期的な設定の見直しを推奨

---

# 6. 技術仕様

## 6.1 マルチターン対話システム

### 基本設計

- 最大保持ターン数: 4ターン
  - トークン数の効率的利用のため制限
  - 1ターン = ユーザーメッセージ + AIレスポンス
  - 5ターン目以降は最古のターンから削除

### 実装されている会話管理

- **Markdownフォーマットでの履歴管理**
  - Recent dialogue: 過去の会話履歴
  - Current user message: 現在の入力
  - Page Context: 現在のWebページ情報（オプション）
  - **markdown設定:**

    ```markdown
    # Recent dialogue
    ## Turn 1
    ### User
    ユーザーの発言内容
    ### Assistant
    AIの応答内容
    # Current user message
    現在のユーザー発言
    # Page Context (オプション)
    Webページコンテンツ
    ```

- **システムプロンプトは各リクエスト時に付与**
  - ユーザーの言語に合わせた応答
  - デコレーション・マークダウンの使用制限
  - 一貫性のある会話の維持
  - **システムプロンプト設定:**

    ```text
    You are a high-performance AI assistant. Please respond according to the following instructions:

    # Basic Behavior
    - The message posted by the user is stored in ("Current user message").
    - Respond in the same language used by the user in ("Current user message").
    - Keep your responses concise and accurate.
    - Do not use decorations or markdown.

    # Processing Conversation History
    - Understand the context by referring to the provided markdown formatted conversation history ("Recent dialogue").
    - Each turn is provided as "Turn X" and contains the conversation between the user and the assistant.
    - Aim for responses that remain consistent with the previous conversation.

    # Processing Web Information
    - If a "Page Context" section exists, consider the content of that webpage when answering.
    - Use the webpage information as supplementary, referring only to parts directly related to the user's question.
    ```

---

## 6.2 コンテキスト処理システム

### Webページ情報取得

- **トークン効率化のための実装**
  - 各質問時に都度取得（履歴には保存しない）
  - HTMLの最適化処理によるトークン削減
  - 不要要素の除去（script, style, iframe等）
- **ページコンテキストトグル機能**
  - ユーザーによる有効/無効の切り替え
  - Local API使用時は自動有効化

### フォーム読み取り機能

- フォーム要素の自動認識
- PDF解析機能との連携
  - PDFファイルの自動検出
  - テキスト抽出処理
  - 元のフォームコンテキストとの統合

---

## 6.3 プロバイダー管理システム

### プロバイダー固有の実装

- **OpenAI / Deepseek**
  - Bearer認証方式
  - モデル自動取得機能
- **Anthropic**
  - x-api-key認証方式
  - バージョン指定必須（2023-06-01）
- **Google Gemini**
  - APIキーによる認証
  - 独自のレスポンス形式対応
- **OpenAI Compatible**
  - カスタムエンドポイント設定
  - モデル名手動設定
  - 認証方式のカスタマイズ
- **Local API**
  - カスタムエンドポイント対応
  - 独自認証システム

### プロバイダー切り替え機能

- 単一プロバイダーのみ有効化可能
- 設定の完全性チェック
  - APIキーの形式検証
  - 必須設定項目の確認
  - モデル選択状態の確認

---

## 6.4 履歴管理システム

### 実装された保存機能

- 最大30件の会話履歴保持
- 保存データ：
  - プロバイダー情報
  - 選択モデル
  - タイムスタンプ
  - メッセージ履歴
- Chrome Storage APIとの連携
  - 拡張機能間でのデータ共有
  - フォールバックとしてのローカルストレージ

### 履歴機能

- **会話の編集機能**
  - メッセージの編集
  - 編集後の再生成
  - 以降のメッセージの自動更新
- 履歴のフィルタリング
- **プロバイダー互換性チェック**
  - モデルの一致確認
  - 互換性警告の表示

---

## 6.5 チャットウィジェットの実装

### UI/UX機能

- **iframe方式での実装**
  - 親ページとの分離
  - メッセージングによる通信
- **レスポンシブ対応**
  - 画面サイズに応じた表示調整
  - 入力エリアの自動調整

### 特殊機能

- **サイト情報表示**
  - HTMLコンテンツの表示
  - フォーム内容の表示
- **メッセージ管理**
  - 新規チャット作成
  - チャットの編集・再送信（ただしWeb情報の再利用は不可）
  - 履歴表示/非表示

---

## 6.6 セキュリティ実装

### API管理

- **APIキーの安全な保存**
  - Chrome Storage APIの利用
  - キー表示時のマスキング

### データ保護

- **ページコンテキストの制限**
  - 必要な情報のみ取得
  - センシティブ情報の除外
- **ローカルデータの管理**
  - セッション管理

---

## 6.7 デバックログ

- 下記のデバッグログを出力している

  ```javascript
  console.group('外部API送信デバッグ情報');
  console.log('送信メッセージ:', message);
  console.log('API設定:', {
      provider: apiConfig.provider,
      model: apiConfig.model,
      customSettings: apiConfig.customSettings
  });
  console.log('APIレスポンス:', result);
  console.groupEnd();
