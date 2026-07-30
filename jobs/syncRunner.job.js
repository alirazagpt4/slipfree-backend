import cron from 'node-cron';
import { fetchNewSalesFromRetailPro, mapRetailProSaleToOurFormat } from '../services/posSync.service.js';
import { createInvoice } from '../services/invoice.service.js';

// Concurrency Guard: Prevents overlapping cron executions if fetching takes > 60s
let isSyncRunning = false;

export const initSyncScheduler = () => {
    cron.schedule('*/1 * * * *', async () => {
        if (isSyncRunning) return;
        isSyncRunning = true;

        console.log('🔄 Checking Retail Pro for new sales...');

        try {
            const sales = await fetchNewSalesFromRetailPro();

            for (const sale of sales) {
                // Individual Try-Catch block taake ek item ki wajah se pura loop crash na ho
                try {
                    const formattedData = mapRetailProSaleToOurFormat(sale);
                    const result = await createInvoice(formattedData);

                    if (!result.duplicate) {
                        console.log(`✅ Synced Invoice: ${formattedData.invoiceNo} | Hash: ${result.receiptHash}`);

                        if (formattedData.customerPhone) {
                            console.log(`📱 [Pending WhatsApp Dispatch] Phone: ${formattedData.customerPhone} | Link: ${result.receiptUrl}`);
                        }
                    } else {
                        console.log(`ℹ️ Skipped (Already Synced): ${formattedData.invoiceNo}`);
                    }
                } catch (itemErr) {
                    // Specific validation or duplicate log output
                    console.warn(`⚠️ Skipped Invoice due to Validation/Duplicate Issue:`, itemErr.message);
                }
            }
        } catch (err) {
            console.error('❌ Sync Job Execution Error:', err.message);
        } finally {
            isSyncRunning = false;
        }
    });
};