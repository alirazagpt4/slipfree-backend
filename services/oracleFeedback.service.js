import oracledb from 'oracledb';

oracledb.autoCommit = true;

const oracleConfig = {
    user: process.env.ORA_USER,
    password: process.env.ORA_PASS,
    connectString: `${process.env.ORA_HOST}:${process.env.ORA_PORT}/${process.env.ORA_SERVICE_NAME}`
};

export async function pushFeedbackToOracle(data) {
    let connection;

    try {
        connection = await oracledb.getConnection(oracleConfig);

        const sql = `
            INSERT INTO invoice_feedback (
                INVOICE_ID, 
                INVOICE_NO, 
                RATING, 
                SUBMITTED_AT
            ) VALUES (
                :invoice_id, 
                :invoice_no, 
                :rating, 
                CURRENT_TIMESTAMP
            )
        `;

        // String payload formatting (e.g., "best", "ok", "good")
        const safeRating = data.rating ? String(data.rating).trim().toLowerCase() : 'ok';

        const bindParams = {
            invoice_id: data.invoice_id ? String(data.invoice_id) : '0',
            invoice_no: data.invoice_no ? String(data.invoice_no) : 'N/A',
            rating: safeRating
        };

        console.log('🚨 ORACLE PAYLOAD BEING SENT:', JSON.stringify(bindParams));

        const result = await connection.execute(sql, bindParams);
        console.log(`[Oracle Feedback Sync ✅] Inserted. Rows affected: ${result.rowsAffected}`);
        return true;

    } catch (error) {
        console.error('[Oracle Feedback Sync ❌ Error]:', error.message);
        return false;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('[Oracle Connection Close Error]:', err.message);
            }
        }
    }
}