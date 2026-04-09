import React, { useState, useEffect } from 'react';
import { useAuth, LEVEL_NAMES } from '../contexts/AuthContext';
import AppLayout, { DashCard, StatCard } from '../components/layout/AppLayout';
import { Network as NetworkIcon, Users, ChevronDown, ChevronRight, MapPin } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function TreeNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const levelColors = {
    2: 'border-l-emerald-500 bg-emerald-50',
    3: 'border-l-violet-500 bg-violet-50',
    4: 'border-l-amber-500 bg-amber-50',
    5: 'border-l-slate-400 bg-slate-50',
    6: 'border-l-pink-500 bg-pink-50',
  };
  const color = levelColors[node.access_level] || 'border-l-brand-main bg-brand-light';

  return (
    <div className="ml-0" style={{ marginLeft: depth > 0 ? '24px' : 0 }}>
      <div className={`flex items-center gap-3 p-3 rounded-md border border-border border-l-4 ${color} hover:-translate-y-0.5 transition-all mb-2`}>
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5" data-testid={`tree-toggle-${node.user_id}`}>
            {expanded ? <ChevronDown className="w-4 h-4 text-txt-secondary" /> : <ChevronRight className="w-4 h-4 text-txt-secondary" />}
          </button>
        ) : (
          <div className="w-5" />
        )}
        <div className="w-8 h-8 rounded-md bg-white border border-border flex items-center justify-center text-xs font-bold text-brand-main">
          {node.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-txt-primary truncate">{node.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-medium text-txt-secondary">{LEVEL_NAMES[node.access_level]}</span>
            {node.state && (
              <span className="flex items-center gap-0.5 text-[11px] text-txt-secondary">
                <MapPin className="w-3 h-3" /> {node.state}
                {node.ddd && ` - DDD ${node.ddd}`}
              </span>
            )}
          </div>
        </div>
        {hasChildren && (
          <span className="px-2 py-0.5 rounded bg-white text-[11px] font-semibold text-txt-secondary border border-border">
            {node.children.length}
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="border-l-2 border-border/50 ml-4 pl-0">
          {node.children.map(child => (
            <TreeNode key={child.user_id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NetworkPage() {
  const { token } = useAuth();
  const [tree, setTree] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTree(), fetchStats()]).finally(() => setLoading(false));
  }, []);

  const fetchTree = async () => {
    try {
      const res = await fetch(`${API_URL}/api/network/tree`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setTree(d.tree); }
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/network/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  if (loading) {
    return (
      <AppLayout title="Rede">
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-brand-main border-t-transparent rounded-full spinner" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Rede" subtitle="Visualize sua hierarquia">
      <div className="space-y-6 fade-in">
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Diretos" value={stats.direct} color="blue" />
            <StatCard icon={NetworkIcon} label="Indiretos" value={stats.indirect} color="green" />
            <StatCard icon={Users} label="Total Rede" value={stats.total} color="purple" />
          </div>
        )}

        {stats?.by_level && Object.keys(stats.by_level).length > 0 && (
          <DashCard title="Distribuicao por Nivel">
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.by_level).map(([k, v]) => (
                <div key={k} className="px-3 py-2 bg-bg-secondary rounded-md border border-border">
                  <p className="text-xs text-txt-secondary">{k}</p>
                  <p className="text-lg font-heading font-bold text-txt-primary">{v}</p>
                </div>
              ))}
            </div>
          </DashCard>
        )}

        <DashCard title="Arvore da Rede">
          {tree.length === 0 ? (
            <div className="text-center py-12">
              <NetworkIcon className="w-12 h-12 mx-auto text-border mb-3" />
              <p className="text-txt-secondary">Nenhum membro na rede</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tree.map(node => (
                <TreeNode key={node.user_id} node={node} />
              ))}
            </div>
          )}
        </DashCard>
      </div>
    </AppLayout>
  );
}
