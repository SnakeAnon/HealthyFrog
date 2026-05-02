import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { assignTrainer, getTrainers } from "../api/users";
import { useAuth } from "../context/AuthContext";
import { Trainer } from "../types";

export default function Trainers() {
  const { user, refreshUser } = useAuth();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTrainers()
      .then((res) => setTrainers(res.data))
      .catch(() => setError("Failed to load trainers."))
      .finally(() => setLoading(false));
  }, []);

  const handleAssign = async (trainerId: number) => {
    setAssigning(trainerId);
    setError("");
    try {
      await assignTrainer(trainerId);
      await refreshUser();
    } catch {
      setError("Failed to assign trainer.");
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
      <Typography variant="h6" fontWeight={700} mb={2}>
        Trainers
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {trainers.length === 0 ? (
        <Typography color="text.secondary">No trainers available yet.</Typography>
      ) : (
        trainers.map((trainer) => {
          const isMyTrainer = user?.trainer_id === trainer.id;
          return (
            <Card key={trainer.id} sx={{ mb: 2 }}>
              <CardContent sx={{ pb: 0 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="subtitle1" fontWeight={600}>
                    {trainer.name ?? trainer.email}
                  </Typography>
                  {isMyTrainer && (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label="My Trainer"
                      color="success"
                      size="small"
                    />
                  )}
                </Box>
                {trainer.specialty && (
                  <Typography variant="caption" color="primary.main" fontWeight={500}>
                    {trainer.specialty}
                  </Typography>
                )}
                {trainer.bio && (
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    {trainer.bio}
                  </Typography>
                )}
              </CardContent>
              {user?.role === "user" && (
                <CardActions>
                  <Button
                    size="small"
                    variant={isMyTrainer ? "outlined" : "contained"}
                    disabled={isMyTrainer || assigning === trainer.id}
                    onClick={() => handleAssign(trainer.id)}
                  >
                    {isMyTrainer
                      ? "Current Trainer"
                      : assigning === trainer.id
                      ? "Assigning…"
                      : "Select Trainer"}
                  </Button>
                </CardActions>
              )}
            </Card>
          );
        })
      )}
    </Box>
  );
}
