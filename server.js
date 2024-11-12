const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Configuration
const WEBAPP_PORT = process.env.PORT || 3000;

// Create Express app
const app = express();
app.use(express.json()); // To parse JSON bodies
app.use(express.static(path.join(__dirname, 'public')));

// REST API Endpoint to Receive Data from Jetson Nano
app.post('/api/data', (req, res) => {
  const data = req.body;

  // Validate and process data
  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }

  try {
    // Broadcast data to all WebSocket clients
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    });

    res.status(200).json({ message: 'Data received and broadcasted' });
  } catch (err) {
    console.error('Error broadcasting data:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server attached to the same HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Web application connected via WebSocket');
});

// Start HTTP and WebSocket server
server.listen(WEBAPP_PORT, () => {
  console.log(`Web application server running on port ${WEBAPP_PORT}`);
});
