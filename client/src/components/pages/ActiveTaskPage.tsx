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
import PhotoGallery from "components/PhotoGallery";
import { useFetch } from "utils/useFetch";

// Helper component for Google Photos logo
const GooglePhotosLogo = ({
  size = 20,
  style = {},
}: {
  size?: number;
  style?: React.CSSProperties;
}) => (
  <img
    src="/Google_Photos_icon_(2020-2025).svg"
    width={size}
    height={size}
    alt="Google Photos"
    style={{ verticalAlign: "middle", margin: "0 4px", ...style }}
  />
);

export default function ActiveTaskPage() {
  const { activeTask, reloadActiveTask, user } = useContext(AppContext);
  const isRunning = activeTask?.status
    ? ["SENT", "PROGRESS"].includes(activeTask.status)
    : false;
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

  // Conditionally fetch recent photos only when task is running
  const recentPhotosUrl = isRunning
    ? appApiUrl("/api/recent_media_items?limit=12")
    : "";
  const { data: recentPhotos } = useFetch<{
    items: Array<{
      id: string;
      imageUrl: string;
      filename: string;
      dimensions: string;
    }>;
    count: number;
  }>(recentPhotosUrl);

  const progressData = useMemo(() => {
    if (!activeTask?.meta?.steps) return null;

    const steps = activeTask.meta.steps;
    const stepEntries = Object.entries(steps);
    const completedSteps = stepEntries.filter(([, info]) => info.completedAt);
    const inProgressSteps = stepEntries.filter(
      ([, info]) => info.startedAt && !info.completedAt
    );
    const pendingSteps = stepEntries.filter(
      ([, info]) => !info.startedAt && !info.completedAt
    );

    let progress = 0;
    if (stepEntries.length > 0) {
      progress = (completedSteps.length / stepEntries.length) * 100;
      if (inProgressSteps.length > 0) {
        progress += 50 / stepEntries.length; // Half credit for in-progress
      }
    }

    // Calculate gathering metrics
    const fetchStep = steps["fetch_media_items"];
    const photosGathered = fetchStep?.count || activeTask.meta.totalItems || 0;
    let gatheringTime = 0; // seconds
    let gatheringTimeRemaining = 0; // seconds
    if (fetchStep?.startedAt) {
      const start = Date.parse(fetchStep.startedAt);
      const end = fetchStep.completedAt
        ? Date.parse(fetchStep.completedAt)
        : new Date().getTime();
      gatheringTime = Math.round((end - start) / 1000);

      // Estimate remaining gathering time
      if (!fetchStep.completedAt && photosGathered > 0 && gatheringTime > 0) {
        const gatheringRate = photosGathered / gatheringTime;
        // Estimate based on typical library size if we don't have total yet
        const estimatedTotal = photosGathered * 1.5; // Conservative estimate
        const remaining = estimatedTotal - photosGathered;
        if (gatheringRate > 0 && remaining > 0) {
          gatheringTimeRemaining = Math.round(remaining / gatheringRate);
        }
      }
    }

    // Calculate processing metrics
    const processStep = steps["process_duplicates"];
    const photosProcessed =
      activeTask.meta.itemsProcessed ||
      (fetchStep?.completedAt ? photosGathered : 0);
    const duplicateGroups = processStep?.count || 0;

    let processingTime = 0; // seconds
    let processingTimeRemaining = 0; // seconds
    let processingRate = 0; // photos per second

    if (processStep?.startedAt) {
      const start = Date.parse(processStep.startedAt);
      const end = processStep.completedAt
        ? Date.parse(processStep.completedAt)
        : new Date().getTime();
      processingTime = Math.round((end - start) / 1000);

      if (processingTime > 0 && photosProcessed > 0) {
        processingRate = photosProcessed / processingTime;
        const remainingPhotos = photosGathered - photosProcessed;
        if (processingRate > 0 && remainingPhotos > 0) {
          processingTimeRemaining = Math.round(
            remainingPhotos / processingRate
          );
        }
      }
    }

    // Calculate overall elapsed time
    const firstStep = stepEntries.find(([, info]) => info.startedAt);
    const lastStep = stepEntries.find(([, info]) => info.completedAt);
    let elapsedTime = 0;
    if (firstStep && firstStep[1].startedAt) {
      const start = Date.parse(firstStep[1].startedAt);
      const end =
        lastStep && lastStep[1].completedAt
          ? Date.parse(lastStep[1].completedAt)
          : new Date().getTime();
      elapsedTime = Math.round((end - start) / 1000);
    }

    // Get current operation
    const currentOperation =
      activeTask.meta.currentOperation ||
      (inProgressSteps[0]?.[0] === "fetch_media_items"
        ? "Fetching media items from Google Photos"
        : inProgressSteps[0]?.[0] === "process_duplicates"
        ? "Processing duplicates"
        : null);

    // Get what's done and what's next
    const completedStepNames = completedSteps.map(([name]) => {
      if (name === "fetch_media_items")
        return "✅ Loaded your entire photo library";
      if (name === "process_duplicates") return "✅ Found all duplicate photos";
      return name;
    });

    const nextStepName = pendingSteps[0]?.[0] || inProgressSteps[0]?.[0];
    const nextStep = nextStepName ? (
      nextStepName === "fetch_media_items" ? (
        <>
          Loading your{" "}
          <img
            src="/Google_Photos_icon_(2020-2025).svg"
            width="20"
            height="20"
            alt="Google Photos"
            style={{ verticalAlign: "middle", margin: "0 4px" }}
          />{" "}
          library
        </>
      ) : nextStepName === "process_duplicates" ? (
        "Finding duplicate photos"
      ) : (
        nextStepName
      )
    ) : null;

    return {
      progress: Math.min(100, progress),
      completedSteps: completedSteps.length,
      totalSteps: stepEntries.length,
      currentStep: inProgressSteps[0]?.[0] || null,
      stepDetails: stepEntries,
      photosGathered,
      photosProcessed,
      duplicateGroups,
      elapsedTime,
      gatheringTime,
      gatheringTimeRemaining,
      processingTime,
      processingTimeRemaining,
      processingRate,
      currentOperation,
      completedStepNames,
      nextStep,
    };
  }, [activeTask?.meta]);

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
      return "🎉 Analysis Complete!";
    }
    if (activeTask?.status === "FAILURE") {
      return "⚠️ Something Went Wrong";
    }
    if (activeTask?.status === "PROGRESS" || activeTask?.status === "SENT") {
      return "Working Our Magic...";
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
    <Box className="task-container" sx={{ maxWidth: 1400, mx: "auto" }}>
      <CredentialsDiagnostics />

      {/* User Info Banner */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 2,
          background:
            "linear-gradient(135deg, rgba(66, 133, 244, 0.1) 0%, rgba(52, 168, 83, 0.1) 100%)",
          border: "1px solid rgba(66, 133, 244, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #4285F4 0%, #34A853 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 600,
            fontSize: "1.2rem",
          }}
        >
          {user?.name?.charAt(0) || "U"}
        </Box>
        <Box>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontSize: "0.875rem" }}
          >
            Signed in as
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {user?.email || "Loading..."}
          </Typography>
        </Box>
      </Box>

      {/* Exciting Page Header */}
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800,
            background:
              "linear-gradient(135deg, #4285F4 0%, #EA4335 50%, #FBBC04 75%, #34A853 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: 1,
          }}
        >
          🎯 Discover Your Duplicate Photos
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: "#FBBC04",
            textShadow: "0 0 20px 0 rgba(0, 0, 0, 0.1)",
            boxShadow: "0 0 20px 0 rgba(0, 0, 0, 0.1)",
            fontWeight: 600,
          }}
        >
          Sit back and relax while we analyze your{" "}
          <GooglePhotosLogo size={20} /> library
        </Typography>
      </Box>

      <Fade in={true} timeout={500}>
        <Card
          className="progress-card"
          sx={{
            background:
              activeTask.status === "SUCCESS"
                ? "linear-gradient(135deg, #34A853 0%, #2e7d32 100%)"
                : activeTask.status === "FAILURE"
                ? "linear-gradient(135deg, #EA4335 0%, #c62828 100%)"
                : "linear-gradient(135deg, #4285F4 0%, #34A853 100%)",
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

            {progressData?.stepDetails &&
              progressData.stepDetails.length > 0 && (
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
                            <CircularProgress
                              size={16}
                              sx={{ color: "white" }}
                            />
                          ) : (
                            <PlayCircleOutlineIcon
                              sx={{
                                fontSize: 16,
                                color: "rgba(255,255,255,0.5)",
                              }}
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
                              ? "Loading your photo library"
                              : stepName === "process_duplicates"
                              ? "🔍 Finding duplicate photos"
                              : stepName}
                            {stepInfo.count !== undefined &&
                              ` (${new Intl.NumberFormat().format(
                                stepInfo.count
                              )} ${
                                stepName === "process_duplicates"
                                  ? "groups"
                                  : "items"
                              })`}
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
          {(activeTask?.meta as { error?: string })?.error ||
            "Whoops! An unexpected error occurred. Check application logs."}
        </Alert>
      )}

      {progressData && (
        <>
          {/* Enriched Progress Dashboard */}
          <Box sx={{ mt: 3, mb: 2 }}>
            <Grid container spacing={3}>
              {/* Current Operation - Green (Bottom-left of logo) */}
              {progressData.currentOperation && (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: "rgba(52, 168, 83, 0.85)",
                      border: "1px solid rgba(52, 168, 83, 0.9)",
                      boxShadow: "0 2px 8px rgba(52, 168, 83, 0.2)",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "white",
                        display: "block",
                        mb: 1,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Current Activity
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 500, color: "white" }}
                    >
                      {progressData.currentOperation}
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* What's Done - Blue (Bottom-right of logo) */}
              {progressData.completedStepNames.length > 0 && (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: "rgba(66, 133, 244, 0.85)",
                      border: "1px solid rgba(66, 133, 244, 0.9)",
                      boxShadow: "0 2px 8px rgba(66, 133, 244, 0.2)",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "white",
                        display: "block",
                        mb: 1.5,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Completed
                    </Typography>
                    {progressData.completedStepNames.map((step, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          mb: 1,
                        }}
                      >
                        <CheckCircleIcon
                          sx={{ fontSize: 18, color: "white" }}
                        />
                        <Typography
                          variant="body2"
                          sx={{ color: "white", fontWeight: 500 }}
                        >
                          {step}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
              )}

              {/* Up Next - Yellow (Top-left of logo) */}
              {progressData.nextStep && (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: "rgba(251, 188, 4, 0.85)",
                      border: "1px solid rgba(251, 188, 4, 0.9)",
                      boxShadow: "0 2px 8px rgba(251, 188, 4, 0.2)",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "white",
                        display: "block",
                        mb: 1,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Up Next
                    </Typography>
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <PlayCircleOutlineIcon
                        sx={{ fontSize: 18, color: "white" }}
                      />
                      <Typography
                        variant="body2"
                        component="div"
                        sx={{
                          fontWeight: 500,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        {progressData.nextStep}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Library Overview - Show before analysis starts */}
          {progressData.photosGathered > 0 && !progressData.currentStep && (
            <Card
              sx={{
                mt: 3,
                mb: 3,
                background:
                  "linear-gradient(135deg, rgba(66, 133, 244, 0.05) 0%, rgba(52, 168, 83, 0.05) 100%)",
              }}
            >
              <CardContent>
                <Typography
                  variant="h5"
                  sx={{ mb: 3, fontWeight: 600, textAlign: "center" }}
                >
                  📊 Your Photo Library at a Glance
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: "center", p: 2 }}>
                      <Typography
                        variant="h3"
                        sx={{ fontWeight: 700, color: "#4285F4", mb: 1 }}
                      >
                        {new Intl.NumberFormat().format(
                          progressData.photosGathered
                        )}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ color: "text.secondary" }}
                      >
                        Total Photos in Your Library
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: "center", p: 2 }}>
                      <Typography
                        variant="h3"
                        sx={{ fontWeight: 700, color: "#34A853", mb: 1 }}
                      >
                        {Math.round((progressData.photosGathered * 5) / 1024)}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ color: "text.secondary" }}
                      >
                        Estimated GB of Storage
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: "center", p: 2 }}>
                      <Typography
                        variant="h3"
                        sx={{ fontWeight: 700, color: "#FBBC04", mb: 1 }}
                      >
                        🎉
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ color: "text.secondary" }}
                      >
                        Ready to Find Duplicates
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Key Metrics */}
          <Box sx={{ mt: 3, mb: 2 }}>
            <Grid container spacing={3}>
              {/* Photos Gathered - Blue */}
              {progressData.photosGathered > 0 && (
                <Grid item xs={12} md={4}>
                  <Grow in={true} timeout={300}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: "rgba(66, 133, 244, 0.85)",
                        border: "1px solid rgba(66, 133, 244, 0.9)",
                        boxShadow: "0 2px 8px rgba(66, 133, 244, 0.1)",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(66, 133, 244, 0.2)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "white",
                          display: "block",
                          mb: 1,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        📸 Total Photos
                      </Typography>
                      <Typography
                        variant="h3"
                        className="metric-value"
                        sx={{
                          fontWeight: 700,
                          color: "white",
                          transition: "all 0.5s ease",
                        }}
                      >
                        {new Intl.NumberFormat().format(
                          progressData.photosGathered
                        )}
                      </Typography>
                    </Box>
                  </Grow>
                </Grid>
              )}

              {/* Photos Processed - Yellow (Top-left of logo) */}
              {progressData.photosProcessed > 0 && (
                <Grid item xs={12} md={4}>
                  <Grow in={true} timeout={500}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: "rgba(251, 188, 4, 0.85)",
                        border: "1px solid rgba(251, 188, 4, 0.9)",
                        boxShadow: "0 2px 8px rgba(251, 188, 4, 0.2)",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(251, 188, 4, 0.3)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "white",
                          display: "block",
                          mb: 1,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        ✅ Photos Analyzed
                      </Typography>
                      <Typography
                        variant="h3"
                        className="metric-value"
                        sx={{
                          fontWeight: 700,
                          color: "white",
                          transition: "all 0.5s ease",
                        }}
                      >
                        {new Intl.NumberFormat().format(
                          progressData.photosProcessed
                        )}
                      </Typography>
                    </Box>
                  </Grow>
                </Grid>
              )}

              {/* Duplicate Groups - Red (Top-right of logo) */}
              {progressData.duplicateGroups > 0 && (
                <Grid item xs={12} md={4}>
                  <Grow in={true} timeout={700}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: "rgba(234, 67, 53, 0.85)",
                        border: "1px solid rgba(234, 67, 53, 0.9)",
                        boxShadow: "0 2px 8px rgba(234, 67, 53, 0.2)",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(234, 67, 53, 0.3)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "white",
                          display: "block",
                          mb: 1,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        🔍 Duplicates Found
                      </Typography>
                      <Typography
                        variant="h3"
                        className="metric-value"
                        sx={{
                          fontWeight: 700,
                          color: "white",
                          transition: "all 0.5s ease",
                        }}
                      >
                        {new Intl.NumberFormat().format(
                          progressData.duplicateGroups
                        )}
                      </Typography>
                    </Box>
                  </Grow>
                </Grid>
              )}

              {/* Overall Progress - Blue (Bottom-right of logo) */}
              <Grid item xs={12} md={4}>
                <Grow in={true} timeout={900}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: "rgba(66, 133, 244, 0.85)",
                      border: "1px solid rgba(66, 133, 244, 0.9)",
                      boxShadow: "0 2px 8px rgba(66, 133, 244, 0.2)",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(66, 133, 244, 0.3)",
                      },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "white",
                        display: "block",
                        mb: 1,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      ⚡ Overall Progress
                    </Typography>
                    <Typography
                      variant="h3"
                      className="metric-value"
                      sx={{
                        fontWeight: 700,
                        color: "white",
                        transition: "all 0.5s ease",
                      }}
                    >
                      {Math.round(progressData.progress)}%
                    </Typography>
                  </Box>
                </Grow>
              </Grid>

              {/* Gathering Time - Green (Bottom-left of logo) */}
              {progressData.gatheringTime > 0 && (
                <Grid item xs={12} md={4}>
                  <Grow in={true} timeout={1100}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: "rgba(52, 168, 83, 0.85)",
                        border: "1px solid rgba(52, 168, 83, 0.9)",
                        boxShadow: "0 2px 8px rgba(52, 168, 83, 0.2)",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(52, 168, 83, 0.3)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "white",
                          display: "block",
                          mb: 1,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        ⏱️ Loading Time
                      </Typography>
                      <Typography
                        variant="h3"
                        className="metric-value"
                        sx={{
                          fontWeight: 700,
                          color: "white",
                          transition: "all 0.5s ease",
                        }}
                      >
                        {progressData.gatheringTime > 3600
                          ? `${Math.floor(
                              progressData.gatheringTime / 3600
                            )}h ${Math.floor(
                              (progressData.gatheringTime % 3600) / 60
                            )}m`
                          : `${Math.floor(progressData.gatheringTime / 60)}m ${
                              progressData.gatheringTime % 60
                            }s`}
                      </Typography>
                    </Box>
                  </Grow>
                </Grid>
              )}

              {/* Gathering Time Remaining - Yellow (Top-left of logo) */}
              {progressData.gatheringTimeRemaining > 0 &&
                activeTask?.meta?.steps?.["fetch_media_items"] &&
                !activeTask.meta.steps["fetch_media_items"].completedAt && (
                  <Grid item xs={12} md={4}>
                    <Grow in={true} timeout={1500}>
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          bgcolor: "rgba(251, 188, 4, 0.85)",
                          border: "1px solid rgba(251, 188, 4, 0.9)",
                          boxShadow: "0 2px 8px rgba(251, 188, 4, 0.2)",
                          transition: "all 0.3s ease",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: "0 4px 12px rgba(251, 188, 4, 0.3)",
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "white",
                            display: "block",
                            mb: 1,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          ⏳ Loading ETA
                        </Typography>
                        <Typography
                          variant="h3"
                          className="metric-value"
                          sx={{
                            fontWeight: 700,
                            color: "white",
                            transition: "all 0.5s ease",
                          }}
                        >
                          {progressData.gatheringTimeRemaining > 3600
                            ? `${Math.floor(
                                progressData.gatheringTimeRemaining / 3600
                              )}h ${Math.floor(
                                (progressData.gatheringTimeRemaining % 3600) /
                                  60
                              )}m`
                            : `~${Math.floor(
                                progressData.gatheringTimeRemaining / 60
                              )}m`}
                        </Typography>
                      </Box>
                    </Grow>
                  </Grid>
                )}

              {/* Processing Time - Yellow (Top-left of logo) */}
              {progressData.processingTime > 0 && (
                <Grid item xs={12} md={4}>
                  <Grow in={true} timeout={1500}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: "rgba(251, 188, 4, 0.85)",
                        border: "1px solid rgba(251, 188, 4, 0.9)",
                        boxShadow: "0 2px 8px rgba(251, 188, 4, 0.2)",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(251, 188, 4, 0.3)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "white",
                          display: "block",
                          mb: 1,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        ⏱️ Analysis Time
                      </Typography>
                      <Typography
                        variant="h3"
                        className="metric-value"
                        sx={{
                          fontWeight: 700,
                          color: "white",
                          transition: "all 0.5s ease",
                        }}
                      >
                        {progressData.processingTime > 3600
                          ? `${Math.floor(
                              progressData.processingTime / 3600
                            )}h ${Math.floor(
                              (progressData.processingTime % 3600) / 60
                            )}m`
                          : `${Math.floor(progressData.processingTime / 60)}m ${
                              progressData.processingTime % 60
                            }s`}
                      </Typography>
                    </Box>
                  </Grow>
                </Grid>
              )}

              {/* Processing Time Remaining - Yellow (Top-left of logo) */}
              {progressData.processingTimeRemaining > 0 &&
                activeTask?.meta?.steps?.["process_duplicates"] &&
                !activeTask.meta.steps["process_duplicates"].completedAt && (
                  <Grid item xs={12} md={4}>
                    <Grow in={true} timeout={1700}>
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          bgcolor: "rgba(251, 188, 4, 0.85)",
                          border: "1px solid rgba(251, 188, 4, 0.9)",
                          boxShadow: "0 2px 8px rgba(251, 188, 4, 0.2)",
                          transition: "all 0.3s ease",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: "0 4px 12px rgba(251, 188, 4, 0.3)",
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "white",
                            display: "block",
                            mb: 1,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          ⏳ Analysis ETA
                        </Typography>
                        <Typography
                          variant="h3"
                          className="metric-value"
                          sx={{
                            fontWeight: 700,
                            color: "white",
                            transition: "all 0.5s ease",
                          }}
                        >
                          {progressData.processingTimeRemaining > 3600
                            ? `${Math.floor(
                                progressData.processingTimeRemaining / 3600
                              )}h ${Math.floor(
                                (progressData.processingTimeRemaining % 3600) /
                                  60
                              )}m`
                            : `~${Math.floor(
                                progressData.processingTimeRemaining / 60
                              )}m`}
                        </Typography>
                      </Box>
                    </Grow>
                  </Grid>
                )}

              {/* Processing Rate - Red (Top-right of logo) */}
              {progressData.processingRate > 0 && (
                <Grid item xs={12} md={4}>
                  <Grow in={true} timeout={1900}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: "rgba(234, 67, 53, 0.85)",
                        border: "1px solid rgba(234, 67, 53, 0.9)",
                        boxShadow: "0 2px 8px rgba(234, 67, 53, 0.2)",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(234, 67, 53, 0.3)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "white",
                          display: "block",
                          mb: 1,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        ⚡ Analysis Speed
                      </Typography>
                      <Typography
                        variant="h3"
                        className="metric-value"
                        sx={{
                          fontWeight: 700,
                          color: "white",
                          transition: "all 0.5s ease",
                        }}
                      >
                        {progressData.processingRate.toFixed(1)}/sec
                      </Typography>
                    </Box>
                  </Grow>
                </Grid>
              )}

              {/* Total Elapsed Time - Red (Top-right of logo) */}
              {progressData.elapsedTime > 0 && (
                <Grid item xs={12} md={4}>
                  <Grow in={true} timeout={2100}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: "rgba(234, 67, 53, 0.85)",
                        border: "1px solid rgba(234, 67, 53, 0.9)",
                        boxShadow: "0 2px 8px rgba(234, 67, 53, 0.2)",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 4px 12px rgba(234, 67, 53, 0.3)",
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "white",
                          display: "block",
                          mb: 1,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        ⏰ Total Time
                      </Typography>
                      <Typography
                        variant="h3"
                        className="metric-value"
                        sx={{
                          fontWeight: 700,
                          color: "white",
                          transition: "all 0.5s ease",
                        }}
                      >
                        {progressData.elapsedTime > 3600
                          ? `${Math.floor(
                              progressData.elapsedTime / 3600
                            )}h ${Math.floor(
                              (progressData.elapsedTime % 3600) / 60
                            )}m`
                          : `${Math.floor(progressData.elapsedTime / 60)}m ${
                              progressData.elapsedTime % 60
                            }s`}
                      </Typography>
                    </Box>
                  </Grow>
                </Grid>
              )}
            </Grid>
          </Box>
        </>
      )}

      {recentPhotos &&
        recentPhotos.items &&
        recentPhotos.items.length > 0 &&
        isRunning && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              🖼️ Recently Analyzed Photos
            </Typography>
            <PhotoGallery
              photos={recentPhotos.items}
              columns={6}
              photoSize={120}
            />
          </Box>
        )}

      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 3 }}
        className="action-buttons"
      >
        {showViewResultsButton && (
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate("/active_task/results")}
            sx={{
              borderRadius: 3,
              px: 5,
              py: 1.5,
              textTransform: "none",
              fontSize: "1rem",
              fontWeight: 600,
              background: "linear-gradient(135deg, #4285F4 0%, #34A853 100%)",
              color: "white !important",
              boxShadow: "0 4px 12px rgba(66, 133, 244, 0.4)",
              transition: "all 0.3s ease",
              "&:hover": {
                background:
                  "linear-gradient(135deg, #1A73E8 0%, #2e7d32 100%) !important",
                backgroundColor: "rgba(26, 115, 232, 0.9) !important",
                boxShadow: "0 6px 20px rgba(66, 133, 244, 0.6)",
                transform: "translateY(-2px)",
                color: "white !important",
              },
              "&:active": {
                transform: "translateY(0)",
              },
            }}
          >
            View Duplicate Results
          </Button>
        )}
        {isRunning && (
          <Button
            variant="outlined"
            size="large"
            onClick={cancelActiveTask}
            sx={{
              borderRadius: 3,
              px: 5,
              py: 1.5,
              textTransform: "none",
              fontSize: "1rem",
              fontWeight: 600,
              borderColor: "#EA4335",
              color: "#EA4335 !important",
              borderWidth: 2,
              transition: "all 0.3s ease",
              "&:hover": {
                borderColor: "#c62828 !important",
                backgroundColor: "rgba(234, 67, 53, 0.25) !important",
                color: "#c62828 !important",
                borderWidth: 2,
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(234, 67, 53, 0.3)",
              },
              "&:active": {
                transform: "translateY(0)",
              },
            }}
          >
            Cancel Analysis
          </Button>
        )}
      </Stack>
    </Box>
  );
}
