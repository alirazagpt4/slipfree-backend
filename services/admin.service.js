import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Invoice, InvoiceItem, Feedback } from '../models/associations.model.js';

async function loginAdmin(username, password) {
    if (username !== process.env.ADMIN_USERNAME) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    const isValid = bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH);
    if (!isValid) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return token;
}


async function getAllInvoices() {
    const invoices = await Invoice.findAll({
        include: [
            { model: InvoiceItem, as: 'items' },
            { model: Feedback, as: 'feedback' }
        ],
        order: [['id', 'DESC']]
    });

    return invoices;
}

export { loginAdmin, getAllInvoices };