import express from 'express';
import { checkApiKey } from '../middlewares/auth.js';
import { ingestInvoice, getReceipt } from '../controllers/invoice.controller.js';

const router = express.Router();

router.post('/ingest', checkApiKey, ingestInvoice);
router.get('/:hash', getReceipt);

export default router;