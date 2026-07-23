import Invoice from './invoices.model.js';
import InvoiceItem from './invoiceItems.model.js';

// Ek Invoice ki multiple Items ho sakti hain
Invoice.hasMany(InvoiceItem, {
    foreignKey: 'invoice_id',
    as: 'items'
});

// Har Item sirf ek Invoice se belong karega
InvoiceItem.belongsTo(Invoice, {
    foreignKey: 'invoice_id'
});

export { Invoice, InvoiceItem };