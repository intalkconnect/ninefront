import React, { useEffect, useRef, useState } from 'react';
import { Copy, Shield, Plus, Trash2, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import styles from './styles/Tokens.module.css';

// Mostra 8 do segredo + bullets até 64 (não exibe ID)
function shortPreview(preview = '') {
  const parts = String(preview).split('.');
  const secretPart = parts.length > 1 ? parts[1] : parts[0] || '';
  const raw = secretPart.replace(/[^0-9a-f]/gi, ''); // remove possíveis bullets do back
  const first8 = raw.slice(0, 8);
  const bullets = '•'.repeat(Math.max(0, 64 - first8.length)); // segredo padrão: 64 hex
  return `${first8}${bullets}`;
}

export default function TokensSecurity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  // criação
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const nameRef = useRef(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const j = await apiGet('/security/tokens');
      if (!j?.ok) throw new Error('Fail');
      setItems(j.items || []);
    } catch (e) {
      setErr('Falha ao carregar tokens.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const copy = (txt) => {
    navigator.clipboard.writeText(txt);
    setOk('Copiado!');
    setTimeout(()=>setOk(null), 1200);
  };

const createToken = async (e) => {
  if (e?.preventDefault) e.preventDefault();   // evita submit da página
  if (creating) return;

  const name = (newName || '').trim();
  if (!name) {
    setErr('Informe o nome do token.');
    nameRef.current?.focus();
    return;
  }

  setCreating(true); setErr(null); setOk(null);
  try {
    const j = await apiPost('/security/tokens', { name, is_default: false });
    if (!j?.ok) throw new Error(j?.message || 'Falha ao criar token');
    setNewName('');
    await load();
    setOk('Token criado.');
  } catch (e) {
    setErr(e?.response?.data?.message || e?.message || 'Falha ao criar token.');
  } finally {
    setCreating(false);
  }
};


  const revoke = async (id) => {
    if (!id) return;
    if (!confirm('Revogar este token? Esta ação não pode ser desfeita.')) return;
    try {
      const j = await apiPost(`/security/tokens/${id}/revoke`, {});
      if (!j?.ok && !j?.already) throw new Error('Falha ao revogar');
      setOk('Token revogado.');
      await load();
    } catch {
      setErr('Não foi possível revogar o token.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.hLeft}>
          <Shield size={20}/><h1>Segurança — Tokens de API</h1>
        </div>
        <div className={styles.hRight}>
          <button className={styles.btnGhost} onClick={load} disabled={loading}>
            <RefreshCw size={14}/> Recarregar
          </button>
        </div>
      </div>

{err && <div className={styles.alertErr} aria-live="polite">{err}</div>}
{ok  && <div className={styles.alertOk}  aria-live="polite">{ok}</div>}


      {/* criação */}
      <div className={styles.card}>
<form className={styles.row} onSubmit={createToken} noValidate>
  <input
    ref={nameRef}
    className={`${styles.input} ${(!newName.trim() && err) ? styles.inputErr : ''}`}
    placeholder="Nome do token"
    value={newName}
    onChange={(e)=>{ setNewName(e.target.value); if (err) setErr(null); }}
    disabled={creating}
    aria-invalid={!newName.trim() && !!err}
  />
  <button
    type="submit"
    className={styles.btnPrimary}
    disabled={creating || !newName.trim()}
    title={(!newName.trim() ? 'Informe o nome do token' : 'Criar token')}
  >
    <Plus size={16}/> Criar token
  </button>
</form>

      </div>

      {/* lista */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Tokens do workspace</div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Token</th>
                <th>Nome</th>
                <th>Status</th>
                <th>Criado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.map((r) => (
                <tr key={r.id}>
                  <td className={styles.tokenCell}>
                    <code className={styles.code}>{shortPreview(r.preview)}</code>
                  </td>
                  <td>{r.name || '—'}</td>
                  <td>
                    {r.is_default && <span className={styles.badgeOk}>Default</span>}{' '}
                    {r.status === 'revoked'
                      ? <span className={styles.badgeWarn}>Revogado</span>
                      : <span className={styles.badge}>Ativo</span>}
                  </td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—'}</td>
                  <td className={styles.actions}>
                    <button
                      className={styles.btnTiny}
                      onClick={() => copy(shortPreview(r.preview))}
                      title="Copiar token ofuscado"
                    >
                      <Copy size={14}/> Copiar
                    </button>

                    {r.is_default ? (
                      <span className={styles.muted}>Não alterável</span>
                    ) : r.status !== 'revoked' ? (
                      <button className={styles.btnDanger} onClick={() => revoke(r.id)}>
                        <Trash2 size={14}/> Revogar
                      </button>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                </tr>
              ))}

              {loading && <tr><td colSpan={5} className={styles.loading}>Carregando…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={5} className={styles.empty}>Nenhum token criado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
