/**
 * 数据加载模块
 * 处理数据获取和加载逻辑
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

export const loader = {
    syncHistoryData(historyData) {
        state.siteHistoryData = historyData || {};
        if (typeof window !== 'undefined') {
            window.siteHistoryData = state.siteHistoryData;
        }
    },

    // 加载历史数据
    async loadHistoryData() {
        try {
            const response = await fetch('./assets/data/history.json');
            if (response.ok) {
                const historyData = await response.json();
                this.syncHistoryData(historyData);
                return historyData;
            }
        } catch (e) {
            console.error('加载历史数据失败:', e);
        }
        return {}; // 如果加载失败返回空对象
    },

    normalizeMonitorData(data) {
        if (data && data.history) {
            this.syncHistoryData(data.history);
        }
        return data;
    },

    async fetchJson(url, label) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`${label} HTTP ${response.status}`);
        }

        const data = await response.json();
        return this.normalizeMonitorData(data);
    },

    // 从多个数据源获取数据，优先使用合并快照，失败时回退旧结构
    async fetchDataFromSources() {
        // 尝试API端点
        try {
            console.log('🔄 尝试从API加载数据...');
            const data = await this.fetchJson('/api/data', 'API');
            console.log('✅ 成功从API加载数据');
            return data;
        } catch (apiError) {
            console.warn('⚠️ API加载失败，尝试本地合并文件:', apiError.message);

            try {
                console.log('🔄 尝试从本地合并文件加载数据...');
                const data = await this.fetchJson('./assets/data/monitor_data.json', 'Monitor file');
                console.log('✅ 成功从本地合并文件加载数据');
                return data;
            } catch (monitorError) {
                console.warn('⚠️ 本地合并文件加载失败，尝试旧结果文件:', monitorError.message);

                // 尝试旧结果文件
                try {
                    console.log('🔄 尝试从旧结果文件加载数据...');
                    const data = await this.fetchJson('./assets/data/test_results.json', 'Legacy file');
                    console.log('✅ 成功从旧结果文件加载数据');
                    return data;
                } catch (legacyError) {
                    throw new Error(`所有数据源加载失败: API(${apiError.message}), Monitor(${monitorError.message}), Legacy(${legacyError.message})`);
                }
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
            // 尝试从不同源加载数据
            data = await this.fetchDataFromSources();

            // 旧结果文件不包含历史数据，按需回退加载独立历史文件
            if (!data.history) {
                await this.loadHistoryData();
            }

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
