const INDEX_KEY = 'nendplay:local-downloads:index'
const CACHE_NAME = 'nendplay-downloads-v1'
const HLS_REF_PREFIX = 'nendplay-cache:'

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]')
  } catch {
    return []
  }
}

function writeIndex(items) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(items))
}

function cacheKey(storageKey) {
  return storageKey?.startsWith('/') ? new Request(storageKey) : storageKey
}

function getOrigin(url = '') {
  const match = String(url).match(/^(https?:\/\/[^/]+)/i)
  return match?.[1] || window.location.origin
}

function resolveRemoteUrl(baseUrl = '', path = '') {
  const value = String(path || '').trim()
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `${window.location.protocol}${value}`
  if (value.startsWith('/')) return `${getOrigin(baseUrl)}${value}`
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return value
  }
}

function isPlaylistLike({ url = '', contentType = '', text = '' } = {}) {
  const lowerUrl = String(url).toLowerCase()
  const lowerType = String(contentType).toLowerCase()
  return lowerUrl.includes('.m3u8') || lowerType.includes('mpegurl') || lowerType.includes('vnd.apple') || text.startsWith('#EXTM3U')
}

async function responseText(response) {
  const text = await response.text()
  return text || ''
}

async function cacheHlsPackage({ fileUrl, contentType, contentId, initialResponse }) {
  const storageKey = `/__nendplay_downloads__/${encodeURIComponent(contentType)}-${encodeURIComponent(contentId)}-hls`
  const cache = await caches.open(CACHE_NAME)
  let sequence = 0
  let storedFileSize = 0

  const cacheBinaryAsset = async (remoteUrl) => {
    const assetKey = `${storageKey}/asset-${sequence++}`
    const response = await fetch(remoteUrl, { mode: 'cors' })
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`)
    const blob = await response.clone().blob()
    storedFileSize += blob.size || 0
    await cache.put(new Request(assetKey), response)
    return `${HLS_REF_PREFIX}${assetKey}`
  }

  const cachePlaylist = async (playlistUrl, existingResponse = null, depth = 0) => {
    if (depth > 5) throw new Error('HLS playlist nesting is too deep.')
    const playlistKey = `${storageKey}/playlist-${sequence++}.m3u8`
    const response = existingResponse || await fetch(playlistUrl, { mode: 'cors' })
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`)
    const text = await responseText(response)
    const lines = text.split(/\r?\n/)
    const rewritten = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        rewritten.push(line)
        continue
      }

      if (trimmed.startsWith('#')) {
        const matches = [...String(line).matchAll(/URI="([^"]+)"/gi)]
        let nextLine = line
        for (const match of matches) {
          const remoteUrl = resolveRemoteUrl(playlistUrl, match[1])
          const ref = await cacheBinaryAsset(remoteUrl)
          nextLine = nextLine.replace(`URI="${match[1]}"`, `URI="${ref}"`)
        }
        rewritten.push(nextLine)
        continue
      }

      const remoteUrl = resolveRemoteUrl(playlistUrl, trimmed)
      if (remoteUrl.toLowerCase().includes('.m3u8')) {
        const nestedKey = await cachePlaylist(remoteUrl, null, depth + 1)
        rewritten.push(`${HLS_REF_PREFIX}${nestedKey}`)
      } else {
        rewritten.push(await cacheBinaryAsset(remoteUrl))
      }
    }

    const playlistBlob = new Blob([rewritten.join('\n')], { type: 'application/vnd.apple.mpegurl' })
    storedFileSize += playlistBlob.size || 0
    await cache.put(new Request(playlistKey), new Response(playlistBlob, {
      headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
    }))
    return playlistKey
  }

  const rootPlaylistKey = await cachePlaylist(fileUrl, initialResponse)
  const manifest = {
    type: 'hls-package',
    rootPlaylistKey,
    createdAt: new Date().toISOString(),
  }
  await cache.put(new Request(storageKey), new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/json' },
  }))

  return { storageKey, storedFileSize, cached: true, isHlsPackage: true }
}

async function makeCachedHlsObjectUrl(storageKey) {
  const cache = await caches.open(CACHE_NAME)
  const manifestResponse = await cache.match(cacheKey(storageKey))
  if (!manifestResponse) return ''
  let manifest
  try {
    manifest = JSON.parse(await manifestResponse.clone().text())
  } catch {
    return ''
  }
  if (manifest?.type !== 'hls-package' || !manifest.rootPlaylistKey) return ''

  const resolvePlaylist = async (playlistKey) => {
    const response = await cache.match(new Request(playlistKey))
    if (!response) return ''
    const text = await response.text()
    const lines = await Promise.all(text.split(/\r?\n/).map(async (line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        const matches = [...String(line).matchAll(/URI="nendplay-cache:([^"]+)"/gi)]
        let nextLine = line
        for (const match of matches) {
          const assetResponse = await cache.match(new Request(match[1]))
          if (!assetResponse) continue
          const blobUrl = URL.createObjectURL(await assetResponse.blob())
          nextLine = nextLine.replace(`URI="${HLS_REF_PREFIX}${match[1]}"`, `URI="${blobUrl}"`)
        }
        return nextLine
      }
      if (trimmed.startsWith(HLS_REF_PREFIX)) {
        const refKey = trimmed.slice(HLS_REF_PREFIX.length)
        if (refKey.endsWith('.m3u8')) return resolvePlaylist(refKey)
        const assetResponse = await cache.match(new Request(refKey))
        if (!assetResponse) return ''
        return URL.createObjectURL(await assetResponse.blob())
      }
      return line
    }))
    const blob = new Blob([lines.join('\n')], { type: 'application/vnd.apple.mpegurl' })
    return URL.createObjectURL(blob)
  }

  return resolvePlaylist(manifest.rootPlaylistKey)
}

