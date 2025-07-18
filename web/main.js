// 配置项
const CONFIG = {
    LATENCY_THRESHOLDS: {
        GOOD: 500    // 500ms以下为绿色，以上为黄色
    },
    LOADING_ERROR_DELAY: 3000,  // 加载失败时保持加载状态的时间(毫秒)
    COUNTDOWN_INTERVAL: 60 * 60 * 1000  // 倒计时间隔：1小时（毫秒）
};

// 历史数据的全局变量
let siteHistoryData = {};

// 格式化延迟等级
function formatLatency(latency) {
    if (latency < CONFIG.LATENCY_THRESHOLDS.GOOD) return 'success';
    return 'warning';  // 500ms以上的正常响应都是黄色
}

// 倒计时功能
function updateCountdown() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);

    const diff = nextHour - now;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // 更新倒计时显示
    const countdownTimeElement = document.getElementById('countdown-time');
    if (countdownTimeElement) {
        countdownTimeElement.textContent = timeString;
    }

    // 更新进度条（倒计时减少）
    const totalSeconds = 60 * 60; // 一小时总秒数
    const remainingSeconds = minutes * 60 + seconds;
    const progress = (remainingSeconds / totalSeconds) * 100;

    const progressBar = document.getElementById('countdown-progress');
    if (progressBar) {
        progressBar.style.width = progress + '%';
    }
}

// 启动倒计时
function startCountdown() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// 切换站点详情展开/收起
function toggleSiteDetails(element) {
    const isExpanded = element.classList.contains('expanded');
    const siteDetails = element.querySelector('.site-details');

    if (siteDetails) {
        if (!isExpanded) {
            // 展开：计算动态高度
            const urlItems = siteDetails.querySelectorAll('.url-item');
            const itemHeight = 60; // 每个备用域名项的高度
            const padding = 32; // 上下padding总和 (16px * 2)
            const dynamicHeight = urlItems.length * itemHeight + padding;

            element.classList.add('expanded');
            siteDetails.style.maxHeight = dynamicHeight + 'px';
        } else {
            // 收起
            element.classList.remove('expanded');
            siteDetails.style.maxHeight = '0px';
        }
    }
}

// 生成状态历史数据（使用真实数据或显示无数据状态）
function generateStatusHistory(currentStatus, urlData, siteName) {
    // 始终返回固定长度的历史数据（12个点）
    const HISTORY_LENGTH = 12;
    let history = Array(HISTORY_LENGTH).fill('no_data');
    
    // 尝试使用真实的历史数据
    if (siteHistoryData && siteHistoryData[siteName] && siteHistoryData[siteName].length > 0) {
        // 将真实历史数据复制到结果数组中
        const realData = siteHistoryData[siteName].map(record => record.status);
        
        // 计算起始位置，以确保最新的数据显示在最右侧
        const startPos = Math.max(0, HISTORY_LENGTH - realData.length);
        
        // 复制真实数据到结果数组
        for (let i = 0; i < realData.length && i < HISTORY_LENGTH; i++) {
            history[startPos + i] = realData[i];
        }
    }
    
    return history;
}

// SVG图标定义
const ICONS = {
    success: '<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>',
    failed: '<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>',
    clock: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>',
    expand: '<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>'
};

