import { describe, it, expect } from 'vitest';
import { InteractionManager, formatVersionDate } from './InteractionManager';

describe('InteractionManager', () => {
    describe('formatVersionDate', () => {
        it('should format YYYYMMDD date strings correctly', () => {
            expect(formatVersionDate('20260525')).toBe('May 25, 2026');
            expect(formatVersionDate('20241201')).toBe('Dec 1, 2024');
        });

        it('should return original string if format is invalid', () => {
            expect(formatVersionDate('invalid')).toBe('invalid');
            expect(formatVersionDate('2026-05')).toBe('2026-05');
        });
    });

    describe('generatePopupContent', () => {
        it('should generate valid popup HTML container with selections', () => {
            const mockCallbacks = {
                onMetricChange: () => {},
                onRegionSelect: () => {},
                getFeatureKey: () => '75001',
                getRegionNameAndState: () => ({ name: 'Dallas', state: 'TX' }),
                getMetricValue: () => 350000,
                getUpdateDate: () => 'Updated: May 25, 2026',
                resetLayerStyle: () => {},
                getActiveLevel: () => 'zip' as const,
                getActiveMetric: () => 'homeValue' as const
            };

            // Instantiate with mocked map and tooltip (since we only test generatePopupContent)
            const manager = new InteractionManager({} as any, {} as any, mockCallbacks);

            const container = manager.generatePopupContent('75001', 'zip', 'homeValue', {});

            expect(container.className).toBe('map-popup-card');
            
            const header = container.querySelector('.map-popup-header');
            expect(header?.textContent).toBe('75001 (Dallas, TX)');

            const value = container.querySelector('.map-popup-metric-value');
            // Typical home value formatted as currency
            expect(value?.textContent).toBe('$350,000');

            const select = container.querySelector('#popup-metric-select') as HTMLSelectElement;
            expect(select).not.toBeNull();
            expect(select.value).toBe('homeValue');

            // Verify categories exist
            const homeGroup = select.querySelector('optgroup[label="Home Metrics"]');
            expect(homeGroup).not.toBeNull();
        });
    });
});
