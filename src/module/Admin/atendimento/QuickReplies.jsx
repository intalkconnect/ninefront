import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/QuickReplies.module.css';

/**
 * Página base para "Respostas rápidas" seguindo os mesmos padrões da Preferences
 * Rotas esperadas no back (mount em /quick-replies):
 *  - GET    /quick-replies           → lista [{ id, title, content }]
 *  - POST   /quick-replies           → body { title, content }
 *  - DELETE /quick-replies/:id       → remove
 *
 * Se o mount for diferente, passe a prop apiBase.
 */
const QuickReplies = ({ apiBase = '/quick-replies' }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const toastOK = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 1800); };

  const load = async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await apiGet(apiBase);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErro('Falha ao carregar respostas rápidas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [apiBase]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...items].sort((a,b)=>String(a.title).localeCompare(String(b.title)));
    return items
      .filter((r) => r.title?.toLowerCase().includes(q) || r.content?.toLowerCase().includes(q))
      .sort((a,b)=>String(a.title).localeCompare(String(b.title)));
  }, [items, query]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setErro(null);
    if (!title.trim() || !content.trim()) {
      setErro('Informe título e conteúdo.');
      return;
    }
    try {
      const created = await apiPost(apiBase, { title: title.trim(), content: content.trim() });
      setItems((prev) => [...prev, created].sort((a,b)=>String(a.title).localeCompare(String(b.title))));
      setTitle('');
      setContent('');
      toastOK('Resposta criada.');
    } catch (e) {
      console.error(e);
      setErro('Erro ao criar resposta.');
    }
  };

  const apiDelete = async (url) => {
    // Preferimos usar o mesmo cliente; se seu apiClient tiver apiDelete, substitua aqui.
    const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error((await res.text()) || 'DELETE falhou');
    try { return await res.json(); } catch { return null; }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setErro(null);
    try {
      await apiDelete(`${apiBase}/${id}`);
      setItems((prev) => prev.filter((r) => r.id !== id));
      toastOK('Resposta removida.');
    } catch (e) {
      console.error(e);
      setErro('Erro ao excluir resposta.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (text) => {
    try { await navigator.clipboard.writeText(text || ''); toastOK('Conteúdo copiado.'); }
    catch (e) { console.error(e); setErro('Não foi possível copiar para a área de transferência.'); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Respostas rápidas</h1>
          <p className={styles.subtitle}>Gerencie atalhos de mensagens usadas no atendimento.</p>
          {erro ? <div className={styles.alertErr}>{erro}</div> : null}
          {okMsg ? <div className={styles.alertOk}>{okMsg}</div> : null}
        </div>
      </div>

      {/* Formulário de criação */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Nova resposta</div>
        </div>
        <form onSubmit={handleCreate} className={styles.formGrid}>
          <input
            className={styles.input}
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={styles.textarea}
            rows={4}
            placeholder="Conteúdo"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className={styles.formActions}>
            <button className={styles.btnPrimary} type="submit">Adicionar</button>
          </div>
        </form>
      </div>

      {/* Filtro */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Itens</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input
              className={styles.input}
              placeholder="Buscar por título ou conteúdo"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <span className={styles.keySub}>{filtered.length} itens</span>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Título</th>
                <th>Conteúdo</th>
                <th style={{ width: 160 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={3} className={styles.empty}>Nenhuma resposta encontrada.</td></tr>
              )}

              {!loading && filtered.map((r) => (
                <tr key={r.id}>
                  <td className={styles.cellKey}>
                    <div className={styles.keyTitle}>{r.title}</div>
                    <div className={styles.keySub}>ID: {r.id}</div>
                  </td>
                  <td>
                    <pre className={styles.code} title={r.content} style={{ maxHeight: 160 }}>
{r.content}
                    </pre>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button className={styles.btn} onClick={() => handleCopy(r.content)}>Copiar</button>
                      <button
                        className={styles.btnDanger}
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        title="Remover resposta"
                      >{deletingId === r.id ? 'Removendo…' : 'Remover'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuickReplies;
