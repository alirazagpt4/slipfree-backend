import 'dotenv/config';
import oracledb from 'oracledb';

// Query Output Ko Objects (JSON) Format Mein Convert Karnay Ke Liye
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function testConnection() {
    let connection;

    try {
        // Environment variables se credentials utha rahe hain
        const host = process.env.ORA_HOST || '80.65.211.5';
        const port = process.env.ORA_PORT || '1521';
        const serviceName = process.env.ORA_SERVICE_NAME || 'RPROODS.prism_custom';
        const user = process.env.ORA_USER || 'reportuser';
        const password = process.env.ORA_PASS || 'report';

        const connectString = `${host}:${port}/${serviceName}`;

        console.log(`🔌 Connecting to Oracle DB at ${connectString}...`);

        connection = await oracledb.getConnection({
            user,
            password,
            connectString
        });

        console.log('✅ Oracle DB Se Connection Successfully Establish Ho Gaya!');

        // Simple Test Query: Database se timestamp aur table check karne ke liye
        const result = await connection.execute(
            `SELECT SYSDATE FROM DUAL`
        );

        console.log('📄 Test Query Result:', result.rows);

    } catch (err) {
        console.error('❌ Oracle Connection Failure:', err.message);

        // Specific connection string fallback tip
        if (err.message.includes('ORA-12514') || err.message.includes('ORA-12505')) {
            console.error('💡 Tip: Agar Service Name ka issue ho, toh SERVICE_NAME change karke check karein.');
        }
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('🔒 Connection closed.');
            } catch (closeErr) {
                console.error('Error closing connection:', closeErr.message);
            }
        }
    }
}

testConnection();