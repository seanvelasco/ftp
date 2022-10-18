# @seanvelasco/ftp

A simple File Transfer Protocol (FTP) server for Node.js. This is an implementation of RFC 959 - File Transfer Protocol - as an event-emitter or listener.

## Installation

```npm i @seanvelasco/ftp```

## Usage

```typescript
import FTP from '@seanvelasco/ftp'

const ftp = new FTP({
    host: `0.0.0.0`,
    port: 21,
    directory: `/path/to/desired/directory`,
})

ftp.addUser('username', 'password')

ftp.on('login', (login) => {
    const { username, password, remoteAddress, remotePort } = login
    console.log(`User ${username} logged in from ${remoteAddress}:${remotePort}`)
})

ftp.on('data', (filename, data) => {
    console.log(`Received ${filename} with ${data.length} bytes`)
    fs.writeFileSync(filename, data)
})

ftp.listen()
```



## Supported commands

- CWD
- LIST
- STOR