import { fetchGlobalUniqueCustomersService } from '../services/customerlist.service.js';

/**
 * Controller to handle fetching all unique customers for the main portal
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const getGlobalUniqueCustomers = async (req, res) => {
    try {
        const uniqueCustomers = await fetchGlobalUniqueCustomersService();

        return res.status(200).json({
            success: true,
            total_count: uniqueCustomers.length,
            data: uniqueCustomers
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve unique customers list',
            error: error.message
        });
    }
};