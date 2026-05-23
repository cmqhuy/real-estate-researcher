import https from 'https';

https.get('https://www.zillow.com/research/data/', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const regex = /href="(https:\/\/files\.zillowstatic\.com\/[^"]+zip[^"]+\.csv)"/gi;
        let match;
        const urls = new Set();
        while ((match = regex.exec(data)) !== null) {
            urls.add(match[1]);
        }
        console.log("ZIP Code CSV URLs found on Zillow:");
        urls.forEach(url => console.log(url));
    });
}).on('error', err => console.error(err));
