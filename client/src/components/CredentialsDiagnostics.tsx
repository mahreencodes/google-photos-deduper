import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import { appApiUrl } from "utils";

export default function CredentialsDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<null | {
    has_credentials: boolean;
    scopes: string[] | null;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  const onCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(appApiUrl("/api/credentials"));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Failed to fetch credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ my: 2 }}>
      <Button
        variant="outlined"
        onClick={onCheck}
        disabled={loading}
        size="small"
      >
        {loading ? <CircularProgress size={16} /> : "Check stored credentials"}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {data && (
        <Box sx={{ mt: 1 }}>
          {!data.has_credentials ? (
            <Alert severity="warning">
              <AlertTitle>No credentials found</AlertTitle>
              No stored credentials for the current user — please{" "}
              <a href="/auth/google">sign in / re-authorize</a>.
            </Alert>
          ) : (
            <Alert severity="info">
              <AlertTitle>Stored credentials</AlertTitle>
              <div>
                <strong>Scopes:</strong>
                <ul>
                  {data.scopes && data.scopes.length > 0 ? (
                    data.scopes.map((s) => <li key={s}>{s}</li>)
                  ) : (
                    <li>None listed</li>
                  )}
                </ul>
                <div>
                  If scopes are missing, please{" "}
                  <a href="/auth/google?prompt=consent">re-authorize</a> the app
                  to grant the required permissions.
                </div>
              </div>
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
}
