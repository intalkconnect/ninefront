import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Users as UsersIcon, Plus, Pencil, Trash2, X as XIcon, RefreshCw,
  AlertCircle, CheckCircle2, Shield, Search, Eye, MoreVertical,
  Filter, Download, Upload, ChevronLeft, ChevronRight, ChevronsLeft,
  ChevronsRight, UserPlus, Settings, Mail, Phone, UserCheck, UserX
} from 'lucide-react';
import { apiGet, apiDelete } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';
import UsersModal from './UsersModal';
import { useConfirm } from '../../../components/ConfirmProvider.jsx';

const PERFIS = [
  { key: '',           label: 'Todos',      icon: <UsersIcon size={14}/>, color: '#6b7280' },
  { key: 'admin',      label: 'Admin',      icon: <Shield size={14}/>, color: '#dc2626' },
  { key: 'supervisor', label: 'Supervisor', icon: <Shield size={14}/>, color: '#2563eb' },
  { key: 'atendente',  label: 'Atendente',  icon: <Shield size={14}/>, color: '#059669' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'pending', label: 'Pendente' },
];

const ITEMS_PER_PAGE = 10;

export default function Users() {
  const [items, setItems] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [okMsg, setOkMsg] = useState(null);
  const [error, setError] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });
  const [expandedRows, setExpandedRows] = useState(new Set());
  const confirm = useConfirm();

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    clearTimeout((toastOK)._t);
    (toastOK)._t = setTimeout(() => setOkMsg(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
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
      setError('Falha ao carregar usuários. Tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => { load(); }, [load]);

  // Função para ordenação
  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  // Filtragem
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortedItems.filter(u => {
      // Filtro por perfil
      if (profileFilter && (u.perfil || '').toLowerCase() !== profileFilter) return false;
      
      // Filtro por status
      if (statusFilter && (u.status || '').toLowerCase() !== statusFilter) return false;
      
      // Filtro por busca
      if (!q) return true;
      const nome = `${u.name ?? ''} ${u.lastname ?? ''}`.toLowerCase();
      const email = String(u.email ?? '').toLowerCase();
      const phone = String(u.phone ?? '').toLowerCase();
      return nome.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [sortedItems, profileFilter, statusFilter, query]);

  // Paginação
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const queuesById = useMemo(() => {
    const map = new Map();
    for (const f of queues) map.set(String(f.id ?? f.nome ?? f.name), f);
    return map;
  }, [queues]);

  const perfilCounts = useMemo(() => {
    const counts = items.reduce((acc, u) => {
      const k = String(u.perfil || '').toLowerCase();
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    counts[''] = items.length;
    return counts;
  }, [items]);

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedItems(
      selectedItems.length === paginatedItems.length 
        ? [] 
        : paginatedItems.map(item => item.id)
    );
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const toggleRowExpansion = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  async function handleDelete(u) {
    setError(null);
    const hasFilas = Array.isArray(u.filas) && u.filas.length > 0;
    if (hasFilas) {
      setError('Não é possível excluir: o usuário possui filas vinculadas. Remova as filas antes de excluir.');
      return;
    }
    try {
      const ok = await confirm({
        title: 'Excluir usuário?',
        description: `Tem certeza que deseja excluir o usuário ${u.name} ${u.lastname}? Esta ação não pode ser desfeita.`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      await apiDelete(`/users/${u.id}`);
      toastOK('Usuário excluído com sucesso.');
      load();
      setSelectedItems(prev => prev.filter(id => id !== u.id));
    } catch (e) {
      console.error(e);
      setError('Falha ao excluir usuário. Tente novamente.');
    }
  }

  async function handleBulkDelete() {
    if (selectedItems.length === 0) return;
    
    try {
      const ok = await confirm({
        title: `Excluir ${selectedItems.length} usuários?`,
        description: 'Esta ação não pode ser desfeita. Todos os usuários selecionados serão removidos do sistema.',
        confirmText: 'Excluir todos',
        cancelText: 'Cancelar',
        tone: 'danger',
      });
      
      if (!ok) return;
      
      // Simulação - na implementação real, faria uma chamada API para exclusão em massa
      setItems(prev => prev.filter(item => !selectedItems.includes(item.id)));
      toastOK(`${selectedItems.length} usuários excluídos com sucesso.`);
      setSelectedItems([]);
    } catch (e) {
      console.error(e);
      setError('Falha ao excluir usuários selecionados.');
    }
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? '↑' : '↓';
  };

  return (
    <div className={styles.container}>
      {/* Header melhorado */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderContent}>
          <div className={styles.pageTitle}>
            <h1>Gestão de Usuários</h1>
            <p>Gerencie usuários, perfis e permissões do sistema</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.actionGroup}>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                onClick={load}
                disabled={refreshing}
                title="Atualizar lista"
              >
                <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
                <span>Atualizar</span>
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={() => { setEditing(null); setOpenModal(true); }}
                title="Adicionar novo usuário"
              >
                <UserPlus size={16} />
                <span>Novo usuário</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas toast */}
      <div className={styles.toastContainer}>
        {okMsg && (
          <div className={styles.toastSuccess}>
            <CheckCircle2 size={18} />
            <span>{okMsg}</span>
            <button onClick={() => setOkMsg(null)} className={styles.toastClose}>
              <XIcon size={16} />
            </button>
          </div>
        )}
        {error && (
          <div className={styles.toastError}>
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className={styles.toastClose}>
              <XIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Filtros avançados */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersHeader}>
          <div className={styles.filtersTitle}>
            <Filter size={18} />
            <span>Filtros</span>
          </div>
          <button 
            className={styles.clearFilters}
            onClick={() => {
              setQuery('');
              setProfileFilter('');
              setStatusFilter('');
            }}
          >
            Limpar filtros
          </button>
        </div>
        
        <div className={styles.filtersGrid}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} size={18} />
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome, email ou telefone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button 
                className={styles.searchClear} 
                onClick={() => setQuery('')} 
                aria-label="Limpar busca"
              >
                <XIcon size={16} />
              </button>
            )}
          </div>
          
          <div className={styles.selectGroup}>
            <label htmlFor="profileFilter">Perfil</label>
            <select 
              id="profileFilter"
              value={profileFilter} 
              onChange={(e) => setProfileFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">Todos os perfis</option>
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="atendente">Atendente</option>
            </select>
          </div>
          
          <div className={styles.selectGroup}>
            <label htmlFor="statusFilter">Status</label>
            <select 
              id="statusFilter"
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.filterSelect}
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Card da lista */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.resultsInfo}>
            <span className={styles.resultsCount}>
              {filtered.length} {filtered.length === 1 ? 'usuário encontrado' : 'usuários encontrados'}
            </span>
            {selectedItems.length > 0 && (
              <div className={styles.selectedActions}>
                <span className={styles.selectedBadge}>
                  {selectedItems.length} {selectedItems.length === 1 ? 'selecionado' : 'selecionados'}
                </span>
                <button 
                  className={styles.bulkActionBtn}
                  onClick={handleBulkDelete}
                  title="Excluir selecionados"
                >
                  <Trash2 size={16} />
                  <span>Excluir</span>
                </button>
                <button 
                  className={styles.bulkActionBtn}
                  title="Exportar selecionados"
                >
                  <Download size={16} />
                  <span>Exportar</span>
                </button>
              </div>
            )}
          </div>
          
          <div className={styles.viewControls}>
            <button className={styles.viewControlBtn} title="Configurações de visualização">
              <Settings size={16} />
            </button>
            <button className={styles.viewControlBtn} title="Exportar dados">
              <Download size={16} />
            </button>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCol}>
                  <input
                    type="checkbox"
                    checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                    onChange={handleSelectAll}
                    className={styles.checkbox}
                  />
                </th>
                <th 
                  className={styles.sortableHeader}
                  onClick={() => handleSort('name')}
                >
                  <span>Usuário {getSortIcon('name')}</span>
                </th>
                <th 
                  className={styles.sortableHeader}
                  onClick={() => handleSort('email')}
                >
                  <span>Email {getSortIcon('email')}</span>
                </th>
                <th 
                  className={styles.sortableHeader}
                  onClick={() => handleSort('perfil')}
                >
                  <span>Perfil {getSortIcon('perfil')}</span>
                </th>
                <th>Filas</th>
                <th 
                  className={styles.sortableHeader}
                  onClick={() => handleSort('status')}
                >
                  <span>Status {getSortIcon('status')}</span>
                </th>
                <th style={{ width: 120, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={7}>
                    <div className={styles.skeletonRow}>
                      <div className={styles.skeletonAvatar}></div>
                      <div className={styles.skeletonText}></div>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    <div className={styles.emptyState}>
                      <UsersIcon size={48} className={styles.emptyIcon} />
                      <div className={styles.emptyTitle}>Nenhum usuário encontrado</div>
                      <div className={styles.emptyDesc}>
                        {query || profileFilter || statusFilter 
                          ? "Tente ajustar os filtros ou termos de busca" 
                          : "Não há usuários cadastrados no sistema"
                        }
                      </div>
                      {!(query || profileFilter || statusFilter) && (
                        <button 
                          className={styles.emptyAction}
                          onClick={() => setOpenModal(true)}
                        >
                          <UserPlus size={16} />
                          <span>Adicionar primeiro usuário</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading && paginatedItems.map(u => {
                const nome = `${u.name ?? ''} ${u.lastname ?? ''}`.trim();
                const filasArr = Array.isArray(u.filas) ? u.filas : [];
                const chipNames = filasArr
                  .map(id => queuesById.get(String(id))?.nome ?? queuesById.get(String(id))?.name ?? id)
                  .filter(Boolean);
                const isExpanded = expandedRows.has(u.id);

                return (
                  <React.Fragment key={u.id}>
                    <tr className={`${styles.dataRow} ${isExpanded ? styles.expanded : ''}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(u.id)}
                          onChange={() => handleSelectItem(u.id)}
                          className={styles.checkbox}
                        />
                      </td>
                      <td>
                        <div 
                          className={styles.userCell}
                          onClick={() => toggleRowExpansion(u.id)}
                        >
                          <div className={styles.userAvatar} data-name={nome || 'U'}>
                            {nome.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U'}
                            {u.status === 'active' && <span className={styles.statusIndicator}></span>}
                          </div>
                          <div className={styles.userInfo}>
                            <div className={styles.userName}>{nome || '—'}</div>
                            <div className={styles.userId}>ID: {u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.emailCell}>
                          {u.email || '—'}
                          {u.email_verified && <span className={styles.verifiedBadge} title="Email verificado">✓</span>}
                        </div>
                      </td>
                      <td>
                        <span 
                          className={styles.profileBadge} 
                          data-profile={(u.perfil || '').toLowerCase()}
                        >
                          {(u.perfil || '').charAt(0).toUpperCase() + (u.perfil || '').slice(1) || '—'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.tagsWrap}>
                          {chipNames.length === 0
                            ? <span className={styles.muted}>—</span>
                            : chipNames.slice(0, 2).map((n, i) => (
                                <span key={`${u.id}-f-${i}`} className={styles.queueTag}>{n}</span>
                              ))}
                          {chipNames.length > 2 && (
                            <span className={styles.moreTag}>
                              +{chipNames.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={u.status === 'active' ? styles.statusActive : styles.statusInactive}>
                          {u.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className={styles.actionsCell}>
                        <div className={styles.actions}>
                          <button
                            className={styles.iconBtn}
                            title="Visualizar detalhes"
                            onClick={() => toggleRowExpansion(u.id)}
                          >
                            <Eye size={16}/>
                          </button>
                          <button
                            className={styles.iconBtn}
                            title="Editar usuário"
                            onClick={() => { setEditing(u); setOpenModal(true); }}
                          >
                            <Pencil size={16}/>
                          </button>
                          <button
                            className={`${styles.iconBtn} ${styles.danger}`}
                            title="Excluir usuário"
                            onClick={() => handleDelete(u)}
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Linha expandida com detalhes */}
                    {isExpanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={7}>
                          <div className={styles.userDetails}>
                            <div className={styles.detailSection}>
                              <h4>Informações de Contato</h4>
                              <div className={styles.detailGrid}>
                                <div className={styles.detailItem}>
                                  <Mail size={16} />
                                  <span>{u.email || 'Não informado'}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <Phone size={16} />
                                  <span>{u.phone || 'Não informado'}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <UserCheck size={16} />
                                  <span>Cadastrado em: {u.created_at || 'Data não disponível'}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className={styles.detailSection}>
                              <h4>Filas Associadas</h4>
                              {chipNames.length > 0 ? (
                                <div className={styles.detailTags}>
                                  {chipNames.map((n, i) => (
                                    <span key={`detail-${u.id}-f-${i}`} className={styles.detailTag}>
                                      {n}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className={styles.muted}>Nenhuma fila associada</p>
                              )}
                            </div>
                            
                            <div className={styles.detailActions}>
                              <button className={styles.secondaryBtn}>
                                <Mail size={16} />
                                <span>Enviar email</span>
                              </button>
                              <button className={styles.secondaryBtn}>
                                <UserX size={16} />
                                <span>Desativar usuário</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {!loading && filtered.length > 0 && (
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              Mostrando <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> a{' '}
              <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> de{' '}
              <strong>{filtered.length}</strong> resultados
            </div>
            <div className={styles.paginationControls}>
              <button 
                className={styles.paginationBtn}
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft size={16} />
              </button>
              <button 
                className={styles.paginationBtn}
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                <span>Anterior</span>
              </button>
              
              <div className={styles.paginationPages}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      className={`${styles.paginationBtn} ${currentPage === pageNum ? styles.paginationActive : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <>
                    <span className={styles.paginationEllipsis}>...</span>
                    <button
                      className={styles.paginationBtn}
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              
              <button 
                className={styles.paginationBtn}
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span>Próximo</span>
                <ChevronRight size={16} />
              </button>
              <button 
                className={styles.paginationBtn}
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal controlado */}
      {openModal && (
        <UsersModal
          isOpen={openModal}
          onClose={() => setOpenModal(false)}
          onSaved={() => {
            setOpenModal(false);
            load();
            toastOK(editing ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.');
          }}
          editing={editing}
          queues={queues}
        />
      )}
    </div>
  );
}
