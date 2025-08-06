/**
 * エクステンション全体で一貫したエラー管理を行う中央集中型エラーハンドリングユーティリティ
 */
const logger = (typeof secureLogger !== 'undefined') ? secureLogger : console;

/**
 * エラーの分類とハンドリングを改善するためのエラーカテゴリ
 */
export const ErrorCategory = {
  API: 'api_error',
  AUTHENTICATION: 'auth_error',
  VALIDATION: 'validation_error',
  NETWORK: 'network_error',
  STORAGE: 'storage_error',
  UI: 'ui_error',
  UNKNOWN: 'unknown_error'
};

/**
 * 標準化されたエラーオブジェクト用のExtensionErrorクラス
 */
export class ExtensionError extends Error {
  constructor(message, category = ErrorCategory.UNKNOWN, originalError = null) {
    super(message);
    this.name = 'ExtensionError';
    this.category = category;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  /**
   * ユーザーフレンドリーなエラーメッセージを取得
   */
  getUserMessage() {
    return this.message;
  }

  /**
   * ログ出力用の詳細なエラー情報を取得
   */
  getDetailedInfo() {
    return {
      message: this.message,
      category: this.category,
      timestamp: this.timestamp,
      originalError: this.originalError ? {
        message: this.originalError.message,
        name: this.originalError.name,
        stack: this.originalError.stack
      } : null
    };
  }
}

/**
 * API固有のエラーを処理
 * @param {Error} error - 元のエラー
 * @param {string} apiProvider - APIプロバイダー名
 * @returns {ExtensionError} - 標準化されたエクステンションエラー
 */
export function handleApiError(error, apiProvider = 'unknown') {
  let message = `API エラー (${apiProvider}): `;
  let category = ErrorCategory.API;

  if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
    message = `ネットワーク接続エラー: ${apiProvider} APIに接続できません`;
    category = ErrorCategory.NETWORK;
  } 
  else if (error.message.includes('401') || 
           error.message.includes('unauthorized') || 
           error.message.includes('invalid_key')) {
    message = `認証エラー: ${apiProvider} APIキーが無効または期限切れです`;
    category = ErrorCategory.AUTHENTICATION;
  }
  else {
    message += error.message;
  }

  return new ExtensionError(message, category, error);
}

/**
 * メインエラーハンドラー関数
 * @param {Error} error - 処理するエラー
 * @param {Object} options - エラー処理の追加オプション
 * @returns {ExtensionError} - 標準化されたエクステンションエラー
 */
export function handleError(error, options = {}) {
  const { 
    category = ErrorCategory.UNKNOWN,
    context = '',
    showToUser = true,
    userMessageCallback = null
  } = options;

  if (error instanceof ExtensionError) {
    logError(error, context);
    if (showToUser && userMessageCallback) {
      userMessageCallback(error.getUserMessage());
    }
    return error;
  }

  const extensionError = new ExtensionError(
    error.message || 'An unknown error occurred',
    category,
    error
  );

  logError(extensionError, context);

  if (showToUser && userMessageCallback) {
    userMessageCallback(extensionError.getUserMessage());
  }

  return extensionError;
}

/**
 * 一貫したフォーマットでエラーをログ出力
 * @param {ExtensionError} error - ログ出力するエラー
 * @param {string} context - 追加のコンテキスト情報
 */
function logError(error, context = '') {
  const contextPrefix = context ? `[${context}] ` : '';
  
  if (error instanceof ExtensionError) {
    logger.error(`${contextPrefix}Error (${error.category}):`, error.getDetailedInfo());
    if (error.originalError && error.originalError.stack) {
      logger.error(`${contextPrefix}Original stack trace:`, error.originalError.stack);
    }
  } else {
    logger.error(`${contextPrefix}Unhandled error:`, error);
  }
}

/**
 * 関数を実行し、エラーを処理
 * @param {Function} fn - 実行する関数
 * @param {Object} options - エラー処理オプション
 * @returns {Promise<*>} - 関数の結果またはExtensionErrorをスロー
 */
export async function tryCatch(fn, options = {}) {
  try {
    return await fn();
  } catch (error) {
    return handleError(error, options);
  }
}

export default {
  handleError,
  handleApiError,
  tryCatch,
  ErrorCategory,
  ExtensionError
};