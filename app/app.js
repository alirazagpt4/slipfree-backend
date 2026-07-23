import express from 'express';
import morgan from 'morgan';
import invoiceRoutes from '../routes/invoice.routes.js';

const app = express();

app.use(express.json());
app.use(morgan('dev'));
app.use('/api/v1/receipts', invoiceRoutes);

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Digital Receipt System running' });
});

export default app;