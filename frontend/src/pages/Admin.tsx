import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  AdminAuditParams,
  deleteUser,
  getAudit,
  getStats,
  listUsers,
  updateUser,
} from "../api/admin";
import { useAuth } from "../context/AuthContext";
import { USER_ROLE_LABEL } from "../locale/ruLabels";
import { AdminStats, AdminUserUpdate, AuditLog, Role, User } from "../types";

type TabKey = "users" | "stats" | "audit";

const ROLE_OPTIONS: Role[] = ["user", "trainer", "admin"];
const USERS_PAGE = 50;
const AUDIT_PAGE = 20;

const ROLE_COLORS: Record<string, string> = {
  user: "#5ad98a",
  trainer: "#7aa2f7",
  admin: "#f4a261",
};

/** date-fns ``format(parseISO(x))`` throws on Invalid Date — that blanked the whole Admin page. */
function safeFormatIso(iso: string, fmt: string): string {
  if (!iso) return "—";
  try {
    let d = parseISO(iso);
    if (Number.isNaN(d.getTime())) d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, fmt);
  } catch {
    return iso;
  }
}

export default function Admin() {
  const [tab, setTab] = useState<TabKey>("users");

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} mb={1.5}>
        Администрирование
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, v) => {
          if (typeof v !== "string") return;
          setTab(v as TabKey);
        }}
        variant="fullWidth"
        sx={{
          mb: 2,
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTabs-indicator": { height: 3, borderRadius: 2 },
          "& .MuiTab-root": { fontWeight: 600, fontSize: "0.8rem" },
        }}
      >
        <Tab value="users" label="Пользователи" />
        <Tab value="stats" label="Статистика" />
        <Tab value="audit" label="Журнал" />
      </Tabs>

      {tab === "users" && <UsersTab />}
      {tab === "stats" && <StatsTab />}
      {tab === "audit" && <AuditTab />}
    </Box>
  );
}

// ─── Users tab ──────────────────────────────────────────────────────────── //

