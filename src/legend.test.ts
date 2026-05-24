import { describe, it, expect, beforeEach } from 'vitest';
import { LegendManager } from './legend';

describe('LegendManager', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="legend-container">
                <div id="legend-title">--</div>
                <div id="legend-min">--</div>
                <div id="legend-mid">--</div>
                <div id="legend-max">--</div>
            </div>
        `;
    });

    it('should initialize and locate legend elements', () => {
        const legend = new LegendManager();
        expect(legend).toBeDefined();
        expect(document.getElementById('legend-title')!.textContent).toBe('--');
    });

    it('should format and update currency metric legend values', () => {
        const legend = new LegendManager();
        
        // homeValue (absolute currency)
        legend.update('homeValue', 150000, 450000, 300000);
        
        expect(document.getElementById('legend-title')!.textContent).toBe('Home Value');
        expect(document.getElementById('legend-min')!.textContent).toBe('$150K');
        expect(document.getElementById('legend-mid')!.textContent).toBe('$300K');
        expect(document.getElementById('legend-max')!.textContent).toBe('$450K');
    });

    it('should format and update growth metric legend values', () => {
        const legend = new LegendManager();
        
        // homeYoyGrowth (percentage growth)
        legend.update('homeYoyGrowth', -0.05, 0.05, 0);
        
        expect(document.getElementById('legend-title')!.textContent).toBe('Home Value Growth (YoY)');
        expect(document.getElementById('legend-min')!.textContent).toBe('-5.0%');
        expect(document.getElementById('legend-mid')!.textContent).toBe('0.0%');
        expect(document.getElementById('legend-max')!.textContent).toBe('+5.0%');
    });

    it('should format and update Days on Market metric values', () => {
        const legend = new LegendManager();
        
        // homeDaysOnMarket (days count)
        legend.update('homeDaysOnMarket', 0, 45, 0);
        
        expect(document.getElementById('legend-title')!.textContent).toBe('Days on Market');
        expect(document.getElementById('legend-min')!.textContent).toBe('0 days');
        expect(document.getElementById('legend-mid')!.textContent).toBe('0 days');
        expect(document.getElementById('legend-max')!.textContent).toBe('45 days');
    });

    it('should format and update new metrics (forecast, rentPerSqft, activeInventory, saleToListRatio)', () => {
        const legend = new LegendManager();

        // 1. homeValueForecast (represented as raw percentage in JSON e.g. -1.5)
        legend.update('homeValueForecast', -3.0, 3.0, 0);
        expect(document.getElementById('legend-title')!.textContent).toBe('Home Value Forecast (1-Year)');
        expect(document.getElementById('legend-min')!.textContent).toBe('-3.0%');
        expect(document.getElementById('legend-max')!.textContent).toBe('+3.0%');

        // 2. rentPerSqft (USD with 2 decimals)
        legend.update('rentPerSqft', 1.0, 3.0, 2.0);
        expect(document.getElementById('legend-title')!.textContent).toBe('Rent per Square Foot');
        expect(document.getElementById('legend-min')!.textContent).toBe('$1.00');
        expect(document.getElementById('legend-mid')!.textContent).toBe('$2.00');
        expect(document.getElementById('legend-max')!.textContent).toBe('$3.00');

        // 3. activeInventory (shortened counts)
        legend.update('activeInventory', 50, 1500, 750);
        expect(document.getElementById('legend-title')!.textContent).toBe('Active Inventory');
        expect(document.getElementById('legend-min')!.textContent).toBe('50');
        expect(document.getElementById('legend-mid')!.textContent).toBe('750');
        expect(document.getElementById('legend-max')!.textContent).toBe('1.5K');

        // 4. saleToListRatio (percentage without sign)
        legend.update('saleToListRatio', 0.95, 1.05, 1.0);
        expect(document.getElementById('legend-title')!.textContent).toBe('Sale-to-List Ratio');
        expect(document.getElementById('legend-min')!.textContent).toBe('95.0%');
        expect(document.getElementById('legend-mid')!.textContent).toBe('100.0%');
        expect(document.getElementById('legend-max')!.textContent).toBe('105.0%');
    });
});
