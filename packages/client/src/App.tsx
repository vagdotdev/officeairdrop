import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrowserSupportGate } from '@/components/BrowserSupportGate';

const DropPage = lazy(() => import('@/pages/Drop').then((m) => ({ default: m.DropPage })));
const SendPage = lazy(() => import('@/pages/Send').then((m) => ({ default: m.SendPage })));
const ReceivePage = lazy(() =>
  import('@/pages/Receive').then((m) => ({ default: m.ReceivePage })),
);

/**
 * Routes:
 *   /            office AirDrop lobby
 *   /send        classic share-link sender
 *   /r/:roomId   classic share-link receiver
 */
export function App() {
  return (
    <BrowserSupportGate>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<DropPage />} />
            <Route path="/send" element={<SendPage />} />
            <Route path="/r/:roomId" element={<ReceivePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </BrowserSupportGate>
  );
}
