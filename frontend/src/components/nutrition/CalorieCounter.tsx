import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";

export interface CalorieCounterProps {
  loggedKcal: number;
  goalKcal?: number;
  title?: string;
  macros?: { protein: number; fat: number; carbs: number };
}

const RING_SIZE = 148;
const STROKE = 12;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function CalorieCounter({
  loggedKcal,
  goalKcal,
  macros,
}: CalorieCounterProps) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const pct = goalKcal && goalKcal > 0 ? Math.min(1, loggedKcal / goalKcal) : 0;
  const offset = CIRC * (1 - pct);
  const primary = theme.palette.primary.main;
  const trackColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";

  return (
    <Card
      sx={{
        mb: 2,
        background: dark
          ? `linear-gradient(145deg, rgba(90,217,138,0.07) 0%, rgba(17,25,22,0) 60%)`
          : `linear-gradient(145deg, rgba(24,160,88,0.07) 0%, rgba(255,255,255,0) 60%)`,
        borderColor: dark ? "rgba(90,217,138,0.14)" : "rgba(24,160,88,0.14)",
      }}
    >
      <CardContent sx={{ py: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={2.5}>
          {/* Calorie ring */}
          <Box sx={{ position: "relative", width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              style={{ display: "block" }}
            >
              {/* Track */}
              <circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
                fill="none"
                stroke={trackColor}
                strokeWidth={STROKE}
              />
              {/* Progress */}
              <motion.circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
                fill="none"
                stroke={primary}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                initial={{ strokeDashoffset: CIRC }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.0, ease: "easeOut", delay: 0.1 }}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                style={{ filter: `drop-shadow(0 0 6px ${primary}88)` }}
              />
            </svg>

            {/* Center text */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0,
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <Typography
                  variant="h5"
                  fontWeight={800}
                  color="primary.light"
                  lineHeight={1}
                  align="center"
                >
                  {Math.round(loggedKcal)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  align="center"
                  lineHeight={1.4}
                >
                  ккал
                </Typography>
                {goalKcal && goalKcal > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    align="center"
                    lineHeight={1.4}
                    sx={{ fontSize: "0.62rem", opacity: 0.7 }}
                  >
                    из {Math.round(goalKcal)}
                  </Typography>
                )}
              </motion.div>
            </Box>
          </Box>

          {/* Macros */}
          {macros ? (
            <Stack flex={1} spacing={1.8} justifyContent="center">
              <MacroItem
                label="Белки"
                value={macros.protein}
                color={theme.palette.secondary.main}
                delay={0.2}
              />
              <MacroItem
                label="Жиры"
                value={macros.fat}
                color={theme.palette.warning.main}
                delay={0.3}
              />
              <MacroItem
                label="Углеводы"
                value={macros.carbs}
                color={theme.palette.primary.main}
                delay={0.4}
              />
            </Stack>
          ) : (
            <Stack flex={1} justifyContent="center" alignItems="center">
              <Typography variant="body2" color="text.secondary" align="center">
                Нажмите + чтобы добавить приём пищи
              </Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function MacroItem({
  label,
  value,
  color,
  delay,
}: {
  label: string;
  value: number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: color,
            flexShrink: 0,
            boxShadow: `0 0 6px ${color}88`,
          }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={700} color="text.primary">
          {Math.round(value)}{" "}
          <Typography component="span" variant="caption" color="text.secondary">
            г
          </Typography>
        </Typography>
      </Stack>
    </motion.div>
  );
}
