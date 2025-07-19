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

// 定时器管理变量
let countdownTimer = null;

// 工具提示事件监听器管理变量
let tooltipMouseMoveActive = false;

// 动态检测移动设备
function isMobileDevice() {
    return window.innerWidth <= 768;
}



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
    // 清理之前的定时器，防止内存泄漏
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }

    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 1000);
}

// 键盘事件处理
function handleKeyDown(event, element) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleSiteDetails(element);
    }
}

// 切换站点详情展开/收起
function toggleSiteDetails(element) {
    const isExpanded = element.classList.contains('expanded');
    const siteDetails = element.querySelector('.site-details');
    const header = element.querySelector('.site-header');

    if (siteDetails && header) {
        if (!isExpanded) {
            // 展开：从CSS变量获取高度，确保与样式同步
            const urlItems = siteDetails.querySelectorAll('.url-item');
            const itemHeight = parseInt(
                getComputedStyle(document.documentElement)
                .getPropertyValue('--url-item-height')
            );
            const dynamicHeight = urlItems.length * itemHeight;

            element.classList.add('expanded');
            siteDetails.style.maxHeight = dynamicHeight + 'px';
            siteDetails.setAttribute('aria-hidden', 'false');
            header.setAttribute('aria-expanded', 'true');
        } else {
            // 收起
            element.classList.remove('expanded');
            siteDetails.style.maxHeight = '0px';
            siteDetails.setAttribute('aria-hidden', 'true');
            header.setAttribute('aria-expanded', 'false');
        }
    }
}

