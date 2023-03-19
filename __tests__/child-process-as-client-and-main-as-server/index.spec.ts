import { createClient } from '@src/client.js'
import { createServer } from '@src/server.js'
import { fork } from 'child_process'
import { IAPI } from './contract.js'
import * as path from 'path'
import { getErrorPromise } from 'return-style'
import { fileURLToPath } from 'url'

const api: IAPI = {
  echo(message: string): string {
    return message
  }
, error(message: string): never {
    throw new Error(message)
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filename = path.resolve(__dirname, './child-process.js')

describe('ChildProcess as Client, Main as Server', () => {
  test('echo', async () => {
    const childProcess = fork(filename, { serialization: 'advanced' })
    const cancelServer = createServer(api, childProcess)

    const [client, close] = createClient<{
      eval: (code: string) => any
    }>(childProcess)
    try {
      const result = await client.eval('client.echo("hello")')
      close()
      expect(result).toEqual('hello')
    } finally {
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
      const err = await getErrorPromise(client.eval('client.error("hello")'))
      close()
      expect(err).toBeInstanceOf(Error)
      expect(err!.message).toMatch('hello')
    } finally {
      cancelServer()
      childProcess.kill()
    }
  })
})
