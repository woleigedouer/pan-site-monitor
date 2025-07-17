// 配置项
const CONFIG = {
    LATENCY_THRESHOLDS: {
        GOOD: 500,    // 500ms以下为绿色
        MEDIUM: 1000   // 1000ms以下为黄色，以上为红色
    },
    LOADING_ERROR_DELAY: 3000  // 加载失败时保持加载状态的时间(毫秒)
};

// 格式化延迟等级
function formatLatency(latency) {
    if (latency < CONFIG.LATENCY_THRESHOLDS.GOOD) return 'success';
    if (latency < CONFIG.LATENCY_THRESHOLDS.MEDIUM) return 'warning';
    return 'danger';
}

// 切换站点详情展开/收起
function toggleSiteDetails(element) {
    element.classList.toggle('expanded');
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

            headerContent = `
                <div class="site-info">
                    <svg class="status-icon success" fill="currentColor" viewBox="0 0 20 20">
                        ${ICONS.success}
                    </svg>
                    <div class="site-name">${siteName}</div>
                    <div class="best-url">${siteData.best_url}</div>
                    <div class="latency-badge ${latencyClass}">
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                            ${ICONS.clock}
                        </svg>
                        ${latencyMs.toFixed(0)}ms
                    </div>
                </div>
                <svg class="expand-icon" fill="currentColor" viewBox="0 0 20 20">
                    ${ICONS.expand}
                </svg>
            `;
        } else {
            headerContent = `
                <div class="site-info">
                    <svg class="status-icon failed" fill="currentColor" viewBox="0 0 20 20">
                        ${ICONS.failed}
                    </svg>
                    <div class="site-name">${siteName}</div>
                    <div class="best-url failed-url">无可用URL</div>
                </div>
                <svg class="expand-icon" fill="currentColor" viewBox="0 0 20 20">
                    ${ICONS.expand}
                </svg>
            `;
        }

        let detailsContent = '';
        if (siteData.urls && siteData.urls.length > 1) {
            const otherUrls = siteData.urls.filter(u => !u.is_best);
            if (otherUrls.length > 0) {
                detailsContent = `
                    <div class="site-details">
                        <div class="url-list">
                            ${otherUrls.map(urlData => {
                                const latencyMs = urlData.latency * 1000;
                                const latencyClass = formatLatency(latencyMs);
                                return `
                                <div class="url-item">
                                    <div class="url-text">${urlData.url}</div>
                                    <div class="latency-badge ${latencyClass}">
                                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
                                            ${ICONS.clock}
                                        </svg>
                                        ${latencyMs.toFixed(0)}ms
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

    // 更新最后更新时间
    const lastUpdateElement = document.getElementById('last-update');
    if (lastUpdateElement) {
        // 使用数据文件的时间戳，如果没有则使用当前时间
        const dataTimestamp = data.timestamp ? new Date(data.timestamp).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN');
        lastUpdateElement.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                ${ICONS.clock}
            </svg>
            最后更新: ${dataTimestamp}
        `;
    }
}

// 数据加载
async function loadData() {
    const loading = document.getElementById('loading');
    const container = document.getElementById('sites-container');

    loading.style.display = 'flex';
    container.innerHTML = '';

    try {
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

// 页面加载时自动加载数据
document.addEventListener('DOMContentLoaded', loadData);
