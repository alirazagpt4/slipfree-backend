import 'dotenv/config';
import oracledb from 'oracledb';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const oracleConfig = {
    user: process.env.ORA_USER || 'reportuser',
    password: process.env.ORA_PASS || 'report',
    connectString: `${process.env.ORA_HOST || 'localhost'}:${process.env.ORA_PORT || '1521'}/${process.env.ORA_SERVICE_NAME || 'RPROODS.prism'}`
};

const MASTER_CUSTOMER_QUERY = `
    SELECT 
        ss.sbs_name AS SBS_NAME,
        s.store_name AS SHOP, 
        TO_CHAR(d.created_datetime, 'DD-MON-YYYY HH24:MI:SS') AS CUSTOMER_CREATED_DATETIME,
        NVL(NULLIF(TRIM(NVL(TO_CHAR(d.first_name), '') || ' ' || NVL(TO_CHAR(d.LAST_NAME), '')), ''), 'N/A') AS CUSTOMER_NAME, 
        NVL(
            NULLIF(
                TRIM(
                    NVL(TO_CHAR(ca.ADDRESS_1), '') || ' ' ||
                    NVL(TO_CHAR(ca.ADDRESS_2), '') || ' ' ||
                    NVL(TO_CHAR(ca.ADDRESS_3), '')
                ), ''
            ),
            'N/A'
        ) AS CUSTOMER_ADDRESS,
        NVL(p.phone_no, 'N/A') AS MOBILE_NO,
        NVL(ce.EMAIL_ADDRESS, 'N/A') AS EMAIL_ADDRESS
    FROM rps.customer d 
    LEFT JOIN rps.customer_phone p ON d.SID = p.CUST_SID
    LEFT JOIN RPS.CUSTOMER_ADDRESS ca ON d.SID = ca.CUST_SID
    LEFT JOIN RPS.CUSTOMER_EMAIL ce ON d.SID = ce.CUST_SID
    INNER JOIN rps.store s ON d.store_sid = s.sid AND d.sbs_sid = s.sbs_sid 
    INNER JOIN rps.subsidiary ss ON ss.sid = d.sbs_sid
    WHERE 1=1
`;

export const fetchMasterCustomers = async () => {
    let connection;
    console.time('⏱️ Oracle Fetch Master Execution Time');

    try {
        console.log('🔌 Connecting to Oracle Database...');
        connection = await oracledb.getConnection(oracleConfig);
        console.log('✅ Oracle Connected Successfully!');

        console.log('🔄 Executing Master Customer Query...');
        const result = await connection.execute(
            MASTER_CUSTOMER_QUERY,
            [],
            { fetchArraySize: 2000 }
        );

        const rows = result.rows || [];
        console.log(`📊 Raw Rows Fetched from DB: ${rows.length}`);

        const uniqueCustomersMap = new Map();

        for (const item of rows) {
            const cleanPhone = String(item.MOBILE_NO || '').trim() || 'N/A';
            const mapKey = cleanPhone !== 'N/A' ? cleanPhone : `${item.CUSTOMER_NAME}_${item.CUSTOMER_CREATED_DATETIME}`;

            if (!uniqueCustomersMap.has(mapKey)) {
                uniqueCustomersMap.set(mapKey, {
                    phone: cleanPhone,
                    name: item.CUSTOMER_NAME || 'Unknown Customer',
                    email: item.EMAIL_ADDRESS || 'N/A',
                    address: item.CUSTOMER_ADDRESS || 'N/A',
                    shop: item.SHOP || 'N/A',
                    sbs_name: item.SBS_NAME || 'N/A',
                    created_at: item.CUSTOMER_CREATED_DATETIME || null,
                    last_feedback: 'None'
                });
            }
        }

        const finalData = Array.from(uniqueCustomersMap.values());

        console.log(`✨ Total Unique Records After Map Deduplication: ${finalData.length}`);
        console.log('🔍 First Sample Output Record:', finalData[0] || 'No records returned');

        return finalData;

    } catch (error) {
        console.error('❌ Oracle Fetch Error:', error.message);
        return [];
    } finally {
        console.timeEnd('⏱️ Oracle Fetch Master Execution Time');
        if (connection) {
            try {
                await connection.close();
                console.log('🔌 Oracle Connection Closed.');
            } catch (closeErr) {
                console.error('Error closing Oracle connection:', closeErr.message);
            }
        }
    }
};