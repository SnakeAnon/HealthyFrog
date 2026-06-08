import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { MEAL_TYPE_LABEL } from "../../locale/ruLabels";
import { Meal } from "../../types";

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

export interface MealCardProps {
  meal: Meal;
  onAdd?: () => void;
}

export default function MealCard({ meal, onAdd }: MealCardProps) {
  const label = MEAL_TYPE_LABEL[meal.meal_type] ?? meal.meal_type;
  const emoji = MEAL_EMOJI[meal.meal_type] ?? "🍽️";
  const showActions = Boolean(onAdd);
  const [expanded, setExpanded] = useState(false);
  const hasItems = meal.items.length > 0;

  return (
    <Card sx={{ mb: 1.5, overflow: "visible" }}>
      <CardContent sx={{ pb: "12px !important" }}>
        {/* Header row */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          onClick={hasItems ? () => setExpanded((v) => !v) : undefined}
          sx={{ cursor: hasItems ? "pointer" : "default", userSelect: "none" }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25} flex={1} minWidth={0}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                bgcolor: (t) => t.palette.mode === "dark" ? "rgba(90,217,138,0.12)" : "rgba(24,160,88,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                flexShrink: 0,
              }}
            >
              {emoji}
            </Box>
            <Box flex={1} minWidth={0}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography variant="body2" fontWeight={700}>
                  {label}
                </Typography>
                {meal.name && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    · {meal.name}
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Б {meal.total_protein.toFixed(0)} · Ж {meal.total_fat.toFixed(0)} · У {meal.total_carbs.toFixed(0)} г
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5} flexShrink={0}>
            <Box textAlign="right">
              <Typography variant="subtitle1" fontWeight={800} color="primary.light" lineHeight={1.2}>
                {meal.total_calories.toFixed(0)}
              </Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1}>
                ккал
              </Typography>
            </Box>
            {hasItems && (
              <ExpandMoreIcon
                sx={{
                  color: "text.secondary",
                  fontSize: 18,
                  transition: "transform 0.2s",
                  transform: expanded ? "rotate(180deg)" : "none",
                  ml: 0.5,
                }}
              />
            )}
          </Stack>
        </Box>

        {/* Items list */}
        {hasItems && (
          <Collapse in={expanded} timeout={220}>
            <Divider sx={{ my: 1.25 }} />
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
              {meal.items.map((item) => (
                <Box
                  component="li"
                  key={item.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="baseline"
                  py={0.4}
                  gap={1}
                >
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {item.product.name}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      {item.amount_grams} г
                    </Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" flexShrink={0}>
                    {item.calories.toFixed(0)} ккал
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        )}

        {/* Actions */}
        {showActions && (
          <Box mt={1.5}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onAdd}
              sx={{ fontSize: "0.78rem" }}
            >
              Добавить
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
