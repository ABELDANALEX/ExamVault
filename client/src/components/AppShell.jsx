import { NavLink, Outlet } from 'react-router-dom';

const adminLinks = [
  { to: '/admin', label: 'Admin Dashboard' }
];

const facultyLinks = [
  { to: '/faculty', label: 'Overview', end: true },
  { to: '/faculty/questions', label: 'Question Bank' },
  { to: '/faculty/blueprints', label: 'Blueprints' },
  { to: '/faculty/generate', label: 'Generate' }
];

export default function AppShell({ user, onLogout }) {
  const links = user.role === 'admin' ? adminLinks : facultyLinks;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-eyebrow">Secure Academic System</span>
          <h1>ExamVault</h1>
          <p>Pedagogical compliance, unbiased selection, and encrypted delivery.</p>
        </div>

        <nav className="nav-list">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <span>{user.role.toUpperCase()}</span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button type="button" className="ghost-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
