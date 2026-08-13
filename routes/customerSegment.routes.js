import { Router } from 'express';
import { createSegment, getAllSegments } from '../controllers/customerSegment.controller.js';

const router = Router();

router.post('/segments', createSegment);
router.get('/segments', getAllSegments);

export default router;