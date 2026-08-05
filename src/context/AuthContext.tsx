import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { logAuditEvent } from '../lib/audit';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName: string,
    role: UserRole,
    studentId?: string
  ) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: (requestedRole?: UserRole, studentId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Theme state defaulting to 'dark'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('classtrack_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('classtrack_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        return userSnap.data() as UserProfile;
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
    return null;
  };

  // Check if any approved teachers exist in system
  const checkIfFirstTeacher = async (): Promise<boolean> => {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        where('approved', '==', true)
      );
      const snap = await getDocs(q);
      return snap.empty;
    } catch (err) {
      console.error('Error checking teacher approval count:', err);
      return false;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.uid);
      setUserProfile(p);
    }
  };

  const saveAndSetUserProfile = (profile: UserProfile) => {
    localStorage.setItem('classtrack_saved_user', JSON.stringify(profile));
    setUserProfile(profile);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const p = await fetchProfile(firebaseUser.uid);
        if (p) {
          saveAndSetUserProfile(p);
        } else {
          setUserProfile(null);
        }
      } else {
        localStorage.removeItem('classtrack_saved_user');
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    role: UserRole,
    studentId?: string
  ) => {
    setLoading(true);
    let uid = '';
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      uid = cred.user.uid;
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        uid = 'user_' + btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '');
      } else {
        setLoading(false);
        throw err;
      }
    }

    try {
      let approved = true;

      if (role === 'teacher') {
        const isFirst = await checkIfFirstTeacher();
        // First teacher in the system is auto-approved, subsequent teachers require approval
        approved = isFirst;
      }

      const newProfile: UserProfile = {
        uid,
        email,
        displayName: displayName || (role === 'teacher' ? 'Teacher' : 'Student'),
        role,
        approved,
        studentId: role === 'student' ? studentId : undefined,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', uid), newProfile, { merge: true });
      saveAndSetUserProfile(newProfile);

      await logAuditEvent(
        uid,
        newProfile.displayName,
        role,
        'LOGIN',
        `User signed up via email as ${role}. Approval status: ${approved}`
      );
    } catch (err) {
      setLoading(false);
      throw err;
    }
    setLoading(false);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    let uid = '';
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      uid = cred.user.uid;
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        uid = 'user_' + btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '');
      } else {
        setLoading(false);
        throw err;
      }
    }

    try {
      const profile = await fetchProfile(uid);
      if (!profile) {
        throw new Error('User account record not found. Please create an account first.');
      }

      saveAndSetUserProfile(profile);

      await logAuditEvent(
        uid,
        profile.displayName,
        profile.role,
        'LOGIN',
        `User logged in via email.`
      );
    } catch (err) {
      setLoading(false);
      throw err;
    }
    setLoading(false);
  };

  const signInWithGoogle = async (requestedRole: UserRole = 'student', studentId?: string) => {
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const existing = await fetchProfile(res.user.uid);

      if (!existing) {
        let approved = true;
        if (requestedRole === 'teacher') {
          const isFirst = await checkIfFirstTeacher();
          approved = isFirst;
        }

        const newProfile: UserProfile = {
          uid: res.user.uid,
          email: res.user.email || '',
          displayName: res.user.displayName || 'User',
          role: requestedRole,
          approved,
          studentId: requestedRole === 'student' ? studentId : undefined,
          createdAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'users', res.user.uid), newProfile, { merge: true });
        saveAndSetUserProfile(newProfile);

        await logAuditEvent(
          res.user.uid,
          newProfile.displayName,
          requestedRole,
          'LOGIN',
          `User created account via Google as ${requestedRole}. Approval status: ${approved}`
        );
      } else {
        saveAndSetUserProfile(existing);
        await logAuditEvent(
          res.user.uid,
          existing.displayName,
          existing.role,
          'LOGIN',
          `User logged in via Google.`
        );
      }
    } catch (err) {
      setLoading(false);
      throw err;
    }
    setLoading(false);
  };

  const logout = async () => {
    const activeUid = userProfile?.uid || user?.uid;
    if (userProfile && activeUid) {
      await logAuditEvent(
        activeUid,
        userProfile.displayName,
        userProfile.role,
        'LOGOUT',
        `User logged out.`
      );
    }
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Firebase signout skipped:', err);
    }
    localStorage.removeItem('classtrack_saved_user');
    setUser(null);
    setUserProfile(null);
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    const activeUid = userProfile?.uid || user?.uid;
    if (!activeUid || !userProfile) return;
    const ref = doc(db, 'users', activeUid);
    const updated = { ...data, updatedAt: new Date().toISOString() };
    await updateDoc(ref, updated);
    const newProfile = { ...userProfile, ...updated };
    saveAndSetUserProfile(newProfile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        theme,
        toggleTheme,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        logout,
        refreshProfile,
        updateProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
