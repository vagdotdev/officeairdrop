import { useEffect, useRef, useState } from 'react';
import { ChatCircleDots, PaperPlaneRight } from '@phosphor-icons/react';
import type { IncomingChatMessage } from '@beam/shared';
import { accentGradient, initials } from '@/lib/accents';

interface ChatPanelProps {
  messages: IncomingChatMessage[];
  selfPeerId?: string;
  disabled?: boolean;
  onSend: (text: string) => void;
}

/** Lobby-wide chat: everyone who entered a name can talk here. Live only. */
export function ChatPanel({ messages, selfPeerId, disabled, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <aside className="glass relative z-10 mx-5 mb-10 flex h-[26rem] flex-col rounded-[2rem] sm:mx-8 lg:fixed lg:inset-y-6 lg:right-6 lg:m-0 lg:h-auto lg:w-80">
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#12131a] px-3 py-1 text-xs font-semibold text-white">
          <ChatCircleDots weight="fill" className="h-3.5 w-3.5" />
          Chat
        </span>
        <span className="text-xs font-medium text-[var(--color-ink-faint)]">
          Everyone in the lobby
        </span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="font-display text-base font-semibold tracking-tight">
              No messages yet
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Say hi — everyone in the lobby will see it.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.from.peerId === selfPeerId;
            return (
              <div key={i} className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
                {!mine && (
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-semibold text-white"
                    style={{ background: accentGradient(m.from.accent) }}
                  >
                    {initials(m.from.displayName)}
                  </div>
                )}
                <div className="min-w-0 max-w-[80%]">
                  {!mine && (
                    <div className="mb-1 truncate px-1 text-[0.68rem] font-semibold text-[var(--color-ink-faint)]">
                      {m.from.displayName}
                    </div>
                  )}
                  <div
                    className={`break-words rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? 'bg-[#007aff] text-white' : 'bg-white/75 text-[var(--color-ink)]'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="flex items-center gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled || !draft.trim()) return;
          onSend(draft);
          setDraft('');
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          disabled={disabled}
          placeholder={disabled ? 'Reconnecting…' : 'Message everyone…'}
          className="min-w-0 flex-1 rounded-full border border-white/70 bg-white/70 px-4 py-2.5 text-sm outline-none transition duration-300 placeholder:text-[var(--color-ink-faint)] focus:border-[#007aff]/50 focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,122,255,0.15)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#12131a] text-white transition active:scale-[0.96] disabled:opacity-40"
        >
          <PaperPlaneRight weight="fill" className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}
