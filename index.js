const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./Actions');
const cors = require('cors');
const connectToMongo = require('./conection')
const CodeChange = require('./model')
connectToMongo();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));

app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
    // Map
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE,async ({ roomId, code, file}) => {
        try {
            
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
        
        const existingEntry  = await CodeChange.findOne({ roomId:roomId })

        if (existingEntry) {
            const existingFileIndex = await existingEntry.data.findIndex(
                (element) => element.filename === file)
                
                if(existingFileIndex < 0){
                existingEntry.data.unshift({
                    filename:file,
                    code  
                })
                await existingEntry.save();
    
            }else{
                existingEntry.data[existingFileIndex].code = code
                existingEntry.markModified('data'); 
                await existingEntry.save();
            }
        
          } else {
            const newEntry = new CodeChange({
              roomId,
              data: [{ filename: file, code: code }],
            });
            await newEntry.save();
          }
        } catch (error) {
            
        }
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
