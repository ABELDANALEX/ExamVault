import { useEffect, useState, useTransition } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import LoadingScreen from '../components/LoadingScreen';
import MetricCard from '../components/MetricCard';
import { useApp } from '../context/AppContext';

export default function FacultyDashboardPage() {
  const { pushNotice } = useApp();
  const [dashboard, setDashboard] = useState(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await apiRequest('/api/faculty/dashboard');
        if (active) {
          startTransition(() => {
            setDashboard(response);
          });
        }
      } catch (error) {
        pushNotice({
          type: 'error',
          title: 'Dashboard Unavailable',
          message: error.message
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!dashboard || isPending) {
    return <LoadingScreen label="Loading faculty workspace…" />;
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="page-eyebrow">Faculty Workspace</span>
          <h2>Generation Dashboard</h2>
          <p>Build question banks, codify blueprint rules, and generate encrypted papers without exposing the key.</p>
        </div>
        <div className="header-actions">
          <Link to="/faculty/questions" className="secondary-button">
            Question Bank
          </Link>
          <Link to="/faculty/blueprints" className="secondary-button">
            Blueprints
          </Link>
          <Link to="/faculty/generate" className="primary-button">
            Generate Paper
          </Link>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Assigned Subjects" value={dashboard.assignedSubjects.length} tone="warm" />
        <MetricCard label="Active Questions" value={dashboard.questionCount} />
        <MetricCard label="Blueprints" value={dashboard.blueprintCount} />
        <MetricCard label="Encrypted Papers" value={dashboard.generatedPaperCount} tone="cool" />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Authorized Subjects</h3>
        </div>
        <div className="pill-wrap">
          {dashboard.assignedSubjects.length === 0 ? (
            <p className="muted-copy">No subject has been assigned yet. Contact the admin to approve access.</p>
          ) : (
            dashboard.assignedSubjects.map((subject) => (
              <span key={subject.id} className="data-pill">
                <strong>{subject.code}</strong> {subject.name}
              </span>
            ))
          )}
        </div>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h3>Recent Blueprints</h3>
          </div>
          <div className="list-stack">
            {dashboard.recentBlueprints.length === 0 ? (
              <p className="muted-copy">No blueprints created yet.</p>
            ) : (
              dashboard.recentBlueprints.map((blueprint) => (
                <article key={blueprint.id} className="list-card">
                  <div>
                    <strong>{blueprint.name}</strong>
                    <p>{blueprint.subject_code}</p>
                  </div>
                  <span>{blueprint.structure.totalMarks} marks</span>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Recent Vault Files</h3>
          </div>
          <div className="list-stack">
            {dashboard.recentPapers.length === 0 ? (
              <p className="muted-copy">No papers generated yet.</p>
            ) : (
              dashboard.recentPapers.map((paper) => (
                <article key={paper.id} className="list-card">
                  <div>
                    <strong>{paper.subject_code}</strong>
                    <p>{paper.blueprint_name}</p>
                  </div>
                  <a className="inline-link" href={`/api/faculty/papers/${paper.id}/download`}>
                    Download
                  </a>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
