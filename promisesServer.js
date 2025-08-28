const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3002;

function fetchTitle(address) {
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
      // Don't reject, return NO RESPONSE instead
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

const server = http.createServer((req, res) => {
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

    // Create promises for all addresses
    const titlePromises = addresses.map(address => fetchTitle(address));

    // Wait for all promises to resolve
    Promise.all(titlePromises)
      .then(results => {
        const html = generateHTML(results);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Internal Server Error</h1></body></html>');
      });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>404 Not Found</h1></body></html>');
  }
});

server.listen(PORT, () => {
  console.log(`Promises Server running on http://localhost:${PORT}`);
  console.log('Try: http://localhost:3002/I/want/title/?address=google.com&address=github.com');
});

// Alternative implementation using promise chaining:
/*
function handleRequest(addresses) {
  return Promise.resolve(addresses)
    .then(addrs => addrs.map(addr => fetchTitle(addr)))
    .then(promises => Promise.all(promises))
    .then(results => generateHTML(results));
}
*/