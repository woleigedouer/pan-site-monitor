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
    const totalSeconds = CONFIG.COUNTDOWN_INTERVAL / 1000; // 总秒数
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
            const dynamicHeight = urlItems.length * itemHeight;

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
function generateStatusHistory(siteName, url) {
    // 始终返回固定长度的历史数据（12个点）
    const HISTORY_LENGTH = 12;
    let history = Array(HISTORY_LENGTH).fill({status: 'no_data', timestamp: '', latency: null});
    
    // 尝试使用URL特定的历史数据（如果提供了URL）
    let historyRecords = null;
    if (url && siteName && siteHistoryData[siteName] && siteHistoryData[siteName][url]) {
        // 新的嵌套结构格式
        historyRecords = siteHistoryData[siteName][url];
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
                latency: record.latency
            };
        });
        
        // 计算起始位置，以确保最新的数据显示在最右侧
        const startPos = Math.max(0, HISTORY_LENGTH - realData.length);
        
        // 复制真实数据到结果数组
        for (let i = 0; i < realData.length && i < HISTORY_LENGTH; i++) {
            history[startPos + i] = realData[i];
        }
    }
    
    return history;
}

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
            const statusHistory = generateStatusHistory(siteName, siteData.best_url);

            headerContent = `
                <div class="status-indicator success"></div>
                <div class="site-info">
                    <div class="site-name">${siteName}</div>
                    <div class="best-url">${siteData.best_url}</div>
                </div>
                <div class="monitor-stats">
                    <div class="response-badge ${latencyClass}">${latencyMs.toFixed(0)}ms</div>
                    <div class="status-history">
                        ${statusHistory.map(item => {
                            return `<div class="status-dot ${item.status}" 
                                        data-time="${item.timestamp}" 
                                        data-status="${item.status}" 
                                        data-latency="${item.latency ? (item.latency * 1000).toFixed(0) : ''}">
                                    <span></span>
                                  </div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            const statusHistory = generateStatusHistory(siteName, null);

            headerContent = `
                <div class="status-indicator failed"></div>
                <div class="site-info">
                    <div class="site-name">${siteName}</div>
                    <div class="best-url failed-url">所有URL均不可用</div>
                </div>
                <div class="monitor-stats">
                    <div class="response-badge danger">失败</div>
                    <div class="status-history">
                        ${statusHistory.map(item => {
                            return `<div class="status-dot ${item.status}" 
                                        data-time="${item.timestamp}" 
                                        data-status="${item.status}" 
                                        data-latency="${item.latency ? (item.latency * 1000).toFixed(0) : ''}">
                                    <span></span>
                                  </div>`;
                        }).join('')}
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
                                const statusHistory = generateStatusHistory(siteName, urlData.url);
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
                                        <div class="backup-url-name">${siteName}<sup>${index + 2}</sup></div>
                                        <div class="url-text">${urlData.url}</div>
                                    </div>
                                    <div class="backup-url-stats">
                                        <div class="response-badge ${latencyClass}">${statusText}</div>
                                        <div class="backup-status-history">
                                            ${statusHistory.map(item => {
                                                return `<div class="status-dot ${item.status}" 
                                                            data-time="${item.timestamp}" 
                                                            data-status="${item.status}" 
                                                            data-latency="${item.latency ? (item.latency * 1000).toFixed(0) : ''}">
                                                        <span></span>
                                                      </div>`;
                                            }).join('')}
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
    setupTooltips();
});

// 设置自定义工具提示
function setupTooltips() {
    // 检测是否为移动设备
    const isMobile = window.innerWidth <= 768;
    
    // 如果是移动设备，不添加任何工具提示相关代码
    if (isMobile) {
        return;
    }
    
    // 只在非移动设备上创建工具提示元素
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
    
    // 监听所有状态点的鼠标事件
    document.addEventListener('mouseover', function(e) {
        const target = e.target;
        if (target.classList.contains('status-dot') || target.parentElement.classList.contains('status-dot')) {
            const dot = target.classList.contains('status-dot') ? target : target.parentElement;
            
            // 使用数据属性获取状态点的信息
            const time = dot.dataset.time;
            const status = dot.dataset.status;
            const latency = dot.dataset.latency;
            
            // 如果有时间数据，则显示工具提示
            if (time || status === 'no_data') {
                let tooltipText = '';
                
                if (status === 'no_data') {
                    tooltipText = '无历史数据';
                } else {
                    // 状态文本
                    const statusText = (status === 'up' || status === 'success') ? '在线' : '离线';
                    
                    // 处理时间格式，去掉秒数
                    let simplifiedTime = time;
                    if (time && time.includes(':')) {
                        // 假设时间格式为 YYYY/MM/DD HH:MM:SS 或类似格式
                        const timeParts = time.split(' ');
                        if (timeParts.length > 1) {
                            const datePart = timeParts[0];
                            const timePart = timeParts[1].split(':');
                            if (timePart.length >= 2) {
                                // 只保留小时和分钟
                                simplifiedTime = `${datePart} ${timePart[0]}:${timePart[1]}`;
                            }
                        }
                    }
                    
                    // 组装简洁的单行提示，格式: "状态 - 时间 - 延迟"
                    tooltipText = `<span class="${status === 'up' || status === 'success' ? 'status-online' : 'status-offline'}">${statusText}</span> - ${simplifiedTime}`;
                    
                    // 如果有延迟数据则添加，使用相同的连接符号
                    if (latency && (status === 'up' || status === 'success')) {
                        tooltipText += ` - ${latency}ms`;
                    }
                }
                
                tooltip.innerHTML = tooltipText;
                tooltip.style.display = 'block';
                
                // 跟随鼠标位置
                document.addEventListener('mousemove', updateTooltipPosition);
                updateTooltipPosition(e);
            }
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        const target = e.target;
        if (target.classList.contains('status-dot') || target.parentElement.classList.contains('status-dot')) {
            tooltip.style.display = 'none';
            document.removeEventListener('mousemove', updateTooltipPosition);
        }
    });
    
    // 更新工具提示位置
    function updateTooltipPosition(e) {
        const x = e.clientX;
        const y = e.clientY;
        
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        
        // 避免工具提示超出屏幕
        let posX = x + 15; // 鼠标右侧15像素
        let posY = y - tooltipHeight - 10; // 鼠标上方10像素
        
        if (posX + tooltipWidth > window.innerWidth) {
            posX = x - tooltipWidth - 15; // 如果超出右边界，放在鼠标左侧
        }
        
        if (posY < 0) {
            posY = y + 20; // 如果超出上边界，放在鼠标下方
        }
        
        tooltip.style.left = posX + 'px';
        tooltip.style.top = posY + 'px';
    }
}
