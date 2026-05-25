import type { GeographicLevel } from '../colors';
import type { MetricType } from '../colors';
import { isMetricSupportedAtLevel } from '../metrics';
import type { ManifestData } from './types';

export class DataLoader {
    private manifest: ManifestData | null = null;
    private geodataCache = new Map<string, any>();
    private regionsCache = new Map<string, Record<string, { name: string; state: string }>>();
    private metricsCache = new Map<string, Record<string, number>>();

    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async fetchManifest(): Promise<ManifestData> {
        const res = await fetch(`${this.baseUrl}data/manifest.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to load manifest.json');
        this.manifest = await res.json();
        return this.manifest!;
    }

    getManifest(): ManifestData | null {
        return this.manifest;
    }

    async loadGeodata(stateCode: string, level: GeographicLevel): Promise<any> {
        if (!this.manifest) throw new Error('Manifest not loaded');
        const cacheKey = `${stateCode}_${level}`;
        if (this.geodataCache.has(cacheKey)) {
            return this.geodataCache.get(cacheKey);
        }

        const geodataVersion = this.manifest.geodataVersions[stateCode];
        if (!geodataVersion) throw new Error(`Missing geodata version for state ${stateCode}`);
        const filename = `${stateCode.toLowerCase()}_${level}_geodata_${geodataVersion}.json`;

        const res = await fetch(`${this.baseUrl}data/geodata/${filename}`);
        if (!res.ok) throw new Error(`Failed to load ${level} geodata`);
        const data = await res.json();
        this.geodataCache.set(cacheKey, data);
        return data;
    }

    getGeodata(stateCode: string, level: GeographicLevel): any | undefined {
        return this.geodataCache.get(`${stateCode}_${level}`);
    }

    setGeodata(stateCode: string, level: GeographicLevel, data: any): void {
        this.geodataCache.set(`${stateCode}_${level}`, data);
    }

    async loadRegions(stateCode: string, level: GeographicLevel): Promise<Record<string, { name: string; state: string }>> {
        if (!this.manifest) throw new Error('Manifest not loaded');
        const cacheKey = `${stateCode}_${level}`;
        if (this.regionsCache.has(cacheKey)) {
            return this.regionsCache.get(cacheKey)!;
        }

        const version = this.manifest.metricsVersions[stateCode];
        if (!version) throw new Error(`Missing metrics version for state ${stateCode}`);
        const filename = `${stateCode.toLowerCase()}_${level}_names_${version}.json`;

        const res = await fetch(`${this.baseUrl}data/regions/${filename}`);
        if (!res.ok) throw new Error(`Failed to load regions names for ${cacheKey}`);
        const data = await res.json();
        this.regionsCache.set(cacheKey, data);
        return data;
    }

    getRegions(stateCode: string, level: GeographicLevel): Record<string, { name: string; state: string }> | undefined {
        return this.regionsCache.get(`${stateCode}_${level}`);
    }

    async loadMetrics(stateCode: string, level: GeographicLevel, metric: MetricType): Promise<Record<string, number>> {
        if (!this.manifest) throw new Error('Manifest not loaded');
        const cacheKey = `${stateCode}_${level}_${metric}`;
        if (this.metricsCache.has(cacheKey)) {
            return this.metricsCache.get(cacheKey)!;
        }

        const isSupported = isMetricSupportedAtLevel(metric, level);
        if (!isSupported) {
            return {};
        }

        const version = this.manifest.metricsVersions[stateCode];
        if (!version) throw new Error(`Missing metrics version for state ${stateCode}`);
        const filename = `${stateCode.toLowerCase()}_${level}_${metric}_${version}.json`;

        const res = await fetch(`${this.baseUrl}data/metrics/${filename}`);
        if (!res.ok) throw new Error(`Failed to load metric ${metric} at ${level} for ${stateCode}`);
        const data = await res.json();
        this.metricsCache.set(cacheKey, data);
        return data;
    }

    getMetrics(stateCode: string, level: GeographicLevel, metric: MetricType): Record<string, number> | undefined {
        return this.metricsCache.get(`${stateCode}_${level}_${metric}`);
    }

    async ensureDataLoaded(stateCode: string, level: GeographicLevel, metric: MetricType): Promise<void> {
        await Promise.all([
            this.loadRegions(stateCode, level),
            this.loadMetrics(stateCode, level, metric)
        ]);
    }

    async checkAndRefreshOutdatedData(stateCode: string): Promise<boolean> {
        if (!this.manifest) return false;

        const now = new Date();
        const metricsVer = this.manifest.metricsVersions[stateCode];
        const geodataVer = this.manifest.geodataVersions[stateCode];

        let outdated = false;

        // Check metrics (7 days)
        if (metricsVer && metricsVer.length >= 8) {
            const year = parseInt(metricsVer.substring(0, 4), 10);
            const month = parseInt(metricsVer.substring(4, 6), 10) - 1;
            const day = parseInt(metricsVer.substring(6, 8), 10);
            const dataDate = new Date(year, month, day);
            const diffTime = now.getTime() - dataDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 7) outdated = true;
        }

        // Check geodata (30 days)
        if (geodataVer && geodataVer.length >= 8) {
            const year = parseInt(geodataVer.substring(0, 4), 10);
            const month = parseInt(geodataVer.substring(4, 6), 10) - 1;
            const day = parseInt(geodataVer.substring(6, 8), 10);
            const dataDate = new Date(year, month, day);
            const diffTime = now.getTime() - dataDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 30) outdated = true;
        }

        if (outdated && typeof window !== 'undefined') {
            if (typeof document !== 'undefined') {
                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.innerHTML = `
                        <div class="spinner"></div>
                        <div>Downloading latest data... this may take a minute</div>
                    `;
                }
            }
            const refreshRes = await fetch(`${this.baseUrl}api/refresh-data`);
            if (refreshRes.ok) {
                window.location.reload();
                return true;
            }
        }
        return false;
    }
}
