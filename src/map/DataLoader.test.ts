import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataLoader } from './DataLoader';

describe('DataLoader', () => {
    let mockFetch: any;

    beforeEach(() => {
        mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should fetch and return the manifest', async () => {
        const mockManifest = {
            supportedStates: ['TX', 'WA'],
            metricsVersions: { 'TX': '20260525' },
            geodataVersions: { 'TX': '20260525' }
        };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockManifest
        });

        const loader = new DataLoader('/');
        const manifest = await loader.fetchManifest();

        expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/^\/data\/manifest\.json\?t=\d+$/));
        expect(manifest).toEqual(mockManifest);
        expect(loader.getManifest()).toEqual(mockManifest);
    });

    it('should cache geodata and only fetch once', async () => {
        const mockManifest = {
            supportedStates: ['TX'],
            metricsVersions: { 'TX': '20260525' },
            geodataVersions: { 'TX': '20260525' }
        };
        const mockGeodata = { type: 'FeatureCollection', features: [] };

        // Mock manifest fetch then geodata fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockManifest
        });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockGeodata
        });

        const loader = new DataLoader('/');
        await loader.fetchManifest();

        // First load
        const data1 = await loader.loadGeodata('TX', 'zip');
        expect(data1).toEqual(mockGeodata);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Second load (should be cached)
        const data2 = await loader.loadGeodata('TX', 'zip');
        expect(data2).toEqual(mockGeodata);
        expect(mockFetch).toHaveBeenCalledTimes(2); // Still 2!
    });

    it('should cache region names and only fetch once', async () => {
        const mockManifest = {
            supportedStates: ['TX'],
            metricsVersions: { 'TX': '20260525' },
            geodataVersions: { 'TX': '20260525' }
        };
        const mockRegions = { '75001': { name: 'Dallas', state: 'TX' } };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockManifest
        });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockRegions
        });

        const loader = new DataLoader('/');
        await loader.fetchManifest();

        const regions1 = await loader.loadRegions('TX', 'zip');
        expect(regions1).toEqual(mockRegions);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        const regions2 = await loader.loadRegions('TX', 'zip');
        expect(regions2).toEqual(mockRegions);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
