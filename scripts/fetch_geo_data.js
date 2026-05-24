import fs from 'fs';
import path from 'path';
import https from 'https';
import simplify from '@turf/simplify';
import truncate from '@turf/truncate';

const dataDir = path.join(process.cwd(), 'public', 'data');
const geodataDir = path.join(dataDir, 'geodata');
const manifestFile = path.join(dataDir, 'manifest.json');

if (!fs.existsSync(geodataDir)) {
    fs.mkdirSync(geodataDir, { recursive: true });
}

if (!fs.existsSync(manifestFile)) {
    console.error('manifest.json not found. Run setup or create it first.');
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

// State mapping to match the OpenDataDE github repository filenames (for ZIP codes)
const stateUrlMap = {
    "AL": "al_alabama", "AK": "ak_alaska", "AZ": "az_arizona", "AR": "ar_arkansas", "CA": "ca_california",
    "CO": "co_colorado", "CT": "ct_connecticut", "DE": "de_delaware", "DC": "dc_district_of_columbia", "FL": "fl_florida",
    "GA": "ga_georgia", "HI": "hi_hawaii", "ID": "id_idaho", "IL": "il_illinois", "IN": "in_indiana",
    "IA": "ia_iowa", "KS": "ks_kansas", "KY": "ky_kentucky", "LA": "la_louisiana", "ME": "me_maine",
    "MD": "md_maryland", "MA": "ma_massachusetts", "MI": "mi_michigan", "MN": "mn_minnesota", "MS": "ms_mississippi",
    "MO": "mo_missouri", "MT": "mt_montana", "NE": "ne_nebraska", "NV": "nv_nevada", "NH": "nh_new_hampshire",
    "NJ": "nj_new_jersey", "NM": "nm_new_mexico", "NY": "ny_new_york", "NC": "nc_north_carolina", "ND": "nd_north_dakota",
    "OH": "oh_ohio", "OK": "ok_oklahoma", "OR": "or_oregon", "PA": "pa_pennsylvania", "RI": "ri_rhode_island",
    "SC": "sc_south_carolina", "SD": "sd_south_dakota", "TN": "tn_tennessee", "TX": "tx_texas", "UT": "ut_utah",
    "VT": "vt_vermont", "VA": "va_virginia", "WA": "wa_washington", "WV": "wv_west_virginia", "WI": "wi_wisconsin",
    "WY": "wy_wyoming"
};

const stateInfo = {
    "AL": { name: "Alabama", fips: "01" }, "AK": { name: "Alaska", fips: "02" }, "AZ": { name: "Arizona", fips: "04" },
    "AR": { name: "Arkansas", fips: "05" }, "CA": { name: "California", fips: "06" }, "CO": { name: "Colorado", fips: "08" },
    "CT": { name: "Connecticut", fips: "09" }, "DE": { name: "Delaware", fips: "10" }, "DC": { name: "District of Columbia", fips: "11" },
    "FL": { name: "Florida", fips: "12" }, "GA": { name: "Georgia", fips: "13" }, "HI": { name: "Hawaii", fips: "15" },
    "ID": { name: "Idaho", fips: "16" }, "IL": { name: "Illinois", fips: "17" }, "IN": { name: "Indiana", fips: "18" },
    "IA": { name: "Iowa", fips: "19" }, "KS": { name: "Kansas", fips: "20" }, "KY": { name: "Kentucky", fips: "21" },
    "LA": { name: "Louisiana", fips: "22" }, "ME": { name: "Maine", fips: "23" }, "MD": { name: "Maryland", fips: "24" },
    "MA": { name: "Massachusetts", fips: "25" }, "MI": { name: "Michigan", fips: "26" }, "MN": { name: "Minnesota", fips: "27" },
    "MS": { name: "Mississippi", fips: "28" }, "MO": { name: "Missouri", fips: "29" }, "MT": { name: "Montana", fips: "30" },
    "NE": { name: "Nebraska", fips: "31" }, "NV": { name: "Nevada", fips: "32" }, "NH": { name: "New Hampshire", fips: "33" },
    "NJ": { name: "New Jersey", fips: "34" }, "NM": { name: "New Mexico", fips: "35" }, "NY": { name: "New York", fips: "36" },
    "NC": { name: "North Carolina", fips: "37" }, "ND": { name: "North Dakota", fips: "38" }, "OH": { name: "Ohio", fips: "39" },
    "OK": { name: "Oklahoma", fips: "40" }, "OR": { name: "Oregon", fips: "41" }, "PA": { name: "Pennsylvania", fips: "42" },
    "RI": { name: "Rhode Island", fips: "44" }, "SC": { name: "South Carolina", fips: "45" }, "SD": { name: "South Dakota", fips: "46" },
    "TN": { name: "Tennessee", fips: "47" }, "TX": { name: "Texas", fips: "48" }, "UT": { name: "Utah", fips: "49" },
    "VT": { name: "Vermont", fips: "50" }, "VA": { name: "Virginia", fips: "51" }, "WA": { name: "Washington", fips: "53" },
    "WV": { name: "West Virginia", fips: "54" }, "WI": { name: "Wisconsin", fips: "55" }, "WY": { name: "Wyoming", fips: "56" }
};

// Generate YYYYMMDD suffix
const dateObj = new Date();
const yyyymmdd = dateObj.getFullYear().toString() + 
                 String(dateObj.getMonth() + 1).padStart(2, '0') + 
                 String(dateObj.getDate()).padStart(2, '0');

// Properties to preserve per geographic level (everything else is stripped)
const KEEP_PROPERTIES = {
    zip:     ['ZCTA5CE10', 'ZCTA5CE20'],
    county:  ['STATE', 'COUNTY', 'NAME', 'GEO_ID'],
    metro:   ['NAME', 'GEOID'],
    state:   ['name', 'density'],
    country: ['name', 'density']
};

// Tolerance for geometry simplification per geographic level
// zip: 0.000015 degrees yields ~50% file size reduction (from ~76MB to ~38MB) with high fidelity
const TOLERANCES = {
    zip:     0.000015,
    county:  0.00001,
    metro:   0.00001,
    state:   0.00001,
    country: 0.00001
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to fetch ${url}: HTTP ${res.statusCode}`));
            }
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Simplify GeoJSON geometry and strip unnecessary properties before saving.
 * - Douglas-Peucker simplification (custom tolerance per level)
 * - Coordinate truncation to 5 decimal places (~1.1m accuracy)
 * - Property stripping to keep only the region identifier keys
 */
function simplifyAndSaveGeoJSON(filepath, geojson, level) {
    const keysToKeep = KEEP_PROPERTIES[level] || [];
    const tolerance = TOLERANCES[level] || 0.00001;

    // Apply simplification and truncation to the entire FeatureCollection
    let simplified;
    try {
        simplified = simplify(geojson, { tolerance, highQuality: true });
        simplified = truncate(simplified, { precision: 5, coordinates: 2 });
    } catch (e) {
        // Fallback: if turf fails on a non-standard geometry, just truncate coordinates manually
        console.warn(`  ⚠ Simplification failed for ${path.basename(filepath)}, falling back to raw save: ${e.message}`);
        simplified = geojson;
    }

    // Strip unnecessary properties from each feature
    if (simplified.features) {
        for (const feature of simplified.features) {
            if (feature.properties) {
                const kept = {};
                for (const key of keysToKeep) {
                    if (feature.properties[key] !== undefined) {
                        kept[key] = feature.properties[key];
                    }
                }
                feature.properties = kept;
            }
        }
    }

    fs.writeFileSync(filepath, JSON.stringify(simplified));
    const sizeMB = (fs.statSync(filepath).size / (1024 * 1024)).toFixed(2);
    console.log(`    → Saved ${path.basename(filepath)} (${sizeMB} MB)`);
}

async function downloadGeoJSON() {
    try {
        console.log("Downloading national US boundary files (States, Counties, CBSAs)...");
        
        // 1. States GeoJSON
        const statesData = await fetchJSON('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json');
        
        // 2. Counties GeoJSON
        const countiesData = await fetchJSON('https://raw.githubusercontent.com/hillt5/DATA608/main/Final%20Project/gz_2010_us_050_00_20m.json');
        
        // 3. Metros/CBSA GeoJSON
        const metrosData = await fetchJSON('https://raw.githubusercontent.com/JeffreyMFarley/us-shapes/master/2015-cbsa.geojson');

        for (const state of manifest.supportedStates) {
            const info = stateInfo[state];
            if (!info) {
                console.warn(`Warning: No mapping found for state ${state}. Skipping.`);
                continue;
            }

            console.log(`Processing boundaries for ${state}...`);

            // --- COUNTRY LEVEL BOUNDARY ---
            // Save the entire US States GeoJSON as country geodata
            const countryFile = `${state.toLowerCase()}_country_geodata_${yyyymmdd}.json`;
            console.log(`  - Processing country boundaries...`);
            simplifyAndSaveGeoJSON(path.join(geodataDir, countryFile), statesData, 'country');

            // --- STATE LEVEL BOUNDARY ---
            // Filter statesData to only include the active state
            const stateFeatures = statesData.features.filter(f => f.properties.name === info.name);
            const stateGeoJSON = {
                type: "FeatureCollection",
                features: stateFeatures
            };
            const stateFile = `${state.toLowerCase()}_state_geodata_${yyyymmdd}.json`;
            console.log(`  - Processing state boundary...`);
            simplifyAndSaveGeoJSON(path.join(geodataDir, stateFile), stateGeoJSON, 'state');

            // --- COUNTY LEVEL BOUNDARIES ---
            // Filter countiesData by properties.STATE === FIPS code
            const countyFeatures = countiesData.features.filter(f => f.properties.STATE === info.fips);
            const countyGeoJSON = {
                type: "FeatureCollection",
                features: countyFeatures
            };
            const countyFile = `${state.toLowerCase()}_county_geodata_${yyyymmdd}.json`;
            console.log(`  - Processing county boundaries...`);
            simplifyAndSaveGeoJSON(path.join(geodataDir, countyFile), countyGeoJSON, 'county');

            // --- METRO LEVEL BOUNDARIES ---
            // Filter metrosData. features where cleaned NAME ends with `, TX`
            const metroFeatures = metrosData.features.filter(f => {
                const name = f.properties.NAME || '';
                // Check if metro is in state (e.g. ends with ", TX Metro Area" or contains ", TX-")
                const cleaned = name.replace(/\s+(Metro|Micro)\s+Area$/i, '').trim();
                const parts = cleaned.split(',');
                if (parts.length < 2) return false;
                const stateParts = parts[1].split('-').map(s => s.trim());
                return stateParts.includes(state);
            });
            const metroGeoJSON = {
                type: "FeatureCollection",
                features: metroFeatures
            };
            const metroFile = `${state.toLowerCase()}_metro_geodata_${yyyymmdd}.json`;
            console.log(`  - Processing metro boundaries...`);
            simplifyAndSaveGeoJSON(path.join(geodataDir, metroFile), metroGeoJSON, 'metro');

            // --- ZIP LEVEL BOUNDARIES ---
            // Fetch ZIP codes from OpenDataDE
            const repoStateCode = stateUrlMap[state];
            if (repoStateCode) {
                const zipUrl = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${repoStateCode}_zip_codes_geo.min.json`;
                console.log(`  - Downloading ZIP codes from OpenDataDE...`);
                try {
                    const zipGeoJSON = await fetchJSON(zipUrl);
                    const zipFile = `${state.toLowerCase()}_zip_geodata_${yyyymmdd}.json`;
                    console.log(`  - Processing ZIP boundaries (this may take a moment)...`);
                    simplifyAndSaveGeoJSON(path.join(geodataDir, zipFile), zipGeoJSON, 'zip');
                } catch (err) {
                    console.error(`  - Failed to download ZIP codes: ${err.message}`);
                }
            }

            manifest.geodataVersions[state] = yyyymmdd;
        }

        fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
        console.log(`Updated manifest.json with latest Geodata version: ${yyyymmdd}`);

    } catch (error) {
        console.error("Failed to download/filter Geodata:", error);
    }
}

downloadGeoJSON();
