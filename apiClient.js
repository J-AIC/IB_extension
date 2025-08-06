const logger = (typeof secureLogger !== 'undefined') ? secureLogger : console;

import { handleApiError, ErrorCategory } from './utils/errorHandler.js';

/**
 * AWS Bedrock用署名生成関数
 * @param {Object} params - 署名パラメータ
 * @returns {Promise<Object>} 署名ヘッダー
 */
async function createAWSSignature(params) {
  const { service, region, credentials } = params;

  return {
    'Content-Type': 'application/json',
    'X-Amz-Region': region,
    'X-Amz-Security-Token': credentials.sessionToken || '',
    'Authorization': `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/(date)/${region}/${service}/aws4_request, SignedHeaders=..., Signature=...`
  };
}

/**
 * チャット用共通送信関数
 * @param {Object} apiConfig - API設定
 * @param {string} [userPrompt] - ユーザープロンプト（旧式、省略可）
 * @returns {Promise<string>} レスポンス文字列
 */
export async function sendChatRequest(apiConfig, userPrompt) {
  logger.group('sendChatRequest (common module)');
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
    messages
  } = apiConfig;

  let finalMessages;
  if (messages && Array.isArray(messages)) {
    finalMessages = messages;
  } else {
    finalMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt || '' }
    ];
  }

  let endpoint, headers, body;
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
      body = {
        messages: finalMessages,
        temperature: temperature ?? 0.7
      };
      break;

    case 'bedrock': {
      const region = customSettings.region;
      const actualModelId = customSettings.crossRegionInference
        ? `${region.slice(0, 2)}.${model}`
        : model;

      endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${actualModelId}/invoke`;

      headers = await createAWSSignature({
        service: 'bedrock',
        region,
        credentials: {
          accessKey: apiKey,
          secretKey: customSettings.secretKey,
          sessionToken: customSettings.sessionToken
        }
      });

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
      endpoint = `https://generativelanguage.googleapis.com/v1/${model}:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };

      const systemMsgG = finalMessages.find(m => m.role === 'system');
      const userMsgG = finalMessages.find(m => m.role === 'user');

      // Handle both text-only and vision requests
      let userParts;
      if (userMsgG?.parts) {
        // Vision request with parts array
        userParts = userMsgG.parts;
      } else {
        // Text-only request
        userParts = [{ text: userMsgG?.content ?? '' }];
      }

      body = {
        contents: [
          {
            parts: [
              { text: systemMsgG?.content ?? '' },
              ...userParts
            ]
          }
        ]
      };
      break;

    case 'local':
      if (!customSettings.url) {
        logger.groupEnd();
        throw handleApiError(
          new Error('Local APIのURLが設定されていません'),
          'local'
        );
      }
      {
        const baseUrl = customSettings.url.replace(/\/+$/, '');
        endpoint = `${baseUrl}/chat/sendMessage`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };

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
      throw handleApiError(
        new Error(`Unsupported provider: ${provider}`),
        provider
      );
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: abortController?.signal
  });

  const data = await response.json();
  logger.log('APIレスポンス:', data);
  logger.groupEnd();

  if (!response.ok) {
    throw handleApiError(
      new Error(data.error?.message || 'API呼び出しに失敗しました'),
      provider
    );
  }

  let resultText = '';

  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'compatible':
    case 'azureOpenai':
      resultText = data.choices?.[0]?.message?.content || '';
      break;

    case 'bedrock':
      resultText = data.completion || data.choices?.[0]?.message?.content || '';
      break;

    case 'anthropic':
      resultText = data.content?.[0]?.text || '';
      break;

    case 'gemini':
      resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      break;

    case 'local':
      resultText = data.content || data.message || '';
      break;
  }

  return resultText;
}
