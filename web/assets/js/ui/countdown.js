/**
 * 倒计时功能模块
 * 处理倒计时显示和进度条更新
 */

import { CONFIG } from '../config.js';
import { state } from '../state.js';

export const countdown = {
    // 更新倒计时显示
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
        if (state.countdownTimer) {
            clearInterval(state.countdownTimer);
        }

        this.updateCountdown();
        state.countdownTimer = setInterval(() => this.updateCountdown(), 1000);

        // 同步全局变量
        if (typeof window !== 'undefined') {
            window.countdownTimer = state.countdownTimer;
        }
    },

    // 停止倒计时
    stopCountdown() {
        if (state.countdownTimer) {
            clearInterval(state.countdownTimer);
            state.countdownTimer = null;
            if (typeof window !== 'undefined') {
                window.countdownTimer = null;
            }
        }
    }
};

// 向后兼容：将倒计时函数暴露到全局
if (typeof window !== 'undefined') {
    window.updateCountdown = countdown.updateCountdown.bind(countdown);
    window.startCountdown = countdown.startCountdown.bind(countdown);
}
