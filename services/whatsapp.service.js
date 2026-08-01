import axios from 'axios';

/**
 * Phone number ko E.164 format mein normalize karta hai (Pakistan + Dubai Support)
 * @param {string} phone 
 * @returns {string} Cleaned phone number without '+' prefix
 */
const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); // Pehle saaray non-digits remove karo

    // Strip leading '00' if present
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.slice(2);
    }

    // Direct match check: Agar pehle hi '923144965144' format mein hai
    if (cleaned.startsWith('92')) {
        return cleaned;
    }

    // Local Pakistan 03xx -> 923xx (11 digits: e.g., 03144965144)
    if (cleaned.startsWith('0') && cleaned.length === 11) {
        cleaned = '92' + cleaned.slice(1);
    }
    // Local Dubai/UAE 05x -> 9715x
    else if (cleaned.startsWith('05') && cleaned.length === 10) {
        cleaned = '971' + cleaned.slice(1);
    }

    return cleaned;
};

/**
 * Meta Cloud API ke zariye WhatsApp Message dispatch karta hai
 * @param {string} customerPhone 
 * @param {string} receiptUrl 
 * @param {string} shopName 
 */
export async function sendReceiptWhatsApp(customerPhone, receiptUrl, shopName = 'Our Store') {
    if (!customerPhone || customerPhone === 'N/A') {
        console.warn('[WhatsApp Service] Dispatch Skipped: Valid phone number not provided.');
        return null;
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !token) {
        console.error('[WhatsApp Service] Error: WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing in .env');
        return null;
    }

    const recipientPhone = formatPhoneNumber(customerPhone);
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    // Production Template Payload (Meta Dynamic Body Variable {{1}} Mapping)
    const payload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'template',
        template: {
            name: process.env.WHATSAPP_TEMPLATE_NAME || 'hello_whatsapp_template',
            language: {
                code: 'en'
            },
            components: [
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: receiptUrl // Dynamic Receipt URL passed to {{1}} in Meta Template
                        }
                    ]
                }
            ]
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10s Timeout guard
        });

        return response.data;
    } catch (error) {
        const errorDetails = error.response?.data || error.message;
        console.error('[WhatsApp API Delivery Error]:', JSON.stringify(errorDetails, null, 2));
        return null;
    }
}