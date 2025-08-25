import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Users as UsersIcon, Plus, Pencil, Trash2, X as XIcon, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiGet, apiPost, apiDelete, apiPut } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';
import UsersModal from './UsersModal';
import { useConfirm } from '../../../components/ConfirmProvider.jsx';

const PERFIS = [
  { key: '', label: 'Todos' },
  { key: 'admin', label: 'Admin' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'atendente', label: 'Atendente' },
];

export default function Users() {
  const [items, setItems] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');

  const [okMsg, setOkMsg] = useState(null);
  const [error, setError] = useState(null);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
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
    // regra: se tiver filas vinculadas, bloquear
    const hasFilas = Array.isArray(u.filas) && u.filas.length > 0;
    if (hasFilas) {
      setError('Não é possível excluir: o usuário possui filas vinculadas. Remova as filas antes de excluir.');
      return;
    }
    if (!window.confirm(`Excluir o usuário "${u.name} ${u.lastname}"?`)) return;

    try {
      const ok = await confirm({
      title: 'Excluir usuário?',
      description: `Tem certeza que deseja excluir esse usuário? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      tone: 'danger', // pinta vermelhinho
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
      {/* Header da página */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><UsersIcon size={22} /> Usuários</h1>
          <p className={styles.subtitle}>
            Gerencie usuários, perfis e filas vinculadas.
          </p>

          {error && (
            <div className={styles.alertErr} role="alert">
              <span className={styles.alertIcon}><AlertCircle size={16} /></span>
              <span>{error}</span>
              <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar"><XIcon size={14} /></button>
            </div>
          )}
          {okMsg && (
            <div className={styles.alertOk} role="status">
              <span className={styles.alertIcon}><CheckCircle2 size={16} /></span>
              <span>{okMsg}</span>
              <button className={styles.alertClose} onClick={() => setOkMsg(null)} aria-label="Fechar"><XIcon size={14} /></button>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={load}><RefreshCw size={16}/> Atualizar</button>
          <button className={styles.btnPrimary} onClick={() => { setEditing(null); setOpenModal(true); }}>
            <Plus size={16}/> Novo usuário
          </button>
        </div>
      </div>

      {/* Card da lista */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          {/* Filtros à esquerda */}
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por perfil">
            {PERFIS.map(t => (
              <button
                key={t.key || 'all'}
                role="tab"
                aria-selected={statusFilter === t.key}
                className={`${styles.tab} ${statusFilter === t.key ? styles.tabActive : ''}`}
                onClick={() => setStatusFilter(t.key)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Busca à direita */}
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
              {loading && (
                <tr><td colSpan={5} className={styles.loading}>Carregando…</td></tr>
              )}

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
                    <td data-label="Perfil">{(u.perfil || '').charAt(0).toUpperCase() + (u.perfil || '').slice(1)}</td>
                    <td data-label="Filas">
                      <div className={styles.chipsWrap}>
                        {chipNames.length === 0 ? <span className={styles.muted}>—</span> : chipNames.map((n, i) => (
                          <span key={`${u.id}-f-${i}`} className={styles.chip}>{n}</span>
                        ))}
                      </div>
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actions}>
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {openModal && (
        <UsersModal
          isOpen={openModal}
          onClose={() => setOpenModal(false)}
          onSaved={() => { setOpenModal(false); load(); toastOK(editing ? 'Usuário atualizado.' : 'Usuário criado.'); }}
          editing={editing}
          queues={queues}
        />
      )}
    </div>
  );
}
