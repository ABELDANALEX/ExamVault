import { useEffect, useState, useTransition } from 'react';
import { apiRequest } from '../api';
import LoadingScreen from '../components/LoadingScreen';
import { useApp } from '../context/AppContext';

const moduleOptions = [1, 2, 3, 4, 5];
const bloomsOptions = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'];
const difficultyOptions = ['L1', 'L2', 'L3'];
const typeOptions = ['MCQ', 'Theory'];

function createSection(title) {
  return {
    title,
    questionCount: '',
    marksPerQuestion: '',
    allowedModules: [],
    allowedBloomLevels: [...bloomsOptions],
    allowedDifficultyCodes: [...difficultyOptions],
    allowedQuestionTypes: [...typeOptions],
    higherOrderPercentage: 0
  };
}

function createBlueprintForm(subjectId = '') {
  return {
    name: '',
    subjectId,
    paperTitle: 'University Examination',
    totalMarks: '100',
    examDurationMinutes: '180',
    instructions: 'Answer all questions. Figures to the right indicate full marks.',
    sections: [
      createSection('Section A'),
      createSection('Section B'),
      createSection('Section C'),
      createSection('Section D')
    ]
  };
}

function normalizeSections(sections) {
  const result = sections.slice(0, 4).map((section, index) => ({
    title: section.title || `Section ${String.fromCharCode(65 + index)}`,
    questionCount: String(section.questionCount || ''),
    marksPerQuestion: String(section.marksPerQuestion || ''),
    allowedModules: section.allowedModules || [],
    allowedBloomLevels: section.allowedBloomLevels?.length ? section.allowedBloomLevels : [...bloomsOptions],
    allowedDifficultyCodes: section.allowedDifficultyCodes?.length
      ? section.allowedDifficultyCodes
      : [...difficultyOptions],
    allowedQuestionTypes: section.allowedQuestionTypes?.length
      ? section.allowedQuestionTypes
      : [...typeOptions],
    higherOrderPercentage: Number(section.higherOrderPercentage || 0)
  }));

  while (result.length < 4) {
    result.push(createSection(`Section ${String.fromCharCode(65 + result.length)}`));
  }

  return result;
}

