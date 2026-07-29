import 'dotenv/config';


const RP_BASE_URL = process.env.RETAIL_PRO_URL || 'http://logo-rp';
const RP_USER = process.env.RETAIL_PRO_USER;
const RP_PASS = process.env.RETAIL_PRO_PASS;

let activeAuthSession = null;

async function getPrismAuthSession() {
    try {
        if (!RP_USER || !RP_PASS) {
            throw new Error('RETAIL_PRO_USER or RP_PASS missing in environment.');
        }

        const loginParams = new URLSearchParams({
            appid: 'Prism-API-Explorer',
            usr: RP_USER,
            pwd: RP_PASS, // Testing raw password if API endpoint expects cleartext or handles hashing internally
            singlesignon: 'false',
            ssoforcelogout: 'false',
            ws: 'webclient'
        });

        const loginUrl = `${RP_BASE_URL}/api/security/login?${loginParams.toString()}`;
        const basicAuth = Buffer.from(`${RP_USER}:${RP_PASS}`).toString('base64');

        const response = await fetch(loginUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Basic ${basicAuth}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Prism Login Failed (${response.status}): ${errText}`);
        }

        const sessionHeader = response.headers.get('auth-session') || response.headers.get('Auth-Session');
        if (sessionHeader) {
            console.log('🔑 Prism Security Auth-Session Established (Header):', sessionHeader);
            return sessionHeader;
        }

        const data = await response.json();
        let token = null;

        if (Array.isArray(data) && data.length > 0) {
            token = data[0].AuthSession || data[0].sid || data[0].SessionID || data[0].string;
        } else if (data && typeof data === 'object') {
            token = data.AuthSession || data.sid || data.SessionID || data.string;
        }

        if (!token) {
            throw new Error(`Auth-Session missing in login payload: ${JSON.stringify(data)}`);
        }

        console.log('🔑 Prism Security Auth-Session Established (Body):', token);
        return token;

    } catch (err) {
        console.error('❌ Retail Pro Security Login Error:', err.message);
        return null;
    }
}


// let lastSyncTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();

async function fetchNewSalesFromRetailPro() {
    try {
        if (!activeAuthSession) {
            activeAuthSession = await getPrismAuthSession();
        }

        if (!activeAuthSession) {
            console.error('❌ Sync skipped: Could not authenticate with Retail Pro.');
            return [];
        }

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth-Session': activeAuthSession,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        };

        // Added API-level sorting: sort=created_datetime,desc
        const targetUrl = `${RP_BASE_URL}/v1/rest/document?cols=*&sort=created_datetime,desc&page_no=1&page_size=50`;

        let response = await fetch(targetUrl, { headers });

        if (response.status === 401 || response.status === 403) {
            activeAuthSession = await getPrismAuthSession();
            if (activeAuthSession) {
                headers['Auth-Session'] = activeAuthSession;
                response = await fetch(targetUrl, { headers });
            }
        }

        if (!response.ok) {
            throw new Error(`Prism REST Error: ${response.status} ${response.statusText}`);
        }

        const documents = await response.json();

        if (!Array.isArray(documents)) return [];

        // Store 3 & completed sales filter
        const completedSales = documents.filter(doc => {
            const isStore3 = String(doc.store_number) === '3';
            return isStore3 &&
                doc.is_held === false &&
                doc.has_sale === true &&
                doc.has_return === false &&
                doc.document_number !== 0 &&
                doc.document_number != null;
        });

        const fullSales = await Promise.all(
            completedSales.map(async (doc) => {
                if (!doc.items || !Array.isArray(doc.items)) {
                    return { document: doc, items: [] };
                }
                const itemDetails = await Promise.all(
                    doc.items.map(async (itemRef) => {
                        try {
                            if (!itemRef.link) return null;
                            const itemResponse = await fetch(`${RP_BASE_URL}${itemRef.link}`, { headers });
                            if (!itemResponse.ok) return null;
                            const itemData = await itemResponse.json();
                            return Array.isArray(itemData) ? itemData[0] : itemData;
                        } catch (err) {
                            return null;
                        }
                    })
                );
                return { document: doc, items: itemDetails.filter(Boolean) };
            })
        );

        return fullSales;

    } catch (error) {
        console.error('❌ Retail Pro Fetch Error:', error.message);
        activeAuthSession = null;
        return [];
    }
}

function mapRetailProSaleToOurFormat(sale) {
    const { document, items } = sale;

    return {
        storeId: document.store_number || 1,
        invoiceNo: `${document.store_number}-${document.document_number}`,
        idempotencyKey: `rp-${document.sid}`,
        billTo: `${document.bt_first_name || ''} ${document.bt_last_name || ''}`.trim() || 'Walk-in Customer',
        customerPhone: document.bt_primary_phone_no || null,
        paymentMode: 'Cash',
        items: items.map(item => ({
            name: item.item_lookup || item.item_description1 || 'Item',
            qty: Number(item.quantity || 1),
            price: parseFloat(item.price || 0),
            gstPercent: parseFloat(item.tax_percent || 0)
        })),
        summary: {
            total: parseFloat(document.sale_subtotal || 0),
            discount: parseFloat(document.total_discount_amt || 0),
            gst: parseFloat(document.sale_total_tax_amt || 0),
            posFee: 1.00,
            payable: parseFloat(document.transaction_total_amt || 0)
        }
    };
}

export { fetchNewSalesFromRetailPro, mapRetailProSaleToOurFormat };