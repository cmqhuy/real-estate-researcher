import https from 'https';

https.get('https://raw.githubusercontent.com/JeffreyMFarley/us-shapes/master/2015-cbsa.geojson', (res) => {
    let data = '';
    res.on('data', chunk => {
        data += chunk;
        if (data.length > 200000) {
            res.destroy();
        }
    });
    res.on('close', () => {
        try {
            const parsed = JSON.parse(data.slice(0, data.lastIndexOf('}') + 1) + ']}');
            // Or let's just find the properties keys in the first feature
            const match = data.match(/"properties":\s*\{([^}]+)\}/);
            if (match) {
                console.log("Properties keys and values:");
                console.log("{" + match[1] + "}");
            }
        } catch (e) {
            // snippet parsing failed, let's regex
            const match = data.match(/"properties":\s*\{([^}]+)\}/);
            if (match) {
                console.log("Properties keys and values (regex):");
                console.log("{" + match[1] + "}");
            }
        }
    });
});
