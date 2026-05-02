import { Message } from "../types";
import api from "./client";

export const getConversation = (otherUserId: number) =>
  api.get<Message[]>(`/chat/${otherUserId}`);

export const sendMessage = (data: { receiver_id: number; content: string }) =>
  api.post<Message>("/chat/", data);
