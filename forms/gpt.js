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
        
        **重要な要件**:
        1. 提供されたフォームフィールドの数と同じ数のform_suggestionオブジェクトを必ず返却してください
        2. すべてのフィールドに対して少なくとも1つの入力候補を生成してください
        3. コンテキスト情報がない場合でも、フィールドのタイプとラベルに基づいて適切な例示データを生成してください
        
        以下の形式でデータを返却してください：
        {
          "form_suggestions": [
            {
              "form_id": "form-element-0",  // 必ず提供されたフォームのIDを正確に使用
              "suggestions": [
                {
                  "value": "入力候補の値1",
                  "confidence": 0.95,  // 確信度（0-1の範囲）
                  "reason": "この値を提案する理由1"
                },
                ...
              ]
            },
            {
              "form_id": "form-element-1",  // 複数フィールドがある場合は各フィールドごとに生成
              "suggestions": [...]
            }
          ]
        }
        
        **必須**: 提供されたすべてのフォームフィールドに対してform_suggestionオブジェクトを作成してください。
        一つでもフィールドを省略した場合はエラーとなります。
      `,
      execution_definition: `
        処理手順:
        1. 提供されたフォーム情報を解析 - 全フィールドのID、タイプ、ラベルを確認
        2. マニュアル・ルールに基づいて適切な入力候補を生成
        3. 手続き・処理情報から関連する入力値を抽出
        4. Web画面の情報を考慮して候補を調整
           - Web画面から抽出された情報には、氏名、会社名、メールアドレス、電話番号などの具体的な値が含まれている可能性があります
           - これらの値をフォームフィールドのラベルや種類と照合して、適切にマッピングしてください
           - 例: "山田太郎" → name フィールド、"yamada@example.com" → email フィールド
        5. 各候補に対して確信度と理由を付与
        6. フォームタイプに応じた適切な形式で値を返却
        
        **絶対的要件**: 
        - 提供されたフォームフィールドの数を数え、その数と同じ数のform_suggestionオブジェクトを必ず生成してください
        - 各フィールドのform_idを正確に使用してください
        - 一つでもフィールドを省略することは許されません
        - コンテキスト情報が不足している場合でも、フィールドタイプに基づいて適切な例示データを生成してください
        
        **例示データ生成ルール（コンテキストがない場合）**:
        - name/名前フィールド: 日本人の一般的な名前（例: 田中太郎）
        - company/会社名フィールド: 一般的な会社名（例: 株式会社サンプル）
        - email/メールフィールド: 有効な形式のメールアドレス（例: sample@example.com）
        - tel/電話番号フィールド: 日本の電話番号形式（例: 03-1234-5678）
        - message/メッセージフィールド: フィールドの用途に応じた適切な文章
        - date/日付フィールド: 現在または近い将来の日付
        - number/数値フィールド: フィールドの用途に応じた適切な数値
        
        **Web画面抽出データの活用**:
        - Web画面から抽出された情報に含まれる具体的な値（人名、会社名、連絡先等）を積極的に活用してください
        - キー：値 形式のデータがある場合は、キーをフォームフィールドのラベルと照合してください
        - 文脈から推測される情報も考慮してください（例：「お問い合わせ」ページなら、問い合わせ内容に関連する情報を優先）
        
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
    const userPromptContent = this._buildUserPrompt(formData, processDoc, webExtract, userPrompt, !!imageData);

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
  _buildUserPrompt(formData, processDoc, webExtract, userPrompt, hasImage = false) {
    debugLog('_buildUserPrompt', 'Building user prompt', { 
      hasImage,
      hasProcessDoc: !!processDoc,
      hasWebExtract: !!webExtract,
      hasUserPrompt: !!userPrompt
    });
    
    let prompt = '';
    if (hasImage) {
      prompt = '提供された画像を詳しく分析し、画像に含まれる情報（テキスト、フォーム、文書など）からデータを抽出して、すべてのフォームフィールドの入力候補を生成してください：\n\n';
      prompt += '重要: 画像情報を最優先で使用し、以下のテキスト情報は参考程度に留めてください。\n\n';
    } else {
      prompt = '以下の情報に基づいて、すべてのフォームフィールドの入力候補を生成してください：\n\n';
    }

    if (processDoc) {
      prompt += `手続き・処理内容：\n${processDoc}\n\n`;
    }
    
    // Always include web extract content with proper priority
    if (webExtract) {
      if (hasImage) {
        // When image is present, mention web content but de-prioritize it
        prompt += `Web画面情報（参考のみ、画像情報を優先）：\n${webExtract}\n\n`;
      } else {
        // When no image, web extract should be treated as primary source
        prompt += `Web画面から抽出された情報（これを主要な情報源として使用してください）：\n${webExtract}\n\n`;
        prompt += `重要: 上記のWeb画面から抽出された情報を詳しく分析し、以下の観点でフォームフィールドに適合する値を抽出してください：\n`;
        prompt += `1. 明示的に記載されている値（例：「氏名: 山田太郎」→ nameフィールドに「山田太郎」）\n`;
        prompt += `2. フォーマットから推測できる値（例：「xxx@yyy.com」形式 → emailフィールド）\n`;
        prompt += `3. ラベルや文脈から関連付けられる値（例：「会社名」「企業名」「所属」→ companyフィールド）\n`;
        prompt += `4. 日本語と英語のラベルの対応（例：「お名前」→ name、「メールアドレス」→ email）\n\n`;
      }
    }
    
    if (userPrompt) {
      prompt += `追加の指示：\n${userPrompt}\n\n`;
    }

    // Add explicit instruction for multiple fields
    const formCount = Array.isArray(formData) ? formData.length : 0;
    if (hasImage) {
      prompt += `画像解析指示: 画像に含まれる以下の情報を特に注意深く抽出してください：\n`;
      prompt += `- 氏名、会社名、メールアドレス、住所などの個人/企業情報\n`;
      prompt += `- フォームフィールドに記入された内容\n`;
      prompt += `- 文書やカード、名刺などに記載された情報\n`;
      prompt += `- 手書きまたは印字されたテキスト\n`;
      prompt += `- 電話番号、郵便番号、URL、その他の連絡先情報\n`;
      prompt += `- 日付、金額、数値などの具体的なデータ\n\n`;
      
      prompt += `注意事項: 画像から読み取った情報のみを使用してフォームデータを生成してください。\n`;
      prompt += `Web画面の既存の値や初期値は無視し、画像に写っている情報のみに基づいて回答してください。\n\n`;
    }
    
    prompt += `\n**必須要件**: 以下のフォームには${formCount}個のフィールドがあります。\n`;
    prompt += `あなたは必ず${formCount}個のform_suggestionオブジェクトを返却してください。\n`;
    prompt += `各フィールドに対して少なくとも1つの入力候補を生成してください。\n`;
    prompt += `コンテキスト情報がない場合でも、フィールドのタイプとラベルに基づいて適切な例示データを生成してください。\n\n`;

    prompt += `対象フォーム（${formCount}個のフィールド - すべて必須）：\n${JSON.stringify(formData, null, 2)}\n\n`;
    
    prompt += `再度確認: 上記の${formCount}個のフィールドすべてに対してform_suggestionを生成してください。`;

    debugLog('_buildUserPrompt', 'User prompt built', { 
      length: prompt.length,
      formCount: formCount,
      formIds: Array.isArray(formData) ? formData.map(f => f.id) : []
    });
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
    //    OpenAI、OpenAI-compatible APIs support vision (Claude and Gemini need proper implementation)
    const imageCapableProviders = ['openai', 'compatible', 'azureOpenai', 'claude', 'anthropic', 'gemini'];
  
    // 画像送信可能かどうか
    const providerSupportsImages = imageCapableProviders.includes(this.provider);
    
    debugLog('sendToGPT', 'Provider and image capability check', {
      currentProvider: this.provider,
      imageCapableProviders,
      providerSupportsImages,
      hasImageData: !!promptObj.imageData
    });
  
    // 3) messages 配列を構築
    let messages;
    if (promptObj.imageData && providerSupportsImages) {
      // 画像対応 & 画像あり → 画像を別要素で送る
      if (this.provider === 'anthropic' || this.provider === 'claude') {
        // Claude format with proper vision support
        debugLog('sendToGPT', 'Using Claude vision API format');
        
        // Extract mime type from data URL
        const mimeType = promptObj.imageData.split(';')[0].split(':')[1] || 'image/jpeg';
        const base64Data = promptObj.imageData.split(',')[1];
        
        messages = [
          { role: 'system', content: promptObj.systemPrompt },
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: promptObj.userPrompt
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ];
      } else if (this.provider === 'gemini') {
        // Gemini format with proper vision support
        debugLog('sendToGPT', 'Using Gemini vision API format');
        
        // Extract mime type from data URL
        const mimeType = promptObj.imageData.split(';')[0].split(':')[1] || 'image/jpeg';
        const base64Data = promptObj.imageData.split(',')[1];
        
        // Gemini requires a different structure - parts array with text and inline_data
        messages = [
          { role: 'system', content: promptObj.systemPrompt },
          {
            role: 'user',
            parts: [
              { text: promptObj.userPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ];
      } else {
        // OpenAI and compatible APIs format
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
      }
    } else {
      // 画像が無い or プロバイダー非対応の場合 → テキストだけ送る
      debugLog('sendToGPT', 'Sending text-only request', {
        reason: !promptObj.imageData ? 'No image data' : 'Provider does not support images',
        hasImageData: !!promptObj.imageData,
        providerSupportsImages
      });
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
   * - JSON後の追加テキストも除去
   */
  _parseGPTResponse(responseText) {
    debugLog('_parseGPTResponse', 'Parsing GPT response');
    try {
      // Method 1: Try to extract JSON from markdown code block
      const jsonCodeBlockMatch = responseText.match(/```json\s*([\s\S]*?)```/);
      if (jsonCodeBlockMatch) {
        const jsonContent = jsonCodeBlockMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        debugLog('_parseGPTResponse', 'Response parsed successfully from code block', { parsed });
        return parsed;
      }

      // Method 2: Try to find JSON object in the text
      // Look for content that starts with { and ends with }
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Find the last closing brace that matches the first opening brace
        let braceCount = 0;
        let jsonEndIndex = -1;
        const jsonString = jsonMatch[0];
        
        for (let i = 0; i < jsonString.length; i++) {
          if (jsonString[i] === '{') braceCount++;
          else if (jsonString[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEndIndex = i + 1;
              break;
            }
          }
        }
        
        if (jsonEndIndex > 0) {
          const cleanedJson = jsonString.substring(0, jsonEndIndex);
          const parsed = JSON.parse(cleanedJson);
          debugLog('_parseGPTResponse', 'Response parsed successfully from extracted JSON', { parsed });
          return parsed;
        }
      }

      // Method 3: Fallback - try to parse as is after basic cleanup
      const cleaned = responseText
        .replace(/```json\s*/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      debugLog('_parseGPTResponse', 'Response parsed successfully with fallback method', { parsed });
      return parsed;
    } catch (error) {
      debugLog('_parseGPTResponse', 'Error parsing response', { 
        error: error.message,
        responsePreview: responseText.substring(0, 200) + '...'
      });
      throw new Error('GPTからの応答の解析に失敗しました: ' + error.message);
    }
  }
}

export default GPTService;
