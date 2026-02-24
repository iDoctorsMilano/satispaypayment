// api/proxy.js — Vercel Serverless Function
const https = require('https');

const PROXY_SECRET = process.env.PROXY_SECRET || '575277e45a420630d45a0f2f20573113e67446ec2c3d0a99312da54ca58cb56c';

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

    // Converti array ["Header: value"] in oggetto { Header: value }
    const headersObj = {};
    (headers || []).forEach(h => {
        const idx = h.indexOf(': ');
        if (idx > 0) {
            headersObj[h.substring(0, idx)] = h.substring(idx + 2);
        }
    });

    const bodyData = body || '';

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.satispay.com',
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                ...headersObj,
                'Content-Length': Buffer.byteLength(bodyData),
            },
        };

        const satispayReq = https.request(options, (satispayRes) => {
            let data = '';
            satispayRes.on('data', chunk => { data += chunk; });
            satispayRes.on('end', () => {
                res.status(satispayRes.statusCode);
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
                resolve();
            });
        });

        satispayReq.on('error', (err) => {
            res.status(502).json({ error: 'Proxy error: ' + err.message });
            resolve();
        });

        if (bodyData) {
            satispayReq.write(bodyData);
        }
        satispayReq.end();
    });
};
