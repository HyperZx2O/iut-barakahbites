const http = require('http');
const PORT = process.env.PORT || 3003;
http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'stock-service' }));
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(PORT, () => console.log(`stock-service listening on ${PORT}`));
