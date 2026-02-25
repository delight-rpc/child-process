import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'
import { isntNull } from '@blackglory/prelude'
import { AbortController } from 'extra-abort'

export function createServer<IAPI extends object>(
  api: DelightRPC.ImplementationOf<IAPI>
, process: ChildProcess | NodeJS.Process
, { parameterValidators, version, channel, ownPropsOnly }: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    version?: `${number}.${number}.${number}`
    channel?: string | RegExp | typeof DelightRPC.AnyChannel
    ownPropsOnly?: boolean
  } = {}
): () => void {
  const idToController: Map<string, AbortController> = new Map()

  process.on('message', handler)
  process.on('disconnect', () => {
    for (const controller of idToController.values()) {
      controller.abort()
    }

    idToController.clear()
  })
  return () => process.off('message', handler)

  async function handler(message: unknown): Promise<void> {
    if (DelightRPC.isRequest(message) || DelightRPC.isBatchRequest(message)) {
      const controller = new AbortController()
      idToController.set(message.id, controller)

      try {
        const result = await DelightRPC.createResponse(
          api
        , message
        , {
            parameterValidators
          , version
          , channel
          , ownPropsOnly
          }
        )

        if (isntNull(result)) {
          process.send!(result)
        }
      } finally {
        idToController.delete(message.id)
      }
    } else if (DelightRPC.isAbort(message)) {
      if (DelightRPC.matchChannel(message, channel)) {
        idToController.get(message.id)?.abort()
        idToController.delete(message.id)
      }
    }
  }
}
