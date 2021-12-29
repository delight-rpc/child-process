import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'

export function createServer<IAPI extends object>(
  api: IAPI
, process: ChildProcess | NodeJS.Process
, parametersValidators?: DelightRPC.ParameterValidators<IAPI>
): () => void {
  process.on('message', handler)
  return () => process.off('message', handler)

  async function handler(req: any): Promise<void> {
    if (DelightRPC.isRequest(req)) {
      const result = await DelightRPC.createResponse(api, req, parametersValidators)

      process.send!(result)
    }
  }
}
