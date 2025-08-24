/**
 * 数据渲染模块
 * 处理数据的HTML渲染和显示
 */

import { CONFIG } from '../config.js';
import { utils } from '../utils.js';
import { state } from '../state.js';

export const renderer = {
    // 生成状态历史数据（使用真实数据或显示无数据状态）
    generateStatusHistory(siteName, url, currentUrlData = null) {
        // 始终返回固定长度的历史数据
        const HISTORY_LENGTH = CONFIG.HISTORY_LENGTH;
        // 修复：使用map创建独立的对象，避免对象引用共享问题
        let history = Array(HISTORY_LENGTH).fill().map(() => ({
            status: 'no_data',
            timestamp: '',
            latency: null,
            errorDetail: null
        }));

        // 尝试使用URL特定的历史数据（如果提供了URL）
        let historyRecords = null;
        if (url && siteName && state.siteHistoryData[siteName] && state.siteHistoryData[siteName][url]) {
            // 新的嵌套结构格式
            historyRecords = state.siteHistoryData[siteName][url];
        }

        // 如果找到了历史记录，处理它们
        if (historyRecords && historyRecords.length > 0) {
            // 将真实历史数据转换为带有时间信息的对象
            const realData = historyRecords.map(record => {
                // 将ISO时间格式转换为友好的本地时间格式
                let formattedTime = "未知时间";
                if (record.timestamp) {
                    const date = new Date(record.timestamp);
                    formattedTime = date.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    });
                }

                return {
                    status: record.status,
                    timestamp: formattedTime,
                    latency: record.latency,
                    errorDetail: record.error_detail || null
                };
            });

            // 计算起始位置，以确保最新的数据显示在最右侧
            const startPos = Math.max(0, HISTORY_LENGTH - realData.length);

            // 复制真实数据到结果数组
            for (let i = 0; i < realData.length && i < HISTORY_LENGTH; i++) {
                history[startPos + i] = realData[i];
            }
        }

        // 如果提供了当前URL数据，并且最后一个历史状态点是no_data，则用当前数据填充
        if (currentUrlData && history[HISTORY_LENGTH - 1].status === 'no_data') {
            const currentTime = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            const currentStatus = {
                status: currentUrlData.latency ? 'success' : 'down',
                timestamp: currentTime,
                latency: currentUrlData.latency,
                errorDetail: currentUrlData.error_detail || null
            };

            // 只在最后一个位置是no_data时才替换
            history[HISTORY_LENGTH - 1] = currentStatus;
        }

        return history;
    },

    // 查找站点中上次最佳URL
    findLastSuccessfulUrl(siteName, siteData) {
        if (!siteName || !state.siteHistoryData[siteName]) {
            return null;
        }

        const siteHistory = state.siteHistoryData[siteName];
        let lastBestUrl = null;
        let latestBestTime = null;

        // 遍历所有URL的历史记录，找到最近一次标记为最佳的URL
        for (const [url, urlHistory] of Object.entries(siteHistory)) {
            if (!urlHistory || urlHistory.length === 0) continue;

            // 从最新记录开始查找最佳URL标记
            for (let i = urlHistory.length - 1; i >= 0; i--) {
                const record = urlHistory[i];
                if (record.is_best === true) {
                    const recordTime = new Date(record.timestamp);
                    if (!latestBestTime || recordTime > latestBestTime) {
                        latestBestTime = recordTime;
                        lastBestUrl = url;
                    }
                    break; // 找到该URL最近的最佳记录，跳出内层循环
                }
            }
        }

        return lastBestUrl;
    },

    // 创建状态历史HTML
    createStatusHistoryHTML(statusHistory) {
        return statusHistory.map((item, historyIndex) => {
            const statusLabel = item.status === 'success' || item.status === 'up' ? '在线' :
                              item.status === 'no_data' ? '无数据' : '离线';
            return `<div class="status-dot ${item.status}"
                        data-time="${utils.sanitizeHTML(item.timestamp)}"
                        data-status="${utils.sanitizeHTML(item.status)}"
                        data-latency="${item.latency ? (item.latency * 1000).toFixed(0) : ''}"
                        data-error-detail="${item.errorDetail ? utils.sanitizeHTML(item.errorDetail) : ''}"
                        role="img"
                        aria-label="历史状态点 ${historyIndex + 1}: ${statusLabel}${item.timestamp ? ', 时间: ' + item.timestamp : ''}">
                    <span></span>
                  </div>`;
        }).join('');
    },

    // 创建成功站点的头部内容
    createSuccessHeaderContent(siteName, siteData, index) {
        const bestUrlData = siteData.urls.find(u => u.is_best);
        const statusHistory = this.generateStatusHistory(siteName, siteData.best_url, bestUrlData);

        return `
            <div class="status-indicator success" role="img" aria-label="站点在线"></div>
            <div class="site-info">
                <div class="site-name" id="site-name-${index}">${utils.sanitizeHTML(siteName)}</div>
                <div class="best-url">${utils.sanitizeHTML(siteData.best_url)}</div>
            </div>
            <div class="monitor-stats">
                <div class="status-history" role="group" aria-label="状态历史记录">
                    ${this.createStatusHistoryHTML(statusHistory)}
                </div>
            </div>
        `;
    },

    // 创建失败站点的头部内容
    createFailedHeaderContent(siteName, siteData, index) {
        // 对于失败站点，尝试找到上次成功的URL来显示历史信息
        const lastSuccessfulUrl = this.findLastSuccessfulUrl(siteName, siteData);
        const statusHistory = this.generateStatusHistory(siteName, lastSuccessfulUrl, null);

        // 根据是否找到上次最佳URL来决定显示文本
        const displayText = lastSuccessfulUrl
            ? utils.sanitizeHTML(lastSuccessfulUrl)
            : '所有URL均不可用';

        return `
            <div class="status-indicator failed" role="img" aria-label="站点离线"></div>
            <div class="site-info">
                <div class="site-name" id="site-name-${index}">${utils.sanitizeHTML(siteName)}</div>
                <div class="best-url failed-url">${displayText}</div>
            </div>
            <div class="monitor-stats">
                <div class="status-history" role="group" aria-label="状态历史记录">
                    ${this.createStatusHistoryHTML(statusHistory)}
                </div>
            </div>
        `;
    },

    // 创建详情内容
    createDetailsContent(siteName, siteData) {
        if (!siteData.urls || siteData.urls.length === 0) {
            return '';
        }

        let urlsToShow = [];
        if (siteData.status === 'success') {
            // 成功站点：显示除最佳URL外的其他URL
            urlsToShow = siteData.urls.filter(u => !u.is_best);
        } else {
            // 失败站点：按头部显示的URL进行过滤，避免重复
            const headerUrl = this.findLastSuccessfulUrl(siteName, siteData);
            urlsToShow = headerUrl
                ? siteData.urls.filter(u => u.url !== headerUrl)
                : siteData.urls;
        }

        if (urlsToShow.length === 0) {
            return '';
        }

        return `
            <div class="site-details">
                <div class="url-list">
                    ${urlsToShow.map((urlData, index) => this.createUrlItemHTML(siteName, urlData, index)).join('')}
                </div>
            </div>
        `;
    },

    // 创建URL项目HTML
    createUrlItemHTML(siteName, urlData, index) {
        const statusHistory = this.generateStatusHistory(siteName, urlData.url, urlData);
        const statusIndicatorClass = urlData.latency ? 'success' : 'failed';

        return `
        <div class="url-item">
            <div class="status-indicator ${statusIndicatorClass}"></div>
            <div class="backup-url-info">
                <div class="backup-url-name">${utils.sanitizeHTML(siteName)}<sup>${index + 2}</sup></div>
                <div class="url-text">${utils.sanitizeHTML(urlData.url)}</div>
            </div>
            <div class="backup-url-stats">
                <div class="backup-status-history">
                    ${this.createStatusHistoryHTML(statusHistory)}
                </div>
            </div>
        </div>
        `;
    },

    // 更新最后更新时间
    updateLastUpdateTime(data) {
        const headerLastUpdateElement = document.getElementById('header-last-update');
        if (headerLastUpdateElement) {
            // 使用数据文件的时间戳，如果没有则使用当前时间
            const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
            const timeString = timestamp.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const spanElement = headerLastUpdateElement.querySelector('span');
            if (spanElement) {
                spanElement.textContent = `上次刷新 ${timeString}`;
            }
        }
    }
};

