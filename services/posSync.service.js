import 'dotenv/config';
import oracledb from 'oracledb';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const oracleConfig = {
    user: process.env.ORA_USER || 'reportuser',
    password: process.env.ORA_PASS || 'report',
    connectString: `${process.env.ORA_HOST || '80.65.211.5'}:${process.env.ORA_PORT || '1521'}/${process.env.ORA_SERVICE_NAME || 'RPROODS.prism'}`
};

// Safety Helper: Converts null, undefined, or invalid numbers safely to 0
const safeNum = (val) => {
    const parsed = parseFloat(val);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const MAIN_SALES_QUERY = `
SELECT * FROM (
    SELECT 
        t.Shop as "Shop Name", 
        t.datetime as "Date Time", 
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
        (CASE 
            WHEN t.TENDER_COUNT = 1 THEN 
                (SELECT CASE WHEN X.TENDER_TYPE = 2 THEN 'Credit Card' ELSE TO_CHAR(X.TENDER_NAME) END
                 FROM RPS.TENDER X WHERE X.DOC_SID = t.sid AND ROWNUM = 1) 
            WHEN t.TENDER_COUNT = 2 THEN 
                (SELECT 'Split ' || LISTAGG(CASE WHEN Y.TENDER_TYPE = 2 THEN 'Credit Card' ELSE TO_CHAR(Y.TENDER_NAME) END, ' & ') 
                 WITHIN GROUP (ORDER BY Y.TENDER_NAME) 
                 FROM RPS.TENDER Y WHERE Y.DOC_SID = t.sid AND ROWNUM <= 2) 
            WHEN t.TENDER_COUNT > 2 THEN 'Split' 
        END) AS "Tender Name"
    FROM (
        SELECT 
            d.sid,
            ss.sbs_name,
            s.store_name AS Shop, d.store_no, d.sbs_no, 
            TO_CHAR(d.created_datetime, 'DD-MON-YYYY HH24:MI:SS') AS datetime,
            d.created_datetime,
            d.doc_no AS Receipt, nvl(d.UDF1_STRING,'N/A') AS "courier_name", 
            nvl(d.UDF2_STRING,'N/A') AS "payment_gateway", 
            NVL(NULLIF(TRIM(NVL(TO_CHAR(d.bt_first_name), '') || ' ' || NVL(TO_CHAR(d.bt_last_name), '')), ''), TO_CHAR('N/A')) AS Customer_Name, 
            d.bt_primary_phone_no AS Mobile_no, i.ATTRIBUTE as color, i.ITEM_SIZE,
            i.DESCRIPTION1 AS product_code, i.DESCRIPTION2 AS product_name, i.alu, i.orig_PRICE AS retail_price,
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
        AND d.store_no = 3
        AND d.status > 3 AND d.is_held <> 1 AND d.doc_no > 0 AND d.receipt_type IN (0,1) AND S.ACTIVE=1 
        AND (d.order_doc_no IS NULL OR d.order_doc_no != 0) 
        ORDER BY d.created_datetime DESC
    ) t
) WHERE ROWNUM <= 50
`;

export async function fetchNewSalesFromRetailPro() {
    let connection;

    try {
        connection = await oracledb.getConnection(oracleConfig);
        const result = await connection.execute(MAIN_SALES_QUERY);
        const rawRows = result.rows || [];

        if (rawRows.length === 0) return [];

        const groupedDocumentsMap = rawRows.reduce((acc, row) => {
            const docSid = row.DOC_SID;

            if (!acc[docSid]) {
                acc[docSid] = {
                    document: {
                        DOC_SID: row.DOC_SID,
                        ShopName: row['Shop Name'],
                        DateTime: row['Date Time'],
                        ReceiptNo: row['Receipt No'],
                        CustomerName: row['Customer Name'],
                        MobileNo: row['Mobile No'],
                        TenderName: row['Tender Name']
                    },
                    items: []
                };
            }

            acc[docSid].items.push({
                productName: row['Product Name'],
                color: row.Color,
                size: row.Size,
                quantity: safeNum(row.Quantity) || 1,
                totalDiscount: safeNum(row['Total Disc']),
                salesAmount: safeNum(row['Sales Amount']),
                tax: safeNum(row.Tax),
                totalWithTax: safeNum(row['Sales+Tax'])
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

    const subtotal = items.reduce((sum, item) => sum + safeNum(item.salesAmount), 0);
    const taxTotal = items.reduce((sum, item) => sum + safeNum(item.tax), 0);
    const discountTotal = items.reduce((sum, item) => sum + safeNum(item.totalDiscount), 0);
    const payableTotal = items.reduce((sum, item) => sum + safeNum(item.totalWithTax), 0);

    // Replace paymentMode logic with hard 10-character limit truncate:
    const rawTender = doc.TenderName || 'Cash';
    const tenderMap = {
        'Credit Card': 'Card',
        'COD': 'COD'
    };

    // Map tender value and strictly enforce a max length of 10 characters
    const normalizedPaymentMode = (tenderMap[rawTender] || rawTender).substring(0, 10);


    return {
        storeId: 3,
        invoiceNo: `${doc.ReceiptNo}`,
        idempotencyKey: `rp-${doc.DOC_SID}`,
        billTo: doc.CustomerName !== 'N/A' ? doc.CustomerName : 'Walk-in Customer',
        customerPhone: doc.MobileNo !== 'N/A' ? doc.MobileNo : null,
        paymentMode: normalizedPaymentMode,
        createdAt: doc.DateTime,
        items: items.map(item => {
            const amt = safeNum(item.salesAmount);
            const tx = safeNum(item.tax);
            const tot = safeNum(item.totalWithTax);

            return {
                name: `${item.productName} (${item.color}/${item.size})`,
                quantity: safeNum(item.quantity) || 1,
                amount: parseFloat(amt.toFixed(2)),
                tax: parseFloat(tx.toFixed(2)),
                total: parseFloat(tot.toFixed(2))
            };
        }),
        summary: {
            total: parseFloat(subtotal.toFixed(2)),
            discount: parseFloat(discountTotal.toFixed(2)),
            gst: parseFloat(taxTotal.toFixed(2)),
            posFee: 1.00,
            payable: parseFloat((payableTotal + 1.00).toFixed(2))
        }
    };
}