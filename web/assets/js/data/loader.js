/**
 * 数据加载模块
 * 处理数据获取和加载逻辑
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

export const loader = {
    // 加载历史数据
    async loadHistoryData() {
        try {
            const response = await fetch('../data/history.json');
            if (response.ok) {
                const historyData = await response.json();
                state.siteHistoryData = historyData;
                // 同步全局变量
                if (typeof window !== 'undefined') {
                    window.siteHistoryData = historyData;
                }
                return historyData;
            }
        } catch (e) {
            console.error('加载历史数据失败:', e);
        }
        return {}; // 如果加载失败返回空对象
    },

    // 从多个数据源获取数据
    async fetchDataFromSources() {
        // 尝试API端点
        try {
            console.log('🔄 尝试从API加载数据...');
            const response = await fetch('/api/data');

            if (response.ok) {
                const data = await response.json();
                console.log('✅ 成功从API加载数据');
                return data;
            } else {
                throw new Error(`API HTTP ${response.status}`);
            }
        } catch (apiError) {
            console.warn('⚠️ API加载失败，尝试本地文件:', apiError.message);

            // 尝试本地文件
            try {
                console.log('🔄 尝试从本地文件加载数据...');
                const response = await fetch('../data/test_results.json');

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ 成功从本地文件加载数据');
                    return data;
                } else {
                    throw new Error(`Local file ${response.status}`);
                }
            } catch (localError) {
                throw new Error(`所有数据源加载失败: API(${apiError.message}), Local(${localError.message})`);
            }
        }
    },

    // 处理加载错误
    handleLoadError(err, errorDetails, loading) {
        const errorInfo = errorDetails || {
            type: 'unknown_error',
            message: '未知错误',
            error: err
        };

        console.error('❌ 数据加载失败:', {
            type: errorInfo.type,
            message: errorInfo.message,
            error: err,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });

        // 保持加载状态更长时间，然后静默隐藏
        setTimeout(() => {
            if (loading) {
                loading.style.display = 'none';
            }
        }, CONFIG.LOADING_ERROR_DELAY);
    },

    // 主数据加载函数
    async loadData() {
        const loading = document.getElementById('loading');
        const container = document.getElementById('sites-container');

        if (!loading || !container) {
            console.error('找不到必要的DOM元素');
            return;
        }

        loading.style.display = 'flex';
        container.innerHTML = '';

        let data = null;
        let errorDetails = null;

        try {
            // 首先尝试加载历史数据
            await this.loadHistoryData();

            // 尝试从不同源加载数据
            data = await this.fetchDataFromSources();

            if (data) {
                // 需要从renderer模块导入renderSites函数
                if (typeof window !== 'undefined' && window.renderSites) {
                    window.renderSites(data);
                }
                loading.style.display = 'none';
            }

        } catch (err) {
            this.handleLoadError(err, errorDetails, loading);
        }
    }
};

// 向后兼容：将数据加载函数暴露到全局
if (typeof window !== 'undefined') {
    window.loadHistoryData = loader.loadHistoryData.bind(loader);
    window.loadData = loader.loadData.bind(loader);
}
