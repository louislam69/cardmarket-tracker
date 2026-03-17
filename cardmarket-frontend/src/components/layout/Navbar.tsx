import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/products", label: "Produkte" },
  { to: "/top-movers", label: "Top Movers" },
  { to: "/monthly", label: "Monatsvergleich" },
  { to: "/volatility", label: "Volatilität" },
  { to: "/value-ratio", label: "Sealed vs. Singles" },
  { to: "/portfolio", label: "Portfolio" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4 sm:gap-8 overflow-x-auto">
        <span className="font-bold text-blue-700 text-base tracking-tight shrink-0 mr-1">
          Cardmarket Tracker
        </span>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {links.map(({ to, label }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={
                  active
                    ? "px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 whitespace-nowrap"
                    : "px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors whitespace-nowrap"
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {user && (
            <span className="hidden sm:block text-xs text-gray-500 truncate max-w-[180px]">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
