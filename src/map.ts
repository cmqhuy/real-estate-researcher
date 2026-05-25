import * as L from 'leaflet';
import { getColor } from './colors';
import type { MetricType, GeographicLevel } from './colors';
import { TooltipManager } from './tooltip';
import { METRIC_DEFINITIONS, getMetricMidpoint, isMetricSupportedAtLevel, formatMetricValue } from './metrics';
import type { UrlState } from './url';

const BASE_URL = import.meta.env.BASE_URL;

export interface RegionMetrics {
    homeValue?: number;
    homeYoyGrowth?: number;
    homeFiveYearGrowth?: number;
    homeMomGrowth?: number;
    rentValue?: number;
    rentYoyGrowth?: number;
    rentFiveYearGrowth?: number;
    rentMomGrowth?: number;
    homeDaysOnMarket?: number;
    homeValueForecast?: number;
    activeInventory?: number;
    newListings?: number;
    priceCutShare?: number;
    priceCutSize?: number;
    salesCount?: number;
    medianSalePrice?: number;
    saleToListRatio?: number;
    pctSalesAboveList?: number;
    pctSalesBelowList?: number;
    rentPerSqft?: number;
    name: string;
    state: string;
}

export interface ManifestData {
    supportedStates: string[];
    metricsVersions: Record<string, string>;
    geodataVersions: Record<string, string>;
    averages?: Record<string, { homeValue: number; rentValue: number }>;
}

export class MapManager {
    private map: L.Map;
    private canvasRenderer: L.Renderer;
    private geoJsonLayer: L.GeoJSON | null = null;
    private loadedStates: Set<string> = new Set();
    private activeMetric: MetricType = 'homeValue';
    private activeLevel: GeographicLevel = 'zip';
    private tooltip: TooltipManager;
    private loadingCount = 0;
    private manifest: ManifestData | null = null;

    // Cache of loaded level geodata: state_level -> GeoJSON object
    private geodataCache: Map<string, any> = new Map();
    private activeState = 'TX';

    // Split Metrics Caches
    private regionsCache: Map<string, Record<string, { name: string; state: string }>> = new Map();
    private metricsCache: Map<string, Record<string, number>> = new Map();

    // Pre-computed color cache: regionKey -> fillColor string
    private colorCache: Map<string, string> = new Map();
    
    // Bounds tracking to dynamically update color scale
    private currentMin = 0;
    private currentMax = 0;
    private currentMid = 0;
    
    private onScaleUpdateCallback: ((min: number, max: number, mid: number) => void) | null = null;
    private tileLayer: L.TileLayer;
    private labelLayer: L.TileLayer;
    private currentTheme: string;

    // Interactive Popups & URL State tracking
    private layersMap: Map<string, L.Layer> = new Map();
    private activeSelectedRegionKey: string | null = null;
    private activePopup: L.Popup | null = null;
    private pendingSelectedRegionKey: string | null = null;
        private onMetricChangeCallback: ((metric: MetricType) => void) | null = null;
    private onRegionSelectCallback: ((key: string | null) => void) | null = null;
    private isMapMoving = false;

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

