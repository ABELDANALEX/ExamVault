import { useDeferredValue, useEffect, useState, useTransition } from 'react';
import { apiRequest } from '../api';
import LoadingScreen from '../components/LoadingScreen';
import { useApp } from '../context/AppContext';

function createEmptyForm(subjectId = '') {
  return {
    subjectId,
    text: '',
    module: '1',
    marks: '2',
    difficultyCode: 'L1',
    bloomsLevel: 'K1',
    questionType: 'Theory'
  };
}

export default function QuestionsPage() {
  const { pushNotice } = useApp();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    const response = await apiRequest('/api/faculty/questions');
    startTransition(() => {
      setData(response);
      setForm((current) =>
        current.subjectId || response.subjects.length === 0
          ? current
          : createEmptyForm(String(response.subjects[0].id))
      );
    });
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await apiRequest('/api/faculty/questions');
        if (active) {
          startTransition(() => {
            setData(response);
            setForm(createEmptyForm(response.subjects[0] ? String(response.subjects[0].id) : ''));
          });
        }
      } catch (error) {
        pushNotice({
          type: 'error',
          title: 'Question Bank Unavailable',
          message: error.message
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!data || isPending) {
    return <LoadingScreen label="Loading question bank…" />;
  }

  const filteredQuestions = data.questions.filter((question) => {
    const haystack = `${question.subject_code} ${question.text} ${question.blooms_level} ${question.difficulty_code} ${question.question_type}`.toLowerCase();
    return haystack.includes(deferredSearch.trim().toLowerCase());
  });

  const resetForm = () => {
    setEditingId(null);
    setForm(createEmptyForm(data.subjects[0] ? String(data.subjects[0].id) : ''));
  };

  const beginEdit = (question) => {
    setEditingId(question.id);
    setForm({
      subjectId: String(question.subject_id),
      text: question.text,
      module: String(question.module),
      marks: String(question.marks),
      difficultyCode: question.difficulty_code,
      bloomsLevel: question.blooms_level,
      questionType: question.question_type
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await apiRequest(`/api/faculty/questions/${editingId}`, {
          method: 'PUT',
          body: form
        });
        pushNotice({
          type: 'success',
          title: 'Question Updated',
          message: 'The latest version is live and the previous version was archived.'
        });
      } else {
        await apiRequest('/api/faculty/questions', {
          method: 'POST',
          body: form
        });
        pushNotice({
          type: 'success',
          title: 'Question Added',
          message: 'The question is now part of your personal bank.'
        });
      }

      await loadData();
      resetForm();
    } catch (error) {
      pushNotice({
        type: 'error',
        title: 'Question Save Failed',
        message: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  const archiveQuestion = async (questionId) => {
    try {
      await apiRequest(`/api/faculty/questions/${questionId}`, {
        method: 'DELETE'
      });
      pushNotice({
        type: 'success',
        title: 'Question Archived',
        message: 'The question was removed from the active bank and its history was preserved.'
      });
      await loadData();
      if (editingId === questionId) {
        resetForm();
      }
    } catch (error) {
      pushNotice({
        type: 'error',
        title: 'Archive Failed',
        message: error.message
      });
    }
  };

  const importWorkbook = async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('questionFile', file);

    try {
      const response = await apiRequest('/api/faculty/questions/import', {
        method: 'POST',
        body: formData
      });
      pushNotice({
        type: 'success',
        title: 'Import Complete',
        message: response.message
      });
      await loadData();
      event.target.value = '';
    } catch (error) {
      pushNotice({
        type: 'error',
        title: 'Import Rejected',
        message: error.message
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="page-eyebrow">Smart Question Bank</span>
          <h2>{editingId ? 'Edit Question' : 'Question Bank'}</h2>
          <p>Every edit is archived as a version, and imports are rejected if even one row breaks the metadata rules.</p>
        </div>
        {editingId ? (
          <button type="button" className="secondary-button" onClick={resetForm}>
            Create New Question
          </button>
        ) : null}
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>{editingId ? 'Update Question' : 'Add Question'}</h3>
          </div>

          <form className="stack-form" onSubmit={onSubmit}>
            <label>
              <span>Subject</span>
              <select
                value={form.subjectId}
                onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}
                required
              >
                <option value="">Select assigned subject</option>
                {data.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} - {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Question Text</span>
              <textarea
                rows="6"
                value={form.text}
                onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
                required
              />
            </label>

            <div className="form-grid">
              <label>
                <span>Module</span>
                <select
                  value={form.module}
                  onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))}
                >
                  {[1, 2, 3, 4, 5].map((moduleNumber) => (
                    <option key={moduleNumber} value={moduleNumber}>
                      Module {moduleNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Marks</span>
                <select
                  value={form.marks}
                  onChange={(event) => setForm((current) => ({ ...current, marks: event.target.value }))}
                >
                  {[2, 5, 10].map((marks) => (
                    <option key={marks} value={marks}>
                      {marks}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid form-grid-three">
              <label>
                <span>Difficulty</span>
                <select
                  value={form.difficultyCode}
                  onChange={(event) => setForm((current) => ({ ...current, difficultyCode: event.target.value }))}
                >
                  {['L1', 'L2', 'L3'].map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Bloom's</span>
                <select
                  value={form.bloomsLevel}
                  onChange={(event) => setForm((current) => ({ ...current, bloomsLevel: event.target.value }))}
                >
                  {['K1', 'K2', 'K3', 'K4', 'K5', 'K6'].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Type</span>
                <select
                  value={form.questionType}
                  onChange={(event) => setForm((current) => ({ ...current, questionType: event.target.value }))}
                >
                  {['Theory', 'MCQ'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button type="submit" className="primary-button" disabled={saving || data.subjects.length === 0}>
              {saving ? 'Saving…' : editingId ? 'Update Question' : 'Add Question'}
            </button>
          </form>

          <div className="import-block">
            <div className="panel-header">
              <h3>Bulk Import</h3>
            </div>
            <p className="muted-copy">
              Required columns: QuestionText, SubjectCode, ModuleNumber, Marks, Difficulty, BloomsLevel, QuestionType.
            </p>
            <label className="file-input">
              <input type="file" accept=".csv,.xlsx" onChange={importWorkbook} disabled={importing} />
              <span>{importing ? 'Validating workbook…' : 'Select CSV / XLSX'}</span>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Active Questions</h3>
            <input
              className="search-input"
              placeholder="Search by text, subject, Bloom's, type…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Question</th>
                  <th>Metadata</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-row">
                      No matching questions found.
                    </td>
                  </tr>
                ) : (
                  filteredQuestions.map((question) => (
                    <tr key={question.id}>
                      <td>
                        <span className="inline-badge">{question.subject_code}</span>
                      </td>
                      <td className="question-cell">{question.text}</td>
                      <td>
                        <div className="meta-stack">
                          <span>Module {question.module}</span>
                          <span>{question.marks} marks</span>
                          <span>
                            {question.difficulty_code} / {question.blooms_level} / {question.question_type}
                          </span>
                          <span>
                            Version {question.version}, snapshots {question.version_archive_count}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="secondary-button small" onClick={() => beginEdit(question)}>
                            Edit
                          </button>
                          <button type="button" className="danger-button small" onClick={() => archiveQuestion(question.id)}>
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
