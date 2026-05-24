import type { MetricType } from './colors';
import { METRIC_DEFINITIONS, formatMetricValue } from './metrics';

export class LegendManager {
    private titleEl: HTMLElement;
    private minEl: HTMLElement;
    private midEl: HTMLElement;
    private maxEl: HTMLElement;
    private gradientEl: HTMLElement;

    constructor() {
        this.titleEl = document.getElementById('legend-title')!;
        this.minEl = document.getElementById('legend-min')!;
        this.midEl = document.getElementById('legend-mid')!;
        this.maxEl = document.getElementById('legend-max')!;
        this.gradientEl = document.querySelector('.legend-gradient')!;
    }

    update(metric: MetricType, min: number, max: number, midpoint: number) {
        const def = METRIC_DEFINITIONS[metric];
        this.titleEl.textContent = def ? def.title : 'Metric';

        const format = (val: number) => formatMetricValue(val, metric, true);

        this.minEl.textContent = format(min);
        this.midEl.textContent = format(midpoint);
        this.maxEl.textContent = format(max);

        const isSequential = def ? def.scaleType === 'sequential' : false;
        if (isSequential) {
            this.gradientEl.classList.add('sequential');
        } else {
            this.gradientEl.classList.remove('sequential');
        }
    }
}