    constructor(tooltip: TooltipManager, theme: string = 'dark', initialState: UrlState = {}) {
        this.tooltip = tooltip;
        this.currentTheme = theme;

        if (initialState.metric) this.activeMetric = initialState.metric;
        if (initialState.level) this.activeLevel = initialState.level;
        if (initialState.state) this.activeState = initialState.state;
        if (initialState.selected) this.pendingSelectedRegionKey = initialState.selected;

        // Explicit canvas renderer with tolerance for better hit detection perf
        this.canvasRenderer = L.canvas({ tolerance: 4 });
        
        // Initialize map centered on US
        this.map = L.map('map-container', {
            zoomControl: false,
            preferCanvas: true,
            renderer: this.canvasRenderer
        }).setView([37.8, -96], 4);

        // Add zoom control to top right
        L.control.zoom({ position: 'topright' }).addTo(this.map);

        // Wire popup close to clear selected URL parameter
        this.map.on('popupclose', () => {
            this.activeSelectedRegionKey = null;
            this.activePopup = null;
            if (this.onRegionSelectCallback) {
                this.onRegionSelectCallback(null);
            }
        });

        // Suspend hover effects during map movements to improve performance
        this.map.on('movestart', () => {
            this.isMapMoving = true;
            this.tooltip.hide();
        });
        
        this.map.on('moveend', () => {
            this.isMapMoving = false;
        });

        // Re-style map on zoomend to dynamically update border strokes
        this.map.on('zoomend', () => {
            if (this.geoJsonLayer) {
                this.geoJsonLayer.setStyle((feature) => this.getFeatureStyle(feature));
            }
        });

        // Create a custom pane for map text labels to overlay on top of choropleth polygons
        const labelPane = this.map.createPane('labels');
        labelPane.style.zIndex = '650'; // overlayPane (polygons) is 400, popups is 700. Labels sit in between
        labelPane.style.pointerEvents = 'none';

        // CartoDB base tiles (without labels)
        const baseUrl = this.currentTheme === 'light' 
            ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
            
        this.tileLayer = L.tileLayer(baseUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            updateWhenIdle: false,
            keepBuffer: 4
        }).addTo(this.map);

        // CartoDB label tiles (overlay)
        const labelUrl = this.currentTheme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';

        this.labelLayer = L.tileLayer(labelUrl, {
            subdomains: 'abcd',
            maxZoom: 19,
            pane: 'labels'
        }).addTo(this.map);
        
        this.geoJsonLayer = L.geoJSON(undefined, {
            style: this.getFeatureStyle.bind(this),
            onEachFeature: this.onEachFeature.bind(this),
            smoothFactor: 1.5
        } as any).addTo(this.map);

