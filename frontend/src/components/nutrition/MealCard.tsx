import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from "@mui/material";
import { Meal } from "../../types";

export interface MealCardProps {
  meal: Meal;
  /** Show “Add food” action (e.g. diary) */
  onAddFood?: () => void;
}

const mealTypeLabel: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/**
 * Single meal block: type chip, calories, macros, optional line items.
 */
export default function MealCard({ meal, onAddFood }: MealCardProps) {
  const label = mealTypeLabel[meal.meal_type] ?? meal.meal_type;

  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: onAddFood ? 0 : undefined, "&:last-child": { pb: onAddFood ? 0 : 2 } }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                label={label}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600, borderRadius: 2 }}
              />
              {meal.name && (
                <Typography variant="subtitle2" fontWeight={700} noWrap>
                  {meal.name}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              P {meal.total_protein.toFixed(0)}g · F {meal.total_fat.toFixed(0)}g · C{" "}
              {meal.total_carbs.toFixed(0)}g
            </Typography>
          </Box>
          <Typography variant="h6" fontWeight={800} color="primary.light" sx={{ flexShrink: 0 }}>
            {meal.total_calories.toFixed(0)}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.25 }}>
              kcal
            </Typography>
          </Typography>
        </Box>

        {meal.items.length > 0 && (
          <>
            <Divider sx={{ my: 1.25, borderColor: "divider" }} />
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
              {meal.items.map((item) => (
                <Box
                  component="li"
                  key={item.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="baseline"
                  gap={1}
                  py={0.35}
                >
                  <Typography variant="body2" color="text.primary" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {item.product.name}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      {item.amount_grams}g
                    </Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {item.calories.toFixed(0)} kcal
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </CardContent>
      {onAddFood && (
        <Box px={1.5} pb={1.5}>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onAddFood}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            Add food
          </Button>
        </Box>
      )}
    </Card>
  );
}
