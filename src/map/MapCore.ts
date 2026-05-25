import * as L from 'leaflet';

export class MapCore {
    private map: L.Map;
    private tileLayer: L.TileLayer;
    private labelLayer: L.TileLayer;
    private canvasRenderer: L.Renderer;

    constructor(containerId: string, initialTheme: string) {
        this.canvasRenderer = L.canvas({ tolerance: 4 });

        this.map = L.map(containerId, {
            zoomControl: false,
            preferCanvas: true,
            renderer: this.canvasRenderer
        }).setView([37.8, -96], 4);

        L.control.zoom({ position: 'topright' }).addTo(this.map);

        const labelPane = this.map.createPane('labels');
        labelPane.style.zIndex = '650';
        labelPane.style.pointerEvents = 'none';

        const baseUrl = initialTheme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

        this.tileLayer = L.tileLayer(baseUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            updateWhenIdle: false,
            keepBuffer: 4
        }).addTo(this.map);

        const labelUrl = initialTheme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';

        this.labelLayer = L.tileLayer(labelUrl, {
            subdomains: 'abcd',
            maxZoom: 19,
            pane: 'labels'
        }).addTo(this.map);
    }

    getLeafletMap(): L.Map {
        return this.map;
    }

    setTheme(theme: string) {
        const baseUrl = theme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

        const labelUrl = theme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png';

        this.tileLayer.setUrl(baseUrl);
        this.labelLayer.setUrl(labelUrl);
    }

    flyTo(lat: number, lon: number, zoom: number): Promise<void> {
        const currentCenter = this.map.getCenter();
        const currentZoom = this.map.getZoom();
        const distance = currentCenter.distanceTo([lat, lon]);

        if (distance < 100 && currentZoom === zoom) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.map.once('moveend', () => {
                resolve();
            });
            this.map.flyTo([lat, lon], zoom, { duration: 1.5 });
        });
    }

    onMoveStart(fn: () => void) {
        this.map.on('movestart', fn);
    }

    onMoveEnd(fn: () => void) {
        this.map.on('moveend', fn);
    }

    onZoomEnd(fn: () => void) {
        this.map.on('zoomend', fn);
    }

    onPopupClose(fn: () => void) {
        this.map.on('popupclose', fn);
    }
}
