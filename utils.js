/**
 * URL normalization utilities for the title fetcher servers
 */
function normalizeURL(address) {
  // If already has protocol, return as is
  if (address.startsWith('http://') || address.startsWith('https://')) {
    return address;
  }

  // Remove any leading slashes
  address = address.replace(/^\/+/, '');

  // For major sites that require www, add it
  const requiresWWW = ['linkedin.com', 'facebook.com', 'instagram.com'];
  const needsWWW = requiresWWW.some(
    (site) => address === site || address.startsWith(site + '/')
  );

  if (needsWWW && !address.startsWith('www.')) {
    return 'https://www.' + address;
  }

  // For simple domains without subdomain, try www first
  const parts = address.split('/')[0].split('.');
  if (parts.length === 2 && !address.startsWith('www.')) {
    return 'https://www.' + address;
  }

  // Default to https
  return 'https://' + address;
}

/**
 * Common HTTP request options for better compatibility
 */
function getRequestOptions(parsedUrl) {
  return {
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
}

/**
 * Extract and clean title from HTML content
 */
function extractTitle(htmlContent) {
  const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/is);
  return titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'NO RESPONSE';
}

/**
 * Generate the final HTML response
 */
function generateHTML(results) {
  const listItems = results
    .map((result) => `<li> ${result.address} - "${result.title}" </li>`)
    .join('\n');

  return `<html>
  <head></head>
  <body>
  <ul>
  <h1> Following are the titles of given websites: </h1>
  ${listItems}</ul>
  </body>
  </html>`;
}

/**
 * Parse addresses from query parameters
 */
function parseAddresses(query) {
  return Array.isArray(query.address)
    ? query.address
    : query.address
    ? [query.address]
    : [];
}

module.exports = {
  normalizeURL,
  getRequestOptions,
  extractTitle,
  generateHTML,
  parseAddresses,
};
