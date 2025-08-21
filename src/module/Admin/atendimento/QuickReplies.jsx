import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiGet, apiPost, apiDelete, apiPut } from '../../../shared/apiClient';
import styles from './styles/QuickReplies.module.css';

/**
 * QuickReplies – Componente com edição inline, ícones e melhorias de UX
 * Endpoints no back:
 *  GET    /quickReplies         → lista
 *  POST   /quickReplies         → { title, content }
 *  PUT    /quickReplies/:id     → { title, content }
 *  DELETE /quickReplies/:id     → remove
 */
const QuickReplies = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');

  // Ações
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingId, setSavingId] = useState(null);

  // Toast
  const showSuccess = useCallback((msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  // Load inicial
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

  // Filtro/ordenação
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...items].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }));
    if (!q) return base;
    return base.filter((r) => {
      const t = String(r.title || '').toLowerCase();
      const c = String(r.content || '').toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [items, query]);

  // Criar
  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      setError('Por favor, preencha o título e o conteúdo.');
      return;
    }
    if (trimmedTitle.length > 100) {
      setError('O título deve ter no máximo 100 caracteres.');
      return;
    }
    try {
      const created = await apiPost('/quickReplies', { title: trimmedTitle, content: trimmedContent });
      setItems(prev => [...prev, created]);
      setTitle('');
      setContent('');
      showSuccess('✅ Resposta rápida criada com sucesso!');
    } catch (e) {
      console.error('Erro ao criar:', e);
      setError('Erro ao criar resposta. Tente novamente.');
    }
  };

  // Edição
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title || '');
    setEditContent(item.content || '');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
  };
  const saveEdit = async (id) => {
    if (!editTitle.trim() || !editContent.trim()) {
      setError('Título e conteúdo são obrigatórios.');
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const updated = await apiPut(`/quickReplies/${id}`, { title: editTitle.trim(), content: editContent.trim() });
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item));
      setEditingId(null);
      setEditTitle('');
      setEditContent('');
      showSuccess('✅ Resposta atualizada com sucesso!');
    } catch (e) {
      console.error('Erro ao salvar:', e);
      setError('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setSavingId(null);
    }
  };

  // Remover
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover esta resposta?')) return;
    setDeletingId(id);
    setError(null);
    try {
      await apiDelete(`/quickReplies/${id}`);
      setItems(prev => prev.filter(r => r.id !== id));
      showSuccess('🗑️ Resposta removida com sucesso!');
    } catch (e) {
      console.error('Erro ao excluir:', e);
      setError('Erro ao excluir resposta. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  // Copiar
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      showSuccess('📋 Conteúdo copiado para a área de transferência!');
    } catch (e) {
      console.error('Erro ao copiar:', e);
      setError('Não foi possível copiar. Seu navegador pode não suportar esta funcionalidade.');
    }
  };

  const clearSearch = () => setQuery('');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}>💬</span>
            Respostas Rápidas
          </h1>
          <p className={styles.subtitle}>
            Gerencie atalhos de mensagens para agilizar o atendimento ao cliente.
          </p>

          {/* Alertas */}
          {error && (
            <div className={styles.alertErr} role="alert">
              <span className={styles.alertIcon}>⚠️</span>
              <span>{error}</span>
              <button
                className={styles.alertClose}
                onClick={() => setError(null)}
                aria-label="Fechar alerta"
                title="Fechar alerta"
              >
                ✕
              </button>
            </div>
          )}
          {successMsg && (
            <div className={styles.alertOk} role="alert">
              <span>{successMsg}</span>
              <button
                className={styles.alertClose}
                onClick={() => setSuccessMsg(null)}
                aria-label="Fechar mensagem"
                title="Fechar mensagem"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Formulário de criação */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <span className={styles.cardIcon}>✨</span>
            Nova Resposta
          </div>
        </div>
        <form onSubmit={handleCreate} className={styles.formGrid}>
          <div className={styles.inputGroup}>
            <label htmlFor="title" className={styles.label}>Título *</label>
            <input
              id="title"
              className={styles.input}
              placeholder="Ex: Saudação inicial, Informações de horário..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
            />
            <div className={styles.inputHelper}>{title.length}/100 caracteres</div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="content" className={styles.label}>Conteúdo *</label>
            <textarea
              id="content"
              className={styles.textarea}
              rows={4}
              placeholder="Digite o conteúdo da resposta rápida aqui..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <div className={styles.inputHelper}>{content.length} caracteres</div>
          </div>

          <div className={styles.formActions}>
            <button
              className={`${styles.btnPrimary} ${styles.iconOnly}`}
              type="submit"
              disabled={!title.trim() || !content.trim()}
              aria-label="Adicionar resposta"
              title="Adicionar resposta"
            >
              ➕
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <span className={styles.cardIcon}>📋</span>
            Respostas Cadastradas
          </div>

          <div className={styles.cardActions}>
            <div className={styles.searchGroup}>
              <input
                className={styles.searchInput}
                placeholder="🔍 Buscar por título ou conteúdo..."
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
                  ✕
                </button>
              )}
            </div>
            <div className={styles.counter}>
              <span className={styles.counterNumber}>{filtered.length}</span>
              <span className={styles.counterLabel}>
                {filtered.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table} role="table">
            <thead>
              <tr>
                <th style={{ minWidth: 280 }}>Título</th>
                <th>Conteúdo</th>
                <th style={{ width: 220 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <span>Carregando respostas...</span>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className={styles.empty}>
                    {query ? (
                      <>
                        <span className={styles.emptyIcon}>🔍</span>
                        <div>
                          Nenhuma resposta encontrada para "<strong>{query}</strong>"
                        </div>
                        <button className={styles.btnLink} onClick={clearSearch} type="button">
                          Limpar filtro
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={styles.emptyIcon}>📝</span>
                        <div>Nenhuma resposta rápida cadastrada ainda.</div>
                        <div className={styles.emptyHelper}>
                          Use o formulário acima para criar sua primeira resposta!
                        </div>
                      </>
                    )}
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
                      <pre className={styles.code} title={item.content}>
                        {item.content}
                      </pre>
                    )}
                  </td>

                  <td className={styles.cellActions} data-label="Ações">
                    {editingId === item.id ? (
                      <div className={styles.editActions}>
                        <button
                          className={`${styles.btnSuccess} ${styles.iconOnly}`}
                          onClick={() => saveEdit(item.id)}
                          disabled={savingId === item.id}
                          aria-label={savingId === item.id ? 'Salvando' : 'Salvar'}
                          title={savingId === item.id ? 'Salvando...' : 'Salvar'}
                          type="button"
                        >
                          {savingId === item.id ? '💾' : '✅'}
                        </button>
                        <button
                          className={`${styles.btn} ${styles.iconOnly}`}
                          onClick={cancelEdit}
                          disabled={savingId === item.id}
                          aria-label="Cancelar"
                          title="Cancelar"
                          type="button"
                        >
                          ❌
                        </button>
                      </div>
                    ) : (
                      <div className={styles.actions}>
                        <button
                          className={`${styles.btn} ${styles.iconOnly}`}
                          onClick={() => handleCopy(item.content)}
                          title="Copiar conteúdo"
                          aria-label="Copiar conteúdo"
                          type="button"
                        >
                          📋
                        </button>
                        <button
                          className={`${styles.btnSecondary} ${styles.iconOnly}`}
                          onClick={() => startEdit(item)}
                          title="Editar resposta"
                          aria-label="Editar resposta"
                          type="button"
                        >
                          ✏️
                        </button>
                        <button
                          className={`${styles.btnDanger} ${styles.iconOnly}`}
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          title={deletingId === item.id ? 'Removendo...' : 'Remover resposta'}
                          aria-label={deletingId === item.id ? 'Removendo' : 'Remover resposta'}
                          type="button"
                        >
                          🗑️
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

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.tip}>
            💡 <strong>Dica:</strong> Use títulos descritivos para encontrar rapidamente suas respostas!
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickReplies;
