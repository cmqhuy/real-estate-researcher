import * as L from 'leaflet';
import { getColor } from './colors';
import type { MetricType, GeographicLevel } from './colors';
import { TooltipManager } from './tooltip';

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
    rentDaysOnMarket?: number;
    name: string;
    state: string;
}

export interface MetricsData {
    national_avg: number;
    rent_avg?: number;
    levels: {
        zip: Record<string, RegionMetrics>;
        county: Record<string, RegionMetrics>;
        metro: Record<string, RegionMetrics>;
        state: Record<string, RegionMetrics>;
        country: Record<string, RegionMetrics>;
    };
}

export interface ManifestData {
    supportedStates: string[];
    metricsVersions: Record<string, string>;
    geodataVersions: Record<string, string>;
}

export class MapManager {
    private map: L.Map;
    private canvasRenderer: L.Renderer;
    private geoJsonLayer: L.GeoJSON | null = null;
    private loadedStates: Set<string> = new Set();
    private metricsData: MetricsData = { national_avg: 0, levels: { zip: {}, county: {}, metro: {}, state: {}, country: {} } };
    private activeMetric: MetricType = 'homeValue';
    private activeLevel: GeographicLevel = 'zip';
    private tooltip: TooltipManager;
    private loadingCount = 0;
    private manifest: ManifestData | null = null;

    // Cache of loaded level geodata: state_level -> GeoJSON object
    private geodataCache: Map<string, any> = new Map();
    private activeState = 'TX';
    private metricsDataCache: Map<string, MetricsData> = new Map();

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

