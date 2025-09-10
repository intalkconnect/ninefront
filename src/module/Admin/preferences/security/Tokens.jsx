import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Shield, Plus, Trash2, Star, StarOff, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import styles from './styles/Tokens.module.css';

function mask(s) { return s || '—'; }

// Mantém o ID completo e só 8 chars do segredo após o ponto
// Mostra apenas os 8 primeiros chars do SEGREDO (parte após o ponto)
function shortPreview(preview = '') {
  const parts = String(preview).split('.');
  const secretPart = parts.length > 1 ? parts[1] : parts[0] || '';
  const first8 = secretPart.slice(0, 8);
  return `${first8}••••`; // só 8 chars do segredo + ellipsis de segurança
}



export default function TokensSecurity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  // criação
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState(null); // { id, token }

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

  const copy = (txt) => { navigator.clipboard.writeText(txt); setOk('Copiado!'); setTimeout(()=>setOk(null), 1200); };

  const createToken = async () => {
    if (creating) return;
    setCreating(true); setErr(null); setOk(null);
    try {
      const j = await apiPost('/security/tokens', { name: newName || null, is_default: false });
      if (!j?.ok) throw new Error('Falha ao criar token');
      setJustCreated({ id: j.id, token: j.token });
      setNewName('');
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
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

  const setDefault = async (id) => {
    try {
      const j = await apiPost(`/security/tokens/${id}/set-default`, {});
      if (!j?.ok) throw new Error('Falha ao definir padrão');
      setOk('Token definido como padrão.');
      await load();
    } catch {
      setErr('Não foi possível definir como padrão.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.hLeft}>
          <Shield size={20}/><h1>Segurança — Tokens de API</h1>
        </div>
        <div className={styles.hRight}>
          <button className={styles.btnGhost} onClick={load} disabled={loading}><RefreshCw size={14}/> Recarregar</button>
        </div>
      </div>

      {err && <div className={styles.alertErr}>{err}</div>}
      {ok &&  <div className={styles.alertOk}>{ok}</div>}

      {/* criação */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Emitir novo token</div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.row}>
            <input
              className={styles.input}
              placeholder="Nome do token (opcional)"
              value={newName}
              onChange={(e)=>setNewName(e.target.value)}
              disabled={creating}
            />
            <button className={styles.btnPrimary} onClick={createToken} disabled={creating}>
              <Plus size={16}/> Criar token
            </button>
          </div>

          {justCreated?.token && (
            <div className={styles.notice}>
              <div className={styles.noticeTitle}>Token criado — copie agora</div>
              <div className={styles.tokenBox}>
                <code className={styles.tokenValue}>{justCreated.token}</code>
                <button className={styles.btnTiny} onClick={()=>copy(justCreated.token)}><Copy size={14}/> Copiar</button>
              </div>
              <div className={styles.noticeHelp}>Este valor será exibido apenas uma vez.</div>
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
  {!loading && items.map((r)=>(
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
        {r.is_default ? (
          <span className={styles.muted}>Não alterável</span>
        ) : r.status !== 'revoked' ? (
          <button className={styles.btnDanger} onClick={()=>revoke(r.id)}>Revogar</button>
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
