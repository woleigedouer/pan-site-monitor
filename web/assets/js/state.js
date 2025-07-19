/**
 * 应用状态管理模块
 * 集中管理应用的所有状态
 */

export const state = {
    siteHistoryData: {},
    countdownTimer: null,
    tooltipMouseMoveActive: false,
    tooltip: null
};

// 向后兼容：将状态变量暴露到全局
if (typeof window !== 'undefined') {
    window.siteHistoryData = state.siteHistoryData;
    window.countdownTimer = state.countdownTimer;
    window.tooltipMouseMoveActive = state.tooltipMouseMoveActive;
}
