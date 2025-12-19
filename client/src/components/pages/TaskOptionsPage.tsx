// import "./TaskOptionsPage.css";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Input from "@mui/material/Input";
import InputAdornment from "@mui/material/InputAdornment";
import { useContext, useState } from "react";
import { useNavigate } from "react-router";
import { appApiUrl } from "utils";
import { AppContext } from "utils/AppContext";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import InfoIcon from "@mui/icons-material/Info";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Typography from "@mui/material/Typography";

interface FormData {
  refresh_media_items: boolean;
  resolution: string;
  similarity_threshold: string;
  download_original: boolean;
  image_store_path: string;
  chunk_size: string;
}

export default function TaskOptionsPage() {
  const navigate = useNavigate();
  const { activeTask, reloadActiveTask } = useContext(AppContext);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onChange",
    defaultValues: {
      refresh_media_items: true,
      resolution: "250",
      similarity_threshold: "99.00",
      download_original: false,
      image_store_path: "",
      chunk_size: "",
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit: SubmitHandler<FormData> = async (
    data: FormData
  ): Promise<void> => {
    setIsSubmitting(true);

    const response = await fetch(appApiUrl("/api/task"), {
      method: "post",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
        resolution: parseInt(data.resolution),
        similarity_threshold: parseFloat(data.similarity_threshold) / 100.0,
        download_original: data.download_original,
        image_store_path: data.image_store_path || undefined,
        chunk_size: data.chunk_size ? parseInt(data.chunk_size) : undefined,
      }),
    });

    if (response.ok) {
      setIsSubmitting(false);
      reloadActiveTask();
      navigate("/active_task");
    }
  };

  return (
    <form noValidate autoComplete="off" onSubmit={handleSubmit(onSubmit)}>
      <Stack direction="column" spacing={3} sx={{ mt: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>⚠️ Important: API Changes (March 31, 2025)</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Google Photos API no longer allows reading your entire library.
            <strong>
              {" "}
              The "Refresh media items" option will fail with a 403 error.
            </strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>✅ Recommended:</strong> Use the{" "}
            <strong>Chrome Extension</strong> instead:
          </Typography>
          <ol style={{ marginTop: 8, marginBottom: 8, paddingLeft: 20 }}>
            <li>Navigate to photos.google.com</li>
            <li>Click the extension icon</li>
            <li>Click "Discover Photos"</li>
            <li>Click "Send to Backend"</li>
            <li>Click "Start Analysis" (automatically uses extension data)</li>
          </ol>
          <Typography variant="body2">
            See <strong>MIGRATION_GUIDE.md</strong> for complete details.
          </Typography>
        </Alert>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <FormControlLabel
            label="Refresh media items"
            sx={{ mr: 0 }}
            control={
              <Controller
                name="refresh_media_items"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    onChange={(e) => field.onChange(e.target.checked)}
                    checked={field.value}
                  />
                )}
              />
            }
          />
          <Tooltip
            title="Refresh media items from the Google Photos API. This will
            happen automatically if no media items are present."
            placement="right"
            arrow
          >
            <InfoIcon sx={{ color: "text.secondary" }} />
          </Tooltip>
        </Stack>
        {watch("refresh_media_items") && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <label htmlFor="resolution">Resolution</label>
              <Tooltip
                title="Resolution (width & height) to use when comparing images.
              Higher resolution is more accurate but uses more memory and
              takes longer."
                placement="right"
                arrow
              >
                <InfoIcon sx={{ color: "text.secondary" }} />
              </Tooltip>
            </Stack>
            <FormControl error={!!errors.resolution} variant="standard">
              <Controller
                name="resolution"
                control={control}
                rules={{
                  validate: (v) =>
                    parseInt(v) >= 100 || "Please enter a number >= 100",
                }}
                render={({ field }) => (
                  <Input
                    id="resolution"
                    sx={{ width: 70 }}
                    endAdornment={
                      <InputAdornment position="end">px</InputAdornment>
                    }
                    {...field}
                  />
                )}
              />
              <FormHelperText>
                {errors.resolution
                  ? errors.resolution.message
                  : "Default: 250px"}
              </FormHelperText>
            </FormControl>

            <Box sx={{ mt: 2 }}>
              <Controller
                name="download_original"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label="Download originals for comparison"
                  />
                )}
              />

              <Controller
                name="image_store_path"
                control={control}
                render={({ field }) => (
                  <FormControl variant="standard" sx={{ mt: 1 }}>
                    <Input
                      id="image_store_path"
                      placeholder="/path/to/images"
                      sx={{ width: 320 }}
                      {...field}
                    />
                    <FormHelperText>
                      Optional: directory to store images (absolute or relative
                      path)
                    </FormHelperText>
                  </FormControl>
                )}
              />

              <Controller
                name="chunk_size"
                control={control}
                rules={{
                  validate: (v) => {
                    if (!v) return true;
                    const n = parseInt(v);
                    return n > 0 || "Please enter a number > 0";
                  },
                }}
                render={({ field }) => (
                  <FormControl variant="standard" sx={{ mt: 1 }}>
                    <Input
                      id="chunk_size"
                      sx={{ width: 120 }}
                      endAdornment={
                        <InputAdornment position="end">items</InputAdornment>
                      }
                      {...field}
                    />
                    <FormHelperText>
                      Optional: break work into chunks to limit disk usage
                    </FormHelperText>
                  </FormControl>
                )}
              />
            </Box>
          </Box>
        )}
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <label htmlFor="similarity_threshold">Similarity threshold</label>
            <Tooltip
              title="Percentage of similarity between images to be considered
              duplicates."
              placement="right"
              arrow
            >
              <InfoIcon sx={{ color: "text.secondary" }} />
            </Tooltip>
          </Stack>
          <FormControl error={!!errors.similarity_threshold} variant="standard">
            <Controller
              name="similarity_threshold"
              control={control}
              rules={{
                validate: (v) => {
                  const f = parseFloat(v);
                  return (
                    (f >= 90.0 && f < 100.0) ||
                    "Please enter a number >= 90 and < 100"
                  );
                },
              }}
              render={({ field }) => (
                <Input
                  id="similarity_threshold"
                  sx={{ width: 70 }}
                  endAdornment={
                    <InputAdornment position="end">%</InputAdornment>
                  }
                  {...field}
                />
              )}
            />
            <FormHelperText>
              {errors.similarity_threshold
                ? errors.similarity_threshold.message
                : "Default: 99.00%"}
            </FormHelperText>
          </FormControl>
        </Box>
        <Box>
          <FormControl>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {activeTask ? "Restart" : "Start"}
            </Button>
          </FormControl>
        </Box>
      </Stack>
    </form>
  );
}
