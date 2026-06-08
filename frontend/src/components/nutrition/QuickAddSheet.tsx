import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import EditNoteIcon from "@mui/icons-material/EditNote";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

import {
  analyzePhoto,
  analyzeText,
  analyzeVoice,
  confirmAnalysis,
} from "../../api/mealAnalysis";
import { createMeal, getMeals } from "../../api/nutrition";
import { MEAL_TYPE_LABEL } from "../../locale/ruLabels";
import { AnalysisResponse, Meal, MealType, VoiceAnalysisResponse } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type Mode = "photo" | "voice" | "text";

const PICKER: { mode: Mode; label: string; hint: string; icon: JSX.Element }[] = [
  {
    mode: "photo",
    label: "Фото",
    hint: "Снимите или выберите фото блюда",
    icon: <CameraAltIcon />,
  },
  {
    mode: "voice",
    label: "Голос",
    hint: "Скажите, что ели — ИИ расшифрует",
    icon: <MicIcon />,
  },
  {
    mode: "text",
    label: "Текст",
    hint: "Кратко опишите блюдо",
    icon: <EditNoteIcon />,
  },
];

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function autoMealType(d = new Date()): MealType {
  const h = d.getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 21) return "dinner";
  return "snack";
}

const SUPPORTS_RECORDING =
  typeof window !== "undefined" &&
  typeof window.MediaRecorder !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;

