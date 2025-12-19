import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import { useMediaQuery, useTheme } from "@mui/material";

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch((error) => {
        console.log("Video autoplay prevented:", error);
      });
    }
  }, []);

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        overflow: "hidden",
        "&::after": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0, 0, 0, 0.1)",
          zIndex: 1,
        },
      }}
    >
      <Box
        component="video"
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: isMobile
            ? "translate(-50%, -50%) rotate(90deg)"
            : "translate(-50%, -50%)",
          minWidth: isMobile ? "100vh" : "100%",
          minHeight: isMobile ? "100vw" : "100%",
          width: isMobile ? "auto" : "100%",
          height: isMobile ? "100%" : "auto",
          objectFit: "cover",
          opacity: 0.7,
        }}
      >
        <source src="/cover.mp4" type="video/mp4" />
      </Box>
    </Box>
  );
}
