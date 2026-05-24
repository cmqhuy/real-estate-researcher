// Color scale utilities
import { METRIC_DEFINITIONS } from './metrics';

export type MetricType = 'homeValue' | 'homeYoyGrowth' | 'homeFiveYearGrowth' | 'homeMomGrowth' 
    | 'rentValue' | 'rentYoyGrowth' | 'rentFiveYearGrowth' | 'rentMomGrowth' | 'homeDaysOnMarket'
    | 'homeValueForecast' | 'activeInventory' | 'newListings' | 'priceCutShare' | 'priceCutSize' 
    | 'salesCount' | 'medianSalePrice' | 'saleToListRatio' | 'pctSalesAboveList' | 'pctSalesBelowList' | 'rentPerSqft';

export type GeographicLevel = 'zip' | 'county' | 'metro' | 'state' | 'country';

// Color scale: Deep Blue -> Neutral/White -> Deep Red
const COLORS = {
    negative: [33, 102, 172] as [number, number, number], // #2166ac
    neutral: [247, 247, 247] as [number, number, number],   // #f7f7f7
    positive: [178, 24, 43] as [number, number, number]     // #b2182b
};

function interpolateColor(color1: [number, number, number], color2: [number, number, number], factor: number): string {
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
        result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    }
    return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
}

export function getColor(value: number | null, min: number, max: number, metric: MetricType, mid: number): string {
    if (value === null || value === undefined) return 'rgba(0,0,0,0)'; // Transparent if no data
    
    const def = METRIC_DEFINITIONS[metric];
    if (def && def.scaleType === 'sequential') {
        // 0 to max sequential scale (White -> Red)
        const maxVal = max || 1;
        const factor = Math.min(1, Math.max(0, value / maxVal));
        return interpolateColor(COLORS.neutral, COLORS.positive, factor);
    }

    if (def && def.scaleType === 'sequential-blue') {
        // 0 to max sequential scale (White -> Blue)
        const maxVal = max || 1;
        const factor = Math.min(1, Math.max(0, value / maxVal));
        return interpolateColor(COLORS.neutral, COLORS.negative, factor);
    }
    
    // Diverging scale (Blue -> White -> Red) centered around mid
    // Calculate ratio between min/mid or mid/max
    const ratio = value < mid 
        ? (value - min) / (mid - min || 1) 
        : (value - mid) / (max - mid || 1);
        
    if (value < mid) return interpolateColor(COLORS.negative, COLORS.neutral, Math.max(0, Math.min(1, ratio))); 
    return interpolateColor(COLORS.neutral, COLORS.positive, Math.max(0, Math.min(1, ratio))); 
}
