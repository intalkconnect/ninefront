import React, { useEffect, useRef, useState } from 'react';
import { Shield, Plus, Trash2, RefreshCw, Copy } from 'lucide-react';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import styles from './styles/Tokens.module.css';

// Prévia: 8 primeiros do segredo + bullets até 64 (não exibe ID)
function shortPreview(preview = '') {
  const parts = String(preview).split('.');
  const secretPart = parts.length > 1 ? parts[1] : parts[0] || '';
  const raw = secretPart.replace(/[^0-9a-f]/gi, '');
  const first8 = raw.slice(0, 8);
  const bullets = '•'.repeat(Math.max(0, 64 - first8.length));
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

  // aviso de token recém-criado (exibe COMPLETO só aqui)
  const [justCreated, setJustCreated] = useState(null); // { id, token, name? }

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

  const copyToClipboard = (txt) => {
    navigator.clipboard.writeText(txt);
    setOk('Copiado!');
    setTimeout(() => setOk(null), 1200);
  };

  const createToken = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (creating) return;

    const name = (newName || '').trim();
    if (!name) {
      setErr('Informe o nome do token.');
      nameRef.current?.focus();
      return;
    }

    setCreating(true); setErr(null); setOk(null);
    try {
      // o backend deve retornar { ok: true, id, token } onde token é o VALOR COMPLETO
      const j = await apiPost('/security/tokens', { name, is_default: false });
      if (!j?.ok || !j?.token) throw new Error(j?.message || 'Falha ao criar token');

      setJustCreated({ id: j.id, token: j.token, name });
      setNewName('');
      await load();
      setOk('Token criado. Copie agora — ele não será mostrado novamente.');
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

      {/* criar novo */}
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <form className={styles.createInline} onSubmit={createToken} noValidate>
            <div className={styles.fieldCompact}>
              <input
                ref={nameRef}
                className={`${styles.input} ${(!newName.trim() && err === 'Informe o nome do token.') ? styles.inputErr : ''}`}
                placeholder="Nome do token"
                value={newName}
                onChange={(e)=>{ setNewName(e.target.value); if (err) setErr(null); }}
                disabled={creating}
                aria-invalid={!newName.trim() && err === 'Informe o nome do token.'}
              />
            </div>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={creating || !newName.trim()}
              title={(!newName.trim() ? 'Informe o nome do token' : 'Criar token')}
            >
              <Plus size={16}/> Criar token
            </button>
          </form>

          {/* aviso: exibe o token COMPLETO apenas após criar */}
          {justCreated?.token && (
            <div className={styles.notice} role="status" aria-live="polite">
              <div className={styles.noticeTitle}>
                Token criado {justCreated.name ? `(${justCreated.name})` : ''} — copie agora
              </div>
              <div className={styles.tokenBox}>
                <code className={styles.tokenValue}>{justCreated.token}</code>
                <button
                  type="button"
                  className={styles.btnTiny}
                  onClick={()=>copyToClipboard(justCreated.token)}
                  title="Copiar token completo"
                >
                  <Copy size={14}/> Copiar
                </button>
              </div>
              <div className={styles.noticeHelp}>
                Por segurança, o valor completo do token não será exibido novamente.
              </div>
            </div>
          )}
        </div>
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
                    {/* Sem copiar aqui — apenas revogar quando não for default */}
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
