import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import InsightsIcon from "@mui/icons-material/Insights";
import CloseIcon from "@mui/icons-material/Close";
import TodayIcon from "@mui/icons-material/Today";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Fab,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AddMealAIDialog, CalorieCounter, MealList } from "../components/nutrition";
import { ReportsPanel } from "../components/reports/ReportsPanel";
import { addDays, format, isSameDay, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import { LayoutOutletContext } from "../components/Layout";
import {
  createMeal,
  getMeals,
} from "../api/nutrition";
import { MEAL_TYPE_LABEL } from "../locale/ruLabels";
import { Meal, MealType } from "../types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/** Return an array of `count` dates centered on `center` */
function buildDateStrip(center: Date, count = 7): Date[] {
  const half = Math.floor(count / 2);
  return Array.from({ length: count }, (_, i) => addDays(center, i - half));
}

export default function Diary() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reportsOpen, setReportsOpen] = useState(searchParams.get("reports") === "1");

  useEffect(() => {
    if (searchParams.get("reports") === "1") setReportsOpen(true);
  }, [searchParams]);

  const openReports = () => {
    setReportsOpen(true);
    setSearchParams({ reports: "1" }, { replace: true });
  };

  const closeReports = () => {
    setReportsOpen(false);
    setSearchParams({}, { replace: true });
  };

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [stripCenter, setStripCenter] = useState(today);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stripRef = useRef<HTMLDivElement>(null);

  // Add-meal dialog
  const [mealDialog, setMealDialog] = useState(false);
  const [newMealType, setNewMealType] = useState<MealType>("breakfast");
  const [newMealName, setNewMealName] = useState("");
  const [savingMeal, setSavingMeal] = useState(false);

  const [aiDialog, setAiDialog] = useState<number | null>(null);

  const ctx = useOutletContext<LayoutOutletContext | null>();
  const refreshTick = ctx?.refreshTick ?? 0;

  const dayStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = isSameDay(selectedDate, today);
  const stripDates = buildDateStrip(stripCenter, 7);

  const selectDate = (d: Date) => {
    setSelectedDate(d);
    // Re-center strip only if selected date is at the edge
    const idx = stripDates.findIndex((s) => isSameDay(s, d));
    if (idx <= 0) setStripCenter(addDays(d, 3));
    else if (idx >= stripDates.length - 1) setStripCenter(subDays(d, 3));
  };

  const shiftStrip = (dir: -1 | 1) => {
    const next = addDays(stripCenter, dir * 7);
    setStripCenter(next);
    const newStrip = buildDateStrip(next, 7);
    // auto-select middle if currently selected falls outside new strip
    const stillVisible = newStrip.some((d) => isSameDay(d, selectedDate));
    if (!stillVisible) setSelectedDate(next);
  };

  const loadMeals = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getMeals(dayStr);
      setMeals(res.data);
    } catch {
      setError("Не удалось загрузить приёмы пищи.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadMeals(); }, [dayStr, refreshTick]);

  const handleAddMeal = async () => {
    setSavingMeal(true);
    try {
      await createMeal({ date: dayStr, meal_type: newMealType, name: newMealName || undefined });
      setMealDialog(false);
      setNewMealName("");
      await loadMeals();
    } catch {
      setError("Не удалось создать приём пищи.");
    } finally {
      setSavingMeal(false);
    }
  };

  const totalCalories = meals.reduce((s, m) => s + m.total_calories, 0);
  const totalP = meals.reduce((s, m) => s + m.total_protein, 0);
  const totalF = meals.reduce((s, m) => s + m.total_fat, 0);
  const totalC = meals.reduce((s, m) => s + m.total_carbs, 0);

  return (
    <Box>
      {/* ── Header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6" fontWeight={800}>Дневник</Typography>
        <Stack direction="row" spacing={1}>
          {!isToday && (
            <IconButton
              size="small"
              onClick={() => { setSelectedDate(today); setStripCenter(today); }}
              title="Перейти к сегодня"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "10px",
                p: 0.75,
              }}
            >
              <TodayIcon fontSize="small" />
            </IconButton>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<InsightsIcon />}
            onClick={openReports}
            sx={{ borderRadius: "10px" }}
          >
            Отчёты
          </Button>
        </Stack>
      </Stack>

      {/* ── Date Strip ── */}
      <Card
        sx={{
          mb: 2,
          overflow: "hidden",
          borderRadius: "16px",
        }}
      >
        {/* Month label */}
        <Box
          sx={{
            px: 1.5,
            pt: 1.25,
            pb: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <IconButton
            size="small"
            onClick={() => shiftStrip(-1)}
            sx={{ p: 0.5, color: "text.secondary" }}
            aria-label="Предыдущая неделя"
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>

          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: "capitalize", letterSpacing: 0.5 }}
          >
            {format(stripCenter, "LLLL yyyy", { locale: ru })}
          </Typography>

          <IconButton
            size="small"
            onClick={() => shiftStrip(1)}
            sx={{ p: 0.5, color: "text.secondary" }}
            aria-label="Следующая неделя"
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Day chips */}
        <Box
          ref={stripRef}
          sx={{
            display: "flex",
            justifyContent: "space-around",
            px: 0.75,
            pb: 1.25,
            gap: 0.25,
          }}
        >
          {stripDates.map((d) => {
            const selected = isSameDay(d, selectedDate);
            const isT = isSameDay(d, today);
            return (
              <Box
                key={d.toISOString()}
                onClick={() => selectDate(d)}
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  borderRadius: "12px",
                  py: 0.75,
                  position: "relative",
                  bgcolor: selected
                    ? "primary.main"
                    : "transparent",
                  transition: "all 0.18s ease",
                  "&:hover": {
                    bgcolor: selected
                      ? "primary.dark"
                      : (t) => t.palette.mode === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                  },
                }}
              >
                {/* Weekday */}
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.62rem",
                    fontWeight: 600,
                    lineHeight: 1,
                    mb: 0.5,
                    color: selected ? "primary.contrastText" : "text.secondary",
                    textTransform: "capitalize",
                  }}
                >
                  {format(d, "EEEEE", { locale: ru })}
                </Typography>

                {/* Day number */}
                <Typography
                  variant="body2"
                  fontWeight={selected ? 800 : 500}
                  sx={{
                    fontSize: "0.92rem",
                    lineHeight: 1,
                    color: selected
                      ? "primary.contrastText"
                      : isT
                        ? "primary.main"
                        : "text.primary",
                  }}
                >
                  {format(d, "d")}
                </Typography>

                {/* Today dot */}
                {isT && !selected && (
                  <Box
                    sx={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      mt: 0.4,
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Card>

      {/* ── Calorie counter with animated date label ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={dayStr}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          <CalorieCounter
            title={isToday ? "Сегодня" : format(selectedDate, "d MMMM", { locale: ru })}
            loggedKcal={totalCalories}
            macros={{ protein: totalP, fat: totalF, carbs: totalC }}
          />
        </motion.div>
      </AnimatePresence>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <motion.div
          key={`meals-${dayStr}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <MealList
            meals={meals}
            onAdd={(mealId) => setAiDialog(mealId)}
            title="Приёмы пищи"
            emptyMessage="Пока нет приёмов. Нажмите + чтобы создать."
          />
        </motion.div>
      )}

      {/* ── FAB ── */}
      <Fab
        color="primary"
        sx={{
          position: "fixed",
          bottom: 72,
          right: 20,
          boxShadow: "0 4px 20px rgba(90,217,138,0.45)",
        }}
        onClick={() => setMealDialog(true)}
        title="Новый приём пищи"
      >
        <AddIcon />
      </Fab>

      {/* ── Add Meal Dialog ── */}
      <Dialog open={mealDialog} onClose={() => setMealDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Новый приём пищи</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Тип приёма</InputLabel>
            <Select
              value={newMealType}
              label="Тип приёма"
              onChange={(e) => setNewMealType(e.target.value as MealType)}
            >
              {MEAL_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {MEAL_TYPE_LABEL[t] ?? t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Название (необязательно)"
            value={newMealName}
            onChange={(e) => setNewMealName(e.target.value)}
            fullWidth
            placeholder="например, после тренировки"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMealDialog(false)}>Отмена</Button>
          <Button onClick={handleAddMeal} variant="contained" disabled={savingMeal}>
            {savingMeal ? "Добавление…" : "Добавить"}
          </Button>
        </DialogActions>
      </Dialog>

      <AddMealAIDialog
        open={aiDialog !== null}
        mealId={aiDialog}
        onClose={() => setAiDialog(null)}
        onSaved={loadMeals}
      />

      {/* ── Reports Drawer ── */}
      <Drawer
        anchor="right"
        open={reportsOpen}
        onClose={closeReports}
        PaperProps={{ sx: { width: "100%", maxWidth: 480 } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", p: 1, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1, pl: 1 }}>
            Отчёты
          </Typography>
          <IconButton onClick={closeReports} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ p: 2, overflowY: "auto", pb: 4 }}>
          <ReportsPanel embedded />
        </Box>
      </Drawer>
    </Box>
  );
}
