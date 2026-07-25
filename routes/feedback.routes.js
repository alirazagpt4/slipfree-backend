import express from 'express';
import { postFeedback } from '../controllers/feedback.controller.js';

const router = express.Router();

router.post('/:hash/feedback', postFeedback);

export default router;