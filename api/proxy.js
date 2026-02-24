// api/proxy.js — Vercel Serverless Function
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

    try {
        const satispayRes = await fetch('https://api.satispay.com' + endpoint, {
            method: method,
            headers: Object.fromEntries(
                (headers || []).map(h => {
                    const idx = h.indexOf(': ');
                    return [h.substring(0, idx), h.substring(idx + 2)];
                })
            ),
            body: body || undefined,
        });

        const responseText = await satispayRes.text();
        res.status(satispayRes.status);
        res.setHeader('Content-Type', 'application/json');
        res.end(responseText);

    } catch (err) {
        res.status(502).json({ error: 'Proxy error: ' + err.message });
    }
};
