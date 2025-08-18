import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import {
  Save, Plus, RefreshCcw, Search, Edit2, X, Check, Copy, Info
} from 'lucide-react';
import styles from './Settings.module.css';

/* Utils */
const fmtDate = (v) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('pt-BR');
  } catch {
    return String(v);
  }
};
const stringifyMaybe = (v) => {
  try {
    if (v !== null && typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v ?? '');
  } catch {
    return String(v ?? '');
  }
};
const parseIfJson = (txt) => JSON.parse(txt);

/* Página */
const Settings = () => {
  const [items, setItems] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // Form
  const [editKey, setEditKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [sendAsJson, setSendAsJson] = useState(false);
  const [jsonValido, setJsonValido] = useState(true);

  // Aux: valida JSON quando ativo
  useEffect(() => {
    if (!sendAsJson) { setJsonValido(true); return; }
    try {
      parseIfJson(value || 'null');
      setJsonValido(true);
    } catch {
      setJsonValido(false);
    }
  }, [sendAsJson, value]);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await apiGet('/settings');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErro('Falha ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const limparForm = () => {
    setEditKey('');
    setValue('');
    setDescription('');
    setSendAsJson(false);
    setJsonValido(true);
    setErro(null);
    setOkMsg(null);
  };

  const onEditar = (row) => {
    setEditKey(row['key']);
    setValue(stringifyMaybe(row.value));
    setDescription(row.description ?? '');
    // liga JSON automaticamente se o value da API veio como objeto/array
    setSendAsJson(row && row.value !== null && typeof row.value === 'object');
    setOkMsg(null);
    setErro(null);
  };

  const onSalvar = async (e) => {
    e.preventDefault();
    setErro(null);
    setOkMsg(null);
    if (!editKey) {
      setErro('Informe a chave (key).');
      return;
    }
    if (sendAsJson && !jsonValido) {
      setErro('JSON inválido. Corrija o value ou desative "Enviar como JSON".');
      return;
    }

    let payloadValue = value;
    if (sendAsJson) {
      try {
        payloadValue = value === '' ? null : JSON.parse(value);
      } catch (err) {
        setErro('JSON inválido.');
        return;
      }
    }

    try {
      const saved = await apiPost('/settings', {
        key: editKey,
        value: payloadValue,
        description: description || null,
      });
      setOkMsg(`Configuração "${saved?.key ?? editKey}" salva.`);
      await carregar();
      // mantém no form (edição contínua). Se quiser limpar, chame limparForm();
    } catch (e2) {
      console.error(e2);
      setErro('Erro ao salvar configuração.');
    }
  };

  const filtrados = useMemo(() => {
    const q = (busca || '').toLowerCase().trim();
    if (!q) return items;
    return items.filter((r) => {
      const k = String(r['key'] ?? '').toLowerCase();
      const d = String(r.description ?? '').toLowerCase();
      const v = stringifyMaybe(r.value).toLowerCase();
      return k.includes(q) || d.includes(q) || v.includes(q);
    });
  }, [items, busca]);

  const copiar = async (txt) => {
    try {
      await navigator.clipboard.writeText(txt);
      setOkMsg('Valor copiado para a área de transferência.');
      setTimeout(() => setOkMsg(null), 1500);
    } catch {
      setErro('Não foi possível copiar.');
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Gerencie chaves de configuração do sistema</p>
          {erro ? <div className={styles.alertErr}>{erro}</div> : null}
          {okMsg ? <div className={styles.alertOk}>{okMsg}</div> : null}
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              placeholder="Buscar por key, descrição ou valor…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <button className={styles.btnGhost} onClick={carregar} title="Recarregar">
            <RefreshCcw size={16} /> Recarregar
          </button>
        </div>
      </div>

      {/* Formulário */}
      <form className={styles.form} onSubmit={onSalvar}>
        <div className={styles.formRow}>
          <label>Key <span className={styles.req}>*</span></label>
          <input
            className={styles.input}
            placeholder="ex.: feature.toggle.novoFluxo"
            value={editKey}
            onChange={(e) => setEditKey(e.target.value)}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.inlineLabel}>
            Value <span className={styles.req}>*</span>
            <span className={styles.help} title="Se ativado, enviaremos o value como JSON (objeto/array/boolean/number/null). Se desativado, enviaremos como texto.">
              <Info size={14} />
            </span>
          </label>
          <textarea
            className={`${styles.textarea} ${sendAsJson && !jsonValido ? styles.textareaErr : ''}`}
            placeholder={sendAsJson ? '{ "ativo": true }' : 'texto ou número como string'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={sendAsJson ? 8 : 4}
          />
          <div className={styles.rowBetween}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={sendAsJson}
                onChange={(e) => setSendAsJson(e.target.checked)}
              />
              Enviar como JSON
            </label>
            {sendAsJson ? (
              <span className={jsonValido ? styles.badgeOk : styles.badgeErr}>
                {jsonValido ? <><Check size={12}/> JSON válido</> : <><X size={12}/> JSON inválido</>}
              </span>
            ) : (
              <span className={styles.badgeMuted}>Texto</span>
            )}
          </div>
        </div>

        <div className={styles.formRow}>
          <label>Descrição</label>
          <input
            className={styles.input}
            placeholder="(opcional) descreva a finalidade da chave"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.btnGhost} onClick={limparForm}>
            <X size={16} /> Limpar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={!editKey || (sendAsJson && !jsonValido)}>
            <Save size={16} /> Salvar / Atualizar
          </button>
        </div>
      </form>

      {/* Tabela */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}><Plus size={16}/> Configurações</div>
          <div className={styles.cardHint}>
            {loading ? 'Carregando…' : `${filtrados.length} registro(s)`}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{minWidth: 220}}>Key</th>
                <th>Valor</th>
                <th style={{minWidth: 220}}>Descrição</th>
                <th style={{minWidth: 150}}>Atualizado em</th>
                <th style={{width: 140}}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((row) => {
                const rowKey = row['key'];
                const raw = row.value;
                const isObj = raw !== null && typeof raw === 'object';
                const display = stringifyMaybe(raw);
                return (
                  <tr key={rowKey}>
                    <td className={styles.cellKey}>
                      <div className={styles.keyText} title={rowKey}>{rowKey}</div>
                    </td>
                    <td>
                      <pre className={`${styles.code} ${isObj ? styles.codeJson : ''}`} title={display}>
{display}
                      </pre>
                    </td>
                    <td className={styles.cellDesc}>{row.description ?? '—'}</td>
                    <td>{fmtDate(row.updated_at)}</td>
                    <td className={styles.cellActions}>
                      <button className={styles.btnTiny} onClick={() => onEditar(row)} title="Editar">
                        <Edit2 size={14}/> Editar
                      </button>
                      <button className={styles.btnTiny} onClick={() => copiar(display)} title="Copiar valor">
                        <Copy size={14}/> Copiar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {(!loading && filtrados.length === 0) && (
                <tr>
                  <td colSpan={5} className={styles.empty}>Nenhuma configuração encontrada.</td>
                </tr>
              )}
              {loading && (
                <tr><td colSpan={5} className={styles.loading}>Carregando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Settings;
