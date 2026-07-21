import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/transfer', label: 'Transfer' },
  { to: '/bill-pay', label: 'Bill Pay' },
  { to: '/transfer/scheduled', label: 'Scheduled' },
  { to: '/cards', label: 'Credit Cards' },
  { to: '/loans', label: 'Loans' },
  { to: '/documents', label: 'Documents' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/settings/profile', label: 'Profile' },
  { to: '/settings/security', label: 'Security' },
];

const adminItems = [
  { to: '/admin', label: 'Admin Dashboard' },
  { to: '/admin/applications/cards', label: 'Card Applications' },
  { to: '/admin/applications/loans', label: 'Loan Applications' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/feature-flags', label: 'Feature Flags' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-bank-900 text-white flex flex-col">
        <div className="p-6 border-b border-bank-700">
          <h1 className="text-xl font-bold">SecureBank</h1>
          <p className="text-sm text-bank-100 mt-1 truncate">{user?.email}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? 'bg-bank-600 text-white' : 'text-bank-100 hover:bg-bank-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2 text-xs uppercase text-bank-300 font-semibold">Admin</div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm transition ${
                      isActive ? 'bg-bank-600 text-white' : 'text-bank-100 hover:bg-bank-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="p-4 border-t border-bank-700">
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-bank-100 hover:bg-bank-800 rounded-lg">
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
