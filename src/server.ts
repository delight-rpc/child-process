import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'
import { isntNull } from '@blackglory/prelude'

export function createServer<IAPI extends object>(
  api: DelightRPC.ImplementationOf<IAPI>
, process: ChildProcess | NodeJS.Process
, { parameterValidators, version, channel }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    version?: `${number}.${number}.${number}`
    channel?: string
  } = {}
): () => void {
  process.on('message', handler)
  return () => process.off('message', handler)

  async function handler(req: any): Promise<void> {
    if (DelightRPC.isRequest(req) || DelightRPC.isBatchRequest(req)) {
      const result = await DelightRPC.createResponse(
        api
      , req
      , {
          parameterValidators
        , version
        , channel
        }
      )

      if (isntNull(result)) {
        process.send!(result)
      }
    }
  }
}
