import type { MetricType } from './colors';
import { METRIC_DEFINITIONS, formatMetricValue } from './metrics';

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
        const def = METRIC_DEFINITIONS[metric];
        this.titleEl.textContent = def ? def.title : 'Metric';

        const format = (val: number) => formatMetricValue(val, metric, true);

        this.minEl.textContent = format(min);
        this.midEl.textContent = format(midpoint);
        this.maxEl.textContent = format(max);
    }
}
