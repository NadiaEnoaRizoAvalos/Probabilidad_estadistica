import { useContext } from "react";
import { StudyContext } from "./StudyProvider";

export function useStudy() {
  const value = useContext(StudyContext);
  if (!value) throw new Error("Falta StudyProvider");
  return value;
}
