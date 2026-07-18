import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DownloadSimple,
  LinkSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  SignOut,
  Sparkle,
  WifiHigh,
  X,
} from '@phosphor-icons/react';
import type { LobbyPeer } from '@beam/shared';
import { NameGate } from '@/components/drop/NameGate';
import { PeerOrb } from '@/components/drop/PeerOrb';
import { IncomingOffer } from '@/components/drop/IncomingOffer';
import { DropProgress } from '@/components/drop/DropProgress';
import { SaveFileButton } from '@/components/drop/SaveFileButton';
import { LobbyAtmosphere } from '@/components/drop/LobbyAtmosphere';
import { useOfficeLobby } from '@/hooks/useOfficeLobby';
import { SenderSession } from '@/lib/session/senderSession';
import { ReceiverSession } from '@/lib/session/receiverSession';
import { SIGNALING_URL } from '@/config/env';
import { loadDisplayName, saveDisplayName } from '@/lib/device';
import { accentGradient, initials } from '@/lib/accents';
import { formatBytes } from '@/lib/utils';
import { packFilesForSend } from '@/lib/packFiles';
import type { CompletedFile, TransferProgress } from '@/lib/transfer';

type Phase =
  | 'gate'
  | 'lobby'
  | 'sending'
  | 'receiving'
  | 'complete-send'
  | 'complete-receive';

