import { Invoice, Feedback } from '../models/associations.model.js';

async function submitFeedback(hash, rating, comment) {
    console.log('🔍 Feedback attempt — hash:', hash, '| rating:', rating); // NAYA

    const invoice = await Invoice.findOne({ where: { receipt_hash: hash } });

    console.log('🔍 Invoice found:', invoice ? invoice.id : 'NOT FOUND'); // NAYA

    if (!invoice) {
        const error = new Error('Invoice not found');
        error.statusCode = 404;
        throw error;
    }

    const existingFeedback = await Feedback.findOne({ where: { invoice_id: invoice.id } });

    console.log('🔍 Existing feedback:', existingFeedback ? 'YES (duplicate)' : 'NO'); // NAYA

    if (existingFeedback) {
        const error = new Error('Feedback already submitted for this receipt');
        error.statusCode = 409;
        throw error;
    }

    const feedback = await Feedback.create({
        invoice_id: invoice.id,
        rating,
        comment: comment || null
    });

    console.log('✅ Feedback created with id:', feedback.id); // NAYA

    return feedback;
}
export { submitFeedback };