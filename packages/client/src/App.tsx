import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrowserSupportGate } from '@/components/BrowserSupportGate';

const DropPage = lazy(() => import('@/pages/Drop').then((m) => ({ default: m.DropPage })));
const SendPage = lazy(() => import('@/pages/Send').then((m) => ({ default: m.SendPage })));
const ReceivePage = lazy(() =>
  import('@/pages/Receive').then((m) => ({ default: m.ReceivePage })),
);
const ParkPage = lazy(() => import('@/pages/Park').then((m) => ({ default: m.ParkPage })));
const RecoverPage = lazy(() =>
  import('@/pages/Recover').then((m) => ({ default: m.RecoverPage })),
);

/**
 * Routes:
 *   /            office AirDrop lobby
 *   /send        classic share-link sender
 *   /r/:roomId   classic share-link receiver
 *   /park        encrypted temporary cloud parking
 *   /recover/:parkId  recover a parked transfer
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
            <Route path="/park" element={<ParkPage />} />
            <Route path="/recover/:parkId" element={<RecoverPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </BrowserSupportGate>
  );
}
