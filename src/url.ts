import type { MetricType, GeographicLevel } from './colors';

export interface UrlState {
    state?: string;
    level?: GeographicLevel;
    metric?: MetricType;
    selected?: string;
}

/**
 * Parses the current URL search parameters into a clean state object.
 */
export function parseUrlState(): UrlState {
    const params = new URLSearchParams(window.location.search);
    
    const state = params.get('state')?.toUpperCase() || undefined;
    const level = params.get('level') as GeographicLevel || undefined;
    const metric = params.get('metric') as MetricType || undefined;
    const selected = params.get('selected') || undefined;

    return { state, level, metric, selected };
}

/**
 * Updates the URL query parameters to match the provided state.
 * Uses window.history.replaceState to avoid polluting browser back/forward history.
 */
export function updateUrlState(state: UrlState) {
    const params = new URLSearchParams(window.location.search);

    if (state.state) {
        params.set('state', state.state.toUpperCase());
    } else {
        params.delete('state');
    }

    if (state.level) {
        params.set('level', state.level);
    } else {
        params.delete('level');
    }

    if (state.metric) {
        params.set('metric', state.metric);
    } else {
        params.delete('metric');
    }

    if (state.selected) {
        params.set('selected', state.selected);
    } else {
        params.delete('selected');
    }

    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
}
