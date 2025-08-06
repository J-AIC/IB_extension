/**
 * 状態管理システムのルートリデューサー
 * すべてのドメイン固有のリデューサーを単一のリデューサーに結合する
 */

import { combineReducers } from '../stateManagement.js';

import apiSettingsReducer from './apiSettings.js';
import { reducer as chatReducer } from './chat.js';

/**
 * ルートリデューサー
 * すべてのドメイン固有のリデューサーを単一のリデューサーに結合する
 * 新しいリデューサーを作成したらここに追加する
 */
const rootReducer = combineReducers({
  apiSettings: apiSettingsReducer,
  chat: chatReducer,
});

export default rootReducer;