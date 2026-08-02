// configure and export socket.io instance
class SocketEmitter {
    static io = null;

    static setIo(io) {
        this.io = io;
    }
    static emitToRoom(room, event, data) {
        if (!this.io) {
            return;
        }
        this.io.to(room).emit(event, data);
    }
}

export default SocketEmitter;