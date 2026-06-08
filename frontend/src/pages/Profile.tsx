import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutIcon from "@mui/icons-material/Logout";
import EditIcon from "@mui/icons-material/Edit";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { logoutAll } from "../api/auth";
import { listMyAudit } from "../api/audit";
import { listMySessions, revokeSession } from "../api/sessions";
import { updateMe } from "../api/users";
import { getWeightHistory, getWeightTrend, recordWeight } from "../api/weight";
import { useAuth } from "../context/AuthContext";
import { USER_ROLE_LABEL } from "../locale/ruLabels";
import { AuditLog, Session, WeightLog, WeightTrend } from "../types";

type TabKey = "profile" | "weight" | "sessions" | "audit";

const AUDIT_PAGE = 20;

const ACTION_LABELS: Record<string, string> = {
  "user.register": "Регистрация аккаунта",
  "user.login": "Вход в систему",
  "user.logout": "Выход из системы",
  "user.logout_all": "Завершение всех сессий",
  "user.profile_update": "Изменение профиля",
  "user.assign_trainer": "Назначен тренер",
  "user.weight_log": "Запись веса",
  "meal.create": "Новый приём пищи",
  "meal.add_item": "Добавлен продукт в приём",
  "meal.analyze": "AI-распознавание блюда",
  "admin.user_update": "Админ: изменение пользователя",
  "admin.user_delete": "Админ: удаление пользователя",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function getInitials(name: string | null, email: string) {
  if (name) return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  return email[0]?.toUpperCase() ?? "?";
}

export default function Profile() {
  const { user } = useAuth();
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const [tab, setTab] = useState<TabKey>("profile");

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  const roleColor = user.role === "trainer" ? "secondary" : user.role === "admin" ? "warning" : "primary";

  return (
    <Box>
      {/* Avatar header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 2.5,
            p: 2,
            borderRadius: 3,
            background: dark
              ? "linear-gradient(135deg, rgba(90,217,138,0.07) 0%, rgba(17,25,22,0) 70%)"
              : "linear-gradient(135deg, rgba(24,160,88,0.07) 0%, rgba(255,255,255,0) 70%)",
            border: "1px solid",
            borderColor: dark ? "rgba(90,217,138,0.12)" : "rgba(24,160,88,0.12)",
          }}
        >
          <Avatar
            sx={{
              width: 60,
              height: 60,
              fontSize: "1.3rem",
              fontWeight: 800,
              bgcolor: dark ? "rgba(90,217,138,0.2)" : "rgba(24,160,88,0.15)",
              color: "primary.main",
              border: "2px solid",
              borderColor: "primary.dark",
            }}
          >
            {getInitials(user.name, user.email)}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="h6" fontWeight={800} noWrap>
              {user.name ?? user.email}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {user.email}
            </Typography>
            <Chip
              label={USER_ROLE_LABEL[user.role] ?? user.role}
              color={roleColor}
              size="small"
              sx={{ mt: 0.5, fontWeight: 700 }}
            />
          </Box>
        </Box>
      </motion.div>

      <Tabs
        value={tab}
        onChange={(_, v: TabKey) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": { fontWeight: 600, fontSize: "0.82rem", minWidth: 70 },
        }}
      >
        <Tab value="profile" label="Профиль" />
        <Tab value="weight" label="Вес" />
        <Tab value="sessions" label="Сессии" />
        <Tab value="audit" label="Журнал" />
      </Tabs>

      {tab === "profile" && <ProfileTab />}
      {tab === "weight" && <WeightTab goal={user.goal} />}
      {tab === "sessions" && <SessionsTab />}
      {tab === "audit" && <AuditTab />}
    </Box>
  );
}

// ─── Profile tab ────────────────────────────────────────────────────────── //

function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    age: "",
    height: "",
    weight: "",
    goal: "",
    bio: "",
    specialty: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        age: user.age?.toString() ?? "",
        height: user.height?.toString() ?? "",
        weight: user.weight?.toString() ?? "",
        goal: user.goal ?? "",
        bio: user.bio ?? "",
        specialty: user.specialty ?? "",
      });
    }
  }, [user]);

  if (!user) return null;

  const isTrainer = user.role === "trainer";

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateMe({
        name: form.name || undefined,
        age: form.age ? Number(form.age) : undefined,
        height: form.height ? Number(form.height) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        goal: form.goal || undefined,
        bio: form.bio || undefined,
        specialty: form.specialty || undefined,
      });
      await refreshUser();
      setEditing(false);
      setSuccess(true);
    } catch {
      setError("Не удалось сохранить профиль.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          Профиль сохранён
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            {user.email}
          </Typography>
          <Divider sx={{ my: 1.5 }} />

          {editing ? (
            <Stack spacing={2}>
              <TextField label="Имя" value={form.name} onChange={set("name")} fullWidth />
              {!isTrainer && (
                <>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Возраст"
                      type="number"
                      value={form.age}
                      onChange={set("age")}
                      fullWidth
                      inputProps={{ min: 1, max: 120 }}
                    />
                    <TextField
                      label="Рост (см)"
                      type="number"
                      value={form.height}
                      onChange={set("height")}
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    label="Вес (кг)"
                    type="number"
                    value={form.weight}
                    onChange={set("weight")}
                    fullWidth
                  />
                  <TextField label="Цель" value={form.goal} onChange={set("goal")} fullWidth />
                </>
              )}
              {isTrainer && (
                <>
                  <TextField
                    label="О себе"
                    value={form.bio}
                    onChange={set("bio")}
                    fullWidth
                    multiline
                    rows={3}
                  />
                  <TextField
                    label="Специализация"
                    value={form.specialty}
                    onChange={set("specialty")}
                    fullWidth
                  />
                </>
              )}
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ flex: 1 }}>
                  {saving ? "Сохранение…" : "Сохранить"}
                </Button>
                <Button variant="outlined" onClick={() => setEditing(false)} sx={{ flex: 1 }}>
                  Отмена
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Box>
              <ProfileRow label="Имя" value={user.name} />
              {!isTrainer && (
                <>
                  <ProfileRow label="Возраст" value={user.age ? `${user.age} лет` : null} />
                  <ProfileRow label="Рост" value={user.height ? `${user.height} см` : null} />
                  <ProfileRow label="Вес" value={user.weight ? `${user.weight} кг` : null} />
                  <ProfileRow label="Цель" value={user.goal} />
                </>
              )}
              {isTrainer && (
                <>
                  <ProfileRow label="О себе" value={user.bio} />
                  <ProfileRow label="Специализация" value={user.specialty} />
                </>
              )}
              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
                startIcon={<EditIcon />}
                onClick={() => setEditing(true)}
              >
                Редактировать профиль
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      py={0.65}
      sx={{ borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} color={value ? "text.primary" : "text.disabled"}>
        {value ?? "—"}
      </Typography>
    </Box>
  );
}

// ─── Weight tab ─────────────────────────────────────────────────────────── //

function WeightTab({ goal }: { goal: string | null }) {
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const fromDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return format(d, "yyyy-MM-dd");
  }, []);

  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [trend, setTrend] = useState<WeightTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [hist, tr] = await Promise.all([
        getWeightHistory(fromDate, today),
        getWeightTrend(30),
      ]);
      setLogs(hist.data);
      setTrend(tr.data);
    } catch {
      setError("Не удалось загрузить данные о весе.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecord = async () => {
    setSaveError("");
    const numeric = Number(weightInput);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 500) {
      setSaveError("Введите положительный вес до 500 кг.");
      return;
    }
    setSaving(true);
    try {
      await recordWeight(today, Math.round(numeric * 10) / 10);
      setWeightInput("");
      await loadAll();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSaveError(detail || "Не удалось сохранить вес.");
    } finally {
      setSaving(false);
    }
  };

  const chartData = useMemo(
    () =>
      [...logs]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((l) => ({
          date: l.date,
          label: format(parseISO(l.date), "d MMM", { locale: ru }),
          kg: Number(l.weight.toFixed(1)),
        })),
    [logs],
  );

  // Tone the delta colour by goal: a drop is "good" only when the user wants
  // to lose weight; otherwise stay neutral / warn on the "wrong" direction.
  const trendColor = useMemo<"success" | "error" | "default">(() => {
    if (!trend || trend.delta == null || Math.abs(trend.delta) < 0.05) return "default";
    const losing = trend.delta < 0;
    const wantsToLose = goal === "lose_weight";
    const wantsToGain = goal === "gain_weight" || goal === "build_muscle";
    if (wantsToLose) return losing ? "success" : "error";
    if (wantsToGain) return losing ? "error" : "success";
    return "default";
  }, [trend, goal]);

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Записать вес за сегодня
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Вес (кг)"
              type="number"
              size="small"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              inputProps={{ step: 0.1, min: 0 }}
              sx={{ flex: 1 }}
              disabled={saving}
            />
            <Button variant="contained" onClick={handleRecord} disabled={saving || !weightInput}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </Stack>
          {saveError && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {saveError}
            </Alert>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Последние 30 дней
              </Typography>
              {chartData.length < 2 ? (
                <Typography variant="body2" color="text.secondary">
                  Записывайте вес ежедневно — график появится после 2 записей.
                </Typography>
              ) : (
                <Box height={220}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={20}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip formatter={(v) => [`${Number(v)} кг`, "Вес"]} />
                      <Line
                        type="monotone"
                        dataKey="kg"
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

          {trend && trend.entries >= 2 && (
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Тренд за 30 дней
                </Typography>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Сначала → в конце
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {trend.first_weight?.toFixed(1) ?? "—"} кг →{" "}
                    {trend.last_weight?.toFixed(1) ?? "—"} кг
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="body2" color="text.secondary">
                    Изменение
                  </Typography>
                  <Chip
                    size="small"
                    label={
                      trend.delta != null
                        ? `${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(1)} кг`
                        : "—"
                    }
                    color={trendColor === "default" ? undefined : trendColor}
                    variant={trendColor === "default" ? "outlined" : "filled"}
                  />
                </Stack>
                {trend.avg_change_per_day != null && (
                  <Typography variant="caption" color="text.secondary">
                    в среднем {trend.avg_change_per_day > 0 ? "+" : ""}
                    {trend.avg_change_per_day.toFixed(2)} кг/день · записей: {trend.entries}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}

// ─── Sessions tab ───────────────────────────────────────────────────────── //

function SessionsTab() {
  const { refreshUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  const [allDone, setAllDone] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listMySessions();
      setSessions(res.data);
    } catch {
      setError("Не удалось загрузить сессии.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRevoke = async (id: number) => {
    setBusyId(id);
    try {
      await revokeSession(id);
      await load();
    } catch {
      setError("Не удалось завершить сессию.");
    } finally {
      setBusyId(null);
    }
  };

  const handleLogoutAll = async () => {
    setAllBusy(true);
    setError("");
    try {
      const res = await logoutAll();
      setAllDone(
        `Все сессии завершены (отозвано: ${res.data.revoked}). Войдите заново на этом устройстве.`,
      );
      setConfirmAll(false);
      await refreshUser();
      await load();
    } catch {
      setError("Не удалось завершить все сессии.");
    } finally {
      setAllBusy(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {allDone && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAllDone(null)}>
          {allDone}
        </Alert>
      )}

      <Stack spacing={1.5}>
        {sessions.length === 0 && (
          <Typography color="text.secondary">Нет активных сессий.</Typography>
        )}
        {sessions.map((s) => (
          <Card key={s.id} variant="outlined">
            <CardContent
              sx={{
                opacity: s.revoked ? 0.55 : 1,
                "& *": s.revoked ? { textDecoration: "line-through" } : undefined,
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {s.user_agent || "Неизвестное устройство"}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                {s.ip || "—"} · создана {format(parseISO(s.created_at), "d MMM, HH:mm", { locale: ru })}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                последняя активность {format(parseISO(s.last_seen_at), "d MMM, HH:mm", { locale: ru })} ·
                истекает {format(parseISO(s.expires_at), "d MMM", { locale: ru })}
              </Typography>
              {!s.revoked && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleRevoke(s.id)}
                  disabled={busyId === s.id}
                  sx={{ mt: 1 }}
                >
                  {busyId === s.id ? "Завершение…" : "Завершить сессию"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Button
        variant="outlined"
        color="error"
        fullWidth
        startIcon={<LogoutIcon />}
        sx={{ mt: 2 }}
        onClick={() => setConfirmAll(true)}
        disabled={allBusy}
      >
        Завершить все остальные
      </Button>

      <Dialog open={confirmAll} onClose={() => !allBusy && setConfirmAll(false)} maxWidth="xs">
        <DialogTitle>Выйти на всех устройствах?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Это отзовёт абсолютно все ваши токены, включая текущий. После этого нужно войти
            заново.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAll(false)} disabled={allBusy}>
            Отмена
          </Button>
          <Button color="error" variant="contained" onClick={handleLogoutAll} disabled={allBusy}>
            {allBusy ? "Подождите…" : "Да, выйти везде"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Audit tab ──────────────────────────────────────────────────────────── //

function AuditTab() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const loadPage = async (nextOffset: number, replace: boolean) => {
    setLoading(true);
    setError("");
    try {
      const res = await listMyAudit(AUDIT_PAGE, nextOffset);
      setItems((prev) => (replace ? res.data : [...prev, ...res.data]));
      setHasMore(res.data.length === AUDIT_PAGE);
      setOffset(nextOffset + res.data.length);
    } catch {
      setError("Не удалось загрузить журнал.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage(0, true);
  }, []);

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={1}>
        {items.map((entry) => (
          <Accordion key={entry.id} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box flex={1}>
                <Typography variant="body2" fontWeight={600}>
                  {actionLabel(entry.action)}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  {format(parseISO(entry.created_at), "d MMM yyyy HH:mm:ss", { locale: ru })}
                  {entry.entity_type ? ` · ${entry.entity_type}` : ""}
                  {entry.entity_id ? ` #${entry.entity_id}` : ""}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="caption" color="text.secondary" component="div">
                действие: <code>{entry.action}</code>
              </Typography>
              {entry.payload != null && (
                <Box
                  component="pre"
                  sx={{
                    mt: 1,
                    p: 1,
                    bgcolor: "background.default",
                    borderRadius: 1,
                    fontSize: 11,
                    overflow: "auto",
                    maxHeight: 240,
                  }}
                >
                  {JSON.stringify(entry.payload, null, 2)}
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
        {items.length === 0 && !loading && (
          <Typography color="text.secondary">Записей в журнале пока нет.</Typography>
        )}
      </Stack>

      <Box display="flex" justifyContent="center" mt={2}>
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          hasMore && (
            <Button onClick={() => loadPage(offset, false)} variant="outlined">
              Показать ещё
            </Button>
          )
        )}
      </Box>
    </Box>
  );
}
