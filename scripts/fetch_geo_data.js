import fs from 'fs';
import path from 'path';
import https from 'https';

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

// State mapping to match the OpenDataDE github repository filenames
const stateUrlMap = {
    "AL": "al_alabama",
    "AK": "ak_alaska",
    "AZ": "az_arizona",
    "AR": "ar_arkansas",
    "CA": "ca_california",
    "CO": "co_colorado",
    "CT": "ct_connecticut",
    "DE": "de_delaware",
    "DC": "dc_district_of_columbia",
    "FL": "fl_florida",
    "GA": "ga_georgia",
    "HI": "hi_hawaii",
    "ID": "id_idaho",
    "IL": "il_illinois",
    "IN": "in_indiana",
    "IA": "ia_iowa",
    "KS": "ks_kansas",
    "KY": "ky_kentucky",
    "LA": "la_louisiana",
    "ME": "me_maine",
    "MD": "md_maryland",
    "MA": "ma_massachusetts",
    "MI": "mi_michigan",
    "MN": "mn_minnesota",
    "MS": "ms_mississippi",
    "MO": "mo_missouri",
    "MT": "mt_montana",
    "NE": "ne_nebraska",
    "NV": "nv_nevada",
    "NH": "nh_new_hampshire",
    "NJ": "nj_new_jersey",
    "NM": "nm_new_mexico",
    "NY": "ny_new_york",
    "NC": "nc_north_carolina",
    "ND": "nd_north_dakota",
    "OH": "oh_ohio",
    "OK": "ok_oklahoma",
    "OR": "or_oregon",
    "PA": "pa_pennsylvania",
    "RI": "ri_rhode_island",
    "SC": "sc_south_carolina",
    "SD": "sd_south_dakota",
    "TN": "tn_tennessee",
    "TX": "tx_texas",
    "UT": "ut_utah",
    "VT": "vt_vermont",
    "VA": "va_virginia",
    "WA": "wa_washington",
    "WV": "wv_west_virginia",
    "WI": "wi_wisconsin",
    "WY": "wy_wyoming"
};

// Generate YYYYMMDD suffix
const dateObj = new Date();
const yyyymmdd = dateObj.getFullYear().toString() + 
                 String(dateObj.getMonth() + 1).padStart(2, '0') + 
                 String(dateObj.getDate()).padStart(2, '0');

async function downloadGeoJSON() {
    for (const state of manifest.supportedStates) {
        const repoStateCode = stateUrlMap[state];
        if (!repoStateCode) {
            console.warn(`Warning: No GeoJSON URL mapping found for state ${state}. Skipping.`);
            continue;
        }

        const url = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${repoStateCode}_zip_codes_geo.min.json`;
        const filename = `${state.toLowerCase()}_geodata_${yyyymmdd}.json`;
        const filepath = path.join(geodataDir, filename);

        console.log(`Downloading Geodata for ${state}...`);

        try {
            await new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }
                    const file = fs.createWriteStream(filepath);
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        
                        // Update manifest
                        manifest.geodataVersions[state] = yyyymmdd;
                        console.log(`Saved ${filename}`);
                        resolve();
                    });
                }).on('error', reject);
            });
        } catch (error) {
            console.error(`Failed to download Geodata for ${state}:`, error.message);
        }
    }

    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    console.log(`Updated manifest.json with latest Geodata version: ${yyyymmdd}`);
}

downloadGeoJSON();
