import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { WeightLog } from "../../types";

interface Props {
  logs: WeightLog[];
  height?: number;
}

export default function WeightChart({ logs, height = 200 }: Props) {
  const theme = useTheme();
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const data = sorted.map((l) => ({
    date: l.date,
    label: format(parseISO(l.date), "d MMM", { locale: ru }),
    kg: Number(l.weight.toFixed(1)),
  }));

  if (data.length === 0) {
    return (
      <Box height={height} display="flex" alignItems="center" justifyContent="center">
        <Typography variant="caption" color="text.secondary">
          No weight logs yet — record your weight to start the chart.
        </Typography>
      </Box>
    );
  }

  const values = data.map((d) => d.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.25);
  const yMin = Math.floor((min - pad) * 10) / 10;
  const yMax = Math.ceil((max + pad) * 10) / 10;

  return (
    <Box height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={theme.palette.text.secondary}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            domain={[yMin, yMax]}
            stroke={theme.palette.text.secondary}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: theme.palette.text.secondary }}
            formatter={(v) => [`${Number(v)} кг`, "Вес"]}
          />
          <Line
            type="monotone"
            dataKey="kg"
            stroke={theme.palette.secondary.main}
            strokeWidth={2.5}
            dot={{ r: 3, fill: theme.palette.secondary.main, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
