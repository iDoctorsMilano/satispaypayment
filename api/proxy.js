// api/proxy.js — Vercel Serverless Function
const https = require('https');

const PROXY_SECRET = process.env.PROXY_SECRET || '575277e45a420630d45a0f2f20573113e67446ec2c3d0a99312da54ca58cb56c';

// Risolve DNS tramite Google DoH (DNS over HTTPS) per aggirare ENOTFOUND
async function resolveHost(hostname) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: '8.8.8.8',
            path: `/resolve?name=${hostname}&type=A`,
            method: 'GET',
            headers: { 'Accept': 'application/dns-json' },
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const answer = (json.Answer || []).find(a => a.type === 1);
                    if (answer) resolve(answer.data);
                    else reject(new Error('No A record found for ' + hostname));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function httpsRequest(options, bodyData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (bodyData) req.write(bodyData);
        req.end();
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = req.headers['x-proxy-secret'];
    if (secret !== PROXY_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { method, endpoint, body, headers } = req.body;

    if (!endpoint || !method) {
        return res.status(400).json({ error: 'Missing method or endpoint' });
    }

    const headersObj = {};
    (headers || []).forEach(h => {
        const idx = h.indexOf(': ');
        if (idx > 0) {
            headersObj[h.substring(0, idx)] = h.substring(idx + 2);
        }
    });

    const bodyData = body || '';

    try {
        // Risolvi IP tramite Google DoH
        const ip = await resolveHost('api.satispay.com');

        const result = await httpsRequest({
            host: ip,
            port: 443,
            path: endpoint,
            method: method,
            servername: 'api.satispay.com',
            headers: {
                ...headersObj,
                'Host': 'api.satispay.com',
                'Content-Length': Buffer.byteLength(bodyData),
            },
        }, bodyData);

        res.status(result.statusCode);
        res.setHeader('Content-Type', 'application/json');
        res.end(result.body);

    } catch (err) {
        res.status(502).json({ error: 'Proxy error: ' + err.message });
    }
};
