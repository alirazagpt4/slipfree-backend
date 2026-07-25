import { Invoice, Feedback } from '../models/associations.model.js';

async function submitFeedback(hash, rating, comment) {
    // Pehle invoice dhundo hash se
    const invoice = await Invoice.findOne({ where: { receipt_hash: hash } });

    if (!invoice) {
        const error = new Error('Invoice not found');
        error.statusCode = 404;
        throw error;
    }

    // Duplicate check — "1 time hi hoga" wala rule yahan enforce ho raha hai
    const existingFeedback = await Feedback.findOne({ where: { invoice_id: invoice.id } });

    if (existingFeedback) {
        const error = new Error('Feedback already submitted for this receipt');
        error.statusCode = 409; // Conflict
        throw error;
    }

    const feedback = await Feedback.create({
        invoice_id: invoice.id,
        rating,
        comment: comment || null
    });

    return feedback;
}

export { submitFeedback };