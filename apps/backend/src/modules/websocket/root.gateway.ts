import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RootGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    client.join('global');
    client.emit('CONNECTION_ESTABLISHED', {
      status: 'ONLINE',
      clientId: client.id,
      serverTime: new Date().toISOString(),
      message: 'Kết nối Socket.IO gốc thành công',
    });
  }

  handleDisconnect(client: Socket) {
    // client disconnected
  }
}
