import { Routes, Route } from "react-router-dom";
import HomePage from "../components/HomePage";
import ErEditor from "../components/ErEditor";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/diagrama/:slug" element={<ErEditor />} />
    </Routes>
  );
}
