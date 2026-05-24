export class TooltipManager {
    private element: HTMLDivElement;
    
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'custom-tooltip';
        this.element.innerHTML = `
            <div class="tooltip-header" id="tt-zip">ZIP Code</div>
            <div class="tooltip-title" id="tt-value">--</div>
            <div class="tooltip-subtitle" id="tt-location">City, State</div>
            <div class="tooltip-subtitle" id="tt-metric-name" style="margin-top:0.5rem; font-size:0.8rem">Metric</div>
        `;
        document.body.appendChild(this.element);

        document.addEventListener('mousemove', (e) => {
            if (this.element.classList.contains('visible')) {
                // Offset slightly from cursor to avoid covering it
                this.element.style.left = `${e.pageX + 15}px`;
                this.element.style.top = `${e.pageY + 15}px`;
            }
        });
    }

    show(level: string, id: string, value: number | null, name: string, state: string, metricName: string, isPercent: boolean) {
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
        
        let formattedValue = 'N/A';
        if (value !== null && value !== undefined) {
            if (metricName.includes('Days on Market')) {
                formattedValue = `${Math.round(value)} days`;
            } else if (isPercent) {
                const sign = value > 0 ? '+' : '';
                formattedValue = `${sign}${(value * 100).toFixed(1)}%`;
            } else {
                formattedValue = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0
                }).format(value);
            }
        }
        
        document.getElementById('tt-value')!.textContent = formattedValue;
        document.getElementById('tt-location')!.textContent = locationText;
        document.getElementById('tt-metric-name')!.textContent = metricName;
        
        this.element.classList.add('visible');
    }

    hide() {
        this.element.classList.remove('visible');
    }
}
