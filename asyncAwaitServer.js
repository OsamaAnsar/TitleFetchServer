const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3003;

async function fetchTitle(address) {
  return new Promise((resolve, reject) => {
    // Normalize the URL
    let urlToFetch = address;
    if (!address.startsWith('http://') && !address.startsWith('https://')) {
      urlToFetch = 'https://' + address;
    }

    const parsedUrl = url.parse(urlToFetch);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path || '/',
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Node.js Title Fetcher)'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const titleMatch = data.match(/<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'NO RESPONSE';
        resolve({ address, title });
      });
    });

    req.on('error', (err) => {
      resolve({ address, title: 'NO RESPONSE' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ address, title: 'NO RESPONSE' });
    });

    req.setTimeout(5000);
    req.end();
  });
}

function generateHTML(results) {
  const listItems = results.map(result => 
    `<li> ${result.address} - "${result.title}" </li>`
  ).join('\n');

  return `<html>
<head></head>
<body>
<ul>
<h1> Following are the titles of given websites: </h1>
${listItems}</ul>
</body>
</html>`;
}

async function handleTitleRequest(addresses) {
  try {
    // Fetch all titles concurrently using Promise.all with async/await
    const results = await Promise.all(
      addresses.map(address => fetchTitle(address))
    );
    return generateHTML(results);
  } catch (error) {
    throw new Error('Failed to fetch titles');
  }
}

// Alternative sequential approach (for demonstration):
async function handleTitleRequestSequential(addresses) {
  const results = [];
  for (const address of addresses) {
    try {
      const result = await fetchTitle(address);
      results.push(result);
    } catch (error) {
      results.push({ address, title: 'NO RESPONSE' });
    }
  }
  return generateHTML(results);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (req.method === 'GET' && parsedUrl.pathname === '/I/want/title') {
    const addresses = Array.isArray(parsedUrl.query.address) 
      ? parsedUrl.query.address 
      : parsedUrl.query.address ? [parsedUrl.query.address] : [];

    if (addresses.length === 0) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Error: No addresses provided</h1></body></html>');
      return;
    }

    try {
      const html = await handleTitleRequest(addresses);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Internal Server Error</h1></body></html>');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>404 Not Found</h1></body></html>');
  }
});

server.listen(PORT, () => {
  console.log(`Async/Await Server running on http://localhost:${PORT}`);
  console.log('Try: http://localhost:3003/I/want/title/?address=google.com&address=github.com');
});