export default function QuickAddSheet({ open, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);

  // Step 1: input collection.
  const [text, setText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoNote, setPhotoNote] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Step 2: analysis result + confirm form.
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [transcribed, setTranscribed] = useState<string | null>(null);
  const [dishName, setDishName] = useState("");
  const [grams, setGrams] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");

  // Step 2 — meal selection.
  const [todaysMeals, setTodaysMeals] = useState<Meal[]>([]);
  const [selectedMealId, setSelectedMealId] = useState<number | "new">("new");
  const [newMealType, setNewMealType] = useState<MealType>(autoMealType());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  useEffect(() => {
    if (analysis) {
      setDishName(analysis.dish_name);
      setGrams(String(Math.round(analysis.estimated_weight || 100)));
      setKcal(String(Math.round(analysis.calories ?? 0)));
      setProtein(String(Math.round(analysis.proteins ?? 0)));
      setFat(String(Math.round(analysis.fats ?? 0)));
      setCarbs(String(Math.round(analysis.carbs ?? 0)));
    }
  }, [analysis]);

  // Load today's meals once we reach the confirm step so the user can pick
  // an existing meal or fall back to a freshly-created one.
  useEffect(() => {
    if (!analysis) return;
    const today = format(new Date(), "yyyy-MM-dd");
    getMeals(today)
      .then((res) => {
        setTodaysMeals(res.data);
        if (res.data.length === 0) {
          setSelectedMealId("new");
        }
      })
      .catch(() => {
        setTodaysMeals([]);
        setSelectedMealId("new");
      });
  }, [analysis]);

  const reset = () => {
    setMode(null);
    setText("");
    setPhotoFile(null);
    setPhotoNote("");
    setAudioBlob(null);
    setAnalysis(null);
    setTranscribed(null);
    setError("");
    setSuccess(null);
    setBusy(false);
    setDishName("");
    setGrams("");
    setKcal("");
    setProtein("");
    setFat("");
    setCarbs("");
    setTodaysMeals([]);
    setSelectedMealId("new");
    setNewMealType(autoMealType());
    if (recorderRef.current && recording) {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
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
    } catch {
      setError("Доступ к микрофону запрещён в браузере.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const handleAnalyzeError = (e: unknown) => {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 503) {
      setError("AI-распознавание временно недоступно.");
      return;
    }
    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    setError(detail || "ИИ сейчас недоступен.");
  };

  const runAnalysis = async () => {
    setError("");
    setSuccess(null);
    setBusy(true);
    try {
      if (mode === "text") {
        if (text.trim().length < 2) {
          setError("Опишите блюдо хотя бы в нескольких словах.");
          return;
        }
        const res = await analyzeText(text.trim());
        setAnalysis(res.data);
      } else if (mode === "photo") {
        if (!photoFile) {
          setError("Сначала выберите фото.");
          return;
        }
        const res = await analyzePhoto(photoFile, photoNote || undefined);
        setAnalysis(res.data);
      } else if (mode === "voice") {
        if (!audioBlob) {
          setError("Сначала запишите или выберите аудио.");
          return;
        }
        const res = await analyzeVoice(audioBlob);
        const data = res.data as VoiceAnalysisResponse;
        setTranscribed(data.transcribed_text);
        setAnalysis(data);
      }
    } catch (e: unknown) {
      handleAnalyzeError(e);
    } finally {
      setBusy(false);
    }
  };

  const saveConfirmed = async () => {
    setError("");
    if (!dishName.trim()) {
      setError("Укажите название блюда.");
      return;
    }
    const numericGrams = Number(grams);
    if (!Number.isFinite(numericGrams) || numericGrams <= 0) {
      setError("Укажите положительную массу в граммах.");
      return;
    }
    setBusy(true);
    try {
      let mealId: number;
      if (selectedMealId === "new") {
        const today = format(new Date(), "yyyy-MM-dd");
        const created = await createMeal({ date: today, meal_type: newMealType });
        mealId = created.data.id;
      } else {
        mealId = selectedMealId;
      }
      await confirmAnalysis(mealId, {
        dish_name: dishName.trim().slice(0, 200),
        estimated_weight: numericGrams,
        calories: Math.max(0, Number(kcal) || 0),
        proteins: Math.max(0, Number(protein) || 0),
        fats: Math.max(0, Number(fat) || 0),
        carbs: Math.max(0, Number(carbs) || 0),
      });
      setSuccess(`Добавлено: ${dishName} · ${Math.round(Number(kcal) || 0)} ккал`);
      onSaved?.();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 503) {
        setError("AI-распознавание временно недоступно.");
      } else {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || "Не удалось сохранить приём пищи.");
      }
    } finally {
      setBusy(false);
    }
  };

  const canAnalyze =
    !!mode &&
    !busy &&
    ((mode === "text" && text.trim().length >= 2) ||
      (mode === "photo" && !!photoFile) ||
      (mode === "voice" && !!audioBlob));

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          px: 2,
          pt: 1.5,
          pb: "calc(16px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "92vh",
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 4,
          borderRadius: 2,
          bgcolor: "divider",
          mx: "auto",
          mb: 1.5,
        }}
      />

      {/* Mode picker — only when no mode selected and no analysis yet. */}
      {!mode && !analysis && (
        <>
          <Typography variant="h6" fontWeight={800} mb={0.5}>
            Быстрое добавление приёма пищи
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            ИИ подставит калории и БЖУ — проверьте и подтвердите.
          </Typography>
          <Stack spacing={1.25}>
            {PICKER.map((p) => (
              <ButtonBase
                key={p.mode}
                onClick={() => setMode(p.mode)}
                sx={{
                  width: "100%",
                  justifyContent: "flex-start",
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  p: 1.5,
                  gap: 1.5,
                  textAlign: "left",
                  "&:hover": { borderColor: "primary.main" },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                  }}
                >
                  {p.icon}
                </Box>
                <Box flex={1}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {p.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.hint}
                  </Typography>
                </Box>
              </ButtonBase>
            ))}
          </Stack>
        </>
      )}

      {/* Input step. */}
      {mode && !analysis && (
        <>
          <Stack direction="row" alignItems="center" spacing={0.5} mb={1}>
            <IconButton size="small" onClick={() => !busy && setMode(null)} disabled={busy}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h6" fontWeight={800}>
              {mode === "photo" && "Фото"}
              {mode === "voice" && "Голос"}
              {mode === "text" && "Текст"}
            </Typography>
          </Stack>

          {mode === "text" && (
            <TextField
              autoFocus
              multiline
              minRows={4}
              fullWidth
              placeholder="например, гречка с курицей, ~350 г"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
          )}

          {mode === "photo" && (
            <Stack spacing={1.25} alignItems="stretch">
              <Stack direction="row" spacing={1}>
                <Button
                  component="label"
                  variant="outlined"
                  size="large"
                  startIcon={<CameraAltIcon />}
                  disabled={busy}
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
                  size="large"
                  disabled={busy}
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
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={URL.createObjectURL(photoFile)}
                    alt={photoFile.name}
                    style={{
                      display: "block",
                      width: "100%",
                      maxHeight: 220,
                      objectFit: "cover",
                    }}
                  />
                </Box>
              )}
              <TextField
                label="Комментарий к фото (необязательно)"
                placeholder="например: порция около 300 г, добавлено масло"
                value={photoNote}
                onChange={(e) => setPhotoNote(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={2}
                disabled={busy}
              />
            </Stack>
          )}

          {mode === "voice" && !SUPPORTS_RECORDING && (
            <Alert severity="info">
              Запись не поддерживается в этом браузере, используйте текст или фото.
            </Alert>
          )}

          {mode === "voice" && SUPPORTS_RECORDING && (
            <Stack spacing={1.25}>
              {!recording && (
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<MicIcon />}
                  onClick={startRecording}
                  disabled={busy}
                >
                  {audioBlob ? "Перезаписать" : "Записать голос"}
                </Button>
              )}
              {recording && (
                <Button
                  color="error"
                  variant="contained"
                  size="large"
                  startIcon={<StopIcon />}
                  onClick={stopRecording}
                >
                  Остановить запись
                </Button>
              )}
              <Button component="label" size="small" variant="text" disabled={busy}>
                или загрузить аудиофайл
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => setAudioBlob(e.target.files?.[0] ?? null)}
                />
              </Button>
              {audioBlob && (
                <Typography variant="caption" color="text.secondary">
                  Аудио готово ({Math.round(audioBlob.size / 1024)} КБ)
                </Typography>
              )}
            </Stack>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={runAnalysis}
              disabled={!canAnalyze}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {busy ? "Анализ…" : "Распознать"}
            </Button>
          </Box>
        </>
      )}

      {/* Confirm step. */}
      {analysis && (
        <Box sx={{ overflowY: "auto" }}>
          <Stack direction="row" alignItems="center" spacing={0.5} mb={1}>
            <IconButton
              size="small"
              onClick={() => {
                if (busy) return;
                setAnalysis(null);
                setTranscribed(null);
              }}
              disabled={busy}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h6" fontWeight={800}>
              Подтверждение
            </Typography>
          </Stack>

          {analysis.notes && (
            <Typography variant="caption" color="text.secondary" mb={1.25} display="block">
              {analysis.notes}
            </Typography>
          )}

          {transcribed && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Распознано: «{transcribed}»
            </Alert>
          )}

          <Stack spacing={1.25}>
            <TextField
              label="Название блюда"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={1}>
              <TextField
                label="Масса (г)"
                type="number"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ min: 1 }}
              />
              <TextField
                label="ккал"
                type="number"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ min: 0 }}
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
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Жиры, г"
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Углеводы, г"
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Stack>

            <FormControl fullWidth size="small">
              <InputLabel>Какой приём пищи?</InputLabel>
              <Select
                label="Какой приём пищи?"
                value={selectedMealId}
                onChange={(e) =>
                  setSelectedMealId(
                    e.target.value === "new" ? "new" : Number(e.target.value),
                  )
                }
              >
                {todaysMeals.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {MEAL_TYPE_LABEL[m.meal_type] ?? m.meal_type}
                    {m.name ? ` · ${m.name}` : ""} · {Math.round(m.total_calories)} ккал
                  </MenuItem>
                ))}
                <MenuItem value="new">+ Создать новый</MenuItem>
              </Select>
            </FormControl>

            {selectedMealId === "new" && (
              <FormControl fullWidth size="small">
                <InputLabel>Тип нового приёма</InputLabel>
                <Select
                  label="Тип нового приёма"
                  value={newMealType}
                  onChange={(e) => setNewMealType(e.target.value as MealType)}
                >
                  {MEAL_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {MEAL_TYPE_LABEL[t] ?? t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mt: 1.5 }}>
              {success}
            </Alert>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={onClose} disabled={busy} variant="outlined" sx={{ flex: 1 }}>
              Отмена
            </Button>
            <Button
              onClick={saveConfirmed}
              variant="contained"
              disabled={busy || !dishName.trim() || !grams}
              sx={{ flex: 2 }}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {busy ? "Сохранение…" : "Сохранить в приём пищи"}
            </Button>
          </Stack>
        </Box>
      )}
    </Drawer>
  );
}
