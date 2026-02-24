// api/proxy.js — Vercel Serverless Function (IP hardcoded per ENOTFOUND)
const https = require('https');

// IP di api.satispay.com per aggirare DNS ENOTFOUND su Vercel
const SATISPAY_IP = '34.107.141.107';

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
            host: SATISPAY_IP,
            port: 443,
            path: endpoint,
            method: method,
            servername: 'api.satispay.com',
            headers: {
                ...headersObj,
                'Host': 'api.satispay.com',
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
