import type { MetricType, GeographicLevel } from './colors';
import { METRIC_DEFINITIONS, formatMetricValue, isMetricSupportedAtLevel } from './metrics';

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
        
        const def = METRIC_DEFINITIONS[metric];
        const metricName = def ? def.title : 'Metric';
        
        let formattedValue = 'N/A';
        if (isMetricSupportedAtLevel(metric, level as GeographicLevel)) {
            formattedValue = formatMetricValue(value, metric, false);
        } else {
            formattedValue = 'N/A (Not supported at this level)';
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
