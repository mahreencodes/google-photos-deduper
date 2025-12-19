import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import { Fade, Tooltip } from "@mui/material";
import { css } from "@emotion/react";

interface PhotoGalleryProps {
  photos: Array<{
    id: string;
    imageUrl: string;
    filename?: string;
    dimensions?: string;
  }>;
  maxPhotos?: number;
  columns?: number;
  photoSize?: number;
}

const styles = {
  gallery: css({
    display: "grid",
    gap: "12px",
    width: "100%",
  }),
  photoCard: css({
    position: "relative",
    overflow: "hidden",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    "&:hover": {
      transform: "scale(1.05)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      zIndex: 1,
    },
  }),
  photoImage: css({
    width: "100%",
    height: "100%",
    objectFit: "cover",
  }),
  photoOverlay: css({
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
    padding: "8px",
    color: "white",
    fontSize: "0.75rem",
    opacity: 0,
    transition: "opacity 0.2s ease",
    ".photo-card:hover &": {
      opacity: 1,
    },
  }),
};

export default function PhotoGallery({
  photos,
  maxPhotos = 20,
  columns = 5,
  photoSize = 120,
}: PhotoGalleryProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const displayPhotos = photos.slice(0, maxPhotos);

  return (
    <Box
      css={styles.gallery}
      sx={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {displayPhotos.map((photo, index) => (
        <Fade in={true} timeout={300 + index * 50} key={photo.id}>
          <Tooltip
            title={
              <Box>
                <Typography variant="body2">{photo.filename || "Photo"}</Typography>
                {photo.dimensions && (
                  <Typography variant="caption">{photo.dimensions}</Typography>
                )}
              </Box>
            }
            arrow
          >
            <Card
              css={[styles.photoCard, "photo-card"]}
              sx={{
                width: photoSize,
                height: photoSize,
                aspectRatio: "1",
              }}
              onMouseEnter={() => setHoveredId(photo.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <CardMedia
                component="img"
                image={photo.imageUrl}
                alt={photo.filename || "Photo"}
                css={styles.photoImage}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              {(photo.filename || photo.dimensions) && (
                <Box css={styles.photoOverlay}>
                  {photo.filename && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {photo.filename}
                    </Typography>
                  )}
                </Box>
              )}
            </Card>
          </Tooltip>
        </Fade>
      ))}
    </Box>
  );
}

