import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { motion } from "framer-motion";
import { addDays, format, parseISO, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

import { CaloriesChart, MacrosPie, WeightChart } from "../components/charts";
import EditWeightDialog from "../components/EditWeightDialog";
import { LayoutOutletContext } from "../components/Layout";
import { CalorieCounter, MealList } from "../components/nutrition";
import { getDailyReport, getRangeReport } from "../api/nutrition";
import { getWeightHistory, getWeightTrend } from "../api/users";
import { useAuth } from "../context/AuthContext";
import { DailyReport, DailyTotals, WeightLog, WeightTrend } from "../types";

const RANGE_DAYS = 7;
const WEIGHT_DAYS = 30;

function emptyDays(from: Date, to: Date): DailyTotals[] {
  const out: DailyTotals[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push({ date: format(d, "yyyy-MM-dd"), total_calories: 0, total_protein: 0, total_fat: 0, total_carbs: 0 });
  }
  return out;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

const fadeUp = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.07, duration: 0.38, ease: "easeOut" as const },
});

export default function Dashboard() {
  const { user, refreshUser, isTrainer } = useAuth();
  const navigate = useNavigate();
  const ctx = useOutletContext<LayoutOutletContext | undefined>();
  const refreshTick = ctx?.refreshTick ?? 0;

  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, "yyyy-MM-dd");
  const fromStr = format(subDays(today, RANGE_DAYS - 1), "yyyy-MM-dd");
  const weightFromStr = format(subDays(today, WEIGHT_DAYS - 1), "yyyy-MM-dd");

  const [report, setReport] = useState<DailyReport | null>(null);
  const [range, setRange] = useState<DailyTotals[] | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[] | null>(null);
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightDialog, setWeightDialog] = useState(false);

  useEffect(() => {
    if (isTrainer) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      getDailyReport(todayStr),
      getRangeReport({ from: fromStr, to: todayStr }),
      getWeightHistory(weightFromStr, todayStr),
      getWeightTrend(WEIGHT_DAYS),
    ]).then(([d, r, wh, wt]) => {
      if (cancelled) return;
      setReport(d.status === "fulfilled" ? d.value.data : null);
      setRange(r.status === "fulfilled" ? r.value.data.days : emptyDays(subDays(today, RANGE_DAYS - 1), today));
      setWeightLogs(wh.status === "fulfilled" ? wh.value.data : []);
      setWeightTrend(wt.status === "fulfilled" ? wt.value.data : null);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [todayStr, fromStr, weightFromStr, refreshTick, today, isTrainer]);

  // ─── Trainer view ───────────────────────────────────────────────
  if (isTrainer) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary">
          {format(new Date(), "EEEE, d MMMM", { locale: ru })}
        </Typography>
        <Typography variant="h6" fontWeight={800} mt={0.25} mb={2}>
          Панель тренера
        </Typography>
        <Stack spacing={1.5}>
          {[
            { path: "/trainers", title: "Мои клиенты", sub: "Отчёты по питанию и целям подопечных" },
            { path: "/chat", title: "Чат", sub: "Переписка с клиентами в реальном времени" },
            { path: "/diary", title: "Мой дневник", sub: "Собственное питание и отчёты" },
          ].map((item, i) => (
            <motion.div key={item.path} {...fadeUp(i)}>
              <Card>
                <CardActionArea onClick={() => navigate(item.path)}>
                  <CardContent>
                    <Typography fontWeight={700}>{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.sub}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </motion.div>
          ))}
        </Stack>
      </Box>
    );
  }

  // ─── Loading ────────────────────────────────────────────────────
  if (loading)
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress color="primary" />
      </Box>
    );

  const macros = report != null
    ? { protein: report.total_protein, fat: report.total_fat, carbs: report.total_carbs }
    : undefined;

  const weeklyKcal =
    range && range.length > 0
      ? Math.round(range.reduce((s, d) => s + d.total_calories, 0) / range.length)
      : 0;

  const trendDelta = weightTrend?.delta ?? null;
  const latestLog =
    weightLogs && weightLogs.length > 0
      ? weightLogs.reduce((a, b) => (a.date >= b.date ? a : b))
      : null;
  const currentWeight = latestLog?.weight ?? user?.weight ?? null;

  const firstName = user?.name?.split(" ")[0] ?? user?.email ?? "друг";

  return (
    <Box>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Typography variant="caption" color="text.secondary" letterSpacing={0.3}>
          {format(today, "EEEE, d MMMM", { locale: ru })}
        </Typography>
        <Typography variant="h6" fontWeight={800} mt={0.25} mb={2.5}>
          {getGreeting()}, {firstName} 👋
        </Typography>
      </motion.div>

      {/* Calorie ring */}
      <motion.div {...fadeUp(0)}>
        <CalorieCounter
          loggedKcal={report?.total_calories ?? 0}
          goalKcal={undefined}
          macros={macros}
        />
      </motion.div>

      {/* Weekly chart */}
      <motion.div {...fadeUp(1)}>
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                Последние {RANGE_DAYS} дней
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ≈ {weeklyKcal} ккал/день
              </Typography>
            </Stack>
            <CaloriesChart days={range ?? []} height={170} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Macros pie */}
      <motion.div {...fadeUp(2)}>
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              БЖУ за сегодня
            </Typography>
            <MacrosPie
              protein={report?.total_protein ?? 0}
              fat={report?.total_fat ?? 0}
              carbs={report?.total_carbs ?? 0}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Weight */}
      <motion.div {...fadeUp(3)}>
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>
                Вес
              </Typography>
              <IconButton size="small" onClick={() => setWeightDialog(true)} aria-label="Обновить вес">
                <EditIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap" mb={0.5}>
              <Typography variant="h4" fontWeight={800} color="secondary.light">
                {currentWeight != null ? currentWeight.toFixed(1) : "—"}
              </Typography>
              <Typography variant="body2" color="text.secondary">кг</Typography>
              {trendDelta != null && Math.abs(trendDelta) >= 0.05 && (
                <Chip
                  size="small"
                  label={`${trendDelta > 0 ? "+" : ""}${trendDelta.toFixed(1)} кг / ${WEIGHT_DAYS} дн.`}
                  color={trendDelta > 0 ? "warning" : "primary"}
                  variant="outlined"
                  sx={{ ml: "auto" }}
                />
              )}
            </Stack>

            {latestLog && (
              <Typography variant="caption" color="text.secondary">
                последняя запись {format(parseISO(latestLog.date), "d MMM", { locale: ru })}
              </Typography>
            )}

            <Box mt={1.5}>
              <WeightChart logs={weightLogs ?? []} height={160} />
            </Box>

            {(!weightLogs || weightLogs.length === 0) && (
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={() => setWeightDialog(true)}
                sx={{ mt: 1 }}
              >
                Записать вес за сегодня
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Meals */}
      <motion.div {...fadeUp(4)}>
        <MealList
          meals={report?.meals ?? []}
          title="Приёмы пищи за сегодня"
          emptyMessage="Пока пусто — нажмите + чтобы добавить."
        />
      </motion.div>

      {user?.role === "user" && user.trainer_id && (
        <motion.div {...fadeUp(5)}>
          <Card sx={{ mt: 2, borderColor: "primary.dark" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="body2" fontWeight={700} color="primary.light">
                Тренер назначен
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Свяжитесь через чат или запись на слот.
              </Typography>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <EditWeightDialog
        open={weightDialog}
        onClose={() => setWeightDialog(false)}
        initial={currentWeight}
        onSaved={async () => {
          await refreshUser();
          const [hist, trend] = await Promise.allSettled([
            getWeightHistory(weightFromStr, todayStr),
            getWeightTrend(WEIGHT_DAYS),
          ]);
          if (hist.status === "fulfilled") setWeightLogs(hist.value.data);
          if (trend.status === "fulfilled") setWeightTrend(trend.value.data);
        }}
      />
    </Box>
  );
}
