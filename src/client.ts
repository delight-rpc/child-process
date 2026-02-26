import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'
import { Deferred } from 'extra-promise'
import { assert, CustomError } from '@blackglory/errors'
import { IResponse, IError, IBatchRequest, IBatchResponse } from '@delight-rpc/protocol'
import { raceAbortSignals, timeoutSignal, withAbortSignal } from 'extra-abort'
import { isntUndefined } from '@blackglory/prelude'
import { SyncDestructor } from 'extra-defer'

export function createClient<IAPI extends object>(
  process: ChildProcess | NodeJS.Process
, { parameterValidators, expectedVersion, channel, timeout }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    expectedVersion?: string
    channel?: string
    timeout?: number
  } = {}
): [client: DelightRPC.ClientProxy<IAPI>, close: () => void] {
  const destructor = new SyncDestructor()

  const pendings: Map<string, Deferred<IResponse<unknown>>> = new Map()
  destructor.defer(abortAllPendings)

  process.on('message', receive)
  destructor.defer(() => process.off('message', receive))

  if (process instanceof ChildProcess) {
    process.on('exit', close)
    destructor.defer(() => process.off('exit', close))
  } else {
    process.on('exit', close)
    destructor.defer(() => process.off('exit', close))
  }

  process.on('disconnect', abortAllPendings)
  destructor.defer(() => process.off('disconnect', abortAllPendings))

  const client = DelightRPC.createClient<IAPI>(
    async function send(request, signal) {
      const destructor = new SyncDestructor()

      const res = new Deferred<IResponse<unknown>>()
      pendings.set(request.id, res)
      destructor.defer(() => pendings.delete(request.id))

      try {
        const success = process.send!(request)
        assert(success, 'The child process is busy')

        const mergedSignal = raceAbortSignals([
          isntUndefined(timeout) && timeoutSignal(timeout)
        , signal
        ])
        mergedSignal.addEventListener('abort', sendAbort)
        destructor.defer(() => mergedSignal.removeEventListener('abort', sendAbort))

        return await withAbortSignal(mergedSignal, () => res)
      } finally {
        destructor.execute()
      }

      function sendAbort(): void {
        const abort = DelightRPC.createAbort(request.id, channel)
        process.send!(abort)
      }
    }
  , {
      parameterValidators
    , expectedVersion
    , channel
    }
  )

  return [client, close]

  function close(): void {
    destructor.execute()
  }

  function abortAllPendings(): void {
    const err = new ClientClosed()

    for (const deferred of pendings.values()) {
      deferred.reject(err)
    }

    pendings.clear()
  }

  function receive(res: unknown): void {
    if (DelightRPC.isResult(res) || DelightRPC.isError(res)) {
      pendings.get(res.id)?.resolve(res)
    }
  }
}

export function createBatchClient<DataType>(
  process: ChildProcess | NodeJS.Process
, { expectedVersion, channel, timeout }: {
    expectedVersion?: string
    channel?: string
    timeout?: number
  } = {}
): [client: DelightRPC.BatchClient<DataType>, close: () => void] {
  const destructor = new SyncDestructor()

  const pendings: Map<string, Deferred<IError | IBatchResponse<unknown>>> = new Map()
  destructor.defer(abortAllPendings)

  process.on('message', receive)
  destructor.defer(() => process.off('message', receive))

  if (process instanceof ChildProcess) {
    process.on('exit', close)
    destructor.defer(() => process.off('exit', close))
  } else {
    process.on('exit', close)
    destructor.defer(() => process.off('exit', close))
  }

  process.on('disconnect', abortAllPendings)
  destructor.defer(() => process.off('disconnect', abortAllPendings))

  const client = new DelightRPC.BatchClient(
    async function send(request: IBatchRequest<unknown>) {
      const destructor = new SyncDestructor()

      const res = new Deferred<IError | IBatchResponse<unknown>>()
      pendings.set(request.id, res)
      destructor.defer(() => pendings.delete(request.id))

      try {
        const success = process.send!(request)
        assert(success, 'The child process is busy')

        const mergedSignal = raceAbortSignals([
          isntUndefined(timeout) && timeoutSignal(timeout)
        ])
        mergedSignal.addEventListener('abort', sendAbort)
        destructor.defer(() => mergedSignal.removeEventListener('abort', sendAbort))

        return await withAbortSignal(mergedSignal, () => res)
      } finally {
        destructor.execute()
      }

      function sendAbort(): void {
        const abort = DelightRPC.createAbort(request.id, channel)
        process.send!(abort)
      }
    }
  , {
      expectedVersion
    , channel
    }
  )

  return [client, close]

  function close(): void {
    destructor.execute()
  }

  function abortAllPendings(): void {
    const err = new ClientClosed()

    for (const deferred of pendings.values()) {
      deferred.reject(err)
    }

    pendings.clear()
  }

  function receive(res: unknown): void {
    if (DelightRPC.isError(res) || DelightRPC.isBatchResponse(res)) {
      pendings.get(res.id)?.resolve(res)
    }
  }
}

export class ClientClosed extends CustomError {}
