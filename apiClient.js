// apiClient.js
// -------------------------------------------------------
// 複数プロバイダに対応したチャットAPI送信用の共通モジュール
// -------------------------------------------------------

// Using global secureLogger without fallback implementation
// secureLogger is initialized and made available by utils/loggerSetup.js
// Add a fallback in case it's not loaded properly in the module context
const logger = (typeof secureLogger !== 'undefined') ? secureLogger : console;

/**
 * AWS Bedrock用 署名生成関数 (V4署名の簡易例)
 * ここではダミー実装として必要最小限だけ書いています。
 * 実運用では暗号化ライブラリを用いて正しい署名を生成してください。
 */
async function createAWSSignature(params) {
  const { service, region, credentials } = params;

  // ... ここで本来はV4署名を計算する ...
  // 例のダミーを返す
  return {
    'Content-Type': 'application/json',
    'X-Amz-Region': region,
    'X-Amz-Security-Token': credentials.sessionToken || '',
    'Authorization': `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/(date)/${region}/${service}/aws4_request, SignedHeaders=..., Signature=...`
  };
}

/**
 * Chat用共通送信関数
 * - 外部API (OpenAI, DeepSeek, Bedrock, Azure, Anthropic, 互換APIなど) またはローカルAPI に対して
 *   メッセージを送信し、レスポンス文字列を返す
 *
 * @param {object}  apiConfig
 * @param {string}  [userPrompt]   - 旧式の引数(省略可)。apiConfig.messages が無い場合に使う。
 * @returns {Promise<string>}
 */
export async function sendChatRequest(apiConfig, userPrompt) {
  logger.group('sendChatRequest (common module)');
  // 安全なロギング（APIキーなどの機密情報がマスクされる）
  logger.log('apiConfig:', apiConfig);
  logger.log('userPrompt:', userPrompt);

  const {
    provider,
    apiKey,
    model,
    systemPrompt = '',
    customSettings = {},
    abortController,
    temperature,
    messages  // 新たに追加したフィールド
  } = apiConfig;

  // 1) messages があればそれを使う。無ければ従来通り "systemPrompt"+"userPrompt"
  let finalMessages;
  if (messages && Array.isArray(messages)) {
    finalMessages = messages;
  } else {
    // 旧ロジック: system + user
    finalMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt || '' }
    ];
  }

  let endpoint, headers, body;

  // 2) プロバイダごとのエンドポイントとbodyを組み立て
  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'compatible':
      endpoint = (provider === 'openai')
        ? 'https://api.openai.com/v1/chat/completions'
        : (provider === 'deepseek')
          ? 'https://api.deepseek.com/v1/chat/completions'
          : `${customSettings.url}v1/chat/completions`; // compatible

      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      // OpenAI互換: model, messages
      // 例: "models/<modelName>" の指定が必要な場合は保持
      body = {
        model: (provider === 'compatible')
          ? `models/${model}`
          : model,
        messages: finalMessages,
        temperature: temperature ?? 0.7
      };
      break;

    case 'azureOpenai':
      endpoint = `${customSettings.endpoint}openai/deployments/${customSettings.deploymentName}/chat/completions?api-version=${customSettings.apiVersion}`;
      headers = {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      };
      // AzureもOpenAI互換のmessagesを使う
      body = {
        messages: finalMessages,
        temperature: temperature ?? 0.7
      };
      break;

    case 'bedrock': {
      // Bedrockは messages, systemPrompt, userPrompt を個別に指定
      const region = customSettings.region;
      const actualModelId = customSettings.crossRegionInference
        ? `${region.slice(0, 2)}.${model}`
        : model;

      endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${actualModelId}/invoke`;

      // AWS署名
      headers = await createAWSSignature({
        service: 'bedrock',
        region,
        credentials: {
          accessKey: apiKey,
          secretKey: customSettings.secretKey,
          sessionToken: customSettings.sessionToken
        }
      });

      // 画像は想定外なので無視(テキストだけ)
      // finalMessages の内、systemは systemPrompt相当、userは userPrompt相当を抽出する
      // 例として最初の userだけを使う簡易実装
      const userMessage = finalMessages.find(msg => msg.role === 'user') || { content: '' };

      body = {
        modelId: actualModelId,
        messages: [
          { role: "user", content: userMessage.content }
        ],
        system: [{ text: systemPrompt }],
        inferenceConfig: {
          maxTokens: 4096,
          temperature: temperature ?? 0.3,
          topP: 0.1
        }
      };
      break;
    }

    case 'anthropic':
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      };
      // こちらも画像は非対応 → テキスト部分のみ使用
      // max_tokensなども暫定
      // systemをどう使うかは暫定実装
      const userMsgA = finalMessages.find(msg => msg.role === 'user') || { content: '' };
      body = {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: userMsgA.content }
        ]
      };
      break;

    case 'gemini':
      // Google PaLM (Gemini) 例: generateContent など
      endpoint = `https://generativelanguage.googleapis.com/v1/${model}:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };

      // 画像は非対応 → テキストのみ
      // systemPrompt と userPrompt を連結して渡す例
      const systemMsgG = finalMessages.find(m => m.role === 'system');
      const userMsgG = finalMessages.find(m => m.role === 'user');

      body = {
        contents: [
          {
            parts: [
              { text: systemMsgG?.content ?? '' },
              { text: userMsgG?.content ?? '' }
            ]
          }
        ]
      };
      break;

    case 'local':
      // ローカルAPI
      if (!customSettings.url) {
        logger.groupEnd();
        throw new Error('Local APIのURLが設定されていません');
      }
      {
        const baseUrl = customSettings.url.replace(/\/+$/, '');
        endpoint = `${baseUrl}/chat/sendMessage`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };

        // 画像は非対応 → テキストのみ送る
        // systemPrompt + userPrompt を送る例
        const userMsgLoc = finalMessages.find(m => m.role === 'user') || { content: '' };

        body = {
          token: apiKey,
          message: userMsgLoc.content,
          sys: systemPrompt
        };
      }
      break;

    default:
      logger.groupEnd();
      throw new Error(`Unsupported provider: ${provider}`);
  }

  // 3) fetch 実行
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: abortController?.signal
  });

  const data = await response.json();
  // 安全なロギング
  logger.log('APIレスポンス:', data);
  logger.groupEnd();

  if (!response.ok) {
    throw new Error(data.error?.message || 'API呼び出しに失敗しました');
  }

  // 4) レスポンス整形
  let resultText = '';

  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'compatible':
    case 'azureOpenai':
      // 全部 OpenAI互換形式
      resultText = data.choices?.[0]?.message?.content || '';
      break;

    case 'bedrock':
      // bedrockの場合
      resultText = data.completion || data.choices?.[0]?.message?.content || '';
      break;

    case 'anthropic':
      // 例: data.content[0].text
      resultText = data.content?.[0]?.text || '';
      break;

    case 'gemini':
      // 例: data.candidates[0].content.parts[0].text
      resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      break;

    case 'local':
      // ローカルAPI 例
      resultText = data.content || data.message || '';
      break;
  }

  return resultText;
}