// 渲染站点列表 - 重构版本
export function renderSites(data) {
    // 数据验证
    try {
        utils.validateSiteData(data);
    } catch (error) {
        console.error('数据验证失败:', error);
        return;
    }

    const container = document.getElementById('sites-container');
    if (!container) {
        console.error('找不到站点容器元素');
        return;
    }

    container.innerHTML = '';

    Object.entries(data.sites).forEach(([siteName, siteData], index) => {
        const siteItem = document.createElement('article');
        siteItem.className = `site-item ${siteData.status === 'failed' ? 'failed' : ''}`;
        siteItem.setAttribute('role', 'article');
        siteItem.setAttribute('aria-labelledby', `site-name-${index}`);

        // 根据站点状态选择合适的头部内容
        let headerContent = '';
        if (siteData.status === 'success' && siteData.best_url) {
            headerContent = renderer.createSuccessHeaderContent(siteName, siteData, index);
        } else {
            headerContent = renderer.createFailedHeaderContent(siteName, siteData, index);
        }

        // 创建详情内容
        const detailsContent = renderer.createDetailsContent(siteName, siteData);

        siteItem.innerHTML = `
            <div class="site-header"
                 onclick="toggleSiteDetails(this.parentElement)"
                 role="button"
                 tabindex="0"
                 aria-expanded="false"
                 aria-controls="details-${index}"
                 aria-label="展开或收起 ${siteName} 的详细信息"
                 onkeydown="handleKeyDown(event, this.parentElement)">
                ${headerContent}
            </div>
            ${detailsContent.replace('<div class="site-details">', `<div class="site-details" id="details-${index}" aria-hidden="true">`)}
        `;

        container.appendChild(siteItem);
    });

    // 更新顶部的最后更新时间
    renderer.updateLastUpdateTime(data);
}

// 向后兼容：将渲染函数暴露到全局
if (typeof window !== 'undefined') {
    window.generateStatusHistory = renderer.generateStatusHistory.bind(renderer);
    window.renderSites = renderSites;
}
