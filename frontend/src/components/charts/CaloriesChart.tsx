import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DailyTotals } from "../../types";

interface Props {
  days: DailyTotals[];
  height?: number;
}

export default function CaloriesChart({ days, height = 200 }: Props) {
  const theme = useTheme();
  const data = days.map((d) => ({
    date: d.date,
    label: format(parseISO(d.date), "d MMM", { locale: ru }),
    kcal: Math.round(d.total_calories),
  }));

  if (data.length === 0) {
    return (
      <Box height={height} display="flex" alignItems="center" justifyContent="center">
        <Typography variant="caption" color="text.secondary">
          Пока нет данных — запишите приём пищи, чтобы увидеть график.
        </Typography>
      </Box>
    );
  }

  return (
    <Box height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="kcalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.55} />
              <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
            stroke={theme.palette.text.secondary}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: theme.palette.primary.main, strokeWidth: 1, strokeDasharray: "3 3" }}
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: theme.palette.text.secondary }}
            formatter={(v) => [`${Number(v)} ккал`, "Калории"]}
          />
          <Area
            type="monotone"
            dataKey="kcal"
            stroke={theme.palette.primary.main}
            strokeWidth={2.5}
            fill="url(#kcalGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}
