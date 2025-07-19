/**
 * 应用配置模块
 * 包含所有应用级别的配置常量
 */

export const CONFIG = {
    LATENCY_THRESHOLDS: {
        GOOD: 500    // 500ms以下为绿色，以上为黄色
    },
    LOADING_ERROR_DELAY: 3000,  // 加载失败时保持加载状态的时间(毫秒)
    COUNTDOWN_INTERVAL: 60 * 60 * 1000,  // 倒计时间隔：1小时（毫秒）
    HISTORY_LENGTH: 12,  // 状态历史点数量
    TOOLTIP_OFFSET: { x: 15, y: 10 }  // 工具提示偏移量
};

// 向后兼容：将CONFIG暴露到全局
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
