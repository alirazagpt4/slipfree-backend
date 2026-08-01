import 'dotenv/config';
import { fetchNewSalesFromRetailPro } from './services/posSync.service.js';

async function test() {
    console.log('🔍 Testing Oracle query directly...');

    // Pichले 7 din se test karein — taake purani sales bhi mil sakein
    const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const sales = await fetchNewSalesFromRetailPro(sinceDate);

    console.log(`📊 Total sale groups mile: ${sales.length}`);
    console.log('📄 Pehla record:', JSON.stringify(sales[0], null, 2));
}

test();