import express from 'express';
import { login, listInvoices } from '../controllers/admin.controller.js';
import { verifyAdminToken } from '../middlewares/authAdmin.middleware.js';

const router = express.Router();

router.post('/login', login);
router.get('/invoices', verifyAdminToken, listInvoices);

export default router;