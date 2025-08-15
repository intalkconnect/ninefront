import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiPut } from "../../services/apiClient";
import { getSocket } from "../../services/socket";
import { File, Mic, User, Circle, LogOut, Timer, ArrowDownUp, ArrowUpDown, Search } from "lucide-react";
import useConversationsStore from "../../store/useConversationsStore";
import LogoutButton from '../../../components/LogoutButton';
import { stringToColor } from '../../utils/color';
import { getRelativeTime } from '../../utils/time';
import ChannelIcon from './ChannelIcon';

import "./Sidebar.css";

export default function Sidebar() {
  const conversations   = useConversationsStore((s) => s.conversations);
  const unreadCounts    = useConversationsStore((s) => s.unreadCounts);
  const userEmail       = useConversationsStore((s) => s.userEmail);
  const userFilas       = useConversationsStore((s) => s.userFilas);
  const selectedUserId  = useConversationsStore((s) => s.selectedUserId);
  const setSelectedUserId = useConversationsStore((s) => s.setSelectedUserId);
  const mergeConversation = useConversationsStore((s) => s.mergeConversation);
  const setSettings     = useConversationsStore((s) => s.setSettings);

  const [ordemAscendente, setOrdemAscendente] = useState(false);
  const [distribuicaoTickets, setDistribuicaoTickets] = useState("manual");
  const [filaCount, setFilaCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("online");

  const queueRoomsRef = useRef(new Set());

  const fetchSettingsAndFila = async () => {
    try {
      const settings = await apiGet("/settings");
      const distrib  = settings.find((s) => s.key === "distribuicao_tickets");
      if (distrib?.value) setDistribuicaoTickets(distrib.value);
      setSettings(settings);

      if (!userFilas || userFilas.length === 0) {
        setFilaCount(0);
        return;
      }
      const params = new URLSearchParams({ filas: userFilas.join(",") });
      const data = await apiGet(`/chats/fila?${params.toString()}`);
      setFilaCount(Array.isArray(data) ? data.length : (data?.length || 0));
    } catch (err) {
      console.error("Erro ao buscar configurações/fila:", err);
    }
  };

  useEffect(() => {
    if (userEmail && userFilas && userFilas.length > 0) fetchSettingsAndFila();
  }, [userEmail, userFilas]);

  useEffect(() => {
    if (!userFilas || userFilas.length === 0) return;
    const socket = getSocket();
    if (!socket) return;

    userFilas.forEach((fila) => {
      const room = `queue:${fila}`;
      if (!queueRoomsRef.current.has(room)) {
        socket.emit("join_room", room);
        queueRoomsRef.current.add(room);
      }
    });
    [...queueRoomsRef.current].forEach((room) => {
      const fila = room.replace(/^queue:/, "");
      if (!userFilas.includes(fila)) {
        socket.emit("leave_room", room);
        queueRoomsRef.current.delete(room);
      }
    });

    const onPush  = ({ fila } = {}) => { if (distribuicaoTickets !== "manual") return; if (fila && !userFilas.includes(fila)) return; setFilaCount((p) => p + 1); };
    const onPop   = ({ fila } = {}) => { if (distribuicaoTickets !== "manual") return; if (fila && !userFilas.includes(fila)) return; setFilaCount((p) => Math.max(0, p - 1)); };
    const onCount = ({ fila, count } = {}) => { if (fila && !userFilas.includes(fila)) return; if (typeof count === "number") setFilaCount(count); };

    const onTicketCreated = (t = {}) => {
      if (distribuicaoTickets !== "manual") return;
      const { assigned_to, fila } = t;
      if (assigned_to) return;
      if (fila && !userFilas.includes(fila)) return;
      setFilaCount((p) => p + 1);
    };
    const onTicketClosed = (t = {}) => {
      if (distribuicaoTickets !== "manual") return;
      const { assigned_to, fila } = t;
      if (assigned_to) return;
      if (fila && !userFilas.includes(fila)) return;
      setFilaCount((p) => Math.max(0, p - 1));
    };

    socket.on("queue_push", onPush);
    socket.on("queue_pop", onPop);
    socket.on("queue_count", onCount);
    socket.on("ticket_created", onTicketCreated);
    socket.on("ticket_closed", onTicketClosed);

    const onConnect = () => fetchSettingsAndFila();
    socket.on("connect", onConnect);

    const onVis = () => { if (document.visibilityState === "visible") fetchSettingsAndFila(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      socket.off("queue_push", onPush);
      socket.off("queue_pop", onPop);
      socket.off("queue_count", onCount);
      socket.off("ticket_created", onTicketCreated);
      socket.off("ticket_closed", onTicketClosed);
      socket.off("connect", onConnect);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userFilas, distribuicaoTickets]);

  // ------- helpers UI (snippet) -------
  const getSnippet = (raw) => {
    if (raw == null) return "";

    // objetos (mídia/estruturados) — preferido
    if (typeof raw === "object") {
      const c = raw;
      const url = String(c.url || "").toLowerCase();
      const filename = String(c.filename || "").toLowerCase();
      const text = c.body || c.text || c.caption;

      if (text) return text.length > 40 ? text.slice(0, 37) + "..." : text;

      const isAudio = c.voice === true || c.type === "audio" ||
        /\.(ogg|oga|mp3|wav|m4a)$/i.test(url) || /\.(ogg|oga|mp3|wav|m4a)$/i.test(filename);
      if (isAudio) return (<span className="chat-icon-snippet"><Mic size={18}/> Áudio</span>);

      const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url) ||
                    /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(filename);
      if (isImg) return (<span className="chat-icon-snippet"><File size={18}/> Imagem</span>);

      if (filename.endsWith('.pdf')) {
        return (<span className="chat-icon-snippet"><File size={18}/> Arquivo</span>);
      }
      if (c.url || c.filename) {
        return (<span className="chat-icon-snippet"><File size={18}/> Arquivo</span>);
      }
      return "";
    }

    // strings
    if (typeof raw === "string") {
      const s = raw.trim();

      // se vier JSON serializado, tenta extrair como objeto
      if (s.startsWith("{") || s.startsWith("[")) {
        try {
          return getSnippet(JSON.parse(s));
        } catch {}
      }

      // se for URL de mídia, mostra ícone certo
      const sl = s.toLowerCase();
      if (/\.(ogg|oga|mp3|wav|m4a)(\?|#|$)/i.test(sl)) {
        return (<span className="chat-icon-snippet"><Mic size={18}/> Áudio</span>);
      }
      if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|#|$)/i.test(sl)) {
        return (<span className="chat-icon-snippet"><File size={18}/> Imagem</span>);
      }
      if (/\.pdf(\?|#|$)/i.test(sl)) {
        return (<span className="chat-icon-snippet"><File size={18}/> Arquivo</span>);
      }

      // texto simples
      return s.length > 40 ? s.slice(0, 37) + "..." : s;
    }

    return String(raw);
  };

  // search helpers
  const contentToString = (c) => {
    if (c == null) return "";
    if (typeof c === "string") {
      const s = c.trim();
      if (s.startsWith("{") || s.startsWith("[")) {
        try {
          const j = JSON.parse(s);
          return j?.body || j?.text || j?.caption || j?.filename || j?.url || "";
        } catch {}
      }
      return s;
    }
    if (typeof c === "number" || typeof c === "boolean") return String(c);
    if (typeof c === "object") return c.body || c.text || c.caption || c.filename || c.url || "";
    return String(c);
  };

  const filteredConversations = React.useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    return Object.values(conversations).filter((conv) => {
      const autorizado =
        conv.status === "open" &&
        conv.assigned_to === userEmail &&
        (!conv.fila || userFilas.includes(conv.fila));
      if (!autorizado) return false;
      if (!term) return true;

      const contentStr = contentToString(conv.content).toLowerCase();
      return (
        (conv.name || "").toLowerCase().includes(term) ||
        (conv.user_id || "").toLowerCase().includes(term) ||
        contentStr.includes(term)
      );
    });
  }, [conversations, userEmail, userFilas, searchTerm]);

  const sortedConversations = React.useMemo(() => {
    const arr = [...filteredConversations];
    arr.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      return ordemAscendente ? dateA - dateB : dateB - dateA;
    });
    return arr;
  }, [filteredConversations, ordemAscendente]);

  // ações
  const puxarProximoTicket = async () => {
    try {
      const res = await apiPut("/chats/fila/proximo", {
        email: userEmail, filas: userFilas,
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

  // render
  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <img src="/logo-front.png" alt="omni" className="logo-img" />
        <div className="header-actions">
          <button className="icon-button" onClick={() => alert("Abrir perfil")}>
            <User size={20} />
          </button>
          <LogoutButton className="logout-button">
            <LogOut size={16} />
          </LogoutButton>
        </div>
      </div>

      <div className="fila-info">
        <div className="fila-status-line">
          <div className="fila-pessoas">
            {filaCount > 0 ? (
              <>
                <Timer size={40} strokeWidth={1.8} />
                <div className="fila-textos">
                  <strong>{filaCount} Cliente{filaCount !== 1 ? "s" : ""}</strong>
                  <span className="subtexto">Aguardando</span>
                </div>
              </>
            ) : (
              <div className="fila-textos"><strong>Não há clientes aguardando</strong></div>
            )}
          </div>
          {distribuicaoTickets === "manual" ? (
            <button className="botao-proximo" onClick={puxarProximoTicket} disabled={filaCount === 0}>
              Próximo →
            </button>
          ) : (<span className="distribuicao-badge automatica">Automática</span>)}
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
        <span className="search-icon-right"><Search size={20} strokeWidth={2} /></span>
      </div>

      <ul className="chat-list">
        {sortedConversations.map((conv) => {
          const fullId = conv.user_id;
          const isSelected = fullId === selectedUserId;
          const unreadCount = unreadCounts[fullId] || 0;
          const showUnread = !isSelected && unreadCount > 0;

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
                  style={{ backgroundColor: stringToColor(conv.name || conv.user_id) }}
                >
                  {conv.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="channel-icon-overlay">
                  <ChannelIcon channel={conv.channel} size={14} />
                </div>
              </div>

              <div className="chat-details">
                <div className="chat-title-row">
                  <div className="chat-title">{conv.name || fullId}</div>
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
                <span className="chat-queue-badge" style={{ backgroundColor: conv.fila_color }}>
                  {conv.fila}
                </span>
                {showUnread && <span className="unread-dot"></span>}
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
              color={status === "online" ? "#25D366" : status === "pausa" ? "#f0ad4e" : "#d9534f"}
              fill={status === "online" ? "#25D366" : status === "pausa" ? "#f0ad4e" : "#d9534f"}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="status-select">
              <option value="online">Online</option>
              <option value="pausado">Pausa</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="footer-divider-vertical"></div>

          <div className="sort-wrapper">
            <div className="sort-toggle-wrapper">
              <button className="sort-toggle-button" onClick={() => setOrdemAscendente((p) => !p)}>
                {ordemAscendente ? (<ArrowUpDown size={16} className="sort-icon" />)
                                 : (<ArrowDownUp size={16} className="sort-icon" />)}
                {ordemAscendente ? "Crescente" : "Decrescente"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
