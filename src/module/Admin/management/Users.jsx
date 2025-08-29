import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Users as UsersIcon, Plus, Pencil, Trash2, X as XIcon, RefreshCw,
  AlertCircle, CheckCircle2, Shield, Search, Eye, MoreVertical
} from 'lucide-react';
import { apiGet, apiDelete } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';
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
    <div className={styles.container}>
      {/* Header melhorado */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderContent}>
          <div className={styles.pageTitle}>
            <h1>Gestão de Usuários</h1>
            <p>Gerencie usuários, perfis e permissões do sistema</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.actionBtn} ${styles['actionBtn--blue']}`}
              onClick={load}
              disabled={refreshing}
              title="Atualizar"
            >
              <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
              Atualizar
            </button>
            <button
              className={`${styles.actionBtn} ${styles['actionBtn--green']}`}
              onClick={() => { setEditing(null); setOpenModal(true); }}
              title="Novo usuário"
            >
              <Plus size={16} />
              Novo usuário
            </button>
          </div>
        </div>
      </div>

      {/* Alertas compactos */}
      <div className={styles.alertsStack}>
        {okMsg && (
          <div className={styles.alertOk} role="status">
            <span className={styles.alertIcon}><CheckCircle2 size={16} /></span>
            <span>{okMsg}</span>
            <button className={styles.alertClose} onClick={() => setOkMsg(null)} aria-label="Fechar">
              <XIcon size={14} />
            </button>
          </div>
        )}
        {error && (
          <div className={styles.alertErr} role="alert">
            <span className={styles.alertIcon}><AlertCircle size={16} /></span>
            <span>{error}</span>
            <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar">
              <XIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Card da lista */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          {/* Filtros (tabs) */}
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por perfil">
            {PERFIS.map(t => (
              <button
                key={t.key || 'all'}
                role="tab"
                aria-selected={statusFilter === t.key}
                className={`${styles.tab} ${statusFilter === t.key ? styles.tabActive : ''}`}
                onClick={() => setStatusFilter(t.key)}
                type="button"
                title={t.label}
              >
                {t.icon} {t.label}
                <span className={styles.kpillSmall}>{perfilCounts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>

          {/* Busca melhorada */}
          <div className={styles.searchGroup}>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={16} />
              <input
                className={styles.searchInput}
                placeholder="Buscar por nome ou email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button 
                  className={styles.searchClear} 
                  onClick={() => setQuery('')} 
                  aria-label="Limpar busca"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            {selectedItems.length > 0 && (
              <div className={styles.selectedBadge}>
                <span>{selectedItems.length} selecionado(s)</span>
                <button className={styles.selectedAction} title="Excluir selecionados">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCol}>
                  <input
                    type="checkbox"
                    checked={selectedItems.length === filtered.length && filtered.length > 0}
                    onChange={handleSelectAll}
                    className={styles.checkbox}
                  />
                </th>
                <th>Usuário</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Filas</th>
                <th style={{ width: 160, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className={styles.skelRow}>
                  <td colSpan={6}><div className={styles.skeletonRow}/></td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyTitle}>Nenhum usuário encontrado</div>
                      <div className={styles.emptyDesc}>Tente ajustar os filtros ou termos de busca</div>
                    </div>
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
                  <tr key={u.id} className={styles.rowHover}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(u.id)}
                        onChange={() => handleSelectItem(u.id)}
                        className={styles.checkbox}
                      />
                    </td>
                    <td data-label="Usuário">
                      <div className={styles.userCell}>
                        <div className={styles.userAvatar} data-name={nome || 'U'}>
                          {nome.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U'}
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>{nome || '—'}</div>
                          <div className={styles.userId}>ID: {u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Email">{u.email || '—'}</td>
                    <td data-label="Perfil">
                      <span className={`${styles.tag} ${styles.tagRole}`} data-role={(u.perfil || '').toLowerCase()}>
                        {(u.perfil || '').charAt(0).toUpperCase() + (u.perfil || '').slice(1) || '—'}
                      </span>
                    </td>
                    <td data-label="Filas">
                      <div className={styles.tagsWrap}>
                        {chipNames.length === 0
                          ? <span className={styles.muted}>—</span>
                          : chipNames.slice(0, 3).map((n, i) => (
                              <span key={`${u.id}-f-${i}`} className={`${styles.tag} ${styles.tagQueue}`}>{n}</span>
                            ))}
                        {chipNames.length > 3 && (
                          <span className={`${styles.tag} ${styles.tagMore}`}>
                            +{chipNames.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actions}>
                        <button
                          className={styles.qrIconBtn}
                          title="Visualizar"
                        >
                          <Eye size={16}/>
                        </button>
                        <button
                          className={styles.qrIconBtn}
                          title="Editar"
                          onClick={() => { setEditing(u); setOpenModal(true); }}
                        >
                          <Pencil size={16}/>
                        </button>
                        <button
                          className={`${styles.qrIconBtn} ${styles.danger}`}
                          title="Excluir"
                          onClick={() => handleDelete(u)}
                        >
                          <Trash2 size={16}/>
                        </button>
                        <button
                          className={styles.qrIconBtn}
                          title="Mais opções"
                        >
                          <MoreVertical size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {!loading && filtered.length > 0 && (
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              Mostrando <strong>1</strong> a <strong>{filtered.length}</strong> de{' '}
              <strong>{filtered.length}</strong> resultados
            </div>
            <div className={styles.paginationControls}>
              <button className={styles.paginationBtn} disabled>
                Anterior
              </button>
              <button className={`${styles.paginationBtn} ${styles.paginationActive}`}>
                1
              </button>
              <button className={styles.paginationBtn} disabled>
                Próximo
              </button>
            </div>
          </div>
        )}
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
