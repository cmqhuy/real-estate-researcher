import { describe, it, expect } from 'vitest';
import { getColor } from './colors';

describe('getColor', () => {
    it('should return transparent for null values', () => {
        expect(getColor(null, 0, 100, 'homeValue', 50)).toBe('rgba(0,0,0,0)');
    });

    it('should return transparent for undefined values', () => {
        expect(getColor(undefined as any, 0, 100, 'homeValue', 50)).toBe('rgba(0,0,0,0)');
    });

    it('should handle absolute metrics (homeValue, rentValue)', () => {
        const min = 100000;
        const max = 500000;
        const mid = 300000;

        // Below average should have blue bias
        const lowColor = getColor(200000, min, max, 'homeValue', mid);
        expect(lowColor).toContain('rgb');
        // Extract RGB values
        const [r, , b] = lowColor.match(/\d+/g)!.map(Number);
        expect(b).toBeGreaterThan(r); // Blue bias

        // Above average should have red bias
        const highColor = getColor(400000, min, max, 'homeValue', mid);
        expect(highColor).toContain('rgb');
        const [r2, , b2] = highColor.match(/\d+/g)!.map(Number);
        expect(r2).toBeGreaterThan(b2); // Red bias
    });

    it('should handle growth metrics (homeYoyGrowth)', () => {
        const min = -0.1; // -10%
        const max = 0.1;  // +10%

        // Negative growth should be blue bias
        const negColor = getColor(-0.05, min, max, 'homeYoyGrowth', 0);
        const [r, , b] = negColor.match(/\d+/g)!.map(Number);
        expect(b).toBeGreaterThan(r);

        // Positive growth should be red bias
        const posColor = getColor(0.05, min, max, 'homeYoyGrowth', 0);
        const [r2, , b2] = posColor.match(/\d+/g)!.map(Number);
        expect(r2).toBeGreaterThan(b2);
    });

    it('should handle Days on Market metrics', () => {
        // 0 days = white, higher = red
        const min = 0;
        const max = 60;

        const lowDOM = getColor(5, min, max, 'homeDaysOnMarket', 30);
        const [r1, g1] = lowDOM.match(/\d+/g)!.map(Number);
        // Should be close to white (247, 247, 247)
        expect(r1).toBeCloseTo(247, -2);
        expect(g1).toBeCloseTo(247, -2);

        const highDOM = getColor(55, min, max, 'homeDaysOnMarket', 30);
        const [r2, , b2] = highDOM.match(/\d+/g)!.map(Number);
        // Should be red bias
        expect(r2).toBeGreaterThan(b2);
    });

    it('should handle new metrics classification correctly', () => {
        // 1. medianSalePrice is absolute (diverging)
        const lowSale = getColor(200000, 100000, 500000, 'medianSalePrice', 300000);
        const [r1, , b1] = lowSale.match(/\d+/g)!.map(Number);
        expect(b1).toBeGreaterThan(r1); // Blue bias for below midpoint

        // 2. newListings is sequential
        const highListings = getColor(90, 0, 100, 'newListings', 50);
        const [r2, , b2] = highListings.match(/\d+/g)!.map(Number);
        expect(r2).toBeGreaterThan(b2); // Red bias for high count

        // 3. saleToListRatio is diverging around 1.0
        const lowRatio = getColor(0.95, 0.90, 1.10, 'saleToListRatio', 1.0);
        const [r3, , b3] = lowRatio.match(/\d+/g)!.map(Number);
        expect(b3).toBeGreaterThan(r3); // Blue bias for discount (< 1.0)

        const highRatio = getColor(1.05, 0.90, 1.10, 'saleToListRatio', 1.0);
        const [r4, , b4] = highRatio.match(/\d+/g)!.map(Number);
        expect(r4).toBeGreaterThan(b4); // Red bias for premium (> 1.0)
    });
});
