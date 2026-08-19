import 'dotenv/config';
import oracledb from 'oracledb';
import normalizePhone from '../utils/numberFormatter.js';

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
        NVL(NULLIF(TRIM(NVL(TO_CHAR(d.first_name), '') || ' ' || NVL(TO_CHAR(d.last_name), '')), ''), 'N/A') AS CUSTOMER_NAME, 
        NVL(
            NULLIF(
                TRIM(
                    NVL(TO_CHAR(ca.address_1), '') || ' ' ||
                    NVL(TO_CHAR(ca.address_2), '') || ' ' ||
                    NVL(TO_CHAR(ca.address_3), '')
                ), ''
            ),
            'N/A'
        ) AS CUSTOMER_ADDRESS,
        NVL(p.phone_no, 'N/A') AS MOBILE_NO,
        NVL(ce.email_address, 'N/A') AS EMAIL_ADDRESS
    FROM rps.customer d 
    LEFT JOIN (
        SELECT cust_sid, phone_no,
               ROW_NUMBER() OVER (PARTITION BY cust_sid ORDER BY sid DESC) as rn
        FROM rps.customer_phone
    ) p ON d.sid = p.cust_sid AND p.rn = 1
    LEFT JOIN (
        SELECT cust_sid, address_1, address_2, address_3,
               ROW_NUMBER() OVER (PARTITION BY cust_sid ORDER BY sid DESC) as rn
        FROM rps.customer_address
    ) ca ON d.sid = ca.cust_sid AND ca.rn = 1
    LEFT JOIN (
        SELECT cust_sid, email_address,
               ROW_NUMBER() OVER (PARTITION BY cust_sid ORDER BY sid DESC) as rn
        FROM rps.customer_email
    ) ce ON d.sid = ce.cust_sid AND ce.rn = 1
    INNER JOIN rps.store s ON d.store_sid = s.sid AND d.sbs_sid = s.sbs_sid 
    INNER JOIN rps.subsidiary ss ON ss.sid = d.sbs_sid
    WHERE 1=1
    ORDER BY d.created_datetime DESC
`;

export const fetchMasterCustomers = async () => {
    let connection;

    try {
        connection = await oracledb.getConnection(oracleConfig);

        // Fetch Array Size memory throughput optimize karta hai
        const result = await connection.execute(
            MASTER_CUSTOMER_QUERY,
            [],
            { fetchArraySize: 2000 }
        );

        const rows = result.rows || [];
        // console.log("Rows: ", rows);
        const uniqueCustomersMap = new Map();

        // O(N) Deduplication
        for (const item of rows) {
            const rawPhone = String(item.MOBILE_NO || '').trim();
            const cleanPhone = rawPhone !== '' ? rawPhone : 'N/A';

            // Key selection based on Phone OR Name fallback
            const mapKey = cleanPhone !== 'N/A' ? normalizePhone(cleanPhone) : `${item.CUSTOMER_NAME}_${item.CUSTOMER_CREATED_DATETIME}`;

            if (!uniqueCustomersMap.has(mapKey)) {
                uniqueCustomersMap.set(mapKey, {
                    phone: normalizePhone(cleanPhone),
                    name: item.CUSTOMER_NAME || 'Unknown Customer',
                    email: item.EMAIL_ADDRESS || 'N/A',
                    address: item.CUSTOMER_ADDRESS || 'N/A',
                    shop: item.SHOP || 'N/A',
                    sbs_name: item.SBS_NAME || 'N/A',
                    created_at: item.CUSTOMER_CREATED_DATETIME || null,

                });
            }
        }

        return Array.from(uniqueCustomersMap.values());

    } catch (error) {
        console.error('❌ Oracle Fetch Error:', error.message);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error('Error closing Oracle connection:', closeErr.message);
            }
        }
    }
};