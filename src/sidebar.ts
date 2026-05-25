import type { MetricType, GeographicLevel } from './colors';
import { METRIC_DEFINITIONS, isMetricSupportedAtLevel } from './metrics';

let sidebarTooltip: HTMLDivElement | null = null;

function getSidebarTooltip(): HTMLDivElement {
    if (!sidebarTooltip) {
        sidebarTooltip = document.createElement('div');
        sidebarTooltip.className = 'sidebar-tooltip';
        document.body.appendChild(sidebarTooltip);
    }
    return sidebarTooltip;
}

export class SidebarManager {
    private activeMetric: MetricType = 'homeValue';
    private onMetricChangeCallback: ((metric: MetricType) => void) | null = null;
    private optionsMap: Map<MetricType, HTMLElement> = new Map();

    constructor() {
        this.renderSidebar();
    }

    private renderSidebar() {
        const containers = {
            home: document.getElementById('home-metrics-container'),
            market: document.getElementById('market-metrics-container'),
            investor: document.getElementById('investor-metrics-container')
        };

        // Clear containers first
        Object.values(containers).forEach(c => {
            if (c) c.innerHTML = '';
        });

        // Loop over METRIC_DEFINITIONS
        for (const key in METRIC_DEFINITIONS) {
            const metricKey = key as MetricType;
            const def = METRIC_DEFINITIONS[metricKey];
            const container = containers[def.category];
            if (!container) continue;

            const label = document.createElement('label');
            label.className = `metric-option${metricKey === this.activeMetric ? ' active' : ''}`;
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'metric';
            input.value = metricKey;
            if (metricKey === this.activeMetric) {
                input.checked = true;
            }

            const iconSpan = document.createElement('span');
            iconSpan.className = 'metric-icon';
            iconSpan.textContent = def.icon;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'metric-title';
            titleSpan.textContent = def.title;

            const infoBtn = document.createElement('span');
            infoBtn.className = 'metric-info-btn';
            infoBtn.textContent = 'ⓘ';
            
            // Prevent clicking on the info icon from selecting the metric
            infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });

            infoBtn.addEventListener('mouseenter', () => {
                const tooltipEl = getSidebarTooltip();
                tooltipEl.textContent = def.description;
                tooltipEl.classList.add('visible');
                
                const rect = infoBtn.getBoundingClientRect();
                tooltipEl.style.left = `${rect.left + window.scrollX + (rect.width / 2)}px`;
                tooltipEl.style.top = `${rect.top + window.scrollY - 6}px`;
            });

            infoBtn.addEventListener('mouseleave', () => {
                const tooltipEl = getSidebarTooltip();
                tooltipEl.classList.remove('visible');
            });

            label.appendChild(input);
            label.appendChild(iconSpan);
            label.appendChild(titleSpan);
            label.appendChild(infoBtn);
            container.appendChild(label);

            this.optionsMap.set(metricKey, label);

            // Click listener
            label.addEventListener('click', (e) => {
                if (label.classList.contains('disabled')) {
                    e.preventDefault();
                    return;
                }

                if (e.target !== input) {
                    input.checked = true;
                }

                this.selectMetric(metricKey);
            });
        }
    }

    selectMetric(metric: MetricType) {
        if (metric === this.activeMetric) return;

        const label = this.optionsMap.get(metric);
        if (label && label.classList.contains('disabled')) return;

        this.activeMetric = metric;

        // Update active class in UI
        this.optionsMap.forEach((el, key) => {
            const inp = el.querySelector('input') as HTMLInputElement;
            if (key === metric) {
                el.classList.add('active');
                inp.checked = true;
            } else {
                el.classList.remove('active');
                inp.checked = false;
            }
        });

        if (this.onMetricChangeCallback) {
            this.onMetricChangeCallback(this.activeMetric);
        }
    }

    updateLevelSelectorConstraints(activeLevel: GeographicLevel) {
        this.optionsMap.forEach((label, metricKey) => {
            const input = label.querySelector('input') as HTMLInputElement;
            const isSupported = isMetricSupportedAtLevel(metricKey, activeLevel);

            if (isSupported) {
                label.classList.remove('disabled');
                input.disabled = false;
            } else {
                label.classList.add('disabled');
                input.disabled = true;
                label.classList.remove('active');
                input.checked = false;
            }
        });

        // Check if currently active metric is now disabled
        const def = METRIC_DEFINITIONS[this.activeMetric];
        if (def && !isMetricSupportedAtLevel(this.activeMetric, activeLevel)) {
            // Find a fallback metric
            let fallback: MetricType = 'homeValue';
            if (def.category === 'investor' && activeLevel !== 'state') {
                fallback = 'rentValue';
            }
            this.selectMetric(fallback);
        }
    }

    onMetricChange(callback: (metric: MetricType) => void) {
        this.onMetricChangeCallback = callback;
    }

    getActiveMetric(): MetricType {
        return this.activeMetric;
    }
}
