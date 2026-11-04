/// <reference lib="webworker" />
import { GeometryEngine } from './engine'
import type { ToWorker } from './protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope

const engine = new GeometryEngine((m, transfer) => scope.postMessage(m, transfer ?? []))

scope.onmessage = (ev: MessageEvent<ToWorker>) => {
  engine.handle(ev.data).catch((err: unknown) => {
    scope.postMessage({
      type: 'error',
      requestId: ev.data.requestId,
      issues: [{ code: 'WORKER_ERROR', severity: 'error', message: `Kesalahan worker: ${(err as Error).message}` }],
    })
  })
}
