import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CustomerSegment = sequelize.define('CustomerSegment', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    segment_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    filter_criteria: {
        type: DataTypes.JSON,
        allowNull: true
    },
    customer_list: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
    }
}, {
    tableName: 'customer_segments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default CustomerSegment;