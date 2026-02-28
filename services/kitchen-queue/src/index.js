const http = require('http');
const PORT = process.env.PORT || 3004;
http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'kitchen-queue' }));
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(PORT, () => console.log(`kitchen-queue listening on ${PORT}`));
