import { fetchNewSalesFromRetailPro, mapRetailProSaleToOurFormat } from './services/posSync.service.js';

async function runTest() {
  console.log('🧪 Manual sync test start ho raha hai...');
  const sales = await fetchNewSalesFromRetailPro();
  console.log(`📦 Total sales fetched: ${sales.length}`);

  if (sales.length > 0) {
    // Sabse nayi sale ko top par rakhne ke liye sort karein
    sales.sort((a, b) => new Date(b.document.created_datetime) - new Date(a.document.created_datetime));

    const mapped = mapRetailProSaleToOurFormat(sales[0]);
    console.log('✅ Mapped Sale Data:', JSON.stringify(mapped, null, 2));
  } else {
    console.log('⚠️ Koi completed sale nahi mili (yeh normal hai agar POS par naya bill nahi bana).');
  }
}

runTest();