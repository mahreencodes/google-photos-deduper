import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { SxProps, Theme } from "@mui/material/styles";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  sx?: SxProps<Theme>;
}

export default function StatCard({
  label,
  value,
  icon,
  color,
  trend,
  sx,
}: StatCardProps) {
  return (
    <Card
      sx={{
        background: color
          ? `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`
          : "white",
        color: color ? "white" : "inherit",
        borderRadius: 3,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        transition: "all 0.3s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
        },
        ...sx,
      }}
    >
      <CardContent>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              sx={{
                textTransform: "uppercase",
                letterSpacing: 1,
                opacity: 0.8,
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            >
              {label}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                mt: 1,
                mb: trend ? 0.5 : 0,
              }}
            >
              {typeof value === "number"
                ? new Intl.NumberFormat().format(value)
                : value}
            </Typography>
            {trend && (
              <Typography
                variant="caption"
                sx={{
                  color: trend.isPositive ? "#4caf50" : "#f44336",
                  fontWeight: 600,
                }}
              >
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                opacity: 0.2,
                fontSize: "3rem",
                lineHeight: 1,
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
