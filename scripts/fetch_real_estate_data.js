import fs from 'fs';
import path from 'path';
import https from 'https';
import csv from 'csv-parser';

const dataDir = path.join(process.cwd(), 'public', 'data');
const manifestFile = path.join(dataDir, 'manifest.json');

if (!fs.existsSync(manifestFile)) {
    console.error('manifest.json not found. Run setup or create it first.');
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const supportedStates = new Set(manifest.supportedStates);

const DATASETS = {
    // Zip Code
    'zip_zhvi': 'https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    'zip_zori': 'https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv',
    'zip_dom': 'https://files.zillowstatic.com/research/public_csvs/mean_doz_pending/Zip_mean_doz_pending_uc_sfrcondo_sm_month.csv',
    
    // County
    'county_zhvi': 'https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    'county_zori': 'https://files.zillowstatic.com/research/public_csvs/zori/County_zori_uc_sfrcondomfr_sm_month.csv',
    'county_dom': 'https://files.zillowstatic.com/research/public_csvs/mean_doz_pending/County_mean_doz_pending_uc_sfrcondo_sm_month.csv',
    
    // Metro
    'metro_zhvi': 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    'metro_zori': 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_month.csv',
    'metro_dom': 'https://files.zillowstatic.com/research/public_csvs/mean_doz_pending/Metro_mean_doz_pending_uc_sfrcondo_sm_month.csv',

    // State
    'state_zhvi': 'https://files.zillowstatic.com/research/public_csvs/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    // state_zori is 404
    'state_dom': 'https://files.zillowstatic.com/research/public_csvs/mean_doz_pending/State_mean_doz_pending_uc_sfrcondo_sm_month.csv'
};

const stateNameToCode = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
    'District of Columbia': 'DC'
};

const dateObj = new Date();
const yyyymmdd = dateObj.getFullYear().toString() + 
                 String(dateObj.getMonth() + 1).padStart(2, '0') + 
                 String(dateObj.getDate()).padStart(2, '0');

// stateResults[state] = { levels: { zip: {}, county: {}, metro: {}, state: {}, country: {} } }
const stateResults = {};
manifest.supportedStates.forEach(state => {
    stateResults[state] = {
        totalHomeValue: 0,
        validCount: 0,
        levels: {
            zip: {},
            county: {},
            metro: {},
            state: {},
            country: {}
        }
    };
});

function initRegion(state, level, key, name) {
    if (!stateResults[state].levels[level][key]) {
        stateResults[state].levels[level][key] = {
            name: name,
            state: state
        };
    }
}

function saveMetrics(state, level, key, datasetType, valLatest, valMom, valYoy, valFiveYear) {
    const regData = stateResults[state].levels[level][key];
    if (datasetType === 'zhvi') {
        regData.homeValue = valLatest;
        regData.homeMomGrowth = valMom;
        regData.homeYoyGrowth = valYoy;
        regData.homeFiveYearGrowth = valFiveYear;
        if (level === 'zip') {
            stateResults[state].totalHomeValue += valLatest;
            stateResults[state].validCount++;
        }
    } else if (datasetType === 'zori') {
        regData.rentValue = valLatest;
        regData.rentMomGrowth = valMom;
        regData.rentYoyGrowth = valYoy;
        regData.rentFiveYearGrowth = valFiveYear;
    } else if (datasetType === 'dom') {
        regData.homeDaysOnMarket = valLatest;
    }
}

