import React, { useState, useEffect } from 'react';
import { Mail, Phone, IdCard, MapPin } from 'lucide-react';
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

  const nome = conversaSelecionada.name || 'Usuário';
  const inicial = nome.charAt(0).toUpperCase();

  const renderInformacoes = () => {
    return (
      <div className="informacoes-content">
        <div className="circle-initial-box">
          <div className="circle-initial">{inicial}</div>
        </div>
        <h4 className="name-label">{nome}</h4>

        <div className="info-row">
          <Mail size={16} className="info-icon" />
          <span className="info-value">{conversaSelecionada.email || 'Não informado'}</span>
        </div>

        <div className="info-row">
          <Phone size={16} className="info-icon" />
          <span className="info-value">{conversaSelecionada.phone || 'Não informado'}</span>
        </div>

        {conversaSelecionada.documento && (
          <div className="info-row">
            <IdCard size={16} className="info-icon" />
            <span className="info-value">{conversaSelecionada.documento}</span>
          </div>
        )}

        {conversaSelecionada.localizacao && (
          <div className="info-row">
            <MapPin size={16} className="info-icon" />
            <span className="info-value">{conversaSelecionada.localizacao}</span>
          </div>
        )}

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
                  <strong>Data:</strong> {new Date(ticket.data).toLocaleDateString()}
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
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'informacoes' ? 'active' : ''}`}
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
      <div className="tab-content">
        {activeTab === 'informacoes' && renderInformacoes()}
        {activeTab === 'historico' && renderHistorico()}
      </div>
    </div>
  );
}
