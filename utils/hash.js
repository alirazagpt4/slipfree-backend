import crypto from 'crypto';

function generateReceiptHash() {
    return crypto.randomBytes(16).toString('hex');
}

export { generateReceiptHash };