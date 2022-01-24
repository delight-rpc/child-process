import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'

export function createServer<IAPI extends object>(
  api: DelightRPC.ImplementationOf<IAPI>
, process: ChildProcess | NodeJS.Process
, parameterValidators?: DelightRPC.ParameterValidators<IAPI>
, version?: `${number}.${number}.${number}`
): () => void {
  process.on('message', handler)
  return () => process.off('message', handler)

  async function handler(req: any): Promise<void> {
    if (DelightRPC.isRequest(req)) {
      const result = await DelightRPC.createResponse(
        api
      , req
      , parameterValidators
      , version
      )

      process.send!(result)
    }
  }
}
