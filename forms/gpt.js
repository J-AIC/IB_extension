// forms/gpt.js
// -------------------------------------------------------
// OpenAI（含む各種互換プロバイダ）API連携 for フォーム入力支援
// -------------------------------------------------------
const DEBUG = true;

// Using global secureLogger without fallback implementation
// secureLogger is initialized and made available by utils/loggerSetup.js
// No more fallback needed as it's guaranteed to be available

function debugLog(section, message, data = null) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  const log = `[GPTService][${section}][${timestamp}] ${message}`;
  secureLogger.log(log);
  if (data) {
    secureLogger.log('Data:', JSON.stringify(data, null, 2));
  }
}

// [追加] 共通モジュールのインポート
import { sendChatRequest } from '../apiClient.js';
// ↑ フォルダ構成にあわせてパスを調整してください。

class GPTService {
  constructor() {
    debugLog('Constructor', 'Initializing GPTService');

    // ======================================
    // 共通パラメータ
    // ======================================
    this.apiKey = null;
    this.model = null;
    this.provider = 'openai';  // [追加] 複数プロバイダに対応できるように
    this.customSettings = {};

    // モデル一覧キャッシュ
    this.availableModels = [];

    // ======================================
    // 以下は旧コードにある「フォーム出力用テンプレ」
    // ======================================
    this.systemPromptTemplate = {
      input_output_definition: `
        あなたはフォーム入力支援AIアシスタントです。
        以下の形式でデータを返却してください：
        {
          "form_suggestions": [
            {
              "form_id": "フォームの識別子",
              "suggestions": [
                {
                  "value": "入力候補の値1",
                  "confidence": 0.95,  // 確信度（0-1の範囲）
                  "reason": "この値を提案する理由1"
                },
                ...
              ]
            }
          ]
        }
      `,
      execution_definition: `
        処理手順:
        1. 提供されたフォーム情報を解析
        2. マニュアル・ルールに基づいて適切な入力候補を生成
        3. 手続き・処理情報から関連する入力値を抽出
        4. Web画面の情報を考慮して候補を調整
        5. 各候補に対して確信度と理由を付与
        6. フォームタイプに応じた適切な形式で値を返却
        ※ フォーム個別の**prompt**がある場合は、その**promptを最優先で考慮**してください。
        ※ promptには具体的な入力候補や制約条件が含まれている場合があります。
      `,
      form_type_definitions: {
        text: {
          description: "通常のテキスト入力フィールド",
          format: "string",
          validation: "一般的なテキスト",
          example: "山田太郎"
        },
        number: {
          description: "数値入力フィールド",
          format: "number",
          validation: "整数または小数",
          example: "12345"
        },
        email: {
          description: "メールアドレスフィールド",
          format: "string",
          validation: "有効なメールアドレス形式",
          example: "example@domain.com"
        },
        tel: {
          description: "電話番号フィールド",
          format: "string",
          validation: "電話番号形式",
          example: "03-1234-5678"
        },
        date: {
          description: "日付フィールド",
          format: "YYYY-MM-DD",
          validation: "有効な日付",
          example: "2024-02-09"
        },
        radio: {
          description: "ラジオボタングループ",
          format: "選択肢の値のいずれか",
          validation: "定義された選択肢の中から1つ",
          example: "option1"
        },
        checkbox: {
          description: "チェックボックスグループ",
          format: "boolean or array of selected values",
          validation: "true/false または選択値の配列",
          example: ["option1", "option2"]
        },
        select: {
          description: "セレクトボックス",
          format: "選択肢の値のいずれか",
          validation: "定義された選択肢の中から1つ",
          example: "selected_value"
        },
        textarea: {
          description: "複数行テキスト入力",
          format: "string",
          validation: "複数行テキスト",
          example: "複数行の\nテキスト内容"
        }
      }
    };
    debugLog('Constructor', 'GPTService initialized');
  }

  // ----------------------------------------
  // 既存の補助メソッドなど
  // ----------------------------------------

