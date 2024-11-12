const net = require('net');
const WebSocket = require('ws');
const express = require('express');
const path = require('path');

// Configuration
const JETSON_PORT = process.env.PORT || 443;       // Port used by the Jetson Nano
const WEBSOCKET_PORT =process.env.PORT || 443;
const WEBAPP_PORT = process.env.PORT || 443;

// Create a TCP server to accept connection from Jetson Nano
const tcpServer = net.createServer((client) => {
  console.log('Jetson Nano connected');

  // Buffer to accumulate data chunks
  let buffer = '';

  client.on('data', (data) => {
    buffer += data.toString();
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const message = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      try {
        const parsedMessage = JSON.parse(message);

        // Broadcast the message to all connected WebSocket clients
        wss.clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(parsedMessage));
          }
        });
      } catch (err) {
        console.error('Error parsing JSON data:', err);
      }
    }
  });

  client.on('end', () => {
    console.log('Jetson Nano disconnected');
  });

  client.on('error', (err) => {
    console.error('TCP client error:', err);
  });
});

tcpServer.listen(JETSON_PORT, () => {
  console.log(`TCP server listening on port ${JETSON_PORT}`);
});

// WebSocket Server to communicate with the web application
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

wss.on('connection', (ws) => {
  console.log('Web application connected via WebSocket');
});

// Serve the web application using Express
const app = express();
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory
app.listen(WEBAPP_PORT, () => {
  console.log(`Web application server running on port ${WEBAPP_PORT}`);
});
