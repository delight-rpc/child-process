import { createServer } from '../../lib/server.js'
import { createClient } from '../../lib/client.js'

const [client] = createClient(process)

createServer({
  async eval(code) {
    return await eval(code)
  }
}, process)
