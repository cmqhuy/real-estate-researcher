import * as L from 'leaflet';
import type { MetricType, GeographicLevel } from './colors';
import { TooltipManager } from './tooltip';
import { isMetricSupportedAtLevel } from './metrics';
import type { UrlState } from './url';

// Modular Imports
import { DataLoader } from './map/DataLoader';
import { ColorScaleService } from './map/ColorScaleService';
import { MapCore } from './map/MapCore';
import { LayerManager } from './map/LayerManager';
import { InteractionManager, formatVersionDate } from './map/InteractionManager';

const BASE_URL = import.meta.env.BASE_URL;

export type { RegionMetrics, ManifestData } from './map/types';

export class MapManager {
    // Sub-Modules
    private mapCore: MapCore;
    private dataLoader: DataLoader;
    private colorScaleService: ColorScaleService;
    private layerManager: LayerManager;
    private interactionManager: InteractionManager;

    // Active States
    private activeMetric: MetricType = 'homeValue';
    private activeLevel: GeographicLevel = 'zip';
    private activeState = 'TX';
    private loadedStates: Set<string> = new Set();

    // Map Movement and Interaction Status
    private isMapMoving = false;
    private loadingCount = 0;
    private pendingSelectedRegionKey: string | null = null;

    // Theme state
    private currentTheme: string;

    // Callbacks from main.ts
    private onScaleUpdateCallback: ((min: number, max: number, mid: number) => void) | null = null;
    private onMetricChangeCallback: ((metric: MetricType) => void) | null = null;
    private onRegionSelectCallback: ((key: string | null) => void) | null = null;

