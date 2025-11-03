import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'
import { Deferred } from 'extra-promise'
import { CustomError } from '@blackglory/errors'
import { IRequest, IResponse, IError, IBatchRequest, IBatchResponse } from '@delight-rpc/protocol'

export function createClient<IAPI extends object>(
  process: ChildProcess | NodeJS.Process
, { parameterValidators, expectedVersion, channel }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    expectedVersion?: string
    channel?: string
  } = {}
): [client: DelightRPC.ClientProxy<IAPI>, close: () => void] {
  const pendings: Map<string, Deferred<IResponse<unknown>>> = new Map()

  process.on('message', handler)

  const client = DelightRPC.createClient<IAPI>(
    async function send(request: IRequest<unknown>) {
      const res = new Deferred<IResponse<unknown>>()
      pendings.set(request.id, res)
      try {
        process.send!(request)
        return await res
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

  function close() {
    process.off('message', handler)

    for (const [key, deferred] of Object.entries(pendings)) {
      deferred.reject(new ClientClosed())
      pendings.delete(key)
    }
  }

  function handler(res: any): void {
    if (DelightRPC.isResult(res) || DelightRPC.isError(res)) {
      pendings.get(res.id)?.resolve(res)
    }
  }
}

export function createBatchClient<DataType>(
  process: ChildProcess | NodeJS.Process
, { expectedVersion, channel }: {
    expectedVersion?: string
    channel?: string
  } = {}
): [client: DelightRPC.BatchClient<DataType>, close: () => void] {
  const pendings: Map<
    string
  , Deferred<IError | IBatchResponse<unknown>>
  > = new Map()

  process.on('message', handler)

  const client = new DelightRPC.BatchClient(
    async function send(request: IBatchRequest<unknown>) {
      const res = new Deferred<
      | IError
      | IBatchResponse<unknown>
      >()
      pendings.set(request.id, res)
      try {
        process.send!(request)
        return await res
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

  function close() {
    process.off('message', handler)

    for (const [key, deferred] of Object.entries(pendings)) {
      deferred.reject(new ClientClosed())
      pendings.delete(key)
    }
  }

  function handler(res: any): void {
    if (DelightRPC.isError(res) || DelightRPC.isBatchResponse(res)) {
      pendings.get(res.id)?.resolve(res)
    }
  }
}

export class ClientClosed extends CustomError {}
