import "./TaskResults.css";
import { ChangeEvent, useContext, useMemo } from "react";
import { TaskResultsContext } from "utils/TaskResultsContext";
import TaskResultsActionBar from "components/TaskResultsActionBar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Grid from "@mui/material/Grid";
import { css } from "@emotion/react";
import { truncateString } from "utils";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import CompareIcon from "@mui/icons-material/Compare";
import RenameIcon from "@mui/icons-material/DriveFileRenameOutline";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";
import {
  MediaItemType,
  TaskResultsGroupType,
  TaskResultsType,
} from "utils/types";
import { useTaskResultsReducer } from "utils/useTaskResultsReducer";

const styles = {
  valignMiddle: css({
    display: "flex",
    alignItems: "center",
  }),
  fieldIcon: css({
    fontSize: "1rem",
    marginRight: "11px",
  }),
};

interface TaskResultsProps {
  results: TaskResultsType;
}

export default function TaskResults(props: TaskResultsProps) {
  const [results, dispatch] = useTaskResultsReducer(props.results);
  const groupsWithDuplicates = Object.values(results.groups).filter(
    (g) => g.hasDuplicates
  );
  const selectedMediaItemIds = Object.values(results.groups).reduce(
    (acc, group) => {
      if (group.isSelected) {
        group.mediaItemIds
          .filter((mediaItemId) => {
            return (
              // Select all mediaItems except the original
              group.originalMediaItemId !== mediaItemId &&
              // Filter out mediaItems that have already been deleted
              !results.mediaItems[mediaItemId].deletedAt
            );
          })
          .forEach((mediaItemId) => acc.add(mediaItemId));
      }

      return acc;
    },
    new Set<string>()
  );

  // Calculate statistics
  const stats = useMemo(() => {
    const totalGroups = groupsWithDuplicates.length;
    const selectedGroups = groupsWithDuplicates.filter((g) => g.isSelected).length;
    const totalDuplicates = groupsWithDuplicates.reduce(
      (sum, g) => sum + g.mediaItemIds.length - 1,
      0
    );
    const selectedDuplicates = selectedMediaItemIds.size;
    const deletedCount = Object.values(results.mediaItems).filter(
      (m) => m.deletedAt
    ).length;

    return {
      totalGroups,
      selectedGroups,
      totalDuplicates,
      selectedDuplicates,
      deletedCount,
    };
  }, [groupsWithDuplicates, selectedMediaItemIds, results.mediaItems]);

  return (
    <TaskResultsContext.Provider
      value={{
        results,
        dispatch,
        selectedMediaItemIds,
      }}
    >
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        {/* Statistics Summary */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Card
                sx={{
                  p: 2,
                  background: "linear-gradient(135deg, #4285F4 0%, #1A73E8 100%)",
                  color: "white",
                  borderRadius: 2,
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Duplicate Groups
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.totalGroups}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card
                sx={{
                  p: 2,
                  background: "linear-gradient(135deg, #EA4335 0%, #c62828 100%)",
                  color: "white",
                  borderRadius: 2,
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Total Duplicates
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.totalDuplicates}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card
                sx={{
                  p: 2,
                  background: "linear-gradient(135deg, #FBBC04 0%, #F9AB00 100%)",
                  color: "white",
                  borderRadius: 2,
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Selected
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.selectedDuplicates}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card
                sx={{
                  p: 2,
                  background: "linear-gradient(135deg, #34A853 0%, #2e7d32 100%)",
                  color: "white",
                  borderRadius: 2,
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Deleted
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.deletedCount}
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Box>

        <Box className="select-all-container">
          <SelectAll />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          {groupsWithDuplicates.length === 0 ? (
            <Box className="no-duplicates-message">
              <Typography variant="h2" component="h2">
                🎉 No Duplicates Found!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                Your Google Photos library is clean and organized.
              </Typography>
            </Box>
          ) : (
            <AutoSizer>
              {({ height, width }) => (
                <List
                  className="react-window-list"
                  height={height}
                  width={width}
                  itemCount={groupsWithDuplicates.length}
                  itemSize={280}
                >
                  {({ index, style }) => (
                    <ResultRow
                      group={groupsWithDuplicates[index]}
                      style={{
                        ...style,
                        width: undefined, // Prevent react-window setting width: 100% on rows
                      }}
                    />
                  )}
                </List>
              )}
            </AutoSizer>
          )}
        </Box>
        <TaskResultsActionBar />
      </Box>
    </TaskResultsContext.Provider>
  );
}

interface ResultRowProps {
  group: TaskResultsGroupType;
  style: React.CSSProperties;
}

function ResultRow({ group, style }: ResultRowProps) {
  const { dispatch } = useContext(TaskResultsContext);
  const handleGroupCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: "setGroupSelected",
      groupId: group.id,
      isSelected: event.target.checked,
    });
  };
  const handleSelectedOriginalChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    dispatch({
      type: "setOriginalMediaItemId",
      groupId: group.id,
      mediaItemId: event.target.value,
    });
  };

  return (
    <Box className="duplicate-group" style={style}>
      <Stack direction="row" spacing={2} sx={{ py: 2 }}>
        <Box css={styles.valignMiddle}>
          {group.hasDuplicates ? (
            <Checkbox
              checked={group.isSelected}
              name="groupSelected"
              onChange={handleGroupCheckboxChange}
            />
          ) : (
            <Checkbox disabled sx={{ opacity: 0 }} />
          )}
        </Box>
        {group.mediaItemIds.map((mediaItemId) => (
          <MediaItemCard
            key={mediaItemId}
            {...{
              group,
              mediaItemId,
              handleSelectedOriginalChange,
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}

interface MediaItemCardProps {
  group: TaskResultsGroupType;
  mediaItemId: string;
  handleSelectedOriginalChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function MediaItemCard({
  group,
  mediaItemId,
  handleSelectedOriginalChange,
}: MediaItemCardProps) {
  const { results } = useContext(TaskResultsContext);
  const mediaItem = results.mediaItems[mediaItemId];
  const isOriginal = mediaItem.id === group.originalMediaItemId;
  const originalMediaItem = results.mediaItems[group.originalMediaItemId];

  const similarity =
    results.similarityMap[mediaItem.id]?.[originalMediaItem.id];
  const similarityPercent = similarity
    ? `${(similarity * 100).toFixed(1)}%`
    : "N/A";

  const cardClasses = [
    "media-item-card",
    isOriginal ? "selected" : "",
    mediaItem.deletedAt ? "deleted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card
      className={cardClasses}
      sx={{
        width: 220,
        opacity: mediaItem.deletedAt ? 0.6 : 1,
        transition: "all 0.2s ease",
        position: "relative",
      }}
      key={mediaItem.id}
    >
      {isOriginal && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)",
            color: "white",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: "0.7rem",
            fontWeight: 600,
            zIndex: 1,
          }}
        >
          ORIGINAL
        </Box>
      )}
      <CardActionArea
        href={mediaItem.productUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <CardMedia
          component="img"
          height="160"
          image={mediaItem.imageUrl}
          alt={mediaItem.filename}
          sx={{ objectFit: "cover" }}
        />
      </CardActionArea>
      <CardContent sx={{ pb: 1, pt: 1.5 }}>
        <Stack spacing={0.5}>
          {!isOriginal && similarity && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                mb: 0.5,
              }}
            >
              <CompareIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color:
                    similarity > 0.99
                      ? "success.main"
                      : similarity > 0.95
                      ? "warning.main"
                      : "error.main",
                }}
              >
                {similarityPercent} similar
              </Typography>
            </Box>
          )}
          <Tooltip title={mediaItem.filename} arrow>
            <Typography
              variant="body2"
              sx={{
                fontWeight: isOriginal ? 600 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "0.8rem",
              }}
            >
              {truncateString(mediaItem.filename, 20)}
            </Typography>
          </Tooltip>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.7rem" }}
          >
            {mediaItem.dimensions}
          </Typography>
          {mediaItem.deletedAt ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                color: "success.main",
                mt: 0.5,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Deleted
              </Typography>
            </Box>
          ) : (
            group.isSelected &&
            !isOriginal && (
              <FormControlLabel
                value={mediaItem.id}
                control={<Radio size="small" disableRipple sx={{ py: 0 }} />}
                label="Set as original"
                checked={false}
                onChange={handleSelectedOriginalChange}
                sx={{ mt: 0.5 }}
              />
            )
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

interface MediaItemCardFieldProps {
  field:
    | "similarity"
    | "filename"
    | "size"
    | "dimensions"
    | "deletedAt"
    | "error";
  mediaItem: MediaItemType;
  isOriginal: boolean;
  originalMediaItem: MediaItemType;
}

function MediaItemCardField({
  field,
  mediaItem,
  isOriginal,
  originalMediaItem,
}: MediaItemCardFieldProps) {
  const { results } = useContext(TaskResultsContext);
  let IconComponent = CompareIcon;
  let color = "text.primary";
  let tooltip = null;
  let text = "";

  if (field === "similarity") {
    if (isOriginal) {
      text = "Original";
    } else {
      let similarityAsPercent = "N/A";
      const similarity =
        results.similarityMap[mediaItem.id]?.[originalMediaItem.id];
      if (similarity) {
        similarityAsPercent = `${(similarity * 100).toFixed(2)}%`;
        if (similarity > 0.99) {
          color = "success.main";
        } else if (similarity > 0.95) {
          color = "warning.main";
        } else {
          color = "error.main";
        }
      }
      text = `Similarity: ${similarityAsPercent}`;
    }
  } else if (field === "filename") {
    IconComponent = RenameIcon;
    tooltip = mediaItem.filename;
    if (isOriginal || mediaItem.filename !== originalMediaItem.filename) {
      text = truncateString(mediaItem.filename, 24);
    } else {
      color = "success.main";
      text = "Same filename";
    }
  } else if (field === "dimensions") {
    IconComponent = AspectRatioIcon;
    tooltip = mediaItem.dimensions;
    if (isOriginal || mediaItem.dimensions !== originalMediaItem.dimensions) {
      text = mediaItem.dimensions;
    } else {
      color = "success.main";
      text = "Same dimensions";
    }
  } else if (field === "deletedAt") {
    IconComponent = CheckCircleIcon;
    color = "success.main";
    tooltip = new Date(mediaItem.deletedAt!).toLocaleString();
    text = "Deleted";
  } else if (field === "error") {
    IconComponent = ErrorIcon;
    color = "error.main";
    text = mediaItem.error || "";
  }

  return (
    <Box css={styles.valignMiddle} sx={{ color }}>
      <IconComponent css={styles.fieldIcon} />
      <Tooltip title={tooltip} placement="right" arrow>
        <Typography variant="body2">{text}</Typography>
      </Tooltip>
    </Box>
  );
}

function SelectAll() {
  const { results, dispatch } = useContext(TaskResultsContext);

  const selectedGroupsCount = Object.values(results.groups).filter(
    (g) => g.isSelected
  ).length;
  const allGroupsCount = Object.values(results.groups).filter(
    (g) => g.hasDuplicates
  ).length;
  const allGroupsSelected = selectedGroupsCount === allGroupsCount;
  const noGroupsSelected = selectedGroupsCount === 0;

  const handleCheckboxChange = () => {
    dispatch({
      type: "setAllGroupsSelected",
      isSelected: noGroupsSelected ? true : false,
    });
  };

  if (allGroupsCount === 0) {
    return null;
  }

  return (
    <Box sx={{ pt: 1 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={allGroupsSelected}
            indeterminate={!allGroupsSelected && !noGroupsSelected}
            onChange={handleCheckboxChange}
            name="selectAll"
          />
        }
        sx={{ ml: 0 }}
        label="Select all"
      />
    </Box>
  );
}
