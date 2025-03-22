import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Taskmanagement from "./Component/Taskmanagement";
import Signup from "./Component/Signup";
import Login from "./Component/Login";
import ForgotPassword from "./Component/ForgotPassword";
import ResetPassword from "./Component/ResetPassword";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { isAuthenticated, updateAuth } = useAuth();
  
  const authRoutes = [
    { path: "/signin", element: Login, redirectTo: "/taskmanagement" },
    { path: "/signup", element: Signup, redirectTo: "/taskmanagement" },
  ];

  const protectedRoutes = [
    { path: "/taskmanagement", element: Taskmanagement },
  ];

  return (
    <Router>
      <div className="layout__wrapper flex flex-col justify-center items-center">
        <Routes>
          {authRoutes.map(({ path, element: Element, redirectTo }) => (
            <Route
              key={path}
              path={path}
              element={
                isAuthenticated ? (
                  <Navigate to={redirectTo} replace />
                ) : (
                  <Element setIsAuthenticated={updateAuth} />
                )
              }
            />
          ))}

          <Route path="/forgot-password/:token" element={<ResetPassword />} />
          <Route path="/forgot" element={<ForgotPassword />} />

          {protectedRoutes.map(({ path, element: Element }) => (
            <Route
              key={path}
              path={path}
              element={
                isAuthenticated ? (
                  <Element />
                ) : (
                  <Navigate to="/signin" replace />
                )
              }
            />
          ))}

          <Route
            path="/"
            element={
              <Navigate
                to={isAuthenticated ? "/taskmanagement" : "/signin"}
                replace
              />
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to={isAuthenticated ? "/taskmanagement" : "/signin"}
                replace
              />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}
