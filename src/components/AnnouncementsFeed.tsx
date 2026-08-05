import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Classroom, Announcement, AnnouncementComment } from '../types';
import { useAuth } from '../context/AuthContext';
import { logAuditEvent } from '../lib/audit';
import { MessageSquare, Send, Trash2, Plus, Megaphone, User } from 'lucide-react';

interface AnnouncementsFeedProps {
  classroom: Classroom;
}

export const AnnouncementsFeed: React.FC<AnnouncementsFeedProps> = ({ classroom }) => {
  const { userProfile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, AnnouncementComment[]>>({});
  const [loading, setLoading] = useState(true);

  // New announcement form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  // Comment input per announcement
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  if (!userProfile) return null;

  const isTeacher = userProfile.role === 'teacher';

  const fetchAnnouncementsAndComments = async () => {
    setLoading(true);
    try {
      // Query announcements for this class
      const qAnn = query(
        collection(db, 'announcements'),
        where('classId', '==', classroom.id)
      );
      const annSnap = await getDocs(qAnn);
      const annList: Announcement[] = [];

      annSnap.forEach((d) => {
        annList.push({ id: d.id, ...(d.data() as object) } as Announcement);
      });

      // Sort newest first
      annList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAnnouncements(annList);

      // Query comments for this class
      const qCom = query(collection(db, 'comments'), where('classId', '==', classroom.id));
      const comSnap = await getDocs(qCom);
      const comMap: Record<string, AnnouncementComment[]> = {};

      comSnap.forEach((d) => {
        const c = { id: d.id, ...(d.data() as object) } as AnnouncementComment;
        if (!comMap[c.announcementId]) comMap[c.announcementId] = [];
        comMap[c.announcementId].push(c);
      });

      // Sort comments oldest to newest
      Object.keys(comMap).forEach((annId) => {
        comMap[annId].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      setCommentsMap(comMap);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnnouncementsAndComments();
  }, [classroom]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setPosting(true);

    try {
      const docRef = await addDoc(collection(db, 'announcements'), {
        classId: classroom.id,
        title: title.trim(),
        content: content.trim(),
        authorUid: userProfile.uid,
        authorName: userProfile.displayName,
        authorRole: userProfile.role,
        createdAt: new Date().toISOString(),
      });

      await logAuditEvent(
        userProfile.uid,
        userProfile.displayName,
        userProfile.role,
        'ANNOUNCEMENT_POSTED',
        `Posted announcement "${title.trim()}" in ${classroom.name}`,
        classroom.id
      );

      setTitle('');
      setContent('');
      setShowCreate(false);
      await fetchAnnouncementsAndComments();
    } catch (err) {
      console.error('Error posting announcement:', err);
    }
    setPosting(false);
  };

  const handleAddComment = async (announcementId: string) => {
    const text = commentInputs[announcementId]?.trim();
    if (!text) return;

    try {
      await addDoc(collection(db, 'comments'), {
        announcementId,
        classId: classroom.id,
        content: text,
        authorUid: userProfile.uid,
        authorName: userProfile.displayName,
        authorRole: userProfile.role,
        createdAt: new Date().toISOString(),
      });

      setCommentInputs((prev) => ({ ...prev, [announcementId]: '' }));
      await fetchAnnouncementsAndComments();
    } catch (err) {
      console.error('Error posting comment:', err);
    }
  };

  const handleDeleteAnnouncement = async (id: string, annTitle: string) => {
    if (!confirm(`Delete announcement "${annTitle}"?`)) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      await fetchAnnouncementsAndComments();
    } catch (err) {
      console.error('Error deleting announcement:', err);
    }
  };

  return (
    <div className="font-sans">
      {/* Top action header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 font-mono text-xs">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 uppercase">
            Class Announcements Feed
          </h3>
          <p className="text-zinc-400 text-[11px]">
            Broadcast announcements and student discussion thread
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 rounded bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        )}
      </div>

      {/* New Announcement Composer */}
      {showCreate && (
        <form
          onSubmit={handlePostAnnouncement}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6 space-y-3 font-mono text-xs"
        >
          <div className="text-sm font-bold text-zinc-200 uppercase flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-sky-400" />
            Post New Announcement
          </div>

          <div>
            <label className="block text-zinc-400 uppercase tracking-wider mb-1">Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Exam Schedule Update / Office Hours"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-zinc-400 uppercase tracking-wider mb-1">
              Instructions / Message
            </label>
            <textarea
              required
              rows={3}
              placeholder="Type announcement details..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-1.5 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={posting}
              className="px-4 py-1.5 bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-100 font-semibold rounded disabled:opacity-50"
            >
              {posting ? 'Posting...' : 'Post Announcement'}
            </button>
          </div>
        </form>
      )}

      {/* Announcements List */}
      {loading ? (
        <div className="text-center py-8 font-mono text-xs text-zinc-400">
          Loading announcements feed...
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-8 font-mono text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded p-4">
          No announcements posted in this classroom yet.
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const comments = commentsMap[a.id] || [];
            return (
              <div
                key={a.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 font-mono text-xs text-zinc-200"
              >
                <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-3 mb-3">
                  <div>
                    <h4 className="text-base font-bold text-zinc-100">{a.title}</h4>
                    <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                      <span className="text-zinc-300 font-semibold">{a.authorName}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] uppercase ${
                          a.authorRole === 'teacher'
                            ? 'bg-sky-950 text-sky-400 border border-sky-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {a.authorRole}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(a.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {isTeacher && a.authorUid === userProfile.uid && (
                    <button
                      onClick={() => handleDeleteAnnouncement(a.id, a.title)}
                      className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Announcement Content */}
                <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed mb-4 text-xs font-sans">
                  {a.content}
                </div>

                {/* Comments Section */}
                <div className="border-t border-zinc-800 pt-3">
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comments ({comments.length})
                  </div>

                  {comments.length > 0 && (
                    <div className="space-y-2 mb-3 max-h-60 overflow-y-auto pr-1">
                      {comments.map((c) => (
                        <div
                          key={c.id}
                          className="bg-zinc-950 border border-zinc-800 rounded p-2.5 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                            <span className="font-semibold text-zinc-200">
                              {c.authorName}{' '}
                              <span className="text-zinc-400">({c.authorRole})</span>
                            </span>
                            <span>
                              {new Date(c.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="text-zinc-300 text-xs font-sans">{c.content}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Comment Input */}
                  <div className="flex gap-2 font-mono text-xs">
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={commentInputs[a.id] || ''}
                      onChange={(e) =>
                        setCommentInputs({ ...commentInputs, [a.id]: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddComment(a.id);
                      }}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                    <button
                      onClick={() => handleAddComment(a.id)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded font-medium flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Comment
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
