// server.js
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

// Configuration
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8080; // Not used since we're integrating with HTTP server
const WEBAPP_PORT = process.env.PORT || 3000;

// Initialize Express App
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP Server
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = new WebSocket.Server({ noServer: true });

// Store WebSocket connections
let jetsonSocket = null; // To store the Jetson Nano WebSocket connection
const webClients = new Set(); // To store web client WebSocket connections

// Handle Upgrade Requests for WebSocket
server.on('upgrade', (request, socket, head) => {
  const { url } = request;

  if (url === '/jetson') {
    // Handle Jetson Nano WebSocket Connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      if (jetsonSocket) {
        // If a Jetson is already connected, reject the new connection
        ws.send(JSON.stringify({ error: 'Jetson Nano already connected.' }));
        ws.close();
        console.log('Rejected additional Jetson Nano connection.');
        return;
      }

      jetsonSocket = ws;
      console.log('Jetson Nano connected via WebSocket.');

      ws.on('message', (message) => {
        // Broadcast the received message to all web clients
        console.log('Received message from Jetson Nano:', message);
        broadcastToWebClients(message);
      });

      ws.on('close', () => {
        console.log('Jetson Nano disconnected.');
        jetsonSocket = null;
      });

      ws.on('error', (err) => {
        console.error('Jetson Nano WebSocket error:', err);
        jetsonSocket = null;
      });
    });
  } else if (url === '/ws') {
    // Handle Web Client WebSocket Connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      webClients.add(ws);
      console.log('Web application connected via WebSocket.');

      ws.on('close', () => {
        console.log('Web application disconnected.');
        webClients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('Web client WebSocket error:', err);
        webClients.delete(ws);
      });
    });
  } else {
    // Reject other WebSocket paths
    socket.destroy();
  }
});

// Function to broadcast messages to all web clients
function broadcastToWebClients(message) {
  for (const client of webClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Start the HTTP server
server.listen(WEBAPP_PORT, () => {
  console.log(`Server is listening on port ${WEBAPP_PORT}`);
});
