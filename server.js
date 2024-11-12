const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

// Configuration
const SERVER_PORT = process.env.PORT || 443; // Use environment variable or default to 443

// SSL/TLS Certificates (Render handles SSL, so these can be omitted if Render manages SSL)
const options = {
  // Uncomment and configure if managing SSL manually
  // key: fs.readFileSync('/path/to/your/private.key'),
  // cert: fs.readFileSync('/path/to/your/certificate.crt'),
};

// Create an Express application
const app = express();

// Serve the web application using Express
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory

// Create an HTTPS server (Render handles SSL/TLS)
const server = https.createServer(options, app);

// Initialize WebSocket Server on the same HTTPS server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Client connected: ${ip}`);

  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);

      // If message is from Jetson, broadcast to web clients
      if (parsedMessage.from === 'jetson') {
        // Broadcast to all connected WebSocket clients except the sender
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(parsedMessage));
          }
        });
      }

      // If message is from web app, handle accordingly
      if (parsedMessage.from === 'webapp') {
        // Handle messages from web application if needed
        // Example: Send commands to Jetson Nano via WebSockets
        // You can implement logic here based on your application's needs
      }

    } catch (err) {
      console.error('Error parsing JSON message:', err);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${ip}`);
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error from ${ip}:`, err);
  });
});

// Start the HTTPS and WebSocket server
server.listen(SERVER_PORT, () => {
  console.log(`Server is listening on port ${SERVER_PORT}`);
});
