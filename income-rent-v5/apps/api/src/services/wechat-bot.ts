// WeChat Bot Service - 微信 Bot 服务
import { WeChatBot } from '@wechatbot/wechatbot'
import { db } from '../db/index.js'
import { messageLogs } from '../db/schema.js'
import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import { mkdirSync } from 'fs'
import { join } from 'path'

// 確保 storage 目錄存在
const storageDir = join(process.cwd(), 'storage', 'wechatbot')
try {
  mkdirSync(storageDir, { recursive: true })
} catch (err) {
  // 目錄已存在或無法創建
}

interface SendMessageParams {
  chatId: string
  content: string
  recordId?: string
  tenantId?: string
}

interface BotStatus {
  ready: boolean
  qrCode?: string
  userInfo?: any
}

class WeChatBotService {
  private bot: WeChatBot | null = null
  private _ready = false
  private _qrCode: string | null = null
  private qrCodeCallback?: (url: string) => void
  private _credentials: any = null

  get ready() {
    return this._ready
  }

  get qrCode() {
    return this._qrCode
  }

  // 初始化并登录
  async initialize(options?: { onQrCode?: (url: string) => void }) {
    console.log('[WeChat Bot] initialize() called')
    // 如果已经初始化但未就绪，重置并重新初始化
    if (this.bot && !this._ready) {
      this.bot = null
      this._qrCode = null
    }

    if (this.bot && this._ready) {
      console.log('[WeChat Bot] already ready')
      return
    }

    this.qrCodeCallback = options?.onQrCode

    console.log('[WeChat Bot] creating WeChatBot instance')
    this.bot = new WeChatBot({
      storageDir: storageDir,
    })

    // 调用 login() 以确保 credentials 被设置
    // 如果有已保存的凭证，SDK 会立即返回
    console.log('[WeChat Bot] calling login()')
    try {
      const creds = await this.bot.login({
        callbacks: {
          onQrUrl: (url) => {
            this._qrCode = url
            this.qrCodeCallback?.(url)
          },
          onScanned: () => {
            console.log('[WeChat Bot] QR code scanned, waiting for confirmation...')
            this._qrCode = null
          },
        },
      })
      this._credentials = creds
      console.log('[WeChat Bot] login() completed, userId:', creds?.userId)
      this._ready = true
      this._qrCode = null
    } catch (err) {
      console.error('[WeChat Bot] login error:', err)
      this._ready = false
    }
    console.log('[WeChat Bot] ready set to true')
  }

  // 检查是否已连接（用于状态显示）
  isConnected(): boolean {
    return this.bot !== null && this._ready
  }

  // 发送消息到群
  async sendToGroup(params: SendMessageParams): Promise<{ success: boolean; error?: string }> {
    if (!this.bot || !this._ready) {
      return { success: false, error: 'Bot 未就绪' }
    }

    try {
      await this.bot.send(params.chatId, params.content)

      // 记录发送日志
      await db.insert(messageLogs).values({
        id: randomUUID(),
        recordId: params.recordId || null,
        tenantId: params.tenantId || null,
        targetGroup: params.chatId,
        operator: 'system',
        status: 'sent',
        sentAt: new Date().toISOString(),
      })

      return { success: true }
    } catch (err: any) {
      const error = String(err)
      console.error('[WeChat Bot] 发送失败:', error)

      // 记录失败日志
      await db.insert(messageLogs).values({
        id: randomUUID(),
        recordId: params.recordId || null,
        tenantId: params.tenantId || null,
        targetGroup: params.chatId,
        operator: 'system',
        status: 'failed',
      })

      return { success: false, error }
    }
  }

  // 发送账单到群
  async sendBillToGroup(billData: {
    chatId: string
    tenantName: string
    building: string
    room: string
    cycle: string
    rent: number
    electricCost: number
    waterCost: number
    total: number
    dueDate?: string
  }): Promise<{ success: boolean; error?: string }> {
    const message = this.formatBillMessage(billData)
    return this.sendToGroup({
      chatId: billData.chatId,
      content: message,
    })
  }

  // 发送催租提醒
  async sendReminder(params: {
    chatId: string
    tenantName: string
    room: string
    cycle: string
    unpaid: number
    overdueDays: number
  }): Promise<{ success: boolean; error?: string }> {
    const message = `⏰ 【催租提醒】

${params.tenantName} 您好：
房间：${params.room}
${params.cycle} 账单尚有 ¥${params.unpaid.toFixed(0)} 未缴清
已逾期 ${params.overdueDays} 天

请尽快缴纳，避免产生更多滞纳金。
如有疑问请联系房东。`

    return this.sendToGroup({
      chatId: params.chatId,
      content: message,
    })
  }

  // 格式化账单消息
  private formatBillMessage(data: {
    tenantName: string
    building: string
    room: string
    cycle: string
    rent: number
    electricCost: number
    waterCost: number
    total: number
    dueDate?: string
  }): string {
    return `📋 【${data.cycle} 账单通知】

尊敬的 ${data.tenantName}：
房间：${data.building} ${data.room}

💰 费用明细：
├ 租金：¥${data.rent.toFixed(0)}
├ 电费：¥${data.electricCost.toFixed(0)}
├ 水费：¥${data.waterCost.toFixed(0)}
└ 合计：¥${data.total.toFixed(0)}
${data.dueDate ? `\n📅 缴费期限：${data.dueDate}` : ''}

请在规定时间内缴纳，谢谢配合！`
  }

  // 处理收到的消息
  private async handleMessage(msg: any) {
    console.log('[WeChat Bot] 收到消息:', msg.text, '来自:', msg.from)

    // 关键词回复
    const text = msg.text || ''

    if (text.includes('帮助') || text.includes('help')) {
      await this.bot?.reply(msg, this.getHelpMessage())
    } else if (text.includes('账单') || text.includes('bill')) {
      await this.handleBillQuery(msg)
    } else if (text.includes('抄表') || text.includes('水电')) {
      await this.handleMeterQuery(msg)
    } else if (text.includes('已转') || text.includes('已付')) {
      await this.handlePaymentConfirm(msg)
    }
  }

  // 处理账单查询
  private async handleBillQuery(msg: any) {
    // TODO: 通过微信号查找租客，返回账单
    await this.bot?.reply(msg, '请稍候，正在查询您的账单...')
  }

  // 处理抄表查询
  private async handleMeterQuery(msg: any) {
    // TODO: 通过微信号查找租客，返回抄表数据
    await this.bot?.reply(msg, '请稍候，正在查询您的水电用量...')
  }

  // 处理缴费确认
  private async handlePaymentConfirm(msg: any) {
    await this.bot?.reply(msg, '✅ 收到！房东确认后会回复您。')
  }

  // 帮助信息
  private getHelpMessage(): string {
    return `📋 可用命令：

• 账单 - 查询当月账单
• 抄表 - 查询水电用量
• 已转 - 确认已转账
• 帮助 - 显示此消息

如有问题请联系房东。`
  }

  // 获取状态
  getStatus(): BotStatus {
    return {
      ready: this._ready,
      qrCode: this._qrCode || undefined,
      userInfo: this.getUserInfo(),
    }
  }

  // 获取 Bot 用户信息
  getUserInfo(): any {
    if (!this._credentials) {
      return null
    }
    return {
      userId: this._credentials.userId,
      accountId: this._credentials.accountId,
    }
  }

  // 销毁
  async destroy() {
    if (this.bot) {
      // SDK 可能没有 stop 方法，根据实际情况调整
      this.bot = null
      this._ready = false
    }
  }
}

// 单例
export const wechatBot = new WeChatBotService()
