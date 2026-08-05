import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { AlertCircle, Lock, Mail, User, ShieldCheck } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
  } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        if (!email || !password || !displayName) {
          throw new Error('Please fill in all required fields.');
        }
        if (role === 'student' && !studentId.trim()) {
          throw new Error('Please enter your Student ID.');
        }
        await signUpWithEmail(
          email,
          password,
          displayName,
          role,
          role === 'student' ? studentId.trim() : undefined
        );
      } else {
        if (!email || !password) {
          throw new Error('Please enter email and password.');
        }
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    }
    setSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle(role, role === 'student' ? studentId : undefined);
    } catch (err: any) {
      console.error('Google auth error:', err);
      setError(err.message || 'Google sign-in failed.');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#e4e4e7] flex flex-col justify-between font-sans overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] min-h-[calc(100vh-42px)]">
        {/* Left Visual Pane */}
        <div className="dot-grid-bg flex flex-col justify-center p-8 lg:p-20 border-b lg:border-b-0 lg:border-r border-zinc-800/80">
          <h1 className="font-syne text-5xl sm:text-7xl lg:text-8xl font-extrabold uppercase leading-[0.9] tracking-tighter text-zinc-100 mb-6">
            Class<br />Track
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-md leading-relaxed">
            Attendance tracking, student management, and real-time classroom operations for modern schools.
          </p>
        </div>

        {/* Right Form Pane */}
        <div className="bg-[#111113] p-6 sm:p-12 lg:p-14 flex flex-col justify-center overflow-y-auto">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-px bg-zinc-800/50 border border-zinc-800 mb-8">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-3 text-center font-mono text-xs uppercase tracking-wider transition-colors ${
                mode === 'login'
                  ? 'bg-zinc-800/80 text-zinc-100 font-bold'
                  : 'bg-[#0c0c0e] text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`py-3 text-center font-mono text-xs uppercase tracking-wider transition-colors ${
                mode === 'signup'
                  ? 'bg-zinc-800/80 text-zinc-100 font-bold'
                  : 'bg-[#0c0c0e] text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-950/60 border border-red-800/80 text-red-300 p-3.5 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <>
                {/* Role Selector */}
                <div>
                  <label className="block font-mono text-[0.6rem] uppercase tracking-widest text-zinc-400 mb-2">
                    Select Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`py-3 border font-mono text-xs uppercase tracking-wider transition-colors ${
                        role === 'student'
                          ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-bold'
                          : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`py-3 border font-mono text-xs uppercase tracking-wider transition-colors ${
                        role === 'teacher'
                          ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-bold'
                          : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Teacher
                    </button>
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block font-mono text-[0.6rem] uppercase tracking-widest text-zinc-400 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-3.5 h-3.5 text-zinc-500 absolute left-3" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={role === 'teacher' ? 'Prof. Alex Smith' : 'Jane Doe'}
                      className="w-full bg-transparent border border-zinc-800 rounded-sm pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
                    />
                  </div>
                </div>

                {/* Student ID */}
                {role === 'student' && (
                  <div>
                    <label className="block font-mono text-[0.6rem] uppercase tracking-widest text-zinc-400 mb-1.5">
                      Student ID
                    </label>
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. STU-2024-001"
                      className="w-full bg-transparent border border-zinc-800 rounded-sm px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
                    />
                  </div>
                )}

                {/* Teacher Approval info */}
                {role === 'teacher' && (
                  <div className="bg-amber-950/30 border border-amber-900/50 text-amber-300/90 p-3 rounded-sm text-xs font-mono flex items-start gap-2.5 leading-relaxed">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      Teacher accounts require approval from an existing approved teacher or admin before full login privileges are activated.
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div>
              <label className="block font-mono text-[0.6rem] uppercase tracking-widest text-zinc-400 mb-1.5">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@school.edu"
                  className="w-full bg-transparent border border-zinc-800 rounded-sm pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block font-mono text-[0.6rem] uppercase tracking-widest text-zinc-400 mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent border border-zinc-800 rounded-sm pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-none py-3.5 font-bold font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer mt-2"
            >
              {submitting ? 'Processing...' : mode === 'login' ? 'Log In' : 'Register Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="text-center my-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800/80"></div>
            </div>
            <span className="relative bg-[#111113] px-3 font-mono text-[0.6rem] text-zinc-500 uppercase tracking-widest">
              Or continue with
            </span>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="w-full bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-200 py-3 flex items-center justify-center gap-3 font-mono text-xs tracking-wide transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.2-.8-.4-1.6-.4-2.3z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 22.3 12 23z"
              />
            </svg>
            Google Authentication
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-zinc-800/80 flex flex-wrap justify-between items-center text-xs text-zinc-500 gap-2 bg-[#0c0c0e]">
        <div>Made by Team Carl</div>
        <div>&copy; {new Date().getFullYear()} ClassTrack. All rights reserved.</div>
      </footer>
    </div>
  );
};

