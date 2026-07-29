const HARDCODED_TOKEN = 'A03E61C7A38041DFA3091723457621FE'; 

// Testing Hostname vs Root Paths
const TARGET_URLS = [
  'http://logo-rp/v1/rest/document?cols=sid,document_number,store_number&page_no=1&page_size=2',
  'http://127.0.0.1/PrismREST/v1/rest/document?cols=sid,document_number,store_number&page_no=1&page_size=2',
  'http://127.0.0.1:8080/v1/rest/document?cols=sid,document_number,store_number&page_no=1&page_size=2'
];

async function runLitmusTest() {
  for (const url of TARGET_URLS) {
    console.log(`\n🔍 Testing URL: ${url}`);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Auth-Session': HARDCODED_TOKEN,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      console.log(`📡 Status Code: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ BINGO! Path matched! Sample:', JSON.stringify(data).substring(0, 150));
        break;
      }
    } catch (err) {
      console.error(`💥 Error on ${url}:`, err.message);
    }
  }
}

runLitmusTest();