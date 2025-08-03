import React from 'react';
import { Mail, Phone, IdCard, IdCardLanyard } from 'lucide-react';
import './DetailsPanel.css';
import { stringToColor } from '../../utils/color';

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  if (!userIdSelecionado || !conversaSelecionada) {
    return (
      <div className="details-panel-container">
        <p className="loading">Nenhum cliente selecionado</p>
      </div>
    );
  }

  const nome = conversaSelecionada.name || 'Não identificado';
  const inicial = nome.charAt(0).toUpperCase();
  const documento = conversaSelecionada.documento;

  return (
    <div className="details-panel-container">
      <h3 className="panel-title">Dados do Contato</h3>

      <div className="cards-container">
        {/* Card: Informações de Contato */}
        <div className="card info-card">
          <h4 className="card-title">Informações de Contato</h4>
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
            <span className="info-value">{conversaSelecionada.email || 'Não informado'}</span>
          </div>

          <div className="info-row">
            <Phone size={16} className="info-icon" />
            <span className="info-value">{conversaSelecionada.phone || 'Não informado'}</span>
          </div>

          <div className="info-row">
            <IdCard size={16} className="info-icon" />
            <span className="info-value">{documento || 'Não informado'}</span>
          </div>

          <div className="info-row">
            <IdCardLanyard size={16} className="info-icon" />
            <span className="info-value">{conversaSelecionada.user_id || 'Não informado'}</span>
          </div>
        </div>

        {/* Área de Histórico (placeholder visual) */}
        <div className="card historico-card">
          <h4 className="card-title">Histórico</h4>
          <p className="historico-msg">historico</p>
        </div>
      </div>
    </div>
  );
}
