import { Box, Typography } from "@mui/material";
import { Meal } from "../../types";
import MealCard from "./MealCard";

export interface MealListProps {
  meals: Meal[];
  /** Per-meal “add food” handler (meal id) */
  onAddFood?: (mealId: number) => void;
  /** Section heading */
  title?: string;
  emptyMessage?: string;
}

/**
 * Vertical stack of meal cards — typical home / diary meal list.
 */
export default function MealList({
  meals,
  onAddFood,
  title = "Meals",
  emptyMessage = "No meals logged for this day.",
}: MealListProps) {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} mb={1.25}>
        {title}
      </Typography>
      {meals.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
          {emptyMessage}
        </Typography>
      ) : (
        meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            onAddFood={onAddFood ? () => onAddFood(meal.id) : undefined}
          />
        ))
      )}
    </Box>
  );
}
