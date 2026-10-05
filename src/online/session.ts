import { Peer, type DataConnection } from 'peerjs'
import { HostMatch, PROTOCOL, RULESET, isRecord, type OnlineFrame, type Packet } from './protocol'
import type { GameAction, PlayerId } from '../game/types'

export interface OnlineStatus {
  phase: 'idle' | 'opening' | 'waiting' | 'connecting' | 'playing' | 'closed'
  id: string
  isHost: boolean
  seat: PlayerId | null
  ready: boolean
  message: string
}
export const idleStatus = (): OnlineStatus => ({ phase: 'idle', id: '', isHost: false, seat: null, ready: false, message: '' })
export interface SessionCallbacks {
  onStatus(status: OnlineStatus): void
  onFrame(frame: OnlineFrame): void
  onError(message: string): void
}

const CONNECT_TIMEOUT = 30000
const HEARTBEAT_INTERVAL = 5000
const HEARTBEAT_TIMEOUT = 30000

// The default PeerServer is public signaling only. No TURN or game server is configured.
export function createPeer(): Peer {
  return new Peer({ secure: true, debug: import.meta.env.DEV ? 1 : 0, config: { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ] } })
}

export class OnlineSession {
  status = idleStatus()
  private peer: Peer | null = null
  private connection: DataConnection | null = null
  private match: HostMatch | null = null
  private frame: OnlineFrame | null = null
  private disposed = false
  private greeted = false
  private localReady = false
  private guestReady = false
  private pendingAction = false
  private lastSeen = 0
  private deadline: ReturnType<typeof setTimeout> | undefined
  private heartbeat: ReturnType<typeof setInterval> | undefined

  constructor(private callbacks: SessionCallbacks, private peerFactory = createPeer) {}

