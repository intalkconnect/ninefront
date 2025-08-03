import React, { useState, useEffect } from 'react';
import { Mail, Phone, IdCard, IdCardLanyard } from 'lucide-react';
import './DetailsPanel.css';
import { stringToColor } from '../../utils/color';

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  useEffect(() => {
    setComentario('');
  }, [userIdSelecionado]);

  if (!userIdSelecionado) {
    return (
      <div className="details-panel-container">
        <p className="loading">Nenhum cliente selecionado</p>
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

  const nome = conversaSelecionada.name || 'Não identificado';
  const inicial = nome.charAt(0).toUpperCase();
  const documento = conversaSelecionada.documento;
  const isLoading = !documento && !conversaSelecionada.email;

  const history = conversaSelecionada.ticket_history || [];

  return (
    <div className="details-panel-container">
      <div className="informacoes-content">
        <div className="circle-initial-box">
          <div
            className="circle-initial"
            style={{ backgroundColor: stringToColor(nome) }}
          >
            {inicial}
          </div>
        </div>

        <h4 className="name-label">{nome}</h4>

        <div className="info-row">
          <Mail size={16} className="info-icon" />
          <span className="info-value">
            {isLoading ? <span className="skeleton skeleton-text" /> : (conversaSelecionada.email || 'Não informado')}
          </span>
        </div>

        <div className="info-row">
          <Phone size={16} className="info-icon" />
          <span className="info-value">
            {isLoading ? <span className="skeleton skeleton-text" /> : (conversaSelecionada.phone || 'Não informado')}
          </span>
        </div>

        <div className="info-row">
          <IdCard size={16} className="info-icon" />
          <span className="info-value">
            {isLoading ? <span className="skeleton skeleton-text" /> : (documento || 'Não informado')}
          </span>
        </div>

        <div className="info-row">
          <IdCardLanyard size={16} className="info-icon" />
          <span className="info-value">
            {isLoading ? <span className="skeleton skeleton-text" /> : conversaSelecionada.user_id}
          </span>
        </div>
      </div>

      <div className="historico-content">
        <h4 className="card-title">Histórico</h4>
        {history.length === 0 ? (
          <p className="loading">Nenhum histórico de tickets encontrado.</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}
