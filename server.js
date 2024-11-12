// server.js
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Endpoint to receive maze data
app.post('/api/maze', (req, res) => {
    const mazeData = req.body;
    console.log('Received Maze Data:', mazeData);
    // TODO: Process maze data as needed
    res.status(200).send({ status: 'Maze data received successfully' });
});

// Endpoint to receive car data
app.post('/api/cars', (req, res) => {
    const carData = req.body;
    console.log('Received Car Data:', carData);
    // TODO: Process car data as needed
    res.status(200).send({ status: 'Car data received successfully' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
