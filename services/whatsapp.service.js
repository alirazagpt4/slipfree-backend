import axios from 'axios';
import FormData from 'form-data';

// 🛑 ATOMIC EXECUTION LOCK MAP
const activeLocks = new Map();

const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('92')) return cleaned;

    if (cleaned.startsWith('0') && cleaned.length === 11) {
        cleaned = '92' + cleaned.slice(1);
    } else if (cleaned.startsWith('05') && cleaned.length === 10) {
        cleaned = '971' + cleaned.slice(1);
    }
    return cleaned;
};

export async function sendReceiptWhatsApp(customerPhone, receiptUrl, shopName = 'Logo Opia') {
    if (!customerPhone || customerPhone === 'N/A') {
        console.warn('[WhatsApp Service] Dispatch Skipped: Phone number missing.');
        return null;
    }

    const recipientPhone = formatPhoneNumber(customerPhone);
    const lockKey = `${recipientPhone}_${receiptUrl}`;

    // 🛑 EXACT SECOND DEDUPLICATION GUARD
    if (activeLocks.has(lockKey)) {
        console.warn(`[WhatsApp Guard] 🛑 DUPLICATE BLOCKED AT SAME SECOND: ${lockKey}`);
        return { success: false, reason: 'Duplicate call blocked by atomic guard' };
    }

    // Lock immediate set karo
    activeLocks.set(lockKey, true);

    // Auto-release lock after 10 seconds
    const lockTimer = setTimeout(() => {
        activeLocks.delete(lockKey);
    }, 10000);

    const apiUrl = process.env.GINKGO_WHATSAPP_URL || 'https://communication-center-be.ginkgoretail.net/whatsapp/api/templates/send/';
    const apiKey = process.env.GINKGO_API_KEY || '15e9b2d9b623cbec46da71b8841fd91c0774c41323b5c14c0b3e8bf0942424e3';
    const templateName = (process.env.WHATSAPP_TEMPLATE_NAME || 'retail_sale_receipt').trim();

    try {
        const formData = new FormData();
        formData.append('customer_name', shopName);
        formData.append('phone_number', recipientPhone);
        formData.append('template_name', templateName);
        formData.append('language', 'en');
        formData.append('language_code', 'en');

        const varsObj = { body_1: receiptUrl };
        formData.append('vars', JSON.stringify(varsObj));

        console.log(`[WhatsApp Guard] 🚀 Dispatching single request for: ${recipientPhone}`);

        const response = await axios.post(apiUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'accept': 'application/json',
                'X-Api-Key': apiKey
            },
            timeout: 10000
        });

        console.log('[Ginkgo WhatsApp API Success]:', response.data);
        return response.data;
    } catch (error) {
        // Error par immediately lock release karo
        clearTimeout(lockTimer);
        activeLocks.delete(lockKey);

        const errorDetails = error.response?.data || error.message;
        console.error('[Ginkgo WhatsApp API Error]:', JSON.stringify(errorDetails, null, 2));
        return null;
    }
}