export default function BlueprintsPage() {
  const { pushNotice } = useApp();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(createBlueprintForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    const response = await apiRequest('/api/faculty/blueprints');
    startTransition(() => {
      setData(response);
      setForm((current) =>
        current.subjectId || response.subjects.length === 0
          ? current
          : createBlueprintForm(String(response.subjects[0].id))
      );
    });
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await apiRequest('/api/faculty/blueprints');
        if (active) {
          startTransition(() => {
            setData(response);
            setForm(createBlueprintForm(response.subjects[0] ? String(response.subjects[0].id) : ''));
          });
        }
      } catch (error) {
        pushNotice({
          type: 'error',
          title: 'Blueprints Unavailable',
          message: error.message
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!data || isPending) {
    return <LoadingScreen label="Loading blueprints…" />;
  }

  const computedTotal = form.sections.reduce((sum, section) => {
    return sum + (Number(section.questionCount || 0) * Number(section.marksPerQuestion || 0));
  }, 0);
  const expectedTotal = Number(form.totalMarks || 0);
  const isValidTotal = computedTotal === expectedTotal && expectedTotal > 0;

  const updateSection = (index, updater) => {
    setForm((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? updater(section) : section
      )
    }));
  };

  const toggleSectionValue = (index, field, value) => {
    updateSection(index, (section) => {
      const values = section[field];
      return {
        ...section,
        [field]: values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
      };
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(createBlueprintForm(data.subjects[0] ? String(data.subjects[0].id) : ''));
  };

  const beginEdit = (blueprint) => {
    setEditingId(blueprint.id);
    setForm({
      name: blueprint.name,
      subjectId: String(blueprint.subject_id),
      paperTitle: blueprint.structure.paperTitle,
      totalMarks: String(blueprint.structure.totalMarks),
      examDurationMinutes: String(blueprint.structure.examDurationMinutes),
      instructions: blueprint.structure.instructions,
      sections: normalizeSections(blueprint.structure.sections || [])
    });
  };

  const buildPayload = () => {
    const payload = {
      name: form.name,
      subjectId: form.subjectId,
      paperTitle: form.paperTitle,
      totalMarks: form.totalMarks,
      examDurationMinutes: form.examDurationMinutes,
      instructions: form.instructions
    };

    form.sections.forEach((section, index) => {
      const key = index + 1;
      payload[`section_${key}_title`] = section.title;
      payload[`section_${key}_questionCount`] = section.questionCount;
      payload[`section_${key}_marksPerQuestion`] = section.marksPerQuestion;
      payload[`section_${key}_modules`] = section.allowedModules;
      payload[`section_${key}_blooms`] = section.allowedBloomLevels;
      payload[`section_${key}_difficulties`] = section.allowedDifficultyCodes;
      payload[`section_${key}_types`] = section.allowedQuestionTypes;
      payload[`section_${key}_higherOrderPercentage`] = section.higherOrderPercentage;
    });

    return payload;
  };

  const saveBlueprint = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = buildPayload();
      if (editingId) {
        await apiRequest(`/api/faculty/blueprints/${editingId}`, {
          method: 'PUT',
          body: payload
        });
        pushNotice({
          type: 'success',
          title: 'Blueprint Updated',
          message: 'The section rules are now live.'
        });
      } else {
        await apiRequest('/api/faculty/blueprints', {
          method: 'POST',
          body: payload
        });
        pushNotice({
          type: 'success',
          title: 'Blueprint Created',
          message: 'The blueprint was saved successfully.'
        });
      }

      await loadData();
      resetForm();
    } catch (error) {
      pushNotice({
        type: 'error',
        title: 'Blueprint Save Failed',
        message: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  const removeBlueprint = async (blueprintId) => {
    try {
      await apiRequest(`/api/faculty/blueprints/${blueprintId}`, {
        method: 'DELETE'
      });
      pushNotice({
        type: 'success',
        title: 'Blueprint Deleted',
        message: 'The blueprint was removed.'
      });
      await loadData();
      if (editingId === blueprintId) {
        resetForm();
      }
    } catch (error) {
      pushNotice({
        type: 'error',
        title: 'Delete Failed',
        message: error.message
      });
    }
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="page-eyebrow">Blueprint Logic</span>
          <h2>{editingId ? 'Edit Blueprint' : 'Blueprint Builder'}</h2>
          <p>Define section rules, module coverage, question types, and higher-order Bloom's targets without touching code.</p>
        </div>
        {editingId ? (
          <button type="button" className="secondary-button" onClick={resetForm}>
            Create New Blueprint
          </button>
        ) : null}
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>{editingId ? 'Update Blueprint' : 'Create Blueprint'}</h3>
          </div>

          <form className="stack-form" onSubmit={saveBlueprint}>
            <label>
              <span>Blueprint Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <label>
              <span>Subject</span>
              <select
                value={form.subjectId}
                onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}
                required
              >
                <option value="">Select subject</option>
                {data.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} - {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid form-grid-three">
              <label>
                <span>Paper Title</span>
                <input
                  value={form.paperTitle}
                  onChange={(event) => setForm((current) => ({ ...current, paperTitle: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Total Marks</span>
                <input
                  type="number"
                  min="1"
                  value={form.totalMarks}
                  onChange={(event) => setForm((current) => ({ ...current, totalMarks: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Duration</span>
                <input
                  type="number"
                  min="30"
                  value={form.examDurationMinutes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, examDurationMinutes: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <label>
              <span>Instructions</span>
              <textarea
                rows="3"
                value={form.instructions}
                onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
              />
            </label>

            <div className="section-stack">
              {form.sections.map((section, index) => {
                const sectionTotal =
                  Number(section.questionCount || 0) * Number(section.marksPerQuestion || 0);

                return (
                  <div key={index} className="section-builder">
                    <div className="section-builder-header">
                      <strong>Section {String.fromCharCode(65 + index)}</strong>
                      <span>{sectionTotal} marks</span>
                    </div>

                    <div className="form-grid form-grid-three">
                      <label>
                        <span>Title</span>
                        <input
                          value={section.title}
                          onChange={(event) =>
                            updateSection(index, (current) => ({ ...current, title: event.target.value }))
                          }
                        />
                      </label>

                      <label>
                        <span>Question Count</span>
                        <input
                          type="number"
                          min="0"
                          value={section.questionCount}
                          onChange={(event) =>
                            updateSection(index, (current) => ({ ...current, questionCount: event.target.value }))
                          }
                        />
                      </label>

                      <label>
                        <span>Marks Each</span>
                        <select
                          value={section.marksPerQuestion}
                          onChange={(event) =>
                            updateSection(index, (current) => ({ ...current, marksPerQuestion: event.target.value }))
                          }
                        >
                          <option value="">Select</option>
                          {[2, 5, 10].map((marks) => (
                            <option key={marks} value={marks}>
                              {marks}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label>
                      <span>Higher-Order Minimum %</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={section.higherOrderPercentage}
                        onChange={(event) =>
                          updateSection(index, (current) => ({
                            ...current,
                            higherOrderPercentage: Number(event.target.value || 0)
                          }))
                        }
                      />
                    </label>

                    <div className="chip-grid-block">
                      <div>
                        <span className="chip-label">Modules</span>
                        <div className="chip-grid">
                          {moduleOptions.map((moduleNumber) => (
                            <label key={moduleNumber} className="choice-chip">
                              <input
                                type="checkbox"
                                checked={section.allowedModules.includes(moduleNumber)}
                                onChange={() => toggleSectionValue(index, 'allowedModules', moduleNumber)}
                              />
                              <span>M{moduleNumber}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="chip-label">Bloom's Levels</span>
                        <div className="chip-grid">
                          {bloomsOptions.map((level) => (
                            <label key={level} className="choice-chip">
                              <input
                                type="checkbox"
                                checked={section.allowedBloomLevels.includes(level)}
                                onChange={() => toggleSectionValue(index, 'allowedBloomLevels', level)}
                              />
                              <span>{level}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="chip-label">Difficulty</span>
                        <div className="chip-grid">
                          {difficultyOptions.map((difficulty) => (
                            <label key={difficulty} className="choice-chip">
                              <input
                                type="checkbox"
                                checked={section.allowedDifficultyCodes.includes(difficulty)}
                                onChange={() => toggleSectionValue(index, 'allowedDifficultyCodes', difficulty)}
                              />
                              <span>{difficulty}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="chip-label">Question Types</span>
                        <div className="chip-grid">
                          {typeOptions.map((type) => (
                            <label key={type} className="choice-chip">
                              <input
                                type="checkbox"
                                checked={section.allowedQuestionTypes.includes(type)}
                                onChange={() => toggleSectionValue(index, 'allowedQuestionTypes', type)}
                              />
                              <span>{type}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`totals-banner ${isValidTotal ? 'valid' : 'invalid'}`}>
              <div>
                <strong>Real-Time Validation</strong>
                <p>The blueprint can only be saved when the section totals match the paper total exactly.</p>
              </div>
              <div className="totals-banner-values">
                <span>Expected {expectedTotal}</span>
                <strong>{computedTotal}</strong>
              </div>
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={saving || !isValidTotal || data.subjects.length === 0}
            >
              {saving ? 'Saving…' : editingId ? 'Update Blueprint' : 'Create Blueprint'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Saved Blueprints</h3>
          </div>

          <div className="list-stack">
            {data.blueprints.length === 0 ? (
              <p className="muted-copy">No blueprints saved yet.</p>
            ) : (
              data.blueprints.map((blueprint) => (
                <article key={blueprint.id} className="blueprint-card">
                  <div className="blueprint-card-header">
                    <div>
                      <strong>{blueprint.name}</strong>
                      <p>
                        {blueprint.subject_code} | {blueprint.structure.totalMarks} marks
                      </p>
                    </div>
                    <div className="table-actions">
                      <button type="button" className="secondary-button small" onClick={() => beginEdit(blueprint)}>
                        Edit
                      </button>
                      <button type="button" className="danger-button small" onClick={() => removeBlueprint(blueprint.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <ul className="detail-list compact">
                    {blueprint.structure.sections.map((section) => (
                      <li key={`${blueprint.id}-${section.title}`}>
                        {section.title}: {section.questionCount} x {section.marksPerQuestion}, modules {section.allowedModules.join(', ')}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
