import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Avatar,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { getConversation } from "../api/chat";
import { getMyClients, getTrainer } from "../api/users";
import { wsUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Message, Trainer, User } from "../types";

type Contact = { id: number; name: string };

export default function Chat() {
  const { user, token } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load contact list
  useEffect(() => {
    const load = async () => {
      try {
        if (user?.role === "trainer") {
          const res = await getMyClients();
          setContacts(
            res.data.map((u: User) => ({ id: u.id, name: u.name ?? u.email }))
          );
        } else if (user?.trainer_id) {
          const res = await getTrainer(user.trainer_id);
          const t = res.data as Trainer;
          setContacts([{ id: t.id, name: t.name ?? t.email ?? "Trainer" }]);
        }
      } catch {
        setError("Failed to load contacts.");
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  // Load history when contact selected
  useEffect(() => {
    if (!selectedContact) return;
    setMessages([]);
    getConversation(selectedContact.id)
      .then((res) => setMessages(res.data))
      .catch(() => setError("Failed to load messages."));
  }, [selectedContact]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket connection
  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${wsUrl("/ws/chat")}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: Message = JSON.parse(event.data);
        // Only append if relevant to the current open conversation
        setSelectedContact((contact) => {
          if (
            contact &&
            (msg.sender_id === contact.id || msg.receiver_id === contact.id)
          ) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
          return contact;
        });
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => setError("WebSocket connection error.");

    return () => {
      ws.close();
    };
  }, [token]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || !selectedContact || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Connection lost. Please refresh.");
      return;
    }
    wsRef.current.send(
      JSON.stringify({ receiver_id: selectedContact.id, content })
    );
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
      <Typography variant="h6" fontWeight={700} mb={1}>
        Chat
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {contacts.length === 0 ? (
        <Typography color="text.secondary" mt={2}>
          {user?.role === "trainer"
            ? "No clients yet. Clients will appear here once they select you as their trainer."
            : "You haven't selected a trainer yet. Go to the Trainers tab to choose one."}
        </Typography>
      ) : !selectedContact ? (
        <>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Select a contact to start chatting.
          </Typography>
          <List disablePadding>
            {contacts.map((c) => (
              <Paper key={c.id} sx={{ mb: 1 }}>
                <ListItemButton onClick={() => setSelectedContact(c)}>
                  <Avatar sx={{ mr: 2, bgcolor: "primary.main" }}>
                    {c.name[0]?.toUpperCase()}
                  </Avatar>
                  <ListItemText primary={c.name} />
                </ListItemButton>
              </Paper>
            ))}
          </List>
        </>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Header */}
          <Box display="flex" alignItems="center" mb={1}>
            <IconButton
              size="small"
              onClick={() => setSelectedContact(null)}
              sx={{ mr: 1 }}
            >
              ‹
            </IconButton>
            <Avatar sx={{ mr: 1, bgcolor: "primary.main", width: 32, height: 32, fontSize: 14 }}>
              {selectedContact.name[0]?.toUpperCase()}
            </Avatar>
            <Typography fontWeight={600}>{selectedContact.name}</Typography>
          </Box>
          <Divider />

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
            {messages.length === 0 && (
              <Typography color="text.secondary" align="center" mt={2} variant="body2">
                No messages yet. Say hello!
              </Typography>
            )}
            {messages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: "flex",
                    justifyContent: isMine ? "flex-end" : "flex-start",
                    mb: 0.75,
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: "75%",
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 2,
                      bgcolor: isMine ? "primary.main" : "grey.200",
                      color: isMine ? "white" : "text.primary",
                    }}
                  >
                    <Typography variant="body2">{msg.content}</Typography>
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.7, display: "block", textAlign: "right" }}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={bottomRef} />
          </Box>

          {/* Input */}
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={sendMessage} color="primary" disabled={!input.trim()}>
                      <SendIcon />
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
