import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'

/**
 * Signs Cloudinary upload params. Secrets stay on the server only.
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'Cloudinary is not configured on the server' })
    return
  }

  const folder = (req.body?.folder as string) || 'ava-hermina-games'
  const timestamp = Math.floor(Date.now() / 1000)
  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  }

  const toSign = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join('&')

  const signature = createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex')

  res.status(200).json({
    cloud_name: cloudName,
    api_key: apiKey,
    timestamp,
    folder,
    signature,
  })
}
