import sequelize from '../config/database.js';
import { Invoice, InvoiceItem } from '../models/associations.model.js';
import { generateReceiptHash } from '../utils/hash.js';

function buildReceiptUrl(hash) {
    const base = process.env.RECEIPT_BASE_URL || 'http://localhost:3000/v';
    return `${base}/${hash}`;
}

async function createInvoice(data) {
    // Idempotency check
    const existing = await Invoice.findOne({ where: { idempotency_key: data.idempotencyKey } });
    if (existing) {
        return {
            duplicate: true,
            receiptHash: existing.receipt_hash,
            receiptUrl: buildReceiptUrl(existing.receipt_hash)
        };
    }

    // Transaction (ACID)
    const invoice = await sequelize.transaction(async (t) => {
        const receiptHash = generateReceiptHash();

        const newInvoice = await Invoice.create({
            receipt_hash: receiptHash,
            invoice_no: data.invoiceNo,
            idempotency_key: data.idempotencyKey,
            store_id: data.storeId,
            customer_name: data.billTo || null,
            customer_phone: data.customerPhone || null,
            total_amount: data.summary.total,
            discount: data.summary.discount,
            gst_amount: data.summary.gst,
            pos_fee: data.summary.posFee,
            payable_amount: data.summary.payable,
            payment_mode: data.paymentMode
        }, { transaction: t });

        const itemsToInsert = data.items.map(item => ({
            invoice_id: newInvoice.id,
            item_name: item.name,
            quantity: item.qty,
            unit_price: item.price,
            gst_percent: item.gstPercent,
            total_price: Number((item.qty * item.price * (1 + item.gstPercent / 100)).toFixed(2))
        }));

        await InvoiceItem.bulkCreate(itemsToInsert, { transaction: t });

        return newInvoice;
    });

    return {
        duplicate: false,
        receiptHash: invoice.receipt_hash,
        receiptUrl: buildReceiptUrl(invoice.receipt_hash)
    };
}



async function getInvoiceByHash(hash) {
    const invoice = await Invoice.findOne({
        where: { receipt_hash: hash },
        include: [{ model: InvoiceItem, as: 'items' }]
    });

    return invoice; // null bhi ho sakta hai agar na mile
}

export { createInvoice, getInvoiceByHash };