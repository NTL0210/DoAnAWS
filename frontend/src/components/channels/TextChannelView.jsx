import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { FiSend, FiPaperclip, FiHash, FiImage } from 'react-icons/fi';

/**
 * TextChannelView — Discord-style chat interface for text channels
 */
export default function TextChannelView() {
  const {
    activeChannel,
    activeWorkspace,
    currentUser,
    channelMessages,
    sendMessage,
    can,
    userRole,
    workspaceMembers,
  } = useWorkspace();

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    sendMessage(activeChannel.id, message);
    setMessage('');
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // For now, just send a message with file name
    sendMessage(activeChannel.id, `📎 Uploaded: ${file.name}`);
    e.target.value = '';
  };

  // Build user map for quick lookup
  const userMap = {};
  const allUsers = workspaceMembers.concat([currentUser]);
  allUsers.forEach((m) => {
    userMap[m.userId] = m;
  });
  // currentUser may not be in workspaceMembers as a member entry
  if (currentUser) {
    userMap[currentUser.id] = currentUser;
  }

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('vi-VN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canUpload = can('chat.upload') || userRole === 'OWNER';

  if (!activeChannel) {
    return (
      <div className="chat-empty">
        <h2>Select a channel</h2>
        <p>Choose a text channel from the sidebar to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ─── Channel Welcome ─── */}
      <div className="channel-welcome">
        <div className="welcome-hash">
          <FiHash className="inline text-[#6d6f78]" />
        </div>
        <h2>{activeChannel.name}</h2>
        <p>
          {activeChannel.description ||
            `This is the start of the #${activeChannel.name} channel.`}
        </p>
      </div>

      {/* ─── Messages Area ─── */}
      <div className="flex-1 overflow-y-auto discord-scroll">
        {channelMessages.length === 0 ? (
          <div className="chat-empty py-16">
            <h2>No messages yet</h2>
            <p>Be the first to send a message in this channel!</p>
          </div>
        ) : (
          <div className="pb-2">
            {/* Date divider for first message */}
            {channelMessages.map((msg, idx) => {
              const user = userMap[msg.userId] || {};
              const userName = user.name || user.nickname || 'Unknown';
              const userAvatar = user.avatar;

              // Check if we should show a date divider
              const showDateDivider =
                idx === 0 ||
                new Date(msg.createdAt).toDateString() !==
                  new Date(channelMessages[idx - 1]?.createdAt).toDateString();

              return (
                <div key={msg.id}>
                  {showDateDivider && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 border-t border-[#1f2022]" />
                      <span className="text-xs font-medium text-[#6d6f78]">
                        {new Date(msg.createdAt).toLocaleDateString('vi-VN', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="flex-1 border-t border-[#1f2022]" />
                    </div>
                  )}

                  <div className="chat-message group">
                    {/* Avatar */}
                    <div className="avatar">
                      {userAvatar ? (
                        <img src={userAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-xs font-bold text-white rounded-full"
                          style={{ backgroundColor: '#5865F2' }}
                        >
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Message content */}
                    <div className="min-w-0 flex-1">
                      <div className="msg-header">
                        <span className="username">{userName}</span>
                        <span className="timestamp">{formatTime(msg.createdAt)}</span>
                        {msg.userId === currentUser?.id && (
                          <span className="text-[10px] text-[#5865F2] font-medium">(you)</span>
                        )}
                      </div>
                      <div className="msg-content">
                        {renderContent(msg.content)}
                      </div>
                      {msg.attachments?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.attachments.map((att) => (
                            <div key={att.id} className="msg-attachment">
                              <span>📎</span>
                              <span>{att.name}</span>
                              {att.size && (
                                <span className="text-[#6d6f78] text-xs">({att.size})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Message Input ─── */}
      <div className="chat-input-wrapper">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <div className="flex items-center gap-1 py-2">
            {canUpload && (
              <>
                <button
                  type="button"
                  onClick={handleFileClick}
                  className="flex h-8 w-8 items-center justify-center rounded text-[#6d6f78] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
                  title="Attach file"
                >
                  <FiPaperclip className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </>
            )}
            <button
              type="button"
              onClick={handleFileClick}
              className="flex h-8 w-8 items-center justify-center rounded text-[#6d6f78] hover:text-[#dbdee1] hover:bg-[#2b2d31]"
              title="Upload image"
            >
              <FiImage className="h-4 w-4" />
            </button>
          </div>
          <input
            className="chat-input flex-1"
            placeholder={`Message #${activeChannel.name}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            type="submit"
            disabled={!message.trim() || sending}
            className="mb-2 flex h-8 w-8 items-center justify-center rounded text-[#6d6f78] hover:text-[#dbdee1] hover:bg-[#5865F2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FiSend className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Simple markdown-like content renderer
 * Supports **bold**, *italic*, and URLs
 */
function renderContent(text) {
  if (!text) return null;

  // Split by line breaks
  const lines = text.split('\n');

  return lines.map((line, i) => {
    // Process bold **text**
    const parts = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      // Bold match
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch) {
        if (boldMatch.index > 0) {
          parts.push(
            <span key={key++}>{boldMatch.input.slice(0, boldMatch.index)}</span>
          );
        }
        parts.push(
          <strong key={key++} className="font-semibold">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // URL detection
      const urlMatch = remaining.match(/(https?:\/\/[^\s<]+)/);
      if (urlMatch) {
        if (urlMatch.index > 0) {
          parts.push(
            <span key={key++}>{urlMatch.input.slice(0, urlMatch.index)}</span>
          );
        }
        parts.push(
          <a
            key={key++}
            href={urlMatch[1]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00a8fc] hover:underline"
          >
            {urlMatch[1]}
          </a>
        );
        remaining = remaining.slice(urlMatch.index + urlMatch[0].length);
        continue;
      }

      // Leftover text
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    return (
      <div key={i} className="min-h-[22px]">
        {parts}
      </div>
    );
  });
}
