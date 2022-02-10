import { createClient } from '@src/client'
import { fork, ChildProcess } from 'child_process'
import '@blackglory/jest-matchers'
import { IAPI } from './api'
import * as path from 'path'
import { getErrorPromise } from 'return-style'

describe('Main as Client, ChildProcess as Server', () => {
  let childProcess: ChildProcess
  beforeEach(() => {
    childProcess = fork(path.resolve(__dirname, './child-process.js'), {
      serialization: 'advanced'
    })
  })
  afterEach(() => {
    childProcess.kill()
  })

  test('echo', async () => {
    const [client, close] = createClient<IAPI>(childProcess)

    const result = client.echo('hello')
    const proResult = await result
    close()

    expect(result).toBePromise()
    expect(proResult).toStrictEqual('hello')
  })

  test('error', async () => {
    const [client, close] = createClient<IAPI>(childProcess)

    const err = await getErrorPromise(client.error('hello'))
    close()

    expect(err).toBeInstanceOf(Error)
    expect(err!.message).toMatch('hello')
  })
})
