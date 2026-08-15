import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../components/ui.jsx";
import Spinner from "../components/Spinner.jsx";
import { encryptForRecipient, decryptFromSender } from "../utils/crypto.js";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type) {
  if (!type) return "attach_file";
  if (type.startsWith("image/")) return "image";
  if (type.includes("pdf")) return "picture_as_pdf";
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "table_chart";
  if (type.includes("word") || type.includes("document")) return "description";
  return "attach_file";
}

async function downloadAttachment(att) {
  try {
    const res = await api.get(att.url, { responseType: "blob" });
    const blobUrl = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = att.filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(att.url, "_blank");
  }
}

function msgTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  const time = dt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  if (dt.toDateString() === now.toDateString()) return time;
  return `${dt.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} · ${time}`;
}

function msgDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dt.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function MessagesPage() {
  const { user, privateKey, encryptionReady } = useAuth();
  const { show, confirm } = useUI();
  const [params, setParams] = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [peerId, setPeerId] = useState(params.get("to") || "");
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [decrypted, setDecrypted] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const chatRef = useRef(null);
  const pollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const initialLoadRef = useRef(true);
  const highlightRef = useRef(null);

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await api.get("/messages/contacts");
      setContacts(data.contacts);
    } catch (err) {
      show(err.message, "error");
    }
  }, [show]);

  useEffect(() => {
    loadContacts().finally(() => setLoading(false));
  }, [loadContacts]);

  const loadThread = useCallback(async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/messages/${id}`);
      setPeer(data.peer);
      setMessages(data.messages);
      await loadContacts();
    } catch (err) {
      show(err.message, "error");
    }
  }, [loadContacts]);

  useEffect(() => {
    loadThread(peerId);
  }, [peerId, loadThread]);

  useEffect(() => {
    if (!peerId) return;
    pollRef.current = setInterval(() => loadThread(peerId), 5000);
    return () => clearInterval(pollRef.current);
  }, [peerId, loadThread]);

  useEffect(() => {
    const decrypt = async () => {
      if (!privateKey) return setDecrypted([]);
      const out = [];
      for (const m of messages) {
        const mine = String(m.senderId) === String(user.id);
        const payload = {
          ciphertext: mine && m.selfCiphertext ? m.selfCiphertext : m.ciphertext,
          iv: mine && m.selfIv ? m.selfIv : m.iv,
          wrappedKey: mine && m.selfWrappedKey ? m.selfWrappedKey : m.wrappedKey,
        };
        try {
          out.push({ id: m.id, senderId: m.senderId, text: await decryptFromSender(payload, privateKey), attachments: m.attachments || [], createdAt: m.createdAt });
        } catch {
          out.push({ id: m.id, senderId: m.senderId, text: "Unable to decrypt this message.", attachments: m.attachments || [], createdAt: m.createdAt, undecrypted: true });
        }
      }
      setDecrypted(out);
    };
    decrypt();
  }, [messages, privateKey, user.id]);

  const handleScroll = () => {
    const el = chatRef.current;
    if (!el) return;
    const threshold = 100;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      initialLoadRef.current = false;
    } else if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [decrypted]);

  const selectPeer = (id) => {
    setPeerId(id);
    setParams({ to: id }, { replace: true });
    setAttachments([]);
    initialLoadRef.current = true;
    isNearBottomRef.current = true;
    setShowMsgSearch(false);
    setMessageSearch("");
    setSearchResults([]);
  };

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter((c) =>
      c.fullName.toLowerCase().includes(q) ||
      (c.subject || "").toLowerCase().includes(q) ||
      (c.strand || "").toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.post("/messages/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploaded.push(data);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() && attachments.length === 0) return;
    if (!encryptionReady) return show("Encryption key is not ready yet. Please refresh.", "error");
    if (!peer?.publicKey) return show("Recipient has no encryption key yet.", "error");
    setSending(true);
    try {
      const payload = await encryptForRecipient(text || " ", peer.publicKey);
      const self = await encryptForRecipient(text || " ", user.publicKey);
      await api.post("/messages", {
        recipientId: peer.id,
        ...payload,
        selfCiphertext: self.ciphertext,
        selfIv: self.iv,
        selfWrappedKey: self.wrappedKey,
        attachments,
      });
      setText("");
      setAttachments([]);
      await loadThread(peerId);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setSending(false);
    }
  };

  const searchMessages = async () => {
    if (!messageSearch.trim() || !peerId) return;
    setSearching(true);
    try {
      const { data } = await api.get(`/messages/search?peerId=${peerId}&q=${encodeURIComponent(messageSearch)}`);
      const results = [];
      for (const m of data.messages) {
        const mine = String(m.senderId) === String(user.id);
        const payload = {
          ciphertext: mine && m.selfCiphertext ? m.selfCiphertext : m.ciphertext,
          iv: mine && m.selfIv ? m.selfIv : m.iv,
          wrappedKey: mine && m.selfWrappedKey ? m.selfWrappedKey : m.wrappedKey,
        };
        try {
          const plain = await decryptFromSender(payload, privateKey);
          if (plain.toLowerCase().includes(messageSearch.toLowerCase())) {
            results.push({ id: m.id, text: plain, createdAt: m.createdAt, senderId: m.senderId });
          }
        } catch {
          // skip undecryptable
        }
      }
      setSearchResults(results);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setSearching(false);
    }
  };

  const scrollToMessage = (msgId) => {
    const el = chatRef.current;
    if (!el) return;
    const msgEl = el.querySelector(`[data-msg-id="${msgId}"]`);
    if (msgEl) {
      msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
      msgEl.classList.add("ring-2", "ring-primary-400");
      setTimeout(() => msgEl.classList.remove("ring-2", "ring-primary-400"), 2000);
    }
  };

  const deleteConversation = async () => {
    if (!peerId) return;
    const ok = await confirm({
      title: "Delete conversation?",
      message: `This will archive and delete all messages with ${peer?.fullName}. You won't see this conversation anymore.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/messages/conversation/${peerId}`);
      setMessages([]);
      setDecrypted([]);
      setPeerId("");
      setPeer(null);
      setParams({}, { replace: true });
      await loadContacts();
      show("Conversation archived and deleted.");
    } catch (err) {
      show(err.message, "error");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">End-to-end encrypted conversation with {user.role === "adviser" ? "subject teachers" : "advisers"}.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 items-start">
        <div className="card overflow-hidden md:col-span-1 flex flex-col" style={{ maxHeight: 600 }}>
          <div className="px-4 py-3 border-b border-slate-200 space-y-2">
            <div className="font-semibold text-slate-900 text-sm">
              {user.role === "adviser" ? "Subject Teachers" : "Advisers"}
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">search</span>
              <input
                className="input !pl-8 !py-1.5 !text-xs"
                placeholder="Search by name, subject, strand..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
              {contactSearch && (
                <button onClick={() => setContactSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100" style={{ scrollbarWidth: "none" }}>
            {filteredContacts.length === 0 && (
              <p className="p-4 text-sm text-slate-500">
                {contactSearch ? "No results found." : `No ${user.role === "adviser" ? "teachers" : "advisers"} registered yet.`}
              </p>
            )}
            {filteredContacts.map((c) => (
              <button key={c.id} onClick={() => selectPeer(c.id)}
                className={`w-full text-left px-4 py-3 transition ${c.id === peerId ? "bg-primary-50 border-l-2 border-primary-600" : "border-l-2 border-transparent hover:bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-sm text-slate-900">{c.fullName}</span>
                  {c.unread > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {user.role === "adviser"
                    ? `${c.subject} · ${c.semester}`
                    : `Grade ${c.grade}${c.strand ? " · " + c.strand : ""} - ${c.section}`}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden md:col-span-2 flex flex-col">
          {peer ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 shrink-0">
                  {(peer.fullName?.[0] || "").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{peer.fullName}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {peer.role === "adviser" ? `Adviser · Grade ${peer.grade}${peer.strand ? " · " + peer.strand : ""} - ${peer.section}` : `Subject Teacher · ${peer.subject} · ${peer.semester}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setShowMsgSearch(!showMsgSearch); if (showMsgSearch) { setMessageSearch(""); setSearchResults([]); } }}
                    className={`p-1.5 rounded-lg transition ${showMsgSearch ? "bg-primary-100 text-primary-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                    title="Search messages"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">search</span>
                  </button>
                  <button
                    onClick={deleteConversation}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Delete conversation"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                  </button>
                </div>
              </div>

              {showMsgSearch && (
                <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">search</span>
                      <input
                        className="input !pl-8 !py-1.5 !text-xs"
                        placeholder="Search in this conversation..."
                        value={messageSearch}
                        onChange={(e) => setMessageSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchMessages()}
                        autoFocus
                      />
                    </div>
                    <button className="btn-primary !text-xs !px-3" onClick={searchMessages} disabled={searching || !messageSearch.trim()}>
                      {searching ? "..." : "Search"}
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1" style={{ scrollbarWidth: "none" }}>
                      {searchResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => scrollToMessage(r.id)}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-slate-200 transition truncate"
                        >
                          <span className="text-slate-400">{msgTime(r.createdAt)}</span>
                          <span className="ml-2 text-slate-700">{r.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.length === 0 && messageSearch && !searching && (
                    <p className="mt-2 text-xs text-slate-400">No messages found.</p>
                  )}
                </div>
              )}

              <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1 min-h-[400px] max-h-[480px] bg-slate-50">
                {decrypted.length === 0 && <p className="text-sm text-slate-400 text-center pt-10">No messages yet. Say hello!</p>}
                {(() => {
                  let lastDate = "";
                  return decrypted.map((m) => {
                    const mine = String(m.senderId) === String(user.id);
                    const dateLabel = msgDate(m.createdAt);
                    const showDate = dateLabel !== lastDate;
                    lastDate = dateLabel;
                    return (
                      <div key={m.id} data-msg-id={m.id}>
                        {showDate && (
                          <div className="text-center py-2">
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-3 py-0.5 rounded-full">{dateLabel}</span>
                          </div>
                        )}
                        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${mine ? "bg-primary-600 text-white rounded-br-sm" : "bg-white border border-slate-200 rounded-bl-sm"}`}>
                            <div className="flex items-center gap-1">
                              {m.undecrypted && <span className="material-symbols-outlined text-sm" aria-hidden="true">lock</span>}
                              <span className={m.undecrypted ? "italic" : ""}>{m.text}</span>
                            </div>
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {m.attachments.map((att, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => downloadAttachment(att)}
                                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition w-full text-left ${
                                      mine
                                        ? "bg-white/20 hover:bg-white/30 text-white"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-sm" aria-hidden="true">{fileIcon(att.type)}</span>
                                    <span className="truncate flex-1">{att.filename}</span>
                                    <span className={`shrink-0 ${mine ? "text-white/60" : "text-slate-400"}`}>{formatSize(att.size)}</span>
                                    <span className="material-symbols-outlined text-sm" aria-hidden="true">download</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-slate-400"}`}>{msgTime(m.createdAt)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
                <div ref={bottomRef} />
              </div>

              {attachments.length > 0 && (
                <div className="border-t border-slate-200 px-3 pt-2 pb-0 flex flex-wrap gap-1.5">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">{fileIcon(att.type)}</span>
                      <span className="truncate max-w-[120px]">{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={send} className="border-t border-slate-200 p-3 flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  className="btn-outline !px-2.5 !py-1.5 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !encryptionReady}
                  title="Attach file"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">{uploading ? "hourglass_top" : "attach_file"}</span>
                </button>
                <input
                  className="input"
                  placeholder={encryptionReady ? "Type your message (end-to-end encrypted)..." : "Encryption key loading..."}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={!encryptionReady}
                />
                <button className="btn-primary shrink-0" disabled={sending || (!text.trim() && attachments.length === 0) || !encryptionReady}>
                  {sending ? "Sending..." : (
                    <>
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">send</span>
                      Send
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-slate-400 min-h-[400px]">
              Select a {user.role === "adviser" ? "subject teacher" : "adviser"} to start a secure conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
