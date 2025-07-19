/**
 * 站点监控应用 - 模块化重构版本
 * 保持完全的向后兼容性，同时提供更好的代码组织
 */

// 应用配置
const CONFIG = {
    LATENCY_THRESHOLDS: {
        GOOD: 500    // 500ms以下为绿色，以上为黄色
    },
    LOADING_ERROR_DELAY: 3000,  // 加载失败时保持加载状态的时间(毫秒)
    COUNTDOWN_INTERVAL: 60 * 60 * 1000,  // 倒计时间隔：1小时（毫秒）
    HISTORY_LENGTH: 12,  // 状态历史点数量
    TOOLTIP_OFFSET: { x: 15, y: 10 }  // 工具提示偏移量
};

/**
 * 主应用模块 - 封装所有功能但保持全局访问
 */
const MonitorApp = {
    // 应用状态
    state: {
        siteHistoryData: {},
        countdownTimer: null,
        tooltipMouseMoveActive: false,
        tooltip: null
    },

    // 配置访问
    config: CONFIG,

    // 工具函数模块
    utils: {},

    // UI组件模块
    ui: {},

    // 数据处理模块
    data: {},

    // 初始化应用
    init() {
        this.data.loadData();
        this.ui.startCountdown();
        this.ui.tooltip.setup();
    }
};

// 保持向后兼容的全局变量（指向模块化状态）
let siteHistoryData = MonitorApp.state.siteHistoryData;
let countdownTimer = MonitorApp.state.countdownTimer;
let tooltipMouseMoveActive = MonitorApp.state.tooltipMouseMoveActive;

/**
 * 工具函数模块
 */
MonitorApp.utils = {
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

// 保持向后兼容的全局函数
function isMobileDevice() {
    return MonitorApp.utils.isMobileDevice();
}

function formatLatency(latency) {
    return MonitorApp.utils.formatLatency(latency);
}

/**
 * UI组件模块
 */
MonitorApp.ui = {
    // 倒计时功能
    updateCountdown() {
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
    },

    // 启动倒计时
    startCountdown() {
        // 清理之前的定时器，防止内存泄漏
        if (MonitorApp.state.countdownTimer) {
            clearInterval(MonitorApp.state.countdownTimer);
        }

        this.updateCountdown();
        MonitorApp.state.countdownTimer = setInterval(() => this.updateCountdown(), 1000);

        // 同步全局变量
        countdownTimer = MonitorApp.state.countdownTimer;
    },

    // 停止倒计时
    stopCountdown() {
        if (MonitorApp.state.countdownTimer) {
            clearInterval(MonitorApp.state.countdownTimer);
            MonitorApp.state.countdownTimer = null;
            countdownTimer = null;
        }
    }
};

// 保持向后兼容的全局函数
function updateCountdown() {
    MonitorApp.ui.updateCountdown();
}

function startCountdown() {
    MonitorApp.ui.startCountdown();
}

// 继续UI模块 - 事件处理
MonitorApp.ui.events = {
    // 键盘事件处理
    handleKeyDown(event, element) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            MonitorApp.ui.toggleSiteDetails(element);
        }
    },

    // 切换站点详情展开/收起
    toggleSiteDetails(element) {
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
};

// 将事件处理方法添加到UI模块
MonitorApp.ui.handleKeyDown = MonitorApp.ui.events.handleKeyDown;
MonitorApp.ui.toggleSiteDetails = MonitorApp.ui.events.toggleSiteDetails;

// 保持向后兼容的全局函数
function handleKeyDown(event, element) {
    MonitorApp.ui.handleKeyDown(event, element);
}

function toggleSiteDetails(element) {
    MonitorApp.ui.toggleSiteDetails(element);
}

/**
 * 数据处理模块
 */
