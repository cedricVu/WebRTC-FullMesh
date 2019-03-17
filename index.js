const express = require('express');
const server = express();
const http = require('http').Server(server);
const io = require('socket.io')(http);

server.use(express.static('public'));

http.listen(3000, () => {
    console.log('Server started at: 3000');
});

server.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
    socket.on('signaling', function(data) {
        io.to(data.toId).emit('signaling', { fromId: socket.id, ...data });
    });
    socket.on('new-subscribe', function(data) {
        io.to(data.toId).emit('new-subscribe', { fromId: socket.id, ...data });
    });
    socket.on('disconnect', function() {
        io.sockets.emit('user-left', socket.id)
    });
});
