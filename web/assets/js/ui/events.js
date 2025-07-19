/**
 * 事件处理模块
 * 处理用户交互事件
 */

export const events = {
    // 键盘事件处理
    handleKeyDown(event, element) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.toggleSiteDetails(element);
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

// 向后兼容：将事件处理函数暴露到全局
if (typeof window !== 'undefined') {
    window.handleKeyDown = events.handleKeyDown.bind(events);
    window.toggleSiteDetails = events.toggleSiteDetails.bind(events);
}