  /**
   * 画像モデル対応かどうか判定
   */
  modelMatchesImageProcessing() {
    // 必要に応じてロジック拡張
    return true;
  }

  /**
   * APIキーを設定
   */
  setApiKey(apiKey) {
    debugLog('setApiKey', 'Setting API key', { keyLength: apiKey?.length });
    this.apiKey = apiKey;
  }

  /**
   * 使用モデルを設定
   */
  setModel(model) {
    debugLog('setModel', 'Setting model', { model });
    this.model = model;
  }

  /**
   * プロバイダを設定 (openai, local, bedrock, etc)
   */
  setProvider(provider) {
    debugLog('setProvider', 'Setting provider', { provider });
    this.provider = provider;
  }

  /**
   * 追加カスタム設定 (endpoint, region等)
   */
  setCustomSettings(customSettings) {
    debugLog('setCustomSettings', 'Setting customSettings', { customSettings });
    this.customSettings = customSettings;
  }



  // -----------------------------------------------------------
  // (A) 新規: フォーム向けプロンプトを生成するメソッド群 (旧コードのgeneratePrompt他)
  // -----------------------------------------------------------

  /**
   * フォーム情報、PDF抽出テキスト、Web抽出テキスト、ユーザープロンプト等から
   * systemPrompt & userPrompt をまとめたオブジェクトを返す
   */
  async generatePrompt(formData, manualRules, processDoc, webExtract, userPrompt, imageData) {
    debugLog('generatePrompt', 'Generating prompts', {
      formDataCount: formData?.length,
      hasManualRules: !!manualRules,
      hasProcessDoc: !!processDoc,
      hasWebExtract: !!webExtract,
      hasUserPrompt: !!userPrompt,
      hasImage: !!imageData
    });

    const systemPrompt = this._buildSystemPrompt(formData, manualRules);
    const userPromptContent = this._buildUserPrompt(formData, processDoc, webExtract, userPrompt);

    debugLog('generatePrompt', 'Prompts generated successfully');
    return {
      systemPrompt,
      userPrompt: userPromptContent,
      imageData // 画像データがあれば保持
    };
  }

  /**
   * systemPrompt生成
   */
  _buildSystemPrompt(formData, manualRules) {
    debugLog('_buildSystemPrompt', 'Building system prompt');
    const prompt = `
${this.systemPromptTemplate.input_output_definition}

${this.systemPromptTemplate.execution_definition}

フォーム定義:
${JSON.stringify(formData, null, 2)}

フォームタイプ定義:
${JSON.stringify(this.systemPromptTemplate.form_type_definitions, null, 2)}

入力規則:
${manualRules ? this._parseManualRules(manualRules) : "特定の入力規則はありません。"}
`;
    debugLog('_buildSystemPrompt', 'System prompt built', { length: prompt.length });
    return prompt;
  }

  /**
   * userPrompt生成
   */
  _buildUserPrompt(formData, processDoc, webExtract, userPrompt) {
    debugLog('_buildUserPrompt', 'Building user prompt');
    let prompt = '以下の情報に基づいてフォームの入力候補を生成してください：\n\n';

    if (processDoc) {
      prompt += `手続き・処理内容：\n${processDoc}\n\n`;
    }
    if (webExtract) {
      prompt += `Web画面から抽出された情報：\n${webExtract}\n\n`;
    }
    if (userPrompt) {
      prompt += `追加の指示：\n${userPrompt}\n\n`;
    }

    prompt += `対象フォーム：\n${JSON.stringify(formData, null, 2)}`;

    debugLog('_buildUserPrompt', 'User prompt built', { length: prompt.length });
    return prompt;
  }

  /**
   * ルールテキストのパース（必要であれば）
   */
  _parseManualRules(manualRules) {
    debugLog('_parseManualRules', 'Parsing manual rules');
    try {
      // 必要に応じて JSON.parse など
      // ここでは文字列そのまま返すだけ
      return manualRules;
    } catch (error) {
      debugLog('_parseManualRules', 'Error parsing manual rules', { error: error.message });
      return "ルールの解析に失敗しました。";
    }
  }

