import express from 'express';
import invoiceRoutes from '../routes/invoice.routes.js';

const app = express();

app.use(express.json());
app.use('/api/v1/receipts', invoiceRoutes);

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Digital Receipt System running' });
});

export default app;