    private stateNameToCode: Record<string, string> = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
        'District of Columbia': 'DC'
    };

    constructor(tooltip: TooltipManager, theme = 'dark', initialState: UrlState = {}) {
        this.currentTheme = theme;

        if (initialState.metric) this.activeMetric = initialState.metric;
        if (initialState.level) this.activeLevel = initialState.level;
        if (initialState.state) this.activeState = initialState.state;
        if (initialState.selected) this.pendingSelectedRegionKey = initialState.selected;

        // 1. Initialize Sub-modules
        this.dataLoader = new DataLoader(BASE_URL);
        this.colorScaleService = new ColorScaleService();
        this.mapCore = new MapCore('map-container', this.currentTheme);
        this.layerManager = new LayerManager(this.mapCore.getLeafletMap(), (feature) => this.getFeatureKey(feature, this.activeLevel));

        const interactionCallbacks = {
            onMetricChange: (metric: MetricType) => {
                if (this.onMetricChangeCallback) {
                    this.onMetricChangeCallback(metric);
                }
            },
            onRegionSelect: (key: string | null) => {
                if (this.onRegionSelectCallback) {
                    this.onRegionSelectCallback(key);
                }
            },
            getFeatureKey: (feature: any, level: GeographicLevel) => this.getFeatureKey(feature, level),
            getRegionNameAndState: (key: string, feature: any) => {
                const regionsData = this.dataLoader.getRegions(this.activeState, this.activeLevel);
                if (regionsData && regionsData[key]) {
                    return {
                        name: regionsData[key].name,
                        state: regionsData[key].state || ''
                    };
                }
                return {
                    name: feature.properties?.NAME || feature.properties?.name || key,
                    state: ''
                };
            },
            getMetricValue: (key: string) => {
                return this.getMetricValueDirect(key);
            },
            getUpdateDate: () => {
                const manifest = this.dataLoader.getManifest();
                if (manifest) {
                    const version = manifest.metricsVersions[this.activeState];
                    if (version) {
                        return `Updated: ${formatVersionDate(version)}`;
                    }
                }
                return '';
            },
            resetLayerStyle: (layer: L.Layer) => {
                this.layerManager.getGeoJsonLayer().resetStyle(layer);
            },
            getActiveLevel: () => this.activeLevel,
            getActiveMetric: () => this.activeMetric
        };

        this.interactionManager = new InteractionManager(this.mapCore.getLeafletMap(), tooltip, interactionCallbacks);

        // 2. Setup Core Events
        this.mapCore.onPopupClose(() => {
            this.interactionManager.clearSelection();
            if (this.onRegionSelectCallback) {
                this.onRegionSelectCallback(null);
            }
        });

        this.mapCore.onMoveStart(() => {
            this.isMapMoving = true;
            tooltip.hide();
        });

        this.mapCore.onMoveEnd(() => {
            this.isMapMoving = false;
        });

        this.mapCore.onZoomEnd(() => {
            this.layerManager.updateStyles((feature) => this.getFeatureStyle(feature));
        });

        // 3. Load Data Manifest
        this.initData();
    }

    onScaleUpdate(callback: (min: number, max: number, mid: number) => void) {
        this.onScaleUpdateCallback = callback;
    }

    setTheme(theme: string) {
        if (this.currentTheme === theme) return;
        this.currentTheme = theme;

        this.mapCore.setTheme(theme);
        this.applyColorCache();
    }

    async setMetric(metric: MetricType) {
        if (this.activeMetric === metric) return;
        this.activeMetric = metric;

        this.setLoading(true);
        try {
            await this.dataLoader.ensureDataLoaded(this.activeState, this.activeLevel, metric);
            this.updateScaleBounds();
            this.applyColorCache();
            this.updateActivePopup();
        } catch (error) {
            console.error(`Error switching to metric ${metric}:`, error);
        } finally {
            this.setLoading(false);
        }
    }

    async setLevel(level: GeographicLevel) {
        if (this.activeLevel === level) return;
        this.activeLevel = level;

        this.layerManager.clear();
        this.setLoading(true);
        try {
            const geodataPromise = this.dataLoader.loadGeodata(this.activeState, level);
            const dataPromise = this.dataLoader.ensureDataLoaded(this.activeState, level, this.activeMetric);

            await Promise.all([geodataPromise, dataPromise]);

            const geodata = this.dataLoader.getGeodata(this.activeState, level);
            if (geodata) {
                this.layerManager.setData(
                    geodata,
                    (feature) => this.getFeatureStyle(feature),
                    (feature, layer) => this.interactionManager.setupFeatureEvents(
                        layer,
                        feature,
                        () => this.isMapMoving
                    )
                );
            }

            this.updateScaleBounds();
            this.applyColorCache();
            this.handlePendingSelection();
        } catch (error) {
            console.error(`Error switching to level ${level}:`, error);
        } finally {
            this.setLoading(false);
        }
    }

    async setStateCode(stateCode: string) {
        if (this.activeState === stateCode) return;
        this.activeState = stateCode;

        this.layerManager.clear();
        this.setLoading(true);
        try {
            const lat = stateCode === 'WA' ? 47.4009 : 31.9686;
            const lon = stateCode === 'WA' ? -121.4905 : -99.9018;
            const zoom = stateCode === 'WA' ? 7 : 6;
            const flight = this.mapCore.flyTo(lat, lon, zoom);

            const geodataPromise = this.dataLoader.loadGeodata(stateCode, this.activeLevel);
            const dataPromise = this.dataLoader.ensureDataLoaded(stateCode, this.activeLevel, this.activeMetric);

            await Promise.all([geodataPromise, dataPromise]);
            await flight;

            const geodata = this.dataLoader.getGeodata(stateCode, this.activeLevel);
            if (geodata) {
                this.layerManager.setData(
                    geodata,
                    (feature) => this.getFeatureStyle(feature),
                    (feature, layer) => this.interactionManager.setupFeatureEvents(
                        layer,
                        feature,
                        () => this.isMapMoving
                    )
                );
            }

            this.updateScaleBounds();
            this.applyColorCache();
            this.handlePendingSelection();
        } catch (error) {
            console.error(`Error switching to state ${stateCode}:`, error);
        } finally {
            this.setLoading(false);
        }
    }

    flyTo(lat: number, lon: number, zoom: number): Promise<void> {
        return this.mapCore.flyTo(lat, lon, zoom);
    }

    private setLoading(isLoading: boolean) {
        if (isLoading) this.loadingCount++;
        else this.loadingCount = Math.max(0, this.loadingCount - 1);

        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (this.loadingCount > 0) overlay.classList.remove('hidden');
            else overlay.classList.add('hidden');
        }
    }

    private async initData() {
        this.setLoading(true);
        try {
            await this.dataLoader.fetchManifest();
            const manifest = this.dataLoader.getManifest();

            const isTest = typeof window !== 'undefined' && (navigator.webdriver || window.location.search.includes('test=true'));
            if (manifest && import.meta.env.DEV && !isTest) {
                const refreshed = await this.dataLoader.checkAndRefreshOutdatedData(manifest.supportedStates[0] || 'TX');
                if (refreshed) return;
            }

            const initialStateCode = this.activeState || 'TX';
            if (manifest?.supportedStates.includes(initialStateCode)) {
                setTimeout(async () => {
                    const lat = initialStateCode === 'WA' ? 47.4009 : 31.9686;
                    const lon = initialStateCode === 'WA' ? -121.4905 : -99.9018;
                    const zoom = initialStateCode === 'WA' ? 7 : 6;
                    const flight = this.mapCore.flyTo(lat, lon, zoom);
                    await this.loadStateData(initialStateCode, flight);
                }, 500);
            }
        } catch (error) {
            console.error('Failed to load manifest.json:', error);
        } finally {
            this.setLoading(false);
        }
    }

    private async loadStateData(stateCode: string, flightPromise?: Promise<void>) {
        if (this.loadedStates.has(stateCode) || !this.dataLoader.getManifest()) return;

        this.setLoading(true);
        try {
            const geodataPromise = this.dataLoader.loadGeodata(stateCode, this.activeLevel);
            const dataPromise = this.dataLoader.ensureDataLoaded(stateCode, this.activeLevel, this.activeMetric);

            await Promise.all([geodataPromise, dataPromise]);

            if (flightPromise) {
                await flightPromise;
            }

            const geodata = this.dataLoader.getGeodata(stateCode, this.activeLevel);
            this.loadedStates.add(stateCode);

            this.updateScaleBounds();

            if (geodata) {
                this.layerManager.setData(
                    geodata,
                    (feature) => this.getFeatureStyle(feature),
                    (feature, layer) => this.interactionManager.setupFeatureEvents(
                        layer,
                        feature,
                        () => this.isMapMoving
                    )
                );

                this.layerManager.fitLayerBounds();
            }
            this.handlePendingSelection();
        } catch (error) {
            console.error(`Error loading data for ${stateCode}:`, error);
        } finally {
            this.setLoading(false);
        }
    }

    private getFeatureKey(feature: any, level: GeographicLevel): string {
        if (level === 'zip') {
            return feature.properties.ZCTA5CE10 || feature.properties.ZCTA5CE20 || '';
        }
        if (level === 'county') {
            const state = feature.properties.STATE || '';
            const county = feature.properties.COUNTY || '';
            return state.trim() + county.trim();
        }
        if (level === 'metro') {
            const name = feature.properties.NAME || '';
            return name.replace(/\s+(Metro|Micro)\s+Area$/i, '').trim();
        }
        if (level === 'state') {
            const name = feature.properties.name || '';
            return this.stateNameToCode[name] || name;
        }
        if (level === 'country') {
            return 'US';
        }
        return '';
    }

    private getMetricValueDirect(key: string): number | null {
        const metricsData = this.dataLoader.getMetrics(this.activeState, this.activeLevel, this.activeMetric);
        return metricsData ? (metricsData[key] ?? null) : null;
    }

    private updateScaleBounds() {
        const metricsData = this.dataLoader.getMetrics(this.activeState, this.activeLevel, this.activeMetric) || {};
        const manifest = this.dataLoader.getManifest();
        const averages = manifest?.averages?.[this.activeState] || null;

        const bounds = this.colorScaleService.calculateBounds(
            this.activeMetric,
            metricsData,
            averages
        );

        if (this.onScaleUpdateCallback) {
            this.onScaleUpdateCallback(bounds.min, bounds.max, bounds.mid);
        }

        this.colorScaleService.rebuildColorCache(this.activeMetric, metricsData);
    }

    private applyColorCache() {
        const borderColor = this.currentTheme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';
        const isSupported = isMetricSupportedAtLevel(this.activeMetric, this.activeLevel);

        requestAnimationFrame(() => {
            this.layerManager.getGeoJsonLayer().eachLayer((layer: any) => {
                if (!layer.feature) return;
                const key = this.getFeatureKey(layer.feature, this.activeLevel);
                const val = isSupported ? this.getMetricValueDirect(key) : null;
                const hasData = val !== null;
                const fillColor = hasData ? this.colorScaleService.getColor(key) : 'rgba(0,0,0,0)';
                layer.setStyle({
                    fillColor,
                    color: borderColor,
                    weight: 0.8,
                    opacity: 0.8,
                    fillOpacity: hasData ? 0.6 : 0
                });
            });
        });
    }

    private getFeatureStyle(feature: any): L.PathOptions {
        const key = this.getFeatureKey(feature, this.activeLevel);
        const val = this.getMetricValueDirect(key);
        const hasData = val !== null;
        const fillColor = hasData ? this.colorScaleService.getColor(key) : 'rgba(0,0,0,0)';
        const borderColor = this.currentTheme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';

        const zoom = this.mapCore.getLeafletMap() ? this.mapCore.getLeafletMap().getZoom() : 6;
        let weight = 0.8;
        let stroke = true;

        if (this.activeLevel === 'zip') {
            if (zoom <= 7) {
                stroke = false;
            } else if (zoom <= 9) {
                weight = 0.3;
            } else {
                weight = 0.6;
            }
        } else if (this.activeLevel === 'county' || this.activeLevel === 'metro') {
            if (zoom <= 5) {
                weight = 0.3;
            } else {
                weight = 0.7;
            }
        }

        return {
            fillColor,
            stroke,
            weight,
            opacity: 0.8,
            color: borderColor,
            fillOpacity: hasData ? 0.6 : 0
        };
    }

    onMapMetricChange(callback: (metric: MetricType) => void) {
        this.onMetricChangeCallback = callback;
    }

    onRegionSelect(callback: (key: string | null) => void) {
        this.onRegionSelectCallback = callback;
    }

    openRegionPopup(key: string, latlng?: L.LatLng) {
        const layer = this.layerManager.getLayer(key);
        if (!layer) return;

        this.interactionManager.openPopup(key, layer, latlng, this.activeLevel, this.activeMetric);
    }

    updateActivePopup() {
        const key = this.interactionManager.getActiveSelectedKey();
        if (key) {
            const layer = this.layerManager.getLayer(key);
            const feature = layer ? (layer as any).feature : undefined;
            this.interactionManager.updatePopupContent(this.activeLevel, this.activeMetric, feature);
        }
    }

    private handlePendingSelection() {
        if (this.pendingSelectedRegionKey) {
            const key = this.pendingSelectedRegionKey;
            this.pendingSelectedRegionKey = null;

            setTimeout(() => {
                const layer = this.layerManager.getLayer(key);
                if (layer) {
                    this.openRegionPopup(key);

                    const bounds = (layer as any).getBounds();
                    if (bounds.isValid()) {
                        this.mapCore.getLeafletMap().fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
                    }
                }
            }, 100);
        }
    }
}
