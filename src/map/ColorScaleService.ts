import { getColor } from '../colors';
import type { MetricType } from '../colors';
import { METRIC_DEFINITIONS, getMetricMidpoint } from '../metrics';
import type { ScaleBounds } from './types';

export class ColorScaleService {
    private colorCache = new Map<string, string>();
    private min = 0;
    private max = 0;
    private mid = 0;

    calculateBounds(
        metric: MetricType,
        values: Record<string, number | null | undefined>,
        averages?: { homeValue: number; rentValue: number } | null
    ): ScaleBounds {
        let min = Infinity;
        let max = -Infinity;

        const vals: number[] = [];
        for (const key in values) {
            const val = values[key];
            if (val !== null && val !== undefined && !isNaN(val)) {
                vals.push(val);
            }
        }

        if (vals.length > 0) {
            vals.sort((a, b) => a - b);
            let p5 = vals[Math.floor(vals.length * 0.05)];
            let p95 = vals[Math.floor(vals.length * 0.95)];

            if (p5 === p95) {
                p5 = p5 * 0.8;
                p95 = p95 * 1.2;
            }

            const def = METRIC_DEFINITIONS[metric];
            const isAbsolute = def ? (def.format === 'currency' || def.format === 'currency-cents') : false;
            const isSequential = def ? def.scaleType === 'sequential' : false;

            if (isAbsolute) {
                min = p5;
                max = p95;
                if (metric === 'rentValue' || metric === 'rentPerSqft') {
                    min = 0;
                }
            } else if (isSequential) {
                min = 0;
                max = p95;
            } else {
                let center = 0.0;
                if (metric === 'saleToListRatio') {
                    center = 1.0;
                } else if (metric === 'homeValueForecast' || metric.endsWith('Growth')) {
                    center = 0.0;
                } else {
                    center = vals.reduce((sum, v) => sum + v, 0) / vals.length;
                }

                const maxDiff = Math.max(Math.abs(p5 - center), Math.abs(p95 - center));
                min = center - maxDiff;
                max = center + maxDiff;
            }
        } else {
            min = 0;
            max = 1;
        }

        this.min = min;
        this.max = max;

        let mid = 0;
        if (averages) {
            mid = getMetricMidpoint(metric, averages.homeValue, averages.rentValue, vals);
        }
        this.mid = mid;

        return { min, max, mid };
    }

    rebuildColorCache(
        metric: MetricType,
        values: Record<string, number | null | undefined>
    ): void {
        this.colorCache.clear();
        for (const key in values) {
            const val = values[key] ?? null;
            this.colorCache.set(key, getColor(val, this.min, this.max, metric, this.mid));
        }
    }

    getColor(key: string): string {
        return this.colorCache.get(key) || 'rgba(0,0,0,0)';
    }

    getBounds(): ScaleBounds {
        return { min: this.min, max: this.max, mid: this.mid };
    }

    clearCache(): void {
        this.colorCache.clear();
    }
}
