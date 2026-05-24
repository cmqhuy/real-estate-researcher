import { describe, it, expect, beforeEach } from 'vitest';
import { TooltipManager } from './tooltip';

describe('TooltipManager', () => {
    let tooltip: TooltipManager;

    beforeEach(() => {
        // Clear body
        document.body.innerHTML = '';
        tooltip = new TooltipManager();
    });

    it('should create and append custom-tooltip element to body', () => {
        const el = document.querySelector('.custom-tooltip');
        expect(el).not.toBeNull();
        expect(el?.querySelector('#tt-zip')).not.toBeNull();
        expect(el?.querySelector('#tt-value')).not.toBeNull();
    });

    it('should display correctly formatted values in show()', () => {
        // 1. Home value currency formatting
        tooltip.show('zip', '75001', 450000, 'Addison', 'TX', 'homeValue');
        expect(document.getElementById('tt-value')!.textContent).toBe('$450,000');
        expect(document.getElementById('tt-zip')!.textContent).toBe('ZIP Code 75001');
        expect(document.getElementById('tt-location')!.textContent).toBe('Addison, TX');

        // 2. Growth percentage formatting
        tooltip.show('county', '48001', 0.054, 'Anderson', 'TX', 'homeYoyGrowth');
        expect(document.getElementById('tt-value')!.textContent).toBe('+5.4%');
        expect(document.getElementById('tt-zip')!.textContent).toBe('County');

        // 3. Days on Market formatting
        tooltip.show('metro', '12345', 45.2, 'Seattle, WA', 'WA', 'homeDaysOnMarket');
        expect(document.getElementById('tt-value')!.textContent).toBe('45 days');
        expect(document.getElementById('tt-zip')!.textContent).toBe('Metro Area');
    });

    it('should show and hide tooltip visibility classes', () => {
        const el = document.querySelector('.custom-tooltip') as HTMLElement;
        expect(el.classList.contains('visible')).toBe(false);

        tooltip.show('zip', '75001', 450000, 'Addison', 'TX', 'homeValue');
        expect(el.classList.contains('visible')).toBe(true);

        tooltip.hide();
        expect(el.classList.contains('visible')).toBe(false);
    });
});
