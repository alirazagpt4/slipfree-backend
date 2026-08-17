import { Router } from 'express';
import { getGlobalUniqueCustomers } from '../controllers/customerList.controller.js';

const router = Router();

/**
 * @route   GET /api/customers/global-unique
 * @desc    Fetch deduplicated master list of all customers for main portal
 * @access  Private / Admin
 */
router.get('/customers-list', getGlobalUniqueCustomers);

export default router;