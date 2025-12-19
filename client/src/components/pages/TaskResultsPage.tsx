import "./ActiveTaskPage.css";
import { appApiUrl } from "utils";
import TaskResults from "components/TaskResults";
import { useFetch } from "utils/useFetch";
import CircularProgress from "@mui/material/CircularProgress";
import { TaskResultsType } from "utils/types";
import { useContext } from "react";
import { AppContext } from "utils/AppContext";

export default function TaskResultsPage() {
  const { data: results, isLoading } = useFetch<TaskResultsType>(
    appApiUrl("/api/active_task/results")
  );
  const { activeTask } = useContext(AppContext);
  return (
    <>
      {isLoading ? (
        <CircularProgress size={"2rem"} sx={{ mt: 2 }} />
      ) : (
        <>
          {results && (results as any).error ? (
            // If backend returned an error payload (e.g., insufficient scopes), show re-auth prompt
            <Alert severity="error" sx={{ mt: 2 }}>
              <AlertTitle>Action required</AlertTitle>
              {(results as any).error === "insufficient_scopes" ? (
                <>
                  Insufficient authentication scopes. Please{" "}
                  <a href="/auth/google">re-authorize</a> the app to grant the
                  required permissions.
                </>
              ) : (
                (results as any).error
              )}
            </Alert>
          ) : (
            activeTask?.status === "SUCCESS" &&
            results && <TaskResults results={results!} />
          )}
        </>
      )}
    </>
  );
}
