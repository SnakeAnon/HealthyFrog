import { Box, Card, CardContent, CircularProgress, Typography } from "@mui/material";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { CalorieCounter, MealList } from "../components/nutrition";
import { getDailyReport } from "../api/nutrition";
import { useAuth } from "../context/AuthContext";
import { DailyReport } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    getDailyReport(today)
      .then((res) => setReport(res.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [today]);

  if (loading)
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );

  const macros =
    report != null
      ? {
          protein: report.total_protein,
          fat: report.total_fat,
          carbs: report.total_carbs,
        }
      : undefined;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={0.5}>
        {format(new Date(), "EEEE, MMM d")}
      </Typography>
      <Typography variant="h6" fontWeight={800} mb={2}>
        Hi, {user?.name?.split(" ")[0] ?? user?.email ?? "there"}
      </Typography>

      <CalorieCounter
        title="Today"
        loggedKcal={report?.total_calories ?? 0}
        macros={macros}
      />

      <MealList
        meals={report?.meals ?? []}
        title="Today's meals"
        emptyMessage="Nothing logged yet — open Diary to add a meal."
      />

      {user?.role === "user" && user.trainer_id && (
        <Card sx={{ mt: 2, borderColor: "primary.dark" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="body2" fontWeight={700} color="primary.light">
              Coach linked
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Use Chat or Book to reach your trainer.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
