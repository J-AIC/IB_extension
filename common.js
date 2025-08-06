/**
 * 言語管理クラス
 * 対応言語の判定、メッセージファイルの読み込みとキャッシュ、ページ要素の翻訳を担当
 */
window.LanguageManager = class {
  static supportedLangs = ['en', 'ja'];

  static _messagesCache = null;

  /**
   * 現在の言語コードを返す
   * @returns {string} 言語コード
   */
  static getCurrentLanguage() {
    const browserLang = chrome.i18n.getUILanguage();
    const lang = browserLang.split('-')[0];
    return this.supportedLangs.includes(lang) ? lang : 'en';
  }

  /**
   * 現在の言語のメッセージファイルをロード
   * @returns {Promise<Object>} メッセージデータ
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
   * ページ内の[data-i18n]要素に対して翻訳を適用
   */
  static async translatePage() {
    try {
      // 現在の言語と翻訳メッセージを取得
      const currentLang = this.getCurrentLanguage();
      const messages = await this.loadMessages();

      document.documentElement.lang = currentLang;
      console.log(`Translating page to: ${currentLang}`);

      const elements = document.querySelectorAll('[data-i18n]');
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

        if (message) {
          setTranslatedText(element, message);
          continue;
        }
        console.warn(`No translation found for key: "${key}" in language: "${currentLang}"`);
        if (currentLang !== 'en') {
          try {
            const enMessagesUrl = chrome.runtime.getURL('_locales/en/messages.json');
            const enResponse = await fetch(enMessagesUrl);
            const enMessages = await enResponse.json();
            const enMessage = enMessages[key]?.message;

            if (enMessage) {
              setTranslatedText(element, enMessage);
              console.log(`Fallback to English translation for key: "${key}"`);
            } else {
              setTranslatedText(element, key);
              console.log(`Using key as fallback for: "${key}"`);
            }
          } catch (error) {
            setTranslatedText(element, key);
            console.error(`Error loading English fallback for key: "${key}"`, error);
          }
        } else {
          setTranslatedText(element, key);
        }
      }
    } catch (error) {
      console.error('Error translating page:', error);
    }
  }

  /**
   * デバッグ用言語設定情報
   * @returns {Object} 言語設定情報
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
 * DOM読み込み完了後の初期化処理
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await LanguageManager.translatePage();
    LanguageManager.debugLanguageSettings();
  } catch (error) {
    console.error('Error during common initialization:', error);
  }
});
