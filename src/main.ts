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

// Loading overlay is defined statically in index.html

// Wire Level Selector
const levelButtons = document.querySelectorAll('.level-btn');
levelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const level = btn.getAttribute('data-level') as any;
        if (level) {
            levelButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mapManager.setLevel(level);
        }
    });
});

// Wire State Selector
const stateSelect = document.getElementById('state-select') as HTMLSelectElement;
stateSelect?.addEventListener('change', () => {
    const stateCode = stateSelect.value;
    if (stateCode) {
        mapManager.setStateCode(stateCode);
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

// Redundant listener removed - logic consolidated into primary callback above

