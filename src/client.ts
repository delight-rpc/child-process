import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'
import { Deferred } from 'extra-promise'
import { CustomError } from '@blackglory/errors'

export function createClient<IAPI extends object>(
  process: ChildProcess | NodeJS.Process
, parameterValidators?: DelightRPC.ParameterValidators<IAPI>
, expectedVersion?: `${number}.${number}.${number}`
): [client: DelightRPC.ClientProxy<IAPI>, close: () => void] {
  const pendings: { [id: string]: Deferred<DelightRPC.IResponse<unknown>> } = {}

  process.on('message', handler)

  const client = DelightRPC.createClient<IAPI>(
    async function send(request: DelightRPC.IRequest<unknown>) {
      const res = new Deferred<DelightRPC.IResponse<unknown>>()
      pendings[request.id] = res
      try {
        process.send!(request)
        return await res
      } finally {
        delete pendings[request.id]
      }
    }
  , parameterValidators
  , expectedVersion
  )

  return [client, close]

  function close() {
    process.off('message', handler)

    for (const [key, deferred] of Object.entries(pendings)) {
      deferred.reject(new ClientClosed())
      delete pendings[key]
    }
  }

  function handler(res: any): void {
    if (DelightRPC.isResult(res) || DelightRPC.isError(res)) {
      pendings[res.id].resolve(res)
    }
  }
}

export function createBatchClient(
  process: ChildProcess | NodeJS.Process
, expectedVersion?: `${number}.${number}.${number}`
): [client: DelightRPC.BatchClient, close: () => void] {
  const pendings: {
    [id: string]: Deferred<DelightRPC.IError | DelightRPC.IBatchResponse<unknown>>
  } = {}

  process.on('message', handler)

  const client = new DelightRPC.BatchClient(
    async function send(request: DelightRPC.IBatchRequest<unknown>) {
      const res = new Deferred<
      | DelightRPC.IError
      | DelightRPC.IBatchResponse<unknown>
      >()
      pendings[request.id] = res
      try {
        process.send!(request)
        return await res
      } finally {
        delete pendings[request.id]
      }
    }
  , expectedVersion
  )

  return [client, close]

  function close() {
    process.off('message', handler)

    for (const [key, deferred] of Object.entries(pendings)) {
      deferred.reject(new ClientClosed())
      delete pendings[key]
    }
  }

  function handler(res: any): void {
    if (DelightRPC.isError(res) || DelightRPC.isBatchResponse(res)) {
      pendings[res.id].resolve(res)
    }
  }
}

export class ClientClosed extends CustomError {}
