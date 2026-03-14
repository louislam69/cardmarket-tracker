import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={{ padding: "12px", borderBottom: "1px solid #ccc" }}>
      <Link to="/" style={{ marginRight: "12px" }}>Dashboard</Link>
      <Link to="/products" style={{ marginRight: "12px" }}>Produkte</Link>
      <Link to="/top-movers" style={{ marginRight: "12px" }}>Top Movers</Link>
      <Link to="/monthly" style={{ marginRight: "12px" }}>Monatsvergleich</Link>
      <Link to="/volatility" style={{ marginRight: "12px" }}>Volatilität</Link>
      <Link to="/value-ratio" style={{ marginRight: "12px" }}>Sealed vs. Singles</Link>
    </nav>
  );
}
