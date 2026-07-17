import React, { useEffect, useState } from 'react'
import {
  RiAdvertisementLine,
  RiArrowRightSLine,
  RiBookmarkLine,
  RiShareLine,
  RiShieldCheckFill,
  RiVolumeMuteLine,
  RiVolumeUpLine,
} from 'react-icons/ri'
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
      <div className="absolute inset-0 overflow-hidden" style={{ background: '#05050F' }}>
        <video
          src={ad.mediaUrl}
          className="h-full w-full object-cover"
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
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#05050F' }}>
      <img src={ad.mediaUrl} alt={ad.title} className="h-full w-full object-cover" loading="lazy" />
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

  const shareAd = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const shareUrl = ad.targetUrl || window.location.href
    if (navigator.share) {
      navigator.share({ title: ad.title, text: ad.description || ad.advertiserName || 'NendPlay sponsored ad', url: shareUrl }).catch(() => {})
      return
    }
    navigator.clipboard?.writeText(shareUrl).catch(() => {})
  }

  const advertiser = ad.advertiserName || 'NendPlay Partner'
  const cta = ad.cta || ad.callToAction || 'Learn More'

  return (
    <article
      className={`group relative w-full overflow-hidden rounded-[1.75rem] text-left shadow-2xl shadow-black/30 ring-1 ring-white/15 ${className}`}
      style={{ aspectRatio: '16 / 9', background: '#05050F' }}
    >
      <button type="button" onClick={openAd} className="absolute inset-0 z-10 text-left" aria-label={`Open ad: ${ad.title}`} />
      <WebAdCreative ad={ad} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/15 to-black/20" />

      <div className="absolute left-4 top-4 z-20 flex items-center gap-3 md:left-6 md:top-6">
        <div className="grid h-11 w-11 place-items-center rounded-[0.9rem] bg-white text-lg font-black text-purple-700 shadow-xl md:h-14 md:w-14">
          NPL
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-black text-white backdrop-blur-md md:text-base">
          <RiAdvertisementLine /> Sponsored
        </span>
      </div>

      <div className="absolute inset-x-4 bottom-4 z-20 rounded-[1.5rem] border border-white/20 bg-black/38 p-4 text-white shadow-2xl backdrop-blur-md md:inset-x-8 md:bottom-8 md:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/50 bg-black/70 md:h-20 md:w-20">
              {ad.logoUrl ? (
                <img src={ad.logoUrl} alt={advertiser} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="text-xl font-black text-amber-300">N</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black md:text-2xl">
                {advertiser} <RiShieldCheckFill className="inline text-blue-400" />
              </p>
              <p className="mt-1 line-clamp-1 text-xl font-black md:text-3xl">{ad.title}</p>
              {ad.description && <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-white/80 md:text-lg">{ad.description}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={openAd}
            className="relative z-30 inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-300 px-6 py-3 text-base font-black text-black shadow-xl transition hover:bg-amber-200 md:min-w-56 md:text-xl"
          >
            {cta} <RiArrowRightSLine size={28} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/90">
            <RiBookmarkLine size={28} />
          </span>
          <button type="button" onClick={shareAd} className="relative z-30 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/90" aria-label="Share ad">
            <RiShareLine size={28} />
          </button>
        </div>
      </div>
    </article>
  )
}
