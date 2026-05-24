import type { MetricType } from './colors';

export class TooltipManager {
    private element: HTMLDivElement;
    
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'custom-tooltip';
        this.element.innerHTML = `
            <button class="tooltip-close-btn" id="tt-close">✕</button>
            <div class="tooltip-header" id="tt-zip">ZIP Code</div>
            <div class="tooltip-title" id="tt-value">--</div>
            <div class="tooltip-subtitle" id="tt-location">City, State</div>
            <div class="tooltip-subtitle" id="tt-metric-name" style="margin-top:0.5rem; font-size:0.8rem">Metric</div>
        `;
        document.body.appendChild(this.element);

        // Wire close button click event (for mobile)
        this.element.querySelector('#tt-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });

        document.addEventListener('mousemove', (e) => {
            if (this.element.classList.contains('visible') && window.innerWidth > 768) {
                // Offset slightly from cursor to avoid covering it
                this.element.style.left = `${e.pageX + 15}px`;
                this.element.style.top = `${e.pageY + 15}px`;
            }
        });
    }

    show(level: string, id: string, value: number | null, name: string, state: string, metric: MetricType) {
        let headerText = 'ZIP Code';
        let locationText = name;

        if (level === 'zip') {
            headerText = `ZIP Code ${id}`;
            locationText = state ? `${name}, ${state}` : name;
        } else if (level === 'county') {
            headerText = 'County';
            locationText = state ? `${name}, ${state}` : name;
        } else if (level === 'metro') {
            headerText = 'Metro Area';
            locationText = name;
        } else if (level === 'state') {
            headerText = 'State';
            locationText = name;
        } else if (level === 'country') {
            headerText = 'Country';
            locationText = name;
        }

        document.getElementById('tt-zip')!.textContent = headerText;
        
        const isGrowth = metric.includes('Growth') || metric === 'homeValueForecast';
        const isRatioOrShare = metric === 'saleToListRatio' || metric === 'priceCutShare' || 
                               metric === 'priceCutSize' || metric === 'pctSalesAboveList' || 
                               metric === 'pctSalesBelowList';
        const isDays = metric.toLowerCase().includes('daysonmarket');
        const isCount = metric === 'activeInventory' || metric === 'newListings' || metric === 'salesCount';
        const isPrice = metric === 'homeValue' || metric === 'rentValue' || metric === 'medianSalePrice' || metric === 'rentPerSqft';

        let metricName = 'Home Value';
        if (metric === 'homeValue') metricName = 'Home Value';
        if (metric === 'homeYoyGrowth') metricName = 'Home Value Growth (YoY)';
        if (metric === 'homeFiveYearGrowth') metricName = 'Home Value Growth (5-Year)';
        if (metric === 'homeMomGrowth') metricName = 'Home Value Growth (MoM)';
        if (metric === 'homeValueForecast') metricName = 'Home Value Forecast (1-Year)';
        if (metric === 'homeDaysOnMarket') metricName = 'Days on Market';
        if (metric === 'rentValue') metricName = 'Monthly Rent';
        if (metric === 'rentYoyGrowth') metricName = 'Rent Growth (YoY)';
        if (metric === 'rentFiveYearGrowth') metricName = 'Rent Growth (5-Year)';
        if (metric === 'rentMomGrowth') metricName = 'Rent Growth (MoM)';
        if (metric === 'rentDaysOnMarket') metricName = 'Days on Market';
        if (metric === 'activeInventory') metricName = 'Active Inventory';
        if (metric === 'newListings') metricName = 'New Listings';
        if (metric === 'priceCutShare') metricName = 'Share of Listings with Price Cuts';
        if (metric === 'priceCutSize') metricName = 'Median Price Cut Size';
        if (metric === 'salesCount') metricName = 'Sales Count';
        if (metric === 'medianSalePrice') metricName = 'Median Sale Price';
        if (metric === 'saleToListRatio') metricName = 'Sale-to-List Ratio';
        if (metric === 'pctSalesAboveList') metricName = 'Percent of Sales Above List';
        if (metric === 'pctSalesBelowList') metricName = 'Percent of Sales Below List';
        if (metric === 'rentPerSqft') metricName = 'Rent per Square Foot';

        let formattedValue = 'N/A';
        if (value !== null && value !== undefined && !isNaN(value)) {
            if (isGrowth) {
                const pctVal = metric === 'homeValueForecast' ? value : value * 100;
                const sign = pctVal > 0 ? '+' : '';
                formattedValue = `${sign}${pctVal.toFixed(1)}%`;
            } else if (isRatioOrShare) {
                formattedValue = `${(value * 100).toFixed(1)}%`;
            } else if (isDays) {
                formattedValue = `${Math.round(value)} days`;
            } else if (isCount) {
                formattedValue = Math.round(value).toLocaleString('en-US');
            } else if (isPrice) {
                if (metric === 'rentPerSqft') {
                    formattedValue = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(value);
                } else {
                    formattedValue = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0
                    }).format(value);
                }
            }
        }
        
        document.getElementById('tt-value')!.textContent = formattedValue;
        document.getElementById('tt-location')!.textContent = locationText;
        document.getElementById('tt-metric-name')!.textContent = metricName;
        
        if (window.innerWidth <= 768) {
            this.element.style.left = '';
            this.element.style.top = '';
        }
        this.element.classList.add('visible');
    }

    hide() {
        this.element.classList.remove('visible');
    }
}
