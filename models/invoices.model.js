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
    idempotency_key: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false
    },
    store_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    customer_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    customer_phone: {
        type: DataTypes.STRING(20),
        allowNull: true
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
        type: DataTypes.ENUM('Cash', 'Card'),
        allowNull: false
    }
}, {
    tableName: 'invoices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

export default Invoice;