import "./ActiveTaskPage.css";
import { useContext, useMemo } from "react";
import { useInterval } from "utils/useInterval";
import Button from "@mui/material/Button";
import { AppContext } from "utils/AppContext";
import CredentialsDiagnostics from "components/CredentialsDiagnostics";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import { appApiUrl } from "utils";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import ErrorIcon from "@mui/icons-material/Error";
import Grid from "@mui/material/Grid";
import { Fade, Grow } from "@mui/material";

export default function ActiveTaskPage() {
  const { activeTask, reloadActiveTask } = useContext(AppContext);
  const isRunning = ["SENT", "PROGRESS"].includes(activeTask?.status);
  const showViewResultsButton = activeTask?.status === "SUCCESS";
  const navigate = useNavigate();

  useInterval(async () => {
    if (!activeTask || isRunning) {
      reloadActiveTask();
    }
  }, 1000);

  const cancelActiveTask = async () => {
    if (activeTask) {
      const response = await fetch(appApiUrl("/api/active_task"), {
        method: "delete",
      });

      if (response.ok) {
        await reloadActiveTask();
        navigate("/task_options");
      }
    }
  };

  const progressData = useMemo(() => {
    if (!activeTask?.meta?.steps) return null;

    const steps = activeTask.meta.steps;
    const stepEntries = Object.entries(steps);
    const completedSteps = stepEntries.filter(([_, info]) => info.completedAt);
    const inProgressSteps = stepEntries.filter(
      ([_, info]) => info.startedAt && !info.completedAt
    );

    let progress = 0;
    if (stepEntries.length > 0) {
      progress = (completedSteps.length / stepEntries.length) * 100;
      if (inProgressSteps.length > 0) {
        progress += 50 / stepEntries.length; // Half credit for in-progress
      }
    }

    return {
      progress: Math.min(100, progress),
      completedSteps: completedSteps.length,
      totalSteps: stepEntries.length,
      currentStep: inProgressSteps[0]?.[0] || null,
      stepDetails: stepEntries,
    };
  }, [activeTask?.meta?.steps]);

  const getStatusIcon = () => {
    if (activeTask?.status === "SUCCESS") {
      return <CheckCircleIcon sx={{ fontSize: 40, color: "#4caf50" }} />;
    }
    if (activeTask?.status === "FAILURE") {
      return <ErrorIcon sx={{ fontSize: 40, color: "#f44336" }} />;
    }
    return (
      <CircularProgress
        size={40}
        sx={{ color: "white" }}
        className="status-icon"
      />
    );
  };

  const getStatusText = () => {
    if (activeTask?.status === "SUCCESS") {
      return "Task Completed Successfully!";
    }
    if (activeTask?.status === "FAILURE") {
      return "Task Failed";
    }
    if (activeTask?.status === "PROGRESS" || activeTask?.status === "SENT") {
      return "Processing in Progress...";
    }
    return "Task Status";
  };

  if (!activeTask) {
    return (
      <Box className="spinner-container">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="task-container" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <CredentialsDiagnostics />

      <Fade in={true} timeout={500}>
        <Card
          className="progress-card"
          sx={{
            background:
              activeTask.status === "SUCCESS"
                ? "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)"
                : activeTask.status === "FAILURE"
                ? "linear-gradient(135deg, #f44336 0%, #c62828 100%)"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        >
          <CardContent>
            <Box className="status-indicator">
              {getStatusIcon()}
              <Typography variant="h5" sx={{ fontWeight: 600, color: "white" }}>
                {getStatusText()}
              </Typography>
            </Box>

            {progressData && isRunning && (
              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ color: "white" }}>
                    Progress
                  </Typography>
                  <Typography variant="body2" sx={{ color: "white" }}>
                    {Math.round(progressData.progress)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progressData.progress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 4,
                      backgroundColor: "white",
                    },
                  }}
                />
              </Box>
            )}

            {activeTask?.meta?.logMessage && (
              <Box className="log-message">
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    margin: 0,
                    color: "white",
                    fontFamily: "Monaco, Menlo, monospace",
                  }}
                >
                  {activeTask.meta.logMessage}
                </Typography>
              </Box>
            )}

            {progressData?.stepDetails && progressData.stepDetails.length > 0 && (
              <Box className="step-details">
                {progressData.stepDetails.map(([stepName, stepInfo]) => {
                  const isCompleted = !!stepInfo.completedAt;
                  const isInProgress =
                    !!stepInfo.startedAt && !stepInfo.completedAt;

                  return (
                    <Grow in={true} key={stepName} timeout={300}>
                      <Box className="step-item">
                        {isCompleted ? (
                          <CheckCircleIcon
                            sx={{ fontSize: 16, color: "#4caf50" }}
                          />
                        ) : isInProgress ? (
                          <CircularProgress size={16} sx={{ color: "white" }} />
                        ) : (
                          <PlayCircleOutlineIcon
                            sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            color: isCompleted
                              ? "white"
                              : isInProgress
                              ? "white"
                              : "rgba(255,255,255,0.7)",
                            fontWeight: isInProgress ? 600 : 400,
                          }}
                        >
                          {stepName === "fetch_media_items"
                            ? "Fetching media items"
                            : stepName === "process_duplicates"
                            ? "Processing duplicates"
                            : stepName}
                          {stepInfo.count !== undefined &&
                            ` (${new Intl.NumberFormat().format(
                              stepInfo.count
                            )} ${stepName === "process_duplicates" ? "groups" : "items"})`}
                        </Typography>
                      </Box>
                    </Grow>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      </Fade>

      {activeTask?.status === "FAILURE" && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {activeTask?.error ||
            "Whoops! An unexpected error occurred. Check application logs."}
        </Alert>
      )}

      {progressData && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card className="stat-card">
              <CardContent>
                <Typography className="stat-label">Status</Typography>
                <Typography className="stat-value">
                  {activeTask.status}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {progressData.totalSteps > 0 && (
            <Grid item xs={12} sm={6} md={4}>
              <Card className="stat-card">
                <CardContent>
                  <Typography className="stat-label">Steps Completed</Typography>
                  <Typography className="stat-value">
                    {progressData.completedSteps} / {progressData.totalSteps}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 3 }} className="action-buttons">
        {showViewResultsButton && (
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate("/active_task/results")}
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              textTransform: "none",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            View Results
          </Button>
        )}
        {isRunning && (
          <Button
            variant="outlined"
            size="large"
            onClick={cancelActiveTask}
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              textTransform: "none",
              fontSize: "1rem",
            }}
          >
            Cancel Task
          </Button>
        )}
      </Stack>
    </Box>
  );
}
