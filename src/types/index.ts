export interface Topic {
  id: string;
  title: string;
  category: string;
  minutes: number;
  description: string;
  definition: string;
  example: string;
  concepts: string[];
}

export interface Question {
  id: string;
  topic: string;
  prompt: string;
  number?: number;
  reviewNote?: string;
  options: string[];
  correct: number | null;
  type?: "choice" | "written" | "true-false" | "selection" | "numeric";
  examId?: string;
  photoId?: string;
  modelAnswer?: string;
  numericAnswer?: { value: number; absoluteTolerance: number; relativeTolerance: number };
  steps?: string[];
  verified?: boolean;
  explanation: string;
  difficulty?: "Inicial" | "Intermedio" | "Avanzado";
  origin:
    | "Parcial anterior"
    | "Pregunta del profesor"
    | "Apunte de clase"
    | "Pregunta de práctica generada con IA"
    | "Pregunta adicional recopilada para estudiar";
  tags: string[];
}

export interface Attempt {
  id: string;
  date: string;
  mode: "parcial" | "repaso";
  answers: { questionId: string; correct: boolean; selfAssessed?: boolean }[];
  pendingAnswers?: { questionId: string; response: string }[];
}

export interface StudyState {
  completed: Record<string, string>;
  bookmarked: string[];
  examDate: string;
  attempts: Attempt[];
}
