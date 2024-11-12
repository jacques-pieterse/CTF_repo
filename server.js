const WebSocket = require('ws');
const express = require('express');
const path = require('path');

// Configuration
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8080;
const WEBAPP_PORT = process.env.PORT || 3000;

// Create a WebSocket server to accept connections from Jetson Nano and web clients
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

wss.on('connection', (ws, req) => {
  console.log('A client connected');

  // Identify the client type upon connection
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      
      // Handle initialization messages
      if (parsedMessage.type === 'init') {
        if (parsedMessage.clientType === 'jetson') {
          ws.isJetson = true;
          console.log('Jetson Nano connected via WebSocket');
        } else if (parsedMessage.clientType === 'web') {
          ws.isWebClient = true;
          console.log('Web client connected via WebSocket');
        }
        return; // Exit early after handling initialization
      }

      // If message is from Jetson Nano, broadcast to web clients
      if (ws.isJetson) {
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN && client.isWebClient) {
            client.send(JSON.stringify(parsedMessage));
          }
        });
      }

      // If message is from web client, handle accordingly (if needed)
      // else if (ws.isWebClient) { /* Handle web client messages */ }

    } catch (err) {
      console.error('Error parsing JSON data:', err);
    }
  });

  ws.on('close', () => {
    if (ws.isJetson) {
      console.log('Jetson Nano disconnected');
    } else if (ws.isWebClient) {
      console.log('Web client disconnected');
    } else {
      console.log('A client disconnected');
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

wss.on('listening', () => {
  console.log(`WebSocket server listening on port ${WEBSOCKET_PORT}`);
});

// Serve the web application
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.listen(WEBAPP_PORT, () => {
  console.log(`Web application server running on port ${WEBAPP_PORT}`);
});
