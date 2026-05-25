import { describe, it, expect } from 'vitest';
import { ColorScaleService } from './ColorScaleService';

describe('ColorScaleService', () => {
    it('should calculate correct bounds for currency (absolute) metrics', () => {
        const service = new ColorScaleService();
        // Mock a dataset of values
        const values: Record<string, number> = {
            'r1': 100000,
            'r2': 200000,
            'r3': 300000,
            'r4': 400000,
            'r5': 500000,
            'r6': 600000,
            'r7': 700000,
            'r8': 800000,
            'r9': 900000,
            'r10': 1000000
        };

        const averages = { homeValue: 500000, rentValue: 20000 };
        const bounds = service.calculateBounds('homeValue', values, averages);

        // 5th percentile is index 0: 100000, 95th is index 9: 1000000
        expect(bounds.min).toBe(100000);
        expect(bounds.max).toBe(1000000);
        // homeValue midpoint is national average
        expect(bounds.mid).toBe(500000);
    });

    it('should calculate correct bounds for growth metrics', () => {
        const service = new ColorScaleService();
        const values: Record<string, number> = {
            'r1': -0.10,
            'r2': -0.05,
            'r3': 0,
            'r4': 0.05,
            'r5': 0.10
        };

        const bounds = service.calculateBounds('homeYoyGrowth', values, null);

        // Growth midpoint should be zero
        expect(bounds.mid).toBe(0.0);
        // min/max should be symmetric around 0 because of maxDiff
        // p5: -0.10, p95: 0.10, center: 0
        // maxDiff: max(abs(-0.1), abs(0.1)) = 0.1
        // min: 0 - 0.1 = -0.1, max: 0 + 0.1 = 0.1
        expect(bounds.min).toBeCloseTo(-0.1);
        expect(bounds.max).toBeCloseTo(0.1);
    });

    it('should fall back to safe defaults when dataset is empty', () => {
        const service = new ColorScaleService();
        const bounds = service.calculateBounds('homeValue', {}, null);
        expect(bounds.min).toBe(0);
        expect(bounds.max).toBe(1);
        expect(bounds.mid).toBe(0);
    });

    it('should build and retrieve cached colors correctly', () => {
        const service = new ColorScaleService();
        const values: Record<string, number> = {
            'r1': 100,
            'r2': 200,
            'r3': 300
        };

        service.calculateBounds('activeInventory', values, null); // sequential
        service.rebuildColorCache('activeInventory', values);

        const color1 = service.getColor('r1');
        const color3 = service.getColor('r3');

        expect(color1).toContain('rgb');
        expect(color3).toContain('rgb');
        // Since activeInventory is sequential (White to Red),
        // higher value (300) should be closer to red (more red bias)
        // lower value (100) should be closer to neutral/white.
        // Let's verify they are different colors and getColor doesn't return transparent
        expect(color1).not.toBe('rgba(0,0,0,0)');
        expect(color3).not.toBe('rgba(0,0,0,0)');
        expect(color1).not.toBe(color3);
    });
});
