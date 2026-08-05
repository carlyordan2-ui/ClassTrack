import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Classroom, StudentInfo, AttendanceRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { StudentAttendanceHistoryModal } from './StudentAttendanceHistoryModal';
import { logAuditEvent } from '../lib/audit';
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Search,
  Trash2,
  Eye,
  KeyRound,
  FileText,
} from 'lucide-react';

interface StudentRosterProps {
  classroom: Classroom;
  onRosterUpdated: () => void;
}

export const StudentRoster: React.FC<StudentRosterProps> = ({
  classroom,
  onRosterUpdated,
}) => {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [attendanceStatsMap, setAttendanceStatsMap] = useState<
    Record<string, { total: number; present: number; late: number; absent: number; rate: number }>
  >({});
  const [loading, setLoading] = useState(true);

  // Add student form modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState(false);

  // Filter search
  const [filterQuery, setFilterQuery] = useState('');

  // Selected student for history modal
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);

  if (!userProfile) return null;

  const isTeacher = userProfile.role === 'teacher';

  const fetchRosterAndStats = async () => {
    setLoading(true);
    try {
      // Fetch student profiles for studentUids
      const uids = classroom.studentUids || [];
      const studentList: StudentInfo[] = [];

      if (uids.length > 0) {
        // Query users collection for these uids
        const qUsers = query(collection(db, 'users'), where('uid', 'in', uids.slice(0, 30)));
        const userSnap = await getDocs(qUsers);
        userSnap.forEach((d) => {
          const u = d.data();
          studentList.push({
            uid: u.uid,
            studentId: u.studentId || classroom.studentsMap?.[u.uid]?.studentId || 'N/A',
            displayName: u.displayName || 'Student',
            email: u.email || '',
          });
        });
      }

      setStudents(studentList);

      // Fetch attendance records for this classroom to calculate stats per student
      const qAtt = query(collection(db, 'attendance'), where('classId', '==', classroom.id));
      const attSnap = await getDocs(qAtt);

      const statsMap: Record<
        string,
        { total: number; present: number; late: number; absent: number; rate: number }
      > = {};

      attSnap.forEach((d) => {
        const r = d.data() as AttendanceRecord;
        if (!statsMap[r.studentUid]) {
          statsMap[r.studentUid] = { total: 0, present: 0, late: 0, absent: 0, rate: 100 };
        }
        statsMap[r.studentUid].total += 1;
        if (r.status === 'present') statsMap[r.studentUid].present += 1;
        else if (r.status === 'late') statsMap[r.studentUid].late += 1;
        else if (r.status === 'absent') statsMap[r.studentUid].absent += 1;
      });

      // Calculate rates
      Object.keys(statsMap).forEach((uid) => {
        const s = statsMap[uid];
        s.rate =
          s.total > 0
            ? Math.round(((s.present + s.late * 0.5) / s.total) * 100)
            : 100;
      });

      setAttendanceStatsMap(statsMap);
    } catch (err) {
      console.error('Error fetching roster details:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRosterAndStats();
  }, [classroom]);

  const handleAddStudentByInput = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAdding(true);

    const term = studentSearchInput.trim();
    if (!term) return;

    try {
      // Search user by studentId or email
      let q = query(collection(db, 'users'), where('studentId', '==', term));
      let snap = await getDocs(q);

      if (snap.empty) {
        q = query(collection(db, 'users'), where('email', '==', term.toLowerCase()));
        snap = await getDocs(q);
      }

      if (snap.empty) {
        setAddError('No student account found matching that Student ID or Email.');
        setAdding(false);
        return;
      }

      const targetDoc = snap.docs[0];
      const targetData = targetDoc.data();

      if (classroom.studentUids?.includes(targetData.uid)) {
        setAddError('This student is already on the roster.');
        setAdding(false);
        return;
      }

      const updatedStudentUids = [...(classroom.studentUids || []), targetData.uid];
      const updatedStudentsMap = {
        ...(classroom.studentsMap || {}),
        [targetData.uid]: {
          uid: targetData.uid,
          studentId: targetData.studentId || 'N/A',
          displayName: targetData.displayName,
          email: targetData.email,
          joinedAt: new Date().toISOString(),
        },
      };

      await updateDoc(doc(db, 'classes', classroom.id), {
        studentUids: updatedStudentUids,
        studentsMap: updatedStudentsMap,
      });

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName,
        userProfile.role,
        'STUDENT_ADDED',
        `Teacher added student ${targetData.displayName} (${targetData.studentId || targetData.email}) to class.`,
        classroom.id
      );

      setShowAddModal(false);
      setStudentSearchInput('');
      onRosterUpdated();
      await fetchRosterAndStats();
    } catch (err) {
      console.error('Error adding student:', err);
      setAddError('Failed to add student to class.');
    }
    setAdding(false);
  };

  const handleRemoveStudent = async (studentUid: string, name: string) => {
    if (!confirm(`Remove ${name} from this classroom roster?`)) return;

    try {
      const updatedUids = (classroom.studentUids || []).filter((id) => id !== studentUid);
      const updatedMap = { ...(classroom.studentsMap || {}) };
      delete updatedMap[studentUid];

      await updateDoc(doc(db, 'classes', classroom.id), {
        studentUids: updatedUids,
        studentsMap: updatedMap,
      });

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName,
        userProfile.role,
        'STUDENT_REMOVED',
        `Teacher removed student ${name} from class roster.`,
        classroom.id
      );

      onRosterUpdated();
      await fetchRosterAndStats();
    } catch (err) {
      console.error('Error removing student:', err);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(classroom.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredStudents = students.filter(
    (s) =>
      s.displayName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="font-sans">
      {/* Roster Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-400">
            <Users className="w-5 h-5 text-zinc-300" />
          </div>
          <div>
            <h3 className="text-sm font-mono font-bold text-zinc-100 uppercase">
              Class Roster ({students.length} Enrolled)
            </h3>
            <p className="text-xs font-mono text-zinc-400">
              Instructor: {classroom.teacherName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Join Code Display */}
          <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded flex items-center gap-2">
            <span className="text-zinc-400 text-[10px] uppercase">Join Code:</span>
            <span className="font-bold text-zinc-100 tracking-wider">{classroom.joinCode}</span>
            <button
              onClick={handleCopyCode}
              className="p-1 text-zinc-400 hover:text-zinc-100 rounded"
              title="Copy Join Code"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {isTeacher && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Student
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search input */}
      <div className="mb-4 relative font-mono text-xs max-w-sm">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Filter roster by Name or Student ID..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded pl-9 pr-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
        />
      </div>

      {/* Roster Table - Mobile Cards (< md) & Desktop Table (>= md) */}
      {loading ? (
        <div className="text-center py-8 font-mono text-xs text-zinc-400">
          Loading student roster...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-8 font-mono text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded p-4">
          No students found matching current roster filter.
        </div>
      ) : (
        <>
          {/* Mobile Card Layout (< md) */}
          <div className="md:hidden space-y-3 font-mono text-xs">
            {filteredStudents.map((s) => {
              const stats = attendanceStatsMap[s.uid] || {
                total: 0,
                present: 0,
                late: 0,
                absent: 0,
                rate: 100,
              };

              return (
                <div
                  key={s.uid}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-100">{s.displayName}</h4>
                      <p className="text-zinc-400 text-[11px]">ID: {s.studentId}</p>
                      <p className="text-zinc-500 text-[10px] truncate">{s.email}</p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        stats.rate < 85
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {stats.rate}% Rate
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                    <span className="text-zinc-400">Recorded Stats ({stats.total} days):</span>
                    <span className="font-medium">
                      <span className="text-emerald-400 font-bold">{stats.present}P</span> /{' '}
                      <span className="text-amber-400 font-bold">{stats.late}L</span> /{' '}
                      <span className="text-red-400 font-bold">{stats.absent}A</span>
                    </span>
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedStudent(s)}
                      className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 inline-flex items-center gap-1.5 text-xs font-medium"
                    >
                      <Eye className="w-3.5 h-3.5 text-zinc-400" />
                      View Log History
                    </button>

                    {isTeacher && (
                      <button
                        onClick={() => handleRemoveStudent(s.uid, s.displayName)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors"
                        title="Remove from Class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table Layout (>= md) */}
          <div className="hidden md:block border border-zinc-800 rounded-lg bg-zinc-900">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Attendance Rate</th>
                  <th className="py-3 px-4">P / L / A</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredStudents.map((s) => {
                  const stats = attendanceStatsMap[s.uid] || {
                    total: 0,
                    present: 0,
                    late: 0,
                    absent: 0,
                    rate: 100,
                  };
                  return (
                    <tr key={s.uid} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4 text-zinc-300 font-mono font-semibold">
                        {s.studentId}
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-100">{s.displayName}</td>
                      <td className="py-3 px-4 text-zinc-400 text-[11px]">{s.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            stats.rate < 85
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {stats.rate}% ({stats.total} days)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 text-[11px]">
                        <span className="text-emerald-400">{stats.present}P</span> /{' '}
                        <span className="text-amber-400">{stats.late}L</span> /{' '}
                        <span className="text-red-400">{stats.absent}A</span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedStudent(s)}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 inline-flex items-center gap-1 text-[11px]"
                          title="View Full Attendance History Log"
                        >
                          <Eye className="w-3.5 h-3.5 text-zinc-400" />
                          History
                        </button>

                        {isTeacher && (
                          <button
                            onClick={() => handleRemoveStudent(s.uid, s.displayName)}
                            className="p-1 text-zinc-500 hover:text-red-400 rounded inline-block transition-colors"
                            title="Remove from Class"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6 text-zinc-200 font-mono text-xs">
            <h2 className="text-base font-bold uppercase tracking-wide border-b border-zinc-800 pb-3 mb-4">
              Add Student to Class Roster
            </h2>
            <form onSubmit={handleAddStudentByInput} className="space-y-4">
              <div>
                <label className="block text-zinc-400 uppercase tracking-wider mb-1">
                  Student ID or Registered Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STU-1001 or alex.r@school.edu"
                  value={studentSearchInput}
                  onChange={(e) => setStudentSearchInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>

              {addError && (
                <div className="bg-red-950/70 border border-red-900 text-red-300 p-2.5 rounded">
                  {addError}
                </div>
              )}

              <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded text-[11px] text-zinc-400">
                Note: Students can also join themselves directly using the Class Join Code ({classroom.joinCode}).
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setAddError(null);
                  }}
                  className="px-4 py-2 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold rounded disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add to Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance History Modal */}
      {selectedStudent && (
        <StudentAttendanceHistoryModal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          student={selectedStudent}
          classId={classroom.id}
        />
      )}
    </div>
  );
};
