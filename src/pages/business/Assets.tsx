import { Upload, Image, Trash2 } from 'lucide-react';

const mockAssets = [
  { id: '1', name: 'pizza-hero.jpg', type: 'image', url: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=300', size: '2.4 MB', date: '2026-06-20' },
  { id: '2', name: 'spa-banner.jpg', type: 'image', url: 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?auto=compress&cs=tinysrgb&w=300', size: '1.8 MB', date: '2026-06-18' },
  { id: '3', name: 'car-before.jpg', type: 'image', url: 'https://images.pexels.com/photos/3354648/pexels-photo-3354648.jpeg?auto=compress&cs=tinysrgb&w=300', size: '3.1 MB', date: '2026-06-15' },
  { id: '4', name: 'gym-promo.jpg', type: 'image', url: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=300', size: '2.0 MB', date: '2026-06-12' },
  { id: '5', name: 'flowers.jpg', type: 'image', url: 'https://images.pexels.com/photos/931177/pexels-photo-931177.jpeg?auto=compress&cs=tinysrgb&w=300', size: '1.5 MB', date: '2026-06-10' },
  { id: '6', name: 'logo-dark.png', type: 'image', url: 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=300', size: '0.4 MB', date: '2026-06-01' },
];

export default function BizAssets() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Assets</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{mockAssets.length} files uploaded</p>
        </div>
        <button className="btn-primary text-sm px-5 py-2.5">
          <Upload className="w-4 h-4" /> Upload
        </button>
      </div>

      {/* Upload zone */}
      <div className="card-surface border-dashed border-2 border-[var(--border-default)] p-8 text-center mb-6 hover:border-neon/40 transition-colors cursor-pointer">
        <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)]">Drag & drop files here or click to browse</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">PNG, JPG, MP4 up to 10MB</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {mockAssets.map(asset => (
          <div key={asset.id} className="card-surface overflow-hidden group relative">
            <div className="aspect-square">
              <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-3">
              <p className="text-xs font-medium truncate">{asset.name}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-[var(--text-muted)]">{asset.size}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{asset.date}</span>
              </div>
            </div>
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                <Image className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
