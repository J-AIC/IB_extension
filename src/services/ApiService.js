import { handleApiError, ErrorCategory } from '../../utils/errorHandler.js';

/**
 * 外部APIとの通信インターフェースを提供するサービスクラス
 */
export class ApiService {
    /**
     * コンストラクタ
     * 
     * @param {Object} [options={}] - サービスのオプション設定
     */
    constructor(options = {}) {
        this.options = {
            ...options
        };

        this.logger = (typeof secureLogger !== 'undefined') ? secureLogger : console;
    }

    /**
     * Bedrock API用のAWS署名を生成する
     * 
     * @param {Object} params - 署名生成のパラメータ
     * @param {string} params.service - AWSサービス名
     * @param {string} params.region - AWSリージョン
     * @param {Object} params.credentials - AWS認証情報
     * @returns {Promise<Object>} AWS署名付きヘッダー
     */
    async createAWSSignature(params) {
        const { service, region, credentials } = params;

        return {
            'Content-Type': 'application/json',
            'X-Amz-Region': region,
            'X-Amz-Security-Token': credentials.sessionToken || '',
            'Authorization': `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/(date)/${region}/${service}/aws4_request, SignedHeaders=..., Signature=...`
        };
    }

    /**
     * APIにチャットリクエストを送信する
     * 
     * @param {Object} apiConfig - API設定情報
     * @param {string} [userPrompt] - オプションのユーザープロンプト（レガシーパラメータ）
     * @returns {Promise<string>} APIからのレスポンス
     */
    async sendChatRequest(apiConfig, userPrompt) {
        this.logger.group('sendChatRequest (ApiService)');
        this.logger.log('apiConfig:', apiConfig);
        this.logger.log('userPrompt:', userPrompt);

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
                { role: 'user', content: userPrompt || '' }
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
                        : `${customSettings.url}v1/chat/completions`;

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

                headers = await this.createAWSSignature({
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

                // Handle complex content formats (arrays) for Gemini
                let userContent = '';
                if (userMsgG?.content) {
                    if (Array.isArray(userMsgG.content)) {
                        // Extract text from content array (ignore images for now since we don't support Gemini vision yet)
                        userContent = userMsgG.content
                            .filter(item => item.type === 'text')
                            .map(item => item.text)
                            .join('\n');
                    } else {
                        userContent = userMsgG.content;
                    }
                }

                body = {
                    contents: [
                        {
                            parts: [
                                { text: systemMsgG?.content ?? '' },
                                { text: userContent }
                            ]
                        }
                    ]
                };
                break;

            case 'local':
                if (!customSettings.url) {
                    this.logger.groupEnd();
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
                this.logger.groupEnd();
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
        this.logger.log('API response:', data);
        this.logger.groupEnd();

        if (!response.ok) {
            throw handleApiError(
                new Error(data.error?.message || 'API call failed'),
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
}

/**
 * テスト用のモックAPIサービスを作成する
 * 
 * @returns {ApiService} モックAPIサービス
 */
export const createMockApiService = () => {
    const service = new ApiService();

    service.sendChatRequest = async (apiConfig) => {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const userMessages = apiConfig.messages.filter(msg => msg.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

        return `This is a mock response to: "${lastUserMessage}"`;
    };

    return service;
};

/**
 * 依存性注入用のファクトリ関数
 * 
 * @param {Object} container - DIコンテナ
 * @returns {ApiService} APIサービスインスタンス
 */
export const createApiService = (container) => {
    return new ApiService();
};
