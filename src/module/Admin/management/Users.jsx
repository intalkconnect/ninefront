import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiDelete } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';
import {
  Users as UsersIcon,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X as XIcon,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

import UserModal from './UserModal';

const PERFIL_TABS = [
  { key: '', label: 'Todos' },
  { key: 'admin', label: 'Admin' },
  { key: 'atendente', label: 'Atendente' },
];

function StatusBadge({ status }) {
  if (!status) return <span className={styles.stDefault}>—</span>;
  const map = {
    active: { cls: styles.stActive, txt: 'Ativo' },
    inactive: { cls: styles.stInactive, txt: 'Inativo' },
  };
  const it = map[status] || { cls: styles.stDefault, txt: String(status) };
  return <span className={`${styles.statusChip} ${it.cls}`}>{it.txt}</span>;
}

export default function UsersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [query, setQuery] = useState('');
  const [perfilFilter, setPerfilFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 2000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/users');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .filter(u => (perfilFilter ? String(u.perfil) === perfilFilter : true))
      .filter(u => {
        if (!q) return true;
        const name = `${u.name || ''} ${u.lastname || ''}`.toLowerCase();
        const email = String(u.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '') || (a.lastname || '').localeCompare(b.lastname || ''));
  }, [items, query, perfilFilter]);

  const clearSearch = () => setQuery('');

  async function handleDelete(u) {
    if (!window.confirm(`Excluir o usuário ${u.name} ${u.lastname}?`)) return;
    try {
      setError(null);
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
      {/* Header da página */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <UsersIcon size={24} aria-hidden="true" /> Usuários
          </h1>
          <p className={styles.subtitle}>
            Cadastre, edite e organize os usuários do sistema.
          </p>

          {error && (
            <div className={styles.alertErr} role="alert">
              <span className={styles.alertIcon} aria-hidden="true"><AlertCircle size={16} /></span>
              <span>{error}</span>
              <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar">
                <XIcon size={14} />
              </button>
            </div>
          )}
          {okMsg && (
            <div className={styles.alertOk} role="status">
              <span className={styles.alertIcon} aria-hidden="true"><CheckCircle2 size={16} /></span>
              <span>{okMsg}</span>
              <button className={styles.alertClose} onClick={() => setOkMsg(null)} aria-label="Fechar">
                <XIcon size={14} />
              </button>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          <button className={styles.btn} type="button" onClick={load} title="Atualizar lista">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button className={styles.btnPrimary} type="button" onClick={() => { setEditUser(null); setModalOpen(true); }}>
            <Plus size={16} /> Novo usuário
          </button>
        </div>
      </div>

      {/* Card/lista */}
      <div className={styles.card}>
        {/* filtros DENTRO do header do card: tabs (esq) + busca (dir) */}
        <div className={styles.cardHead}>
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por perfil">
            {PERFIL_TABS.map(tab => (
              <button
                key={tab.key || 'all'}
                className={`${styles.tab} ${perfilFilter === tab.key ? styles.tabActive : ''}`}
                onClick={() => setPerfilFilter(tab.key)}
                type="button"
                role="tab"
                aria-selected={perfilFilter === tab.key}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome ou email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar usuários"
            />
            {query && (
              <button className={styles.searchClear} onClick={clearSearch} aria-label="Limpar busca" type="button">
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Filas</th>
                <th>Status</th>
                <th style={{ width: 160, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className={styles.loading} colSpan={6}>Carregando…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td className={styles.empty} colSpan={6}>Nenhum usuário encontrado.</td></tr>
              )}

              {!loading && filtered.map(u => (
                <tr key={u.id} className={styles.rowHover}>
                  <td data-label="Nome">
                    <div className={styles.keyTitle}>{`${u.name || ''} ${u.lastname || ''}`.trim()}</div>
                    <div className={styles.keySub}>{u.id ? `#${u.id}` : ''}</div>
                  </td>
                  <td data-label="Email">{u.email || '—'}</td>
                  <td data-label="Perfil" className={styles.cap}>{u.perfil || '—'}</td>
                  <td data-label="Filas">
                    {Array.isArray(u.filas) && u.filas.length ? u.filas.join(', ') : '—'}
                  </td>
                  <td data-label="Status"><StatusBadge status={u.status} /></td>
                  <td data-label="Ações" className={styles.actionsCell}>
                    <div className={styles.actions}>
                      <button
                        className={styles.qrIconBtn}
                        title="Editar"
                        type="button"
                        onClick={() => { setEditUser(u); setModalOpen(true); }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className={`${styles.qrIconBtn} ${styles.danger}`}
                        title="Excluir"
                        type="button"
                        onClick={() => handleDelete(u)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal criar/editar */}
      <UserModal
        isOpen={modalOpen}
        user={editUser}
        onClose={() => { setModalOpen(false); setEditUser(null); }}
        onSaved={() => { setModalOpen(false); setEditUser(null); load(); toastOK(editUser ? 'Usuário atualizado.' : 'Usuário criado.'); }}
      />
    </div>
  );
}
