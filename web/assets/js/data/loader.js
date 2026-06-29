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

    // 从合并快照获取数据，优先使用部署环境的API路径
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
                throw new Error(`所有数据源加载失败: API(${apiError.message}), Monitor(${monitorError.message})`);
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
            // 加载合并监控数据
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
    window.loadData = loader.loadData.bind(loader);
}
