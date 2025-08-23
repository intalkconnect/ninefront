// src/pages/QuickReplies/QuickReplies.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiGet, apiDelete, apiPut } from '../../../shared/apiClient';
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
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingId, setSavingId] = useState(null);

  const showSuccess = useCallback((msg) => {
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
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
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
    if (!window.confirm('Tem certeza que deseja remover esta resposta?')) return;
    setDeletingId(id);
    setError(null);
    try {
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
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span className={styles.titleIcon} aria-hidden="true"><MessageSquare size={24} /></span>
            Respostas Rápidas
          </h1>
          <p className={styles.subtitle}>
            Gerencie atalhos de mensagens para agilizar o atendimento ao cliente.
          </p>

          {/* Alertas */}
          {error && (
            <div className={styles.alertErr} role="alert" aria-live="assertive">
              <span className={styles.alertIcon} aria-hidden="true"><AlertCircle size={18} /></span>
              <span>{error}</span>
              <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar alerta" title="Fechar alerta">
                <XIcon size={16} />
              </button>
            </div>
          )}
          {successMsg && (
            <div className={styles.alertOk} role="status" aria-live="polite">
              <span className={styles.alertIcon} aria-hidden="true"><CheckCircle2 size={18} /></span>
              <span>{successMsg}</span>
              <button className={styles.alertClose} onClick={() => setSuccessMsg(null)} aria-label="Fechar mensagem" title="Fechar mensagem">
                <XIcon size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Botão “Criar” abre modal */}
        <div>
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.qrPrimary}`}
            onClick={() => setCreateOpen(true)}
          >
            + Criar resposta
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className={styles.card}>
        <div className={`${styles.cardHead} ${styles.qrCardHead}`}>
          <div className={styles.cardTitle}>
            <span className={styles.cardIcon} aria-hidden="true"><MessageSquare size={18} /></span>
            Respostas Cadastradas
          </div>

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
                  title="Limpar busca"
                  aria-label="Limpar busca"
                  type="button"
                >
                  <XIcon size={16} />
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
            <thead className={styles.qrTableHead}>
              <tr>
                <th style={{ minWidth: 280 }}>Título</th>
                <th>Conteúdo</th>
                <th style={{ width: 220 }}>Ações</th>
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
                  <td className={styles.cellKey} data-label="Título">
                    {editingId === item.id ? (
                      <div className={styles.editForm}>
                        <input
                          className={styles.editInput}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Título"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <div className={styles.keyTitle}>{item.title}</div>
                        <div className={styles.keySub}>ID: {item.id}</div>
                      </>
                    )}
                  </td>

                  <td className={styles.cellContent} data-label="Conteúdo">
                    {editingId === item.id ? (
                      <textarea
                        className={styles.editTextarea}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        placeholder="Conteúdo"
                      />
                    ) : (
                      <pre className={styles.code} title={item.content}>{item.content}</pre>
                    )}
                  </td>

                  <td className={styles.cellActions} data-label="Ações">
                    {editingId === item.id ? (
                      <div className={styles.actions}>
                        <button
                          className={`${styles.btnSuccess} ${styles.iconOnly}`}
                          onClick={() => saveEdit(item.id)}
                          disabled={savingId === item.id}
                          aria-label={savingId === item.id ? 'Salvando' : 'Salvar'}
                          title={savingId === item.id ? 'Salvando...' : 'Salvar'}
                          type="button"
                        >
                          <SaveIcon size={16} aria-hidden="true" />
                        </button>
                        <button
                          className={`${styles.btn} ${styles.iconOnly}`}
                          onClick={cancelEdit}
                          disabled={savingId === item.id}
                          aria-label="Cancelar"
                          title="Cancelar"
                          type="button"
                        >
                          <XIcon size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.actions}>
                        <button
                          className={`${styles.btnSecondary} ${styles.iconOnly}`}
                          onClick={() => startEdit(item)}
                          title="Editar resposta"
                          aria-label="Editar resposta"
                          type="button"
                        >
                          <EditIcon size={16} aria-hidden="true" />
                        </button>
                        <button
                          className={`${styles.btnDanger} ${styles.iconOnly}`}
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          title={deletingId === item.id ? 'Removendo...' : 'Remover resposta'}
                          aria-label={deletingId === item.id ? 'Removendo' : 'Remover resposta'}
                          type="button"
                        >
                          <TrashIcon size={16} aria-hidden="true" />
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

      {/* Footer discreto */}
      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.tip}>
            <strong>Dica:</strong> Prefira títulos descritivos para encontrar rapidamente suas respostas.
          </div>
        </div>
      </div>

      {/* Modal de criação */}
      <QuickReplyModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); showSuccess('Resposta criada com sucesso.'); }}
      />
    </div>
  );
};

export default QuickReplies;
