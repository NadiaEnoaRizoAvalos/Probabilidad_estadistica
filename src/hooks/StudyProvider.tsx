import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Attempt, StudyState } from "../types";
import { parseStudyState, storageKey } from "./studyStorage";

interface StudyContextValue {
  state: StudyState;
  storageError: boolean;
  toggleComplete: (id: string) => void;
  complete: (id: string) => void;
  toggleBookmark: (id: string) => void;
  setExamDate: (date: string) => void;
  saveAttempt: (attempt: Attempt) => void;
}

// Context lives beside its provider so all routes share one state.
// eslint-disable-next-line react-refresh/only-export-components
export const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [storageError, setStorageError] = useState(false);
  const [state, setState] = useState<StudyState>(() => {
    try {
      return parseStudyState(localStorage.getItem(storageKey));
    } catch {
      return parseStudyState(null);
    }
  });
  useEffect(() => {
    // Report failures of the external storage operation to the user.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state]);
  const complete = useCallback(
    (id: string) =>
      setState((previous) =>
        previous.completed[id]
          ? previous
          : {
              ...previous,
              completed: {
                ...previous.completed,
                [id]: new Date().toISOString(),
              },
            },
      ),
    [],
  );
  function toggleComplete(id: string) {
    setState((previous) => {
      const completed = { ...previous.completed };
      if (completed[id]) delete completed[id];
      else completed[id] = new Date().toISOString();
      return { ...previous, completed };
    });
  }
  function toggleBookmark(id: string) {
    setState((previous) => ({
      ...previous,
      bookmarked: previous.bookmarked.includes(id)
        ? previous.bookmarked.filter((item) => item !== id)
        : [...previous.bookmarked, id],
    }));
  }
  function setExamDate(examDate: string) {
    setState((previous) => ({ ...previous, examDate }));
  }
  function saveAttempt(attempt: Attempt) {
    setState((previous) => ({
      ...previous,
      attempts: [...previous.attempts, attempt],
      completed: {
        ...previous.completed,
        practica: previous.completed.practica ?? attempt.date,
      },
    }));
  }
  return (
    <StudyContext.Provider
      value={{
        state,
        storageError,
        toggleComplete,
        complete,
        toggleBookmark,
        setExamDate,
        saveAttempt,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}
