import sequelize from '../config/database.js';
import { Invoice, InvoiceItem } from '../models/associations.model.js';
import { generateReceiptHash } from '../utils/hash.js';

function buildReceiptUrl(hash) {
    const base = process.env.RECEIPT_BASE_URL || 'http://localhost:3000/receipt';
    return `${base}/${hash}`;
}

/**
 * Safe numeric parsing to guard against unhandled NaN in calculations
 */
const safeNum = (val) => {
    const parsed = parseFloat(val);
    return Number.isNaN(parsed) ? 0 : parsed;
};

async function createInvoice(data) {
    // 1. Idempotency Check
    const existing = await Invoice.findOne({
        where: { idempotency_key: data.idempotencyKey }
    });

    if (existing) {
        return {
            duplicate: true,
            receiptHash: existing.receipt_hash,
            receiptUrl: buildReceiptUrl(existing.receipt_hash)
        };
    }

    // 2. Managed ACID Transaction
    const invoice = await sequelize.transaction(async (t) => {
        const receiptHash = generateReceiptHash();

        const newInvoice = await Invoice.create({
            receipt_hash: receiptHash,
            invoice_no: data.invoiceNo,
            idempotency_key: data.idempotencyKey,
            store_id: safeNum(data.storeId) || 3,
            customer_name: data.billTo || null,
            customer_phone: data.customerPhone || null,
            total_amount: safeNum(data.summary?.total),
            discount: safeNum(data.summary?.discount),
            gst_amount: safeNum(data.summary?.gst),
            pos_fee: safeNum(data.summary?.posFee),
            payable_amount: safeNum(data.summary?.payable),
            payment_mode: data.paymentMode || 'Cash'
        }, { transaction: t });

        // 3. Mapping Payload (Fixed key mismatch bug)
        const itemsToInsert = data.items.map(item => {
            // Support payload schema from posSync mapped output
            const qty = safeNum(item.quantity || item.qty) || 1;
            const unitPrice = safeNum(item.amount || item.price);
            const gstTax = safeNum(item.tax);
            const itemTotal = safeNum(item.total) || Number((qty * unitPrice + gstTax).toFixed(2));

            // Derived tax percentage calculation safely falling back to 0
            const calculatedGstPercent = unitPrice > 0 ? (gstTax / unitPrice) * 100 : safeNum(item.gstPercent);

            return {
                invoice_id: newInvoice.id,
                item_name: item.name || 'Unknown Item',
                quantity: qty,
                unit_price: unitPrice,
                gst_percent: parseFloat(calculatedGstPercent.toFixed(2)),
                total_price: itemTotal
            };
        });

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
    if (!hash) return null;

    return await Invoice.findOne({
        where: { receipt_hash: hash },
        include: [{
            model: InvoiceItem,
            as: 'items'
        }]
    });
}

export { createInvoice, getInvoiceByHash };