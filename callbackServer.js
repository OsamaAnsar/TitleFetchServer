const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;

function fetchTitle(address, callback) {
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
      callback(null, { address, title });
    });
  });

  req.on('error', (err) => {
    callback(null, { address, title: 'NO RESPONSE' });
  });

  req.on('timeout', () => {
    req.destroy();
    callback(null, { address, title: 'NO RESPONSE' });
  });

  req.setTimeout(5000);
  req.end();
}

function fetchAllTitles(addresses, callback) {
  const results = [];
  let completed = 0;
  const total = addresses.length;

  if (total === 0) {
    return callback(null, []);
  }

  addresses.forEach((address, index) => {
    fetchTitle(address, (err, result) => {
      results[index] = result;
      completed++;
      
      if (completed === total) {
        callback(null, results);
      }
    });
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

    fetchAllTitles(addresses, (err, results) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Internal Server Error</h1></body></html>');
        return;
      }

      const html = generateHTML(results);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>404 Not Found</h1></body></html>');
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Try: http://localhost:3000/I/want/title/?address=google.com&address=github.com');
});