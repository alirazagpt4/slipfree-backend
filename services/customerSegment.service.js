import CustomerSegment from '../models/customerSegment.model.js';

export const saveSegmentService = async (segment_name, filter_criteria, customer_list) => {
    // Array ko clean aur format karna
    const sanitizedCustomers = customer_list.map(cust => ({
        customer_name: cust.customer_name || cust.name || 'Walk-In Customer',
        customer_phone: cust.customer_phone || cust.phone || 'N/A',
        feedback: cust.feedback || ''
    }));

    return await CustomerSegment.create({
        segment_name: segment_name.trim(),
        filter_criteria: filter_criteria || null,
        customer_list: sanitizedCustomers
    });
};

export const getAllSegmentsService = async () => {
    const segments = await CustomerSegment.findAll({
        order: [['created_at', 'DESC']]
    });

    return segments.map(seg => {
        const data = seg.toJSON();
        const list = data.customer_list || [];
        return {
            id: data.id,
            segment_name: data.segment_name,
            filter_criteria: data.filter_criteria,
            total_customers: list.length,
            created_at: data.created_at,
            customer_list: list
        };
    });
};