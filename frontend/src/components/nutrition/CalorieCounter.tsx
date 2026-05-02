import {
  Box,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";

export interface CalorieCounterProps {
  /** Total calories logged for the day */
  loggedKcal: number;
  /** Optional daily goal for progress bar (e.g. 2000) */
  goalKcal?: number;
  /** Short label above the number */
  title?: string;
  /** Optional macro totals for a compact row under the main number */
  macros?: { protein: number; fat: number; carbs: number };
}

/**
 * Hero-style calorie summary for mobile: large number, optional goal progress, optional P/F/C line.
 */
export default function CalorieCounter({
  loggedKcal,
  goalKcal,
  title = "Today",
  macros,
}: CalorieCounterProps) {
  const pct =
    goalKcal && goalKcal > 0
      ? Math.min(100, Math.round((loggedKcal / goalKcal) * 100))
      : null;

  return (
    <Card
      sx={{
        mb: 2,
        background: (t) =>
          `linear-gradient(145deg, ${t.palette.primary.dark}22 0%, ${t.palette.background.paper} 55%)`,
        borderColor: "primary.dark",
      }}
    >
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Typography variant="overline" color="text.secondary" letterSpacing={1}>
          {title}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Typography variant="h3" component="p" color="primary.light">
            {Math.round(loggedKcal)}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" fontWeight={500}>
            kcal
          </Typography>
        </Stack>

        {goalKcal != null && goalKcal > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                Daily goal
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(loggedKcal)} / {Math.round(goalKcal)} kcal
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct ?? 0}
              sx={{
                bgcolor: "rgba(255,255,255,0.08)",
                "& .MuiLinearProgress-bar": { borderRadius: 1 },
              }}
            />
          </Box>
        )}

        {macros && (
          <Stack
            direction="row"
            spacing={2}
            mt={2}
            flexWrap="wrap"
            useFlexGap
            justifyContent="space-between"
          >
            <MacroPill label="Protein" value={macros.protein} unit="g" color="secondary.light" />
            <MacroPill label="Fat" value={macros.fat} unit="g" color="warning.light" />
            <MacroPill label="Carbs" value={macros.carbs} unit="g" color="info.light" />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function MacroPill({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <Box sx={{ minWidth: "28%" }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ color }}>
        {value.toFixed(0)}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.25 }}>
          {unit}
        </Typography>
      </Typography>
    </Box>
  );
}
