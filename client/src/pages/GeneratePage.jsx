import { useEffect, useState, useTransition } from 'react';
import { apiRequest } from '../api';
import LoadingScreen from '../components/LoadingScreen';
import { useApp } from '../context/AppContext';

export default function GeneratePage() {
  const { pushNotice } = useApp();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    blueprintId: '',
    examDate: ''
  });
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    const response = await apiRequest('/api/faculty/generate');
    startTransition(() => {
      setData(response);
      setForm((current) => ({
        blueprintId: current.blueprintId || (response.blueprints[0] ? String(response.blueprints[0].id) : ''),
        examDate: current.examDate
      }));
    });
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await apiRequest('/api/faculty/generate');
        if (active) {
          startTransition(() => {
            setData(response);
            setForm({
              blueprintId: response.blueprints[0] ? String(response.blueprints[0].id) : '',
              examDate: ''
            });
          });
        }
      } catch (error) {
        pushNotice({
          type: 'error',
          title: 'Generation Setup Failed',
          message: error.message
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!data || isPending) {
    return <LoadingScreen label="Loading generation controls…" />;
  }

  const generatePaper = async (event) => {
    event.preventDefault();
    setGenerating(true);

    try {
      const response = await apiRequest('/api/faculty/generate', {
        method: 'POST',
        body: form
      });
      setResult(response);
      pushNotice({
        type: 'success',
        title: 'Vault Ready',
        message: response.message
      });
      await loadData();
    } catch (error) {
      pushNotice({
        type: 'error',
        title: 'Generation Failed',
        message: error.message
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="page-eyebrow">GenEngine + Vault</span>
          <h2>Generate Secure Question Paper</h2>
          <p>Selection is randomized in-app, screened by lookback history, and handed off through a split file/key workflow.</p>
        </div>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h3>Generate Encrypted Paper</h3>
          </div>

          <form className="stack-form" onSubmit={generatePaper}>
            <label>
              <span>Blueprint</span>
              <select
                value={form.blueprintId}
                onChange={(event) => setForm((current) => ({ ...current, blueprintId: event.target.value }))}
                required
              >
                <option value="">Select blueprint</option>
                {data.blueprints.map((blueprint) => (
                  <option key={blueprint.id} value={blueprint.id}>
                    {blueprint.name} | {blueprint.subject_code} | {blueprint.structure.totalMarks} marks
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Exam Date</span>
              <input
                type="date"
                value={form.examDate}
                onChange={(event) => setForm((current) => ({ ...current, examDate: event.target.value }))}
                required
              />
            </label>

            <p className="muted-copy">
              Faculty can download the encrypted vault file, but only the Exam Cell can receive the single-use access key.
            </p>

            <button type="submit" className="primary-button" disabled={generating || data.blueprints.length === 0}>
              {generating ? 'Generating…' : 'Generate & Encrypt'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Recent Vault Files</h3>
          </div>

          <div className="list-stack">
            {data.recentPapers.length === 0 ? (
              <p className="muted-copy">No encrypted papers generated yet.</p>
            ) : (
              data.recentPapers.map((paper) => (
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

      {result ? (
        <section className="panel">
          <div className="panel-header">
            <h3>Latest Generation Result</h3>
            <a className="primary-button" href={`/api/faculty/papers/${result.paper.id}/download`}>
              Download Vault
            </a>
          </div>

          <div className="two-column">
            <div className="subpanel">
              <h4>Exam Cell Handover</h4>
              <p className="muted-copy">
                The access key is not shown to faculty. It was queued to the following Exam Cell channels.
              </p>
              <ul className="detail-list">
                {result.handoverTargets.length === 0 ? (
                  <li>No Exam Cell target is configured yet.</li>
                ) : (
                  result.handoverTargets.map((target) => (
                    <li key={`${target.channelType}-${target.maskedTarget}`}>
                      {target.channelType.toUpperCase()}: {target.maskedTarget}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="subpanel">
              <h4>Paper Summary</h4>
              <ul className="detail-list">
                <li>Subject: {result.paper.subjectCode} - {result.paper.subjectName}</li>
                <li>Blueprint: {result.paper.blueprintName}</li>
                <li>Exam Date: {result.paper.examDate}</li>
                <li>Total Marks: {result.paper.totalMarks}</li>
                <li>Vault File: {result.paper.fileName}</li>
              </ul>
            </div>
          </div>

          <div className="two-column">
            <div className="subpanel">
              <h4>Diagnostics</h4>
              <ul className="detail-list">
                {result.diagnostics.map((entry) => (
                  <li key={entry.sectionTitle}>
                    {entry.sectionTitle}: fresh {entry.freshCandidateCount}, deferred {entry.lookbackDeferredCount}, higher-order minimum {entry.requiredHigherOrderCount}
                  </li>
                ))}
              </ul>
            </div>

            <div className="subpanel">
              <h4>Selected Questions</h4>
              <div className="question-result-list">
                {result.sections.map((section) => (
                  <div key={section.title} className="result-section">
                    <strong>{section.title}</strong>
                    {section.questions.map((question) => (
                      <div key={question.id} className="result-question">
                        <span>{question.text}</span>
                        <small>
                          Module {question.module} | {question.marks} marks | {question.difficulty_code} / {question.blooms_level} / {question.question_type}
                        </small>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
