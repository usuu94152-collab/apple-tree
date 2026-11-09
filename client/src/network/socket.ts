import { io } from "socket.io-client";
import { Reply } from "../../../shared/protocol";
export const socket = io({ autoConnect: false });
export async function request(event: string, payload: unknown): Promise<Reply> {
  if (!socket.connected)
    throw Error("인터넷 연결을 기다려 주세요. 그림은 그대로 있어요.");
  return socket.timeout(7000).emitWithAck(event, payload);
}
