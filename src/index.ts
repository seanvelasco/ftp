import net from 'net'
import fs from 'fs'
import { EventEmitter } from 'stream'

class DataServer extends EventEmitter {
    private server: net.Server
    port: number = 0
    constructor() {
        super()
        this.server = net.createServer()
        this.server.on('connection', (socket) => {
            this.emit('connection', socket)
        })
    }

    isPortOpen = async (port: number): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            let s = net.createServer()
            s.once('error', (err: any) => {
                s.close()
                if (err.code == "EADDRINUSE") {
                    resolve(false)
                } else {
                    resolve(false) // or throw error!!
                    // reject(err) 
                }
            })
            s.once('listening', () => {
                resolve(true)
                s.close()
            })
            s.listen(port)
        })
    }

    getNextOpenPort = async (startFrom: number = 2222) => {
        let openPort: any
        while (startFrom < 65535) {
            if (await this.isPortOpen(startFrom)) {
                openPort = startFrom
                break
            }
            startFrom++
        }
        return openPort
    }

    listen = async () => {

        const port = await this.getNextOpenPort()
        if (port) {
            this.port = port
            this.server.listen(port)
            this.port = port
        }
    }

    close() {
        this.server.close()
    }
}


enum Response {
    STATUS_150 = '150 File status okay about to open data connection.\n',
    STATUS_200 = '200 Command okay.\n',
    STATUS_220 = '220 Service ready for new user.\n',
    STATUS_221 = '221 Service closing control connection.\n',
    STATUS_226 = '226 Closing data connection.\n',
    STATUS_230 = '230 User logged in, proceed.\n',
    STATUS_250 = '250 Requested file action okay, completed.\n',
    STATUS_331 = '331 User name okay, need password.\n',
    STATUS_425 = '425 Can\'t open data connection.\n',
    STATUS_426 = '426 Connection closed transfer aborted.\n',
    STATUS_450 = '450 Requested file action not taken.\n',
    STATUS_451 = '451 Requested action aborted: local error in processing.\n',
    STATUS_500 = '500 Syntax error, command unrecognized.\n',
    STATUS_501 = '501 Syntax error in parameters or arguments.\n',
    STATUS_502 = '502 Command not implemented.\n',
    STATUS_503 = '503 Bad sequence of Command.\n',
    STATUS_504 = '504 Command not implemented for that parameter.\n',
    STATUS_530 = '530 Not logged in.\n',
    STATUS_550 = '550 Requested action not taken.\n',
    STATUS_551 = '551 Requested action aborted: page type unknown.\n',
    STATUS_552 = '552 Requested file action aborted.\n',
    STATUS_553 = '553 Requested action not taken.\n',
    STATUS_227 = '227 Entering Passive Mode (%s,%s,%s,%s,%s,%s).\n',
}

enum Command {
    CWD = 'CWD',
    LIST = 'LIST',
    PORT = 'PORT',
    USER = 'USER',
    QUIT = 'QUIT',
    RETR = 'RETR',
    TYPE = 'TYPE',
    PASV = 'PASV',
}
interface FTPOpts {
    host: string
    port: number
    directory: string
    users?: {
        username: string
        password: string
    }[]
}

class FTP extends EventEmitter {
    host?: string
    port?: number
    directory?: string
    users: {
        username: string
        password: string
    }[] = []
    private server: net.Server

    constructor({ host, port, directory, users }: FTPOpts = { host: '127.0.0.1', port: 3002, directory: '.' }) {
        super()
        this.host = host
        this.port = port
        this.directory = directory
        this.users = users = []
        this.server = net.createServer()
        this.server.on('connection', this.handleConnection)
    }

    addUser = (username: string, password: string) => {
        this.users.push({ username, password })
    }

    private handleConnection = async (socket: net.Socket) => {


        const dataServer = new DataServer()

        await dataServer.listen()
        const dataPort2: any = dataServer.port

        // dataServer.on('data', (data) => {
        //     console.log('data', data)
        // })

        dataServer.on('connection', async (fileSocket) => {
            socket.write(Response.STATUS_226)
            const { remoteAddress, remotePort } = fileSocket
            // console.log(`Connection from ${remoteAddress}:${remotePort}`)

            let frames: Buffer[] = []
            fileSocket.on('data', (data: Buffer) => {
                frames.push(data)

            })
            fileSocket.on('close', () => {
                this.emit('data', Buffer.concat(frames))
                socket.write(Response.STATUS_226)
                dataServer.close()
            })
        })

        // get number of connections
        const connections = this.server.getConnections((err, count) => {
            if (err) {
                console.log(err)
            }
            // console.log('Number of connections: ', count)
        })


        let currentPath = this.directory
        let dataType: string

        const { remoteAddress, remotePort } = socket
        // this.emit('connection', { remoteAddress, remotePort })

        socket.write(Response.STATUS_220)

        socket.on('data', (data) => {

            const [command, ...args] = data.toString().replace(/\r\n/, '').split(' ')

            // console.log(command, Date.now())

            switch (command) {
                case Command.USER:
                    socket.write(Response.STATUS_230)
                    break
                case Command.CWD:
                    currentPath = args[0]
                    if (!fs.existsSync(currentPath)) {
                        socket.write(Response.STATUS_550)
                    }
                    socket.write(Response.STATUS_250)
                    break
                case Command.TYPE:
                    if (args[0] === 'A') {
                        dataType = 'ascii'
                    }

                    if (args[0] === 'I') {
                        dataType = 'binary'
                    }
                    socket.write(Response.STATUS_200)
                    break
                case Command.PASV:
         
                    const portToIP = (port: number) => {
                        const ip = []
                        ip.push(port & 0xff)
                        ip.push((port >> 8) & 0xff)
                        return ip.reverse()
                    }

                    const dataIpv4 = this.host?.split('.').map((item) => parseInt(item)) || [127, 0, 0, 1]
                    const dataPort = portToIP(dataPort2)
                    const ipPort = `${dataIpv4.join(',')},${dataPort.join(',')}`
                    const newStatus = (Response.STATUS_227 as string).replace('%s,%s,%s,%s,%s,%s', ipPort)
                    socket.write(newStatus)
                    break

                case "STOR":
                    socket.write(Response.STATUS_150)
                    break
            }
        })
    }

    listen = () => {
        this.server.listen(this.port, this.host)
    }
}

export default FTP