  // -----------------------------------------------------------
  // (B) メイン: 外部APIへ送信するメソッド (sendToGPT) ※改修
  // -----------------------------------------------------------
  /**
   * 旧コードでは fetch('https://api.openai.com/v1/chat/completions') を直に呼んでいたが、
   * 今回は共通モジュール sendChatRequest(apiConfig, userPrompt) を利用する。
   */
  async sendToGPT(promptObj) {
    debugLog('sendToGPT', 'Sending request to GPT', {
      systemPromptLength: promptObj.systemPrompt.length,
      userPromptLength: promptObj.userPrompt.length,
      hasImage: !!promptObj.imageData
    });
  
    // 1) 前提チェック (ローカル以外なら apiKey, model が必要)
    //if (!this.apiKey || (!this.model && this.provider !== 'local')) {
    //  throw new Error('APIキーとモデルが必要です');
    //}
  
    // 2) 「画像対応プロバイダー」かどうかを判定
    //    例：OpenAI系("openai", "deepseek", "compatible")のみ対応としたいなら以下に追加
    const imageCapableProviders = ['openai', 'compatible'];
  
    // 画像送信可能かどうか
    const providerSupportsImages = imageCapableProviders.includes(this.provider);
  
    // 3) messages 配列を構築
    let messages;
    if (promptObj.imageData && providerSupportsImages) {
      // 画像対応 & 画像あり → 画像を別要素で送る
      messages = [
        { role: 'system', content: promptObj.systemPrompt },
        {
          role: 'user',
          // ここでは content を配列にして「テキスト + 画像URL」の例をまとめて送る
          content: [
            { type: 'text', text: promptObj.userPrompt },
            { type: 'image_url', image_url: { url: promptObj.imageData } }
          ]
        }
      ];
    } else {
      // 画像が無い or プロバイダー非対応の場合 → テキストだけ送る
      messages = [
        { role: 'system', content: promptObj.systemPrompt },
        { role: 'user', content: promptObj.userPrompt }
      ];
    }
  
    // 4) sendChatRequest() 用の config を生成
    const apiConfig = {
      provider: this.provider,   // 例: "openai", "azureOpenai", ...
      apiKey: this.apiKey,
      model: this.model,
      systemPrompt: promptObj.systemPrompt,
      customSettings: this.customSettings,
      temperature: 0.7,
      messages     // 上記で組み立てた messages を渡す
    };
  
    // 5) 実行 (userPromptを第2引数に渡さず、messages優先で送る)
    let responseText;
    try {
      // 送信
      responseText = await sendChatRequest(apiConfig);
      debugLog('sendToGPT', 'API request successful, raw text:', { responseText });
    } catch (error) {
      debugLog('sendToGPT', 'Error in API request via sendChatRequest', { error: error.message });
      throw new Error('API呼び出しに失敗しました: ' + error.message);
    }
  
    // 6) フォーム用のJSONを想定 → parse
    return this._parseGPTResponse(responseText);
  }

  /**
   * GPTレスポンスをJSONパース
   * - Markdownコードブロックが含まれる場合は除去
   */
  _parseGPTResponse(responseText) {
    debugLog('_parseGPTResponse', 'Parsing GPT response');
    try {
      // 先にマークダウンのコードブロックを除去
      const cleaned = responseText
        .replace(/```json\s*/g, '')   // ```json の行を削除
        .replace(/```/g, '')          // 残りの ``` を削除
        .trim();

      const parsed = JSON.parse(cleaned);
      debugLog('_parseGPTResponse', 'Response parsed successfully', { parsed });
      return parsed;
    } catch (error) {
      debugLog('_parseGPTResponse', 'Error parsing response', { error: error.message });
      throw new Error('GPTからの応答の解析に失敗しました');
    }
  }
}

export default GPTService;
