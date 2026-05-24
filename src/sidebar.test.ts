import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SidebarManager } from './sidebar';

describe('SidebarManager', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="home-metrics-container"></div>
            <div id="market-metrics-container"></div>
            <div id="investor-metrics-container"></div>
        `;
    });

    it('should initialize active metric correctly', () => {
        const sidebar = new SidebarManager();
        expect(sidebar.getActiveMetric()).toBe('homeValue');
    });

    it('should update active classes and trigger callback on click', () => {
        const sidebar = new SidebarManager();
        const callback = vi.fn();
        sidebar.onMetricChange(callback);

        const options = document.querySelectorAll('.metric-option');
        // Let's find the homeYoyGrowth option
        const secondOption = Array.from(options).find(opt => {
            const input = opt.querySelector('input');
            return input?.value === 'homeYoyGrowth';
        }) as HTMLElement;

        expect(secondOption).toBeDefined();

        // Click the second option
        secondOption.click();

        expect(secondOption.classList.contains('active')).toBe(true);
        expect(sidebar.getActiveMetric()).toBe('homeYoyGrowth');
        expect(callback).toHaveBeenCalledWith('homeYoyGrowth');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should disable unsupported metrics on level change and fallback if necessary', () => {
        const sidebar = new SidebarManager();
        // Since default active is homeValue (supported on all levels), we can select 'medianSalePrice' (supported on metro only)
        sidebar.selectMetric('medianSalePrice');
        expect(sidebar.getActiveMetric()).toBe('medianSalePrice');

        // Now change geographic level to 'zip' (which doesn't support medianSalePrice)
        sidebar.updateLevelSelectorConstraints('zip');

        // It should have disabled the option and fallen back to 'homeValue'
        expect(sidebar.getActiveMetric()).toBe('homeValue');

        const medianSalePriceOption = document.querySelector('input[value="medianSalePrice"]')?.parentElement;
        expect(medianSalePriceOption?.classList.contains('disabled')).toBe(true);
        expect(document.querySelector('input[value="medianSalePrice"]')).toHaveProperty('disabled', true);
    });
});
