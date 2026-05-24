import type { MetricType, GeographicLevel } from './colors';

export interface MetricDefinition {
    key: MetricType;
    title: string;
    description: string;
    icon: string;
    category: 'home' | 'market' | 'investor';
    scaleType: 'sequential' | 'sequential-blue' | 'diverging';
    format: 'currency' | 'currency-cents' | 'percent' | 'percent-raw' | 'days' | 'count';
    midpointType: 'national-avg' | 'rent-avg' | 'rent-sqft-avg' | 'zero' | 'one' | 'level-mean';
    supportedLevels: GeographicLevel[];
}

export const METRIC_DEFINITIONS: Record<MetricType, MetricDefinition> = {
    homeValue: {
        key: 'homeValue',
        title: 'Home Value',
        description: 'Typical home value - smoothed, seasonally adjusted index.',
        icon: '🏠',
        category: 'home',
        scaleType: 'diverging',
        format: 'currency',
        midpointType: 'national-avg',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    homeYoyGrowth: {
        key: 'homeYoyGrowth',
        title: 'Home Value Growth (YoY)',
        description: 'Year-over-year typical home value growth.',
        icon: '📅',
        category: 'home',
        scaleType: 'diverging',
        format: 'percent',
        midpointType: 'zero',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    homeFiveYearGrowth: {
        key: 'homeFiveYearGrowth',
        title: 'Home Value Growth (5-Year)',
        description: '5-year cumulative typical home value growth.',
        icon: '📈',
        category: 'home',
        scaleType: 'diverging',
        format: 'percent',
        midpointType: 'zero',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    homeMomGrowth: {
        key: 'homeMomGrowth',
        title: 'Home Value Growth (MoM)',
        description: 'Month-over-month typical home value growth.',
        icon: '📆',
        category: 'home',
        scaleType: 'diverging',
        format: 'percent',
        midpointType: 'zero',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    homeValueForecast: {
        key: 'homeValueForecast',
        title: 'Home Value Forecast (1-Year)',
        description: '1-year forecast of home value growth.',
        icon: '🔮',
        category: 'home',
        scaleType: 'diverging',
        format: 'percent-raw',
        midpointType: 'zero',
        supportedLevels: ['zip', 'metro']
    },
    homeDaysOnMarket: {
        key: 'homeDaysOnMarket',
        title: 'Days on Market',
        description: 'Average days from listing to pending (this month).',
        icon: '⏱️',
        category: 'home',
        scaleType: 'sequential',
        format: 'days',
        midpointType: 'level-mean',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    rentValue: {
        key: 'rentValue',
        title: 'Monthly Rent',
        description: 'Typical monthly rent index - smoothed.',
        icon: '💵',
        category: 'investor',
        scaleType: 'diverging',
        format: 'currency',
        midpointType: 'rent-avg',
        supportedLevels: ['zip', 'county', 'metro', 'country']
    },
    rentYoyGrowth: {
        key: 'rentYoyGrowth',
        title: 'Rent Growth (YoY)',
        description: 'Year-over-year typical rent index growth.',
        icon: '📅',
        category: 'investor',
        scaleType: 'diverging',
        format: 'percent',
        midpointType: 'zero',
        supportedLevels: ['zip', 'county', 'metro', 'country']
    },
    rentFiveYearGrowth: {
        key: 'rentFiveYearGrowth',
        title: 'Rent Growth (5-Year)',
        description: '5-year cumulative typical rent index growth.',
        icon: '📊',
        category: 'investor',
        scaleType: 'diverging',
        format: 'percent',
        midpointType: 'zero',
        supportedLevels: ['zip', 'county', 'metro', 'country']
    },
    rentMomGrowth: {
        key: 'rentMomGrowth',
        title: 'Rent Growth (MoM)',
        description: 'Month-over-month typical rent index growth.',
        icon: '📆',
        category: 'investor',
        scaleType: 'diverging',
        format: 'percent',
        midpointType: 'zero',
        supportedLevels: ['zip', 'county', 'metro', 'country']
    },
    rentPerSqft: {
        key: 'rentPerSqft',
        title: 'Rent per Square Foot',
        description: 'Typical monthly rent normalized per square foot.',
        icon: '📐',
        category: 'investor',
        scaleType: 'sequential',
        format: 'currency-cents',
        midpointType: 'rent-sqft-avg',
        supportedLevels: ['zip', 'county', 'metro', 'country']
    },
    activeInventory: {
        key: 'activeInventory',
        title: 'Active Inventory',
        description: 'Number of active listings at the end of the month.',
        icon: '📦',
        category: 'market',
        scaleType: 'sequential',
        format: 'count',
        midpointType: 'level-mean',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    newListings: {
        key: 'newListings',
        title: 'New Listings',
        description: 'Number of new listings added during the month.',
        icon: '🆕',
        category: 'market',
        scaleType: 'sequential',
        format: 'count',
        midpointType: 'level-mean',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    priceCutShare: {
        key: 'priceCutShare',
        title: 'Share of Listings with Price Cuts',
        description: 'Share of active listings receiving a price cut during the month.',
        icon: '✂️',
        category: 'market',
        scaleType: 'sequential',
        format: 'percent',
        midpointType: 'level-mean',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    priceCutSize: {
        key: 'priceCutSize',
        title: 'Median Price Cut Size',
        description: 'Median percentage discount among listings with price cuts.',
        icon: '📉',
        category: 'market',
        scaleType: 'sequential',
        format: 'percent',
        midpointType: 'level-mean',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    salesCount: {
        key: 'salesCount',
        title: 'Sales Count',
        description: 'Number of homes sold during the month.',
        icon: '📊',
        category: 'market',
        scaleType: 'sequential',
        format: 'count',
        midpointType: 'level-mean',
        supportedLevels: ['metro']
    },
    medianSalePrice: {
        key: 'medianSalePrice',
        title: 'Median Sale Price',
        description: 'Median transaction price of homes sold during the month.',
        icon: '💵',
        category: 'market',
        scaleType: 'diverging',
        format: 'currency',
        midpointType: 'national-avg',
        supportedLevels: ['metro']
    },
    saleToListRatio: {
        key: 'saleToListRatio',
        title: 'Sale-to-List Ratio',
        description: 'Median ratio of final sale price to original list price.',
        icon: '⚖️',
        category: 'market',
        scaleType: 'diverging',
        format: 'percent',
        midpointType: 'one',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    pctSalesAboveList: {
        key: 'pctSalesAboveList',
        title: 'Percent of Sales Above List',
        description: 'Percentage of homes sold above their initial listing price.',
        icon: '🔺',
        category: 'market',
        scaleType: 'sequential',
        format: 'percent',
        midpointType: 'level-mean',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    },
    pctSalesBelowList: {
        key: 'pctSalesBelowList',
        title: 'Percent of Sales Below List',
        description: 'Percentage of homes sold below their initial listing price.',
        icon: '🔻',
        category: 'market',
        scaleType: 'sequential-blue',
        format: 'percent',
        midpointType: 'level-mean',
        supportedLevels: ['zip', 'county', 'metro', 'state', 'country']
    }
};

export function formatMetricValue(value: number | null, metricKey: MetricType, shortForm = false): string {
    if (value === null || value === undefined || isNaN(value)) {
        return 'N/A';
    }

    const def = METRIC_DEFINITIONS[metricKey];
    if (!def) return value.toString();

    switch (def.format) {
        case 'currency':
            if (shortForm) {
                if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
                return '$' + Math.round(value).toLocaleString('en-US');
            }
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0
            }).format(value);

        case 'currency-cents':
            if (shortForm) {
                return '$' + value.toFixed(2);
            }
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);

        case 'percent':
        case 'percent-raw': {
            const isRaw = def.format === 'percent-raw';
            const multiplier = isRaw ? 1 : 100;
            const finalVal = value * multiplier;
            const formatted = finalVal.toFixed(1) + '%';
            
            const isGrowth = def.key.includes('Growth') || def.key === 'homeValueForecast';
            if (isGrowth && finalVal > 0) {
                return '+' + formatted;
            }
            return formatted;
        }

        case 'days':
            return `${Math.round(value)} days`;

        case 'count':
            if (shortForm) {
                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
                return Math.round(value).toString();
            }
            return Math.round(value).toLocaleString('en-US');

        default:
            return value.toString();
    }
}

export function getMetricMidpoint(metricKey: MetricType, nationalAvg: number, rentAvg: number, levelVals: number[]): number {
    const def = METRIC_DEFINITIONS[metricKey];
    if (!def) return 0;

    switch (def.midpointType) {
        case 'national-avg':
            return nationalAvg;
        case 'rent-avg':
            return rentAvg;
        case 'rent-sqft-avg':
            return rentAvg / 1200;
        case 'zero':
            return 0.0;
        case 'one':
            return 1.0;
        case 'level-mean':
            return levelVals.length > 0 ? levelVals.reduce((sum, v) => sum + v, 0) / levelVals.length : 0.0;
        default:
            return 0;
    }
}

export function isMetricSupportedAtLevel(metricKey: MetricType, level: GeographicLevel): boolean {
    const def = METRIC_DEFINITIONS[metricKey];
    return def ? def.supportedLevels.includes(level) : false;
}
