/**
 * FormsController.js - フォーム操作のコントローラー
 */

import { Controller } from '../architecture.js';
import { FormsModel } from '../models/FormsModel.js';

/**
 * FormsController クラス
 * フォームの検出と操作のビジネスロジックを処理
 */
export class FormsController extends Controller {
  /**
   * コンストラクタ
   * 
   * @param {Object} options - コントローラーオプション
   */
  constructor(options = {}) {
    // Don't pass options as model to super, pass null instead
    super(null, null);
    
    // Always create a new FormsModel
    this.model = new FormsModel();
    
    // Initialize the model if it has an initialize method
    if (typeof this.model.initialize === 'function') {
      this.model.initialize();
    }
  }
  
  /**
   * すべてのフォームデータを取得
   * 
   * @returns {Array} フォームデータオブジェクトの配列
   */
  getFormsData() {
    return this.model.getFormsData();
  }
  
  /**
   * IDで特定のフォームを取得
   * 
   * @param {string} id - フォームID
   * @returns {Object|null} フォームデータまたはnull（見つからない場合）
   */
  getForm(id) {
    return this.model.get('forms').get(id) || null;
  }
  
  /**
   * フォーム要素に値を適用
   * 
   * @param {Object} values - 適用する値
   * @returns {FormsController} メソッドチェーン用コントローラーインスタンス
   */
  applyValues(values) {
    this.model.applyValues(values);
    return this;
  }
  
  /**
   * フォーム要素のハイライト
   * 
   * @param {Array|string} formIds - ハイライトするフォームIDの配列または単一ID
   * @param {Object} options - ハイライトオプション
   * @returns {FormsController} メソッドチェーン用コントローラーインスタンス
   */
  highlight(formIds, options = {}) {
    const ids = Array.isArray(formIds) ? formIds : [formIds];
    this.model.highlight(ids, options);
    return this;
  }
  
  /**
   * すべてのハイライトを削除
   * 
   * @returns {FormsController} メソッドチェーン用コントローラーインスタンス
   */
  removeHighlight() {
    this.model.removeHighlight();
    return this;
  }
  
  /**
   * ページからフォームを再収集してデータを更新
   * 
   * @returns {FormsController} メソッドチェーン用コントローラーインスタンス
   */
  refresh() {
    this.model.collectForms();
    return this;
  }
  
  /**
   * ラベルテキストでフォームを検索
   * 
   * @param {string} labelText - 検索するラベルテキスト
   * @param {boolean} exactMatch - 完全一致が必要かどうか
   * @returns {Array} 一致するフォームデータオブジェクトの配列
   */
  findFormsByLabel(labelText, exactMatch = false) {
    const forms = this.model.getFormsData();
    
    return forms.filter(form => {
      if (exactMatch) {
        return form.label.toLowerCase() === labelText.toLowerCase();
      } else {
        return form.label.toLowerCase().includes(labelText.toLowerCase());
      }
    });
  }
  
  /**
   * タイプでフォームを検索
   * 
   * @param {string} type - 検索するフォーム要素タイプ
   * @returns {Array} 一致するフォームデータオブジェクトの配列
   */
  findFormsByType(type) {
    const forms = this.model.getFormsData();
    return forms.filter(form => form.type === type);
  }
  
  /**
   * name属性でフォームを検索
   * 
   * @param {string} name - 検索するname属性
   * @param {boolean} exactMatch - 完全一致が必要かどうか
   * @returns {Array} 一致するフォームデータオブジェクトの配列
   */
  findFormsByName(name, exactMatch = false) {
    const forms = this.model.getFormsData();
    
    return forms.filter(form => {
      if (exactMatch) {
        return form.name === name;
      } else {
        return form.name.includes(name);
      }
    });
  }
  
  /**
   * プレースホルダーテキストでフォームを検索
   * 
   * @param {string} placeholder - 検索するプレースホルダーテキスト
   * @param {boolean} exactMatch - 完全一致が必要かどうか
   * @returns {Array} 一致するフォームデータオブジェクトの配列
   */
  findFormsByPlaceholder(placeholder, exactMatch = false) {
    const forms = this.model.getFormsData();
    
    return forms.filter(form => {
      if (exactMatch) {
        return form.placeholder.toLowerCase() === placeholder.toLowerCase();
      } else {
        return form.placeholder.toLowerCase().includes(placeholder.toLowerCase());
      }
    });
  }
  
  /**
   * 必須フォームを検索
   * 
   * @returns {Array} 必須フォームデータオブジェクトの配列
   */
  findRequiredForms() {
    const forms = this.model.getFormsData();
    return forms.filter(form => form.required);
  }
  
  /**
   * フォームに値を入力
   * 
   * @param {string} id - フォームID
   * @param {*} value - 入力する値
   * @returns {FormsController} メソッドチェーン用コントローラーインスタンス
   */
  fillForm(id, value) {
    const values = { [id]: value };
    this.model.applyValues(values);
    return this;
  }
  
  /**
   * 複数のフォームに値を入力
   * 
   * @param {Object} values - フォームIDと値のマッピングオブジェクト
   * @returns {FormsController} メソッドチェーン用コントローラーインスタンス
   */
  fillForms(values) {
    this.model.applyValues(values);
    return this;
  }
  
  /**
   * すべてのフォームの値を取得
   * 
   * @returns {Object} フォームIDと現在の値のマッピングオブジェクト
   */
  getFormValues() {
    const forms = this.model.getFormsData();
    const values = {};
    
    forms.forEach(form => {
      if (form.type === 'radio' || form.type === 'checkbox') {
        if (form.type === 'radio') {
          const selectedOption = form.options.find(opt => opt.checked);
          values[form.id] = selectedOption ? selectedOption.value : null;
        } else {
          values[form.id] = form.options
            .filter(opt => opt.checked)
            .map(opt => opt.value);
        }
      } else if (form.type === 'select' || form.type === 'select-multiple') {
        if (form.type === 'select-multiple') {
          values[form.id] = form.options
            .filter(opt => opt.selected)
            .map(opt => opt.value);
        } else {
          const selectedOption = form.options.find(opt => opt.selected);
          values[form.id] = selectedOption ? selectedOption.value : null;
        }
      } else {
        values[form.id] = form.value;
      }
    });
    
    return values;
  }
  
  /**
   * フォームが存在するか確認
   * 
   * @param {string} id - フォームID
   * @returns {boolean} フォームが存在するかどうか
   */
  formExists(id) {
    return this.model.get('forms').has(id);
  }
  
  /**
   * フォームの数を取得
   * 
   * @returns {number} フォームの数
   */
  getFormsCount() {
    return this.model.get('forms').size;
  }
}