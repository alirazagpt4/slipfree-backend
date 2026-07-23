import { invoiceSchema } from '../validators/invoiceSchema.js';
import { createInvoice , getInvoiceByHash} from '../services/invoice.service.js';

async function ingestInvoice(req, res) {
    // Validation yahan controller mein hoti hai — kyunki ye HTTP-specific
    // kaam hai (request body check karna), service ka kaam nahi
    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.issues });
    }

    try {
        const result = await createInvoice(parsed.data);

        const statusCode = result.duplicate ? 200 : 201;

        return res.status(statusCode).json({
            success: true,
            duplicate: result.duplicate,
            receiptHash: result.receiptHash,
            receiptUrl: result.receiptUrl
        });
    } catch (error) {
        console.error('Ingest error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}


async function getReceipt(req, res) {
    try {
        const invoice = await getInvoiceByHash(req.params.hash);

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Receipt not found' });
        }

        return res.status(200).json({ success: true, invoice });
    } catch (error) {
        console.error('Retrieve error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export { ingestInvoice , getReceipt };