const http = require('http');
const https = require('https');
const url = require('url');
const { from, mergeMap, toArray, of } = require('rxjs'); // npm install rxjs
const { catchError, timeout } = require('rxjs/operators');

const PORT = 3004;

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

function handleTitleRequestRx(addresses) {
  return from(addresses).pipe(
    // Transform each address into a title fetch observable
    mergeMap(address => 
      from(fetchTitle(address)).pipe(
        timeout(6000), // 6 second timeout
        catchError(err => of({ address, title: 'NO RESPONSE' }))
      )
    ),
    // Collect all results into an array
    toArray()
  );
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
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>404 Not Found</h1></body></html>');
  }
});

server.listen(PORT, () => {
  console.log(`RxJS Streams Server running on http://localhost:${PORT}`);
  console.log('Try: http://localhost:3004/I/want/title/?address=google.com&address=github.com');
});

// Alternative RxJS implementation with more stream operations:
/*
function handleTitleRequestAdvancedRx(addresses) {
  return from(addresses).pipe(
    // Add delay between requests if needed
    // concatMap(address => of(address).pipe(delay(100))),
    
    // Transform to title fetch requests
    mergeMap(address => 
      from(fetchTitle(address)).pipe(
        timeout(6000),
        catchError(err => {
          console.log(`Error fetching ${address}:`, err.message);
          return of({ address, title: 'NO RESPONSE' });
        })
      ), 
      3 // Limit concurrent requests to 3
    ),
    
    // Filter out empty results if needed
    // filter(result => result.title !== 'NO RESPONSE'),
    
    // Collect results
    toArray(),
    
    // Transform to HTML
    map(results => generateHTML(results))
  );
}
*/