import { createClient } from '@src/client.js'
import { fork, ChildProcess } from 'child_process'
import { IAPI } from './contract.js'
import * as path from 'path'
import { getErrorPromise } from 'return-style'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Main as Client, ChildProcess as Server', () => {
  let childProcess: ChildProcess
  beforeEach(() => {
    childProcess = fork(path.resolve(__dirname, './child-process.ts'), {
      serialization: 'advanced'
    })
  })
  afterEach(() => {
    childProcess.kill()
  })

  test('echo', async () => {
    const [client, close] = createClient<IAPI>(childProcess)

    const result = await client.echo('hello')
    close()

    expect(result).toStrictEqual('hello')
  })

  test('error', async () => {
    const [client, close] = createClient<IAPI>(childProcess)

    const err = await getErrorPromise(client.error('hello'))
    close()

    expect(err).toBeInstanceOf(Error)
    expect(err!.message).toMatch('hello')
  })
})
