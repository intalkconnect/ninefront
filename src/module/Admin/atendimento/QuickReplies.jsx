import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiGet, apiPost, apiDelete, apiPut } from '../../../shared/apiClient';
import styles from './styles/QuickReplies.module.css';

/**
 * QuickReplies – Componente melhorado com edição inline e melhor UX
 * Endpoints esperados no back:
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

  // Estados do formulário
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  
  // Estados de ação
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingId, setSavingId] = useState(null);

  // Toast de sucesso
  const showSuccess = useCallback((msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  // Carregamento inicial
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

  useEffect(() => { 
    load(); 
  }, []);

  // Filtros e ordenação
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...items].sort((a, b) => {
      const titleA = String(a.title || '').toLowerCase();
      const titleB = String(b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
    
    if (!q) return base;
    
    return base.filter((r) => {
      const title = String(r.title || '').toLowerCase();
      const content = String(r.content || '').toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }, [items, query]);

  // Criar nova resposta
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
      const created = await apiPost('/quickReplies', { 
        title: trimmedTitle, 
        content: trimmedContent 
      });
      
      setItems(prev => [...prev, created]);
      setTitle('');
      setContent('');
      showSuccess('✅ Resposta rápida criada com sucesso!');
    } catch (e) {
      console.error('Erro ao criar:', e);
      setError('Erro ao criar resposta. Tente novamente.');
    }
  };

  // Iniciar edição
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title || '');
    setEditContent(item.content || '');
  };

  // Cancelar edição
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
  };

  // Salvar edição
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
      
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, ...updated } : item
      ));
      
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

  // Remover resposta
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover esta resposta?')) {
      return;
    }

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

  // Copiar conteúdo
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      showSuccess('📋 Conteúdo copiado para a área de transferência!');
    } catch (e) {
      console.error('Erro ao copiar:', e);
      setError('Não foi possível copiar. Seu navegador pode não suportar esta funcionalidade.');
    }
  };

  // Limpar busca
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
          
          {/* Sistema de alertas melhorado */}
          {error && (
            <div className={styles.alertErr} role="alert">
              <span className={styles.alertIcon}>⚠️</span>
              <span>{error}</span>
              <button 
                className={styles.alertClose}
                onClick={() => setError(null)}
                aria-label="Fechar alerta"
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
                aria-label="Fechar alerta"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Formulário de criação aprimorado */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <span className={styles.cardIcon}>✨</span>
            Nova Resposta
          </div>
        </div>
        <form onSubmit={handleCreate} className={styles.formGrid}>
          <div className={styles.inputGroup}>
            <label htmlFor="title" className={styles.label}>
              Título *
            </label>
            <input
              id="title"
              className={styles.input}
              placeholder="Ex: Saudação inicial, Informações de horário..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
            />
            <div className={styles.inputHelper}>
              {title.length}/100 caracteres
            </div>
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="content" className={styles.label}>
              Conteúdo *
            </label>
            <textarea
              id="content"
              className={styles.textarea}
              rows={4}
              placeholder="Digite o conteúdo da resposta rápida aqui..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <div className={styles.inputHelper}>
              {content.length} caracteres
            </div>
          </div>
          
          <div className={styles.formActions}>
            <button 
              className={styles.btnPrimary} 
              type="submit"
              disabled={!title.trim() || !content.trim()}
            >
              <span className={styles.btnIcon}>➕</span>
              Adicionar Resposta
            </button>
          </div>
        </form>
      </div>

      {/* Lista de respostas melhorada */}
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
              />
              {query && (
                <button 
                  className={styles.searchClear}
                  onClick={clearSearch}
                  title="Limpar busca"
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
                <th style={{ width: 200 }}>Ações</th>
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
                        <div>Nenhuma resposta encontrada para "<strong>{query}</strong>"</div>
                        <button className={styles.btnLink} onClick={clearSearch}>
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
                  <td className={styles.cellKey}>
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
                  
                  <td className={styles.cellContent}>
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
                  
                  <td className={styles.cellActions}>
                    {editingId === item.id ? (
                      <div className={styles.editActions}>
                        <button
                          className={styles.btnSuccess}
                          onClick={() => saveEdit(item.id)}
                          disabled={savingId === item.id}
                        >
                          {savingId === item.id ? '💾 Salvando...' : '✅ Salvar'}
                        </button>
                        <button
                          className={styles.btn}
                          onClick={cancelEdit}
                          disabled={savingId === item.id}
                        >
                          ❌ Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className={styles.actions}>
                        <button 
                          className={styles.btn} 
                          onClick={() => handleCopy(item.content)}
                          title="Copiar conteúdo"
                        >
                          📋 Copiar
                        </button>
                        <button 
                          className={styles.btnSecondary} 
                          onClick={() => startEdit(item)}
                          title="Editar resposta"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          className={styles.btnDanger}
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          title="Remover resposta"
                        >
                          {deletingId === item.id ? '🗑️ Removendo...' : '🗑️ Remover'}
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

      {/* Footer com informações úteis */}
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