// 生成状态历史数据（使用真实数据或显示无数据状态）
function generateStatusHistory(siteName, url) {
    // 始终返回固定长度的历史数据（12个点）
    const HISTORY_LENGTH = 12;
    // 修复：使用map创建独立的对象，避免对象引用共享问题
    let history = Array(HISTORY_LENGTH).fill().map(() => ({
        status: 'no_data',
        timestamp: '',
        latency: null
    }));
    
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

    Object.entries(data.sites).forEach(([siteName, siteData], index) => {
        const siteItem = document.createElement('article');
        siteItem.className = `site-item ${siteData.status === 'failed' ? 'failed' : ''}`;
        siteItem.setAttribute('role', 'article');
        siteItem.setAttribute('aria-labelledby', `site-name-${index}`);

        let headerContent = '';
        if (siteData.status === 'success' && siteData.best_url) {
            const bestUrlData = siteData.urls.find(u => u.is_best);
            const latencyMs = bestUrlData.latency * 1000;
            const latencyClass = formatLatency(latencyMs);
            const statusHistory = generateStatusHistory(siteName, siteData.best_url);

            headerContent = `
                <div class="status-indicator success" role="img" aria-label="站点在线"></div>
                <div class="site-info">
                    <div class="site-name" id="site-name-${index}">${siteName}</div>
                    <div class="best-url">${siteData.best_url}</div>
                </div>
                <div class="monitor-stats">
                    <div class="response-badge ${latencyClass}" role="status" aria-label="响应时间 ${latencyMs.toFixed(0)} 毫秒">${latencyMs.toFixed(0)}ms</div>
                    <div class="status-history" role="group" aria-label="状态历史记录">
                        ${statusHistory.map((item, historyIndex) => {
                            const statusLabel = item.status === 'success' || item.status === 'up' ? '在线' :
                                              item.status === 'no_data' ? '无数据' : '离线';
                            return `<div class="status-dot ${item.status}"
                                        data-time="${item.timestamp}"
                                        data-status="${item.status}"
                                        data-latency="${item.latency ? (item.latency * 1000).toFixed(0) : ''}"
                                        role="img"
                                        aria-label="历史状态点 ${historyIndex + 1}: ${statusLabel}${item.timestamp ? ', 时间: ' + item.timestamp : ''}">
                                    <span></span>
                                  </div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            const statusHistory = generateStatusHistory(siteName, null);

            headerContent = `
                <div class="status-indicator failed" role="img" aria-label="站点离线"></div>
                <div class="site-info">
                    <div class="site-name" id="site-name-${index}">${siteName}</div>
                    <div class="best-url failed-url">所有URL均不可用</div>
                </div>
                <div class="monitor-stats">
                    <div class="response-badge danger" role="status" aria-label="站点状态：失败">失败</div>
                    <div class="status-history" role="group" aria-label="状态历史记录">
                        ${statusHistory.map((item, historyIndex) => {
                            const statusLabel = item.status === 'success' || item.status === 'up' ? '在线' :
                                              item.status === 'no_data' ? '无数据' : '离线';
                            return `<div class="status-dot ${item.status}"
                                        data-time="${item.timestamp}"
                                        data-status="${item.status}"
                                        data-latency="${item.latency ? (item.latency * 1000).toFixed(0) : ''}"
                                        role="img"
                                        aria-label="历史状态点 ${historyIndex + 1}: ${statusLabel}${item.timestamp ? ', 时间: ' + item.timestamp : ''}">
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

    let data = null;
    let errorDetails = null;

    try {
        // 首先尝试加载历史数据
        siteHistoryData = await loadHistoryData();

        // 尝试API端点
        try {
            console.log('🔄 尝试从API加载数据...');
            const response = await fetch('/api/data');

            if (response.ok) {
                try {
                    data = await response.json();
                    console.log('✅ 成功从API加载数据');
                } catch (jsonError) {
                    errorDetails = {
                        type: 'api_json_parse_error',
                        message: 'API响应JSON解析失败',
                        error: jsonError
                    };
                    throw jsonError;
                }
            } else {
                errorDetails = {
                    type: 'api_http_error',
                    message: `API请求失败: HTTP ${response.status}`,
                    status: response.status
                };
                throw new Error(`API HTTP ${response.status}`);
            }
        } catch (apiError) {
            console.warn('⚠️ API加载失败，尝试本地文件:', errorDetails?.message || apiError.message);

            // 尝试本地文件
            try {
                console.log('🔄 尝试从本地文件加载数据...');
                const response = await fetch('../data/test_results.json');

                if (response.ok) {
                    try {
                        data = await response.json();
                        console.log('✅ 成功从本地文件加载数据');
                    } catch (jsonError) {
                        errorDetails = {
                            type: 'local_json_parse_error',
                            message: '本地文件JSON解析失败',
                            error: jsonError
                        };
                        throw jsonError;
                    }
                } else {
                    errorDetails = {
                        type: 'local_file_not_found',
                        message: '本地数据文件不存在',
                        status: response.status
                    };
                    throw new Error(`Local file ${response.status}`);
                }
            } catch (localError) {
                errorDetails = errorDetails || {
                    type: 'local_fetch_error',
                    message: '本地文件加载失败',
                    error: localError
                };
                throw localError;
            }
        }

        if (data) {
            renderSites(data);
            loading.style.display = 'none';
        }

    } catch (err) {
        // 详细的错误处理和日志
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
    // 动态检测是否为移动设备
    if (isMobileDevice()) {
        return;
    }
    
    // 只在非移动设备上创建工具提示元素
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
    
    // 监听所有状态点的鼠标事件
    document.addEventListener('mouseover', function(e) {
        // 动态检测移动设备，如果是移动设备则不显示工具提示
        if (isMobileDevice()) {
            return;
        }

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
                
                // 跟随鼠标位置 - 防止重复添加监听器
                if (!tooltipMouseMoveActive) {
                    document.addEventListener('mousemove', updateTooltipPosition);
                    tooltipMouseMoveActive = true;
                }
                updateTooltipPosition(e);
            }
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        const target = e.target;
        if (target.classList.contains('status-dot') || target.parentElement.classList.contains('status-dot')) {
            tooltip.style.display = 'none';
            // 安全移除监听器，防止重复移除
            if (tooltipMouseMoveActive) {
                document.removeEventListener('mousemove', updateTooltipPosition);
                tooltipMouseMoveActive = false;
            }
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