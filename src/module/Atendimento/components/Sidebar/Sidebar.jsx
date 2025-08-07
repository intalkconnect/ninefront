import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "../../services/apiClient";
import { File, Mic, User, Circle, LogOut, Timer } from "lucide-react";
import useConversationsStore from "../../store/useConversationsStore";
import LogoutButton from '../../../components/LogoutButton';
import { stringToColor } from '../../utils/color';
import { getRelativeTime } from '../../utils/time';

import "./Sidebar.css";

export default function Sidebar() {
  const conversations = useConversationsStore((state) => state.conversations);
  const unreadCounts = useConversationsStore((state) => state.unreadCounts);
  const userEmail = useConversationsStore((state) => state.userEmail);
  const userFilas = useConversationsStore((state) => state.userFilas);
  const selectedUserId = useConversationsStore((state) => state.selectedUserId);
  const setSelectedUserId = useConversationsStore(
    (state) => state.setSelectedUserId
  );
  const mergeConversation = useConversationsStore(
    (state) => state.mergeConversation
  );
  const setSettings = useConversationsStore((state) => state.setSettings);
  const [ordemAscendente, setOrdemAscendente] = useState(false); // false = mais novo primeiro

  const [distribuicaoTickets, setDistribuicaoTickets] = useState("manual");
  const [filaCount, setFilaCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("online"); // 'online' | 'offline' | 'pausado'

  const fetchSettingsAndFila = async () => {
    try {
      const settings = await apiGet("/settings");
      const distrib = settings.find((s) => s.key === "distribuicao_tickets");
      if (distrib?.value) setDistribuicaoTickets(distrib.value);
      setSettings(settings);

      if (!userFilas || userFilas.length === 0) return;

      const params = new URLSearchParams({ filas: userFilas.join(",") });
      const data = await apiGet(`/chats/fila?${params.toString()}`);
      setFilaCount(data.length);
    } catch (err) {
      console.error("Erro ao buscar configurações/fila:", err);
    }
  };

  useEffect(() => {
    if (userEmail && userFilas && userFilas.length > 0) {
      fetchSettingsAndFila();
    }
  }, [userEmail, userFilas]);

  const puxarProximoTicket = async () => {
    try {
      const res = await apiPut("/chats/fila/proximo", {
        email: userEmail,
        filas: userFilas,
      });

      await fetchSettingsAndFila(); // Atualiza contagem da fila

      if (res && res.user_id) {
        mergeConversation(res.user_id, res);
        setSelectedUserId(res.user_id);
      } else {
        alert("Nenhum cliente disponível na fila");
      }
    } catch (err) {
      console.error("Erro ao puxar próximo cliente:", err);
      alert("Erro ao puxar próximo cliente");
    }
  };

  const getSnippet = (rawContent) => {
    if (!rawContent) return "";
    if (typeof rawContent === "string" && /^\d+$/.test(rawContent))
      return rawContent;

    if (
      typeof rawContent === "string" &&
      (rawContent.trim().startsWith("{") || rawContent.trim().startsWith("["))
    ) {
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed.url) {
          const url = parsed.url.toLowerCase();
          if (url.match(/\.(ogg|mp3|wav)$/))
            return (
              <span className="chat-icon-snippet">
                <Mic size={18} /> Áudio
              </span>
            );
          if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/))
            return (
              <span className="chat-icon-snippet">
                <File size={18} /> Imagem
              </span>
            );
          return (
            <span className="chat-icon-snippet">
              <File size={18} /> Arquivo
            </span>
          );
        }
        return parsed.text || parsed.caption || "";
      } catch {}
    }

    const contentStr = String(rawContent);
    return contentStr.length > 40
      ? contentStr.slice(0, 37) + "..."
      : contentStr;
  };

  const filteredConversations = Object.values(conversations).filter((conv) => {
    const autorizado =
      conv.status === "open" &&
      conv.assigned_to === userEmail &&
      userFilas.includes(conv.fila);

    if (!autorizado) return false;

    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      conv.name?.toLowerCase().includes(searchLower) ||
      conv.user_id?.toLowerCase().includes(searchLower) ||
      conv.content?.toLowerCase().includes(searchLower)
    );
  });

  const sortedConversations = [...filteredConversations].sort((a, b) => {
  const dateA = new Date(a.timestamp || 0);
  const dateB = new Date(b.timestamp || 0);
  return ordemAscendente ? dateA - dateB : dateB - dateA;
});


 return (
  <div className="sidebar-container">
    <div className="sidebar-header">
      <img src="/logo.svg" alt="omni" className="logo-img" />

      <div className="header-actions">
        <button className="icon-button" onClick={() => alert("Abrir perfil")}>
          <User size={20} />
        </button>

        <LogoutButton className="logout-button">
          <LogOut size={16} />
        </LogoutButton>
      </div>
    </div>

    {/* Fila Info */}
    <div className="fila-info">
      <div className="fila-status-line">
        <div className="fila-pessoas">
          <Timer size={40} strokeWidth={1.8} />
          <div className="fila-textos">
            <strong>{filaCount} Cliente{filaCount !== 1 ? "s" : ""}</strong>
            <span className="subtexto">Aguardando</span>
          </div>
        </div>

        {distribuicaoTickets === "manual" ? (
          <button
            className="botao-proximo"
            onClick={puxarProximoTicket}
            disabled={filaCount === 0}
          >
            Próximo →
          </button>
        ) : (
          <span className="distribuicao-badge automatica">Automática</span>
        )}
      </div>
    </div>

    <div className="sidebar-search-with-sort">
      <input
        type="text"
        placeholder="Pesquisar..."
        className="sidebar-input"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>

    <ul className="chat-list">
      {sortedConversations.map((conv) => {
        const fullId = conv.user_id;
        const isSelected = fullId === selectedUserId;
        const unreadCount = unreadCounts[fullId] || 0;
        const showUnread = !isSelected && unreadCount > 0;
        const canalWhatsapp = conv.channel === "whatsapp";

        return (
          <li
            key={fullId}
            className={`chat-list-item ${isSelected ? "active" : ""}`}
            onClick={() => setSelectedUserId(fullId)}
            role="button"
            tabIndex={0}
          >
            <div className="chat-main-content">
              <div className="chat-avatar-initial">
                <div
                  className="avatar-circle"
                  style={{
                    backgroundColor: stringToColor(conv.name || conv.user_id),
                  }}
                >
                  {conv.name?.charAt(0).toUpperCase() || "U"}
                </div>
                {canalWhatsapp && (
                  <img
                    src="/icons/whatsapp.png"
                    alt="whatsapp"
                    className="channel-icon-overlay"
                  />
                )}
              </div>

              <div className="chat-details">
                <div className="chat-title-row">
                  <div className="chat-title">
                    {conv.name || fullId}
                    {showUnread && <span className="unread-dot"></span>}
                  </div>
                  <div className="chat-time">
                    {conv.timestamp ? getRelativeTime(conv.timestamp) : "--:--"}
                  </div>
                </div>
                <div className="chat-snippet">{getSnippet(conv.content)}</div>
              </div>
            </div>

            <div className="chat-bottom-section">
              <div className="chat-divider"></div>
              <div className="chat-meta">
                <span
                  className="chat-queue-badge"
                  style={{ backgroundColor: conv.fila_color }}
                >
                  {conv.fila}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>

    <hr className="sidebar-footer-divider" />

<div className="sidebar-user-footer">
  <div className="user-footer-content">
    <div className="user-status">
      <span className="status-label">Status:</span>
      <Circle
        size={10}
        color={
          status === "online"
            ? "#25D366"
            : status === "pausa"
            ? "#f0ad4e"
            : "#d9534f"
        }
        fill={
          status === "online"
            ? "#25D366"
            : status === "pausa"
            ? "#f0ad4e"
            : "#d9534f"
        }
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="status-select"
      >
        <option value="online">Online</option>
        <option value="pausado">Pausa</option>
        <option value="offline">Offline</option>
      </select>
    </div>

    <div className="sort-wrapper">
      <span className="sort-label">Ordenar:</span>
      <button
        className="sort-button"
        onClick={() => setOrdemAscendente((prev) => !prev)}
        title="Ordenar por data"
      >
        {ordemAscendente ? "↓ Recentes" : "↑ Antigos"}
      </button>
    </div>
  </div>
</div>
  </div>
);

}
