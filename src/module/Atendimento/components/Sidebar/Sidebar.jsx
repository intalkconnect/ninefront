import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiPut } from "../../services/apiClient";
import { getSocket } from "../../services/socket";
import {
  File, Mic, User, Circle, LogOut, Timer,
  ArrowDownUp, ArrowUpDown, Search
} from "lucide-react";
import useConversationsStore from "../../store/useConversationsStore";
import LogoutButton from '../../../components/LogoutButton';
import { stringToColor } from '../../utils/color';
import { getRelativeTime } from '../../utils/time';
import ChannelIcon from './ChannelIcon';

import "./Sidebar.css";

export default function Sidebar() {
  const conversations     = useConversationsStore((state) => state.conversations);
  const unreadCounts      = useConversationsStore((state) => state.unreadCounts);
  const userEmail         = useConversationsStore((state) => state.userEmail);
  const userFilas         = useConversationsStore((state) => state.userFilas);
  const selectedUserId    = useConversationsStore((state) => state.selectedUserId);
  const setSelectedUserId = useConversationsStore((state) => state.setSelectedUserId);
  const mergeConversation = useConversationsStore((state) => state.mergeConversation);
  const setSettings       = useConversationsStore((state) => state.setSettings);

  const [ordemAscendente, setOrdemAscendente] = useState(false);
  const [distribuicaoTickets, setDistribuicaoTickets] = useState("manual");
  const [filaCount, setFilaCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("online");

  // rooms de fila já ingressados para evitar duplicar join/leave
  const queueRoomsRef = useRef(new Set());

  // ---------------- helpers UI (snippet) ----------------
  const TypeChip = ({ icon, label }) => (
    <span className="chat-icon-snippet">
      {icon} {label}
    </span>
  );

  const tryParseJson = (v) => {
    if (typeof v !== "string") return v;
    const s = v.trim();
    if (!s || (s[0] !== "{" && s[0] !== "[")) return v;
    try { return JSON.parse(s); } catch { return v; }
  };

  const snippetFromType = (type) => {
    const t = String(type || "").toLowerCase();
    if (!t) return "";
    if (t === "audio" || t === "voice")  return <TypeChip icon={<Mic size={18} />} label="Áudio" />;
    if (t === "image" || t === "photo")  return <TypeChip icon={<File size={18} />} label="Imagem" />;
    if (t === "video")                   return <TypeChip icon={<File size={18} />} label="Vídeo" />;
    if (t === "document" || t === "file" || t === "pdf")
                                        return <TypeChip icon={<File size={18} />} label="Arquivo" />;
    if (t === "location")               return <TypeChip icon={<File size={18} />} label="Localização" />;
    return "";
  };

  // ❗ Usa a conversa inteira, pois agora o back manda `type`
  const getSnippet = (conv) => {
    if (!conv) return "";
    const type = (conv.type || "").toLowerCase();
    const parsed = tryParseJson(conv.content);

    // Se não for texto, mostre chip imediatamente
    if (type && type !== "text") {
      return snippetFromType(type);
    }

    // Texto (ou sem type): tente extrair do content
    if (parsed && typeof parsed === "object") {
      const txt = parsed.body || parsed.text || parsed.caption || "";
      if (txt) return txt.length > 40 ? txt.slice(0, 37) + "..." : txt;

      // sem texto — tente deduzir por url/filename
      const url = String(parsed.url || "").toLowerCase();
      const fn  = String(parsed.filename || "").toLowerCase();

      if (parsed.voice === true ||
          /\.(ogg|oga|mp3|wav|m4a)$/i.test(url) || /\.(ogg|oga|mp3|wav|m4a)$/i.test(fn)) {
        return <TypeChip icon={<Mic size={18} />} label="Áudio" />;
      }
      if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url) ||
          /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fn)) {
        return <TypeChip icon={<File size={18} />} label="Imagem" />;
      }
      if (fn.endsWith(".pdf") || parsed.url || parsed.filename) {
        return <TypeChip icon={<File size={18} />} label="Arquivo" />;
      }
      return "";
    }

    if (typeof parsed === "string") {
      const s = parsed.trim();
      if (!s || s === "[mensagem]") {
        // quando vier esse marcador, use hint do type (se algum)
        return snippetFromType(type) || "";
      }
      return s.length > 40 ? s.slice(0, 37) + "..." : s;
    }

    return snippetFromType(type) || "";
  };

  // Para a busca: converte conteúdo da conversa em string
  const contentToString = (conv) => {
    if (!conv) return "";
    const type = (conv.type || "").toLowerCase();
    const parsed = tryParseJson(conv.content);

    // Para mídias, retorna um rótulo curto — já ajuda a encontrar “audio”, “imagem”, etc.
    if (type && type !== "text") return type;

    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      return parsed.body || parsed.text || parsed.caption || parsed.filename || parsed.url || "";
    }
    return "";
  };

  // ---------------- fetch baseline (settings + fila) ----------------
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
    if (userEmail && userFilas && userFilas.length > 0) {
      fetchSettingsAndFila();
    }
  }, [userEmail, userFilas]);

  // ---------------- realtime: join rooms de fila + listeners ----------------
  useEffect(() => {
    if (!userFilas || userFilas.length === 0) return;
    const socket = getSocket();
    if (!socket) return;

    // entra nos rooms `queue:<fila>` que ainda não entrou
    userFilas.forEach((fila) => {
      const room = `queue:${fila}`;
      if (!queueRoomsRef.current.has(room)) {
        socket.emit("join_room", room);
        queueRoomsRef.current.add(room);
      }
    });

    // sai de rooms que não pertencem mais às filas do usuário
    [...queueRoomsRef.current].forEach((room) => {
      const fila = room.replace(/^queue:/, "");
      if (!userFilas.includes(fila)) {
        socket.emit("leave_room", room);
        queueRoomsRef.current.delete(room);
      }
    });

    // contadores da fila (modo manual)
    const onPush = (payload = {}) => {
      if (distribuicaoTickets !== "manual") return;
      const { fila } = payload;
      if (fila && !userFilas.includes(fila)) return;
      setFilaCount((prev) => prev + 1);
    };

    const onPop = (payload = {}) => {
      if (distribuicaoTickets !== "manual") return;
      const { fila } = payload;
      if (fila && !userFilas.includes(fila)) return;
      setFilaCount((prev) => Math.max(0, prev - 1));
    };

    const onCount = (payload = {}) => {
      const { fila, count } = payload;
      if (fila && !userFilas.includes(fila)) return;
      if (typeof count === "number") setFilaCount(count);
    };

    // Fallbacks (se o backend emitir eventos mais genéricos)
    const onTicketCreated = (t = {}) => {
      if (distribuicaoTickets !== "manual") return;
      const { assigned_to, fila } = t;
      if (assigned_to) return;
      if (fila && !userFilas.includes(fila)) return;
      setFilaCount((prev) => prev + 1);
    };

    const onTicketClosed = (t = {}) => {
      if (distribuicaoTickets !== "manual") return;
      const { assigned_to, fila } = t;
      if (assigned_to) return;
      if (fila && !userFilas.includes(fila)) return;
      setFilaCount((prev) => Math.max(0, prev - 1));
    };

    socket.on("queue_push", onPush);
    socket.on("queue_pop", onPop);
    socket.on("queue_count", onCount);
    socket.on("ticket_created", onTicketCreated);
    socket.on("ticket_closed", onTicketClosed);

    // sincroniza ao reconectar
    const onConnect = () => fetchSettingsAndFila();
    socket.on("connect", onConnect);

    // sincroniza ao voltar o foco
    const onVis = () => {
      if (document.visibilityState === "visible") fetchSettingsAndFila();
    };
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

  // ---------------- ações ----------------
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

  // ---------------- filtros/ordenação ----------------
  const filteredConversations = React.useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    return Object.values(conversations).filter((conv) => {
      const autorizado =
        conv.status === "open" &&
        conv.assigned_to === userEmail &&
        (!conv.fila || userFilas.includes(conv.fila));

      if (!autorizado) return false;
      if (!term) return true;

      const haystack =
        (conv.name || "").toLowerCase() +
        " " +
        (conv.user_id || "").toLowerCase() +
        " " +
        contentToString(conv).toLowerCase();

      return haystack.includes(term);
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

  // ---------------- render ----------------
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

      {/* Fila Info */}
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
              <div className="fila-textos">
                <strong>Não há clientes aguardando</strong>
              </div>
            )}
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
        <span className="search-icon-right">
          <Search size={20} strokeWidth={2} />
        </span>
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
                    <div className="chat-title">
                      {conv.name || fullId}
                    </div>
                    <div className="chat-time">
                      {conv.timestamp ? getRelativeTime(conv.timestamp) : "--:--"}
                    </div>
                  </div>

                  {/* ⬇️ Agora o snippet usa conv (tem type) */}
                  <div className="chat-snippet">{getSnippet(conv)}</div>
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

          <div className="footer-divider-vertical"></div>

          <div className="sort-wrapper">
            <div className="sort-toggle-wrapper">
              <button
                className="sort-toggle-button"
                onClick={() => setOrdemAscendente((prev) => !prev)}
              >
                {ordemAscendente ? (
                  <ArrowUpDown size={16} className="sort-icon" />
                ) : (
                  <ArrowDownUp size={16} className="sort-icon" />
                )}
                {ordemAscendente ? "Crescente" : "Decrescente"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
