import { describe, it, expect } from 'vitest';
import { parseUrlState, updateUrlState } from './url';

describe('url state helper', () => {
    it('should parse empty URL state correctly', () => {
        window.history.replaceState(null, '', '/');
        const state = parseUrlState();
        expect(state.state).toBeUndefined();
        expect(state.level).toBeUndefined();
        expect(state.metric).toBeUndefined();
        expect(state.selected).toBeUndefined();
    });

    it('should parse populated URL state correctly', () => {
        window.history.replaceState(null, '', '?state=tx&level=zip&metric=homeValue&selected=75001');
        const state = parseUrlState();
        expect(state.state).toBe('TX'); // normalized to uppercase
        expect(state.level).toBe('zip');
        expect(state.metric).toBe('homeValue');
        expect(state.selected).toBe('75001');
    });

    it('should update URL state correctly', () => {
        updateUrlState({
            state: 'WA',
            level: 'county',
            metric: 'rentValue',
            selected: '53033'
        });

        const params = new URLSearchParams(window.location.search);
        expect(params.get('state')).toBe('WA');
        expect(params.get('level')).toBe('county');
        expect(params.get('metric')).toBe('rentValue');
        expect(params.get('selected')).toBe('53033');
    });

    it('should delete parameters when not provided in updateState', () => {
        // Start with a state
        window.history.replaceState(null, '', '?state=TX&level=zip&metric=homeValue&selected=75001');
        
        // Update with subset
        updateUrlState({
            state: 'TX',
            level: 'county'
        });

        const params = new URLSearchParams(window.location.search);
        expect(params.get('state')).toBe('TX');
        expect(params.get('level')).toBe('county');
        expect(params.get('metric')).toBeNull();
        expect(params.get('selected')).toBeNull();
    });
});
