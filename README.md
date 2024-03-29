# @delight-rpc/child-process
## Install
```sh
npm install --save @delight-rpc/child-process
# or
yarn add @delight-rpc/child-process
```

## Usage
### Main as Client, ChildProcess as Server
```ts
// api.d.ts
interface IAPI {
  echo(message: string): string
}

// child-process.ts
import { createServer } from '@delight-rpc/child-process'

const api: IAPI = {
  echo(message: string): string {
    return message
  }
}

createServer(api, process)

// main.ts
import { fork } from 'child_process'
import { createClient } from '@delight-rpc/child-process'

const childProcess = fork('./child-process.js', { serialization: 'advanced' })
const [client] = createClient<IAPI>(childProcess)

await client.echo('hello world')
```

### ChildProcess as Client, Main as Server
```ts
// api.d.ts
interface IAPI {
  echo(message: string): string
}

// main.ts
import { fork } from 'child_process'
import { createServer } from '@delight-rpc/child-process'

const api: IAPI = {
  echo(message: string): string {
    return message
  }
}

const childProcess = fork('./child-process.js', { serialization: 'advanced' })
createServer(api, childProcess)

// child-process.ts
import { createClient } from '@delight-rpc/child-process'

const [client] = createClient<IAPI>(process)
await client.echo('hello world')
```

## API
### createClient
```ts
function createClient<IAPI extends object>(
  process: ChildProcess | NodeJS.Process
, options?: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    expectedVersion?: string
    channel?: string
  }
): [client: DelightRPC.ClientProxy<IAPI>, close: () => void]
```

### createBatchClient
```ts
function createBatchClient<DataType>(
  process: ChildProcess | NodeJS.Process
, options?: {
    expectedVersion?: string
    channel?: string
  }
): [client: DelightRPC.BatchClient<DataType>, close: () => void]
```

### createServer
```ts
function createServer<IAPI extends object>(
  api: DelightRPC.ImplementationOf<IAPI>
, process: ChildProcess | NodeJS.Process
, options?: {
    parameterValidators?: DelightRPC.ParameterValidators<IAPI>
    version?: `${number}.${number}.${number}`
    channel?: string | RegExp | AnyChannel
    ownPropsOnly?: boolean
  }
): () => void
```
