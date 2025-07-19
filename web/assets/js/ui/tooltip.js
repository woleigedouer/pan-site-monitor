/**
 * 工具提示系统模块
 * 处理状态点的悬停提示功能
 */

import { CONFIG } from '../config.js';
import { utils } from '../utils.js';
import { state } from '../state.js';

export const tooltip = {
    element: null,
    mouseMoveHandler: null,

    // 设置自定义工具提示
    setup() {
        // 动态检测是否为移动设备
        if (utils.isMobileDevice()) {
            return;
        }

        // 只在非移动设备上创建工具提示元素
        this.element = document.createElement('div');
        this.element.className = 'tooltip';
        document.body.appendChild(this.element);
        state.tooltip = this.element;

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
        if (utils.isMobileDevice()) {
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
    },

    // 显示工具提示
    showTooltip(dot, event) {
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
            if (!state.tooltipMouseMoveActive) {
                this.mouseMoveHandler = (e) => this.updatePosition(e);
                document.addEventListener('mousemove', this.mouseMoveHandler);
                state.tooltipMouseMoveActive = true;
                if (typeof window !== 'undefined') {
                    window.tooltipMouseMoveActive = true; // 同步全局变量
                }
            }
            this.updatePosition(event);
        }
    },

    // 隐藏工具提示
    hideTooltip() {
        if (this.element) {
            this.element.style.display = 'none';
        }

        // 安全移除监听器，防止重复移除
        if (state.tooltipMouseMoveActive && this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler);
            state.tooltipMouseMoveActive = false;
            if (typeof window !== 'undefined') {
                window.tooltipMouseMoveActive = false; // 同步全局变量
            }
            this.mouseMoveHandler = null;
        }
    },

    // 生成工具提示文本
    generateTooltipText(status, time, latency) {
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
    },

    // 更新工具提示位置
    updatePosition(e) {
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
    }
};

// 向后兼容：将工具提示函数暴露到全局
if (typeof window !== 'undefined') {
    window.setupTooltips = tooltip.setup.bind(tooltip);
}