export function DropPage() {
  const lobby = useOfficeLobby();
  const [phase, setPhase] = useState<Phase>('gate');
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<LobbyPeer | null>(null);
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const senderRef = useRef<SenderSession | null>(null);
  const receiverRef = useRef<ReceiverSession | null>(null);

  const resetTransfer = useCallback(() => {
    senderRef.current?.close();
    senderRef.current = null;
    receiverRef.current?.close();
    receiverRef.current = null;
    setProgress(null);
    setError(null);
    setCompleted([]);
    setStatusText('');
    setSelected(null);
    setPhase('lobby');
  }, []);

  useEffect(() => {
    if (lobby.status === 'online' && phase === 'gate') setPhase('lobby');
  }, [lobby.status, phase]);

  const onJoin = (name: string) => {
    saveDisplayName(name);
    lobby.join(name);
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setFiles((prev) => [...prev, ...incoming]);
  };

  const startSend = async (peer: LobbyPeer) => {
    if (!lobby.signaling || files.length === 0) return;
    const senderName = lobby.self?.displayName || loadDisplayName() || 'Someone';
    setSelected(peer);
    setPhase('sending');
    setStatusText(
      files.length > 1 ? 'Packing into one folder…' : `Waiting for ${peer.displayName} to accept…`,
    );
    setError(null);
    setProgress(null);

    senderRef.current?.close();
    const session = new SenderSession(SIGNALING_URL, window.location.origin);
    senderRef.current = session;

    session.on('progress', setProgress);
    session.on('state', (s) => {
      if (s === 'preparing') setStatusText('Encrypting…');
      if (s === 'waiting') setStatusText(`Waiting for ${peer.displayName}…`);
      if (s === 'connected' || s === 'sending') setStatusText(`Sending to ${peer.displayName}`);
      if (s === 'complete') setPhase('complete-send');
    });
    session.on('declined', () => {
      setError(`${peer.displayName} declined.`);
      setPhase('lobby');
    });
    session.on('error', (msg) => {
      setError(msg);
      setPhase('lobby');
    });

    try {
      const payload = await packFilesForSend(files, senderName);
      if (payload.length === 1 && files.length > 1) {
        setStatusText(`Waiting for ${peer.displayName} to accept…`);
      }
      await session.startToPeer(payload, {
        signaling: lobby.signaling,
        toPeerId: peer.peerId,
        ownsSignaling: false,
      });
    } catch (e) {
      setError((e as Error).message);
      setPhase('lobby');
    }
  };

  const acceptOffer = async () => {
    const offer = lobby.incoming;
    if (!offer || !lobby.signaling) return;
    lobby.respondToOffer(true);
    setPhase('receiving');
    setStatusText(`Receiving from ${offer.from.displayName}…`);
    setError(null);
    setProgress(null);

    receiverRef.current?.close();
    const session = new ReceiverSession(SIGNALING_URL);
    receiverRef.current = session;

    session.on('progress', setProgress);
    session.on('state', (s) => {
      if (s === 'joining' || s === 'connecting') {
        setStatusText(`Connecting to ${offer.from.displayName}…`);
      }
      if (s === 'receiving') setStatusText(`Receiving from ${offer.from.displayName}`);
      if (s === 'verifying') setStatusText('Verifying…');
    });
    session.on('complete', (done) => {
      setCompleted(done);
      setPhase('complete-receive');
      lobby.clearIncoming();
    });
    session.on('error', (msg) => {
      setError(msg);
      lobby.clearIncoming();
      setPhase('lobby');
    });

    try {
      await session.start(offer.roomId, offer.keyFragment, {
        signaling: lobby.signaling,
        ownsSignaling: false,
      });
    } catch (e) {
      setError((e as Error).message);
      lobby.clearIncoming();
      setPhase('lobby');
    }
  };

  const declineOffer = () => {
    lobby.respondToOffer(false);
  };

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const busyTransfer = phase === 'sending' || phase === 'receiving';

  return (
    <div className="relative min-h-[100dvh]">
      <div className="aurora" aria-hidden />
      <div className="noise" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pb-2 pt-6 sm:px-8 sm:pt-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5ac8fa] via-[#007aff] to-[#af52de] text-white shadow-lg shadow-blue-500/20">
            <Sparkle weight="fill" className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold tracking-tight">Drop</div>
            <div className="text-xs font-medium text-[var(--color-ink-faint)]">
              Internal office AirDrop
            </div>
          </div>
        </div>

        {lobby.self && (
          <div className="glass flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[0.7rem] font-semibold text-white"
              style={{ background: accentGradient(lobby.self.accent) }}
            >
              {initials(lobby.self.displayName)}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-none">{lobby.self.displayName}</div>
              <div className="mt-1 flex items-center gap-1 text-[0.68rem] font-medium text-[var(--color-ink-faint)]">
                <WifiHigh weight="bold" className="h-3 w-3 text-[#34c759]" />
                {lobby.status === 'reconnecting' ? 'Reconnecting…' : 'Online'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                resetTransfer();
                setFiles([]);
                lobby.leave();
                setPhase('gate');
              }}
              className="ml-1 rounded-full p-1.5 text-[var(--color-ink-faint)] transition hover:bg-black/5 hover:text-[var(--color-ink)]"
              aria-label="Leave lobby"
            >
              <SignOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        {phase === 'gate' && (
          <div className="relative flex min-h-[70dvh] items-center justify-center">
            <LobbyAtmosphere />
            <div className="relative z-10 w-full">
              <NameGate
                initialName={loadDisplayName()}
                busy={lobby.status === 'connecting'}
                onJoin={onJoin}
              />
            </div>
          </div>
        )}

        {phase !== 'gate' && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              className="mb-8 text-center"
            >
              <h1 className="font-display text-[2.4rem] font-semibold tracking-tight sm:text-[3.25rem]">
                {busyTransfer || phase.startsWith('complete')
                  ? statusText || 'Transfer'
                  : 'Who’s nearby?'}
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-[0.98rem] text-[var(--color-ink-soft)]">
                {busyTransfer
                  ? 'Encrypted peer-to-peer — nothing uploaded to the cloud.'
                  : 'Drop files below, then tap a person. Works across Mac, Windows, and Linux.'}
              </p>
            </motion.div>

            <AnimatePresence mode="wait">
              {(phase === 'lobby' || phase === 'complete-send' || phase === 'complete-receive') && (
                <motion.div
                  key="lobby"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                  className="space-y-8"
                >
                  {/* Files tray */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      addFiles(Array.from(e.dataTransfer.files));
                    }}
                    className={`glass rounded-[2rem] p-5 transition duration-500 sm:p-6 ${
                      dragOver ? 'ring-4 ring-[#007aff]/20' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-display text-lg font-semibold tracking-tight">
                          {files.length === 0 ? 'Add files to send' : `${files.length} ready to drop`}
                        </div>
                        <div className="mt-1 text-sm text-[var(--color-ink-soft)]">
                          {files.length === 0
                            ? 'Drag & drop anywhere here, or browse.'
                            : files.length > 1
                              ? `${formatBytes(totalBytes)} · will send as one “Files by …” folder`
                              : formatBytes(totalBytes)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#12131a] px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                      >
                        <Plus weight="bold" className="h-4 w-4" />
                        Add files
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addFiles(Array.from(e.target.files ?? []));
                          e.target.value = '';
                        }}
                      />
                    </div>

                    {files.length > 0 && (
                      <ul className="mt-4 max-h-36 space-y-2 overflow-auto">
                        {files.map((f, i) => (
                          <li
                            key={f.name + f.size + i}
                            className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-3 py-2.5 text-sm"
                          >
                            <span className="truncate font-medium">{f.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="tabular-nums text-[var(--color-ink-faint)]">
                                {formatBytes(f.size)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                className="rounded-full p-1 text-[var(--color-ink-faint)] hover:bg-black/5 hover:text-[var(--color-ink)]"
                              >
                                <X weight="bold" className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Peers */}
                  <div className="glass rounded-[2rem] p-6 sm:p-8">
                    <div className="mb-6 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink-soft)]">
                        <MagnifyingGlass weight="bold" className="h-4 w-4" />
                        {lobby.peers.length === 0
                          ? 'Looking for people…'
                          : `${lobby.peers.length} online`}
                      </div>
                      {files.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#007aff]">
                          <PaperPlaneTilt weight="fill" className="h-3.5 w-3.5" />
                          Tap someone
                        </div>
                      )}
                    </div>

                    {lobby.peers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="relative mb-6">
                          <div className="pulse-ring absolute inset-0 rounded-full border border-[#007aff]/40" />
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/70 text-[#007aff] peer-ring">
                            <WifiHigh weight="duotone" className="h-8 w-8" />
                          </div>
                        </div>
                        <div className="font-display text-xl font-semibold tracking-tight">
                          You’re the first one here
                        </div>
                        <p className="mt-2 max-w-sm text-sm text-[var(--color-ink-soft)]">
                          Ask teammates to open Drop on their Mac, Windows, or Linux browser.
                          They’ll pop in as glowing orbs.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-center gap-x-6 gap-y-8 sm:gap-x-10">
                        {lobby.peers.map((peer, i) => (
                          <PeerOrb
                            key={peer.peerId}
                            peer={peer}
                            index={i}
                            selected={selected?.peerId === peer.peerId}
                            disabled={files.length === 0}
                            onSelect={(p) => {
                              if (files.length === 0) return;
                              void startSend(p);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {files.length === 0 && lobby.peers.length > 0 && (
                      <p className="mt-8 text-center text-sm text-[var(--color-ink-faint)]">
                        Add files above, then tap a person to send.
                      </p>
                    )}
                  </div>

                  {(phase === 'complete-send' || phase === 'complete-receive') && (
                    <div className="glass-strong rounded-[2rem] p-6 text-center sm:p-8">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#34c759] text-white shadow-lg shadow-green-500/30">
                        {phase === 'complete-receive' ? (
                          <DownloadSimple weight="bold" className="h-6 w-6" />
                        ) : (
                          <PaperPlaneTilt weight="fill" className="h-6 w-6" />
                        )}
                      </div>
                      <div className="font-display text-2xl font-semibold tracking-tight">
                        {phase === 'complete-send' ? 'Delivered' : 'Ready to download'}
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                        {phase === 'complete-send'
                          ? 'Your drop landed peer-to-peer.'
                          : 'One download — everything is in there.'}
                      </p>

                      {phase === 'complete-receive' && completed.length > 0 && (
                        <div className="mx-auto mt-6 max-w-md space-y-3">
                          {completed.map((f) => (
                            <SaveFileButton
                              key={f.name + f.size}
                              file={f}
                              hint={
                                f.name.toLowerCase().endsWith('.zip')
                                  ? 'Unzip to open the folder'
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setFiles([]);
                          resetTransfer();
                        }}
                        className={`mt-6 rounded-full px-6 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                          phase === 'complete-receive'
                            ? 'bg-white/70 text-[var(--color-ink)] hover:bg-white'
                            : 'bg-[#12131a] text-white'
                        }`}
                      >
                        {phase === 'complete-receive' ? 'Done' : 'Back to lobby'}
                      </button>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <Link
                      to="/send"
                      className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink-soft)] transition hover:text-[var(--color-ink)]"
                    >
                      <LinkSimple weight="bold" className="h-4 w-4" />
                      Or send with a share link
                    </Link>
                  </div>
                </motion.div>
              )}

              {(phase === 'sending' || phase === 'receiving') && (
                <motion.div
                  key="transfer"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mx-auto w-full max-w-lg"
                >
                  <div className="glass-strong rounded-[2rem] p-6 sm:p-8">
                    {selected && phase === 'sending' && (
                      <div className="mb-6 flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white peer-ring"
                          style={{ background: accentGradient(selected.accent) }}
                        >
                          {initials(selected.displayName)}
                        </div>
                        <div>
                          <div className="font-semibold">{selected.displayName}</div>
                          <div className="text-sm text-[var(--color-ink-soft)]">
                            {statusText}
                          </div>
                        </div>
                      </div>
                    )}
                    {progress ? (
                      <DropProgress
                        progress={progress}
                        label={phase === 'sending' ? 'Sending' : 'Receiving'}
                      />
                    ) : (
                      <div className="py-10 text-center text-sm text-[var(--color-ink-soft)]">
                        {statusText || 'Starting…'}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={resetTransfer}
                      className="mt-6 w-full rounded-full bg-white/70 py-2.5 text-sm font-semibold text-[var(--color-ink)]"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {(error || lobby.error) && (
              <div className="mx-auto mt-6 max-w-lg rounded-2xl bg-[#ff3b30]/10 px-4 py-3 text-center text-sm font-medium text-[#c41e17]">
                {error || lobby.error}
              </div>
            )}
          </>
        )}
      </main>

      <IncomingOffer
        offer={phase === 'receiving' ? null : lobby.incoming}
        onAccept={() => void acceptOffer()}
        onDecline={declineOffer}
      />
    </div>
  );
}
