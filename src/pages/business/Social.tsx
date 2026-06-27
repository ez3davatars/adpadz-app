import { Instagram, Facebook, Twitter, Linkedin, Plus, Calendar, Clock, CheckCircle2 } from 'lucide-react';

const mockPosts = [
  { id: '1', platform: 'instagram', content: 'Fresh out of the oven! Our famous Margherita pizza is calling your name. Tap the link to get 25% OFF today!', status: 'published', date: '2026-06-22 10:00 AM', likes: 234, shares: 45 },
  { id: '2', platform: 'facebook', content: 'Summer just got better! Exclusive deals only on AdPadz. Scratch to reveal your surprise discount!', status: 'scheduled', date: '2026-06-23 2:00 PM', likes: 0, shares: 0 },
  { id: '3', platform: 'x', content: 'Local businesses are seeing 10x engagement with interactive ads. Ready to grow? Check out our latest deals.', status: 'draft', date: '', likes: 0, shares: 0 },
  { id: '4', platform: 'linkedin', content: 'How we helped 12,000+ local businesses reach more customers with interactive advertising. Case study inside.', status: 'published', date: '2026-06-20 9:00 AM', likes: 89, shares: 12 },
];

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
  linkedin: Linkedin,
};

const platformColors: Record<string, string> = {
  instagram: 'text-pink-400',
  facebook: 'text-blue-400',
  x: 'text-white',
  linkedin: 'text-blue-300',
};

export default function BizSocial() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Social Publishing</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Manage posts across platforms</p>
        </div>
        <button className="btn-primary text-sm px-5 py-2.5">
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {/* Platform quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {['instagram', 'facebook', 'x', 'linkedin'].map(p => {
          const Icon = platformIcons[p];
          const count = mockPosts.filter(post => post.platform === p).length;
          return (
            <div key={p} className="card-surface p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--bg-input)] flex items-center justify-center">
                <Icon className={`w-4 h-4 ${platformColors[p]}`} />
              </div>
              <div>
                <p className="text-sm font-semibold capitalize">{p === 'x' ? 'X' : p}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{count} posts</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Post list */}
      <div className="space-y-3">
        {mockPosts.map(post => {
          const Icon = platformIcons[post.platform];
          return (
            <div key={post.id} className="card-surface p-4 hover:border-[var(--border-neon)] transition-all">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-4 h-4 ${platformColors[post.platform]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium capitalize">{post.platform === 'x' ? 'X (Twitter)' : post.platform}</span>
                    <PostStatus status={post.status} />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{post.content}</p>
                  {post.date && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-muted)]">
                      {post.status === 'scheduled' ? <Calendar className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {post.date}
                    </div>
                  )}
                  {post.status === 'published' && (
                    <div className="flex gap-3 mt-2 text-[10px] text-[var(--text-muted)]">
                      <span>{post.likes} likes</span>
                      <span>{post.shares} shares</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PostStatus({ status }: { status: string }) {
  if (status === 'published') return <span className="badge badge-active text-[10px]"><CheckCircle2 className="w-3 h-3" />Published</span>;
  if (status === 'scheduled') return <span className="badge badge-paused text-[10px]"><Calendar className="w-3 h-3" />Scheduled</span>;
  return <span className="badge badge-draft text-[10px]">Draft</span>;
}
