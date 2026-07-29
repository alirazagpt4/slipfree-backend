import cron from 'node-cron';
import { fetchNewSalesFromRetailPro, mapRetailProSaleToOurFormat } from '../services/posSync.service.js';
import { createInvoice } from '../services/invoice.service.js';

// Concurrency Guard: Prevents overlapping cron executions if fetching takes > 60s
let isSyncRunning = false;

export const initSyncScheduler = () => {
  cron.schedule('*/1 * * * *', async () => {
    if (isSyncRunning) {
      console.warn('⚠️ Previous sync run is still active. Skipping this cycle.');
      return;
    }

    isSyncRunning = true;
    console.log('🔄 Checking Retail Pro for new sales...');

    try {
      const sales = await fetchNewSalesFromRetailPro();

      for (const sale of sales) {
        const formattedData = mapRetailProSaleToOurFormat(sale);

        // Transactionally save to DB with idempotency verification
        const result = await createInvoice(formattedData);

        if (!result.duplicate) {
          console.log(`✅ Synced Invoice: ${formattedData.invoiceNo} | Hash: ${result.receiptHash}`);

          // WhatsApp Trigger Placeholder
          if (formattedData.customerPhone) {
            // TODO: Jab WhatsApp module ready ho, send function yahan trigger karna:
            // sendWhatsAppReceipt(formattedData.customerPhone, result.receiptUrl);
            console.log(`📱 [Pending WhatsApp Dispatch] Phone: ${formattedData.customerPhone} | Link: ${result.receiptUrl}`);
          }
        }
      }
    } catch (err) {
      console.error('❌ Sync Job Execution Error:', err.message);
    } finally {
      isSyncRunning = false; // Mutex release
    }
  });
};