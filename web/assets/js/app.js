/**
 * 主应用模块
 * 应用的核心入口和初始化逻辑
 */

import { CONFIG } from './config.js';
import { utils } from './utils.js';
import { state } from './state.js';
import { countdown } from './ui/countdown.js';
import { events } from './ui/events.js';
import { tooltip } from './ui/tooltip.js';
import { loader } from './data/loader.js';
import { renderer } from './data/renderer.js';

/**
 * 主应用模块 - 封装所有功能但保持全局访问
 */
export const MonitorApp = {
    // 应用状态
    state: state,

    // 配置访问
    config: CONFIG,

    // 工具函数模块
    utils: utils,

    // UI组件模块
    ui: {
        countdown: countdown,
        events: events,
        tooltip: tooltip,
        // 向后兼容的方法映射
        updateCountdown: countdown.updateCountdown.bind(countdown),
        startCountdown: countdown.startCountdown.bind(countdown),
        stopCountdown: countdown.stopCountdown.bind(countdown),
        handleKeyDown: events.handleKeyDown.bind(events),
        toggleSiteDetails: events.toggleSiteDetails.bind(events),
        setupTooltips: tooltip.setup.bind(tooltip)
    },

    // 数据处理模块
    data: {
        loader: loader,
        renderer: renderer,
        // 向后兼容的方法映射
        loadData: loader.loadData.bind(loader),
        loadHistoryData: loader.loadHistoryData.bind(loader),
        generateStatusHistory: renderer.generateStatusHistory.bind(renderer)
    },

    // 初始化应用
    init() {
        this.data.loadData();
        this.ui.startCountdown();
        this.ui.setupTooltips();
    }
};

// 初始化逻辑现在由main.js中的模块加载器处理

// 向后兼容：将MonitorApp暴露到全局
if (typeof window !== 'undefined') {
    window.MonitorApp = MonitorApp;
}
