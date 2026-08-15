import sequelize from '../config/database.js';
import { Invoice, InvoiceItem } from '../models/associations.model.js';
import { generateReceiptHash } from '../utils/hash.js';
import { sendReceiptWhatsApp } from './whatsapp.service.js';

function buildReceiptUrl(hash) {
    const base = process.env.RECEIPT_BASE_URL || 'https://slipfree.nexonsys.com/v';
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
            fbr_invoice_no: data.fbrInvoiceNo,
            idempotency_key: data.idempotencyKey,
            store_id: safeNum(data.storeId) || 3,
            shop_name: data.shopName || null,        // NAYA
            shop_address: data.shopAddress || null,  // NAYA
            shop_phone: data.shopPhone || null,      // NAYA
            cashier_name: data.cashierName || null,  // NAYA
            customer_name: data.billTo || null,
            customer_phone: data.customerPhone || null,
            price_excl_tax: safeNum(data.summary?.price_excl_tax),
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
            const qty = safeNum(item.qty) || 1;
            const unitPrice = safeNum(item.price);
            const gstTax = safeNum(item.tax);
            const itemTotal = item.price * item.qty;

            // Derived tax percentage calculation safely falling back to 0
            const tax = item.gst_percent;

            return {
                invoice_id: newInvoice.id,
                item_name: item.name || 'Unknown Item',
                product_name: item.productName || 'Unknown Item',
                color: item.color || 'Unknown Color',
                size: item.size || 'Unknown Size',
                quantity: qty,
                unit_price: unitPrice,
                gst_percent: tax,
                total_price: itemTotal
            };
        });

        await InvoiceItem.bulkCreate(itemsToInsert, { transaction: t });

        return newInvoice;
    });

    const generatedReceiptUrl = buildReceiptUrl(invoice.receipt_hash);

    // 4. WHATSAPP TRIGGER (NON-BLOCKING ASYNC EXECUTION)
    if (invoice.customer_phone && invoice.customer_phone !== 'N/A') {
        sendReceiptWhatsApp(invoice.customer_phone, generatedReceiptUrl, invoice.shop_name)
            .then(res => {
                if (res) {
                    console.log(`[WhatsApp Sync Success] Invoice #${invoice.invoice_no} dispatched to ${invoice.customer_phone}`);
                }
            })
            .catch(err => {
                console.error(`[WhatsApp Sync Error] Failed for Invoice #${invoice.invoice_no}:`, err.message);
            });
    }


    // 🔍 EXACT TERMINAL CHECK LOG in invoice service 
    // console.log(`\n>>> MAPPED PAYLOAD FOR RECEIPT #${invoice.invoice_no} <<<`);
    // console.dir(invoice, { depth: null, colors: true });

    return {
        duplicate: false,
        receiptHash: invoice.receipt_hash,
        receiptUrl: generatedReceiptUrl
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