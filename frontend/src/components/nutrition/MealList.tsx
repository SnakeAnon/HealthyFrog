import { Box, Typography } from "@mui/material";
import { Meal } from "../../types";
import MealCard from "./MealCard";

export interface MealListProps {
  meals: Meal[];
  onAdd?: (mealId: number) => void;
  title?: string;
  emptyMessage?: string;
}

export default function MealList({
  meals,
  onAdd,
  title = "Приёмы пищи",
  emptyMessage = "За этот день ничего не записано.",
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
            onAdd={onAdd ? () => onAdd(meal.id) : undefined}
          />
        ))
      )}
    </Box>
  );
}
