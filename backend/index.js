require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const socketIo = require('socket.io');
const http = require('http');
const User = require('./models/User'); 
const Message = require('./models/Message');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());

const mongoUrl = process.env.MONGO_URL;
mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  online: Boolean,
  status: String
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});


app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashedPassword, online: false, status: 'AVAILABLE' });
  await user.save();
  res.status(201).json({ message: 'User registered successfully' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(400).json({ message: 'Invalid password' });
  }
  const token = jwt.sign({ userId: user._id }, 'secret_key', { expiresIn: '1h' });
  res.json({ token, name: user.name }); 
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(403).json({ message: 'Token is missing' });
  }
  jwt.verify(token, 'secret_key', (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Token is invalid' });
    }
    req.userId = decoded.userId;
    next();
  });
};

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Token is missing'));
  }
  try {
    const decoded = jwt.verify(token, 'secret_key');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error('User not found'));
    }
    socket.username = user.name; 
    next();
  } catch (error) {
    return next(error);
  }
}).on('connection', socket => {
  console.log('User connected');

  User.findByIdAndUpdate(socket.userId, { online: true }, { new: true }, (err, user) => {
    if (err) {
      console.error(err);
    }
    io.emit('userStatus', { name: socket.username, online: true }); // Emitting user's name
  });

  socket.on('message', async data => {
    const message = new Message({ from: socket.username, to: data.to, content: data.content });
    await message.save();
    io.to(data.to).emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    User.findByIdAndUpdate(socket.userId, { online: false }, { new: true }, (err, user) => {
      if (err) {
        console.error(err);
      }
      io.emit('userStatus', { name: socket.username, online: false }); 
    });
  });
});

app.post('/api/status', verifyToken, async (req, res) => {
  const { status } = req.body;
  await User.findByIdAndUpdate(req.userId, { status });
  res.json({ message: 'User status updated successfully' });
});

app.post('/api/chat', verifyToken, async (req, res) => {
  const { to, message } = req.body;
  const recipient = await User.findOne({ name: to });
  if (!recipient || !recipient.online) {
    return res.status(400).json({ message: 'Recipient is unavailable' });
  }
  if (recipient.status === 'BUSY') {
    try {
      const response = await axios.post(process.env.Chat_API, { message });
      res.json({ response: response.data });
    } catch (error) {
      const standardMessage = await mockLLMResponse();
      res.json({ response: standardMessage });
    }
  } else {
    res.status(400).json({ message: 'Recipient is not busy' });
  }
});

const mockLLMResponse = () => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve('Sorry, I am currently busy. Please try again later.');
    }, 10000);
  });
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
