import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Dummy endpoint for Day 1
app.post('/api/payment-intent', (req, res) => {
  const { amount, merchant, agentId } = req.body;
  
  // Randomly approve or block for Day 1 demo
  const isApproved = Math.random() > 0.3;
  const status = isApproved ? 'APPROVED' : 'BLOCKED';
  const reason = isApproved ? 'Rules passed' : 'Randomly blocked by dummy engine';

  const transaction = {
    id: `tx_${Date.now()}`,
    amount,
    merchant,
    agentId,
    status,
    reason,
    timestamp: new Date().toISOString()
  };

  // Emit to all connected frontend clients
  io.emit('new_transaction', transaction);

  return res.status(200).json(transaction);
});

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log('Frontend connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Frontend disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
