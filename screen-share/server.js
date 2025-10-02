const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store active sessions
const sessions = new Map();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/phone', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'phone.html'));
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Create new session
    socket.on('create-session', () => {
        const sessionId = uuidv4();
        sessions.set(sessionId, {
            pc: null,
            phone: null,
            createdAt: Date.now()
        });
        socket.join(sessionId);
        socket.emit('session-created', sessionId);
        console.log(`Session created: ${sessionId}`);
    });

    // Phone joins session
    socket.on('phone-join', (sessionId) => {
        if (sessions.has(sessionId)) {
            const session = sessions.get(sessionId);
            session.phone = socket.id;
            socket.join(sessionId);
            socket.to(sessionId).emit('phone-connected');
            console.log(`Phone joined session: ${sessionId}`);
        } else {
            socket.emit('error', 'Invalid session ID');
        }
    });

    // PC joins session
    socket.on('pc-join', (sessionId) => {
        if (sessions.has(sessionId)) {
            const session = sessions.get(sessionId);
            session.pc = socket.id;
            socket.join(sessionId);
            socket.emit('pc-joined');
            console.log(`PC joined session: ${sessionId}`);
        } else {
            socket.emit('error', 'Invalid session ID');
        }
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
        socket.to(data.sessionId).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
        socket.to(data.sessionId).emit('answer', data.answer);
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.sessionId).emit('ice-candidate', data.candidate);
    });

    // Control commands
    socket.on('control-command', (data) => {
        socket.to(data.sessionId).emit('control-command', data.command);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Clean up empty sessions
        for (let [sessionId, session] of sessions) {
            if (session.pc === socket.id || session.phone === socket.id) {
                sessions.delete(sessionId);
                io.to(sessionId).emit('session-ended');
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Phone links will work on your local network`);
    console.log(`💻 Access the controller at: http://localhost:${PORT}`);
});