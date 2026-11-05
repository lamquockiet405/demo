const http = require('http');

async function testAutoGenerate() {
  // Login as nutritionist Lê Hoài Nam
  const postData = JSON.stringify({ email: 'dinhduong@huongduong.edu.vn', password: '123456' });
  const loginReq = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(body);
      const token = parsed.data?.accessToken || parsed.accessToken;
      if (!token) {
        console.error('Login failed:', body);
        return;
      }
      console.log('Logged in as nutritionist successfully.');

      // Test auto-generate menu for next month (e.g. 2026-12-07 to 2026-12-11)
      const genPayload = JSON.stringify({
        title: 'Thực đơn thử nghiệm kiểm tra ràng buộc bữa ăn',
        ageGroup: 'MAU_GIAO',
        startDate: '2026-12-07',
        endDate: '2026-12-11',
        daysCount: 5,
        includeBreakfast: true,
        previewOnly: false
      });

      const autoGenReq = http.request({
        hostname: '127.0.0.1',
        port: 3001,
        path: '/api/v1/menus/auto-generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(genPayload),
          'Authorization': 'Bearer ' + token
        }
      }, (gRes) => {
        let gBody = '';
        gRes.on('data', chunk => gBody += chunk);
        gRes.on('end', () => {
          console.log('Auto-generate HTTP Status:', gRes.statusCode);
          console.log('Response body:', gBody.substring(0, 500));
        });
      });
      autoGenReq.write(genPayload);
      autoGenReq.end();
    });
  });
  loginReq.write(postData);
  loginReq.end();
}

testAutoGenerate();

