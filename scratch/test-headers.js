const axios = require('../apps/frontend/node_modules/axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA5ZjI4M2Q1LTM2YjUtNDM0Ni05YzFiLTM0OTg2ZTcxZTNkMCIsInVzZXJuYW1lIjoidGVzdGFnZW50IiwiaWF0IjoxNzgzNDExMDg1LCJleHAiOjE3ODM0MTQ2ODV9.AVlMhNk2cZeCdJZoXORliXay52ykHIisGtpnoa9zT08';

async function run() {
  try {
    const response = await axios.post('https://d2gqfyhv3cphx1.cloudfront.net/api/servers', 
      { name: 'BrowserHeaderServer' },
      {
        headers: {
          'Host': 'd2gqfyhv3cphx1.cloudfront.net',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'vi,en;q=0.9',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://d2gqfyhv3cphx1.cloudfront.net',
          'Referer': 'https://d2gqfyhv3cphx1.cloudfront.net/',
        }
      }
    );
    console.log('Success! Status:', response.status);
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Failed! Status:', error.response?.status);
    console.log('Headers:', error.response?.headers);
    console.log('Body:', error.response?.data);
  }
}

run();
