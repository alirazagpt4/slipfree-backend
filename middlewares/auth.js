function checkApiKey(req, res, next) {
    const key = req.header('X-API-KEY');

    if (!key) {
        return res.status(401).json({ success: false, error: 'Missing X-API-KEY header' });
    }

    if (key !== process.env.POS_API_KEY) {
        return res.status(403).json({ success: false, error: 'Invalid API key' });
    }

    next();
}

export { checkApiKey };