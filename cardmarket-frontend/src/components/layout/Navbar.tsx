import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/products", label: "Produkte" },
  { to: "/top-movers", label: "Top Movers" },
  { to: "/monthly", label: "Monatsvergleich" },
  { to: "/volatility", label: "Volatilität" },
  { to: "/value-ratio", label: "Sealed vs. Singles" },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-900 text-sm mr-4">Cardmarket Tracker</span>
        {links.map(({ to, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={
                active
                  ? "text-sm font-semibold text-blue-700 border-b-2 border-blue-700 pb-0.5"
                  : "text-sm font-medium text-gray-600 hover:text-blue-700 transition-colors"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
