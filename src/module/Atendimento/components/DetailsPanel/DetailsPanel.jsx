import React from 'react';
import { Mail, Phone, IdCard, IdCardLanyard } from 'lucide-react';
import './DetailsPanel.css';
import { stringToColor } from '../../utils/color';

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  if (!userIdSelecionado || !conversaSelecionada) {
    return (
<div class="card painel-vazio">
  <h2 class="card-title">Informações</h2>
  <div class="conteudo-vazio">
    <p class="mensagem-vazia">Nenhum cliente selecionado.</p>
    <p class="submensagem-vazia">Selecione um cliente na lista para exibir os dados.</p>
  </div>
</div>


    );
  }

  const nome = conversaSelecionada.name || 'Não identificado';
  const inicial = nome.charAt(0).toUpperCase();
  const documento = conversaSelecionada.documento;

  return (
    <div className="details-panel-container full-layout">
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

      {/* Histórico ocupando o restante */}
      <div className="card historico-card">
        <h4 className="card-title">Histórico</h4>
        <div className="historico-content">
          <p className="sem-historico">Sem histórico encontrado</p>
        </div>
      </div>
    </div>
  );
}
