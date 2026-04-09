import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { DashCard } from '../components/layout/AppLayout';
import { User, Save } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', cpf: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', phone: user.phone || '', cpf: user.cpf || '' });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${user.user_id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        updateUser(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {} finally { setSaving(false); }
  };

  return (
    <AppLayout title="Perfil" subtitle="Gerencie suas informacoes">
      <div className="max-w-lg space-y-6 fade-in">
        <DashCard title="Informacoes Pessoais">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1">Nome</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm" data-testid="profile-name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1">Email</label>
              <input value={user?.email || ''} disabled
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-bg-secondary text-txt-secondary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1">Telefone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm" data-testid="profile-phone" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1">CPF</label>
              <input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})}
                className="w-full px-3 py-2.5 border border-border rounded-md text-sm" data-testid="profile-cpf" />
            </div>
            <button onClick={handleSave} disabled={saving}
              className={`px-6 py-2.5 text-sm font-semibold rounded-md transition-all ${
                saved ? 'bg-accent-green text-white' : 'bg-brand-main text-white hover:bg-brand-hover'
              } disabled:opacity-50`}
              data-testid="profile-save-btn">
              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        </DashCard>
      </div>
    </AppLayout>
  );
}
