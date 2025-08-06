
import { Model } from '../architecture.js';

/**
 * チャット機能用データモデルクラス
 * 
 * チャット機能のデータモデルを表します。
 * メッセージ、会話状態、API設定を管理します。
 */
export class ChatModel extends Model {
    /**
     * コンストラクタ
     * 
     * @param {Object} data - モデルの初期データ
     */
    constructor(data = {}) {
        const defaultData = {
            messages: [],
            isProcessing: false,
            currentProvider: null,
            currentModel: null,
            systemPrompt: `You are a high-performance AI assistant. Please respond according to the following instructions:

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
- Use the webpage information as supplementary, referring only to parts directly related to the user's question.`,
            pageContext: {
                title: '',
                url: '',
                content: ''
            },
            includePageContext: false,
            ...data
        };
        
        super(defaultData);
    }
    
    /**
     * 会話にメッセージを追加
     * 
     * @param {Object} message - 追加するメッセージ
     * @param {string} message.role - メッセージ送信者の役割 (user, assistant, system)
     * @param {string} message.content - メッセージの内容
     * @param {string} [message.timestamp] - メッセージのタイムスタンプ (デフォルトは現在時刻)
     * @returns {ChatModel} - チェーンメソッド用のモデルインスタンス
     */
    addMessage(message) {
        const { role, content, timestamp = new Date().toISOString(), ...otherProps } = message;
        
        if (!role || !content) {
            throw new Error('Message must have a role and content');
        }
        
        const newMessage = {
            role,
            content,
            timestamp,
            ...otherProps
        };
        
        console.log('Adding message to model:', {
            role,
            hasPageHTML: !!newMessage.pageHTML,
            pageHTMLLength: newMessage.pageHTML?.length || 0,
            allProps: Object.keys(newMessage),
            pageHTMLValue: newMessage.pageHTML
        });
        
        const messages = [...this.get('messages')];
        
        messages.push(newMessage);
        
        this.set('messages', messages);
        
        return this;
    }
    
    /**
     * すべてのメッセージをクリア
     * 
     * @returns {ChatModel} - チェーンメソッド用のモデルインスタンス
     */
    clearMessages() {
        this.set('messages', []);
        return this;
    }
    
    /**
     * 処理状態を設定
     * 
     * @param {boolean} isProcessing - チャットがメッセージを処理中かどうか
     * @returns {ChatModel} - チェーンメソッド用のモデルインスタンス
     */
    setProcessing(isProcessing) {
        this.set('isProcessing', isProcessing);
        return this;
    }
    
    /**
     * 現在のプロバイダーとモデルを設定
     * 
     * @param {string} provider - APIプロバイダー (openai, anthropic, など)
     * @param {string} model - モデル名
     * @returns {ChatModel} - チェーンメソッド用のモデルインスタンス
     */
    setProviderAndModel(provider, model) {
        this.update({
            currentProvider: provider,
            currentModel: model
        });
        return this;
    }
    
    /**
     * システムプロンプトを設定
     * 
     * @param {string} systemPrompt - システムプロンプト
     * @returns {ChatModel} - チェーンメソッド用のモデルインスタンス
     */
    setSystemPrompt(systemPrompt) {
        this.set('systemPrompt', systemPrompt);
        return this;
    }
    
    /**
     * ページコンテキストを設定
     * 
     * @param {Object} pageContext - ページコンテキスト
     * @param {string} pageContext.title - ページタイトル
     * @param {string} pageContext.url - ページURL
     * @param {string} pageContext.content - ページ内容
     * @returns {ChatModel} - チェーンメソッド用のモデルインスタンス
     */
    setPageContext(pageContext) {
        this.set('pageContext', {
            ...this.get('pageContext'),
            ...pageContext
        });
        return this;
    }
    
    /**
     * APIリクエストに適した形式でメッセージを取得
     * 
     * @returns {Array} - メッセージ配列
     */
    getMessagesForApi() {
        const systemPrompt = this.get('systemPrompt');
        const messages = this.get('messages');
        
        if (systemPrompt) {
            return [
                { role: 'system', content: systemPrompt },
                ...messages
            ];
        }
        
        return [...messages];
    }
    
    /**
     * 会話履歴をフォーマットされた文字列として取得
     * 
     * @param {number} [maxTurns=4] - 含めるターンの最大数
     * @returns {string} - フォーマットされた会話履歴
     */
    getFormattedHistory(maxTurns = 4) {
        const messages = this.get('messages');
        
        const turns = [];
        let currentTurn = { user: null, assistant: null };
        
        for (const message of messages) {
            if (message.role === 'user') {
                if (currentTurn.user !== null) {
                    turns.push({ ...currentTurn });
                    currentTurn = { user: null, assistant: null };
                }
                currentTurn.user = message;
            } else if (message.role === 'assistant') {
                currentTurn.assistant = message;
                if (currentTurn.user !== null) {
                    turns.push({ ...currentTurn });
                    currentTurn = { user: null, assistant: null };
                }
            }
        }
        
        if (currentTurn.user !== null || currentTurn.assistant !== null) {
            turns.push(currentTurn);
        }
        
        let markdown = '';
        
        if (turns.length > 0) {
            markdown += "# Recent dialogue\n\n";
            
            const recentTurns = turns.slice(-maxTurns);
            
            recentTurns.forEach((turn, index) => {
                markdown += `## Turn ${index + 1}\n\n`;
                
                if (turn.user) {
                    markdown += `### User\n\n\`\`\`\n${turn.user.content}\n\`\`\`\n\n`;
                }
                
                if (turn.assistant) {
                    markdown += `### Assistant\n\n\`\`\`\n${turn.assistant.content}\n\`\`\`\n\n`;
                }
            });
        }
        
        return markdown;
    }
}

/**
 * ChatModelインスタンスを作成するファクトリ関数
 * 
 * @param {Object} container - 依存性注入コンテナ
 * @returns {ChatModel} - ChatModelインスタンス
 */
export const createChatModel = (container) => {
    return new ChatModel();
};