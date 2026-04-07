import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
  const { login, pushNotice } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const user = await login(form);
      const destination =
        location.state?.from || (user.role === 'admin' ? '/admin' : '/faculty');
      navigate(destination, { replace: true });
    } catch (error) {
      pushNotice({
        type: 'error',
        title: 'Sign In Failed',
        message: error.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <span className="page-eyebrow">Secure Academic System</span>
        <h1>Sign in to ExamVault</h1>
        <p>
          Manage secure question banks, blueprint-driven generation, and encrypted delivery from one place.
        </p>

        <form className="stack-form" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        <div className="info-callout">
          <strong>Default admin bootstrap</strong>
          <span>`admin@examvault.local` / `Admin@123`</span>
        </div>

        <p className="auth-links">
          Need faculty access? <Link to="/register">Request approval</Link>
        </p>
      </div>
    </div>
  );
}
