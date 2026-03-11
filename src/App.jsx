import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Grades from "./pages/Grades";
import Metrics from "./pages/Metrics";
import Weekly from "./pages/Weekly";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/admin", element: <Admin /> },
  { path: "/grades", element: <Grades /> },
  { path: "/metrics", element: <Metrics /> },
  { path: "/weekly", element: <Weekly /> },
  // Team deep links (e.g. /t4). Static routes above will win automatically.
  { path: "/:teamCode", element: <Home /> },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
