import { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { FiHash, FiHeadphones, FiX } from 'react-icons/fi';

/**
 * CreateChannelModal — modal to create a new text or voice channel
 */
export default function CreateChannelModal() {
  const { setShowCreateChannel, createChannel, activeWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');

    if (!cleanName) {
      setError('Channel name is required');
      return;
    }

    if (cleanName.length < 2) {
      setError('Channel name must be at least 2 characters');
      return;
    }

    // Check for duplicate
    const exists = activeWorkspace?.channels.some(
      (c) => c.name === cleanName && c.type === type
    );
    if (exists) {
      setError(`A ${type} channel with this name already exists`);
      return;
    }

    createChannel(cleanName, type, description.trim());
    setShowCreateChannel(false);
  };

  return (
    <div className="discord-modal-overlay" onClick={() => setShowCreateChannel(false)}>
      <div className="discord-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between discord-modal-header">
          <span>Create Channel</span>
          <button
            onClick={() => setShowCreateChannel(false)}
            className="flex h-8 w-8 items-center justify-center rounded text-[#949ba4] hover:bg-[#36373c] hover:text-[#dbdee1]"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="discord-modal-body">
            {/* Channel Type */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide">
                Channel Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('text')}
                  className={`flex items-center gap-3 rounded border px-4 py-3 text-sm transition ${
                    type === 'text'
                      ? 'border-[#5865F2] bg-[#5865F2]/10 text-[#dbdee1]'
                      : 'border-[#1f2022] bg-[#383a40] text-[#949ba4] hover:border-[#393b41]'
                  }`}
                >
                  <FiHash className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Text</div>
                    <div className="text-xs text-[#6d6f78]">Chat, files, images</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setType('voice')}
                  className={`flex items-center gap-3 rounded border px-4 py-3 text-sm transition ${
                    type === 'voice'
                      ? 'border-[#5865F2] bg-[#5865F2]/10 text-[#dbdee1]'
                      : 'border-[#1f2022] bg-[#383a40] text-[#949ba4] hover:border-[#393b41]'
                  }`}
                >
                  <FiHeadphones className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Voice</div>
                    <div className="text-xs text-[#6d6f78]">Voice conversations</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Channel Name */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide">
                Channel Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6d6f78]">
                  {type === 'text' ? '#' : '🔊'}
                </span>
                <input
                  type="text"
                  className="discord-input pl-8"
                  placeholder={type === 'text' ? 'new-channel' : 'new-voice'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  maxLength={32}
                />
              </div>
            </div>

            {/* Description (text channels only) */}
            {type === 'text' && (
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide">
                  Description (optional)
                </label>
                <input
                  type="text"
                  className="discord-input"
                  placeholder="What's this channel about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={128}
                />
              </div>
            )}

            {error && (
              <div className="mb-4 rounded border border-[#ed4245]/30 bg-[#ed4245]/10 px-3 py-2 text-sm text-[#ed4245]">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="discord-modal-footer">
            <button
              type="button"
              onClick={() => setShowCreateChannel(false)}
              className="discord-btn discord-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="discord-btn discord-btn-primary"
            >
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
