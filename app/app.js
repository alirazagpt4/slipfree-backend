import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import invoiceRoutes from '../routes/invoice.routes.js';
import feedbackRoutes from '../routes/feedback.routes.js';
import adminRoutes from '../routes/admin.routes.js';
import customerSegmentRoutes from '../routes/customerSegment.routes.js'
import customerListRoutes from '../routes/customerList.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/receipts', invoiceRoutes);
app.use('/api/v1/receipts', feedbackRoutes);


// Admin routes
app.use('/api/v1/admin', adminRoutes);

// Customer Segment routes
app.use('/api/v1', customerSegmentRoutes);

// Customer List routes
app.use('/api/v1/customers', customerListRoutes);

// React build server
app.use(express.static(path.join(__dirname, '..', 'public')));

// React index.html serve for all other routes
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

export default app;