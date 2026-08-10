import jwt from 'jsonwebtoken';

function verifyAdminToken(req, res, next) {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ success: false, error: 'Login required' });
    }

    try {
        jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ success: false, error: 'Invalid or expired session' });
    }
}

export { verifyAdminToken };