/**
 * 工具函数模块
 * 包含所有通用的工具函数
 */

import { CONFIG } from './config.js';

export const utils = {
    // 动态检测移动设备
    isMobileDevice() {
        return window.innerWidth <= 768;
    },

    // 格式化延迟等级
    formatLatency(latency) {
        if (latency < CONFIG.LATENCY_THRESHOLDS.GOOD) return 'success';
        return 'warning';  // 500ms以上的正常响应都是黄色
    },

    // 数据验证
    validateSiteData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid site data');
        }
        if (!data.sites || typeof data.sites !== 'object') {
            throw new Error('Invalid sites data structure');
        }
        return true;
    },

    // 安全的HTML内容处理
    sanitizeHTML(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// 向后兼容：将工具函数暴露到全局
if (typeof window !== 'undefined') {
    window.isMobileDevice = utils.isMobileDevice;
    window.formatLatency = utils.formatLatency;
}
