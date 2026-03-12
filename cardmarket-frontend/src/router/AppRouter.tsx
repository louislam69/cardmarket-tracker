import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "../components/layout/Layout";
import Dashboard from "../pages/Dashboard";
import ProductsPage from "../pages/ProductsPage";
import TopMoversPage from "../pages/TopMoversPage";
import MonthlyPage from "../pages/MonthlyPage";
import VolatilityPage from "../pages/VolatilityPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/top-movers" element={<TopMoversPage />} />
          <Route path="/monthly" element={<MonthlyPage />} />
          <Route path="/volatility" element={<VolatilityPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
