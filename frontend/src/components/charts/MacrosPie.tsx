import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface Props {
  protein: number;
  fat: number;
  carbs: number;
  size?: number;
}

export default function MacrosPie({ protein, fat, carbs, size = 140 }: Props) {
  const theme = useTheme();
  const data = [
    { name: "Белки", value: Math.max(0, protein), color: theme.palette.primary.main },
    { name: "Жиры", value: Math.max(0, fat), color: theme.palette.warning.main },
    { name: "Углеводы", value: Math.max(0, carbs), color: theme.palette.secondary.main },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return (
      <Box
        height={size}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography variant="caption" color="text.secondary">
          БЖУ за сегодня не записаны.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Box width={size} height={size}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={size * 0.32}
              outerRadius={size * 0.46}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Stack spacing={0.5} flex={1}>
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <Stack key={d.name} direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: d.color,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 56 }}>
                {d.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Math.round(d.value)} г · {pct}%
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}
