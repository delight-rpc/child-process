import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'
import { Deferred } from 'extra-promise'
import { CustomError } from '@blackglory/errors'
import { IResponse, IError, IBatchRequest, IBatchResponse } from '@delight-rpc/protocol'
import { raceAbortSignals, timeoutSignal, withAbortSignal } from 'extra-abort'
import { isntUndefined } from '@blackglory/prelude'

export function createClient<IAPI extends object>(
  process: ChildProcess | NodeJS.Process
, { parameterValidators, expectedVersion, channel, timeout }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    expectedVersion?: string
    channel?: string
    timeout?: number
  } = {}
): [client: DelightRPC.ClientProxy<IAPI>, close: () => void] {
  const pendings: Map<string, Deferred<IResponse<unknown>>> = new Map()

  process.on('message', handleMessage)
  process.on('disconnect', abortAllPendings)

  const client = DelightRPC.createClient<IAPI>(
    async function send(request, signal) {
      const res = new Deferred<IResponse<unknown>>()
      pendings.set(request.id, res)
      try {
        process.send!(request)

        const mergedSignal = raceAbortSignals([
          isntUndefined(timeout) && timeoutSignal(timeout)
        , signal
        ])
        mergedSignal.addEventListener('abort', () => {
          const abort = DelightRPC.createAbort(request.id, channel)
          process.send!(abort)
        })

        return await withAbortSignal(mergedSignal, () => res)
      } finally {
        pendings.delete(request.id)
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
    process.off('message', handleMessage)
    process.off('disconnect', abortAllPendings)
    abortAllPendings()
  }

  function abortAllPendings(): void {
    for (const deferred of pendings.values()) {
      deferred.reject(new ClientClosed())
    }

    pendings.clear()
  }

  function handleMessage(res: unknown): void {
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
  const pendings: Map<
    string
  , Deferred<IError | IBatchResponse<unknown>>
  > = new Map()

  process.on('message', handleMessage)
  process.on('disconnect', abortAllPendings)

  const client = new DelightRPC.BatchClient(
    async function send(request: IBatchRequest<unknown>) {
      const res = new Deferred<
      | IError
      | IBatchResponse<unknown>
      >()
      pendings.set(request.id, res)
      try {
        process.send!(request)

        const mergedSignal = raceAbortSignals([
          isntUndefined(timeout) && timeoutSignal(timeout)
        ])
        mergedSignal.addEventListener('abort', () => {
          const abort = DelightRPC.createAbort(request.id, channel)
          process.send!(abort)
        })

        return await withAbortSignal(mergedSignal, () => res)
      } finally {
        pendings.delete(request.id)
      }
    }
  , {
      expectedVersion
    , channel
    }
  )

  return [client, close]

  function close(): void {
    process.off('message', handleMessage)
    process.off('disconnect', abortAllPendings)
    abortAllPendings()
  }

  function abortAllPendings(): void {
    for (const deferred of pendings.values()) {
      deferred.reject(new ClientClosed())
    }

    pendings.clear()
  }

  function handleMessage(res: unknown): void {
    if (DelightRPC.isError(res) || DelightRPC.isBatchResponse(res)) {
      pendings.get(res.id)?.resolve(res)
    }
  }
}

export class ClientClosed extends CustomError {}
