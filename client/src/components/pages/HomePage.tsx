import "./HomePage.css";
import { useContext } from "react";
import { AppContext } from "utils/AppContext";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { useNavigate, Link } from "react-router-dom";
import { appApiUrl } from "utils";
import StatCard from "components/StatCard";
import PhotoGallery from "components/PhotoGallery";
import { useFetch } from "utils/useFetch";
import CircularProgress from "@mui/material/CircularProgress";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import CollectionsIcon from "@mui/icons-material/Collections";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

interface RecentMediaItem {
  id: string;
  imageUrl: string;
  filename: string;
  dimensions: string;
}

export default function HomePage() {
  const { user, isLoggedIn, activeTask } = useContext(AppContext);

  if (isLoggedIn && user) {
    return (
      <AuthedHome
        name={user.given_name}
        hasActiveTask={!!activeTask}
        activeTask={activeTask}
      />
    );
  }
  return <UnauthedHome />;
}

function UnauthedHome() {
  return (
    <Box className="unauthed-home">
      <Box className="hero-section">
        <Typography variant="h2" className="hero-title">
          Clean Up Your Google Photos
        </Typography>
        <Typography
          variant="h5"
          className="hero-subtitle"
          sx={{ mt: 2, mb: 4 }}
        >
          Find and remove duplicate photos automatically
        </Typography>
        <Button
          component={Link}
          to="/auth/google"
          variant="contained"
          size="large"
          sx={{
            px: 4,
            py: 1.5,
            fontSize: "1.1rem",
            borderRadius: 3,
            textTransform: "none",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            "&:hover": {
              background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
            },
          }}
        >
          Get Started
        </Button>
      </Box>
    </Box>
  );
}

interface AuthedHomeProps {
  name: string;
  hasActiveTask: boolean;
  activeTask: { status?: string } | null | undefined;
}

function AuthedHome({ name, hasActiveTask, activeTask }: AuthedHomeProps) {
  const navigate = useNavigate();
  const recentPhotosUrl = appApiUrl("/api/recent_media_items?limit=15");
  const { data: recentPhotos, isLoading } = useFetch<{
    items: RecentMediaItem[];
    count: number;
  }>(recentPhotosUrl || "");

  return (
    <Box className="authed-home">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Welcome back, {name}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your Google Photos duplicates with ease
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Total Photos"
            value={recentPhotos?.count || 0}
            icon={<PhotoCameraIcon />}
            color="#4285F4"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Status"
            value={activeTask ? "Processing" : "Ready"}
            icon={activeTask ? <PlayArrowIcon /> : <CheckCircleIcon />}
            color={activeTask ? "#FBBC04" : "#34A853"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Recent Activity"
            value={recentPhotos?.items?.length || 0}
            icon={<CollectionsIcon />}
            color="#EA4335"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Action"
            value={activeTask ? "Resume" : "Start"}
            icon={<PlayArrowIcon />}
            color="#4285F4"
          />
        </Grid>
      </Grid>

      {recentPhotos && recentPhotos.items && recentPhotos.items.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Recently Processed Photos
            </Typography>
          </Box>
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <PhotoGallery
              photos={recentPhotos.items}
              columns={5}
              photoSize={140}
            />
          )}
        </Box>
      )}

      <Box className="action-section">
        <Stack direction="row" spacing={2}>
          {hasActiveTask ? (
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate("/active_task")}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: "1rem",
                borderRadius: 2,
                textTransform: "none",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                },
              }}
            >
              Resume Task
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate("/task_options")}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: "1rem",
                borderRadius: 2,
                textTransform: "none",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                },
              }}
            >
              Start New Task
            </Button>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
