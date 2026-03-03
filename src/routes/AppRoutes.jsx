import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Admin from "../pages/Admin";
import Grades from "../pages/Grades";
import Metrics from "../pages/Metrics";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/grades" element={<Grades />} />
      <Route path="/metrics" element={<Metrics />} />
    </Routes>
  );
};

export default AppRoutes;
