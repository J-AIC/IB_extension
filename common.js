// common.js

/**
 * LanguageManager
 * - 対応言語の判定
 * - メッセージファイルの読み込みとキャッシュ
 * - ページ要素の翻訳（フォールバック込み）
 * - デバッグ用ログ出力
 */
window.LanguageManager = class {
  /**
   * 対応言語リスト
   */
  static supportedLangs = ['en', 'ja', 'mn'];

  /**
   * 翻訳データのキャッシュ（初回読み込み後は再利用）
   */
  static _messagesCache = null;

  /**
   * 現在の言語コードを返す
   * - chrome.i18n.getUILanguage() から先頭部分（例: "en", "ja"）を抽出
   * - 上記が未サポート言語の場合は 'en' を返す
   */
  static getCurrentLanguage() {
    const browserLang = chrome.i18n.getUILanguage();
    const lang = browserLang.split('-')[0];
    return this.supportedLangs.includes(lang) ? lang : 'en';
  }

  /**
   * 現在の言語に対応するメッセージファイル(_locales/<lang>/messages.json)をロード
   * - 一度読み込んだ結果は this._messagesCache に保持して再利用
   */
  static async loadMessages() {
    if (this._messagesCache) {
      return this._messagesCache;
    }

    const currentLang = this.getCurrentLanguage();
    const messagesJsonUrl = chrome.runtime.getURL(`_locales/${currentLang}/messages.json`);

    try {
      const response = await fetch(messagesJsonUrl);
      const data = await response.json();
      this._messagesCache = data;
      return data;
    } catch (error) {
      console.error(`Error loading messages for language "${currentLang}":`, error);
      return {};
    }
  }

  /**
   * ページ内の[data-i18n]要素に対して翻訳を適用する
   * - キーが見つからない場合、英語ファイルをフォールバックとして試す
   * - 英語でも見つからない場合はキー文字列をそのまま表示
   */
  static async translatePage() {
    try {
      // 現在の言語と翻訳メッセージを取得
      const currentLang = this.getCurrentLanguage();
      const messages = await this.loadMessages();

      // HTMLタグのlang属性を設定
      document.documentElement.lang = currentLang;
      console.log(`Translating page to: ${currentLang}`);

      // 翻訳対象要素を全て取得
      const elements = document.querySelectorAll('[data-i18n]');

      // テキスト設定のためのヘルパー関数
      const setTranslatedText = (element, text) => {
        if (element.tagName === 'OPTION') {
          element.textContent = text;
        } else if (element.hasAttribute('placeholder')) {
          element.setAttribute('placeholder', text);
        } else {
          element.textContent = text;
        }
      };

      for (const element of elements) {
        const key = element.getAttribute('data-i18n');
        const message = messages[key]?.message;

        // メッセージが存在する場合はそのままセット
        if (message) {
          setTranslatedText(element, message);
          continue;
        }

        // ここからはフォールバック処理
        console.warn(`No translation found for key: "${key}" in language: "${currentLang}"`);
        if (currentLang !== 'en') {
          // 英語メッセージを試す
          try {
            const enMessagesUrl = chrome.runtime.getURL('_locales/en/messages.json');
            const enResponse = await fetch(enMessagesUrl);
            const enMessages = await enResponse.json();
            const enMessage = enMessages[key]?.message;

            if (enMessage) {
              setTranslatedText(element, enMessage);
              console.log(`Fallback to English translation for key: "${key}"`);
            } else {
              // 英語でも見つからない場合はキーを直接表示
              setTranslatedText(element, key);
              console.log(`Using key as fallback for: "${key}"`);
            }
          } catch (error) {
            // 英語ファイルの取得に失敗
            setTranslatedText(element, key);
            console.error(`Error loading English fallback for key: "${key}"`, error);
          }
        } else {
          // すでに英語ならキーを表示して終了
          setTranslatedText(element, key);
        }
      }
    } catch (error) {
      console.error('Error translating page:', error);
    }
  }

  /**
   * デバッグ用: 現在の言語設定をログ出力し、そのオブジェクトを返す
   */
  static debugLanguageSettings() {
    const currentLang = this.getCurrentLanguage();
    const browserLang = chrome.i18n.getUILanguage();
    const debugInfo = {
      'Current language': currentLang,
      'Browser language': browserLang,
      'HTML lang attribute': document.documentElement.lang,
    };

    console.log('Language Debug Info:', debugInfo);
    return debugInfo;
  }
};

/**
 * DOMContentLoaded後に自動翻訳とデバッグ情報出力を行う初期化処理
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await LanguageManager.translatePage();
    LanguageManager.debugLanguageSettings(); // 任意でデバッグ情報を出力
  } catch (error) {
    console.error('Error during common initialization:', error);
  }
});
