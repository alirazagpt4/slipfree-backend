import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Invoice = sequelize.define('Invoice', {
    receipt_hash: {
        type: DataTypes.STRING(64),
        unique: true,
        allowNull: false
    },
    invoice_no: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    fbr_invoice_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null
    },
    idempotency_key: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false
    },
    store_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    shop_name: { type: DataTypes.STRING(255), allowNull: true },
    shop_address: { type: DataTypes.STRING(500), allowNull: true },
    shop_phone: { type: DataTypes.STRING(50), allowNull: true },
    cashier_name: { type: DataTypes.STRING(255), allowNull: true },
    customer_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    customer_phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    price_excl_tax: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0
    },
    gst_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    pos_fee: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 1.0
    },
    payable_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    payment_mode: {
        type: DataTypes.STRING(100), // ENUM hata kar STRING(100) lagao
        allowNull: false,
        defaultValue: 'Cash'
    }
}, {
    tableName: 'invoices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

export default Invoice;