import * as L from 'leaflet';
import { getColor } from './colors';
import type { MetricType } from './colors';
import { TooltipManager } from './tooltip';

export interface MetricsData {
    national_avg: number;
    rent_avg?: number;
    data: {
        [zipCode: string]: {
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
            city: string;
            state: string;
        }
    }
}

export interface ManifestData {
    supportedStates: string[];
    metricsVersions: Record<string, string>;
    geodataVersions: Record<string, string>;
}

export class MapManager {
    private map: L.Map;
    private geoJsonLayer: L.GeoJSON | null = null;
    private loadedStates: Set<string> = new Set();
    private metricsData: MetricsData = { national_avg: 0, data: {} };
    private activeMetric: MetricType = 'homeValue';
    private tooltip: TooltipManager;
    private loadingCount = 0;
    private manifest: ManifestData | null = null;
    
    // Bounds tracking to dynamically update color scale
    private currentMin = 0;
    private currentMax = 0;
    private currentMid = 0;
    
    private onScaleUpdateCallback: ((min: number, max: number, mid: number) => void) | null = null;
    private tileLayer: L.TileLayer;
    private currentTheme: string;

    constructor(tooltip: TooltipManager, theme: string = 'dark') {
        this.tooltip = tooltip;
        this.currentTheme = theme;
        
        // Initialize map centered on US
        this.map = L.map('map-container', {
            zoomControl: false,
            preferCanvas: true
        }).setView([37.8, -96], 4);

        // Add zoom control to top right
        L.control.zoom({ position: 'topright' }).addTo(this.map);

        // CartoDB base tiles based on theme
        const tileUrl = this.currentTheme === 'light' 
            ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            
        this.tileLayer = L.tileLayer(tileUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
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
        
        const tileUrl = theme === 'light' 
            ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            
        this.tileLayer.setUrl(tileUrl);
        
        // Re-render polygons to adapt to light/dark borders if needed
        if (this.geoJsonLayer) {
            this.geoJsonLayer.eachLayer((layer: any) => {
                if (layer.feature) {
                    layer.setStyle(this.getFeatureStyle(layer.feature));
                }
            });
        }
    }

    setMetric(metric: MetricType) {
        this.activeMetric = metric;
        this.updateScaleBounds();
        
        if (this.geoJsonLayer) {
            // Re-style all polygons with new metric
            this.geoJsonLayer.eachLayer((layer: any) => {
                if (layer.feature) {
                    layer.setStyle(this.getFeatureStyle(layer.feature));
                }
            });
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
            const res = await fetch('/data/manifest.json');
            this.manifest = await res.json();
            
            // Check if data is outdated (>= 7 days old)
            if (this.manifest) {
                let outdated = false;
                const now = new Date();
                
                // Check the first supported state's version
                const stateToCheck = this.manifest.supportedStates[0] || 'TX';
                const version = this.manifest.metricsVersions[stateToCheck];
                
                if (version && version.length >= 8) {
                    const year = parseInt(version.substring(0, 4), 10);
                    const month = parseInt(version.substring(4, 6), 10) - 1; // 0-indexed
                    const day = parseInt(version.substring(6, 8), 10);
                    const dataDate = new Date(year, month, day);
                    
                    const diffTime = now.getTime() - dataDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
                    
                    if (diffDays >= 7) {
                        outdated = true;
                    }
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
                        const refreshRes = await fetch('/api/refresh-data');
                        if (refreshRes.ok) {
                            window.location.reload();
                            return; // Stop execution, page will reload
                        } else {
                            console.error('Failed to refresh data');
                        }
                    } catch (e) {
                        console.error('Error calling refresh API', e);
                    }
                }
            }

            // For demo, auto-load TX if it's supported
            if (this.manifest?.supportedStates.includes('TX')) {
                setTimeout(() => {
                    this.flyTo(30.2672, -97.7431, 10);
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
            const geodataFilename = `${stateCode.toLowerCase()}_geodata_${geodataVersion}.json`;

            // Fetch metrics and geodata concurrently
            const [metricsRes, geodataRes] = await Promise.all([
                fetch(`/data/${metricsFilename}`),
                fetch(`/data/geodata/${geodataFilename}`)
            ]);

            if (!metricsRes.ok) throw new Error(`Failed to load metrics for ${stateCode}`);
            if (!geodataRes.ok) throw new Error(`Failed to load geodata for ${stateCode}`);

            const metricsData = await metricsRes.json();
            const geodata = await geodataRes.json();

            // Merge data into our global map (we average the national_avg for simplicity if loading multiple states)
            this.metricsData.data = { ...this.metricsData.data, ...metricsData.data };
            this.metricsData.national_avg = metricsData.national_avg; 

            this.loadedStates.add(stateCode);
            this.updateScaleBounds();

            // Add shapes to map
            if (this.geoJsonLayer) {
                this.geoJsonLayer.addData(geodata);
            }
            
        } catch (error) {
            console.error(`Error loading data for ${stateCode}:`, error);
        } finally {
            this.setLoading(false);
        }
    }

    private updateScaleBounds() {
        if (Object.keys(this.metricsData.data).length === 0) return;

        let min = Infinity;
        let max = -Infinity;

        const vals: number[] = [];
        for (const zip in this.metricsData.data) {
            const val = this.metricsData.data[zip][this.activeMetric];
            if (val !== null && val !== undefined) {
                vals.push(val);
            }
        }

        if (vals.length > 0) {
            vals.sort((a, b) => a - b);
            const p5 = vals[Math.floor(vals.length * 0.05)];
            const p95 = vals[Math.floor(vals.length * 0.95)];
            
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
    }

    private getFeatureStyle(feature: any): L.PathOptions {
        const zip = feature.properties.ZCTA5CE10 || feature.properties.ZCTA5CE20;
        let value: number | null = null;
        
        if (this.metricsData.data[zip]) {
            value = this.metricsData.data[zip][this.activeMetric] ?? null;
        }

        const color = getColor(value, this.currentMin, this.currentMax, this.activeMetric, this.currentMid);
        
        // Light theme borders should be dark, dark theme borders should be light for contrast
        const borderColor = this.currentTheme === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';

        return {
            fillColor: color,
            weight: 1,
            opacity: 0.2,
            color: borderColor,
            fillOpacity: value === null ? 0 : 0.35
        };
    }

    private onEachFeature(feature: any, layer: L.Layer) {
        layer.on({
            mouseover: (e: any) => {
                const target = e.target as L.Path;
                target.setStyle({ weight: 2, color: 'white', fillOpacity: 0.8 });
                target.bringToFront();

                const zip = feature.properties.ZCTA5CE10 || feature.properties.ZCTA5CE20;
                let val: number | null = null;
                let city = 'Unknown City';
                let state = '';
                
                if (this.metricsData.data[zip]) {
                    const d = this.metricsData.data[zip];
                    val = d[this.activeMetric] ?? null;
                    city = d.city;
                    state = d.state;
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
                if (this.activeMetric === 'rentDaysOnMarket') { metricName = 'Days on Market'; }

                this.tooltip.show(zip, val, city, state, metricName, isGrowth);
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
