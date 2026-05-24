import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SidebarManager } from './sidebar';

describe('SidebarManager', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="metric-option active">
                <input type="radio" name="metric" value="homeValue" checked>
                <span>Home Value</span>
            </div>
            <div class="metric-option">
                <input type="radio" name="metric" value="homeYoyGrowth">
                <span>YoY Growth</span>
            </div>
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
        const secondOption = options[1] as HTMLElement;

        // Click the second option
        secondOption.click();

        expect(secondOption.classList.contains('active')).toBe(true);
        expect(options[0].classList.contains('active')).toBe(false);
        expect(sidebar.getActiveMetric()).toBe('homeYoyGrowth');
        expect(callback).toHaveBeenCalledWith('homeYoyGrowth');
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
