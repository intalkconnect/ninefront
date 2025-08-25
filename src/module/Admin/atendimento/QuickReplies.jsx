import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiGet, apiDelete, apiPut } from '../../../shared/apiClient';
import { useConfirm } from '../../../components/ConfirmProvider.jsx';
import styles from './styles/QuickReplies.module.css';
import {
  MessageSquare,
  Save as SaveIcon,
  Edit3 as EditIcon,
  Trash2 as TrashIcon,
  X as XIcon,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

import QuickReplyModal from './QuickReplyModal';

const QuickReplies = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // busca
  const [query, setQuery] = useState('');

  // modal
  const [createOpen, setCreateOpen] = useState(false);

  // edição
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = State('');
  const [editContent, setEditContent] = State('');
  const [savingId, setSavingId] = State(null);
  const confirm = Confirm();

  const showSuccess = Callback((msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2600);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/quickReplies');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao carregar:', e);
      setError('Falha ao carregar respostas rápidas. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };
  Effect(() => { load(); }, []);

  const filtered = Memo(() => {
    const q = query.trim().toLowerCase();
    const base = [...items].sort((a, b) =>
      String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' })
    );
    if (!q) return base;
    return base.filter((r) => {
      const t = String(r.title || '').toLowerCase();
      const c = String(r.content || '').toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [items, query]);

  // edição
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title || '');
    setEditContent(item.content || '');
  };
  const cancelEdit = () => { setEditingId(null); setEditTitle(''); setEditContent(''); };
  const saveEdit = async (id) => {
    if (!editTitle.trim() || !editContent.trim()) {
      setError('Título e conteúdo são obrigatórios.');
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const updated = await apiPut(`/quickReplies/${id}`, {
        title: editTitle.trim(),
        content: editContent.trim()
      });
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item));
      setEditingId(null);
      setEditTitle('');
      setEditContent('');
      showSuccess('Resposta atualizada.');
    } catch (e) {
      console.error('Erro ao salvar:', e);
      setError('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setSavingId(null);
    }
  };

  // remover
  const handleDelete = async (id) => {
    setDeletingId(id);
    setError(null);
    try {
      const ok = await confirm({
      title: 'Excluir usuário?',
      description: `Tem certeza que deseja excluir essa resposta rápida? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      tone: 'danger', // pinta vermelhinho
      });
      if (!ok) return;
      await apiDelete(`/quickReplies/${id}`);
      setItems(prev => prev.filter(r => r.id !== id));
      showSuccess('Resposta removida.');
    } catch (e) {
      console.error('Erro ao excluir:', e);
      setError('Erro ao excluir resposta. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  const clearSearch = () => setQuery('');

  return (
    <div className={styles.container} data-page="quickreplies">
      {/* Header com linha e subtítulo (mantidos) */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span className={styles.titleIcon} aria-hidden="true"><MessageSquare size={24} /></span>
            Respostas Rápidas
          </h1>
          <p className={styles.subtitle}>
            Gerencie atalhos de mensagens para agilizar o atendimento ao cliente.
          </p>

          {error && (
            <div className={styles.alertErr} role="alert" aria-live="assertive">
              <span className={styles.alertIcon} aria-hidden="true"><AlertCircle size={18} /></span>
              <span>{error}</span>
              <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar alerta">
                <XIcon size={16} />
              </button>
            </div>
          )}
          {successMsg && (
            <div className={styles.alertOk} role="status" aria-live="polite">
              <span className={styles.alertIcon} aria-hidden="true"><CheckCircle2 size={18} /></span>
              <span>{successMsg}</span>
              <button className={styles.alertClose} onClick={() => setSuccessMsg(null)} aria-label="Fechar mensagem">
                <XIcon size={16} />
              </button>
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setCreateOpen(true)}
          >
            + Nova Resposta
          </button>
        </div>
      </div>

      {/* Card da lista com a busca no topo (fora do header) */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardActions}>
            <div className={styles.searchGroup}>
              <input
                className={styles.searchInput}
                placeholder="Buscar por título ou conteúdo..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar respostas"
              />
              {query && (
                <button
                  className={styles.searchClear}
                  onClick={clearSearch}
                  aria-label="Limpar busca"
                  type="button"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            <div className={styles.counter} aria-label="Total de itens filtrados">
              <span className={styles.counterNumber}>{filtered.length}</span>
              <span>{filtered.length === 1 ? 'item' : 'itens'}</span>
            </div>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table} role="table">
            <thead>
              <tr>
                <th style={{ minWidth: 280 }}>Título</th>
                <th>Conteúdo</th>
                <th style={{ width: 220, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className={styles.empty}>Carregando respostas…</td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className={styles.empty}>
                    <div>Nenhuma resposta encontrada.</div>
                    {query && <button className={styles.btnLink} onClick={clearSearch} type="button">Limpar filtro</button>}
                  </td>
                </tr>
              )}

              {!loading && filtered.map((item) => (
                <tr key={item.id} className={styles.tableRow}>
                  <td data-label="Título">
                    {editingId === item.id ? (
                      <input
                        className={styles.editInput}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título"
                        autoFocus
                      />
                    ) : (
                      <div className={styles.keyTitle}>{item.title}</div>
                    )}
                  </td>

                  <td data-label="Conteúdo">
                    {editingId === item.id ? (
                      <textarea
                        className={styles.editTextarea}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        placeholder="Conteúdo"
                      />
                    ) : (
                      <div className={styles.contentText}>{item.content}</div>
                    )}
                  </td>

                  <td className={styles.actionsCell} data-label="Ações">
                    {editingId === item.id ? (
                      <div className={styles.actions}>
                        <button
                          className={`${styles.iconBtn} ${styles.iconSuccess}`}
                          onClick={() => saveEdit(item.id)}
                          disabled={savingId === item.id}
                          type="button"
                          title="Salvar"
                          aria-label="Salvar"
                        >
                          <SaveIcon size={18} />
                        </button>
                        <button
                          className={styles.iconBtn}
                          onClick={cancelEdit}
                          disabled={savingId === item.id}
                          type="button"
                          title="Cancelar"
                          aria-label="Cancelar"
                        >
                          <XIcon size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.actions}>
                        <button
                          className={styles.iconBtn}
                          onClick={() => startEdit(item)}
                          type="button"
                          title="Editar"
                          aria-label="Editar"
                        >
                          <EditIcon size={18} />
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.iconDanger}`}
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          type="button"
                          title="Excluir"
                          aria-label="Excluir"
                        >
                          <TrashIcon size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.tip}>
            <strong>Dica:</strong> Prefira títulos descritivos para encontrar rapidamente suas respostas.
          </div>
        </div>
      </div>

      <QuickReplyModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); showSuccess('Resposta criada com sucesso.'); }}
      />
    </div>
  );
};

export default QuickReplies;
