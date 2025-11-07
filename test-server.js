#!/usr/bin/env node

/**
 * Simple HTTP server to serve X1 signing test page
 * Run: node test-server.js
 * Then visit: http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HTML_FILE = path.join(__dirname, 'x1-test-signing.html');

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Serve the HTML file
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(HTML_FILE, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading test page');
        return;
      }

      res.setHeader('Content-Type', 'text/html');
      res.writeHead(200);
      res.end(content);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(80));
  console.log('🧪 X1 Transaction Signing Test Server');
  console.log('='.repeat(80));
  console.log(`📡 Server running at: http://localhost:${PORT}`);
  console.log('');
  console.log('Instructions:');
  console.log('  1. Load the Backpack extension from packages/app-extension/build/');
  console.log('  2. Make sure X1 JSON server is running on port 4000');
  console.log('  3. Visit http://localhost:3000 in your browser');
  console.log('  4. Connect your wallet and test signing');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('='.repeat(80));
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down test server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