  host() { this.open(true) }
  join(rawId: string) {
    const id = rawId.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,98}[A-Za-z0-9]$/.test(id)) {
      this.callbacks.onError('请输入有效的房间 ID。')
      return
    }
    this.open(false, id)
  }
  private update(patch: Partial<OnlineStatus>) {
    if (this.disposed) return
    this.status = { ...this.status, ...patch }
    this.callbacks.onStatus(this.status)
  }
  private open(isHost: boolean, remoteId?: string) {
    if (this.peer || this.disposed) return
    this.update({ phase: 'opening', isHost, message: '正在连接公共信令服务…' })
    this.deadline = setTimeout(() => this.fail('连接超时。请检查网络后返回重新创建或加入房间。'), CONNECT_TIMEOUT)
    try {
      const peer = this.peer = this.peerFactory()
      peer.on('open', id => {
        if (this.disposed) return
        this.update({ id })
        if (isHost) {
          clearTimeout(this.deadline)
          this.update({ phase: 'waiting', message: '房间已创建。分享 ID，等待朋友加入。' })
        } else {
          if (id === remoteId) { this.fail('不能加入自己的房间。'); return }
          this.update({ phase: 'connecting', message: '正在与房主建立直连…' })
          this.attach(peer.connect(remoteId!, { reliable: true, serialization: 'json', metadata: { protocol: PROTOCOL } }))
        }
      })
      peer.on('connection', connection => {
        if (this.disposed || !isHost || this.connection || !isRecord(connection.metadata) || connection.metadata.protocol !== PROTOCOL) {
          connection.close()
          return
        }
        this.update({ phase: 'connecting', message: '朋友已找到房间，正在建立直连…' })
        this.deadline = setTimeout(() => this.fail('直连超时。请返回重试，或尝试另一网络。'), CONNECT_TIMEOUT)
        this.attach(connection)
      })
      peer.on('error', error => {
        if (this.disposed) return
        // A signaling outage does not invalidate an already established data channel.
        if (this.connection?.open && ['network', 'socket-error', 'socket-closed', 'server-error'].includes(error.type)) return
        this.fail(error.type === 'peer-unavailable' ? '房间不存在或房主已离开，请检查 ID。' :
          error.type === 'browser-incompatible' ? '当前浏览器不支持 WebRTC，请使用新版 Chrome、Edge、Firefox 或 Safari。' :
          ['network', 'socket-error', 'socket-closed', 'server-error'].includes(error.type) ? '无法连接公共信令服务，请检查网络后返回重试。' :
          '联机连接失败。请检查网络后返回重试。')
      })
      peer.on('disconnected', () => {
        if (!this.disposed && !this.connection?.open) this.fail('公共信令服务已断开，请返回重试。')
      })
    } catch { this.fail('无法启动联机，请使用支持 WebRTC 的浏览器。') }
  }
  private attach(connection: DataConnection) {
    this.connection = connection
    connection.on('open', () => {
      if (this.disposed) return
      this.lastSeen = Date.now()
      this.send({ type: 'hello', protocol: PROTOCOL, ruleset: RULESET })
      this.heartbeat = setInterval(() => {
        if (Date.now() - this.lastSeen > HEARTBEAT_TIMEOUT) this.fail('对方连接已中断。请返回首页重新联机。')
        else this.send({ type: 'ping' })
      }, HEARTBEAT_INTERVAL)
    })
    connection.on('data', value => {
      if (this.disposed) return
      this.lastSeen = Date.now()
      try { this.receive(value) } catch { this.fail('收到无效的联机数据，请双方刷新后重新联机。') }
    })
    connection.on('close', () => this.fail('对方已离开或连接中断。请返回首页重新联机。'))
    connection.on('error', () => this.fail('直连失败。请返回重试，或尝试另一网络。'))
  }
  private send(packet: Packet) {
    if (this.disposed || !this.connection?.open) return
    try { this.connection.send(packet) } catch { this.fail('发送失败，连接已中断。请返回首页重新联机。') }
  }
  private receive(value: unknown) {
    if (!isRecord(value)) { this.fail('收到无效的联机消息。'); return }
    if (value.type === 'ping') { this.send({ type: 'pong' }); return }
    if (value.type === 'pong') return
    if (value.type === 'hello') {
      if (this.greeted) return
      if (value.protocol !== PROTOCOL || value.ruleset !== RULESET) {
        this.fail('双方游戏版本不同，请双方刷新页面后重新联机。')
        return
      }
      this.greeted = true
      clearTimeout(this.deadline)
      if (this.status.isHost) this.startMatch()
      return
    }
    if (!this.greeted) { this.fail('联机握手未完成。'); return }
    if (this.status.isHost) {
      if (value.type === 'ack' && value.matchId === this.match?.id && value.revision === this.match?.revision) {
        this.guestReady = true
        this.unlock()
      } else if (value.type === 'action') {
        if (!this.status.ready || !this.match) { this.send({ type: 'error', message: '请等待双方完成同步。' }); return }
        this.apply(value.action, this.match.guestSeat, value.matchId, value.revision)
      }
      return
    }
    if (value.type === 'snapshot') {
      const frame = value.frame as OnlineFrame
      if (!isRecord(frame) || typeof frame.matchId !== 'string' || !Number.isSafeInteger(frame.revision) || (frame.seat !== 0 && frame.seat !== 1) ||
        !isRecord(frame.state) || !Array.isArray(frame.state.players) || frame.state.players.length !== 2 || !Array.isArray(frame.events)) {
        this.fail('收到无效的游戏状态。'); return
      }
      if (this.frame && frame.matchId === this.frame.matchId && frame.revision !== this.frame.revision + 1) return
      if ((!this.frame || frame.matchId !== this.frame.matchId) && (frame.revision !== 0 || (this.frame && this.frame.state.winner === null))) return
      this.frame = frame
      this.pendingAction = false
      this.update({ phase: 'playing', seat: frame.seat, ready: false, message: '正在同步对局…' })
      this.callbacks.onFrame(frame)
    } else if (value.type === 'ready' && value.matchId === this.frame?.matchId && value.revision === this.frame?.revision) {
      this.update({ ready: true, message: '已连接' })
    } else if (value.type === 'error' && typeof value.message === 'string') {
      if (this.pendingAction) { this.pendingAction = false; this.update({ ready: true }) }
      this.callbacks.onError(value.message)
    }
  }
  private startMatch() {
    this.match = new HostMatch()
    this.publish()
  }
  private publish() {
    if (!this.match || this.disposed) return
    this.localReady = false
    this.guestReady = false
    this.frame = this.match.frame(this.match.hostSeat)
    this.update({ phase: 'playing', seat: this.match.hostSeat, ready: false, message: '正在同步对局…' })
    this.send({ type: 'snapshot', frame: this.match.frame(this.match.guestSeat) })
    this.callbacks.onFrame(this.frame)
  }
  ready() {
    if (this.disposed || !this.frame) return
    if (this.status.isHost) { this.localReady = true; this.unlock() }
    else this.send({ type: 'ack', matchId: this.frame.matchId, revision: this.frame.revision })
  }
  private unlock() {
    if (!this.match || !this.localReady || !this.guestReady || this.status.ready) return
    this.update({ ready: true, message: '已连接' })
    this.send({ type: 'ready', matchId: this.match.id, revision: this.match.revision })
  }
  submit(action: GameAction) {
    if (this.disposed || !this.frame || !this.status.ready) return
    if (this.status.isHost && this.match) this.apply(action, this.match.hostSeat, this.match.id, this.match.revision)
    else {
      this.pendingAction = true
      this.update({ ready: false, message: '等待房主结算…' })
      this.send({ type: 'action', matchId: this.frame.matchId, revision: this.frame.revision, action })
    }
  }
  private apply(action: unknown, seat: PlayerId, matchId: unknown, revision: unknown) {
    const error = this.match!.apply(action, seat, matchId, revision)
    if (error) {
      if (seat === this.match!.guestSeat) this.send({ type: 'error', message: error })
      else this.callbacks.onError(error)
      return
    }
    this.publish()
  }
  rematch() {
    if (this.status.isHost && this.status.ready && this.match?.state.winner !== null && this.match) this.startMatch()
  }
  private fail(message: string) {
    if (this.disposed) return
    this.update({ phase: 'closed', ready: false, message })
    this.destroy()
  }
  destroy() {
    if (this.disposed) return
    this.disposed = true
    clearTimeout(this.deadline)
    clearInterval(this.heartbeat)
    this.connection?.close()
    this.peer?.destroy()
    this.match = null
  }
}
