import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Feedback = sequelize.define('Feedback', {
    invoice_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    rating: {
        type: DataTypes.ENUM('worst', 'not_good', 'fine', 'good', 'best'),
        allowNull: false
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'invoice_feedback',
    timestamps: true,
    createdAt: 'submitted_at',
    updatedAt: false
});

export default Feedback;