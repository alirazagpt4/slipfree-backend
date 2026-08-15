import express from 'express';
import morgan from 'morgan';
import cors from 'cors'
import invoiceRoutes from '../routes/invoice.routes.js';
import feedbackRoutes from '../routes/feedback.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/v1/receipts', invoiceRoutes);
app.use('/api/v1/receipts', feedbackRoutes);

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Digital Receipt System running' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

export default app;