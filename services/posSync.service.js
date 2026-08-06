import 'dotenv/config';
import oracledb from 'oracledb';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const oracleConfig = {
    user: process.env.ORA_USER || 'reportuser',
    password: process.env.ORA_PASS || 'report',
    connectString: `${process.env.ORA_HOST || 'localhost'}:${process.env.ORA_PORT || '1521'}/${process.env.ORA_SERVICE_NAME || 'RPROODS.prism'}`
};

const roundTwoDecimal = (val) => {
    const num = parseFloat(val);
    if (Number.isNaN(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

const DELTA_SALES_QUERY = `
SELECT * FROM (
    SELECT 
        t.store_no as "Store No",
        t.Shop as "Shop Name", 
        t.store_address as "Store Address",
        t.cashier_login_name as "Cashier Personnal",
        t.datetime as "Date Time", 
        t.raw_created_datetime,
        t.Receipt as "Receipt No",
        t.Customer_Name as "Customer Name",
        t.Mobile_no as "Mobile No",
        t.product_name as "Product Name", 
        t.color as "Color",
        t.item_size as "Size", 
        t.quantity as "Quantity", 
        (t.item_disc + t.document_disc) as "Total Disc",
        t.sales_amount as "Sales Amount", 
        t.TAX as "Tax", 
        t.salestax as "Sales+Tax",
        t.sid as "DOC_SID",
        t.pos_fee as "POS Fee",
        t.comment2 as "FBR Invoice No.",
        (CASE 
            WHEN t.TENDER_COUNT = 1 THEN 
                (SELECT CASE WHEN X.TENDER_TYPE = 2 THEN 'Credit Card' ELSE TO_CHAR(X.TENDER_NAME) END
                 FROM RPS.TENDER X WHERE X.DOC_SID = t.sid AND ROWNUM = 1) 
            WHEN t.TENDER_COUNT = 2 THEN 
                (SELECT 'Split ' || LISTAGG(CASE WHEN Y.TENDER_TYPE = 2 THEN 'Credit Card' ELSE TO_CHAR(Y.TENDER_NAME) END, ' & ') 
                 WITHIN GROUP (ORDER BY Y.TENDER_NAME) 
                 FROM RPS.TENDER Y WHERE Y.DOC_SID = t.sid AND ROWNUM <= 2) 
            WHEN t.TENDER_COUNT > 2 THEN 'Split' 
        END) AS "Tender Name",
        DENSE_RANK() OVER (ORDER BY t.raw_created_datetime DESC, t.sid DESC) as rank_id
    FROM (
        SELECT 
            d.sid,
            ss.sbs_name,
            s.store_name AS Shop, 
            NVL(NULLIF(TRIM(NVL(TO_CHAR(s.address1), '') || ' ' || NVL(TO_CHAR(s.address2), '')), ''), TO_CHAR('N/A')) AS store_address,
            d.cashier_login_name,
            NVL(d.total_fee_amt, 0) AS pos_fee,
            d.store_no, 
            d.sbs_no, 
            TO_CHAR(d.created_datetime, 'YYYY-MM-DD"T"HH24:MI:SS') AS datetime,
            d.COMMENT2, 
            d.created_datetime as raw_created_datetime,
            d.doc_no AS Receipt, 
            NVL(d.UDF1_STRING,'N/A') AS "courier_name", 
            NVL(d.UDF2_STRING,'N/A') AS "payment_gateway", 
            NVL(NULLIF(TRIM(NVL(TO_CHAR(d.bt_first_name), '') || ' ' || NVL(TO_CHAR(d.bt_last_name), '')), ''), TO_CHAR('N/A')) AS Customer_Name, 
            NVL(TO_CHAR(d.bt_primary_phone_no), 'N/A') AS Mobile_no, 
            i.ATTRIBUTE as color, 
            i.ITEM_SIZE,
            i.DESCRIPTION1 AS product_code, 
            i.DESCRIPTION2 AS product_name, 
            i.alu, 
            i.orig_PRICE AS retail_price,
            (CASE WHEN i.item_type=2 THEN -i.qty ELSE i.qty END) AS quantity,
            (((DECODE(d.USE_VAT,1,I.ORIG_PRICE-NVL(I.ORIG_TAX_AMT,0),I.ORIG_PRICE)-DECODE(d.USE_VAT,1,I.PRICE-NVL(I.TAX_AMT,0),I.PRICE))* DECODE(I.ITEM_TYPE,1,I.QTY,-I.QTY))) AS item_disc, 
            ((((DECODE(d.USE_VAT,1,i.PRICE,I.PRICE+NVL(I.TAX_AMT,0)) * (NVL(d.DISC_PERC,0)/100))) * DECODE(I.ITEM_TYPE,2,-I.QTY,I.QTY))+(NVL(d.LTY_REDEEM_AMT, 0) / NVL(DI.CNT, 1))) AS document_disc,
            ((CASE WHEN d.use_vat=1 THEN i.price-nvl(i.tax_amt,0) ELSE i.price END) * (1-NVL(d.DISC_PERC,0)/100) * (CASE WHEN i.item_type=2 THEN -i.qty ELSE i.qty END)) * (1 + (NVL(d.shipping_amt,0) / NULLIF(SUM((CASE WHEN d.use_vat=1 THEN i.price-nvl(i.tax_amt,0) ELSE i.price END) * (1-NVL(d.DISC_PERC,0)/100) * ABS((CASE WHEN i.item_type=2 THEN -i.qty ELSE i.qty END))) OVER (PARTITION BY d.sid), 0))) - (NVL(d.LTY_REDEEM_AMT, 0) / NVL(DI.CNT, 1)) AS sales_amount, 
            ((I.TAX_AMT*(1-NVL(d.DISC_PERC,0)/100))* DECODE(I.ITEM_TYPE,2,-I.QTY,I.QTY)) AS TAX, 
            ((CASE WHEN d.use_vat=1 THEN i.price ELSE i.price+nvl(i.tax_amt,0) END) * ((1-NVL(d.DISC_PERC,0)/100)) * (CASE WHEN i.item_type=2 THEN -i.qty ELSE i.qty END)) * (1 + (NVL(d.shipping_amt,0) / NULLIF(SUM((CASE WHEN d.use_vat=1 THEN i.price ELSE i.price+nvl(i.tax_amt,0) END) * ((1-NVL(d.DISC_PERC,0)/100)) * (CASE WHEN i.item_type=2 THEN -i.qty ELSE i.qty END)) OVER (PARTITION BY d.sid), 0))) - (NVL(d.LTY_REDEEM_AMT, 0) / NVL(DI.CNT, 1)) AS salestax,
            (SELECT COUNT(DISTINCT X.TENDER_TYPE) FROM RPS.TENDER X WHERE X.DOC_SID = D.SID) AS TENDER_COUNT
        FROM rps.document d 
        INNER JOIN rps.document_item i ON d.sid=i.DOC_SID 
        INNER JOIN rps.invn_sbs_item ii ON i.INVN_SBS_ITEM_SID=ii.sid AND d.SUBSIDIARY_SID=ii.sbs_sid 
        INNER JOIN rps.store s ON d.store_sid=s.sid AND d.subsidiary_sid=s.sbs_sid 
        INNER JOIN (SELECT DI.DOC_SID AS SID, COUNT(DI.SID) AS CNT FROM rps.document_item DI GROUP BY DI.DOC_SID) DI ON D.SID = DI.SID
        INNER JOIN rps.subsidiary ss on ss.sid = d.subsidiary_sid
        WHERE 1=1
        AND (:targetStoreNo IS NULL OR d.store_no = :targetStoreNo)
        AND d.status > 3 AND d.is_held <> 1 AND d.doc_no > 0 AND d.receipt_type IN (0,1) AND S.ACTIVE=1 
        AND (d.order_doc_no IS NULL OR d.order_doc_no != 0)
        AND d.created_datetime >= :sinceDate
    ) t
) WHERE rank_id <= :maxDocuments
`;

export async function fetchNewSalesFromRetailPro(sinceDate, storeNo = null) {
    let connection;

    try {
        connection = await oracledb.getConnection(oracleConfig);

        await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'`);
        await connection.execute(`ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS'`);

        const lookbackDate = sinceDate instanceof Date ? sinceDate : new Date(Date.now() - 24 * 60 * 60 * 1000);

        const result = await connection.execute(
            DELTA_SALES_QUERY,
            {
                targetStoreNo: storeNo,
                sinceDate: { val: lookbackDate, type: oracledb.DATE },
                maxDocuments: 100
            },
            { fetchArraySize: 1000 }
        );

        const rawRows = result.rows || [];
        // console.log(`🔍 Oracle fetched ${rawRows.length} raw rows (lookback: ${lookbackDate.toISOString()})`);

        // 🔍 1. RAW ORACLE DB ROWS PRINT (Pehla level check)
        console.log("==================== RAW ORACLE ROWS ====================");
        console.dir(rawRows.slice(0, 5), { depth: null, colors: true });

        if (rawRows.length === 0) return [];

        const groupedDocumentsMap = rawRows.reduce((acc, row) => {
            const docSid = row.DOC_SID;

            // 🔍 EXACT TAX VALUE PRINT (Bina kisi Rounding / Modification ke)
            // console.log(`Receipt #${row['Receipt No']} | Item: ${row['Product Name']} | Exact Tax:`, row['Tax'], `| Type: ${typeof row['Tax']}`);

            if (!acc[docSid]) {
                acc[docSid] = {
                    document: {
                        DOC_SID: row.DOC_SID,
                        StoreNo: row['Store No'],
                        ShopName: row['Shop Name'],
                        ShopAddress: row['Store Address'],       // NAYA
                        CashierName: row['Cashier Personnal'],   // NAYA
                        DateTime: row['Date Time'],
                        ReceiptNo: row['Receipt No'],
                        FBRInvoiceNo: row['FBR Invoice No.'],   // NAYA
                        CustomerName: row['Customer Name'],
                        MobileNo: row['Mobile No'],
                        TenderName: row['Tender Name'],
                        posFee: row['POS Fee']
                    },
                    items: []
                };
            }


            // 🔍 EXACT ORACLE RAW ITEM CONSOLE DEBUG
            const rawQty = row['Quantity'];
            const rawSalesAmt = row['Sales Amount'];
            const calculatedUnitPrice = rawQty ? (rawSalesAmt / rawQty).toFixed(2) : rawSalesAmt;

            // console.log(`\n--- [ORACLE FETCH DEBUG] Receipt #${row['Receipt No']} ---`);
            // console.log(`📦 Item: ${row['Product Name']}`);
            // console.log(`🔢 Raw Quantity (Oracle):`, rawQty, `| Type: ${typeof rawQty}`);
            // console.log(`💰 Raw Sales Amount (Oracle):`, rawSalesAmt, `| Type: ${typeof rawSalesAmt}`);
            // console.log(`🏷️ Derived Unit Price (Sales/Qty):`, calculatedUnitPrice);
            // console.log(`--------------------------------------------------`);

            acc[docSid].items.push({
                productName: row['Product Name'],
                color: row.Color,
                size: row.Size,
                quantity: roundTwoDecimal(row.Quantity) || 1,
                totalDiscount: roundTwoDecimal(row['Total Disc']),
                salesAmount: roundTwoDecimal(row['Sales Amount']),
                tax: row['Tax'] ?? 0,
                totalWithTax: roundTwoDecimal(row['Sales+Tax'])
            });

            return acc;
        }, {});

        return Object.values(groupedDocumentsMap);

    } catch (error) {
        console.error('❌ Oracle Fetch Sales Error:', error.message);
        return [];
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error('Error closing Oracle connection:', closeErr.message);
            }
        }
    }
}

export function mapRetailProSaleToOurFormat(saleGroup) {
    const doc = saleGroup.document;
    const items = saleGroup.items;

    const price_excl_tax = roundTwoDecimal(items.reduce((sum, item) => sum + item.salesAmount, 0));
    const subtotal = roundTwoDecimal(items.reduce((sum, item) => sum + item.totalWithTax, 0));
    const taxTotal = roundTwoDecimal(items.reduce((sum, item) => sum + item.tax, 0));
    const discountTotal = roundTwoDecimal(items.reduce((sum, item) => sum + item.totalDiscount, 0));
    const payableTotal = roundTwoDecimal(items.reduce((sum, item) => sum + item.totalWithTax, 0));



    const rawTender = (doc.TenderName || 'Cash').trim();
    const lowerTender = rawTender.toLowerCase();

    let normalizedPaymentMode = rawTender; // Default to raw string ("Split Cash & Credit Card")

    if (lowerTender.includes('split')) {
        // Keep exact raw tender name OR set to 'Split' depending on your requirements
        normalizedPaymentMode = rawTender;
    } else if (lowerTender.includes('cash') || lowerTender.includes('cod')) {
        normalizedPaymentMode = 'Cash';
    } else if (lowerTender.includes('card') || lowerTender.includes('credit') || lowerTender.includes('debit')) {
        normalizedPaymentMode = 'Card';
    }

    const formattedPayload = {
        storeId: doc.StoreNo || 3,
        shopName: doc.ShopName || null,
        shopAddress: doc.ShopAddress !== 'N/A' ? doc.ShopAddress : null,
        cashierName: doc.CashierName || null,
        invoiceNo: `${doc.ReceiptNo}`,
        fbrInvoiceNo: doc.FBRInvoiceNo || null,
        idempotencyKey: `rp-${doc.DOC_SID}`,
        billTo: doc.CustomerName !== 'N/A' ? doc.CustomerName : 'Walk-in Customer',
        customerPhone: doc.MobileNo !== 'N/A' ? doc.MobileNo : null,
        paymentMode: normalizedPaymentMode,
        items: items.map(item => ({
            name: `${item.productName}${item.color || item.size ? ` (${item.color || ''}/${item.size || ''})` : ''}`,
            qty: item.quantity,
            price: item.quantity > 0 ? roundTwoDecimal(item.totalWithTax / item.quantity) : item.totalWithTax,
            gst_percent: item.tax // Exact float value from Oracle (0.47619)
        })),
        summary: {
            price_excl_tax: price_excl_tax,
            total: subtotal,
            discount: discountTotal,
            gst: taxTotal,
            posFee: doc.posFee || 0,
            payable: roundTwoDecimal(payableTotal + (doc.posFee || 0))
        }
    };

    // 🔍 EXACT TERMINAL CHECK LOG
    // console.log(`\n>>> MAPPED PAYLOAD FOR RECEIPT #${formattedPayload.invoiceNo} <<<`);
    // console.dir(formattedPayload, { depth: null, colors: true });

    return formattedPayload;


}