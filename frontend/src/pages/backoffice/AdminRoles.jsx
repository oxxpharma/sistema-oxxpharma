import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { toast } from 'sonner';
import { Shield, Loader2, Trash2, Edit2, Plus, Users, AlertTriangle, Check } from 'lucide-react';

export default function AdminRoles() {
  const [profiles, setProfiles] = useState([]);
  const [availablePages, setAvailablePages] = useState({});
  const [systemProfiles, setSystemProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pages: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [pagesRes, profilesRes] = await Promise.all([
        api.get('/api/admin/role-profiles/pages'),
        api.get('/api/admin/role-profiles'),
      ]);
      setAvailablePages(pagesRes.pages || {});
      setSystemProfiles(pagesRes.system_profiles || {});
      setProfiles(profilesRes.profiles || []);
    } catch (e) {
      toast.error('Erro ao carregar: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome do perfil é obrigatório');
      return;
    }
    
    if (formData.pages.length === 0) {
      toast.error('Selecione pelo menos uma página');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/api/admin/role-profiles/${editingId}`, formData);
        toast.success('Perfil atualizado com sucesso');
      } else {
        await api.post('/api/admin/role-profiles', formData);
        toast.success('Perfil criado com sucesso');
      }
      resetForm();
      loadData();
    } catch (e) {
      toast.error('Erro: ' + (e.message || e));
    }
  };

  const handleDelete = async (profileId) => {
    if (!window.confirm('Tem certeza que deseja deletar este perfil?')) return;
    
    try {
      await api.delete(`/api/admin/role-profiles/${profileId}`);
      toast.success('Perfil deletado com sucesso');
      loadData();
    } catch (e) {
      toast.error('Erro: ' + (e.message || e));
    }
  };

  const handleEdit = (profile) => {
    setEditingId(profile.profile_id);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      pages: profile.pages || [],
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      pages: [],
    });
  };

  const togglePage = (pageKey) => {
    setFormData(prev => ({
      ...prev,
      pages: prev.pages.includes(pageKey)
        ? prev.pages.filter(p => p !== pageKey)
        : [...prev.pages, pageKey],
    }));
  };

  if (loading) {
    return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-brand-main" /></div>;
  }

  const customProfiles = profiles.filter(p => !p.is_system);

  return (
    <div className="space-y-6" data-testid="admin-roles">
      <div>
        <h1 className="font-heading font-black text-2xl">Gerenciamento de Perfis de Acesso</h1>
        <p className="text-sm text-txt-secondary mt-1">
          Configure perfis personalizados para controlar o acesso das páginas do admin. Cada perfil pode ter permissões granulares.
        </p>
      </div>

      {/* Perfis de Sistema */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-lg flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Perfis do Sistema
        </h2>
        <p className="text-sm text-txt-secondary">
          Estes perfis são padrão do sistema e não podem ser deletados. Você pode editá-los para ajustar as permissões.
        </p>
        
        {Object.entries(systemProfiles).map(([profileKey, profileData]) => (
          <SystemProfileCard
            key={profileKey}
            profileKey={profileKey}
            profile={profileData}
            availablePages={availablePages}
            onEdit={() => handleEdit({
              profile_id: profileKey,
              name: profileData.name,
              description: profileData.description,
              pages: profileData.pages,
              is_system: true,
            })}
          />
        ))}
      </div>

      {/* Perfis Personalizados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-lg">Perfis Personalizados</h2>
            <p className="text-sm text-txt-secondary mt-1">
              Crie novos perfis com permissões específicas para diferentes tipos de usuários.
            </p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} variant="default" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo Perfil
            </Button>
          )}
        </div>

        {showForm && (
          <ProfileForm
            formData={formData}
            availablePages={availablePages}
            isEditMode={!!editingId}
            onSubmit={handleSubmit}
            onCancel={resetForm}
            onTogglePage={togglePage}
          />
        )}

        {customProfiles.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
            <Shield className="w-8 h-8 text-txt-secondary mx-auto mb-2 opacity-50" />
            <p className="text-txt-secondary">Nenhum perfil personalizado criado ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customProfiles.map(profile => (
              <ProfileCard
                key={profile.profile_id}
                profile={profile}
                availablePages={availablePages}
                onEdit={() => handleEdit(profile)}
                onDelete={() => handleDelete(profile.profile_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botão de Reset */}
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-1" />
          <div>
            <h3 className="font-heading font-bold text-red-900">Resetar para Padrão</h3>
            <p className="text-sm text-red-800 mt-1">
              Esta ação deletará todos os perfis personalizados e reassignará todos os usuários com perfis custom para 'customer'. Esta ação é irreversível.
            </p>
          </div>
        </div>
        <Button
          onClick={async () => {
            if (!window.confirm('Tem certeza? Todos os perfis personalizados serão perdidos!')) return;
            try {
              await api.post('/api/admin/role-profiles/reset-to-default');
              toast.success('Perfis resetados para o padrão');
              loadData();
            } catch (e) {
              toast.error('Erro: ' + (e.message || e));
            }
          }}
          variant="destructive"
          size="sm"
        >
          Resetar para Padrão
        </Button>
      </div>
    </div>
  );
}

function ProfileForm({ formData, availablePages, isEditMode, onSubmit, onCancel, onTogglePage }) {
  return (
    <form onSubmit={onSubmit} className="bg-bg-secondary border-2 border-border rounded-lg p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Nome do Perfil *</label>
        <Input
          value={formData.name}
          onChange={(e) => {
            formData.name = e.target.value;
          }}
          placeholder="Ex: Gerenciador de Pedidos"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Descrição</label>
        <textarea
          value={formData.description}
          onChange={(e) => {
            formData.description = e.target.value;
          }}
          placeholder="Descreva o propósito deste perfil"
          className="w-full px-4 py-2 rounded-lg border-2 border-border focus:border-brand-main focus:outline-none text-sm"
          rows="3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-3">Páginas Permitidas *</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(availablePages).map(([pageKey, pageLabel]) => (
            <label key={pageKey} className="flex items-center gap-2 p-3 border-2 border-border rounded-lg hover:border-brand-main cursor-pointer transition">
              <input
                type="checkbox"
                checked={formData.pages.includes(pageKey)}
                onChange={() => onTogglePage(pageKey)}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-sm">
                <span className="font-medium block">{pageLabel}</span>
                <span className="text-txt-secondary text-xs">{pageKey}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" variant="default">
          {isEditMode ? 'Atualizar Perfil' : 'Criar Perfil'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ProfileCard({ profile, availablePages, onEdit, onDelete }) {
  const pageLabels = profile.pages.map(p => availablePages[p] || p);

  return (
    <div className="bg-white border-2 border-border rounded-lg p-4 hover:border-brand-main transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-heading font-bold text-lg">{profile.name}</h3>
          {profile.description && (
            <p className="text-sm text-txt-secondary mt-1">{profile.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.pages.map(pageKey => (
              <span key={pageKey} className="inline-block bg-brand-light text-brand-main text-xs px-2 py-1 rounded-full">
                {availablePages[pageKey] || pageKey}
              </span>
            ))}
          </div>
          {profile.created_at && (
            <p className="text-xs text-txt-secondary mt-3">
              Criado em: {new Date(profile.created_at).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={onEdit} variant="outline" size="sm">
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button onClick={onDelete} variant="outline" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SystemProfileCard({ profileKey, profile, availablePages, onEdit }) {
  const pageLabels = profile.pages.map(p => availablePages[p] || p);

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-heading font-bold text-lg text-blue-900">{profile.name}</h3>
          </div>
          <p className="text-sm text-blue-800 mt-1">{profile.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.pages.map(pageKey => (
              <span key={pageKey} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                {availablePages[pageKey] || pageKey}
              </span>
            ))}
          </div>
        </div>
        <Button onClick={onEdit} variant="outline" size="sm">
          <Edit2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
