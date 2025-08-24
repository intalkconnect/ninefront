import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiGet, apiDelete } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';
import {
  Users as UsersIcon,
  Plus,
  RefreshCw,
  Edit3 as EditIcon,
  Trash2 as TrashIcon,
  X as XIcon,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

import UserModal from './UserModal';

const PERFIS_TABS = [
  { key: '',            label: 'Todos' },
  { key: 'admin',       label: 'Admin' },
  { key: 'supervisor',  label: 'Supervisor' },
  { key: 'atendente',   label: 'Atendente' },
];

export default function UsersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // filtros
  const [query, setQuery] = useState('');
  const [perfilFilter, setPerfilFilter] = useState('');

  // modal
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/users');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
      setError('Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = [...items];

    if (perfilFilter) {
      base = base.filter(u => String(u.perfil || '').toLowerCase() === perfilFilter);
    }
    if (!q) return base.sort((a,b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );

    return base.filter(u => {
      const nome = `${String(u.name || '')} ${String(u.lastname || '')}`.trim().toLowerCase();
      const email = String(u.email || '').toLowerCase();
      return nome.includes(q) || email.includes(q);
    }).sort((a,b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );
  }, [items, perfilFilter, query]);

  const clearSearch = () => setQuery('');

  // excluir — bloqueia se houver filas vinculadas
  const handleDelete = async (user) => {
    const filasCount = Array.isArray(user.filas) ? user.filas.length : 0;
    if (filasCount > 0) {
      setError('Não é possível excluir: o usuário possui filas vinculadas. Desvincule as filas antes de excluir.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja remover este usuário?')) return;

    try {
      await apiDelete(`/users/${user.id}`);
      toastOK('Usuário removido.');
      load();
    } catch (e) {
      console.error('Erro ao excluir usuário:', e);
      setError('Falha ao excluir usuário.');
    }
  };

  return (
    <div className={styles.container}>
      {/* Header da página */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <UsersIcon size={22} aria-hidden="true" /> Usuários
          </h1>
          <p className={styles.subtitle}>
            Cadastre, edite e gerencie o acesso dos usuários ao sistema.
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
          <button className={styles.btnPrimary} type="button" onClick={() => { setEditing(null); setCreateOpen(true); }}>
            <Plus size={16} /> Novo usuário
          </button>
        </div>
      </div>

      {/* Card da lista: tabs (esq) + busca (dir) */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por perfil">
            {PERFIS_TABS.map(tab => (
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
                <th style={{ minWidth: 240 }}>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th style={{ minWidth: 180 }}>Filas</th>
                <th style={{ width: 200, textAlign:'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={styles.loading} colSpan={5}>Carregando…</td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td className={styles.empty} colSpan={5}>Nenhum usuário encontrado.</td>
                </tr>
              )}

              {!loading && filtered.map(u => {
                const nome = `${u.name || ''} ${u.lastname || ''}`.trim();
                const perfil = String(u.perfil || '').toLowerCase();
                const filasArr = Array.isArray(u.filas) ? u.filas : [];
                const mostraFilas = perfil !== 'admin' && filasArr.length > 0;
                const filasResumo = mostraFilas ? `${filasArr.length} ${filasArr.length === 1 ? 'fila' : 'filas'}` : '—';
                const filasTitle = mostraFilas ? filasArr.join(', ') : '';

                return (
                  <tr key={u.id} className={styles.rowHover}>
                    <td data-label="Nome"><div className={styles.keyTitle}>{nome || '—'}</div></td>
                    <td data-label="Email">{u.email || '—'}</td>
                    <td data-label="Perfil" className={styles.perfilCell}>
                      <span className={`${styles.pillPerfil} ${styles[`p_${perfil || 'default'}`]}`}>
                        {u.perfil || '—'}
                      </span>
                    </td>
                    <td data-label="Filas" title={filasTitle}>
                      {filasResumo}
                    </td>
                    <td data-label="Ações" className={styles.actionsCell}>
                      <div className={styles.actions}>
                        <button
                          className={styles.qrIconBtn}
                          title="Editar"
                          onClick={() => { setEditing(u); setCreateOpen(true); }}
                          type="button"
                        >
                          <EditIcon size={16} />
                        </button>

                        <button
                          className={`${styles.qrIconBtn} ${styles.danger}`}
                          title="Excluir"
                          onClick={() => handleDelete(u)}
                          type="button"
                        >
                          <TrashIcon size={16} />
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

      {/* Modal criar/editar */}
      <UserModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        editing={editing}
        onSaved={() => { setCreateOpen(false); setEditing(null); load(); toastOK(editing ? 'Usuário atualizado.' : 'Usuário criado.'); }}
      />
    </div>
  );
}
