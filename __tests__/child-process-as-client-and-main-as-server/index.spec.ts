import { createClient } from '@src/client.js'
import { createServer } from '@src/server.js'
import { fork } from 'child_process'
import { ImplementationOf } from 'delight-rpc'
import { IAPI } from './contract.js'
import * as path from 'path'
import { getErrorPromise } from 'return-style'
import { fileURLToPath } from 'url'
import { assert } from '@blackglory/errors'
import { delay } from 'extra-promise'
import { AbortError } from 'extra-abort'

const api: ImplementationOf<IAPI> = {
  echo(message: string): string {
    return message
  }
, error(message: string): never {
    throw new Error(message)
  }
, async loop(signal?: AbortSignal): Promise<never> {
    assert(signal)

    while (!signal.aborted) {
      await delay(100)
    }

    throw signal.reason
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filename = path.resolve(__dirname, './child-process.ts')

describe('ChildProcess as Client, Main as Server', () => {
  test('result', async () => {
    const childProcess = fork(filename, { serialization: 'advanced' })
    const cancelServer = createServer(api, childProcess)

    const [client, close] = createClient<{
      eval: (code: string) => any
    }>(childProcess)
    try {
      const result = await client.eval(`
        client.echo('foo')
      `)

      expect(result).toEqual('foo')
    } finally {
      close()
      cancelServer()
      childProcess.kill()
    }
  })

  test('error', async () => {
    const childProcess = fork(filename, { serialization: 'advanced' })
    const cancelServer = createServer(api, childProcess)

    const [client, close] = createClient<{
      eval: (code: string) => any
    }>(childProcess)
    try {
      const err = await getErrorPromise(client.eval(`
        client.error('foo')
      `))

      expect(err).toBeInstanceOf(Error)
      expect(err!.message).toMatch('foo')
    } finally {
      close()
      cancelServer()
      childProcess.kill()
    }
  })

  test('abort', async () => {
    const childProcess = fork(filename, { serialization: 'advanced' })
    const cancelServer = createServer(api, childProcess)

    const [client, close] = createClient<{
      eval: (code: string) => any
    }>(childProcess)
    try {
      const err = await getErrorPromise(client.eval(`
        const controller = new AbortController()
        const promise = client.loop(controller.signal)
        controller.abort()
        promise
      `))

      expect(err).toBeInstanceOf(AbortError)
    } finally {
      close()
      cancelServer()
      childProcess.kill()
    }
  })
})
