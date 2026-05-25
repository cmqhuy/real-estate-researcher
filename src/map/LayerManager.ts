import * as L from 'leaflet';

export class LayerManager {
    private geoJsonLayer: L.GeoJSON;
    private layersMap = new Map<string, L.Layer>();

    private map: L.Map;
    private getFeatureKeyFn: (feature: any) => string;

    constructor(
        map: L.Map,
        getFeatureKeyFn: (feature: any) => string
    ) {
        this.map = map;
        this.getFeatureKeyFn = getFeatureKeyFn;
        this.geoJsonLayer = L.geoJSON(undefined, {
            smoothFactor: 1.5
        } as any).addTo(this.map);
    }

    clear(): void {
        this.layersMap.clear();
        this.geoJsonLayer.clearLayers();
    }

    setData(
        geodata: any,
        styleFn: (feature: any) => L.PathOptions,
        onEachFeatureFn: (feature: any, layer: L.Layer) => void
    ): void {
        this.clear();

        this.geoJsonLayer.options.style = styleFn as any;
        this.geoJsonLayer.options.onEachFeature = (feature, layer) => {
            const key = this.getFeatureKeyFn(feature);
            if (key) {
                this.layersMap.set(key, layer);
            }
            onEachFeatureFn(feature, layer);
        };

        this.geoJsonLayer.addData(geodata);
    }

    updateStyles(styleFn: (feature: any) => L.PathOptions): void {
        this.geoJsonLayer.setStyle(styleFn as any);
    }

    fitLayerBounds(): void {
        const bounds = this.geoJsonLayer.getBounds();
        if (bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [20, 20] });
        }
    }

    getLayer(key: string): L.Layer | undefined {
        return this.layersMap.get(key);
    }

    getGeoJsonLayer(): L.GeoJSON {
        return this.geoJsonLayer;
    }
}
