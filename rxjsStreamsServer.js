const http = require('http');
const https = require('https');
const url = require('url');
const { from, mergeMap, toArray, of } = require('rxjs');
const { catchError, timeout } = require('rxjs/operators');
const {
  normalizeURL,
  getRequestOptions,
  extractTitle,
  generateHTML,
  parseAddresses,
} = require('./utils');

const PORT = 3004;

function fetchTitle(address) {
  return new Promise((resolve, reject) => {
    const urlToFetch = normalizeURL(address);
    const parsedUrl = url.parse(urlToFetch);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = getRequestOptions(parsedUrl);

    const req = client.request(options, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const redirectUrl = res.headers.location;
        const fullRedirectUrl = redirectUrl.startsWith('http')
          ? redirectUrl
          : parsedUrl.protocol + '//' + parsedUrl.host + redirectUrl;

        if (!options._redirectCount) options._redirectCount = 0;
        if (options._redirectCount < 3) {
          options._redirectCount++;
          return fetchTitle(fullRedirectUrl).then(resolve).catch(reject);
        }
      }

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
        if (data.length > 1024 * 1024) {
          res.destroy();
          resolve({ address, title: 'NO RESPONSE' });
          return;
        }
      });

      res.on('end', () => {
        const title = extractTitle(data);
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

    req.setTimeout(10000);
    req.end();
  });
}

function handleTitleRequestRx(addresses) {
  return from(addresses).pipe(
    mergeMap((address) =>
      from(fetchTitle(address)).pipe(
        timeout(11000), // 11 second timeout
        catchError((err) => of({ address, title: 'NO RESPONSE' }))
      )
    ),
    toArray()
  );
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

    // Using RxJS streams
    handleTitleRequestRx(addresses).subscribe({
      next: (results) => {
        const html = generateHTML(results);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      },
      error: (err) => {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Internal Server Error</h1></body></html>');
      },
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>404 Not Found</h1></body></html>');
  }
});

server.listen(PORT, () => {
  console.log(`RxJS Streams Server running on http://localhost:${PORT}`);
  console.log(
    'Try: http://localhost:3004/I/want/title?address=github.com&address=bitbucket.com&address=56566'
  );
});
