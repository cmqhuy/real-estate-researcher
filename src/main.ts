import './style.css'
import { SidebarManager } from './sidebar';
import { MapManager } from './map';
import { SearchManager } from './search';
import { TooltipManager } from './tooltip';
import { LegendManager } from './legend';

// Theme Management
const themeToggle = document.getElementById('theme-toggle');
let currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);

// Initialize Components
const tooltip = new TooltipManager();
const legend = new LegendManager();
const mapManager = new MapManager(tooltip, currentTheme);
const sidebar = new SidebarManager();
const search = new SearchManager();

// Wire Theme Toggle
themeToggle?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    mapManager.setTheme(currentTheme);
});

// Wire everything together

// 1. When metric changes in sidebar, update map and legend
sidebar.onMetricChange((metric) => {
    mapManager.setMetric(metric);
});

// 2. When search result is selected, fly map to location
search.onLocationSelect((lat, lon, zoom) => {
    mapManager.flyTo(lat, lon, zoom);
});

// 3. When map updates scale (due to data load or metric change), update legend
mapManager.onScaleUpdate((min, max, mid) => {
    legend.update(sidebar.getActiveMetric(), min, max, mid);
});

// Add loading overlay to the document
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loading-overlay';
loadingOverlay.className = 'loading-overlay hidden';
loadingOverlay.innerHTML = `
    <div class="spinner"></div>
    <div>Loading Data...</div>
`;
document.body.appendChild(loadingOverlay);

