import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Grades from "./pages/Grades";
import Metrics from "./pages/Metrics";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/admin", element: <Admin /> },
  { path: "/grades", element: <Grades /> },
  { path: "/metrics", element: <Metrics /> },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
