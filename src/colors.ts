// Color scale utilities
export type MetricType = 'homeValue' | 'homeYoyGrowth' | 'homeFiveYearGrowth' | 'homeMomGrowth' 
    | 'rentValue' | 'rentYoyGrowth' | 'rentFiveYearGrowth' | 'rentMomGrowth' | 'homeDaysOnMarket' | 'rentDaysOnMarket';

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

export function getColor(value: number | null, min: number, max: number, metric: MetricType, nationalAvg: number): string {
    if (value === null || value === undefined) return 'rgba(0,0,0,0)'; // Transparent if no data
    
    const isDOM = metric === 'homeDaysOnMarket' || metric === 'rentDaysOnMarket';
    
    if (isDOM) {
        // 0 days = white, higher = more red. Clamp between 0 and 1.
        const maxVal = max || 45;
        const factor = Math.min(1, Math.max(0, value / maxVal));
        return interpolateColor(COLORS.neutral, COLORS.positive, factor);
    }

    const isAbsolute = metric === 'homeValue' || metric === 'rentValue';
    
    if (isAbsolute) {
        const mid = nationalAvg;
        // Calculate ratio between min/mid or mid/max
        const ratio = value < mid 
            ? (value - min) / (mid - min || 1) 
            : (value - mid) / (max - mid || 1);
            
        // Standard: higher is red, lower is blue
        if (value < mid) return interpolateColor(COLORS.negative, COLORS.neutral, Math.max(0, ratio)); 
        return interpolateColor(COLORS.neutral, COLORS.positive, Math.min(1, ratio)); 
    }
    
    // For growth metrics (centered around 0)
    if (value < 0) {
        const factor = (value - min) / (0 - min || 1);
        return interpolateColor(COLORS.negative, COLORS.neutral, factor);
    } else {
        // Interpolate between neutral and positive
        const range = max;
        if (range <= 0) return `rgb(${COLORS.neutral.join(',')})`;
        
        // factor 0 = neutral, factor 1 = positive
        const factor = value / (range || 1);
        return interpolateColor(COLORS.neutral, COLORS.positive, factor);
    }
}
