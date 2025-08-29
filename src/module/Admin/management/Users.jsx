import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Users as UsersIcon, Plus, Pencil, Trash2, X as XIcon, RefreshCw,
  AlertCircle, CheckCircle2, Shield, Search, Eye, MoreVertical
} from 'lucide-react';
import { apiGet, apiDelete } from '../../../shared/apiClient';
import UsersModal from './UsersModal';
import { useConfirm } from '../../../components/ConfirmProvider.jsx';

const PERFIS = [
  { key: '',           label: 'Todos',      icon: <UsersIcon size={14}/> },
  { key: 'admin',      label: 'Admin',      icon: <Shield size={14}/> },
  { key: 'supervisor', label: 'Supervisor', icon: <Shield size={14}/> },
  { key: 'atendente',  label: 'Atendente',  icon: <Shield size={14}/> },
];

export default function Users() {
  const [items, setItems] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');

  const [okMsg, setOkMsg] = useState(null);
  const [error, setError] = useState(null);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const confirm = useConfirm();

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    clearTimeout((toastOK)._t);
    (toastOK)._t = setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const [usersResp, filasResp] = await Promise.all([
        apiGet('/users'),
        apiGet('/filas'),
      ]);
      setItems(Array.isArray(usersResp) ? usersResp : []);
      setQueues(Array.isArray(filasResp) ? filasResp : []);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar usuários.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(u => {
      if (statusFilter && (u.perfil || '').toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      const nome = `${u.name ?? ''} ${u.lastname ?? ''}`.toLowerCase();
      const email = String(u.email ?? '').toLowerCase();
      return nome.includes(q) || email.includes(q);
    });
  }, [items, statusFilter, query]);

  const queuesById = useMemo(() => {
    const map = new Map();
    for (const f of queues) map.set(String(f.id ?? f.nome ?? f.name), f);
    return map;
  }, [queues]);

  const perfilCounts = useMemo(() => {
    const counts = items.reduce((acc, u) => {
      const k = String(u.perfil || '').toLowerCase();
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    counts[''] = items.length;
    return counts;
  }, [items]);

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedItems(
      selectedItems.length === filtered.length 
        ? [] 
        : filtered.map(item => item.id)
    );
  };

  const getProfileColor = (profile) => {
    const colors = {
      'admin': 'bg-blue-100 text-blue-800 border-blue-200',
      'supervisor': 'bg-purple-100 text-purple-800 border-purple-200',
      'atendente': 'bg-amber-100 text-amber-800 border-amber-200'
    };
    return colors[profile?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
      'bg-gradient-to-br from-yellow-400 to-yellow-600'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  async function handleDelete(u) {
    setError(null);
    const hasFilas = Array.isArray(u.filas) && u.filas.length > 0;
    if (hasFilas) {
      setError('Não é possível excluir: o usuário possui filas vinculadas. Remova as filas antes de excluir.');
      return;
    }
    try {
      const ok = await confirm({
        title: 'Excluir usuário?',
        description: 'Tem certeza que deseja excluir esse usuário? Esta ação não pode ser desfeita.',
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      await apiDelete(`/users/${u.id}`);
      toastOK('Usuário excluído.');
      load();
    } catch (e) {
      console.error(e);
      setError('Falha ao excluir usuário.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestão de Usuários</h1>
              <p className="text-gray-600">Gerencie usuários, perfis e permissões do sistema</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={load}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Atualizar"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={() => { setEditing(null); setOpenModal(true); }}
                className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus className="w-4 h-4" />
                Novo usuário
              </button>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {(okMsg || error) && (
          <div className="mb-6 space-y-2">
            {okMsg && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{okMsg}</span>
                <button 
                  onClick={() => setOkMsg(null)}
                  className="p-1 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <button 
                  onClick={() => setError(null)}
                  className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {PERFIS.map(({ key, label, icon }) => (
                <button
                  key={key || 'all'}
                  onClick={() => setStatusFilter(key)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    statusFilter === key
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-200 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                  title={label}
                >
                  {icon}
                  {label}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    statusFilter === key 
                      ? 'bg-blue-200 text-blue-800' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {perfilCounts[key] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Search and Actions */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou email..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XIcon className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              {selectedItems.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm">
                  <span>{selectedItems.length} selecionado(s)</span>
                  <button className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-100 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-12 px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filtered.length && filtered.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Perfil
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Filas
                  </th>
                  <th className="text-center px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-12 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-lg animate-pulse bg-[length:200%_100%]"></div>
                    </td>
                  </tr>
                ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-gray-400 text-lg mb-2">Nenhum usuário encontrado</div>
                      <div className="text-gray-500 text-sm">Tente ajustar os filtros ou termos de busca</div>
                    </td>
                  </tr>
                )}

                {!loading && filtered.map(u => {
                  const nome = `${u.name ?? ''} ${u.lastname ?? ''}`.trim();
                  const filasArr = Array.isArray(u.filas) ? u.filas : [];
                  const chipNames = filasArr
                    .map(id => queuesById.get(String(id))?.nome ?? queuesById.get(String(id))?.name ?? id)
                    .filter(Boolean);

                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(u.id)}
                          onChange={() => handleSelectItem(u.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(nome || 'U')}`}>
                            {nome.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{nome || '—'}</div>
                            <div className="text-sm text-gray-500">ID: {u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{u.email || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getProfileColor(u.perfil)}`}>
                          {(u.perfil || '').charAt(0).toUpperCase() + (u.perfil || '').slice(1) || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {chipNames.length === 0 ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            chipNames.slice(0, 3).map((name, tagIndex) => (
                              <span key={tagIndex} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-200">
                                {name}
                              </span>
                            ))
                          )}
                          {chipNames.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                              +{chipNames.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditing(u); setOpenModal(true); }}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(u)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">1</span> a <span className="font-medium">{filtered.length}</span> de{' '}
                  <span className="font-medium">{filtered.length}</span> resultados
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50" disabled>
                    Anterior
                  </button>
                  <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg">
                    1
                  </button>
                  <button className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50" disabled>
                    Próximo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal controlado */}
      {openModal && (
        <UsersModal
          isOpen={openModal}
          onClose={() => setOpenModal(false)}
          onSaved={() => {
            setOpenModal(false);
            load();
            toastOK(editing ? 'Usuário atualizado.' : 'Usuário criado.');
          }}
          editing={editing}
          queues={queues}
        />
      )}
    </div>
  );
}
