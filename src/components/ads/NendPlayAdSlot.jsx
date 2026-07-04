import React, { useEffect, useState } from 'react'
import { RiAdvertisementLine, RiVolumeMuteLine, RiVolumeUpLine } from 'react-icons/ri'
import { adService } from '../../services/index'
import useAuthStore from '../../stores/authStore'

function hasAdFreeAccess(user) {
  if (!user) return false
  if (user.isSubscriptionActive) return true
  if (user.subscriptionPlan && user.subscriptionPlan !== 'none' && user.subscriptionExpiry) {
    return new Date(user.subscriptionExpiry) > new Date()
  }
  if (user.adFreeUntil) return new Date(user.adFreeUntil) > new Date()
  return false
}

function WebAdCreative({ ad }) {
  const [muted, setMuted] = useState(true)
  if (!ad?.mediaUrl) return null

  const isVideo = ad.adType === 'video' || /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(ad.mediaUrl)
  if (isVideo) {
    return (
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9', background: '#05050F' }}>
        <video
          src={ad.mediaUrl}
          className="h-full w-full object-contain"
          autoPlay
          muted={muted}
          loop
          playsInline
          preload="metadata"
        />
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setMuted((value) => !value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            event.stopPropagation()
            setMuted((value) => !value)
          }}
          className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-white"
          style={{ background: 'rgba(0,0,0,0.66)' }}
          aria-label={muted ? 'Turn ad sound on' : 'Turn ad sound off'}
        >
          {muted ? <RiVolumeMuteLine /> : <RiVolumeUpLine />}
        </span>
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden" style={{ aspectRatio: '16 / 9', background: '#05050F' }}>
      <img src={ad.mediaUrl} alt={ad.title} className="h-full w-full object-contain" loading="lazy" />
    </div>
  )
}

export default function NendPlayAdSlot({ placement = 'home', className = '' }) {
  const { user } = useAuthStore()
  const [ad, setAd] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (hasAdFreeAccess(user)) {
      setAd(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    const loadAd = async () => {
      try {
        const res = await adService.serve({ placement, limit: 1 })
        const nextAd = res.data?.data?.nativeAds?.[0] || null
        if (!cancelled) setAd(nextAd)
        if (nextAd?._id) adService.recordImpression(nextAd._id).catch(() => {})
      } catch {
        if (!cancelled) setAd(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAd()
    const interval = setInterval(loadAd, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [placement, user?.adFreeUntil, user?.isSubscriptionActive, user?.subscriptionExpiry, user?.subscriptionPlan])

  const openAd = async () => {
    if (!ad?._id) return
    try {
      const res = await adService.recordClick(ad._id)
      const targetUrl = res.data?.data?.targetUrl || ad.targetUrl
      if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch {
      if (ad.targetUrl) window.open(ad.targetUrl, '_blank', 'noopener,noreferrer')
    }
  }

  if (hasAdFreeAccess(user) || loading || !ad) return null

  return (
    <button
      type="button"
      onClick={openAd}
      className={`w-full overflow-hidden rounded-xl text-left transition-transform hover:scale-[1.01] ${className}`}
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <WebAdCreative ad={ad} />
      <div className="p-4">
        <span
          className="mb-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase"
          style={{ color: 'var(--color-primary)', background: 'var(--color-surface-high)' }}
        >
          <RiAdvertisementLine /> Sponsored
        </span>
        <p className="font-display text-lg font-black" style={{ color: 'var(--color-text)' }}>
          {ad.title}
        </p>
        {ad.description && (
          <p className="mt-2 line-clamp-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {ad.description}
          </p>
        )}
        {ad.advertiserName && (
          <p className="mt-3 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {ad.advertiserName}
          </p>
        )}
      </div>
    </button>
  )
}
