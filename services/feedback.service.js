import { Invoice, Feedback } from '../models/associations.model.js';
import { pushFeedbackToOracle } from './oracleFeedback.service.js';

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
        invoice_no: invoice.invoice_no,
        shop_name: invoice.shop_name,
        rating,
        comment: comment || null
    });

    console.log('✅ Feedback created with id:', feedback.id);

    const oraclePayload = {
        invoice_id: feedback.invoice_id,
        invoice_no: feedback.invoice_no,
        rating: feedback.rating,
        shop_name: feedback.shop_name,
    };


    // Non-blocking invocation with explicit Error Boundary
    pushFeedbackToOracle(oraclePayload).catch(err => {
        console.error('[Oracle Async Queue Failure]:', err.message || err);
    });


    return feedback;
}
export { submitFeedback };