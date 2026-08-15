import { loginAdmin, getAllInvoices } from '../services/admin.service.js';

async function login(req, res) {
    const { username, password } = req.body;

    try {
        const token = await loginAdmin(username, password);
        return res.status(200).json({ success: true, token });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, error: error.message });
    }
}


async function listInvoices(req, res) {
    try {
        const invoices = await getAllInvoices();
        return res.status(200).json({ success: true, invoices });
    } catch (error) {
        console.error('List invoices error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export { login  , listInvoices };