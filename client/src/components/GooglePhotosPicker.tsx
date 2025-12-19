import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Stack,
} from "@mui/material";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface PhotoMetadata {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes?: number;
}

interface GooglePhotosPickerProps {
  onPhotosSelected: (photos: PhotoMetadata[]) => void;
  onAnalysisStart: () => void;
}

export default function GooglePhotosPicker({
  onPhotosSelected,
  onAnalysisStart,
}: GooglePhotosPickerProps) {
  const [isPickerLoaded, setIsPickerLoaded] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoMetadata[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [status, setStatus] = useState<{
    type: "info" | "success" | "error" | "warning";
    message: string;
  } | null>(null);

  useEffect(() => {
    // Load Google Picker API
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      setIsPickerLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleOpenPicker = async () => {
    try {
      setStatus({ type: "info", message: "Opening Google Photos Picker..." });

      // Note: This is a placeholder implementation
      // You'll need to configure the actual Google Picker API with your OAuth client
      // See: https://developers.google.com/photos/picker/guides

      const response = await fetch("http://localhost:5001/api/picker/token", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to get picker token");
      }

      const { accessToken } = await response.json();

      // Google Picker API - types not available, using window interface
      const gapi = (window as Window & { gapi?: { load: (api: string, callback: () => void) => void } }).gapi;
      const google = (window as Window & { google?: { picker: unknown } }).google;

      if (gapi && google) {
        gapi.load("picker", () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pickerBuilder = new (google as any).picker.PickerBuilder();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const photoView = new (google as any).picker.PhotosView().setType("flat").setMode("grid");
          
          const picker = pickerBuilder
            .addView(photoView)
            .setOAuthToken(accessToken)
            .setDeveloperKey("YOUR_API_KEY") // Configure in environment
            .setCallback(handlePickerCallback)
            .build();

          picker.setVisible(true);
        });
      }
    } catch (error) {
      console.error("Error opening picker:", error);
      setStatus({
        type: "error",
        message: "Failed to open picker. Make sure you're logged in.",
      });
    }
  };

  const handlePickerCallback = (data: { action: string; docs?: PhotoMetadata[] }) => {
    if (data.action === "picked") {
      const photos = data.docs || [];
      setSelectedPhotos(photos);
      onPhotosSelected(photos);
      setStatus({
        type: "success",
        message: `Selected ${photos.length} photo${
          photos.length !== 1 ? "s" : ""
        }`,
      });
    } else if (data.action === "cancel") {
      setStatus({ type: "info", message: "Selection cancelled" });
    }
  };

  const handleSendToBackend = async () => {
    if (selectedPhotos.length === 0) {
      setStatus({
        type: "warning",
        message: "No photos selected. Please select photos first.",
      });
      return;
    }

    setIsSending(true);
    setSendProgress(0);
    setStatus({ type: "info", message: "Sending photos to backend..." });

    try {
      // Send in batches
      const batchSize = 100;
      const totalBatches = Math.ceil(selectedPhotos.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, selectedPhotos.length);
        const batch = selectedPhotos.slice(start, end);

        const response = await fetch(
          "http://localhost:5001/api/picker/photos",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              photos: batch.map((photo) => ({
                id: photo.id,
                name: photo.name,
                url: photo.url,
                mimeType: photo.mimeType,
                sizeBytes: photo.sizeBytes,
              })),
              batch_number: i + 1,
              total_batches: totalBatches,
              is_final: i === totalBatches - 1,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to send batch ${i + 1}`);
        }

        setSendProgress(((i + 1) / totalBatches) * 100);
      }

      setStatus({
        type: "success",
        message: `Successfully sent ${selectedPhotos.length} photos!`,
      });
      setIsSending(false);
    } catch (error) {
      console.error("Error sending photos:", error);
      setStatus({
        type: "error",
        message: "Failed to send photos to backend",
      });
      setIsSending(false);
    }
  };

  const handleStartAnalysis = async () => {
    try {
      setStatus({ type: "info", message: "Starting analysis..." });

      const response = await fetch("http://localhost:5001/api/picker/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          resolution: 224,
          similarity_threshold: 0.9,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start analysis");
      }

      setStatus({
        type: "success",
        message: "Analysis started! Redirecting...",
      });

      setTimeout(() => {
        onAnalysisStart();
      }, 1000);
    } catch (error) {
      console.error("Error starting analysis:", error);
      setStatus({
        type: "error",
        message: "Failed to start analysis",
      });
    }
  };

  return (
    <Box>
      <Card
        sx={{
          background:
            "linear-gradient(135deg, rgba(52, 168, 83, 0.1) 0%, rgba(52, 168, 83, 0.05) 100%)",
          border: "2px solid rgba(52, 168, 83, 0.3)",
        }}
      >
        <CardContent>
          <Stack spacing={3}>
            {/* Status Alert */}
            {status && (
              <Alert severity={status.type} onClose={() => setStatus(null)}>
                {status.message}
              </Alert>
            )}

            {/* Step 1: Select Photos */}
            <Box>
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Chip
                  label="1"
                  size="small"
                  sx={{
                    bgcolor: "#34A853",
                    color: "white",
                    fontWeight: 700,
                  }}
                />
                Select Photos
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click below to open Google Photos Picker and select photos or
                albums you want to scan for duplicates.
              </Typography>

              <Button
                variant="contained"
                startIcon={<PhotoLibraryIcon />}
                onClick={handleOpenPicker}
                disabled={!isPickerLoaded}
                sx={{
                  background:
                    "linear-gradient(135deg, #34A853 0%, #2d8e47 100%)",
                  fontWeight: 700,
                  py: 1.5,
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #2d8e47 0%, #34A853 100%)",
                  },
                }}
              >
                {isPickerLoaded ? "Open Google Photos Picker" : "Loading..."}
              </Button>

              {selectedPhotos.length > 0 && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: "rgba(52, 168, 83, 0.1)",
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <CheckCircleIcon sx={{ color: "#34A853" }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedPhotos.length} photo
                    {selectedPhotos.length !== 1 ? "s" : ""} selected
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Step 2: Send to Backend */}
            <Box>
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Chip
                  label="2"
                  size="small"
                  sx={{
                    bgcolor: "#34A853",
                    color: "white",
                    fontWeight: 700,
                  }}
                />
                Send to Backend
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload selected photo metadata to your local backend for
                processing.
              </Typography>

              <Button
                variant="contained"
                onClick={handleSendToBackend}
                disabled={selectedPhotos.length === 0 || isSending}
                sx={{
                  background:
                    "linear-gradient(135deg, #FBBC04 0%, #f9a825 100%)",
                  color: "white",
                  fontWeight: 700,
                  py: 1.5,
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #f9a825 0%, #FBBC04 100%)",
                  },
                }}
              >
                {isSending ? (
                  <>
                    <CircularProgress
                      size={20}
                      sx={{ mr: 1, color: "white" }}
                    />
                    Sending...
                  </>
                ) : (
                  "Send to Backend"
                )}
              </Button>

              {isSending && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={sendProgress}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      "& .MuiLinearProgress-bar": {
                        background:
                          "linear-gradient(90deg, #FBBC04 0%, #f9a825 100%)",
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 1, textAlign: "center" }}
                  >
                    {Math.round(sendProgress)}% complete
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Step 3: Start Analysis */}
            <Box>
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Chip
                  label="3"
                  size="small"
                  sx={{
                    bgcolor: "#34A853",
                    color: "white",
                    fontWeight: 700,
                  }}
                />
                Start Analysis
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Begin duplicate detection on your selected photos.
              </Typography>

              <Button
                variant="contained"
                onClick={handleStartAnalysis}
                disabled={selectedPhotos.length === 0 || isSending}
                sx={{
                  background:
                    "linear-gradient(135deg, #EA4335 0%, #c5351f 100%)",
                  fontWeight: 700,
                  py: 1.5,
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #c5351f 0%, #EA4335 100%)",
                  },
                }}
              >
                Start Analysis
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
