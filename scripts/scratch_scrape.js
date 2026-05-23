import https from 'https';
import csv from 'csv-parser';

function fetchFirstRows(url, name) {
    return new Promise((resolve) => {
        console.log(`\n--- Fetching first rows of ${name} ---`);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                console.error(`Error: HTTP ${res.statusCode}`);
                resolve();
                return;
            }
            let count = 0;
            res.pipe(csv())
                .on('data', (row) => {
                    if (count < 3) {
                        console.log(JSON.stringify(row, null, 2));
                        count++;
                    } else {
                        res.destroy(); // stop reading
                    }
                })
                .on('close', () => {
                    resolve();
                })
                .on('error', (err) => {
                    console.error("CSV Parse Error:", err.message);
                    resolve();
                });
        }).on('error', (err) => {
            console.error("HTTP Error:", err.message);
            resolve();
        });
    });
}

async function run() {
    await fetchFirstRows('https://files.zillowstatic.com/research/public_csvs/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'State ZHVI');
    await fetchFirstRows('https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'Metro ZHVI');
    await fetchFirstRows('https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'County ZHVI');
    await fetchFirstRows('https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv', 'City ZHVI');
}

run();
