import * as L from 'leaflet';
import type { MetricType, GeographicLevel } from '../colors';
import { METRIC_DEFINITIONS, formatMetricValue, isMetricSupportedAtLevel } from '../metrics';
import { TooltipManager } from '../tooltip';

export function formatVersionDate(versionStr: string): string {
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

export class InteractionManager {
    private activePopup: L.Popup | null = null;
    private activeSelectedKey: string | null = null;

    private map: L.Map;
    private tooltip: TooltipManager;
    private callbacks: {
        onMetricChange: (metric: MetricType) => void;
        onRegionSelect: (key: string | null) => void;
        getFeatureKey: (feature: any, level: GeographicLevel) => string;
        getRegionNameAndState: (key: string, feature: any) => { name: string; state: string };
        getMetricValue: (key: string) => number | null;
        getUpdateDate: () => string;
        resetLayerStyle: (layer: L.Layer) => void;
        getActiveLevel: () => GeographicLevel;
        getActiveMetric: () => MetricType;
    };

    constructor(
        map: L.Map,
        tooltip: TooltipManager,
        callbacks: {
            onMetricChange: (metric: MetricType) => void;
            onRegionSelect: (key: string | null) => void;
            getFeatureKey: (feature: any, level: GeographicLevel) => string;
            getRegionNameAndState: (key: string, feature: any) => { name: string; state: string };
            getMetricValue: (key: string) => number | null;
            getUpdateDate: () => string;
            resetLayerStyle: (layer: L.Layer) => void;
            getActiveLevel: () => GeographicLevel;
            getActiveMetric: () => MetricType;
        }
    ) {
        this.map = map;
        this.tooltip = tooltip;
        this.callbacks = callbacks;
    }

    setupFeatureEvents(
        layer: L.Layer,
        feature: any,
        isMapMoving: () => boolean
    ): void {
        const activeLevel = this.callbacks.getActiveLevel();
        const key = this.callbacks.getFeatureKey(feature, activeLevel);

        layer.on({
            mouseover: (e: any) => {
                if (isMapMoving()) return;
                const target = e.target as L.Path;
                target.setStyle({ weight: 2, color: 'white', fillOpacity: 0.8 });

                const currentLevel = this.callbacks.getActiveLevel();
                const currentMetric = this.callbacks.getActiveMetric();
                const { name: regionName, state } = this.callbacks.getRegionNameAndState(key, feature);
                const val = this.callbacks.getMetricValue(key);

                this.tooltip.show(currentLevel, key, val, regionName, state, currentMetric);
            },
            mouseout: (e: any) => {
                if (isMapMoving()) return;
                this.callbacks.resetLayerStyle(e.target);
                this.tooltip.hide();
            },
            click: (e: any) => {
                const currentLevel = this.callbacks.getActiveLevel();
                const currentMetric = this.callbacks.getActiveMetric();
                this.openPopup(key, layer, e.latlng, currentLevel, currentMetric);
            }
        });
    }

    openPopup(key: string, layer: L.Layer, latlng?: L.LatLng, activeLevel?: GeographicLevel, activeMetric?: MetricType) {
        this.activeSelectedKey = key;
        this.callbacks.onRegionSelect(key);

        const feature = (layer as any).feature;
        const popupAnchor = latlng || (layer as any).getBounds().getCenter();
        const resolvedLevel = activeLevel || this.callbacks.getActiveLevel();
        const resolvedMetric = activeMetric || this.callbacks.getActiveMetric();
        const content = this.generatePopupContent(key, resolvedLevel, resolvedMetric, feature);

        this.activePopup = L.popup({
            className: 'custom-map-popup',
            maxWidth: 320,
            minWidth: 260
        })
        .setLatLng(popupAnchor)
        .setContent(content);

        this.activePopup.openOn(this.map);
    }

    generatePopupContent(key: string, activeLevel: GeographicLevel, activeMetric: MetricType, feature: any): HTMLElement {
        const container = document.createElement('div');
        container.className = 'map-popup-card';

        const { name: regionName, state } = this.callbacks.getRegionNameAndState(key, feature);

        let titleText = '';
        if (activeLevel === 'zip') {
            titleText = `${key} (${regionName}, ${state})`;
        } else if (state) {
            titleText = `${regionName}, ${state}`;
        } else {
            titleText = regionName;
        }

        const val = this.callbacks.getMetricValue(key);
        const isSupported = isMetricSupportedAtLevel(activeMetric, activeLevel);

        const def = METRIC_DEFINITIONS[activeMetric];
        const metricTitle = def ? def.title : 'Metric';

        let formattedValue = 'N/A';
        if (isSupported) {
            formattedValue = formatMetricValue(val, activeMetric, false);
        } else {
            formattedValue = 'N/A (Not supported at this level)';
        }

        const updateDateText = this.callbacks.getUpdateDate();

        // Group and order metrics as on the left panel
        const categories = {
            home: { label: 'Home Metrics', options: [] as string[] },
            market: { label: 'Market Metrics', options: [] as string[] },
            investor: { label: 'Investor Metrics', options: [] as string[] }
        };

        for (const metricKey in METRIC_DEFINITIONS) {
            const mKey = metricKey as MetricType;
            if (isMetricSupportedAtLevel(mKey, activeLevel)) {
                const mDef = METRIC_DEFINITIONS[mKey];
                const selectedAttr = mKey === activeMetric ? 'selected' : '';
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

        const select = container.querySelector('#popup-metric-select') as HTMLSelectElement;
        if (select) {
            select.addEventListener('change', (e) => {
                const newMetric = (e.target as HTMLSelectElement).value as MetricType;
                this.callbacks.onMetricChange(newMetric);
            });
        }

        return container;
    }

    updatePopupContent(activeLevel: GeographicLevel, activeMetric: MetricType, feature?: any) {
        if (this.activeSelectedKey && this.activePopup && this.map.hasLayer(this.activePopup)) {
            const content = this.generatePopupContent(this.activeSelectedKey, activeLevel, activeMetric, feature);
            this.activePopup.setContent(content);
        }
    }

    closePopup() {
        this.activePopup = null;
        this.activeSelectedKey = null;
    }

    getActiveSelectedKey(): string | null {
        return this.activeSelectedKey;
    }

    clearSelection() {
        this.activeSelectedKey = null;
        this.activePopup = null;
    }
}
