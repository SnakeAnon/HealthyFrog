import { AnalysisConfirm, AnalysisResponse, MealItem, VoiceAnalysisResponse } from "../types";
import api from "./client";

export const analyzeText = (text: string) =>
  api.post<AnalysisResponse>("/nutrition/analyze/text", { text });

export const analyzePhoto = (file: File, note?: string) => {
  const fd = new FormData();
  fd.append("file", file);
  if (note && note.trim()) fd.append("note", note.trim());
  // Intentionally do NOT set Content-Type — axios appends the multipart
  // boundary when the body is a FormData instance.
  return api.post<AnalysisResponse>("/nutrition/analyze/photo", fd);
};

export const analyzeVoice = (file: Blob, filename = "voice.webm") => {
  const fd = new FormData();
  fd.append("file", file, filename);
  return api.post<VoiceAnalysisResponse>("/nutrition/analyze/voice", fd);
};

export const confirmAnalysis = (mealId: number, payload: AnalysisConfirm) =>
  api.post<MealItem>(`/nutrition/analyze/${mealId}/confirm`, payload);
