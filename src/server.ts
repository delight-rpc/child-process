import * as DelightRPC from 'delight-rpc'
import { ChildProcess } from 'child_process'
import { isntNull, pass } from '@blackglory/prelude'
import { AbortController } from 'extra-abort'
import { HashMap } from '@blackglory/structures'
import { SyncDestructor } from 'extra-defer'

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
  const destructor = new SyncDestructor()

  const channelIdToController: HashMap<
    {
      channel?: string
    , id: string
    }
  , AbortController
  > = new HashMap(({ channel, id }) => JSON.stringify([channel, id]))
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

  return close

  function close(): void {
    destructor.execute()
  }

  function abortAllPendings(): void {
    for (const controller of channelIdToController.values()) {
      controller.abort()
    }

    channelIdToController.clear()
  }

  async function receive(message: unknown): Promise<void> {
    if (DelightRPC.isRequest(message) || DelightRPC.isBatchRequest(message)) {
      const destructor = new SyncDestructor()

      const controller = new AbortController()
      channelIdToController.set(message, controller)
      destructor.defer(() => channelIdToController.delete(message))

      try {
        const result = await DelightRPC.createResponse(
          api
        , message
        , {
            parameterValidators
          , version
          , channel
          , ownPropsOnly
          , signal: controller.signal
          }
        )

        if (isntNull(result)) {
          // @ts-expect-error TypeScript无法正确合并`ChildProcess` 和 `NodeJS.Process`的send方法.
          process.send!(result, err => {
            if (err) {
              if ((err as NodeJS.ErrnoException).code === 'ERR_IPC_CHANNEL_CLOSED') {
                pass()
              } else {
                // 如果存在其他错误, 让进程崩溃.
                throw err
              }
            }
          })
        }
      } finally {
        destructor.execute()
      }
    } else if (DelightRPC.isAbort(message)) {
      if (DelightRPC.matchChannel(message, channel)) {
        channelIdToController.get(message)?.abort()
        channelIdToController.delete(message)
      }
    }
  }
}
