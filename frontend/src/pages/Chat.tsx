import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Card,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { getConversation, getDialogs, markRead } from "../api/chat";
import { wsUrl } from "../api/client";
import { getMyClients, getTrainer } from "../api/users";
import { useAuth } from "../context/AuthContext";
import { Message, Trainer, User } from "../types";

type Contact = { id: number; name: string; unread: number };

function parseWsPayload(raw: string): Message | null {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (o.type === "error") {
    const detail = typeof o.detail === "string" ? o.detail : "Ошибка чата.";
    throw new Error(detail);
  }
  if (o.type !== "message") return null;
  const { id, sender_id, receiver_id, content, created_at } = o;
  if (
    typeof id === "number" && typeof sender_id === "number" &&
    typeof receiver_id === "number" && typeof content === "string" &&
    typeof created_at === "string"
  ) {
    return { id, sender_id, receiver_id, content,
      is_read: typeof o.is_read === "boolean" ? o.is_read : false, created_at };
  }
  return null;
}

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = ["#5ad98a", "#7eb8ff", "#ffb347", "#ff6b9d", "#a78bfa"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

export default function Chat() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { user, token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    try {
      let base: Contact[] = [];
      if (user.role === "trainer") {
        const res = await getMyClients();
        base = res.data.map((u: User) => ({ id: u.id, name: u.name ?? u.email, unread: 0 }));
      } else if (user.trainer_id) {
        const res = await getTrainer(user.trainer_id);
        const t = res.data as Trainer;
        base = [{ id: t.id, name: t.name ?? t.email ?? "Тренер", unread: 0 }];
      }

      // Merge unread counts from dialogs API
      try {
        const dlgRes = await getDialogs();
        const unreadMap: Record<number, number> = {};
        for (const d of dlgRes.data) unreadMap[d.other_user_id] = d.unread_count;
        base = base.map((c) => ({ ...c, unread: unreadMap[c.id] ?? 0 }));
      } catch {
        // dialogs API optional — continue without unread counts
      }

      setContacts(base);
    } catch {
      setError("Не удалось загрузить контакты.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!selectedContact) return;
    setMessages([]);
    // Mark read on server and clear local badge immediately
    void markRead(selectedContact.id).catch(() => {/* ignore */});
    setContacts((prev) => prev.map((c) => c.id === selectedContact.id ? { ...c, unread: 0 } : c));
    getConversation(selectedContact.id)
      .then((res) => setMessages(res.data))
      .catch(() => setError("Не удалось загрузить сообщения."));
  }, [selectedContact]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const connectWs = useCallback(() => {
    if (!token) return;
    wsRef.current?.close();
    const url = `${wsUrl("/ws/chat")}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => { setWsReady(true); setError((p) => p === "Ошибка подключения WebSocket." ? "" : p); };
    ws.onclose = () => setWsReady(false);
    ws.onmessage = (event) => {
      try {
        const msg = parseWsPayload(event.data);
        if (!msg) return;
        setSelectedContact((contact) => {
          if (contact && (msg.sender_id === contact.id || msg.receiver_id === contact.id)) {
            // Active conversation — append message
            setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
          } else if (contact === null || msg.sender_id !== contact?.id) {
            // Message from a background contact — increment unread badge
            setContacts((prev) =>
              prev.map((c) => c.id === msg.sender_id ? { ...c, unread: c.unread + 1 } : c)
            );
          }
          return contact;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка чата.");
      }
    };
    ws.onerror = () => { setWsReady(false); setError("Ошибка подключения WebSocket."); };
    return ws;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    connectWs();
    return () => wsRef.current?.close();
  }, [token, connectWs]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || !selectedContact) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Нет соединения. Проверьте, что API запущен.");
      return;
    }
    ws.send(JSON.stringify({ receiver_id: selectedContact.id, content }));
    setInput("");
  };

  const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0);

  if (loading)
    return <Box display="flex" justifyContent="center" mt={6}><CircularProgress /></Box>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
      {/* Page header */}
      <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
        <Typography variant="h6" fontWeight={800}>Чат</Typography>
        {totalUnread > 0 && !selectedContact && (
          <Box
            sx={{
              bgcolor: "primary.main",
              color: "primary.contrastText",
              borderRadius: "10px",
              px: 1,
              py: 0.1,
              fontSize: "0.7rem",
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {totalUnread} новых
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {contacts.length === 0 ? (
        <Box
          sx={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", textAlign: "center", gap: 1,
          }}
        >
          <Typography fontSize="2.5rem">💬</Typography>
          <Typography variant="body1" fontWeight={600} color="text.primary">
            {user?.role === "trainer" ? "Пока нет клиентов" : "Тренер не назначен"}
          </Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={260}>
            {user?.role === "trainer"
              ? "Клиенты появятся здесь, когда выберут вас тренером."
              : "Откройте вкладку «Тренеры» и назначьте себе коуча."}
          </Typography>
        </Box>
      ) : !selectedContact ? (
        /* ── Contact list ── */
        <Stack spacing={1.25}>
          <Typography variant="body2" color="text.secondary" mb={0.5}>
            Выберите контакт для переписки
          </Typography>
          {contacts.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3 }}
            >
              <Card
                onClick={() => setSelectedContact(c)}
                sx={{
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: c.unread > 0 ? "primary.main" : "divider",
                  "&:hover": { borderColor: "primary.dark", transform: "translateY(-1px)" },
                  transition: "all 0.18s ease",
                }}
              >
                <Box display="flex" alignItems="center" p={1.75} gap={1.5}>
                  <Badge
                    badgeContent={c.unread}
                    color="primary"
                    overlap="circular"
                    invisible={c.unread === 0}
                    max={99}
                  >
                    <Avatar
                      sx={{
                        bgcolor: avatarColor(c.name),
                        color: dark ? "#0a0f0d" : "#fff",
                        fontWeight: 700, width: 44, height: 44, fontSize: "0.95rem",
                      }}
                    >
                      {getInitials(c.name)}
                    </Avatar>
                  </Badge>
                  <Box flex={1}>
                    <Typography
                      fontWeight={c.unread > 0 ? 800 : 700}
                      variant="body1"
                      color={c.unread > 0 ? "text.primary" : "text.primary"}
                    >
                      {c.name}
                    </Typography>
                    <Typography variant="caption" color={c.unread > 0 ? "primary.main" : "text.secondary"}>
                      {c.unread > 0
                        ? `${c.unread} новых сообщ.`
                        : user?.role === "trainer" ? "Клиент" : "Тренер"}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">›</Typography>
                </Box>
              </Card>
            </motion.div>
          ))}
        </Stack>
      ) : (
        /* ── Conversation ── */
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Header */}
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            mb={1}
            sx={{
              bgcolor: "background.paper",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              px: 1.5, py: 1,
            }}
          >
            <IconButton
              size="small"
              onClick={() => {
                setSelectedContact(null);
                void loadContacts();
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Avatar
              sx={{
                bgcolor: avatarColor(selectedContact.name),
                color: dark ? "#0a0f0d" : "#fff",
                width: 32, height: 32, fontSize: "0.8rem", fontWeight: 700,
              }}
            >
              {getInitials(selectedContact.name)}
            </Avatar>
            <Box flex={1}>
              <Typography fontWeight={700} variant="body2" lineHeight={1.2}>
                {selectedContact.name}
              </Typography>
              <Typography variant="caption" color={wsReady ? "primary.main" : "warning.main"} lineHeight={1.2}>
                {wsReady ? "● онлайн" : "○ подключение…"}
              </Typography>
            </Box>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              py: 1,
              px: 0.5,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 2 },
            }}
          >
            {messages.length === 0 && (
              <Box textAlign="center" mt={4}>
                <Typography fontSize="2rem" mb={1}>👋</Typography>
                <Typography variant="body2" color="text.secondary">
                  Напишите первым
                </Typography>
              </Box>
            )}
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: isMine ? "flex-end" : "flex-start",
                        mb: 0.75,
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: "78%",
                          px: 1.5, py: 0.85,
                          borderRadius: isMine
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                          bgcolor: isMine
                            ? "primary.main"
                            : dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                          color: isMine ? "primary.contrastText" : "text.primary",
                        }}
                      >
                        <Typography variant="body2" sx={{ wordBreak: "break-word", lineHeight: 1.45 }}>
                          {msg.content}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            opacity: 0.65,
                            display: "block",
                            textAlign: "right",
                            mt: 0.25,
                            fontSize: "0.65rem",
                          }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString("ru-RU", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </Typography>
                      </Box>
                    </Box>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={bottomRef} />
          </Box>

          {/* Input */}
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              placeholder="Написать сообщение…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              size="small"
              disabled={!wsReady}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "14px",
                  bgcolor: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={sendMessage}
                      color="primary"
                      disabled={!input.trim() || !wsReady}
                      size="small"
                      sx={{
                        bgcolor: input.trim() && wsReady ? "primary.main" : "transparent",
                        color: input.trim() && wsReady ? "primary.contrastText" : "text.disabled",
                        "&:hover": { bgcolor: "primary.dark", color: "primary.contrastText" },
                        transition: "all 0.15s",
                      }}
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
