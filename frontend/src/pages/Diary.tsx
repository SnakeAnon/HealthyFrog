import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { CalorieCounter, MealList } from "../components/nutrition";
import { addDays, format, subDays } from "date-fns";
import { useEffect, useState } from "react";
import {
  addMealItem,
  createMeal,
  getMeals,
  getProducts,
} from "../api/nutrition";
import { Meal, MealType, Product } from "../types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export default function Diary() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Add-meal dialog
  const [mealDialog, setMealDialog] = useState(false);
  const [newMealType, setNewMealType] = useState<MealType>("breakfast");
  const [newMealName, setNewMealName] = useState("");
  const [savingMeal, setSavingMeal] = useState(false);

  // Add-item dialog
  const [itemDialog, setItemDialog] = useState<number | null>(null); // meal_id
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<number | "">("");
  const [grams, setGrams] = useState("100");
  const [savingItem, setSavingItem] = useState(false);

  const dayStr = format(selectedDate, "yyyy-MM-dd");

  const loadMeals = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getMeals(dayStr);
      setMeals(res.data);
    } catch {
      setError("Failed to load meals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeals();
  }, [dayStr]);

  // Load products when item dialog opens
  useEffect(() => {
    if (itemDialog !== null) {
      getProducts(productSearch || undefined).then((res) => setProducts(res.data));
    }
  }, [itemDialog, productSearch]);

  const handleAddMeal = async () => {
    setSavingMeal(true);
    try {
      await createMeal({
        date: dayStr,
        meal_type: newMealType,
        name: newMealName || undefined,
      });
      setMealDialog(false);
      setNewMealName("");
      await loadMeals();
    } catch {
      setError("Failed to create meal.");
    } finally {
      setSavingMeal(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedProduct || !itemDialog) return;
    setSavingItem(true);
    try {
      await addMealItem(itemDialog, {
        product_id: Number(selectedProduct),
        amount_grams: Number(grams),
      });
      setItemDialog(null);
      setSelectedProduct("");
      setGrams("100");
      setProductSearch("");
      await loadMeals();
    } catch {
      setError("Failed to add item.");
    } finally {
      setSavingItem(false);
    }
  };

  const totalCalories = meals.reduce((s, m) => s + m.total_calories, 0);
  const totalP = meals.reduce((s, m) => s + m.total_protein, 0);
  const totalF = meals.reduce((s, m) => s + m.total_fat, 0);
  const totalC = meals.reduce((s, m) => s + m.total_carbs, 0);

  return (
    <Box>
      {/* Date Navigation */}
      <Card sx={{ mb: 2, py: 0.5 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" px={0.5}>
          <IconButton onClick={() => setSelectedDate((d) => subDays(d, 1))} aria-label="Previous day">
            <ChevronLeftIcon />
          </IconButton>
          <Box textAlign="center">
            <Typography variant="subtitle1" fontWeight={800}>
              {format(selectedDate, "EEE, MMM d")}
            </Typography>
            {format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && (
              <Typography variant="caption" color="primary.light" fontWeight={600}>
                Today
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setSelectedDate((d) => addDays(d, 1))} aria-label="Next day">
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Card>

      <CalorieCounter
        title={format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "This day" : "Day total"}
        loggedKcal={totalCalories}
        macros={{ protein: totalP, fat: totalF, carbs: totalC }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <MealList
          meals={meals}
          onAddFood={(mealId) => setItemDialog(mealId)}
          title="Meals"
          emptyMessage="No meals yet. Tap + to create one."
        />
      )}

      {/* FAB to add new meal */}
      <Fab
        color="primary"
        sx={{ position: "fixed", bottom: 72, right: 20 }}
        onClick={() => setMealDialog(true)}
        title="New Meal"
      >
        <AddIcon />
      </Fab>

      {/* Add Meal Dialog */}
      <Dialog open={mealDialog} onClose={() => setMealDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Meal</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Meal Type</InputLabel>
            <Select
              value={newMealType}
              label="Meal Type"
              onChange={(e) => setNewMealType(e.target.value as MealType)}
            >
              {MEAL_TYPES.map((t) => (
                <MenuItem key={t} value={t} sx={{ textTransform: "capitalize" }}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Name (optional)"
            value={newMealName}
            onChange={(e) => setNewMealName(e.target.value)}
            fullWidth
            placeholder="e.g. Post-workout"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMealDialog(false)}>Cancel</Button>
          <Button onClick={handleAddMeal} variant="contained" disabled={savingMeal}>
            {savingMeal ? "Adding…" : "Add Meal"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Food Item Dialog */}
      <Dialog
        open={itemDialog !== null}
        onClose={() => setItemDialog(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add Food</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="Search product"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            fullWidth
            placeholder="Chicken, rice, banana…"
          />
          <FormControl fullWidth>
            <InputLabel>Product</InputLabel>
            <Select
              value={selectedProduct}
              label="Product"
              onChange={(e) => setSelectedProduct(e.target.value as number)}
            >
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} ({p.calories_per_100g} kcal/100g)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Amount (grams)"
            type="number"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            fullWidth
            inputProps={{ min: 1 }}
          />
          {selectedProduct && grams && (
            <Typography variant="caption" color="text.secondary">
              ≈{" "}
              {(
                ((products.find((p) => p.id === selectedProduct)?.calories_per_100g ?? 0) *
                  Number(grams)) /
                100
              ).toFixed(0)}{" "}
              kcal
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialog(null)}>Cancel</Button>
          <Button
            onClick={handleAddItem}
            variant="contained"
            disabled={!selectedProduct || savingItem}
          >
            {savingItem ? "Adding…" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
