import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "../../services/apiClient";
import { File, Mic, User, Circle, LogOut, Settings } from "lucide-react";
import useConversationsStore from "../../store/useConversationsStore";
import LogoutButton from "../../../components/LogoutButton";

import "./Sidebar.css";

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 70%, 50%)`;
};

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

  const [distribuicaoTickets, setDistribuicaoTickets] = useState("manual");
  const [filaCount, setFilaCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("online");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userName, setUserName] = useState("Usuário");

  const fetchUserProfile = async () => {
    try {
      const profile = await apiGet("/auth/profile");
      if (profile?.name) setUserName(profile.name);
    } catch (err) {
      console.error("Erro ao buscar perfil do usuário:", err);
    }
  };

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
    fetchUserProfile();
  }, [userEmail, userFilas]);

  const puxarProximoTicket = async () => {
    try {
      const res = await apiPut("/chats/fila/proximo", {
        email: userEmail,
        filas: userFilas,
      });

      await fetchSettingsAndFila();

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

  return (
    <div className="sidebar-container">
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Pesquisar..."
          className="sidebar-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div
        className="user-profile-header"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <div className="avatar-circle">
          {userName?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <span className="username">{userName}</span>
        <span className="dropdown-arrow">▼</span>
      </div>

      {dropdownOpen && (
        <div className="user-dropdown-menu">
          <div className="user-status">
            <span className="status-label">Status:</span>
            <Circle
              size={10}
              color={
                status === "online"
                  ? "#25D366"
                  : status === "pausado"
                  ? "#f0ad4e"
                  : "#d9534f"
              }
              fill={
                status === "online"
                  ? "#25D366"
                  : status === "pausado"
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
          <button
            className="dropdown-item"
            onClick={() => alert("Abrir perfil")}
          >
            <User size={16} /> Meu Perfil
          </button>
          <button className="dropdown-item">
            <Settings size={16} /> Configurações
          </button>
          <button className="dropdown-item">
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}

      <div className="fila-info">
        {distribuicaoTickets === "manual" ? (
          <>
            <span className="fila-count">
              {filaCount > 0
                ? `${filaCount} cliente${filaCount > 1 ? "s" : ""} aguardando`
                : "Não há clientes aguardando"}
            </span>
            <button
              className="botao-proximo"
              onClick={puxarProximoTicket}
              disabled={filaCount === 0}
            >
              Próximo
            </button>
          </>
        ) : (
          "Distribuição: Automática"
        )}
      </div>

      <ul className="chat-list">
        {filteredConversations.map((conv) => {
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
                    className="whatsapp-icon-overlay"
                  />
                )}
              </div>

              <div className="chat-details">
                <div className="chat-title">
                  {conv.name || fullId}
                  {showUnread && <span className="unread-dot"></span>}
                </div>

                <div className="chat-meta">
                  <span className="chat-ticket">
                    #{conv.ticket_number || "000000"}
                  </span>
                  <span
                    className="chat-queue-badge"
                    style={{ backgroundColor: conv.fila_color }}
                  >
                    {conv.fila || "Orçamento"}
                  </span>
                </div>

                <div className="chat-snippet">{getSnippet(conv.content)}</div>
              </div>

              <div className="chat-time">
                {conv.timestamp
                  ? new Date(conv.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
