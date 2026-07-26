import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import invoiceRoutes from '../routes/invoice.routes.js';
import feedbackRoutes from '../routes/feedback.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/receipts', invoiceRoutes);
app.use('/api/v1/receipts', feedbackRoutes);

// React build ki static files serve karo
app.use(express.static(path.join(__dirname, '..', 'public')));

// Baaki sab routes (jo API nahi hain) React ke index.html pe bhej do
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

export default app;