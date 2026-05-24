import type { MetricType, GeographicLevel } from './colors';
import { METRIC_DEFINITIONS, isMetricSupportedAtLevel } from './metrics';

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
            label.title = def.description;
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'metric';
            input.value = metricKey;
            if (metricKey === this.activeMetric) {
                input.checked = true;
            }

            const span = document.createElement('span');
            span.textContent = ` ${def.icon} ${def.title}`;

            label.appendChild(input);
            label.appendChild(span);
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
