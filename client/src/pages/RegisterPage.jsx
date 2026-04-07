import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api';
import { useApp } from '../context/AppContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { pushNotice } = useApp();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    departmentId: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await apiRequest('/api/public/bootstrap');
        if (active) {
          setDepartments(response.departments);
        }
      } catch (error) {
        pushNotice({
          type: 'error',
          title: 'Registration Setup Failed',
          message: error.message
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [pushNotice]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: form
      });
      pushNotice({
        type: 'success',
        title: 'Registration Submitted',
        message: response.message
      });
      navigate('/login', { replace: true });
    } catch (error) {
      pushNotice({
        type: 'error',
        title: 'Registration Failed',
        message: error.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <span className="page-eyebrow">Faculty Registration</span>
        <h1>Request ExamVault Access</h1>
        <p>
          Your account will stay pending until an admin approves it and assigns the subjects you are allowed to access.
        </p>

        <form className="stack-form" onSubmit={onSubmit}>
          <label>
            <span>Full Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>

          <label>
            <span>Institutional Email</span>
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

          <label>
            <span>Department</span>
            <select
              value={form.departmentId}
              onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.parent_name ? `${department.parent_name} -> ${department.name}` : department.name}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>

        <p className="auth-links">
          Already approved? <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
