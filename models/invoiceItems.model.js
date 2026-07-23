import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const InvoiceItem = sequelize.define('InvoiceItem', {
    invoice_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    item_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    gst_percent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
}, {
    tableName: 'invoice_items',
    timestamps: false
});

export default InvoiceItem;