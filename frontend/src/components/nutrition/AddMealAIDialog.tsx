import CameraAltIcon from "@mui/icons-material/CameraAlt";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";

import {
  analyzeMealPhoto,
  analyzeMealText,
  analyzeMealVoice,
  confirmAnalysis,
} from "../../api/nutrition";
import { MealAnalysis } from "../../types";

interface Props {
  mealId: number | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Mode = "text" | "photo" | "voice";

export default function AddMealAIDialog({ mealId, open, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [transcribed, setTranscribed] = useState<string | null>(null);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Editable fields populated from the AI prediction.
  const [dishName, setDishName] = useState("");
  const [grams, setGrams] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  useEffect(() => {
    if (analysis) {
      setDishName(analysis.dish_name);
      setGrams(String(analysis.estimated_weight));
      setKcal(String(analysis.calories));
      setProtein(String(analysis.proteins));
      setFat(String(analysis.fats));
      setCarbs(String(analysis.carbs));
    }
  }, [analysis]);

  const reset = () => {
    setMode("text");
    setText("");
    setPhotoFile(null);
    setAudioBlob(null);
    setTranscribed(null);
    setAnalysis(null);
    setError("");
    setDishName("");
    setGrams("");
    setKcal("");
    setProtein("");
    setFat("");
    setCarbs("");
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError("Доступ к микрофону запрещён в браузере.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const runAnalysis = async () => {
    setError("");
    setAnalysis(null);
    setLoading(true);
    try {
      if (mode === "text") {
        if (text.trim().length < 2) {
          setError("Опишите блюдо хотя бы в нескольких словах.");
          return;
        }
        const res = await analyzeMealText(text.trim());
        setAnalysis(res.data);
      } else if (mode === "photo") {
        if (!photoFile) {
          setError("Сначала выберите фото.");
          return;
        }
        const res = await analyzeMealPhoto(photoFile);
        setAnalysis(res.data);
      } else {
        if (!audioBlob) {
          setError("Сначала запишите или выберите аудио.");
          return;
        }
        const res = await analyzeMealVoice(audioBlob);
        setTranscribed(res.data.transcribed_text);
        setAnalysis(res.data);
      }
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "ИИ сейчас недоступен.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!mealId) return;
    setSaving(true);
    setError("");
    try {
      await confirmAnalysis(mealId, {
        dish_name: dishName,
        estimated_weight: Number(grams),
        calories: Number(kcal),
        proteins: Number(protein),
        fats: Number(fat),
        carbs: Number(carbs),
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Не удалось сохранить позицию.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Добавить еду с помощью ИИ</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Tabs
          value={mode}
          onChange={(_, v) => {
            setMode(v);
            setAnalysis(null);
            setTranscribed(null);
          }}
          variant="fullWidth"
        >
          <Tab value="text" label="Текст" />
          <Tab value="photo" label="Фото" />
          <Tab value="voice" label="Голос" />
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {mode === "text" && (
            <TextField
              autoFocus
              multiline
              minRows={3}
              fullWidth
              label="Опишите блюдо"
              placeholder="например, гречка с курицей и овощами, ~350 г"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}

          {mode === "photo" && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CameraAltIcon />}
                  sx={{ flex: 1 }}
                >
                  Камера
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </Button>
                <Button
                  component="label"
                  variant={photoFile ? "contained" : "outlined"}
                  sx={{ flex: 1 }}
                >
                  {photoFile ? "Заменить" : "Галерея"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </Button>
              </Stack>
              {photoFile && (
                <Typography variant="body2" color="text.secondary">
                  {photoFile.name} ({Math.round(photoFile.size / 1024)} KB)
                </Typography>
              )}
            </Stack>
          )}

          {mode === "voice" && (
            <Stack spacing={2}>
              {!recording && (
                <Button
                  variant="outlined"
                  startIcon={<MicIcon />}
                  onClick={startRecording}
                >
                  Записать голос
                </Button>
              )}
              {recording && (
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<StopIcon />}
                  onClick={stopRecording}
                >
                  Остановить запись
                </Button>
              )}
              <Button component="label" variant="text" size="small">
                или загрузить аудиофайл
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setAudioBlob(f);
                  }}
                />
              </Button>
              {audioBlob && (
                <Typography variant="body2" color="text.secondary">
                  Аудио готово ({Math.round(audioBlob.size / 1024)} КБ)
                </Typography>
              )}
              {transcribed && (
                <Alert severity="info">Распознано: «{transcribed}»</Alert>
              )}
            </Stack>
          )}

          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={runAnalysis}
              variant="contained"
              disabled={loading}
            >
              {loading ? "Анализ…" : "Распознать"}
            </Button>
          </Box>

          {loading && (
            <Box display="flex" justifyContent="center" mt={2}>
              <CircularProgress size={24} />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {analysis && (
            <>
              <Divider sx={{ my: 2 }}>Предсказание ИИ (можно править)</Divider>
              <Stack spacing={1.5}>
                <TextField
                  label="Название блюда"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  fullWidth
                  size="small"
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Граммы"
                    type="number"
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="ккал"
                    type="number"
                    value={kcal}
                    onChange={(e) => setKcal(e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Белки, г"
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Жиры, г"
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Углеводы, г"
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Stack>
                {analysis.notes && (
                  <Typography variant="caption" color="text.secondary">
                    Примечания: {analysis.notes}
                  </Typography>
                )}
              </Stack>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          onClick={save}
          variant="contained"
          disabled={!analysis || saving || !dishName || !grams}
        >
          {saving ? "Сохранение…" : "Сохранить в дневник"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
