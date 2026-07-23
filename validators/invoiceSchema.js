import { z } from 'zod';

const invoiceSchema = z.object({
    storeId: z.number().int().positive(),
    invoiceNo: z.string().min(1),
    idempotencyKey: z.string().min(1),
    billTo: z.string().optional(),
    customerPhone: z.string().optional(),
    paymentMode: z.enum(['Cash', 'Card']),
    items: z.array(
        z.object({
            name: z.string().min(1),
            qty: z.number().positive(),
            price: z.number().nonnegative(),
            gstPercent: z.number().nonnegative()
        })
    ).min(1, 'At least one item is required'),
    summary: z.object({
        total: z.number().nonnegative(),
        discount: z.number().nonnegative().default(0),
        gst: z.number().nonnegative(),
        posFee: z.number().nonnegative().default(1.0),
        payable: z.number().nonnegative()
    })
});

export { invoiceSchema };