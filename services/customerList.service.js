import CustomerSegment from '../models/customerSegment.model.js';

/**
 * Service to aggregate and deduplicate all customers across segments
 * @returns {Promise<Array<{phone: string, name: string, last_feedback: string}>>}
 */
export const fetchGlobalUniqueCustomersService = async () => {
    // 1. Data Minimization: Select only customer_list column from DB
    const segments = await CustomerSegment.findAll({
        attributes: ['customer_list'],
        order: [['created_at', 'DESC']],
        raw: true
    });

    // 2. Deduplication using JavaScript Map (Key: Phone Number)
    const uniqueCustomersMap = new Map();

    for (const segment of segments) {
        const list = Array.isArray(segment.customer_list) ? segment.customer_list : [];

        for (const item of list) {
            if (!item.customer_phone) continue;

            // Normalize phone string by trimming whitespace
            const cleanPhone = String(item.customer_phone).trim();

            // Hash Map Lookup - O(1) time complexity
            if (!uniqueCustomersMap.has(cleanPhone)) {
                uniqueCustomersMap.set(cleanPhone, {
                    phone: cleanPhone,
                    name: item.customer_name ? item.customer_name.trim() : 'Unknown Customer',
                    last_feedback: item.feedback || 'None'
                });
            }
        }
    }

    // Return plain array for controller consumption
    return Array.from(uniqueCustomersMap.values());
};