        // Load data manifest
        this.initData();
    }

    onScaleUpdate(callback: (min: number, max: number, mid: number) => void) {
        this.onScaleUpdateCallback = callback;
    }

    setTheme(theme: string) {
        if (this.currentTheme === theme) return;
        this.currentTheme = theme;
        
        const baseUrl = theme === 'light' 
            ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

        const labelUrl = theme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';
            
        this.tileLayer.setUrl(baseUrl);
        this.labelLayer.setUrl(labelUrl);
        
        // Only border color changes with theme — no need to rebuild color cache
        this.applyColorCache();
    }

    async setMetric(metric: MetricType) {
        if (this.activeMetric === metric) return;
        this.activeMetric = metric;
        
        this.setLoading(true);
        try {
            await this.ensureDataLoaded(this.activeState, this.activeLevel, metric);
            this.updateScaleBounds();
            this.applyColorCache();
            this.updateActivePopup();
        } catch (error) {
            console.error(`Error switching to metric ${metric}:`, error);
        } finally {
            this.setLoading(false);
        }
    }    async setLevel(level: GeographicLevel) {
        if (this.activeLevel === level) return;
        this.activeLevel = level;

        // Clear existing features and layers map
        this.layersMap.clear();
        if (this.geoJsonLayer) {
            this.geoJsonLayer.clearLayers();
        }

        this.setLoading(true);
        try {
            // Check cache first
            const cacheKey = `${this.activeState}_${level}`;
            let geodata = this.geodataCache.get(cacheKey);
            
            const promises: Promise<any>[] = [];
            if (!geodata && this.manifest) {
                const stateCode = this.activeState;
                const geodataVersion = this.manifest.geodataVersions[stateCode];
                const filename = `${stateCode.toLowerCase()}_${level}_geodata_${geodataVersion}.json`;
                const p = fetch(`${BASE_URL}data/geodata/${filename}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`Failed to load ${level} geodata`);
                        return res.json();
                    })
                    .then(data => {
                        geodata = data;
                        this.geodataCache.set(cacheKey, geodata);
                    });
                promises.push(p);
            }
            
            promises.push(this.ensureDataLoaded(this.activeState, level, this.activeMetric));
            await Promise.all(promises);

            if (geodata && this.geoJsonLayer) {
                this.geoJsonLayer.addData(geodata);
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

        // Clear existing features so map is empty during flight (smooth transition)
        this.layersMap.clear();
        if (this.geoJsonLayer) {
            this.geoJsonLayer.clearLayers();
        }

        this.setLoading(true);
        try {
            // Start flying to the new state immediately
            const flight = this.flyTo(stateCode === 'WA' ? 47.4009 : 31.9686, stateCode === 'WA' ? -121.4905 : -99.9018, stateCode === 'WA' ? 7 : 6);

            // Load geodata for the active level in parallel (use cache if available)
            const cacheKey = `${stateCode}_${this.activeLevel}`;
            let geodata = this.geodataCache.get(cacheKey);
            let geodataPromise: Promise<Response> | null = null;
            if (!geodata && this.manifest) {
                const geodataVersion = this.manifest.geodataVersions[stateCode];
                if (!geodataVersion) throw new Error(`Missing geodata version for state ${stateCode}`);
                const geodataFilename = `${stateCode.toLowerCase()}_${this.activeLevel}_geodata_${geodataVersion}.json`;
                geodataPromise = fetch(`${BASE_URL}data/geodata/${geodataFilename}`);
            }

            // Ensure names/metrics are loaded in parallel
            const dataPromise = this.ensureDataLoaded(stateCode, this.activeLevel, this.activeMetric);

            // Await fetches
            const [geodataRes] = await Promise.all([
                geodataPromise,
                dataPromise
            ]);

            // Wait until flight panning finishes
            await flight;

            if (geodataRes) {
                if (!geodataRes.ok) throw new Error(`Failed to load ${this.activeLevel} geodata for ${stateCode}`);
                geodata = await geodataRes.json();
                this.geodataCache.set(cacheKey, geodata);
            }

            // Add features now that map is stationary
            if (geodata && this.geoJsonLayer) {
                this.geoJsonLayer.addData(geodata);
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
        // Check if map center/zoom is already very close to target to avoid hanging if no move occurs
        const currentCenter = this.map.getCenter();
        const currentZoom = this.map.getZoom();
        const distance = currentCenter.distanceTo([lat, lon]);
        
        if (distance < 100 && currentZoom === zoom) {
            return Promise.resolve();
        }

        const flight = new Promise<void>((resolve) => {
            this.map.once('moveend', () => {
                resolve();
            });
        });
        
        this.map.flyTo([lat, lon], zoom, { duration: 1.5 });
        return flight;
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
            const res = await fetch(`${BASE_URL}data/manifest.json?t=${Date.now()}`);
            this.manifest = await res.json();
            
            // Check if data is outdated (only in development environment, and not in automated tests)
            const isTest = typeof window !== 'undefined' && (navigator.webdriver || window.location.search.includes('test=true'));
            if (this.manifest && import.meta.env.DEV && !isTest) {
                let outdated = false;
                const now = new Date();
                
                const stateToCheck = this.manifest.supportedStates[0] || 'TX';
                const metricsVer = this.manifest.metricsVersions[stateToCheck];
                const geodataVer = this.manifest.geodataVersions[stateToCheck];
                
                // 1. Check Metrics (7 days)
                if (metricsVer && metricsVer.length >= 8) {
                    const year = parseInt(metricsVer.substring(0, 4), 10);
                    const month = parseInt(metricsVer.substring(4, 6), 10) - 1;
                    const day = parseInt(metricsVer.substring(6, 8), 10);
                    const dataDate = new Date(year, month, day);
                    const diffTime = now.getTime() - dataDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays >= 7) outdated = true;
                }
                
                // 2. Check Geodata (30 days)
                if (geodataVer && geodataVer.length >= 8) {
                    const year = parseInt(geodataVer.substring(0, 4), 10);
                    const month = parseInt(geodataVer.substring(4, 6), 10) - 1;
                    const day = parseInt(geodataVer.substring(6, 8), 10);
                    const dataDate = new Date(year, month, day);
                    const diffTime = now.getTime() - dataDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays >= 30) outdated = true;
                }
                
                if (outdated) {
                    const overlay = document.getElementById('loading-overlay');
                    if (overlay) {
                        overlay.innerHTML = `
                            <div class="spinner"></div>
                            <div>Downloading latest data... this may take a minute</div>
                        `;
                    }
                    
                    try {
                        const refreshRes = await fetch(`${BASE_URL}api/refresh-data`);
                        if (refreshRes.ok) {
                            window.location.reload();
                            return;
                        } else {
                            console.error('Failed to refresh data');
                        }
                    } catch (e) {
                        console.error('Error calling refresh API', e);
                    }
                }
            }

            // Load initial state if supported
            const initialStateCode = this.activeState || 'TX';
            if (this.manifest?.supportedStates.includes(initialStateCode)) {
                setTimeout(async () => {
                    const lat = initialStateCode === 'WA' ? 47.4009 : 31.9686;
                    const lon = initialStateCode === 'WA' ? -121.4905 : -99.9018;
                    const zoom = initialStateCode === 'WA' ? 7 : 6;
                    const flight = this.flyTo(lat, lon, zoom);
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
        if (this.loadedStates.has(stateCode) || !this.manifest) return;
        
        this.setLoading(true);
        try {
            const geodataVersion = this.manifest.geodataVersions[stateCode];

            if (!geodataVersion) {
                throw new Error(`Missing versioning info for state ${stateCode} in manifest.`);
            }

            const geodataFilename = `${stateCode.toLowerCase()}_${this.activeLevel}_geodata_${geodataVersion}.json`;

            const [geodataRes] = await Promise.all([
                fetch(`${BASE_URL}data/geodata/${geodataFilename}`),
                this.ensureDataLoaded(stateCode, this.activeLevel, this.activeMetric)
            ]);

            if (!geodataRes.ok) throw new Error(`Failed to load ${this.activeLevel} geodata for ${stateCode}`);

            // Wait for map to stop moving (panning/zooming during initialization flight)
            if (flightPromise) {
                await flightPromise;
            }

            const geodata = await geodataRes.json();

            this.geodataCache.set(`${stateCode}_${this.activeLevel}`, geodata);
            this.loadedStates.add(stateCode);

            this.updateScaleBounds();

            if (this.geoJsonLayer) {
                this.geoJsonLayer.addData(geodata);
                
                // Fit bounds
                const bounds = this.geoJsonLayer.getBounds();
                if (bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [20, 20] });
                }
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

    private async ensureDataLoaded(stateCode: string, level: GeographicLevel, metric: MetricType): Promise<void> {
        if (!this.manifest) return;

        const version = this.manifest.metricsVersions[stateCode];
        if (!version) throw new Error(`Missing metrics version for state ${stateCode}`);

        const regionsKey = `${stateCode}_${level}`;
        const metricsKey = `${stateCode}_${level}_${metric}`;

        const promises: Promise<any>[] = [];

        // 1. Fetch names if not cached
        if (!this.regionsCache.has(regionsKey)) {
            const namesFilename = `${stateCode.toLowerCase()}_${level}_names_${version}.json`;
            const p = fetch(`${BASE_URL}data/regions/${namesFilename}`)
                .then(res => {
                    if (!res.ok) throw new Error(`Failed to load regions names for ${regionsKey}`);
                    return res.json();
                })
                .then(data => {
                    this.regionsCache.set(regionsKey, data);
                });
            promises.push(p);
        }

        // 2. Fetch metric values if not cached
        const isSupported = isMetricSupportedAtLevel(metric, level);
        if (isSupported && !this.metricsCache.has(metricsKey)) {
            const metricFilename = `${stateCode.toLowerCase()}_${level}_${metric}_${version}.json`;
            const p = fetch(`${BASE_URL}data/metrics/${metricFilename}`)
                .then(res => {
                    if (!res.ok) throw new Error(`Failed to load metric ${metric} at ${level} for ${stateCode}`);
                    return res.json();
                })
                .then(data => {
                    this.metricsCache.set(metricsKey, data);
                });
            promises.push(p);
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }

    private updateScaleBounds() {
        const metricsKey = `${this.activeState}_${this.activeLevel}_${this.activeMetric}`;

        const isSupported = isMetricSupportedAtLevel(this.activeMetric, this.activeLevel);
        const levelData = isSupported ? (this.metricsCache.get(metricsKey) || {}) : {};

        let min = Infinity;
        let max = -Infinity;

        const vals: number[] = [];
        if (isSupported) {
            for (const key in levelData) {
                const val = levelData[key];
                if (val !== null && val !== undefined && !isNaN(val)) {
                    vals.push(val);
                }
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

            const def = METRIC_DEFINITIONS[this.activeMetric];
            const isAbsolute = def ? (def.format === 'currency' || def.format === 'currency-cents') : false;
            const isSequential = def ? def.scaleType === 'sequential' : false;
            
            if (isAbsolute) {
                min = p5;
                max = p95;
                if (this.activeMetric === 'rentValue' || this.activeMetric === 'rentPerSqft') {
                    min = 0;
                }
            } else if (isSequential) {
                min = 0;
                max = p95;
            } else {
                let center = 0.0;
                if (this.activeMetric === 'saleToListRatio') {
                    center = 1.0;
                } else if (this.activeMetric === 'homeValueForecast' || this.activeMetric.endsWith('Growth')) {
                    center = 0.0;
                } else {
                    center = vals.reduce((sum, v) => sum + v, 0) / vals.length;
                }
                
                const maxDiff = Math.max(Math.abs(p5 - center), Math.abs(p95 - center));
                min = center - maxDiff;
                max = center + maxDiff;
            }
        } else {
            min = 0; max = 1;
        }

        this.currentMin = min;
        this.currentMax = max;

        let mid = 0;
        if (this.manifest && this.manifest.averages && this.manifest.averages[this.activeState]) {
            const stateAverages = this.manifest.averages[this.activeState];
            mid = getMetricMidpoint(this.activeMetric, stateAverages.homeValue, stateAverages.rentValue, vals);
        }
        this.currentMid = mid;

        if (this.onScaleUpdateCallback) {
            this.onScaleUpdateCallback(min, max, mid);
        }

        this.rebuildColorCache();
    }

    private rebuildColorCache() {
        this.colorCache.clear();
        const metricsKey = `${this.activeState}_${this.activeLevel}_${this.activeMetric}`;
        const levelData = this.metricsCache.get(metricsKey) || {};
        for (const key in levelData) {
            const val = levelData[key] ?? null;
            this.colorCache.set(key, getColor(val, this.currentMin, this.currentMax, this.activeMetric, this.currentMid));
        }
    }

    private applyColorCache() {
        if (!this.geoJsonLayer) return;
        const borderColor = this.currentTheme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';
        const metricsKey = `${this.activeState}_${this.activeLevel}_${this.activeMetric}`;
        const levelData = this.metricsCache.get(metricsKey) || {};
        const isSupported = isMetricSupportedAtLevel(this.activeMetric, this.activeLevel);

        requestAnimationFrame(() => {
            this.geoJsonLayer!.eachLayer((layer: any) => {
                if (!layer.feature) return;
                const key = this.getFeatureKey(layer.feature, this.activeLevel);
                const val = isSupported ? (levelData[key] ?? null) : null;
                const hasData = val !== null;
                const fillColor = hasData ? (this.colorCache.get(key) ?? 'rgba(0,0,0,0)') : 'rgba(0,0,0,0)';
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
        const metricsKey = `${this.activeState}_${this.activeLevel}_${this.activeMetric}`;
        const levelData = this.metricsCache.get(metricsKey) || {};
        const isSupported = isMetricSupportedAtLevel(this.activeMetric, this.activeLevel);
        const val = isSupported ? (levelData[key] ?? null) : null;
        const hasData = val !== null;
        const fillColor = hasData ? (this.colorCache.get(key) ?? getColor(val, this.currentMin, this.currentMax, this.activeMetric, this.currentMid)) : 'rgba(0,0,0,0)';
        const borderColor = this.currentTheme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';

        // Optimize border rendering dynamically based on zoom level to reduce Canvas redraw overhead
        const zoom = this.map ? this.map.getZoom() : 6;
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
        const layer = this.layersMap.get(key);
        if (!layer) return;

        this.activeSelectedRegionKey = key;
        if (this.onRegionSelectCallback) {
            this.onRegionSelectCallback(key);
        }

        const popupAnchor = latlng || (layer as any).getBounds().getCenter();
        const content = this.generatePopupContent(key);

        this.activePopup = L.popup({
            className: 'custom-map-popup',
            maxWidth: 320,
            minWidth: 260
        })
        .setLatLng(popupAnchor)
        .setContent(content);

        this.activePopup.openOn(this.map);
    }

    updateActivePopup() {
        if (this.activeSelectedRegionKey && this.activePopup && this.map.hasLayer(this.activePopup)) {
            const content = this.generatePopupContent(this.activeSelectedRegionKey);
            this.activePopup.setContent(content);
        }
    }

    private formatVersionDate(versionStr: string): string {
        if (!versionStr || versionStr.length !== 8) return versionStr;
        const year = versionStr.substring(0, 4);
        const monthStr = versionStr.substring(4, 6);
        const dayStr = versionStr.substring(6, 8);
        
        const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        const monthIdx = parseInt(monthStr, 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
            return `${months[monthIdx]} ${parseInt(dayStr, 10)}, ${year}`;
        }
        return `${year}-${monthStr}-${dayStr}`;
    }

    private generatePopupContent(key: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'map-popup-card';

        const regionsKey = `${this.activeState}_${this.activeLevel}`;
        const metricsKey = `${this.activeState}_${this.activeLevel}_${this.activeMetric}`;
        
        let regionName = 'Unknown Region';
        let state = '';
        const namesData = this.regionsCache.get(regionsKey);
        if (namesData && namesData[key]) {
            regionName = namesData[key].name;
            state = namesData[key].state || '';
        }

        let titleText = '';
        if (this.activeLevel === 'zip') {
            titleText = `${key} (${regionName}, ${state})`;
        } else if (state) {
            titleText = `${regionName}, ${state}`;
        } else {
            titleText = regionName;
        }

        let val: number | null = null;
        const isSupported = isMetricSupportedAtLevel(this.activeMetric, this.activeLevel);
        if (isSupported) {
            const metricsData = this.metricsCache.get(metricsKey);
            if (metricsData && metricsData[key] !== undefined) {
                val = metricsData[key];
            }
        }

        const def = METRIC_DEFINITIONS[this.activeMetric];
        const metricTitle = def ? def.title : 'Metric';
        
        let formattedValue = 'N/A';
        if (isSupported) {
            formattedValue = formatMetricValue(val, this.activeMetric, false);
        } else {
            formattedValue = 'N/A (Not supported at this level)';
        }

        // Get updated date from manifest metricsVersion
        let updateDateText = '';
        if (this.manifest) {
            const version = this.manifest.metricsVersions[this.activeState];
            if (version) {
                updateDateText = `Updated: ${this.formatVersionDate(version)}`;
            }
        }

        // Group and order metrics as on the left panel
        const categories = {
            home: { label: 'Home Metrics', options: [] as string[] },
            market: { label: 'Market Metrics', options: [] as string[] },
            investor: { label: 'Investor Metrics', options: [] as string[] }
        };

        for (const metricKey in METRIC_DEFINITIONS) {
            const mKey = metricKey as MetricType;
            if (isMetricSupportedAtLevel(mKey, this.activeLevel)) {
                const mDef = METRIC_DEFINITIONS[mKey];
                const selectedAttr = mKey === this.activeMetric ? 'selected' : '';
                const optionHtml = `<option value="${mKey}" ${selectedAttr}>${mDef.icon} ${mDef.title}</option>`;
                categories[mDef.category].options.push(optionHtml);
            }
        }

        let optionsHtml = '';
        for (const catKey in categories) {
            const cat = categories[catKey as keyof typeof categories];
            if (cat.options.length > 0) {
                optionsHtml += `<optgroup label="${cat.label}">
                    ${cat.options.join('\n')}
                </optgroup>`;
            }
        }

        container.innerHTML = `
            <div class="map-popup-header">${titleText}</div>
            <div class="map-popup-body">
                <div class="map-popup-metric-info">
                    <span class="map-popup-metric-label">${metricTitle}</span>
                    <span class="map-popup-metric-value">${formattedValue}</span>
                    ${updateDateText ? `<span class="map-popup-update-date">${updateDateText}</span>` : ''}
                </div>
            </div>
            <div class="map-popup-selector-container">
                <label for="popup-metric-select" class="map-popup-select-label">Switch Metric:</label>
                <select id="popup-metric-select" class="popup-metric-select">
                    ${optionsHtml}
                </select>
            </div>
        `;

        // Wire dropdown metric selection change listener directly to callback
        const select = container.querySelector('#popup-metric-select') as HTMLSelectElement;
        if (select) {
            select.addEventListener('change', (e) => {
                const newMetric = (e.target as HTMLSelectElement).value as MetricType;
                if (this.onMetricChangeCallback) {
                    this.onMetricChangeCallback(newMetric);
                }
            });
        }

        return container;
    }

    private handlePendingSelection() {
        if (this.pendingSelectedRegionKey) {
            const key = this.pendingSelectedRegionKey;
            this.pendingSelectedRegionKey = null;
            
            setTimeout(() => {
                const layer = this.layersMap.get(key);
                if (layer) {
                    this.openRegionPopup(key);
                    
                    const bounds = (layer as any).getBounds();
                    if (bounds.isValid()) {
                        this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
                    }
                }
            }, 100);
        }
    }

    private onEachFeature(feature: any, layer: L.Layer) {
        const key = this.getFeatureKey(feature, this.activeLevel);
        if (key) {
            this.layersMap.set(key, layer);
        }

        layer.on({
            mouseover: (e: any) => {
                if (this.isMapMoving) return;
                const target = e.target as L.Path;
                target.setStyle({ weight: 2, color: 'white', fillOpacity: 0.8 });

                let val: number | null = null;
                let regionName = 'Unknown Region';
                let state = '';
                
                const regionsKey = `${this.activeState}_${this.activeLevel}`;
                const metricsKey = `${this.activeState}_${this.activeLevel}_${this.activeMetric}`;
                
                const namesData = this.regionsCache.get(regionsKey);
                if (namesData && namesData[key]) {
                    regionName = namesData[key].name;
                    state = namesData[key].state || '';
                } else {
                    regionName = feature.properties.NAME || feature.properties.name || key;
                }

                const isSupported = isMetricSupportedAtLevel(this.activeMetric, this.activeLevel);
                if (isSupported) {
                    const metricsData = this.metricsCache.get(metricsKey);
                    if (metricsData && metricsData[key] !== undefined) {
                        val = metricsData[key];
                    }
                }

                this.tooltip.show(this.activeLevel, key, val, regionName, state, this.activeMetric);
            },
            mouseout: (e: any) => {
                if (this.isMapMoving) return;
                if (this.geoJsonLayer) {
                    this.geoJsonLayer.resetStyle(e.target);
                }
                this.tooltip.hide();
            },
            click: (e: any) => {
                this.openRegionPopup(key, e.latlng);
            }
        });
    }
}
