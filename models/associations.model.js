import Invoice from './invoices.model.js';
import InvoiceItem from './invoiceItems.model.js';
import Feedback from './feedback.model.js';

// Ek Invoice ki multiple Items ho sakti hain
Invoice.hasMany(InvoiceItem, {
    foreignKey: 'invoice_id',
    as: 'items'
});

// Har Item sirf ek Invoice se belong karega
InvoiceItem.belongsTo(Invoice, {
    foreignKey: 'invoice_id'
});

// Ek Invoice par ek hi Feedback ho sakta hai
Invoice.hasOne(Feedback, {
    foreignKey: 'invoice_id',
    as: 'feedback'
});

// Har Feedback ek hi Invoice se belong karega
Feedback.belongsTo(Invoice, {
    foreignKey: 'invoice_id'
});

export { Invoice, InvoiceItem, Feedback };