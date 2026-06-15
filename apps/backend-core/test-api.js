const fs = require('fs');
const path = require('path');
const app = require('./src/app');
const db = require('./src/config/db');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

let server;

// Helper to handle fetch calls using node's built-in http module (compatible with all Node.js versions)
function makeRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const http = require('http');
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Core Backend Integration Tests ---');
  
  // 1. Verify DB connectivity and bootstrap tables
  try {
    await db.query('SELECT 1');
    console.log('✔ PostgreSQL connection established.');
    
    // Read and run schema.sql to initialize tables
    const schemaPath = path.join(__dirname, 'src', 'models', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSql);
    console.log('✔ Database schema initialized/verified.');

    // Clear test tables to ensure clean test runs
    await db.query('TRUNCATE TABLE messages, channels, server_members, servers, users CASCADE');
    console.log('✔ Database reset for testing.');
  } catch (err) {
    console.error('❌ PostgreSQL connection or schema bootstrapping failed.');
    console.error('Ensure PostgreSQL is running and credentials in environment are correct.');
    console.error(err.message);
    process.exit(1);
  }

  // 2. Start Express test server
  server = app.listen(PORT, async () => {
    console.log(`✔ Test server listening on port ${PORT}`);

    try {
      // Test A: Health Check
      const health = await makeRequest('GET', '/health');
      if (health.status !== 200) throw new Error('Health check failed');
      console.log('✔ Test Passed: Health check OK');

      // Test B: User Register & Login
      const userAData = { username: 'alice', email: 'alice@example.com', password: 'password123' };
      const userBData = { username: 'bob', email: 'bob@example.com', password: 'password123' };

      const regA = await makeRequest('POST', '/api/auth/register', userAData);
      if (regA.status !== 201) throw new Error(`Alice register failed: ${JSON.stringify(regA.body)}`);
      const tokenA = regA.body.token;
      console.log('✔ Test Passed: Alice registered successfully');

      const regB = await makeRequest('POST', '/api/auth/register', userBData);
      if (regB.status !== 201) throw new Error(`Bob register failed: ${JSON.stringify(regB.body)}`);
      const tokenB = regB.body.token;
      console.log('✔ Test Passed: Bob registered successfully');

      const loginA = await makeRequest('POST', '/api/auth/login', { email: 'alice@example.com', password: 'password123' });
      if (loginA.status !== 200) throw new Error('Alice login failed');
      console.log('✔ Test Passed: Alice logged in successfully');

      // Test C: Server Creation
      const server1 = await makeRequest('POST', '/api/servers', { name: 'Alice Server' }, tokenA);
      if (server1.status !== 201) throw new Error('Alice server creation failed');
      const server1Id = server1.body.server.id;
      console.log(`✔ Test Passed: Alice Server created (ID: ${server1Id})`);

      const server2 = await makeRequest('POST', '/api/servers', { name: 'Bob Server' }, tokenB);
      if (server2.status !== 201) throw new Error('Bob server creation failed');
      const server2Id = server2.body.server.id;
      console.log(`✔ Test Passed: Bob Server created (ID: ${server2Id})`);

      // Test D: Channel Creation (Allowed for member, Forbidden for non-member)
      const channel1 = await makeRequest('POST', `/api/servers/${server1Id}/channels`, { name: 'general', type: 'text' }, tokenA);
      if (channel1.status !== 201) throw new Error('Alice general channel creation failed');
      const channel1Id = channel1.body.channel.id;
      console.log(`✔ Test Passed: Alice general channel created (ID: ${channel1Id})`);

      // Bob tries to create channel in Alice's server (EXPECT 403 Forbidden)
      const bobsIntrusion = await makeRequest('POST', `/api/servers/${server1Id}/channels`, { name: 'bob-hack', type: 'text' }, tokenB);
      if (bobsIntrusion.status === 403) {
        console.log('✔ Test Passed: Bob was BLOCKED from creating channel in Alice Server (403 Forbidden)');
      } else {
        throw new Error(`Tenant Isolation Failed: Bob was not blocked (Status: ${bobsIntrusion.status})`);
      }

      // Test E: Message Fetch and Tenant Isolation
      // Insert a mock message directly in DB sent by Alice
      await db.query(
        'INSERT INTO messages (channel_id, server_id, sender_id, content) VALUES ($1, $2, $3, $4)',
        [channel1Id, server1Id, regA.body.user.id, 'Hello Alice Server!']
      );

      // Alice fetches messages from her channel
      const aliceGetMsgs = await makeRequest('GET', `/api/channels/${channel1Id}/messages`, null, tokenA);
      if (aliceGetMsgs.status !== 200 || aliceGetMsgs.body.messages.length === 0) {
        throw new Error('Alice failed to fetch messages from her channel');
      }
      console.log('✔ Test Passed: Alice retrieved channel messages successfully');

      // Bob tries to fetch messages from Alice's channel (EXPECT 403 Forbidden)
      const bobGetMsgs = await makeRequest('GET', `/api/channels/${channel1Id}/messages`, null, tokenB);
      if (bobGetMsgs.status === 403) {
        console.log('✔ Test Passed: Bob was BLOCKED from fetching messages from Alice Channel (403 Forbidden)');
      } else {
        throw new Error(`Tenant Isolation Failed: Bob fetched messages from Alice channel (Status: ${bobGetMsgs.status})`);
      }

      // Test F: S3 Presigned URL Generation and Tenant Isolation
      // Alice gets presigned upload URL for her channel
      const aliceS3Upload = await makeRequest('POST', '/api/files/presign', {
        action: 'upload',
        channelId: channel1Id,
        filename: 'notes.txt',
        contentType: 'text/plain'
      }, tokenA);
      if (aliceS3Upload.status !== 200 || !aliceS3Upload.body.uploadUrl) {
        throw new Error('Alice failed to get S3 upload presigned URL');
      }
      const fileKey = aliceS3Upload.body.key;
      console.log(`✔ Test Passed: Alice generated upload URL successfully. Key: ${fileKey}`);

      // Bob tries to get presigned upload URL for Alice's channel (EXPECT 403 Forbidden)
      const bobS3Upload = await makeRequest('POST', '/api/files/presign', {
        action: 'upload',
        channelId: channel1Id,
        filename: 'bobs_hack.exe',
        contentType: 'application/octet-stream'
      }, tokenB);
      if (bobS3Upload.status === 403) {
        console.log('✔ Test Passed: Bob was BLOCKED from generating S3 upload URL for Alice Channel (403 Forbidden)');
      } else {
        throw new Error(`Tenant Isolation Failed: Bob generated S3 upload URL for Alice channel (Status: ${bobS3Upload.status})`);
      }

      // Bob tries to get presigned download URL using Alice's key (EXPECT 403 Forbidden)
      const bobS3Download = await makeRequest('POST', '/api/files/presign', {
        action: 'download',
        key: fileKey
      }, tokenB);
      if (bobS3Download.status === 403) {
        console.log('✔ Test Passed: Bob was BLOCKED from generating S3 download URL for Alice key (403 Forbidden)');
      } else {
        throw new Error(`Tenant Isolation Failed: Bob generated S3 download URL for Alice file key (Status: ${bobS3Download.status})`);
      }

      // Test G: Voice Credentials and Tenant Isolation
      // Alice gets voice credentials
      const aliceVoice = await makeRequest('GET', `/api/servers/${server1Id}/voice-credentials`, null, tokenA);
      if (aliceVoice.status !== 200 || !aliceVoice.body.iceServers) {
        throw new Error('Alice failed to get voice credentials');
      }
      console.log('✔ Test Passed: Alice fetched voice credentials successfully');

      // Bob tries to get voice credentials for Alice's server (EXPECT 403 Forbidden)
      const bobVoice = await makeRequest('GET', `/api/servers/${server1Id}/voice-credentials`, null, tokenB);
      if (bobVoice.status === 403) {
        console.log('✔ Test Passed: Bob was BLOCKED from fetching voice credentials for Alice Server (403 Forbidden)');
      } else {
        throw new Error(`Tenant Isolation Failed: Bob fetched voice credentials for Alice server (Status: ${bobVoice.status})`);
      }

      console.log('\n⭐⭐⭐ ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ⭐⭐⭐');
      cleanup(0);
    } catch (err) {
      console.error('\n❌ INTEGRATION TEST FAILED:', err.message);
      cleanup(1);
    }
  });
}

function cleanup(code) {
  if (server) {
    server.close(() => {
      console.log('Test server shut down.');
      db.pool.end(() => {
        console.log('Database pool connection closed.');
        process.exit(code);
      });
    });
  } else {
    process.exit(code);
  }
}

runTests();
