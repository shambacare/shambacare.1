const { spawn } = require('child_process');
const path = require('path');

// Start Python AI service
const python = spawn('python', [path.join(__dirname, 'python-ai', 'app.py')]);
python.stdout.on('data', (data) => console.log(`[AI] ${data}`));
python.stderr.on('data', (data) => console.error(`[AI ERR] ${data}`));

// Start Node.js backend
require('./server.js');