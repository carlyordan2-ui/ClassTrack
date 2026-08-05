import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { Dashboard, MainTabType } from './components/Dashboard';
import { SettingsModal } from './components/SettingsModal';
import { TeacherApprovalsModal } from './components/TeacherApprovalsModal';
import { Classroom } from './types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { ShieldAlert, RefreshCw } from 'lucide-react';

const MainApp: React.FC = () => {
  const { userProfile, loading, logout, refreshProfile } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTabType>('attendance');

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = async () => {
    if (userProfile?.role === 'teacher' && userProfile.approved) {
      try {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'teacher'),
          where('approved', '==', false)
        );
        const snap = await getDocs(q);
        setPendingCount(snap.size);
      } catch (err) {
        console.error('Error fetching pending count:', err);
      }
    }
  };

  const fetchClassrooms = async () => {
    if (!userProfile) return;
    setLoadingClassrooms(true);
    try {
      let q;
      if (userProfile.role === 'teacher') {
        q = query(collection(db, 'classes'), where('teacherId', '==', userProfile.uid));
      } else {
        q = query(
          collection(db, 'classes'),
          where('studentUids', 'array-contains', userProfile.uid)
        );
      }

      const snap = await getDocs(q);
      const list: Classroom[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as object) } as Classroom);
      });

      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setClassrooms(list);

      setSelectedClassroom((prev) => {
        if (!prev) return list[0] || null;
        const exists = list.find((c) => c.id === prev.id);
        return exists || list[0] || null;
      });
    } catch (err) {
      console.error('Error fetching classrooms:', err);
    }
    setLoadingClassrooms(false);
  };

  useEffect(() => {
    fetchPendingCount();
    fetchClassrooms();
  }, [userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 font-mono text-xs flex items-center justify-center p-4">
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-3 rounded">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Initializing ClassTrack System...</span>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <AuthScreen />;
  }

  // Handle Pending Teacher Account state
  const isTeacher = userProfile.role === 'teacher';
  const isPendingTeacher = isTeacher && !userProfile.approved;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <Header
        onOpenSettings={() => setShowSettings(true)}
        onOpenApprovals={() => setShowApprovals(true)}
        pendingApprovalsCount={pendingCount}
        classrooms={classrooms}
        selectedClassroom={selectedClassroom}
        onSelectClassroom={(c) => setSelectedClassroom(c)}
        onNavigateToClasses={() => setActiveTab('classes')}
      />

      {isPendingTeacher ? (
        <main className="flex-1 max-w-xl mx-auto px-4 py-16 text-center font-mono">
          <div className="bg-zinc-900 border border-amber-900/80 rounded-lg p-8 text-zinc-200">
            <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold uppercase tracking-tight text-amber-300 mb-2">
              Teacher Account Pending Approval
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed mb-6">
              Your teacher account registration is currently pending authorization by an existing approved teacher or administrator. Once approved, full classroom management and attendance access will be granted.
            </p>

            <div className="flex items-center justify-center gap-3 text-xs">
              <button
                onClick={refreshProfile}
                className="px-4 py-2 rounded bg-amber-950 border border-amber-800 text-amber-200 font-medium hover:bg-amber-900 transition-colors"
              >
                Check Approval Status
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1">
          <Dashboard
            selectedClassroom={selectedClassroom}
            setSelectedClassroom={setSelectedClassroom}
            classrooms={classrooms}
            loadingClassrooms={loadingClassrooms}
            refreshClassrooms={fetchClassrooms}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center font-mono text-[11px] text-zinc-500">
        ClassTrack • Internal Attendance & Classroom Management Tool
      </footer>

      {/* Modals */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {isTeacher && userProfile.approved && (
        <TeacherApprovalsModal
          isOpen={showApprovals}
          onClose={() => setShowApprovals(false)}
          onApprovalsUpdated={fetchPendingCount}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
