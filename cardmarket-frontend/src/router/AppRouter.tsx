import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/layout/Layout";
import LoginPage from "../pages/LoginPage";
import Dashboard from "../pages/Dashboard";
import ProductsPage from "../pages/ProductsPage";
import TopMoversPage from "../pages/TopMoversPage";
import MonthlyPage from "../pages/MonthlyPage";
import VolatilityPage from "../pages/VolatilityPage";
import ValueRatioPage from "../pages/ValueRatioPage";
import PortfolioPage from "../pages/PortfolioPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/top-movers" element={<TopMoversPage />} />
                    <Route path="/monthly" element={<MonthlyPage />} />
                    <Route path="/volatility" element={<VolatilityPage />} />
                    <Route path="/value-ratio" element={<ValueRatioPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