MonitorApp.data = {
    // 生成状态历史数据（使用真实数据或显示无数据状态）
    generateStatusHistory(siteName, url) {
        // 始终返回固定长度的历史数据
        const HISTORY_LENGTH = CONFIG.HISTORY_LENGTH;
        // 修复：使用map创建独立的对象，避免对象引用共享问题
        let history = Array(HISTORY_LENGTH).fill().map(() => ({
            status: 'no_data',
            timestamp: '',
            latency: null
        }));

        // 尝试使用URL特定的历史数据（如果提供了URL）
        let historyRecords = null;
        if (url && siteName && MonitorApp.state.siteHistoryData[siteName] && MonitorApp.state.siteHistoryData[siteName][url]) {
            // 新的嵌套结构格式
            historyRecords = MonitorApp.state.siteHistoryData[siteName][url];
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
};

// 保持向后兼容的全局函数
function generateStatusHistory(siteName, url) {
    return MonitorApp.data.generateStatusHistory(siteName, url);
}

// 继续数据处理模块 - 渲染组件
MonitorApp.data.render = {
    // 创建状态历史HTML
    createStatusHistoryHTML(statusHistory) {
        return statusHistory.map((item, historyIndex) => {
            const statusLabel = item.status === 'success' || item.status === 'up' ? '在线' :
                              item.status === 'no_data' ? '无数据' : '离线';
            return `<div class="status-dot ${item.status}"
                        data-time="${MonitorApp.utils.sanitizeHTML(item.timestamp)}"
                        data-status="${MonitorApp.utils.sanitizeHTML(item.status)}"
                        data-latency="${item.latency ? (item.latency * 1000).toFixed(0) : ''}"
                        role="img"
                        aria-label="历史状态点 ${historyIndex + 1}: ${statusLabel}${item.timestamp ? ', 时间: ' + item.timestamp : ''}">
                    <span></span>
                  </div>`;
        }).join('');
    },

    // 创建成功站点的头部内容
    createSuccessHeaderContent(siteName, siteData, index) {
        const bestUrlData = siteData.urls.find(u => u.is_best);
        const latencyMs = bestUrlData.latency * 1000;
        const latencyClass = MonitorApp.utils.formatLatency(latencyMs);
        const statusHistory = MonitorApp.data.generateStatusHistory(siteName, siteData.best_url);

        return `
            <div class="status-indicator success" role="img" aria-label="站点在线"></div>
            <div class="site-info">
                <div class="site-name" id="site-name-${index}">${MonitorApp.utils.sanitizeHTML(siteName)}</div>
                <div class="best-url">${MonitorApp.utils.sanitizeHTML(siteData.best_url)}</div>
            </div>
            <div class="monitor-stats">
                <div class="response-badge ${latencyClass}" role="status" aria-label="响应时间 ${latencyMs.toFixed(0)} 毫秒">${latencyMs.toFixed(0)}ms</div>
                <div class="status-history" role="group" aria-label="状态历史记录">
                    ${this.createStatusHistoryHTML(statusHistory)}
                </div>
            </div>
        `;
    },

    // 创建失败站点的头部内容
    createFailedHeaderContent(siteName, index) {
        const statusHistory = MonitorApp.data.generateStatusHistory(siteName, null);

        return `
            <div class="status-indicator failed" role="img" aria-label="站点离线"></div>
            <div class="site-info">
                <div class="site-name" id="site-name-${index}">${MonitorApp.utils.sanitizeHTML(siteName)}</div>
                <div class="best-url failed-url">所有URL均不可用</div>
            </div>
            <div class="monitor-stats">
                <div class="response-badge danger" role="status" aria-label="站点状态：失败">失败</div>
                <div class="status-history" role="group" aria-label="状态历史记录">
                    ${this.createStatusHistoryHTML(statusHistory)}
                </div>
            </div>
        `;
    }
};

// 渲染站点列表 - 重构版本
function renderSites(data) {
    // 数据验证
    try {
        MonitorApp.utils.validateSiteData(data);
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
            headerContent = MonitorApp.data.render.createSuccessHeaderContent(siteName, siteData, index);
        } else {
            headerContent = MonitorApp.data.render.createFailedHeaderContent(siteName, index);
        }

        // 创建详情内容
        const detailsContent = MonitorApp.data.render.createDetailsContent(siteName, siteData);

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
    MonitorApp.data.render.updateLastUpdateTime(data);
}

// 继续渲染组件 - 详情内容创建
MonitorApp.data.render.createDetailsContent = function(siteName, siteData) {
    if (!siteData.urls || siteData.urls.length === 0) {
        return '';
    }

    let urlsToShow = [];
    if (siteData.status === 'success') {
        // 成功站点：显示除最佳URL外的其他URL
        urlsToShow = siteData.urls.filter(u => !u.is_best);
    } else {
        // 失败站点：显示所有URL
        urlsToShow = siteData.urls;
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
};

// 创建URL项目HTML
MonitorApp.data.render.createUrlItemHTML = function(siteName, urlData, index) {
    const latencyMs = urlData.latency ? urlData.latency * 1000 : 0;
    const latencyClass = urlData.latency ? MonitorApp.utils.formatLatency(latencyMs) : 'danger';
    const statusHistory = MonitorApp.data.generateStatusHistory(siteName, urlData.url);
    const statusIndicatorClass = urlData.latency ? 'success' : 'failed';

    // 生成状态文本：优先显示详细错误信息
    let statusText;
    if (urlData.latency) {
        statusText = `${latencyMs.toFixed(0)}ms`;
    } else if (urlData.error_detail) {
        statusText = MonitorApp.utils.sanitizeHTML(urlData.error_detail);
    } else {
        statusText = '失败';
    }

    return `
    <div class="url-item">
        <div class="status-indicator ${statusIndicatorClass}"></div>
        <div class="backup-url-info">
            <div class="backup-url-name">${MonitorApp.utils.sanitizeHTML(siteName)}<sup>${index + 2}</sup></div>
            <div class="url-text">${MonitorApp.utils.sanitizeHTML(urlData.url)}</div>
        </div>
        <div class="backup-url-stats">
            <div class="response-badge ${latencyClass}">${statusText}</div>
            <div class="backup-status-history">
                ${this.createStatusHistoryHTML(statusHistory)}
            </div>
        </div>
    </div>
    `;
};

// 更新最后更新时间
MonitorApp.data.render.updateLastUpdateTime = function(data) {
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
};

// 继续数据处理模块 - 数据加载
MonitorApp.data.loadHistoryData = async function() {
    try {
        const response = await fetch('../data/history.json');
        if (response.ok) {
            const historyData = await response.json();
            MonitorApp.state.siteHistoryData = historyData;
            // 同步全局变量
            siteHistoryData = historyData;
            return historyData;
        }
    } catch (e) {
        console.error('加载历史数据失败:', e);
    }
    return {}; // 如果加载失败返回空对象
};

// 保持向后兼容的全局函数
async function loadHistoryData() {
    return await MonitorApp.data.loadHistoryData();
}

// 主数据加载函数 - 重构版本
MonitorApp.data.loadData = async function() {
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
            renderSites(data);
            loading.style.display = 'none';
        }

    } catch (err) {
        this.handleLoadError(err, errorDetails, loading);
    }
};

// 从多个数据源获取数据
MonitorApp.data.fetchDataFromSources = async function() {
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
};

// 处理加载错误
MonitorApp.data.handleLoadError = function(err, errorDetails, loading) {
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
};

// 保持向后兼容的全局函数
async function loadData() {
    await MonitorApp.data.loadData();
}

// 工具提示系统模块
MonitorApp.ui.tooltip = {
    element: null,
    mouseMoveHandler: null,

    // 设置自定义工具提示
    setup() {
        // 动态检测是否为移动设备
        if (MonitorApp.utils.isMobileDevice()) {
            return;
        }

        // 只在非移动设备上创建工具提示元素
        this.element = document.createElement('div');
        this.element.className = 'tooltip';
        document.body.appendChild(this.element);
        MonitorApp.state.tooltip = this.element;

        this.bindEvents();
    },

    // 绑定事件
    bindEvents() {
        // 监听所有状态点的鼠标事件
        document.addEventListener('mouseover', (e) => this.handleMouseOver(e));
        document.addEventListener('mouseout', (e) => this.handleMouseOut(e));
    },

    // 鼠标悬停处理
    handleMouseOver(e) {
        // 动态检测移动设备，如果是移动设备则不显示工具提示
        if (MonitorApp.utils.isMobileDevice()) {
            return;
        }

        const target = e.target;
        if (target.classList.contains('status-dot') || target.parentElement.classList.contains('status-dot')) {
            const dot = target.classList.contains('status-dot') ? target : target.parentElement;
            this.showTooltip(dot, e);
        }
    },

    // 鼠标离开处理
    handleMouseOut(e) {
        const target = e.target;
        if (target.classList.contains('status-dot') || target.parentElement.classList.contains('status-dot')) {
            this.hideTooltip();
        }
    }
};

// 页面加载时自动加载数据和启动倒计时
document.addEventListener('DOMContentLoaded', () => {
    MonitorApp.init();
});

// 保持向后兼容的全局函数
function setupTooltips() {
    MonitorApp.ui.tooltip.setup();
}

// 继续工具提示系统 - 显示和隐藏逻辑
MonitorApp.ui.tooltip.showTooltip = function(dot, event) {
    // 使用数据属性获取状态点的信息
    const time = dot.dataset.time;
    const status = dot.dataset.status;
    const latency = dot.dataset.latency;

    // 如果有时间数据，则显示工具提示
    if (time || status === 'no_data') {
        const tooltipText = this.generateTooltipText(status, time, latency);

        this.element.innerHTML = tooltipText;
        this.element.style.display = 'block';

        // 跟随鼠标位置 - 防止重复添加监听器
        if (!MonitorApp.state.tooltipMouseMoveActive) {
            this.mouseMoveHandler = (e) => this.updatePosition(e);
            document.addEventListener('mousemove', this.mouseMoveHandler);
            MonitorApp.state.tooltipMouseMoveActive = true;
            tooltipMouseMoveActive = true; // 同步全局变量
        }
        this.updatePosition(event);
    }
};

MonitorApp.ui.tooltip.hideTooltip = function() {
    if (this.element) {
        this.element.style.display = 'none';
    }

    // 安全移除监听器，防止重复移除
    if (MonitorApp.state.tooltipMouseMoveActive && this.mouseMoveHandler) {
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        MonitorApp.state.tooltipMouseMoveActive = false;
        tooltipMouseMoveActive = false; // 同步全局变量
        this.mouseMoveHandler = null;
    }
};

// 生成工具提示文本
MonitorApp.ui.tooltip.generateTooltipText = function(status, time, latency) {
    if (status === 'no_data') {
        return '无历史数据';
    }

    // 状态文本
    const statusText = (status === 'up' || status === 'success') ? '在线' : '离线';

    // 处理时间格式，去掉秒数
    let simplifiedTime = time;
    if (time && time.includes(':')) {
        const timeParts = time.split(' ');
        if (timeParts.length > 1) {
            const datePart = timeParts[0];
            const timePart = timeParts[1].split(':');
            if (timePart.length >= 2) {
                simplifiedTime = `${datePart} ${timePart[0]}:${timePart[1]}`;
            }
        }
    }

    // 组装简洁的单行提示
    let tooltipText = `<span class="${status === 'up' || status === 'success' ? 'status-online' : 'status-offline'}">${statusText}</span> - ${simplifiedTime}`;

    // 如果有延迟数据则添加
    if (latency && (status === 'up' || status === 'success')) {
        tooltipText += ` - ${latency}ms`;
    }

    return tooltipText;
};

// 更新工具提示位置
MonitorApp.ui.tooltip.updatePosition = function(e) {
    if (!this.element) return;

    const x = e.clientX;
    const y = e.clientY;

    const tooltipWidth = this.element.offsetWidth;
    const tooltipHeight = this.element.offsetHeight;

    // 避免工具提示超出屏幕
    let posX = x + CONFIG.TOOLTIP_OFFSET.x;
    let posY = y - tooltipHeight - CONFIG.TOOLTIP_OFFSET.y;

    if (posX + tooltipWidth > window.innerWidth) {
        posX = x - tooltipWidth - CONFIG.TOOLTIP_OFFSET.x;
    }

    if (posY < 0) {
        posY = y + 20;
    }

    this.element.style.left = posX + 'px';
    this.element.style.top = posY + 'px';
};

// 将工具提示方法添加到UI模块
MonitorApp.ui.setupTooltips = MonitorApp.ui.tooltip.setup;