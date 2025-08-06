/**
 * 依存性注入コンテナ用のユーティリティ関数
 */

/**
 * 指定されたサービスがコンテナで準備完了になるまで待機
 * 
 * @param {string} serviceName - 待機するサービス名
 * @param {number} maxWaitTime - 最大待機時間（ミリ秒）
 * @returns {Promise<boolean>} - サービスが準備完了の場合true、タイムアウトの場合false
 */
export async function waitForService(serviceName, maxWaitTime = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            if (window.container && window.container.get) {
                const service = window.container.get(serviceName);
                if (service) {
                    console.log(`Service '${serviceName}' is ready`);
                    return true;
                }
            }
        } catch (error) {
            
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.warn(`Service '${serviceName}' wait timeout after ${maxWaitTime}ms`);
    return false;
}

/**
 * コンテナが完全に初期化されるまで待機
 * 
 * @param {number} maxWaitTime - 最大待機時間（ミリ秒）
 * @returns {Promise<boolean>} - コンテナが準備完了の場合true、タイムアウトの場合false
 */
export async function waitForContainer(maxWaitTime = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            if (window.container && typeof window.container.get === 'function') {
                console.log('Container is ready');
                return true;
            }
        } catch (error) {
            
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.warn(`Container wait timeout after ${maxWaitTime}ms`);
    return false;
}

/**
 * フォールバック付きでコンテナからサービスを安全に取得
 * 
 * @param {string} serviceName - 取得するサービス名
 * @param {*} fallback - サービスが利用できない場合のフォールバック値
 * @returns {*} - サービスインスタンスまたはフォールバック値
 */
export function getServiceSafely(serviceName, fallback = null) {
    try {
        if (window.container && window.container.get) {
            return window.container.get(serviceName);
        }
    } catch (error) {
        console.log(`Service '${serviceName}' not available:`, error.message);
    }
    
    return fallback;
}

/**
 * コンテナ内でサービスが利用可能かどうかをチェック
 * 
 * @param {string} serviceName - チェックするサービス名
 * @returns {boolean} - サービスが利用可能な場合true、そうでなければfalse
 */
export function isServiceAvailable(serviceName) {
    try {
        if (window.container && window.container.get) {
            const service = window.container.get(serviceName);
            return !!service;
        }
    } catch (error) {
        
    }
    
    return false;
}

/**
 * サービスが利用可能になった時に関数を実行
 * 
 * @param {string} serviceName - 待機するサービス名
 * @param {Function} callback - サービスが準備完了時に実行する関数
 * @param {number} maxWaitTime - 最大待機時間（ミリ秒）
 */
export async function whenServiceReady(serviceName, callback, maxWaitTime = 5000) {
    const isReady = await waitForService(serviceName, maxWaitTime);
    
    if (isReady) {
        try {
            const service = window.container.get(serviceName);
            callback(service);
        } catch (error) {
            console.error(`Error executing callback for service '${serviceName}':`, error);
        }
    } else {
        console.warn(`Service '${serviceName}' not ready, callback not executed`);
    }
}

if (typeof window !== 'undefined') {
    window.waitForService = waitForService;
    window.waitForContainer = waitForContainer;
    window.getServiceSafely = getServiceSafely;
    window.isServiceAvailable = isServiceAvailable;
    window.whenServiceReady = whenServiceReady;
} 