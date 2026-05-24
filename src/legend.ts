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
        const isGrowth = metric.includes('Growth') || metric === 'homeValueForecast';
        const isRatioOrShare = metric === 'saleToListRatio' || metric === 'priceCutShare' || 
                               metric === 'priceCutSize' || metric === 'pctSalesAboveList' || 
                               metric === 'pctSalesBelowList';
        const isDays = metric.toLowerCase().includes('daysonmarket');
        const isCount = metric === 'activeInventory' || metric === 'newListings' || metric === 'salesCount';
        const isPrice = metric === 'homeValue' || metric === 'rentValue' || metric === 'medianSalePrice' || metric === 'rentPerSqft';
        
        let title = 'Home Value';
        if (metric === 'homeValue') title = 'Home Value';
        if (metric === 'homeYoyGrowth') title = 'Home Value Growth (YoY)';
        if (metric === 'homeFiveYearGrowth') title = 'Home Value Growth (5-Year)';
        if (metric === 'homeMomGrowth') title = 'Home Value Growth (MoM)';
        if (metric === 'homeValueForecast') title = 'Home Value Forecast (1-Year)';
        if (metric === 'homeDaysOnMarket') title = 'Days on Market';
        if (metric === 'rentValue') title = 'Monthly Rent';
        if (metric === 'rentYoyGrowth') title = 'Rent Growth (YoY)';
        if (metric === 'rentFiveYearGrowth') title = 'Rent Growth (5-Year)';
        if (metric === 'rentMomGrowth') title = 'Rent Growth (MoM)';
        if (metric === 'rentDaysOnMarket') title = 'Days on Market';
        if (metric === 'activeInventory') title = 'Active Inventory';
        if (metric === 'newListings') title = 'New Listings';
        if (metric === 'priceCutShare') title = 'Share of Listings with Price Cuts';
        if (metric === 'priceCutSize') title = 'Median Price Cut Size';
        if (metric === 'salesCount') title = 'Sales Count';
        if (metric === 'medianSalePrice') title = 'Median Sale Price';
        if (metric === 'saleToListRatio') title = 'Sale-to-List Ratio';
        if (metric === 'pctSalesAboveList') title = 'Percent of Sales Above List';
        if (metric === 'pctSalesBelowList') title = 'Percent of Sales Below List';
        if (metric === 'rentPerSqft') title = 'Rent per Square Foot';
        
        this.titleEl.textContent = title;

        const format = (val: number) => {
            if (val === null || val === undefined || isNaN(val)) return 'N/A';
            if (isGrowth) {
                const pctVal = metric === 'homeValueForecast' ? val : val * 100;
                let s = pctVal.toFixed(1) + '%';
                return pctVal > 0 ? '+' + s : s;
            } else if (isRatioOrShare) {
                return (val * 100).toFixed(1) + '%';
            } else if (isDays) {
                return `${Math.round(val)} days`;
            } else if (isCount) {
                if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
                return Math.round(val).toLocaleString('en-US');
            } else if (isPrice) {
                if (metric === 'rentPerSqft') {
                    return '$' + val.toFixed(2);
                }
                if (metric === 'rentValue') {
                    return '$' + Math.round(val).toLocaleString('en-US');
                }
                if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'K';
                return '$' + Math.round(val).toLocaleString('en-US');
            }
            return val.toString();
        };

        this.minEl.textContent = format(min);
        this.midEl.textContent = format(midpoint);
        this.maxEl.textContent = format(max);
    }
}
