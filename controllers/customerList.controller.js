import { fetchMasterCustomers } from '../services/customerList.service.js';

export const getGlobalUniqueCustomers = async (req, res) => {
    try {
        const uniqueCustomers = await fetchMasterCustomers();

        // Exact original structure intact
        return res.status(200).json({
            success: true,
            total_count: uniqueCustomers.length,
            data: uniqueCustomers
        });

    } catch (error) {
        console.error('❌ Controller Error fetching customers:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch master customers list',
            error: error.message
        });
    }
};