import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Stack,
} from "@mui/material";
import ExtensionIcon from "@mui/icons-material/Extension";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface ScanModeSelectorProps {
  onSelectMode: (mode: "extension" | "picker") => void;
  selectedMode?: "extension" | "picker";
}

export default function ScanModeSelector({
  onSelectMode,
  selectedMode,
}: ScanModeSelectorProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h5"
        sx={{
          mb: 3,
          fontWeight: 700,
          background:
            "linear-gradient(135deg, #4285F4 0%, #EA4335 50%, #FBBC04 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textAlign: "center",
        }}
      >
        Choose Your Scanning Method
      </Typography>

      <Grid container spacing={3}>
        {/* Extension Mode */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              position: "relative",
              height: "100%",
              cursor: "pointer",
              transition: "all 0.3s ease",
              border:
                selectedMode === "extension"
                  ? "3px solid #4285F4"
                  : "2px solid transparent",
              background:
                selectedMode === "extension"
                  ? "linear-gradient(135deg, rgba(66, 133, 244, 0.1) 0%, rgba(66, 133, 244, 0.05) 100%)"
                  : "background.paper",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 8px 24px rgba(66, 133, 244, 0.3)",
              },
            }}
            onClick={() => onSelectMode("extension")}
          >
            <CardContent>
              {selectedMode === "extension" && (
                <CheckCircleIcon
                  sx={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    color: "#4285F4",
                    fontSize: 32,
                  }}
                />
              )}

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    background:
                      "linear-gradient(135deg, #4285F4 0%, #357abd 100%)",
                    display: "inline-flex",
                    mr: 2,
                  }}
                >
                  <ExtensionIcon sx={{ color: "white", fontSize: 32 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Chrome Extension
                  </Typography>
                  <Chip
                    label="Recommended"
                    size="small"
                    sx={{
                      bgcolor: "#4285F4",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.7rem",
                    }}
                  />
                </Box>
              </Box>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, minHeight: 60 }}
              >
                Automatically discover your entire photo library. Perfect for
                initial full scans and comprehensive duplicate detection.
              </Typography>

              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  ✅ <strong>Scans ALL photos automatically</strong>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  ⚡ <strong>Fast & efficient</strong>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  🎯 <strong>No manual selection needed</strong>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  🔒 <strong>100% local processing</strong>
                </Typography>
              </Stack>

              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 2,
                  p: 1.5,
                  bgcolor: "rgba(66, 133, 244, 0.1)",
                  borderRadius: 1,
                  color: "#4285F4",
                  fontWeight: 600,
                }}
              >
                💡 Best for: First-time scan, large libraries (10K+ photos)
              </Typography>

              <Button
                variant={
                  selectedMode === "extension" ? "contained" : "outlined"
                }
                fullWidth
                sx={{
                  mt: 2,
                  py: 1.5,
                  fontWeight: 700,
                  background:
                    selectedMode === "extension"
                      ? "linear-gradient(135deg, #4285F4 0%, #357abd 100%)"
                      : "transparent",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #4285F4 0%, #357abd 100%)",
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMode("extension");
                }}
              >
                Use Extension
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Picker Mode */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              position: "relative",
              height: "100%",
              cursor: "pointer",
              transition: "all 0.3s ease",
              border:
                selectedMode === "picker"
                  ? "3px solid #34A853"
                  : "2px solid transparent",
              background:
                selectedMode === "picker"
                  ? "linear-gradient(135deg, rgba(52, 168, 83, 0.1) 0%, rgba(52, 168, 83, 0.05) 100%)"
                  : "background.paper",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 8px 24px rgba(52, 168, 83, 0.3)",
              },
            }}
            onClick={() => onSelectMode("picker")}
          >
            <CardContent>
              {selectedMode === "picker" && (
                <CheckCircleIcon
                  sx={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    color: "#34A853",
                    fontSize: 32,
                  }}
                />
              )}

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    background:
                      "linear-gradient(135deg, #34A853 0%, #2d8e47 100%)",
                    display: "inline-flex",
                    mr: 2,
                  }}
                >
                  <PhotoLibraryIcon sx={{ color: "white", fontSize: 32 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Google Photos Picker
                  </Typography>
                  <Chip
                    label="Incremental"
                    size="small"
                    sx={{
                      bgcolor: "#34A853",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.7rem",
                    }}
                  />
                </Box>
              </Box>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, minHeight: 60 }}
              >
                Manually select specific photos or albums to scan. Perfect for
                checking new photos or specific collections.
              </Typography>

              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  🎯 <strong>Select specific photos/albums</strong>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  🆕 <strong>Perfect for new photos only</strong>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  ✅ <strong>Google's official picker</strong>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  🧪 <strong>Great for testing</strong>
                </Typography>
              </Stack>

              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 2,
                  p: 1.5,
                  bgcolor: "rgba(52, 168, 83, 0.1)",
                  borderRadius: 1,
                  color: "#34A853",
                  fontWeight: 600,
                }}
              >
                💡 Best for: Monthly updates, specific albums, testing
              </Typography>

              <Button
                variant={selectedMode === "picker" ? "contained" : "outlined"}
                fullWidth
                sx={{
                  mt: 2,
                  py: 1.5,
                  fontWeight: 700,
                  background:
                    selectedMode === "picker"
                      ? "linear-gradient(135deg, #34A853 0%, #2d8e47 100%)"
                      : "transparent",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #34A853 0%, #2d8e47 100%)",
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMode("picker");
                }}
              >
                Use Picker
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Comparison Table */}
      {!selectedMode && (
        <Box
          sx={{
            mt: 4,
            p: 3,
            borderRadius: 2,
            bgcolor: "rgba(66, 133, 244, 0.05)",
            border: "1px solid rgba(66, 133, 244, 0.2)",
          }}
        >
          <Typography
            variant="h6"
            sx={{ mb: 2, fontWeight: 700, textAlign: "center" }}
          >
            Quick Comparison
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                First-time user?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                → Use <strong style={{ color: "#4285F4" }}>Extension</strong> to
                scan everything
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                Already scanned?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                → Use <strong style={{ color: "#34A853" }}>Picker</strong> for
                new photos
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                Testing the app?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                → Use <strong style={{ color: "#34A853" }}>Picker</strong> with
                small batch
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}
