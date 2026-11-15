import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { StudyProvider } from "./hooks/StudyProvider";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Theory } from "./pages/Theory";
import { StudyRoute } from "./pages/StudyRoute";
import { StatisticsLab } from "./pages/StatisticsLab";
import { Exams } from "./pages/Exams";
import { Review } from "./pages/Review";
import { NotFound } from "./pages/NotFound";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StudyProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="teoria" element={<Theory />} />
            <Route path="ruta" element={<StudyRoute />} />
            <Route path="laboratorio" element={<StatisticsLab />} />
            <Route path="parciales" element={<Exams />} />
            <Route path="repaso" element={<Review />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </StudyProvider>
  </StrictMode>,
);
