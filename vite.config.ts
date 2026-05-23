import { defineConfig } from 'vite';
import { exec } from 'child_process';

export default defineConfig({
  plugins: [
    {
      name: 'data-refresh-plugin',
      configureServer(server) {
        server.middlewares.use('/api/refresh-data', (req, res) => {
          if (req.method === 'GET') {
            console.log('Running data fetch scripts...');
            // Set longer timeout if necessary, but default is fine.
            exec('npm run fetch-real-estate-data && npm run fetch-geo-data', (error, stdout, stderr) => {
              if (error) {
                console.error(`Error fetching data: ${error.message}`);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message }));
                return;
              }
              if (stderr) {
                console.error(`stderr: ${stderr}`);
              }
              console.log(`stdout: ${stdout}`);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            });
          } else {
            res.statusCode = 405; // Method Not Allowed
            res.end();
          }
        });
      }
    }
  ]
});
