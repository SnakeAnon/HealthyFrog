import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { format, parseISO } from "date-fns";
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
import { Booking, BookingStatus, TimeSlot } from "../types";

const STATUS_COLORS: Record<BookingStatus, "default" | "warning" | "success" | "error"> = {
  pending:   "warning",
  confirmed: "success",
  cancelled: "error",
};

export default function Bookings() {
  const { user } = useAuth();
  const isTrainer = user?.role === "trainer";

  const [tab, setTab] = useState(0);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [booking, setBookingId] = useState<number | null>(null);

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
        const [slotsRes, bookingsRes] = await Promise.all([
          getMySlots(),
          getTrainerBookings(),
        ]);
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
      setError("Failed to load booking data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
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
        "Failed to book slot.";
      setError(msg);
    } finally {
      setBookingId(null);
    }
  };

  const handleStatusUpdate = async (bookingId: number, status: BookingStatus) => {
    try {
      await updateBookingStatus(bookingId, status);
      await load();
    } catch {
      setError("Failed to update status.");
    }
  };

  const handleCreateSlot = async () => {
    setSavingSlot(true);
    try {
      await createSlot({ start_time: new Date(newStart).toISOString(), end_time: new Date(newEnd).toISOString() });
      setSlotDialog(false);
      setNewStart("");
      setNewEnd("");
      await load();
    } catch {
      setError("Failed to create slot.");
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
      <Typography variant="h6" fontWeight={700} mb={1}>
        Bookings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={isTrainer ? "My Slots" : "Available Slots"} />
        <Tab label={isTrainer ? "Incoming Bookings" : "My Bookings"} />
      </Tabs>

      {/* ── Slots Tab ─────────────────────────────────────── */}
      {tab === 0 && (
        <Box>
          {isTrainer && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ mb: 2 }}
              onClick={() => setSlotDialog(true)}
            >
              New Time Slot
            </Button>
          )}

          {!isTrainer && !user?.trainer_id && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Assign a trainer first to see available slots.
            </Alert>
          )}

          {slots.length === 0 ? (
            <Typography color="text.secondary">No slots available.</Typography>
          ) : (
            slots.map((slot) => (
              <Card key={slot.id} sx={{ mb: 1.5 }}>
                <CardContent sx={{ pb: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {format(parseISO(slot.start_time), "EEE, MMM d · HH:mm")}
                    {" – "}
                    {format(parseISO(slot.end_time), "HH:mm")}
                  </Typography>
                  <Chip
                    label={slot.is_available ? "Available" : "Booked"}
                    color={slot.is_available ? "success" : "default"}
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                </CardContent>
                {!isTrainer && slot.is_available && (
                  <CardActions>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={booking === slot.id}
                      onClick={() => handleBookSlot(slot.id)}
                    >
                      {booking === slot.id ? "Booking…" : "Book"}
                    </Button>
                  </CardActions>
                )}
              </Card>
            ))
          )}
        </Box>
      )}

      {/* ── Bookings Tab ──────────────────────────────────── */}
      {tab === 1 && (
        <Box>
          {bookings.length === 0 ? (
            <Typography color="text.secondary">No bookings yet.</Typography>
          ) : (
            bookings.map((b) => (
              <Card key={b.id} sx={{ mb: 1.5 }}>
                <CardContent sx={{ pb: isTrainer ? 0 : undefined }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {format(parseISO(b.slot.start_time), "EEE, MMM d · HH:mm")}
                        {" – "}
                        {format(parseISO(b.slot.end_time), "HH:mm")}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Booked {format(parseISO(b.created_at), "MMM d")}
                      </Typography>
                    </Box>
                    <Chip
                      label={b.status}
                      color={STATUS_COLORS[b.status]}
                      size="small"
                      sx={{ textTransform: "capitalize" }}
                    />
                  </Box>
                </CardContent>
                {isTrainer && b.status === "pending" && (
                  <CardActions>
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      onClick={() => handleStatusUpdate(b.id, "confirmed")}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleStatusUpdate(b.id, "cancelled")}
                    >
                      Cancel
                    </Button>
                  </CardActions>
                )}
                {!isTrainer && b.status === "pending" && (
                  <CardActions>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleStatusUpdate(b.id, "cancelled")}
                    >
                      Cancel Booking
                    </Button>
                  </CardActions>
                )}
              </Card>
            ))
          )}
        </Box>
      )}

      {/* Create Slot Dialog */}
      <Dialog open={slotDialog} onClose={() => setSlotDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Time Slot</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="Start Time"
            type="datetime-local"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End Time"
            type="datetime-local"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSlotDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateSlot}
            variant="contained"
            disabled={!newStart || !newEnd || savingSlot}
          >
            {savingSlot ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
