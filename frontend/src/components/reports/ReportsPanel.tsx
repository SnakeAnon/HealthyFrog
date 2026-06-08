import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getDailyReport,
  getRangeReport,
  getSummaryReport,
  getWeeklyReport,
} from "../../api/nutrition";
import { CalorieCounter, MealList } from "../nutrition";
import {
  DailyReport,
  DailyTotals,
  RangeReport,
  SummaryReport,
  WeeklyReport,
} from "../../types";

type Mode = "today" | "week" | "range";
type WeekChartView = "calories" | "macros";

const MAX_RANGE_DAYS = 366;

interface Props {
  /** Hide outer «Reports» title when embedded (e.g. Diary drawer). */
  embedded?: boolean;
}

export function ReportsPanel({ embedded = false }: Props) {
  const [mode, setMode] = useState<Mode>("today");

  const [rangeFrom, setRangeFrom] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [rangeTo, setRangeTo] = useState(format(new Date(), "yyyy-MM-dd"));

  return (
    <Box>
      {!embedded && (
        <Typography variant="h6" fontWeight={800} gutterBottom>
          Отчёты
        </Typography>
      )}

      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, v: Mode | null) => v && setMode(v)}
        size="small"
        fullWidth
        sx={{ mb: 2 }}
      >
        <ToggleButton value="today">Сегодня</ToggleButton>
        <ToggleButton value="week">Неделя</ToggleButton>
        <ToggleButton value="range">Период</ToggleButton>
      </ToggleButtonGroup>

      {mode === "today" && <TodayView />}
      {mode === "week" && (
        <WeekView
          onOpenAsPeriod={(from, to) => {
            setRangeFrom(from);
            setRangeTo(to);
            setMode("range");
          }}
        />
      )}
      {mode === "range" && (
        <RangeView
          from={rangeFrom}
          to={rangeTo}
          setFrom={setRangeFrom}
          setTo={setRangeTo}
        />
      )}
    </Box>
  );
}

function TodayView() {
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDailyReport(today)
      .then((r) => {
        if (!cancelled) setReport(r.data);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить отчёт за сегодня.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={2}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!report) return null;

  return (
    <>
      <CalorieCounter
        title="Сегодня"
        loggedKcal={report.total_calories}
        macros={{
          protein: report.total_protein,
          fat: report.total_fat,
          carbs: report.total_carbs,
        }}
      />
      <MealList
        meals={report.meals}
        title="Приёмы пищи за сегодня"
        emptyMessage="Пока ничего не записано."
      />
    </>
  );
}

function WeekView({
  onOpenAsPeriod,
}: {
  onOpenAsPeriod: (from: string, to: string) => void;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<WeekChartView>("calories");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getWeeklyReport()
      .then((r) => {
        if (!cancelled) setReport(r.data);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить недельный отчёт.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={2}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!report) return null;

  const data = report.days.map((d) => ({
    date: d.date,
    label: format(parseISO(d.date), "EEE d", { locale: ru }),
    calories: Math.round(d.total_calories),
    protein: Math.round(d.total_protein),
    fat: Math.round(d.total_fat),
    carbs: Math.round(d.total_carbs),
  }));

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            {report.period_start} → {report.period_end}
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
            {report.total_calories.toFixed(0)} ккал
          </Typography>
          <Typography variant="body2" color="text.secondary">
            в среднем {report.average_daily_calories.toFixed(0)} ккал/день · с данными{" "}
            {report.days_with_data}/{report.days.length} дн.
          </Typography>
          <Stack direction="row" spacing={1} mt={1}>
            <Chip size="small" label={`P ${report.total_proteins.toFixed(0)}g`} />
            <Chip size="small" label={`F ${report.total_fats.toFixed(0)}g`} />
            <Chip size="small" label={`C ${report.total_carbs.toFixed(0)}g`} />
          </Stack>
          {report.summary && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {report.summary}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              Последние 7 дней
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={view}
              exclusive
              onChange={(_, v: WeekChartView | null) => v && setView(v)}
            >
              <ToggleButton value="calories">По калориям</ToggleButton>
              <ToggleButton value="macros">По БЖУ</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Box height={240}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip />
                {view === "calories" ? (
                  <Bar dataKey="calories" fill="#5ad98a" radius={[4, 4, 0, 0]} />
                ) : (
                  <>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="protein" stackId="m" fill="#5ad98a" />
                    <Bar dataKey="fat" stackId="m" fill="#f4a261" />
                    <Bar dataKey="carbs" stackId="m" fill="#7aa2f7" />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Button
            variant="text"
            size="small"
            sx={{ mt: 1 }}
            onClick={() => onOpenAsPeriod(report.period_start, report.period_end)}
          >
            Открыть как период →
          </Button>
        </CardContent>
      </Card>
    </Stack>
  );
}

function RangeView({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [range, setRange] = useState<RangeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const valid = useMemo(() => {
    if (!from || !to) return { ok: false, reason: "Укажите обе даты." };
    if (from > to) return { ok: false, reason: "Начало позже конца периода." };
    const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
    if (days > MAX_RANGE_DAYS)
      return { ok: false, reason: `Не более ${MAX_RANGE_DAYS} дней.` };
    return { ok: true as const };
  }, [from, to]);

  const fetchData = async () => {
    if (!valid.ok) return;
    setLoading(true);
    setError("");
    try {
      const [s, r] = await Promise.all([
        getSummaryReport({ from, to }),
        getRangeReport({ from, to }),
      ]);
      setSummary(s.data);
      setRange(r.data);
    } catch {
      setError("Не удалось загрузить отчёты за период.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (valid.ok) {
      void fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days: DailyTotals[] = range?.days ?? [];
  const lineData = days.map((d) => ({
    date: d.date,
    label: format(parseISO(d.date), "d MMM", { locale: ru }),
    kcal: Math.round(d.total_calories),
  }));

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="С"
              type="date"
              size="small"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: today }}
              fullWidth
            />
            <TextField
              label="По"
              type="date"
              size="small"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: today }}
              fullWidth
            />
          </Stack>
          <Button
            variant="contained"
            sx={{ mt: 1.5 }}
            disabled={!valid.ok || loading}
            onClick={fetchData}
            title={!valid.ok ? valid.reason : undefined}
          >
            {loading ? "Загрузка…" : "Показать"}
          </Button>
          {!valid.ok && from && to && (
            <Typography variant="caption" color="error" sx={{ ml: 1 }}>
              {valid.reason}
            </Typography>
          )}
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {summary && (
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              {summary.period_start} → {summary.period_end}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
              {summary.total_calories.toFixed(0)} ккал
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ср. {summary.avg_calories.toFixed(0)} · мин. {summary.min_calories.toFixed(0)} · макс.{" "}
              {summary.max_calories.toFixed(0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              с данными {summary.days_logged}/{summary.days_total} дн.
            </Typography>
            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
              <Chip size="small" label={`Б ср. ${summary.avg_protein.toFixed(0)} г`} />
              <Chip size="small" label={`Ж ср. ${summary.avg_fat.toFixed(0)} г`} />
              <Chip size="small" label={`У ср. ${summary.avg_carbs.toFixed(0)} г`} />
            </Stack>
          </CardContent>
        </Card>
      )}

      {range && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Калории по дням
            </Typography>
            {lineData.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Нет данных за выбранный период.
              </Typography>
            ) : (
              <Box height={220}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={20}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip formatter={(v) => [`${Number(v)} ккал`, "Калории"]} />
                    <Line
                      type="monotone"
                      dataKey="kcal"
                      stroke="#5ad98a"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
