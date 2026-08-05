import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Classroom } from '../types';
import { LogOut, Sun, Moon, ShieldCheck, User, Settings, BookOpen, ChevronDown } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenApprovals?: () => void;
  pendingApprovalsCount?: number;
  classrooms?: Classroom[];
  selectedClassroom?: Classroom | null;
  onSelectClassroom?: (classroom: Classroom | null) => void;
  onNavigateToClasses?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenApprovals,
  pendingApprovalsCount = 0,
  classrooms = [],
  selectedClassroom = null,
  onSelectClassroom,
  onNavigateToClasses,
}) => {
  const { userProfile, logout, theme, toggleTheme } = useAuth();

  if (!userProfile) return null;

  const isTeacher = userProfile.role === 'teacher';
  const isApproved = userProfile.approved;

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 text-zinc-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand logo & compact Class Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base sm:text-lg font-bold tracking-tight text-zinc-100">
              ClassTrack
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 uppercase tracking-widest hidden xs:inline-block">
              v1.0
            </span>
          </div>

          {/* Compact Active Class Switcher */}
          <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-2 sm:pl-3 font-mono text-xs">
            <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            {classrooms.length > 0 ? (
              <div className="relative flex items-center">
                <select
                  value={selectedClassroom?.id || ''}
                  onChange={(e) => {
                    const found = classrooms.find((c) => c.id === e.target.value);
                    if (onSelectClassroom) onSelectClassroom(found || null);
                  }}
                  className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 focus:border-sky-500 text-zinc-100 font-medium text-xs rounded px-2 py-1 pr-5 cursor-pointer focus:outline-none max-w-[110px] xs:max-w-[160px] sm:max-w-[220px] truncate transition-colors appearance-none"
                  title="Switch Active Classroom"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-1 pointer-events-none" />
              </div>
            ) : (
              <button
                onClick={onNavigateToClasses}
                className="text-[10px] sm:text-[11px] font-mono text-sky-400 hover:text-sky-300 bg-sky-950/60 border border-sky-800 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap"
              >
                + Class
              </button>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-2 border-l border-zinc-800 pl-3">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium uppercase tracking-wider ${
                isTeacher
                  ? 'bg-sky-950 text-sky-400 border border-sky-800'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}
            >
              {isTeacher ? 'Teacher' : 'Student'}
            </span>

            {isTeacher && !isApproved && (
              <span className="text-[10px] font-mono bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded">
                Pending Approval
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
          {/* Pending teacher approval badge button for approved teachers */}
          {isTeacher && isApproved && onOpenApprovals && (
            <button
              onClick={onOpenApprovals}
              className={`relative px-2.5 py-1.5 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                pendingApprovalsCount > 0
                  ? 'bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900/60'
                  : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Review Teacher Account Signups"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Teacher Approvals</span>
              {pendingApprovalsCount > 0 && (
                <span className="bg-amber-500 text-zinc-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          )}

          {/* User profile info */}
          <div className="hidden md:flex flex-col text-right">
            <span className="text-zinc-200 font-medium truncate max-w-[140px]">
              {userProfile.displayName}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px]">
              {userProfile.studentId || userProfile.email}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Profile & Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-900 hover:bg-zinc-800 flex items-center gap-1.5 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </div>

      {/* Mobile user role status bar */}
      <div className="sm:hidden border-t border-zinc-800/80 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-400 bg-zinc-950/50">
        <div className="flex items-center gap-1.5">
          <User className="w-3 h-3 text-zinc-400" />
          <span className="text-zinc-200 truncate max-w-[160px]">{userProfile.displayName}</span>
        </div>
        <span
          className={`px-1.5 py-0.2 rounded ${
            isTeacher ? 'text-sky-400 bg-sky-950/80' : 'text-emerald-400 bg-emerald-950/80'
          }`}
        >
          {isTeacher ? (isApproved ? 'Teacher' : 'Pending Teacher') : 'Student'}
        </span>
      </div>
    </header>
  );
};
