// src/components
import React, { useState, useEffect } from 'react';
import { FaUser, FaPhone, FaEnvelope, FaIdCard } from 'react-icons/fa';
import './DetailsPanel.css';

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [activeTab, setActiveTab] = useState('informacoes');
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    setActiveTab('informacoes');
    setComentario('');
  }, [userIdSelecionado]);

  if (!userIdSelecionado) {
    return (
      <div className="details-panel-container">
        <p className="loading">Selecione um usuário</p>
      </div>
    );
  }

  if (!conversaSelecionada) {
    return (
      <div className="details-panel-container">
        <p className="loading">Sem dados de conversa</p>
      </div>
    );
  }

  // ─── Aba “Informações” ───
 import { FaUser, FaPhone, FaEnvelope, FaIdCard } from 'react-icons/fa';

const renderInformacoes = () => {
  const nome = conversaSelecionada.name || '';
  const inicial = nome.charAt(0).toUpperCase();

  return (
    <div className="informacoes-content">
      {/* Avatar e nome */}
      <div className="avatar-header">
        <div className="avatar-circle">{inicial}</div>
        <div className="avatar-name">{nome}</div>
      </div>

      {/* Card de informações */}
      <div className="card info-card">
        <h4 className="card-title">Informações do Contato</h4>

        {conversaSelecionada.name && (
          <div className="info-row">
            <FaUser className="info-icon" />
            <div className="info-label">Nome</div>
            <div className="info-value">{conversaSelecionada.name}</div>
          </div>
        )}

        {conversaSelecionada.phone && (
          <div className="info-row">
            <FaPhone className="info-icon" />
            <div className="info-label">Telefone</div>
            <div className="info-value">{conversaSelecionada.phone}</div>
          </div>
        )}

        {conversaSelecionada.email && (
          <div className="info-row">
            <FaEnvelope className="info-icon" />
            <div className="info-label">E-mail</div>
            <div className="info-value">{conversaSelecionada.email}</div>
          </div>
        )}

        {conversaSelecionada.documento && (
          <div className="info-row">
            <FaIdCard className="info-icon" />
            <div className="info-label">Documento</div>
            <div className="info-value">{conversaSelecionada.documento}</div>
          </div>
        )}
      </div>

      {/* Comentários */}
      <div className="card comentario-card">
        <h4 className="card-title">Comentários</h4>
        <textarea
          className="comentario-textarea"
          placeholder="Escreva um comentário sobre este contato..."
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <button
          className="btn-enviar-comentario"
          onClick={() => {
            if (!comentario.trim()) return;
            alert('Comentário enviado: ' + comentario.trim());
            setComentario('');
          }}
        >
          Enviar comentário
        </button>
      </div>
    </div>
  );
};


  // ─── Aba “Histórico” ───
  const renderHistorico = () => {
    const history = conversaSelecionada.ticket_history || [];

    if (history.length === 0) {
      return (
        <div className="historico-content">
          <p className="loading">Nenhum histórico de tickets encontrado.</p>
        </div>
      );
    }

    return (
      <ul className="historico-list">
        {history.map((ticket, idx) => {
          const key = ticket.id ?? idx;
          return (
            <li key={key} className="historico-item">
              <div className="card ticket-card">
                <h5 className="ticket-title">{ticket.titulo}</h5>
                <div className="ticket-field">
                  <strong>Status:</strong> {ticket.status}
                </div>
                <div className="ticket-field">
                  <strong>Data:</strong>{' '}
                  {new Date(ticket.data).toLocaleDateString()}
                </div>
                {ticket.descricao && (
                  <div className="ticket-field">
                    <strong>Descrição:</strong> {ticket.descricao}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="details-panel-container">
      <h3 className="panel-title">Dados do Contato</h3>

      {/* Botões de Abas */}
      <div className="tabs-container">
        <button
          className={`tab-button ${
            activeTab === 'informacoes' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('informacoes')}
        >
          Informações
        </button>
        <button
          className={`tab-button ${activeTab === 'historico' ? 'active' : ''}`}
          onClick={() => setActiveTab('historico')}
        >
          Histórico
        </button>
      </div>

      {/* Conteúdo da aba selecionada */}
      <div className="tab-content">
        {activeTab === 'informacoes' && renderInformacoes()}
        {activeTab === 'historico' && renderHistorico()}
      </div>
    </div>
  );
}
