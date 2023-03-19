import { IAPI } from './contract.js'
import { createServer } from '@src/server.js'
import { createClient } from '@src/client.js'

const [client] = createClient<IAPI>(process)

createServer({
  async eval(code: string): Promise<unknown> {
    return await eval(code)
  }
}, process)
