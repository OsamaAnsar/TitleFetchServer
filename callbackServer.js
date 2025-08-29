const http = require('http');
const https = require('https');
const url = require('url');
const {
  normalizeURL,
  extractTitle,
  generateHTML,
  parseAddresses,
} = require('./utils');

const PORT = 3000;

function fetchTitle(address, callback) {
  const urlToFetch = normalizeURL(address);

  const parsedUrl = url.parse(urlToFetch);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.path || '/',
    method: 'GET',
    timeout: 10000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'identity',
      Connection: 'close',
    },
  };

  const req = client.request(options, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      const redirectUrl = res.headers.location;
      const fullRedirectUrl = redirectUrl.startsWith('http')
        ? redirectUrl
        : parsedUrl.protocol + '//' + parsedUrl.host + redirectUrl;

      if (!options._redirectCount) options._redirectCount = 0;
      if (options._redirectCount < 3) {
        options._redirectCount++;
        return fetchTitle(fullRedirectUrl, callback);
      }
    }

    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        res.destroy();
        callback(null, { address, title: 'NO RESPONSE' });
        return;
      }
    });

    res.on('end', () => {
      const title = extractTitle(data);
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

  req.setTimeout(10000);
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

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === 'GET' && parsedUrl.pathname === '/I/want/title') {
    const addresses = parseAddresses(parsedUrl.query);

    if (addresses.length === 0) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(
        '<html><body><h1>Error: No addresses provided</h1></body></html>'
      );
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
  console.log(
    'Try: http://localhost:3000/I/want/title?address=github.com&address=bitbucket.com&address=56566'
  );
});
