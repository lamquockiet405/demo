import { io, Socket } from "socket.io-client";

// The gateway uses the default namespace. In production nginx proxies
// /socket.io on the frontend origin; join:kitchen selects the tenant room.
const SOCKET_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

let socket: Socket | null = null;

export const getKitchenSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionDelay: 2000,
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log(
        "🟢 [WebSocket] Đã kết nối thành công tới KDS Kitchen Gateway:",
        socket?.id,
      );
    });

    socket.on("disconnect", (reason) => {
      console.warn("🔴 [WebSocket] Mất kết nối tới Kitchen Gateway:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("⚠️ [WebSocket] Lỗi kết nối Socket.IO:", error.message);
    });
  }

  return socket;
};
