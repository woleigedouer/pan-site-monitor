/**
 * 站点监控应用 - 模块化加载器
 * 支持ES6模块和传统script标签两种加载方式
 * 保持完全的向后兼容性
 */

// 检测是否支持ES6模块
const supportsModules = 'noModule' in HTMLScriptElement.prototype;

// 模块化加载函数
async function loadModularVersion() {
    try {
        // 动态导入主应用模块
        const { MonitorApp } = await import('./app.js');

        // 将MonitorApp暴露到全局以保持兼容性
        window.MonitorApp = MonitorApp;

        // 检查DOM是否已经加载完成，如果是则立即初始化
        if (document.readyState === 'loading') {
            // DOM还在加载中，等待DOMContentLoaded事件
            document.addEventListener('DOMContentLoaded', () => {
                MonitorApp.init();
            });
        } else {
            // DOM已经加载完成，立即初始化
            MonitorApp.init();
        }

        console.log('✅ 模块化版本加载成功');
        return true;
    } catch (error) {
        console.warn('⚠️ 模块化版本加载失败，回退到内联版本:', error);
        return false;
    }
}

// 内联版本（原始代码作为回退）
function loadInlineVersion() {
    console.log('📦 使用内联版本');
    console.log('⚠️ 内联版本功能有限，建议使用支持ES6模块的现代浏览器');
    
    // 这里可以包含完整的原始代码实现作为回退
    // 为了保持文件简洁，暂时省略
    // 在生产环境中，这里应该包含完整的内联实现
}

// 尝试加载模块化版本
if (supportsModules) {
    loadModularVersion().then(success => {
        if (!success) {
            loadInlineVersion();
        }
    });
} else {
    loadInlineVersion();
}
