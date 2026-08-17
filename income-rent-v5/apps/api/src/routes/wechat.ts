// WeChat Bot API routes - 微信 Bot API
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { wechatBot } from '../services/wechat-bot.js'

export const wechatRouter = new Hono()

// 发送消息到群
wechatRouter.post(
  '/send',
  zValidator(
    'json',
    z.object({
      chatId: z.string().min(1, '群 ID 不能为空'),
      content: z.string().min(1, '消息内容不能为空'),
      recordId: z.string().optional(),
      tenantId: z.string().optional(),
    })
  ),
  async (c) => {
    const { chatId, content, recordId, tenantId } = c.req.valid('json')

    const result = await wechatBot.sendToGroup({
      chatId,
      content,
      recordId,
      tenantId,
    })

    return c.json(result)
  }
)

// 发送账单到群
wechatRouter.post(
  '/send-bill',
  zValidator(
    'json',
    z.object({
      chatId: z.string().min(1),
      tenantName: z.string(),
      building: z.string(),
      room: z.string(),
      cycle: z.string(),
      rent: z.number(),
      electricCost: z.number().default(0),
      waterCost: z.number().default(0),
      total: z.number(),
      dueDate: z.string().optional(),
    })
  ),
  async (c) => {
    const data = c.req.valid('json')
    const result = await wechatBot.sendBillToGroup(data)
    return c.json(result)
  }
)

// 发送催租提醒
wechatRouter.post(
  '/send-reminder',
  zValidator(
    'json',
    z.object({
      chatId: z.string().min(1),
      tenantName: z.string(),
      room: z.string(),
      cycle: z.string(),
      unpaid: z.number(),
      overdueDays: z.number(),
    })
  ),
  async (c) => {
    const data = c.req.valid('json')
    const result = await wechatBot.sendReminder(data)
    return c.json(result)
  }
)

// 获取 Bot 状态
wechatRouter.get('/status', (c) => {
  const status = wechatBot.getStatus()
  return c.json({ success: true, data: status })
})

// 初始化 Bot（扫码登录）
wechatRouter.post('/init', async (c) => {
  try {
    // 异步初始化，不等待完成
    wechatBot.initialize({
      onQrCode: (url) => {
        console.log('[WeChat Bot] 二维码 URL:', url)
      },
    }).catch(err => {
      console.error('[WeChat Bot] 初始化失败:', err)
    })

    // 立即返回，让前端通过 status 接口轮询二维码
    return c.json({ success: true, message: 'Bot 初始化中，请等待二维码' })
  } catch (err: any) {
    return c.json({ success: false, error: String(err) }, 500)
  }
})