function snapshotFrom(download = {}, fallback = {}) {
  const snap = download.contentSnapshot || {}
  return {
    title: fallback.title || snap.title || 'Downloaded file',
    thumbnailUrl: fallback.thumbnailUrl || snap.thumbnailUrl || '',
    type: fallback.type || snap.type || (download.contentType === 'document' ? 'pdf' : 'video'),
    category: fallback.category || snap.category || '',
    duration: fallback.duration || snap.duration || 0,
    fileSize: fallback.fileSize || snap.fileSize || 0,
    mimeType: fallback.mimeType || snap.mimeType || '',
    fileUrl: fallback.fileUrl || snap.fileUrl || '',
  }
}

export async function cacheDownloadFile({ fileUrl, contentType, contentId }) {
  if (!fileUrl) throw new Error('No file URL available for this download.')
  const storageKey = `/__nendplay_downloads__/${encodeURIComponent(contentType)}-${encodeURIComponent(contentId)}`
  if (!('caches' in window)) return { storageKey, storedFileSize: 0, cached: false }

  const response = await fetch(fileUrl, { mode: 'cors' })
  if (!response.ok) throw new Error(`Download failed with status ${response.status}`)
  const contentHeader = response.headers.get('content-type') || ''
  if (contentType === 'media') {
    const shouldProbePlaylist = isPlaylistLike({ url: fileUrl, contentType: contentHeader })
    if (shouldProbePlaylist) {
      const text = await response.clone().text().catch(() => '')
      if (!isPlaylistLike({ url: fileUrl, contentType: contentHeader, text })) {
        throw new Error('The downloaded media stream is not a valid offline playlist.')
      }
      return cacheHlsPackage({ fileUrl, contentType, contentId, initialResponse: new Response(text, { headers: { 'Content-Type': contentHeader || 'application/vnd.apple.mpegurl' } }) })
    }
  }
  const clone = response.clone()
  const blob = await response.blob()
  const cache = await caches.open(CACHE_NAME)
  await cache.put(new Request(storageKey), clone)
  return { storageKey, storedFileSize: blob.size || 0, cached: true }
}

export function upsertLocalDownloadRecord({ download, contentType, contentId, storageKey, storedFileSize, snapshot = {} }) {
  if (!storageKey) return null
  const resolvedContentType = contentType || download?.contentType || 'media'
  const resolvedContentId = String(contentId || download?.contentId || download?._id || storageKey)
  const record = {
    _id: download?._id || `local-${resolvedContentType}-${resolvedContentId}`,
    localOnly: !download?._id,
    contentType: resolvedContentType,
    contentId: resolvedContentId,
    status: 'completed',
    storageKey,
    storedFileSize: storedFileSize || snapshot.fileSize || download?.storedFileSize || 0,
    downloadedAt: download?.downloadedAt || new Date().toISOString(),
    contentSnapshot: snapshotFrom(download, {
      ...snapshot,
      fileSize: storedFileSize || snapshot.fileSize || download?.storedFileSize || 0,
    }),
  }
  const next = [
    record,
    ...readIndex().filter((item) => {
      const sameFile = item.storageKey === record.storageKey
      const sameContent = item.contentType === record.contentType && String(item.contentId) === String(record.contentId)
      return !sameFile && !sameContent
    }),
  ]
  writeIndex(next)
  return record
}

export async function getLocalDownloads({ contentType } = {}) {
  const items = readIndex()
  if (!('caches' in window)) {
    return items.filter((item) => !contentType || item.contentType === contentType)
  }
  const cache = await caches.open(CACHE_NAME)
  const valid = []
  const validKeys = new Set()
  for (const item of items) {
    const match = await cache.match(cacheKey(item.storageKey))
    if (!match) continue
    validKeys.add(item.storageKey)
    if (contentType && item.contentType !== contentType) continue
    valid.push({ ...item, localOnly: true })
  }
  if (validKeys.size !== items.length) {
    writeIndex(items.filter((item) => validKeys.has(item.storageKey)))
  }
  return valid
}

export async function getCachedObjectUrl(storageKey) {
  if (!storageKey || !('caches' in window)) return ''
  const hlsUrl = await makeCachedHlsObjectUrl(storageKey)
  if (hlsUrl) return hlsUrl
  const cache = await caches.open(CACHE_NAME)
  const response = await cache.match(cacheKey(storageKey))
  if (!response) return ''
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export async function deleteLocalDownload(storageKey) {
  if (storageKey && 'caches' in window) {
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(cacheKey(storageKey))
  }
  writeIndex(readIndex().filter((item) => item.storageKey !== storageKey && item._id !== storageKey))
}
