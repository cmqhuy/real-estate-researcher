import './style.css'
import { SidebarManager } from './sidebar';
import { MapManager } from './map';
import { SearchManager } from './search';
import { TooltipManager } from './tooltip';
import { LegendManager } from './legend';
import { parseUrlState, updateUrlState } from './url';

// Theme Management
const themeToggle = document.getElementById('theme-toggle');
let currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);

// Parse initial URL state
const urlState = parseUrlState();

// Initialize Components
const tooltip = new TooltipManager();
const legend = new LegendManager();
const mapManager = new MapManager(tooltip, currentTheme, urlState);
const sidebar = new SidebarManager();
const search = new SearchManager();

// Set initial level constraints on sidebar
if (urlState.level) {
    const activeBtn = document.querySelector(`.level-btn[data-level="${urlState.level}"]`);
    if (activeBtn) {
        document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');
    }
    sidebar.updateLevelSelectorConstraints(urlState.level);
} else {
    sidebar.updateLevelSelectorConstraints('zip');
}

if (urlState.metric) {
    sidebar.selectMetric(urlState.metric);
}

if (urlState.state) {
    const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
    if (stateSelect) {
        stateSelect.value = urlState.state;
    }
}

// Wire Theme Toggle
themeToggle?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    mapManager.setTheme(currentTheme);
});

// Wire everything together

// 1. When metric changes in sidebar, update map, legend, and URL
sidebar.onMetricChange((metric) => {
    mapManager.setMetric(metric);
    
    // Update URL query parameters
    const current = parseUrlState();
    updateUrlState({
        state: current.state || 'TX',
        level: current.level || 'zip',
        metric: metric,
        selected: current.selected
    });

    // On mobile, close drawer menu after selection
    if (window.innerWidth <= 768) {
        const sidebarEl = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        sidebarEl?.classList.remove('open');
        backdrop?.classList.remove('active');
    }
});

// 2. When search result is selected, fly map to location
search.onLocationSelect((lat, lon, zoom) => {
    mapManager.flyTo(lat, lon, zoom);
});

// 3. When map updates scale (due to data load or metric change), update legend
mapManager.onScaleUpdate((min, max, mid) => {
    legend.update(sidebar.getActiveMetric(), min, max, mid);
});

// 4. When metric is changed in the map popup, update sidebar UI
mapManager.onMapMetricChange((metric) => {
    sidebar.selectMetric(metric);
});

// 5. When a region is selected or deselected on the map, update URL
mapManager.onRegionSelect((selectedKey) => {
    const current = parseUrlState();
    updateUrlState({
        state: current.state || 'TX',
        level: current.level || 'zip',
        metric: current.metric || sidebar.getActiveMetric(),
        selected: selectedKey || undefined
    });
});

// Wire Level Selector
const levelButtons = document.querySelectorAll('.level-btn');
levelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const level = btn.getAttribute('data-level') as any;
        if (level) {
            levelButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sidebar.updateLevelSelectorConstraints(level);
            mapManager.setLevel(level);

            // Update URL query parameters and clear selected region
            const current = parseUrlState();
            updateUrlState({
                state: current.state || 'TX',
                level: level,
                metric: sidebar.getActiveMetric(),
                selected: undefined
            });
        }
    });
});

// Wire State Selector
const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
stateSelect?.addEventListener('change', () => {
    const stateCode = stateSelect.value;
    if (stateCode) {
        mapManager.setStateCode(stateCode);

        // Update URL query parameters and clear selected region
        const current = parseUrlState();
        updateUrlState({
            state: stateCode,
            level: current.level || 'zip',
            metric: sidebar.getActiveMetric(),
            selected: undefined
        });
    }
});

// Mobile Sidebar Drawer Menu Toggling
const menuToggle = document.getElementById('menu-toggle');
const menuClose = document.getElementById('menu-close');
const sidebarEl = document.querySelector('.sidebar');
const backdrop = document.getElementById('sidebar-backdrop');

function openMenu() {
    sidebarEl?.classList.add('open');
    backdrop?.classList.add('active');
}

function closeMenu() {
    sidebarEl?.classList.remove('open');
    backdrop?.classList.remove('active');
}

menuToggle?.addEventListener('click', openMenu);
menuClose?.addEventListener('click', closeMenu);
backdrop?.addEventListener('click', closeMenu);

