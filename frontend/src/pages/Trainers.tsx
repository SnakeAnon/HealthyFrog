import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { assignTrainer, getMyClients, getTrainers } from "../api/users";
import ClientDetailDialog from "../components/ClientDetailDialog";
import { useAuth } from "../context/AuthContext";
import { Trainer, User } from "../types";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function avatarColor(name: string) {
  const colors = ["#5ad98a", "#7eb8ff", "#ffb347", "#ff6b9d", "#a78bfa"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

export default function Trainers() {
  const { isTrainer } = useAuth();
  return isTrainer ? <ClientsList /> : <TrainerCatalog />;
}

// ─── Trainer's own clients ──────────────────────────────────────────────── //

function ClientsList() {
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<User | null>(null);

  useEffect(() => {
    getMyClients()
      .then((res) => setClients(res.data))
      .catch(() => setError("Не удалось загрузить клиентов."))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} mb={2}>
        Мои клиенты
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {clients.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography fontSize="2.5rem">👥</Typography>
          <Typography variant="body1" fontWeight={600}>Пока нет клиентов</Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={260}>
            Клиенты появятся здесь, когда выберут вас тренером.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {clients.map((c, i) => {
            const name = c.name ?? c.email;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
              >
                <Card
                  onClick={() => setSelected(c)}
                  sx={{
                    cursor: "pointer",
                    "&:hover": { borderColor: "primary.dark", transform: "translateY(-1px)" },
                    transition: "all 0.18s ease",
                  }}
                >
                  <Box display="flex" alignItems="center" p={1.75} gap={1.5}>
                    <Avatar
                      sx={{
                        bgcolor: avatarColor(name),
                        color: (t) => (t.palette.mode === "dark" ? "#0a0f0d" : "#fff"),
                        fontWeight: 700,
                        width: 44,
                        height: 44,
                        fontSize: "0.95rem",
                      }}
                    >
                      {getInitials(name)}
                    </Avatar>

                    <Box flex={1} minWidth={0}>
                      <Typography fontWeight={700} variant="body1" noWrap>
                        {name}
                      </Typography>
                      <Stack direction="row" spacing={0.5} mt={0.25} flexWrap="wrap">
                        {c.goal && (
                          <Chip
                            label={c.goal}
                            size="small"
                            sx={{ fontSize: "0.65rem", height: 18 }}
                          />
                        )}
                        {c.weight != null && (
                          <Chip
                            label={`${c.weight} кг`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.65rem", height: 18 }}
                          />
                        )}
                        {c.age != null && (
                          <Chip
                            label={`${c.age} лет`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.65rem", height: 18 }}
                          />
                        )}
                      </Stack>
                    </Box>

                    <Typography variant="caption" color="text.secondary">›</Typography>
                  </Box>
                </Card>
              </motion.div>
            );
          })}
        </Stack>
      )}

      <ClientDetailDialog
        open={selected !== null}
        client={selected}
        onClose={() => setSelected(null)}
      />
    </Box>
  );
}

// ─── Trainer catalog (for regular users) ────────────────────────────────── //

function TrainerCatalog() {
  const { user, refreshUser } = useAuth();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTrainers()
      .then((res) => setTrainers(res.data))
      .catch(() => setError("Не удалось загрузить список тренеров."))
      .finally(() => setLoading(false));
  }, []);

  const handleAssign = async (trainerId: number) => {
    setAssigning(trainerId);
    setError("");
    try {
      await assignTrainer(trainerId);
      await refreshUser();
    } catch {
      setError("Не удалось назначить тренера.");
    } finally {
      setAssigning(null);
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
      <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
        <Typography variant="h6" fontWeight={800}>Тренеры</Typography>
        {user?.trainer_id && (
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: "0.85rem !important" }} />}
            label="Тренер выбран"
            color="success"
            size="small"
            sx={{ fontWeight: 600 }}
          />
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {trainers.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography fontSize="2.5rem">🏋️</Typography>
          <Typography variant="body1" fontWeight={600}>Нет тренеров</Typography>
          <Typography variant="body2" color="text.secondary">
            Пока нет доступных тренеров.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {trainers.map((trainer, i) => {
            const name = trainer.name ?? trainer.email ?? "Тренер";
            const isMyTrainer = user?.trainer_id === trainer.id;
            return (
              <motion.div
                key={trainer.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.32 }}
              >
                <Card
                  sx={{
                    border: isMyTrainer ? "1.5px solid" : undefined,
                    borderColor: isMyTrainer ? "primary.main" : undefined,
                    transition: "all 0.18s ease",
                  }}
                >
                  <Box p={1.75}>
                    {/* Top row */}
                    <Box display="flex" alignItems="flex-start" gap={1.5} mb={1.25}>
                      <Avatar
                        sx={{
                          bgcolor: avatarColor(name),
                          color: (t) => (t.palette.mode === "dark" ? "#0a0f0d" : "#fff"),
                          fontWeight: 700,
                          width: 48,
                          height: 48,
                          fontSize: "1rem",
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(name)}
                      </Avatar>

                      <Box flex={1} minWidth={0}>
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography fontWeight={700} variant="body1">
                            {name}
                          </Typography>
                          {isMyTrainer && (
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: "0.8rem !important" }} />}
                              label="Мой тренер"
                              color="success"
                              size="small"
                              sx={{ fontSize: "0.65rem", height: 20, fontWeight: 700 }}
                            />
                          )}
                        </Box>
                        {trainer.specialty && (
                          <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                            <FitnessCenterIcon sx={{ fontSize: "0.75rem", color: "primary.main" }} />
                            <Typography variant="caption" color="primary.main" fontWeight={600}>
                              {trainer.specialty}
                            </Typography>
                          </Stack>
                        )}
                      </Box>
                    </Box>

                    {/* Bio */}
                    {trainer.bio && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 1.25,
                          px: 0.25,
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {trainer.bio}
                      </Typography>
                    )}

                    {/* Action */}
                    {user?.role === "user" && (
                      <Button
                        fullWidth
                        size="small"
                        variant={isMyTrainer ? "outlined" : "contained"}
                        disabled={isMyTrainer || assigning === trainer.id}
                        onClick={() => handleAssign(trainer.id)}
                        sx={{ borderRadius: "10px", fontWeight: 700 }}
                      >
                        {isMyTrainer
                          ? "Текущий тренер"
                          : assigning === trainer.id
                            ? "Назначение…"
                            : "Выбрать тренера"}
                      </Button>
                    )}
                  </Box>
                </Card>
              </motion.div>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
