let reconnectInterval = 5000; // 5 seconds

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to WebSocket server');
    ws.send(JSON.stringify({ type: 'init', clientType: 'web' }));
  };

  ws.onmessage = (event) => {
    // Existing onmessage logic
  };

  ws.onclose = () => {
    console.log('Disconnected from WebSocket server. Attempting to reconnect in 5 seconds...');
    displayError('Disconnected from server. Reconnecting...');
    setTimeout(connectWebSocket, reconnectInterval);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    ws.close();
  };

  return ws;
}

// Initialize WebSocket connection
let ws = connectWebSocket();