function UsersTab() {
  const { user: me } = useAuth();
  const [role, setRole] = useState<"" | Role>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listUsers({
        role: role || undefined,
        search: search || undefined,
        limit: USERS_PAGE,
        offset: 0,
      });
      setUsers(res.data);
    } catch {
      setError("Не удалось загрузить пользователей.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, search]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteUser(deleting.id);
      setDeleting(null);
      await load();
    } catch {
      setError("Не удалось удалить пользователя.");
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Роль</InputLabel>
          <Select
            label="Роль"
            value={role}
            onChange={(e) => setRole(e.target.value as "" | Role)}
          >
            <MenuItem value="">Все</MenuItem>
            {ROLE_OPTIONS.map((r) => (
              <MenuItem key={r} value={r}>
                {USER_ROLE_LABEL[r] ?? r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="Поиск по имени или почте"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          fullWidth
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Card} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Почта</TableCell>
                <TableCell>Имя</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell align="right">Тренер</TableCell>
                <TableCell>Создан</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const isSelf = me?.id === u.id;
                return (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.id}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.name ?? "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={USER_ROLE_LABEL[u.role] ?? u.role}
                        sx={{ bgcolor: ROLE_COLORS[u.role] ?? "#666", color: "#000" }}
                      />
                    </TableCell>
                    <TableCell align="right">{u.trainer_id ?? "—"}</TableCell>
                    <TableCell>{safeFormatIso(u.created_at, "yyyy-MM-dd")}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => setEditing(u)}
                        title="Изменить"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={isSelf}
                        onClick={() => setDeleting(u)}
                        title={isSelf ? "Нельзя удалить себя" : "Удалить"}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" align="center" py={2}>
                      Пользователи не найдены.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EditUserDialog
        open={editing !== null}
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs">
        <DialogTitle>Удалить пользователя?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Будет безвозвратно удалён <b>{deleting?.email}</b> и связанные данные.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Отмена</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function EditUserDialog({
  open,
  target,
  onClose,
  onSaved,
}: {
  open: boolean;
  target: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: me } = useAuth();
  const [form, setForm] = useState<AdminUserUpdate>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (target) {
      setForm({
        name: target.name,
        age: target.age,
        height: target.height,
        weight: target.weight,
        goal: target.goal,
        bio: target.bio,
        specialty: target.specialty,
        role: target.role,
        trainer_id: target.trainer_id,
      });
      setError("");
    }
  }, [target]);

  if (!target) return null;

  const isSelf = me?.id === target.id;

  const setField = <K extends keyof AdminUserUpdate>(field: K, value: AdminUserUpdate[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const numberOrNull = (raw: string): number | null => {
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      await updateUser(target.id, form);
      onSaved();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Не удалось сохранить пользователя.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Редактирование — {target.email}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} mt={0.5}>
          <TextField
            label="Имя"
            value={form.name ?? ""}
            onChange={(e) => setField("name", e.target.value || null)}
            size="small"
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <TextField
              label="Возраст"
              type="number"
              value={form.age ?? ""}
              onChange={(e) => setField("age", numberOrNull(e.target.value))}
              size="small"
              fullWidth
            />
            <TextField
              label="Рост (см)"
              type="number"
              value={form.height ?? ""}
              onChange={(e) => setField("height", numberOrNull(e.target.value))}
              size="small"
              fullWidth
            />
            <TextField
              label="Вес (кг)"
              type="number"
              value={form.weight ?? ""}
              onChange={(e) => setField("weight", numberOrNull(e.target.value))}
              size="small"
              fullWidth
            />
          </Stack>
          <TextField
            label="Цель"
            value={form.goal ?? ""}
            onChange={(e) => setField("goal", e.target.value || null)}
            size="small"
            fullWidth
          />
          <TextField
            label="О себе"
            value={form.bio ?? ""}
            onChange={(e) => setField("bio", e.target.value || null)}
            size="small"
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Специализация"
            value={form.specialty ?? ""}
            onChange={(e) => setField("specialty", e.target.value || null)}
            size="small"
            fullWidth
          />

          <Divider sx={{ my: 1 }} />

          <FormControl size="small" fullWidth>
            <InputLabel>Роль</InputLabel>
            <Select
              label="Роль"
              value={form.role ?? target.role}
              disabled={isSelf}
              onChange={(e) => setField("role", e.target.value as Role)}
            >
              {ROLE_OPTIONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {USER_ROLE_LABEL[r] ?? r}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {isSelf && (
            <Typography variant="caption" color="text.secondary">
              Нельзя изменить свою роль.
            </Typography>
          )}

          <TextField
            label="ID тренера"
            type="number"
            value={form.trainer_id ?? ""}
            onChange={(e) => setField("trainer_id", numberOrNull(e.target.value))}
            size="small"
            fullWidth
            helperText="Очистите поле, чтобы снять назначение"
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        <Button onClick={submit} variant="contained" disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Stats tab ──────────────────────────────────────────────────────────── //

function StatsTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStats()
      .then((r) => {
        if (!cancelled) setStats(r.data);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить статистику.");
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
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!stats) return null;

  const pieData = Object.entries(stats.users_by_role ?? {}).map(([role, value]) => ({
    name: role,
    value: Number(value) || 0,
    color: ROLE_COLORS[role] ?? "#888",
  }));
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ gap: 1.5 }}>
        <StatCard label="Пользователей" value={stats.total_users} />
        <StatCard label="Продуктов" value={stats.products} />
        <StatCard label="Приёмов пищи" value={stats.meals} />
        <StatCard label="Сообщений" value={stats.messages} />
        <StatCard label="Записей" value={stats.bookings} />
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Пользователи по ролям
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box width={180} height={180}>
              {pieData.length === 0 || pieTotal <= 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Нет данных по ролям.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Box>
            <Stack spacing={0.5} flex={1}>
              {pieData.map((d) => (
                <Stack key={d.name} direction="row" alignItems="center" spacing={1}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: d.color,
                    }}
                  />
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 70 }}>
                    {USER_ROLE_LABEL[d.name] ?? d.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {d.value}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card sx={{ minWidth: 100, flex: "1 1 100px" }}>
      <CardContent sx={{ "&:last-child": { pb: 1.5 }, py: 1.5, px: 1.75 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={500} display="block" mb={0.25}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={800} color="primary.main" lineHeight={1.1}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ─── Audit tab ──────────────────────────────────────────────────────────── //

const ACTION_LABELS: Record<string, string> = {
  "user.register": "Регистрация аккаунта",
  "user.login": "Вход в систему",
  "user.logout": "Выход из системы",
  "user.logout_all": "Завершение всех сессий",
  "user.profile_update": "Изменение профиля",
  "user.assign_trainer": "Назначен тренер",
  "meal.create": "Новый приём пищи",
  "admin.user_update": "Админ: изменение пользователя",
  "admin.user_delete": "Админ: удаление пользователя",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function AuditTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [userFilter, setUserFilter] = useState<User | null>(null);
  /** Empty string — MUI freeSolo Autocomplete breaks on ``value={null}``. */
  const [actionFilter, setActionFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [items, setItems] = useState<AuditLog[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-load users for the autocomplete (limit defaults to 50, fine for now).
  useEffect(() => {
    listUsers({ limit: 200 })
      .then((r) => setUsers(r.data))
      .catch(() => {
        /* non-fatal */
      });
  }, []);

  const knownActions = useMemo(() => {
    const set = new Set<string>(Object.keys(ACTION_LABELS));
    items.forEach((i) => set.add(i.action));
    return [...set].sort();
  }, [items]);

  const auditQuery: AdminAuditParams = useMemo(
    () => ({
      user_id: userFilter?.id,
      action: actionFilter.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: AUDIT_PAGE,
    }),
    [userFilter, actionFilter, from, to],
  );

  const loadPage = async (nextOffset: number, replace: boolean) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAudit({ ...auditQuery, offset: nextOffset });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilter, actionFilter, from, to]);

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={users}
          value={userFilter}
          onChange={(_, v) => setUserFilter(v)}
          getOptionLabel={(u) => `#${u.id} ${u.name ?? u.email}`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(ip) => <TextField {...ip} label="Пользователь" />}
        />
        <Autocomplete
          size="small"
          freeSolo
          sx={{ minWidth: 200 }}
          options={knownActions}
          value={actionFilter}
          onChange={(_, v) => setActionFilter(typeof v === "string" ? v : "")}
          renderInput={(ip) => <TextField {...ip} label="Действие" />}
        />
        <TextField
          label="С"
          type="date"
          size="small"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="По"
          type="date"
          size="small"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

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
                  {entry.user_id != null ? ` · пользователь #${entry.user_id}` : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  {safeFormatIso(entry.created_at, "yyyy-MM-dd HH:mm:ss")}
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
          <Typography color="text.secondary">Записей нет.</Typography>
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