    constructor(tooltip: TooltipManager, theme: string = 'dark') {
        this.tooltip = tooltip;
        this.currentTheme = theme;

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
            onEachFeature: this.onEachFeature.bind(this)
        }).addTo(this.map);

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

    setMetric(metric: MetricType) {
        this.activeMetric = metric;
        this.updateScaleBounds(); // also rebuilds colorCache
        this.applyColorCache();
    }

    async setLevel(level: GeographicLevel) {
        if (this.activeLevel === level) return;
        this.activeLevel = level;

        // Clear existing features
        if (this.geoJsonLayer) {
            this.geoJsonLayer.clearLayers();
        }

        this.setLoading(true);
        try {
            // Check cache first
            const cacheKey = `${this.activeState}_${level}`;
            let geodata = this.geodataCache.get(cacheKey);
            if (!geodata && this.manifest) {
                const stateCode = this.activeState;
                const geodataVersion = this.manifest.geodataVersions[stateCode];
                const filename = `${stateCode.toLowerCase()}_${level}_geodata_${geodataVersion}.json`;
                const res = await fetch(`${BASE_URL}data/geodata/${filename}`);
                if (!res.ok) throw new Error(`Failed to load ${level} geodata`);
                geodata = await res.json();
                this.geodataCache.set(cacheKey, geodata);
            }

            if (geodata && this.geoJsonLayer) {
                this.geoJsonLayer.addData(geodata);
                
                // Fit bounds to new features
                const bounds = this.geoJsonLayer.getBounds();
                if (bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [20, 20] });
                }
            }

            this.updateScaleBounds();
            this.applyColorCache();
        } catch (error) {
            console.error(`Error switching to level ${level}:`, error);
        } finally {
            this.setLoading(false);
        }
    }

    async setStateCode(stateCode: string) {
        if (this.activeState === stateCode) return;
        this.activeState = stateCode;

        // Clear existing features
        if (this.geoJsonLayer) {
            this.geoJsonLayer.clearLayers();
        }

        this.setLoading(true);
        try {
            // Load metrics for the new state (use cache if available)
            let metricsData = this.metricsDataCache.get(stateCode);
            if (!metricsData && this.manifest) {
                const metricsVersion = this.manifest.metricsVersions[stateCode];
                if (!metricsVersion) throw new Error(`Missing metrics version for state ${stateCode}`);
                
                const metricsFilename = `${stateCode.toLowerCase()}_metrics_${metricsVersion}.json`;
                const res = await fetch(`${BASE_URL}data/${metricsFilename}`);
                if (!res.ok) throw new Error(`Failed to load metrics for ${stateCode}`);
                
                const rawData = await res.json() as any;
                if (!rawData.levels) {
                    rawData.levels = {
                        zip: rawData.data || {},
                        county: {},
                        metro: {},
                        state: {},
                        country: {}
                    };
                }
                metricsData = rawData as MetricsData;
                this.metricsDataCache.set(stateCode, metricsData);
            }

            if (metricsData) {
                this.metricsData = metricsData;
            }

            // Load geodata for active level for the new state (use cache if available)
            const cacheKey = `${stateCode}_${this.activeLevel}`;
            let geodata = this.geodataCache.get(cacheKey);
            if (!geodata && this.manifest) {
                const geodataVersion = this.manifest.geodataVersions[stateCode];
                if (!geodataVersion) throw new Error(`Missing geodata version for state ${stateCode}`);
                
                const geodataFilename = `${stateCode.toLowerCase()}_${this.activeLevel}_geodata_${geodataVersion}.json`;
                const res = await fetch(`${BASE_URL}data/geodata/${geodataFilename}`);
                if (!res.ok) throw new Error(`Failed to load ${this.activeLevel} geodata for ${stateCode}`);
                
                geodata = await res.json();
                this.geodataCache.set(cacheKey, geodata);
            }

            if (geodata && this.geoJsonLayer) {
                this.geoJsonLayer.addData(geodata);
                
                // Fly to the new state's center
                if (stateCode === 'WA') {
                    this.flyTo(47.4009, -121.4905, 7);
                } else {
                    // Default to TX center
                    this.flyTo(31.9686, -99.9018, 6);
                }
            }

            this.updateScaleBounds();
            this.applyColorCache();

        } catch (error) {
            console.error(`Error switching to state ${stateCode}:`, error);
        } finally {
            this.setLoading(false);
        }
    }

    flyTo(lat: number, lon: number, zoom: number) {
        this.map.flyTo([lat, lon], zoom, { duration: 1.5 });
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

            // Load TX if it's supported
            if (this.manifest?.supportedStates.includes('TX')) {
                setTimeout(() => {
                    this.flyTo(31.9686, -99.9018, 6);
                    this.loadStateData('TX');
                }, 500);
            }
        } catch (error) {
            console.error('Failed to load manifest.json:', error);
        } finally {
            this.setLoading(false);
        }
    }

    private async loadStateData(stateCode: string) {
        if (this.loadedStates.has(stateCode) || !this.manifest) return;
        
        this.setLoading(true);
        try {
            const metricsVersion = this.manifest.metricsVersions[stateCode];
            const geodataVersion = this.manifest.geodataVersions[stateCode];

            if (!metricsVersion || !geodataVersion) {
                throw new Error(`Missing versioning info for state ${stateCode} in manifest.`);
            }

            const metricsFilename = `${stateCode.toLowerCase()}_metrics_${metricsVersion}.json`;
            const geodataFilename = `${stateCode.toLowerCase()}_${this.activeLevel}_geodata_${geodataVersion}.json`;

            const [metricsRes, geodataRes] = await Promise.all([
                fetch(`${BASE_URL}data/${metricsFilename}`),
                fetch(`${BASE_URL}data/geodata/${geodataFilename}`)
            ]);

            if (!metricsRes.ok) throw new Error(`Failed to load metrics for ${stateCode}`);
            if (!geodataRes.ok) throw new Error(`Failed to load ${this.activeLevel} geodata for ${stateCode}`);

            const metricsData = await metricsRes.json();
            if (!metricsData.levels) {
                metricsData.levels = {
                    zip: metricsData.data || {},
                    county: {},
                    metro: {},
                    state: {},
                    country: {}
                };
            }
            const geodata = await geodataRes.json();

            this.metricsData = metricsData;
            this.metricsDataCache.set(stateCode, metricsData);
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

    private updateScaleBounds() {
        const levelData = this.metricsData.levels[this.activeLevel] || {};
        if (Object.keys(levelData).length === 0) return;

        let min = Infinity;
        let max = -Infinity;

        const vals: number[] = [];
        for (const key in levelData) {
            const val = levelData[key][this.activeMetric];
            if (val !== null && val !== undefined) {
                vals.push(val);
            }
        }

        if (vals.length > 0) {
            vals.sort((a, b) => a - b);
            let p5 = vals[Math.floor(vals.length * 0.05)];
            let p95 = vals[Math.floor(vals.length * 0.95)];
            
            // If they are equal (e.g. only 1 data point), create a synthetic range
            if (p5 === p95) {
                p5 = p5 * 0.8;
                p95 = p95 * 1.2;
            }

            const isAbsolute = this.activeMetric === 'homeValue' || this.activeMetric === 'rentValue';
            const isDOM = this.activeMetric === 'homeDaysOnMarket' || this.activeMetric === 'rentDaysOnMarket';
            
            if (isAbsolute) {
                min = p5;
                max = p95;
                if (this.activeMetric === 'rentValue') {
                    min = 0;
                }
            } else if (isDOM) {
                min = 0;
                max = p95;
            } else {
                const maxAbs = Math.max(Math.abs(p5), Math.abs(p95));
                min = -maxAbs;
                max = maxAbs;
            }
        } else {
            min = 0; max = 1;
        }

        this.currentMin = min;
        this.currentMax = max;

        let mid = 0;
        if (this.activeMetric === 'homeValue') {
            mid = this.metricsData.national_avg;
        } else if (this.activeMetric === 'rentValue') {
            mid = this.metricsData.rent_avg || 2000;
        }
        this.currentMid = mid;

        if (this.onScaleUpdateCallback) {
            this.onScaleUpdateCallback(min, max, mid);
        }

        this.rebuildColorCache();
    }

    private rebuildColorCache() {
        this.colorCache.clear();
        const levelData = this.metricsData.levels[this.activeLevel] || {};
        for (const key in levelData) {
            const val = levelData[key][this.activeMetric] ?? null;
            this.colorCache.set(key, getColor(val, this.currentMin, this.currentMax, this.activeMetric, this.currentMid));
        }
    }

    private applyColorCache() {
        if (!this.geoJsonLayer) return;
        const borderColor = this.currentTheme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';
        requestAnimationFrame(() => {
            this.geoJsonLayer!.eachLayer((layer: any) => {
                if (!layer.feature) return;
                const key = this.getFeatureKey(layer.feature, this.activeLevel);
                const fillColor = this.colorCache.get(key) ?? 'rgba(0,0,0,0)';
                const val = this.metricsData.levels[this.activeLevel]?.[key]?.[this.activeMetric] ?? null;
                const hasData = val !== null;
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
        const val = this.metricsData.levels[this.activeLevel]?.[key]?.[this.activeMetric] ?? null;
        const fillColor = this.colorCache.get(key)
            ?? getColor(val, this.currentMin, this.currentMax, this.activeMetric, this.currentMid);
        const hasData = val !== null;
        const borderColor = this.currentTheme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';

        return {
            fillColor,
            weight: 0.8,
            opacity: 0.8,
            color: borderColor,
            fillOpacity: hasData ? 0.6 : 0
        };
    }

    private onEachFeature(feature: any, layer: L.Layer) {
        layer.on({
            mouseover: (e: any) => {
                const target = e.target as L.Path;
                target.setStyle({ weight: 2, color: 'white', fillOpacity: 0.8 });
                target.bringToFront();

                const key = this.getFeatureKey(feature, this.activeLevel);
                let val: number | null = null;
                let regionName = 'Unknown Region';
                let state = '';
                
                const levelData = this.metricsData.levels[this.activeLevel];
                if (levelData && levelData[key]) {
                    const d = levelData[key];
                    val = d[this.activeMetric] ?? null;
                    regionName = d.name;
                    state = d.state || '';
                } else {
                    regionName = feature.properties.NAME || feature.properties.name || key;
                }

                let metricName = 'Home Value';
                let isGrowth = false;
                if (this.activeMetric === 'homeValue') { metricName = 'Home Value'; }
                if (this.activeMetric === 'homeYoyGrowth') { metricName = 'Home Value Growth (YoY)'; isGrowth = true; }
                if (this.activeMetric === 'homeFiveYearGrowth') { metricName = 'Home Value Growth (5-Year)'; isGrowth = true; }
                if (this.activeMetric === 'homeMomGrowth') { metricName = 'Home Value Growth (MoM)'; isGrowth = true; }
                if (this.activeMetric === 'rentValue') { metricName = 'Monthly Rent'; }
                if (this.activeMetric === 'rentYoyGrowth') { metricName = 'Rent Growth (YoY)'; isGrowth = true; }
                if (this.activeMetric === 'rentFiveYearGrowth') { metricName = 'Rent Growth (5-Year)'; isGrowth = true; }
                if (this.activeMetric === 'rentMomGrowth') { metricName = 'Rent Growth (MoM)'; isGrowth = true; }
                if (this.activeMetric === 'homeDaysOnMarket') { metricName = 'Days on Market'; }
                if (this.activeMetric === 'rentDaysOnMarket') { metricName = 'Days on Market (Simulated)'; }

                this.tooltip.show(this.activeLevel, key, val, regionName, state, metricName, isGrowth);
            },
            mouseout: (e: any) => {
                if (this.geoJsonLayer) {
                    this.geoJsonLayer.resetStyle(e.target);
                }
                this.tooltip.hide();
            }
        });
    }
}
