export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  approved: boolean; // Teachers require approval before accessing app features
  studentId?: string; // Student ID e.g. STU-1001
  createdAt: string;
  updatedAt?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceOverrideLog {
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  modifiedByUid: string;
  modifiedByName: string;
  timestamp: string;
  reason: string;
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  date: string; // YYYY-MM-DD
  studentUid: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  markedByUid: string;
  markedByName: string;
  createdAt: string;
  updatedAt: string;
  overrides?: AttendanceOverrideLog[];
}

export interface StudentInfo {
  uid: string;
  studentId: string;
  displayName: string;
  email: string;
  joinedAt?: string;
}

export interface Classroom {
  id: string;
  name: string;
  section?: string;
  subject?: string;
  teacherId: string;
  teacherName: string;
  joinCode: string;
  studentUids: string[];
  studentsMap?: Record<string, StudentInfo>; // Map of studentUid -> StudentInfo
  createdAt: string;
}

export interface Announcement {
  id: string;
  classId: string;
  title: string;
  content: string;
  authorUid: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: string;
}

export interface AnnouncementComment {
  id: string;
  announcementId: string;
  classId: string;
  content: string;
  authorUid: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: string;
}

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  instructions: string;
  dueDate: string; // ISO string or YYYY-MM-DD
  maxPoints: number;
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  classId: string;
  studentUid: string;
  studentName: string;
  studentId: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  submittedAt: string;
  status: 'submitted' | 'graded';
  score?: number;
  feedback?: string;
  gradedAt?: string;
  gradedByName?: string;
}

export type AuditActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'ATTENDANCE_MARKED'
  | 'ATTENDANCE_OVERRIDE'
  | 'TEACHER_APPROVED'
  | 'TEACHER_REJECTED'
  | 'STUDENT_ADDED'
  | 'STUDENT_REMOVED'
  | 'CLASS_CREATED'
  | 'ANNOUNCEMENT_POSTED'
  | 'ASSIGNMENT_CREATED'
  | 'WORK_SUBMITTED'
  | 'WORK_GRADED';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userUid: string;
  userName: string;
  userRole: UserRole;
  action: AuditActionType;
  details: string;
  classId?: string;
}
