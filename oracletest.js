import { fetchMasterCustomers } from './services/masterCustomers.service.js';

(async () => {
    console.log('🚀 Starting Test Call for Master Customers...');
    const data = await fetchMasterCustomers();
    console.log(`🏁 Done! Returned Array Length: ${data.length}`);
    console.log('Sample Data:', JSON.stringify(data[0], null, 2));
})();