// 渲染站点列表
function renderSites(data) {
    const container = document.getElementById('sites-container');
    container.innerHTML = '';

    Object.entries(data.sites).forEach(([siteName, siteData]) => {
        const siteItem = document.createElement('div');
        siteItem.className = `site-item ${siteData.status === 'failed' ? 'failed' : ''}`;

        let headerContent = '';
        if (siteData.status === 'success' && siteData.best_url) {
            const bestUrlData = siteData.urls.find(u => u.is_best);
            const latencyMs = bestUrlData.latency * 1000;
            const latencyClass = formatLatency(latencyMs);
            const statusHistory = generateStatusHistory('success', bestUrlData, siteName);

            headerContent = `
                <div class="status-indicator success"></div>
                <div class="site-info">
                    <div class="site-name">${siteName}</div>
                    <div class="best-url">${siteData.best_url}</div>
                </div>
                <div class="monitor-stats">
                    <div class="response-badge ${latencyClass}">${latencyMs.toFixed(0)}ms</div>
                    <div class="status-history">
                        ${statusHistory.map(status => `<div class="status-dot ${status}"></div>`).join('')}
                    </div>
                </div>
            `;
        } else {
            const statusHistory = generateStatusHistory('failed', null, siteName);

            headerContent = `
                <div class="status-indicator failed"></div>
                <div class="site-info">
                    <div class="site-name">${siteName}</div>
                    <div class="best-url failed-url">所有URL均不可用</div>
                </div>
                <div class="monitor-stats">
                    <div class="response-badge danger">失败</div>
                    <div class="status-history">
                        ${statusHistory.map(status => `<div class="status-dot ${status}"></div>`).join('')}
                    </div>
                </div>
            `;
        }

        let detailsContent = '';
        if (siteData.urls && siteData.urls.length > 0) {
            let urlsToShow = [];

            if (siteData.status === 'success') {
                // 成功站点：显示除最佳URL外的其他URL
                urlsToShow = siteData.urls.filter(u => !u.is_best);
            } else {
                // 失败站点：显示所有URL
                urlsToShow = siteData.urls;
            }

            if (urlsToShow.length > 0) {
                detailsContent = `
                    <div class="site-details">
                        <div class="url-list">
                            ${urlsToShow.map((urlData, index) => {
                                const latencyMs = urlData.latency ? urlData.latency * 1000 : 0;
                                const latencyClass = urlData.latency ? formatLatency(latencyMs) : 'danger';
                                const statusHistory = generateStatusHistory(urlData.latency ? 'success' : 'failed', urlData, siteName);
                                const statusIndicatorClass = urlData.latency ? 'success' : 'failed';

                                // 生成状态文本：优先显示详细错误信息
                                let statusText;
                                if (urlData.latency) {
                                    statusText = `${latencyMs.toFixed(0)}ms`;
                                } else if (urlData.error_detail) {
                                    // 显示详细错误信息
                                    statusText = urlData.error_detail;
                                } else {
                                    // 兜底显示
                                    statusText = '失败';
                                }

                                return `
                                <div class="url-item">
                                    <div class="status-indicator ${statusIndicatorClass}"></div>
                                    <div class="backup-url-info">
                                        <div class="backup-url-name">备用${index + 1}</div>
                                        <div class="url-text">${urlData.url}</div>
                                    </div>
                                    <div class="backup-url-stats">
                                        <div class="response-badge ${latencyClass}">${statusText}</div>
                                        <div class="backup-status-history">
                                            ${statusHistory.map(status => `<div class="status-dot ${status}"></div>`).join('')}
                                        </div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        }

        siteItem.innerHTML = `
            <div class="site-header" onclick="toggleSiteDetails(this.parentElement)">
                ${headerContent}
            </div>
            ${detailsContent}
        `;

        container.appendChild(siteItem);
    });

    // 更新顶部的最后更新时间
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

// 加载历史数据
async function loadHistoryData() {
    try {
        const response = await fetch('../data/history.json');
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.error('加载历史数据失败:', e);
    }
    return {}; // 如果加载失败返回空对象
}

// 数据加载
async function loadData() {
    const loading = document.getElementById('loading');
    const container = document.getElementById('sites-container');

    loading.style.display = 'flex';
    container.innerHTML = '';

    try {
        // 首先尝试加载历史数据
        siteHistoryData = await loadHistoryData();
        
        let response;
        let data;

        // 尝试API端点
        try {
            response = await fetch('/api/data');
            if (response.ok) {
                data = await response.json();
            } else {
                throw new Error('API not available');
            }
        } catch (apiError) {
            // 尝试本地文件
            response = await fetch('../data/test_results.json');
            if (response.ok) {
                data = await response.json();
            } else {
                throw new Error('Data file not found');
            }
        }

        renderSites(data);
        loading.style.display = 'none';

    } catch (err) {
        console.error('Error loading data:', err);
        // 保持加载状态更长时间，然后静默隐藏
        setTimeout(() => {
            loading.style.display = 'none';
        }, CONFIG.LOADING_ERROR_DELAY);
    }
}

// 页面加载时自动加载数据和启动倒计时
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    startCountdown();
});
