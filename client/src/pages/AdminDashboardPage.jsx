import { useDeferredValue, useEffect, useState, useTransition } from 'react';
import { apiRequest } from '../api';
import LoadingScreen from '../components/LoadingScreen';
import MetricCard from '../components/MetricCard';
import { useApp } from '../context/AppContext';

function toggleArrayValue(values, value) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function CreateFacultyForm({ departments, subjects, onSubmit, saving }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    departmentId: '',
    subjectIds: []
  });

  const submit = async (event) => {
    event.preventDefault();
    await onSubmit(form);
    setForm({
      name: '',
      email: '',
      password: '',
      departmentId: '',
      subjectIds: []
    });
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <label>
        <span>Name</span>
        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
      </label>
      <label>
        <span>Email</span>
        <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
      </label>
      <label>
        <span>Password</span>
        <input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
      </label>
      <label>
        <span>Department</span>
        <select value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}>
          <option value="">Unassigned</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.parent_name ? `${department.parent_name} -> ${department.name}` : department.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="chip-label">Assign Subjects</span>
        <div className="chip-grid">
          {subjects.map((subject) => (
            <label key={subject.id} className="choice-chip">
              <input
                type="checkbox"
                checked={form.subjectIds.includes(subject.id)}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    subjectIds: toggleArrayValue(current.subjectIds, subject.id)
                  }))
                }
              />
              <span>{subject.code}</span>
            </label>
          ))}
        </div>
      </div>
      <button type="submit" className="primary-button" disabled={saving}>
        {saving ? 'Creating…' : 'Create Faculty'}
      </button>
    </form>
  );
}

