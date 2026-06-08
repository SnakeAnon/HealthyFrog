import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { format } from "date-fns";
import { useEffect, useState } from "react";

import { recordWeight } from "../api/users";

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: number | null;
  onSaved?: () => void;
}

export default function EditWeightDialog({ open, onClose, initial, onSaved }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState<string>(initial != null ? String(initial) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDate(today);
      setWeight(initial != null ? String(initial) : "");
      setError("");
    }
  }, [open, initial, today]);

  const submit = async () => {
    setError("");
    const numeric = Number(weight);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 500) {
      setError("Введите положительный вес до 500 кг.");
      return;
    }
    if (date > today) {
      setError("Дата не может быть в будущем.");
      return;
    }
    setBusy(true);
    try {
      await recordWeight(date, Math.round(numeric * 10) / 10);
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Не удалось сохранить вес.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Записать вес</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} mt={0.5}>
          <TextField
            label="Дата"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            inputProps={{ max: today }}
            InputLabelProps={{ shrink: true }}
            fullWidth
            disabled={busy}
          />
          <TextField
            label="Вес (кг)"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputProps={{ step: 0.1, min: 0 }}
            autoFocus
            fullWidth
            disabled={busy}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Отмена
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
