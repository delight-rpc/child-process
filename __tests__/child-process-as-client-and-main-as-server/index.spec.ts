import { createClient } from '@src/client'
import { createServer } from '@src/server'
import { fork } from 'child_process'
import '@blackglory/jest-matchers'
import { IAPI } from './api'
import * as path from 'path'

describe('ChildProcess as Client, Main as Server', () => {
  it('echo', async () => {
    const api: IAPI = {
      echo(message: string): string {
        return message
      }
    }
    const childProcess = fork(path.resolve(__dirname, './child-process.js'))
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
})
