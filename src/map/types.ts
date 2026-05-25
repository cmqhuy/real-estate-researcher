
export interface RegionMetrics {
    homeValue?: number;
    homeYoyGrowth?: number;
    homeFiveYearGrowth?: number;
    homeMomGrowth?: number;
    rentValue?: number;
    rentYoyGrowth?: number;
    rentFiveYearGrowth?: number;
    rentMomGrowth?: number;
    homeDaysOnMarket?: number;
    homeValueForecast?: number;
    activeInventory?: number;
    newListings?: number;
    priceCutShare?: number;
    priceCutSize?: number;
    salesCount?: number;
    medianSalePrice?: number;
    saleToListRatio?: number;
    pctSalesAboveList?: number;
    pctSalesBelowList?: number;
    rentPerSqft?: number;
    name: string;
    state: string;
}

export interface ManifestData {
    supportedStates: string[];
    metricsVersions: Record<string, string>;
    geodataVersions: Record<string, string>;
    averages?: Record<string, { homeValue: number; rentValue: number }>;
}

export interface ScaleBounds {
    min: number;
    max: number;
    mid: number;
}
