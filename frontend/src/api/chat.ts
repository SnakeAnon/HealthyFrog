import { Dialog, Message } from "../types";
import api from "./client";

export const getDialogs = () =>
  api.get<Dialog[]>("/chat/dialogs");

export const getConversation = (otherUserId: number) =>
  api.get<Message[]>(`/chat/${otherUserId}`);

export const sendMessage = (data: { receiver_id: number; content: string }) =>
  api.post<Message>("/chat/", data);

export const markRead = (otherUserId: number) =>
  api.post<{ marked: number }>(`/chat/${otherUserId}/read`);
