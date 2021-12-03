import { IAPI } from './api'
import { createServer } from '../../src/server'
import { createClient } from '../../src/client'

const [client] = createClient<IAPI>(process)

createServer({
  async eval(code: string): Promise<unknown> {
    return await eval(code)
  }
}, process)