function PendingFacultyCard({ faculty, departments, subjects, onApprove }) {
  const [departmentId, setDepartmentId] = useState(faculty.department_id ? String(faculty.department_id) : '');
  const [subjectIds, setSubjectIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onApprove(faculty.id, {
        departmentId,
        subjectIds
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="subpanel pending-card" onSubmit={submit}>
      <div className="section-builder-header">
        <div>
          <strong>{faculty.name}</strong>
          <p>{faculty.email}</p>
        </div>
        <span className="inline-badge warning">Pending</span>
      </div>

      <label>
        <span>Department</span>
        <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">Unassigned</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.parent_name ? `${department.parent_name} -> ${department.name}` : department.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="chip-label">Assign Subjects</span>
        <div className="chip-grid">
          {subjects.map((subject) => (
            <label key={subject.id} className="choice-chip">
              <input
                type="checkbox"
                checked={subjectIds.includes(subject.id)}
                onChange={() => setSubjectIds((current) => toggleArrayValue(current, subject.id))}
              />
              <span>{subject.code}</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="primary-button" disabled={saving}>
        {saving ? 'Approving…' : 'Approve Registration'}
      </button>
    </form>
  );
}

function FacultyAccessCard({ faculty, subjects, onSaveAssignments, onRevoke, onReactivate }) {
  const assignedCodes = (faculty.assigned_subject_codes || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(
    subjects.filter((subject) => assignedCodes.includes(subject.code)).map((subject) => subject.id)
  );
  const [saving, setSaving] = useState(false);

  const saveAssignments = async () => {
    setSaving(true);
    try {
      await onSaveAssignments(faculty.id, selectedSubjectIds);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="subpanel faculty-card">
      <div className="section-builder-header">
        <div>
          <strong>{faculty.name}</strong>
          <p>{faculty.email}</p>
        </div>
        <span className={`inline-badge ${faculty.status === 'active' ? 'success' : 'danger'}`}>{faculty.status}</span>
      </div>

      <p className="muted-copy">{faculty.department_name || 'Unassigned department'}</p>

      <div>
        <span className="chip-label">Subject Access</span>
        <div className="chip-grid">
          {subjects.map((subject) => (
            <label key={subject.id} className="choice-chip">
              <input
                type="checkbox"
                checked={selectedSubjectIds.includes(subject.id)}
                onChange={() => setSelectedSubjectIds((current) => toggleArrayValue(current, subject.id))}
              />
              <span>{subject.code}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="table-actions">
        <button type="button" className="secondary-button small" onClick={saveAssignments} disabled={saving}>
          {saving ? 'Saving…' : 'Update Subjects'}
        </button>
        {faculty.status === 'active' ? (
          <button type="button" className="danger-button small" onClick={() => onRevoke(faculty.id)}>
            Revoke Access
          </button>
        ) : (
          <button type="button" className="primary-button small" onClick={() => onReactivate(faculty.id)}>
            Reactivate
          </button>
        )}
      </div>
    </article>
  );
}

export default function AdminDashboardPage() {
  const { pushNotice } = useApp();
  const [dashboard, setDashboard] = useState(null);
  const [departmentForm, setDepartmentForm] = useState({ name: '', parentDepartmentId: '' });
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', departmentId: '' });
  const [configForm, setConfigForm] = useState(null);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [facultySearch, setFacultySearch] = useState('');
  const deferredFacultySearch = useDeferredValue(facultySearch);
  const [isPending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState('');

  const loadDashboard = async () => {
    const response = await apiRequest('/api/admin/dashboard');
    startTransition(() => {
      setDashboard(response);
      setConfigForm({
        globalLookbackMonths: String(response.systemConfig.globalLookbackMonths),
        globalLookbackExamCount: String(response.systemConfig.globalLookbackExamCount),
        pdfUniversityName: response.systemConfig.pdf_university_name,
        pdfHeaderText: response.systemConfig.pdf_header_text,
        pdfFooterText: response.systemConfig.pdf_footer_text,
        pdfLogoPath: response.systemConfig.pdf_logo_path,
        examCellEmail: response.systemConfig.exam_cell_email,
        examCellPhone: response.systemConfig.exam_cell_phone
      });
    });
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await apiRequest('/api/admin/dashboard');
        if (active) {
          startTransition(() => {
            setDashboard(response);
            setConfigForm({
              globalLookbackMonths: String(response.systemConfig.globalLookbackMonths),
              globalLookbackExamCount: String(response.systemConfig.globalLookbackExamCount),
              pdfUniversityName: response.systemConfig.pdf_university_name,
              pdfHeaderText: response.systemConfig.pdf_header_text,
              pdfFooterText: response.systemConfig.pdf_footer_text,
              pdfLogoPath: response.systemConfig.pdf_logo_path,
              examCellEmail: response.systemConfig.exam_cell_email,
              examCellPhone: response.systemConfig.exam_cell_phone
            });
          });
        }
      } catch (error) {
        pushNotice({
          type: 'error',
          title: 'Admin Dashboard Unavailable',
          message: error.message
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!dashboard || !configForm || isPending) {
    return <LoadingScreen label="Loading admin watchtower…" />;
  }

  const filteredFaculty = dashboard.activeFaculty.filter((faculty) => {
    const haystack = `${faculty.name} ${faculty.email} ${faculty.assigned_subject_codes || ''}`.toLowerCase();
    return haystack.includes(deferredFacultySearch.trim().toLowerCase());
  });

  const runAction = async (work, messages) => {
    try {
      await work();
      pushNotice({
        type: 'success',
        title: messages.successTitle,
        message: messages.successMessage
      });
      await loadDashboard();
    } catch (error) {
      pushNotice({
        type: 'error',
        title: messages.errorTitle,
        message: error.message
      });
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="page-eyebrow">Admin Watchtower</span>
          <h2>Admin Dashboard</h2>
          <p>Control the department tree, subject assignments, handover policy, and suspicious-generation monitoring.</p>
        </div>
      </section>

      <section className="metric-grid metric-grid-six">
        <MetricCard label="Departments" value={dashboard.metrics.departments} />
        <MetricCard label="Subjects" value={dashboard.metrics.subjects} />
        <MetricCard label="Active Faculty" value={dashboard.metrics.activeFaculty} tone="cool" />
        <MetricCard label="Pending Faculty" value={dashboard.metrics.pendingFaculty} tone="warm" />
        <MetricCard label="Open Alerts" value={dashboard.metrics.alerts} tone="danger" />
        <MetricCard label="Generated Papers" value={dashboard.metrics.generatedPapers} />
      </section>

      <div className="three-column">
        <section className="panel">
          <div className="panel-header">
            <h3>Department Tree</h3>
          </div>
          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusyKey('department');
              await runAction(
                async () => {
                  await apiRequest('/api/admin/departments', {
                    method: 'POST',
                    body: departmentForm
                  });
                  setDepartmentForm({ name: '', parentDepartmentId: '' });
                },
                {
                  successTitle: 'Department Added',
                  successMessage: 'The department tree was updated.',
                  errorTitle: 'Department Create Failed'
                }
              );
            }}
          >
            <label>
              <span>Name</span>
              <input value={departmentForm.name} onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              <span>Parent Department</span>
              <select value={departmentForm.parentDepartmentId} onChange={(event) => setDepartmentForm((current) => ({ ...current, parentDepartmentId: event.target.value }))}>
                <option value="">Top-level unit</option>
                {dashboard.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.parent_name ? `${department.parent_name} -> ${department.name}` : department.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button" disabled={busyKey === 'department'}>
              {busyKey === 'department' ? 'Saving…' : 'Add Department'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Create Subject</h3>
          </div>
          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusyKey('subject');
              await runAction(
                async () => {
                  await apiRequest('/api/admin/subjects', {
                    method: 'POST',
                    body: subjectForm
                  });
                  setSubjectForm({ code: '', name: '', departmentId: '' });
                },
                {
                  successTitle: 'Subject Added',
                  successMessage: 'Faculty scoping can now use the new subject.',
                  errorTitle: 'Subject Create Failed'
                }
              );
            }}
          >
            <label>
              <span>Code</span>
              <input value={subjectForm.code} onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))} required />
            </label>
            <label>
              <span>Name</span>
              <input value={subjectForm.name} onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              <span>Department</span>
              <select value={subjectForm.departmentId} onChange={(event) => setSubjectForm((current) => ({ ...current, departmentId: event.target.value }))}>
                <option value="">Unassigned</option>
                {dashboard.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.parent_name ? `${department.parent_name} -> ${department.name}` : department.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button" disabled={busyKey === 'subject'}>
              {busyKey === 'subject' ? 'Saving…' : 'Add Subject'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Pre-Approved Faculty</h3>
          </div>
          <CreateFacultyForm
            departments={dashboard.departments}
            subjects={dashboard.subjects}
            saving={busyKey === 'faculty-create'}
            onSubmit={async (form) => {
              setBusyKey('faculty-create');
              await runAction(
                async () => {
                  await apiRequest('/api/admin/faculty', {
                    method: 'POST',
                    body: form
                  });
                },
                {
                  successTitle: 'Faculty Created',
                  successMessage: 'The account is active and subject-scoped.',
                  errorTitle: 'Faculty Create Failed'
                }
              );
            }}
          />
        </section>
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h3>Pending Faculty Approvals</h3>
          </div>
          <div className="list-stack">
            {dashboard.pendingFaculty.length === 0 ? (
              <p className="muted-copy">No pending registrations.</p>
            ) : (
              dashboard.pendingFaculty.map((faculty) => (
                <PendingFacultyCard
                  key={faculty.id}
                  faculty={faculty}
                  departments={dashboard.departments}
                  subjects={dashboard.subjects}
                  onApprove={async (facultyId, payload) => {
                    await runAction(
                      () =>
                        apiRequest(`/api/admin/faculty/${facultyId}/approve`, {
                          method: 'POST',
                          body: payload
                        }),
                      {
                        successTitle: 'Faculty Approved',
                        successMessage: 'The faculty account can now sign in.',
                        errorTitle: 'Approval Failed'
                      }
                    );
                  }}
                />
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>System Configuration</h3>
          </div>
          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusyKey('config');
              await runAction(
                () =>
                  apiRequest('/api/admin/config', {
                    method: 'PUT',
                    body: configForm
                  }),
                {
                  successTitle: 'Configuration Saved',
                  successMessage: 'Global lookback and PDF handover settings were updated.',
                  errorTitle: 'Configuration Failed'
                }
              );
            }}
          >
            <div className="form-grid">
              <label>
                <span>Global Lookback Months</span>
                <input type="number" min="0" value={configForm.globalLookbackMonths} onChange={(event) => setConfigForm((current) => ({ ...current, globalLookbackMonths: event.target.value }))} />
              </label>
              <label>
                <span>Previous Exams Blocked</span>
                <input type="number" min="0" value={configForm.globalLookbackExamCount} onChange={(event) => setConfigForm((current) => ({ ...current, globalLookbackExamCount: event.target.value }))} />
              </label>
            </div>
            <label>
              <span>University Name</span>
              <input value={configForm.pdfUniversityName} onChange={(event) => setConfigForm((current) => ({ ...current, pdfUniversityName: event.target.value }))} />
            </label>
            <label>
              <span>PDF Header Text</span>
              <input value={configForm.pdfHeaderText} onChange={(event) => setConfigForm((current) => ({ ...current, pdfHeaderText: event.target.value }))} />
            </label>
            <label>
              <span>PDF Footer Text</span>
              <input value={configForm.pdfFooterText} onChange={(event) => setConfigForm((current) => ({ ...current, pdfFooterText: event.target.value }))} />
            </label>
            <label>
              <span>Logo Path</span>
              <input value={configForm.pdfLogoPath} onChange={(event) => setConfigForm((current) => ({ ...current, pdfLogoPath: event.target.value }))} />
            </label>
            <div className="form-grid">
              <label>
                <span>Exam Cell Email</span>
                <input value={configForm.examCellEmail} onChange={(event) => setConfigForm((current) => ({ ...current, examCellEmail: event.target.value }))} />
              </label>
              <label>
                <span>Exam Cell Phone</span>
                <input value={configForm.examCellPhone} onChange={(event) => setConfigForm((current) => ({ ...current, examCellPhone: event.target.value }))} />
              </label>
            </div>
            <button type="submit" className="primary-button" disabled={busyKey === 'config'}>
              {busyKey === 'config' ? 'Saving…' : 'Save Configuration'}
            </button>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h3>Faculty Access Matrix</h3>
          <input className="search-input" placeholder="Filter faculty by name, email, or subject…" value={facultySearch} onChange={(event) => setFacultySearch(event.target.value)} />
        </div>
        <div className="list-stack">
          {filteredFaculty.length === 0 ? (
            <p className="muted-copy">No faculty match the current filter.</p>
          ) : (
            filteredFaculty.map((faculty) => (
              <FacultyAccessCard
                key={faculty.id}
                faculty={faculty}
                subjects={dashboard.subjects}
                onSaveAssignments={async (facultyId, subjectIds) => {
                  await runAction(
                    () =>
                      apiRequest(`/api/admin/faculty/${facultyId}/assignments`, {
                        method: 'PUT',
                        body: { subjectIds }
                      }),
                    {
                      successTitle: 'Assignments Updated',
                      successMessage: 'The faculty subject scope was updated.',
                      errorTitle: 'Assignment Update Failed'
                    }
                  );
                }}
                onRevoke={async (facultyId) => {
                  await runAction(
                    () =>
                      apiRequest(`/api/admin/faculty/${facultyId}/revoke`, {
                        method: 'POST'
                      }),
                    {
                      successTitle: 'Access Revoked',
                      successMessage: 'Faculty access was removed immediately.',
                      errorTitle: 'Revoke Failed'
                    }
                  );
                }}
                onReactivate={async (facultyId) => {
                  await runAction(
                    () =>
                      apiRequest(`/api/admin/faculty/${facultyId}/reactivate`, {
                        method: 'POST'
                      }),
                    {
                      successTitle: 'Access Reactivated',
                      successMessage: 'Faculty account access was restored.',
                      errorTitle: 'Reactivation Failed'
                    }
                  );
                }}
              />
            ))
          )}
        </div>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h3>Security Alerts</h3>
          </div>
          <div className="list-stack">
            {dashboard.alerts.length === 0 ? (
              <p className="muted-copy">No security alerts.</p>
            ) : (
              dashboard.alerts.map((alert) => (
                <article key={alert.id} className="list-card">
                  <div>
                    <strong>{alert.message}</strong>
                    <p>{alert.resolved_at ? `Resolved by ${alert.resolved_by_name || 'Admin'}` : 'Open alert'}</p>
                  </div>
                  {!alert.resolved_at ? (
                    <button
                      type="button"
                      className="secondary-button small"
                      onClick={async () => {
                        await runAction(
                          () =>
                            apiRequest(`/api/admin/alerts/${alert.id}/resolve`, {
                              method: 'POST'
                            }),
                          {
                            successTitle: 'Alert Resolved',
                            successMessage: 'The alert was marked as resolved.',
                            errorTitle: 'Resolve Failed'
                          }
                        );
                      }}
                    >
                      Resolve
                    </button>
                  ) : (
                    <span className="inline-badge success">Resolved</span>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Exam Cell Key Handover Queue</h3>
          </div>
          <div className="list-stack">
            {dashboard.handovers.length === 0 ? (
              <p className="muted-copy">No pending handovers.</p>
            ) : (
              dashboard.handovers.map((handover) => (
                <article key={handover.paper_id} className="handover-card">
                  <div>
                    <strong>
                      {handover.subject_code} | Paper #{handover.paper_id}
                    </strong>
                    <p>
                      {handover.faculty_name} · {handover.channels || 'No configured channels'}
                    </p>
                  </div>
                  {handover.revealed_at ? (
                    <span className="inline-badge">Already revealed</span>
                  ) : (
                    <button
                      type="button"
                      className="primary-button small"
                      onClick={async () => {
                        try {
                          const response = await apiRequest(`/api/admin/papers/${handover.paper_id}/reveal-key`, {
                            method: 'POST'
                          });
                          setRevealedKeys((current) => ({
                            ...current,
                            [handover.paper_id]: response.accessKey
                          }));
                          pushNotice({
                            type: 'success',
                            title: 'Single-Use Key Revealed',
                            message: `Paper #${handover.paper_id} key is visible below for the Exam Cell.`
                          });
                          await loadDashboard();
                        } catch (error) {
                          pushNotice({
                            type: 'error',
                            title: 'Reveal Failed',
                            message: error.message
                          });
                        }
                      }}
                    >
                      Reveal Once
                    </button>
                  )}
                  {revealedKeys[handover.paper_id] ? (
                    <div className="key-reveal-box">
                      <strong>Access Key</strong>
                      <code>{revealedKeys[handover.paper_id]}</code>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h3>Paper Generation Log</h3>
          </div>
          <div className="table-wrap">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Faculty</th>
                  <th>Subject</th>
                  <th>Blueprint</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.generatedPapers.map((paper) => (
                  <tr key={paper.id}>
                    <td>{new Date(paper.generated_at).toLocaleString('en-IN')}</td>
                    <td>{paper.faculty_name}</td>
                    <td>{paper.subject_code}</td>
                    <td>{paper.blueprint_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Global Audit Log</h3>
          </div>
          <div className="table-wrap">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                    <td>{log.user_name || 'System'}</td>
                    <td>{log.action}</td>
                    <td>
                      {log.entity_type}#{log.entity_id || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
