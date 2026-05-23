import type { MetricType } from './colors';

export class LegendManager {
    private titleEl: HTMLElement;
    private minEl: HTMLElement;
    private midEl: HTMLElement;
    private maxEl: HTMLElement;

    constructor() {
        this.titleEl = document.getElementById('legend-title')!;
        this.minEl = document.getElementById('legend-min')!;
        this.midEl = document.getElementById('legend-mid')!;
        this.maxEl = document.getElementById('legend-max')!;
    }

    update(metric: MetricType, min: number, max: number, midpoint: number) {
        const isPercent = metric.includes('Growth');
        
        let title = 'Home Value';
        if (metric === 'homeValue') title = 'Home Value';
        if (metric === 'homeYoyGrowth') title = 'Home Value Growth (YoY)';
        if (metric === 'homeFiveYearGrowth') title = 'Home Value Growth (5-Year)';
        if (metric === 'homeMomGrowth') title = 'Home Value Growth (MoM)';
        if (metric === 'homeDaysOnMarket') title = 'Days on Market';
        if (metric === 'rentValue') title = 'Monthly Rent';
        if (metric === 'rentYoyGrowth') title = 'Rent Growth (YoY)';
        if (metric === 'rentFiveYearGrowth') title = 'Rent Growth (5-Year)';
        if (metric === 'rentMomGrowth') title = 'Rent Growth (MoM)';
        if (metric === 'rentDaysOnMarket') title = 'Days on Market';
        
        this.titleEl.textContent = title;

        const format = (val: number) => {
            if (isPercent) {
                let s = (val * 100).toFixed(1) + '%';
                return val > 0 ? '+' + s : s;
            } else if (metric.toLowerCase().includes('daysonmarket')) {
                return `${Math.round(val)} days`;
            } else {
                if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'K';
                return '$' + val.toLocaleString('en-US', {maximumFractionDigits: 0});
            }
        };

        this.minEl.textContent = format(min);
        this.midEl.textContent = format(midpoint);
        this.maxEl.textContent = format(max);
    }
}