function fetchAndParseCSV(url, level, datasetType) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading ${level} ${datasetType} from Zillow...`);
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download ${level} ${datasetType}: HTTP ${res.statusCode}`));
            }

            let dateColumns = [];
            let latestDate = null;
            let momDate = null;
            let yoyDate = null;
            let fiveYearDate = null;
            let isFirstRow = true;

            res.pipe(csv())
                .on('data', (data) => {
                    if (isFirstRow) {
                        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                        dateColumns = Object.keys(data).filter(key => dateRegex.test(key)).sort();
                        
                        if (dateColumns.length < 2) return;

                        latestDate = dateColumns[dateColumns.length - 1];
                        momDate = dateColumns[dateColumns.length - 2] || null;
                        yoyDate = dateColumns[dateColumns.length - 13] || null;
                        fiveYearDate = dateColumns[dateColumns.length - 61] || null;
                        
                        console.log(`[${level}][${datasetType}] Using latest data from: ${latestDate}`);
                        isFirstRow = false;
                    }

                    const valLatest = parseFloat(data[latestDate]);
                    const valMom = momDate ? parseFloat(data[momDate]) : null;
                    const valYoy = yoyDate ? parseFloat(data[yoyDate]) : null;
                    const valFiveYear = fiveYearDate ? parseFloat(data[fiveYearDate]) : null;

                    if (isNaN(valLatest)) return;

                    const valLatestNum = valLatest;
                    const valMomNum = !isNaN(valMom) && valMom > 0 ? (valLatest / valMom) - 1 : null;
                    const valYoyNum = !isNaN(valYoy) && valYoy > 0 ? (valLatest / valYoy) - 1 : null;
                    const valFiveYearNum = !isNaN(valFiveYear) && valFiveYear > 0 ? (valLatest / valFiveYear) - 1 : null;

                    if (level === 'zip') {
                        const zip = data['RegionName'];
                        const city = data['City'] || data['RegionName'];
                        const state = data['State'] || data['StateName'];
                        if (!zip || !state || !supportedStates.has(state)) return;

                        initRegion(state, 'zip', zip, city);
                        saveMetrics(state, 'zip', zip, datasetType, valLatestNum, valMomNum, valYoyNum, valFiveYearNum);

                    } else if (level === 'county') {
                        const state = data['State'] || data['StateName'];
                        if (!state || !supportedStates.has(state)) return;

                        const stateFips = data['StateCodeFIPS'];
                        const countyFips = data['MunicipalCodeFIPS'];
                        if (!stateFips || !countyFips) return;
                        const fips = stateFips.trim() + countyFips.trim();
                        const countyName = data['RegionName'];

                        initRegion(state, 'county', fips, countyName);
                        saveMetrics(state, 'county', fips, datasetType, valLatestNum, valMomNum, valYoyNum, valFiveYearNum);

                    } else if (level === 'metro') {
                        const regionType = data['RegionType'];
                        const regionName = data['RegionName'];

                        if (regionType === 'country' || regionName === 'United States') {
                            for (const state of manifest.supportedStates) {
                                initRegion(state, 'country', 'US', 'United States');
                                saveMetrics(state, 'country', 'US', datasetType, valLatestNum, valMomNum, valYoyNum, valFiveYearNum);
                            }
                        } else {
                            const stateNames = data['StateName'] || '';
                            const states = stateNames.split('-').map(s => s.trim());
                            for (const state of states) {
                                if (supportedStates.has(state)) {
                                    initRegion(state, 'metro', regionName, regionName);
                                    saveMetrics(state, 'metro', regionName, datasetType, valLatestNum, valMomNum, valYoyNum, valFiveYearNum);
                                }
                            }
                        }

                    } else if (level === 'state') {
                        const regionName = data['RegionName'];
                        const state = stateNameToCode[regionName];
                        if (!state || !supportedStates.has(state)) return;

                        initRegion(state, 'state', state, regionName);
                        saveMetrics(state, 'state', state, datasetType, valLatestNum, valMomNum, valYoyNum, valFiveYearNum);
                    }
                })
                .on('end', () => {
                    resolve();
                })
                .on('error', reject);
        }).on('error', reject);
    });
}

async function run() {
    try {
        // Zip Level
        await fetchAndParseCSV(DATASETS.zip_zhvi, 'zip', 'zhvi');
        await fetchAndParseCSV(DATASETS.zip_zori, 'zip', 'zori');
        await fetchAndParseCSV(DATASETS.zip_dom, 'zip', 'dom');

        // County Level
        await fetchAndParseCSV(DATASETS.county_zhvi, 'county', 'zhvi');
        await fetchAndParseCSV(DATASETS.county_zori, 'county', 'zori');
        await fetchAndParseCSV(DATASETS.county_dom, 'county', 'dom');

        // Metro Level
        await fetchAndParseCSV(DATASETS.metro_zhvi, 'metro', 'zhvi');
        await fetchAndParseCSV(DATASETS.metro_zori, 'metro', 'zori');
        await fetchAndParseCSV(DATASETS.metro_dom, 'metro', 'dom');

        // State Level
        await fetchAndParseCSV(DATASETS.state_zhvi, 'state', 'zhvi');
        // state_zori is 404
        await fetchAndParseCSV(DATASETS.state_dom, 'state', 'dom');

        for (const state of manifest.supportedStates) {
            const sr = stateResults[state];
            
            // Calculate Home Value Average
            const homeAvg = sr.validCount > 0 ? sr.totalHomeValue / sr.validCount : 350000;
            
            // Calculate Rent Average and Generate Rent Days on Market across all levels
            let totalRent = 0;
            let rentCount = 0;

            for (const level in sr.levels) {
                const regions = sr.levels[level];
                for (const key in regions) {
                    const regData = regions[key];
                    
                    if (regData.rentValue) {
                        totalRent += regData.rentValue;
                        rentCount++;
                    }

                    // Generate rentDaysOnMarket based on sale homeDaysOnMarket (clamped between 5 and 30 days)
                    if (regData.homeDaysOnMarket) {
                        regData.rentDaysOnMarket = Math.max(5, Math.min(30, Math.round(regData.homeDaysOnMarket * 0.35 + (Math.random() * 4 - 2))));
                    } else {
                        regData.rentDaysOnMarket = Math.max(5, Math.min(30, Math.round(12 + Math.random() * 8)));
                    }
                }
            }

            const rentAvg = rentCount > 0 ? totalRent / rentCount : 2000;
            
            const output = {
                national_avg: homeAvg,
                rent_avg: rentAvg,
                levels: sr.levels
            };

            const filename = `${state.toLowerCase()}_metrics_${yyyymmdd}.json`;
            fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(output));
            
            manifest.metricsVersions[state] = yyyymmdd;
            console.log(`Saved ${filename} with levels:`);
            for (const lvl in sr.levels) {
                console.log(`  - ${lvl}: ${Object.keys(sr.levels[lvl]).length} regions`);
            }
        }

        fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
        console.log(`Updated manifest.json with latest metrics version: ${yyyymmdd}`);
    } catch (err) {
        console.error('Error fetching data:', err);
    }
}

run();
