export type UploadedMedia = {
  url: string
  public_id: string
  resource_type: 'image' | 'video' | 'raw' | 'auto'
  media_type: 'image' | 'audio'
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_AUDIO_BYTES = 8 * 1024 * 1024

export async function uploadMedia(file: File, folder = 'ava-hermina-games/questions'): Promise<UploadedMedia> {
  const isAudio = file.type.startsWith('audio/')
  const isImage = file.type.startsWith('image/')

  if (!isAudio && !isImage) {
    throw new Error('يُسمح بالصور أو الملفات الصوتية فقط')
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت')
  }
  if (isAudio && file.size > MAX_AUDIO_BYTES) {
    throw new Error('حجم الملف الصوتي يجب ألا يتجاوز 8 ميجابايت')
  }

  const signRes = await fetch('/api/sign-cloudinary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  })

  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}))
    throw new Error(err.error || 'فشل توقيع الرفع — تأكد من إعدادات Cloudinary على Vercel')
  }

  const sign = await signRes.json()
  const resourceType = isAudio ? 'video' : 'image' // Cloudinary stores audio under video/raw; video accepts audio

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sign.api_key)
  form.append('timestamp', String(sign.timestamp))
  form.append('signature', sign.signature)
  form.append('folder', sign.folder)

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sign.cloud_name}/${resourceType}/upload`
  const upRes = await fetch(uploadUrl, { method: 'POST', body: form })
  const data = await upRes.json()

  if (!upRes.ok) {
    throw new Error(data.error?.message || 'فشل رفع الملف إلى Cloudinary')
  }

  return {
    url: data.secure_url as string,
    public_id: data.public_id as string,
    resource_type: data.resource_type,
    media_type: isAudio ? 'audio' : 'image',
  }
}
