// File: src/pages/admin/management/users/Users.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Users as UsersIcon, Plus, SquarePen, Trash2, X as XIcon
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet, apiDelete } from '../../../../shared/apiClient.js';
import { toast } from 'react-toastify';
import styles from './styles/Users.module.css';
import { useConfirm } from '../../../../app/provider/ConfirmProvider.jsx';

const PERFIL_ICONS = {
  admin:      <UsersIcon size={14} />,
  atendente:  <UsersIcon size={14} />,
  supervisor: <UsersIcon size={14} />,
};
const iconForPerfil = (perfil) => {
  const k = String(perfil || '').toLowerCase();
  return PERFIL_ICONS[k] ?? <UsersIcon size={14} />;
};

export default function Users({ canCreateAdmin = false }) {
  const [items, setItems] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');

  const [okMsg, setOkMsg] = useState(null);
  const [error, setError] = useState(null);

  const confirm = useConfirm();
  const navigate = useNavigate();

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    toast.success(msg);
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
        apiGet('/queues'),
      ]);
      setItems(Array.isArray(usersResp) ? usersResp : []);
      setQueues(Array.isArray(filasResp) ? filasResp : []);
    } catch (e) {
      const msg = 'Falha ao carregar usuários.';
      setError(msg);
      toast.error(msg);
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

  async function handleDelete(u) {
    setError(null);
    const hasFilas = Array.isArray(u.filas) && u.filas.length > 0;
    if (hasFilas) {
      const msg = 'Não é possível excluir: o usuário possui filas vinculadas. Remova as filas antes de excluir.';
      setError(msg);
      toast.warn(msg);
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
      const msg = 'Falha ao excluir usuário.';
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className={styles.container}>
      {/* Breadcrumbs (reaproveitando suas classes) */}
      <div className={styles.crumbBar}>
        <span className={styles.crumb}>Admin</span>
        <span className={styles.bcSep}>/</span>
        <span className={styles.crumb}>Usuários</span>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button
            className={styles.btnPrimary}
            onClick={() => navigate('/management/users/new', { state: { canCreateAdmin } })}
            title="Novo usuário"
          >
            <Plus size={16}/> Novo usuário
          </button>
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>Gestão de usuários: cadastro, papéis e acessos em um só lugar.</p>
        </div>
      </div>
      
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome ou email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className={styles.searchClear} onClick={() => setQuery('')} aria-label="Limpar busca">
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Filas</th>
                <th style={{ width: 160, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className={styles.skelRow}>
                  <td colSpan={5}><div className={styles.skeletonRow}/></td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>Nenhum usuário encontrado.</td></tr>
              )}

              {!loading && filtered.map(u => {
                const nome = `${u.name ?? ''} ${u.lastname ?? ''}`.trim();
                const filasArr = Array.isArray(u.filas) ? u.filas : [];
                const chipNames = filasArr
                  .map(id => queuesById.get(String(id))?.nome ?? queuesById.get(String(id))?.name ?? id)
                  .filter(Boolean);

                return (
                  <tr key={u.id} className={styles.rowHover}>
                    <td data-label="Nome">{nome || '—'}</td>
                    <td data-label="Email">{u.email || '—'}</td>
                    <td data-label="Perfil">
                      <span
                        className={`${styles.tag} ${styles.tagRole}`}
                        data-role={String(u.perfil || '').toLowerCase()}
                        title={u.perfil}
                        aria-label={u.perfil}
                      >
                        {iconForPerfil(u.perfil)}
                      </span>
                    </td>
                    <td data-label="Filas">
                      <div className={styles.tagsWrap}>
                        {chipNames.length === 0
                          ? <span className={styles.muted}>—</span>
                          : chipNames.map((n, i) => (
                              <span key={`${u.id}-f-${i}`} className={`${styles.tag} ${styles.tagQueue}`}>{n}</span>
                            ))}
                      </div>
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actions}>
                        <Link
                          to={`/management/users/${encodeURIComponent(u.id)}/edit`}
                          state={{ canCreateAdmin }}
                          className={styles.qrIconBtn}
                          title="Editar"
                        >
                          <SquarePen size={16}/>
                        </Link>
                        <button
                          className={`${styles.qrIconBtn} ${styles.danger}`}
                          title="Excluir"
                          onClick={() => handleDelete(u)}
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
