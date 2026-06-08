import AddIcon from "@mui/icons-material/Add";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  bookSlot,
  createSlot,
  getAvailableSlots,
  getMyBookings,
  getMySlots,
  getTrainerBookings,
  updateBookingStatus,
} from "../api/booking";
import { useAuth } from "../context/AuthContext";
import { BOOKING_STATUS_LABEL } from "../locale/ruLabels";
import { Booking, BookingStatus, TimeSlot } from "../types";

const STATUS_COLORS: Record<BookingStatus, "default" | "warning" | "success" | "error"> = {
  pending: "warning",
  confirmed: "success",
  cancelled: "error",
};

const STATUS_BG: Record<BookingStatus, string> = {
  pending: "rgba(255,183,71,0.12)",
  confirmed: "rgba(90,217,138,0.12)",
  cancelled: "rgba(255,107,107,0.10)",
};

function formatSlotTime(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  return {
    date: format(s, "EEE, d MMMM", { locale: ru }),
    time: `${format(s, "HH:mm")} – ${format(e, "HH:mm")}`,
  };
}

export default function Bookings() {
  const { user } = useAuth();
  const isTrainer = user?.role === "trainer";

  const [tab, setTab] = useState(0);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState<number | null>(null);

  // Slot creation dialog
  const [slotDialog, setSlotDialog] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (isTrainer) {
        const [slotsRes, bookingsRes] = await Promise.all([getMySlots(), getTrainerBookings()]);
        setSlots(slotsRes.data);
        setBookings(bookingsRes.data);
      } else {
        const trainerId = user?.trainer_id;
        if (trainerId) {
          const [slotsRes, bookingsRes] = await Promise.all([
            getAvailableSlots(trainerId),
            getMyBookings(),
          ]);
          setSlots(slotsRes.data);
          setBookings(bookingsRes.data);
        } else {
          setBookings((await getMyBookings()).data);
        }
      }
    } catch {
      setError("Не удалось загрузить данные о записях.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void load();
  }, [user]);

  const handleBookSlot = async (slotId: number) => {
    setBookingId(slotId);
    setError("");
    try {
      await bookSlot(slotId);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        "Не удалось забронировать слот.";
      setError(msg);
    } finally {
      setBookingId(null);
    }
  };

  const handleStatusUpdate = async (id: number, status: BookingStatus) => {
    try {
      await updateBookingStatus(id, status);
      await load();
    } catch {
      setError("Не удалось обновить статус.");
    }
  };

  const handleCreateSlot = async () => {
    setSavingSlot(true);
    try {
      await createSlot({
        start_time: new Date(newStart).toISOString(),
        end_time: new Date(newEnd).toISOString(),
      });
      setSlotDialog(false);
      setNewStart("");
      setNewEnd("");
      await load();
    } catch {
      setError("Не удалось создать слот.");
    } finally {
      setSavingSlot(false);
    }
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="h6" fontWeight={800}>
          Запись к тренеру
        </Typography>
        {isTrainer && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setSlotDialog(true)}
            sx={{ borderRadius: "10px", fontWeight: 700 }}
          >
            Новый слот
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* ── Tabs ── */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          "& .MuiTabs-indicator": { height: 3, borderRadius: 2 },
          "& .MuiTab-root": { fontWeight: 600, fontSize: "0.82rem" },
        }}
      >
        <Tab label={isTrainer ? "Мои слоты" : "Свободные слоты"} />
        <Tab label={isTrainer ? "Входящие записи" : "Мои записи"} />
      </Tabs>

      <AnimatePresence mode="wait">
        {/* ── Slots Tab ── */}
        {tab === 0 && (
          <motion.div
            key="slots"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {!isTrainer && !user?.trainer_id && (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                Сначала выберите тренера на вкладке «Тренеры», чтобы видеть слоты.
              </Alert>
            )}

            {slots.length === 0 ? (
              <Box textAlign="center" py={5}>
                <Typography fontSize="2rem" mb={1}>📅</Typography>
                <Typography variant="body2" color="text.secondary">
                  Нет доступных слотов.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {slots.map((slot, i) => {
                  const { date, time } = formatSlotTime(slot.start_time, slot.end_time);
                  return (
                    <motion.div
                      key={slot.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                    >
                      <Card>
                        <Box p={1.75}>
                          <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={0.75}>
                            <Box>
                              <Stack direction="row" alignItems="center" spacing={0.75} mb={0.25}>
                                <CalendarMonthIcon sx={{ fontSize: "0.85rem", color: "primary.main" }} />
                                <Typography variant="body2" fontWeight={700} sx={{ textTransform: "capitalize" }}>
                                  {date}
                                </Typography>
                              </Stack>
                              <Stack direction="row" alignItems="center" spacing={0.75}>
                                <AccessTimeIcon sx={{ fontSize: "0.85rem", color: "text.secondary" }} />
                                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                  {time}
                                </Typography>
                              </Stack>
                            </Box>
                            <Chip
                              label={slot.is_available ? "Свободен" : "Занят"}
                              color={slot.is_available ? "success" : "default"}
                              size="small"
                              sx={{ fontWeight: 600, fontSize: "0.68rem" }}
                            />
                          </Box>

                          {!isTrainer && slot.is_available && (
                            <Button
                              fullWidth
                              size="small"
                              variant="contained"
                              disabled={bookingId === slot.id}
                              onClick={() => handleBookSlot(slot.id)}
                              sx={{ borderRadius: "10px", fontWeight: 700, mt: 0.5 }}
                            >
                              {bookingId === slot.id ? "Бронирование…" : "Записаться"}
                            </Button>
                          )}
                        </Box>
                      </Card>
                    </motion.div>
                  );
                })}
              </Stack>
            )}
          </motion.div>
        )}

        {/* ── Bookings Tab ── */}
        {tab === 1 && (
          <motion.div
            key="bookings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {bookings.length === 0 ? (
              <Box textAlign="center" py={5}>
                <Typography fontSize="2rem" mb={1}>📋</Typography>
                <Typography variant="body2" color="text.secondary">
                  Пока нет записей.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {bookings.map((b, i) => {
                  const { date, time } = formatSlotTime(b.slot.start_time, b.slot.end_time);
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                    >
                      <Card
                        sx={{
                          borderLeft: "3px solid",
                          borderColor:
                            b.status === "confirmed"
                              ? "success.main"
                              : b.status === "cancelled"
                                ? "error.main"
                                : "warning.main",
                          bgcolor: STATUS_BG[b.status],
                        }}
                      >
                        <Box p={1.75}>
                          <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={0.75}>
                            <Box>
                              <Stack direction="row" alignItems="center" spacing={0.75} mb={0.25}>
                                <CalendarMonthIcon sx={{ fontSize: "0.85rem", color: "primary.main" }} />
                                <Typography variant="body2" fontWeight={700} sx={{ textTransform: "capitalize" }}>
                                  {date}
                                </Typography>
                              </Stack>
                              <Stack direction="row" alignItems="center" spacing={0.75}>
                                <AccessTimeIcon sx={{ fontSize: "0.85rem", color: "text.secondary" }} />
                                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                  {time}
                                </Typography>
                              </Stack>
                              <Typography variant="caption" color="text.secondary" mt={0.25} display="block">
                                Записан {format(parseISO(b.created_at), "d MMM", { locale: ru })}
                              </Typography>
                            </Box>
                            <Chip
                              label={BOOKING_STATUS_LABEL[b.status] ?? b.status}
                              color={STATUS_COLORS[b.status]}
                              size="small"
                              sx={{ fontWeight: 700, fontSize: "0.68rem" }}
                            />
                          </Box>

                          {/* Trainer actions */}
                          {isTrainer && b.status === "pending" && (
                            <Stack direction="row" spacing={1} mt={0.75}>
                              <Button
                                size="small"
                                color="success"
                                variant="contained"
                                onClick={() => handleStatusUpdate(b.id, "confirmed")}
                                sx={{ flex: 1, borderRadius: "10px", fontWeight: 700 }}
                              >
                                Подтвердить
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => handleStatusUpdate(b.id, "cancelled")}
                                sx={{ flex: 1, borderRadius: "10px", fontWeight: 700 }}
                              >
                                Отклонить
                              </Button>
                            </Stack>
                          )}

                          {/* Client cancel */}
                          {!isTrainer && b.status === "pending" && (
                            <Button
                              fullWidth
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => handleStatusUpdate(b.id, "cancelled")}
                              sx={{ borderRadius: "10px", fontWeight: 700, mt: 0.75 }}
                            >
                              Отменить запись
                            </Button>
                          )}
                        </Box>
                      </Card>
                    </motion.div>
                  );
                })}
              </Stack>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Slot Dialog ── */}
      <Dialog open={slotDialog} onClose={() => setSlotDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Новый временной слот</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="Начало"
            type="datetime-local"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Конец"
            type="datetime-local"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSlotDialog(false)}>Отмена</Button>
          <Button
            onClick={handleCreateSlot}
            variant="contained"
            disabled={!newStart || !newEnd || savingSlot}
          >
            {savingSlot ? "Создание…" : "Создать"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
