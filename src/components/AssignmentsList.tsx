import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Classroom, Assignment, Submission, StudentInfo } from '../types';
import { useAuth } from '../context/AuthContext';
import { logAuditEvent } from '../lib/audit';
import {
  FileText,
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  Upload,
  GraduationCap,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';

interface AssignmentsListProps {
  classroom: Classroom;
}

export const AssignmentsList: React.FC<AssignmentsListProps> = ({ classroom }) => {
  const { userProfile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, Submission[]>>({});
  const [loading, setLoading] = useState(true);

  // New assignment modal
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxPoints, setMaxPoints] = useState('100');

  // Submit work modal for student
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submittingWork, setSubmittingWork] = useState(false);

  // View Submissions & Grade modal for teacher
  const [gradingAssignment, setGradingAssignment] = useState<Assignment | null>(null);
  const [gradeInputs, setGradeInputs] = useState<Record<string, { score: string; feedback: string }>>({});

  if (!userProfile) return null;

  const isTeacher = userProfile.role === 'teacher';

  const fetchAssignmentsAndSubmissions = async () => {
    setLoading(true);
    try {
      // Fetch assignments for class
      const qAssign = query(
        collection(db, 'assignments'),
        where('classId', '==', classroom.id)
      );
      const assignSnap = await getDocs(qAssign);
      const list: Assignment[] = [];

      assignSnap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as object) } as Assignment);
      });

      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAssignments(list);

      // Fetch all submissions for this class
      const qSub = query(
        collection(db, 'submissions'),
        where('classId', '==', classroom.id)
      );
      const subSnap = await getDocs(qSub);
      const subMap: Record<string, Submission[]> = {};

      subSnap.forEach((d) => {
        const sub = { id: d.id, ...(d.data() as object) } as Submission;
        if (!subMap[sub.assignmentId]) subMap[sub.assignmentId] = [];
        subMap[sub.assignmentId].push(sub);
      });

      setSubmissionsMap(subMap);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignmentsAndSubmissions();
  }, [classroom]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    try {
      const docRef = await addDoc(collection(db, 'assignments'), {
        classId: classroom.id,
        title: title.trim(),
        instructions: instructions.trim(),
        dueDate,
        maxPoints: parseInt(maxPoints) || 100,
        createdAt: new Date().toISOString(),
      });

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName,
        userProfile.role,
        'ASSIGNMENT_CREATED',
        `Created assignment "${title.trim()}" due ${dueDate}`,
        classroom.id
      );

      setTitle('');
      setInstructions('');
      setDueDate('');
      setMaxPoints('100');
      setShowCreate(false);
      await fetchAssignmentsAndSubmissions();
    } catch (err) {
      console.error('Error creating assignment:', err);
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    setSubmittingWork(true);

    try {
      const subId = `${selectedAssignment.id}_${userProfile.uid}`;
      const subRef = doc(db, 'submissions', subId);

      const newSubmission: Submission = {
        id: subId,
        assignmentId: selectedAssignment.id,
        classId: classroom.id,
        studentUid: userProfile.uid,
        studentName: userProfile.displayName,
        studentId: userProfile.studentId || 'STU-UNKNOWN',
        content: submissionText.trim(),
        attachmentUrl: attachmentUrl.trim() || undefined,
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      };

      await setDoc(subRef, newSubmission);

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName,
        userProfile.role,
        'WORK_SUBMITTED',
        `Submitted work for assignment "${selectedAssignment.title}"`,
        classroom.id
      );

      setSelectedAssignment(null);
      setSubmissionText('');
      setAttachmentUrl('');
      await fetchAssignmentsAndSubmissions();
    } catch (err) {
      console.error('Error submitting work:', err);
    }
    setSubmittingWork(false);
  };

  const handleSaveGrade = async (sub: Submission) => {
    const input = gradeInputs[sub.id];
    if (!input || !gradingAssignment) return;

    try {
      const subRef = doc(db, 'submissions', sub.id);
      await updateDoc(subRef, {
        score: parseFloat(input.score) || 0,
        feedback: input.feedback.trim(),
        status: 'graded',
        gradedAt: new Date().toISOString(),
        gradedByName: userProfile.displayName,
      });

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName,
        userProfile.role,
        'WORK_GRADED',
        `Graded submission for ${sub.studentName} on "${gradingAssignment.title}": ${input.score}/${gradingAssignment.maxPoints}`,
        classroom.id
      );

      await fetchAssignmentsAndSubmissions();
    } catch (err) {
      console.error('Error saving grade:', err);
    }
  };

  const handleDeleteAssignment = async (id: string, aTitle: string) => {
    if (!confirm(`Delete assignment "${aTitle}"?`)) return;
    try {
      await deleteDoc(doc(db, 'assignments', id));
      await fetchAssignmentsAndSubmissions();
    } catch (err) {
      console.error('Error deleting assignment:', err);
    }
  };

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 font-mono text-xs">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 uppercase">
            Course Assignments
          </h3>
          <p className="text-zinc-400 text-[11px]">
            Manage assignments, student submissions, and score entry
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 rounded bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Assignment
          </button>
        )}
      </div>

      {/* Assignment List */}
      {loading ? (
        <div className="text-center py-8 font-mono text-xs text-zinc-400">
          Loading course assignments...
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-8 font-mono text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded p-4">
          No assignments created for this class yet.
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const subs = submissionsMap[a.id] || [];
            const studentSub = !isTeacher
              ? subs.find((s) => s.studentUid === userProfile.uid)
              : null;

            return (
              <div
                key={a.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 font-mono text-xs text-zinc-200"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-800/80 pb-3 mb-3">
                  <div>
                    <h4 className="text-base font-bold text-zinc-100">{a.title}</h4>
                    <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        Due: {a.dueDate}
                      </span>
                      <span>•</span>
                      <span>Max Points: {a.maxPoints} pts</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isTeacher ? (
                      <>
                        <button
                          onClick={() => {
                            setGradingAssignment(a);
                            // Pre-fill existing grades into inputs
                            const initInputs: Record<string, { score: string; feedback: string }> = {};
                            subs.forEach((s) => {
                              initInputs[s.id] = {
                                score: s.score !== undefined ? String(s.score) : '',
                                feedback: s.feedback || '',
                              };
                            });
                            setGradeInputs(initInputs);
                          }}
                          className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium flex items-center gap-1.5"
                        >
                          <GraduationCap className="w-4 h-4 text-sky-400" />
                          View Submissions ({subs.length})
                        </button>

                        <button
                          onClick={() => handleDeleteAssignment(a.id, a.title)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded"
                          title="Delete Assignment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div>
                        {studentSub ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase border ${
                                studentSub.status === 'graded'
                                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                  : 'bg-sky-950 text-sky-400 border-sky-800'
                              }`}
                            >
                              {studentSub.status === 'graded'
                                ? `Graded: ${studentSub.score}/${a.maxPoints}`
                                : 'Submitted'}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedAssignment(a);
                                setSubmissionText(studentSub.content);
                                setAttachmentUrl(studentSub.attachmentUrl || '');
                              }}
                              className="px-2.5 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-[11px]"
                            >
                              Edit Submission
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedAssignment(a);
                              setSubmissionText('');
                              setAttachmentUrl('');
                            }}
                            className="px-3 py-1.5 rounded bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold flex items-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Submit Work
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Instructions */}
                <div className="text-zinc-300 font-sans text-xs leading-relaxed">
                  {a.instructions}
                </div>

                {/* Student specific feedback block */}
                {!isTeacher && studentSub && studentSub.status === 'graded' && (
                  <div className="mt-3 bg-zinc-950 border border-emerald-900/60 rounded p-3 text-xs">
                    <div className="font-bold text-emerald-400 uppercase text-[10px] mb-1">
                      Grade & Instructor Feedback ({studentSub.gradedByName || 'Teacher'})
                    </div>
                    <div className="text-zinc-200 font-bold mb-1">
                      Score: {studentSub.score} / {a.maxPoints}
                    </div>
                    {studentSub.feedback && (
                      <div className="text-zinc-400 italic">"{studentSub.feedback}"</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6 text-zinc-200 font-mono text-xs">
            <h2 className="text-base font-bold uppercase tracking-wide border-b border-zinc-800 pb-3 mb-4">
              Create New Assignment
            </h2>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-zinc-400 uppercase tracking-wider mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab 1: Data Structures Analysis"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-zinc-400 uppercase tracking-wider mb-1">
                  Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Assignment guidelines, homework instructions..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 uppercase tracking-wider mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 uppercase tracking-wider mb-1">
                    Max Points
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold rounded"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Work Modal (Student) */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-lg w-full p-6 text-zinc-200 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h2 className="text-base font-bold uppercase tracking-wide">
                Submit Work: {selectedAssignment.title}
              </h2>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWork} className="space-y-4">
              <div>
                <label className="block text-zinc-400 uppercase tracking-wider mb-1">
                  Submission Text / Response *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type your response or answers here..."
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-zinc-400 uppercase tracking-wider mb-1">
                  Optional File Link / Attachment URL
                </label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/... or link to work"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="px-4 py-2 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWork}
                  className="px-4 py-2 bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold rounded disabled:opacity-50"
                >
                  {submittingWork ? 'Submitting...' : 'Submit Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grade Submissions Modal (Teacher) */}
      {gradingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-3xl w-full p-6 text-zinc-200 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-100 uppercase">
                  Submissions: {gradingAssignment.title}
                </h2>
                <p className="text-zinc-400 text-[11px] mt-0.5">
                  Max Points: {gradingAssignment.maxPoints} pts
                </p>
              </div>
              <button
                onClick={() => setGradingAssignment(null)}
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submissions list */}
            {submissionsMap[gradingAssignment.id]?.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 bg-zinc-950 p-4 border border-zinc-800 rounded">
                No student work submitted for this assignment yet.
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                {submissionsMap[gradingAssignment.id]?.map((s) => {
                  const input = gradeInputs[s.id] || { score: '', feedback: '' };

                  return (
                    <div
                      key={s.id}
                      className="bg-zinc-950 border border-zinc-800 rounded p-4 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
                        <div>
                          <span className="font-bold text-zinc-100">{s.studentName}</span>
                          <span className="text-zinc-400 text-[11px] ml-2">({s.studentId})</span>
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          Submitted:{' '}
                          {new Date(s.submittedAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="bg-zinc-900 border border-zinc-800/80 p-2.5 rounded text-zinc-200 font-sans mb-3 text-xs">
                        {s.content}
                      </div>

                      {s.attachmentUrl && (
                        <div className="mb-3 text-[11px]">
                          <a
                            href={s.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-400 hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Attached File / Link
                          </a>
                        </div>
                      )}

                      {/* Grade entry controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end pt-2 border-t border-zinc-800">
                        <div>
                          <label className="block text-[10px] uppercase text-zinc-400 mb-1">
                            Score (out of {gradingAssignment.maxPoints})
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={input.score}
                            onChange={(e) =>
                              setGradeInputs({
                                ...gradeInputs,
                                [s.id]: { ...input, score: e.target.value },
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-100 focus:outline-none focus:border-zinc-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase text-zinc-400 mb-1">
                            Instructor Feedback
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Great work, well organized."
                            value={input.feedback}
                            onChange={(e) =>
                              setGradeInputs({
                                ...gradeInputs,
                                [s.id]: { ...input, feedback: e.target.value },
                              })
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-100 focus:outline-none focus:border-zinc-600"
                          />
                        </div>

                        <button
                          onClick={() => handleSaveGrade(s)}
                          className="px-3 py-1 bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold rounded flex items-center justify-center gap-1"
                        >
                          Save Grade
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-zinc-800 text-right">
              <button
                onClick={() => setGradingAssignment(null)}
                className="px-4 py-1.5 rounded border border-zinc-700 text-zinc-300 font-mono text-xs hover:bg-zinc-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
