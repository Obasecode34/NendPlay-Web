import React, { useEffect, useState } from 'react'
import { RiCheckLine, RiFileCopyLine, RiGiftFill, RiUserAddLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import { referralService } from '../services/index'
import GoogleAdSlot from '../components/ads/GoogleAdSlot'
import NendPlayAdSlot from '../components/ads/NendPlayAdSlot'

export default function ReferralPage() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    try {
      const res = await referralService.getDashboard()
      setDashboard(res.data.data)
    } catch {
      toast.error('Failed to load referral data')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    const link = `${window.location.origin}/register?ref=${dashboard.referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-xl h-24" />)}
      </div>
    )
  }

  if (!dashboard) return null

  const rewardPerReferral = dashboard.rewardPerReferral || 100
  const referralLink = `${window.location.origin}/register?ref=${dashboard.referralCode}`

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl gradient-text">Referral Rewards</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Invite friends. Earn {rewardPerReferral} coins after each successful referral.
        </p>
      </div>

      <div className="card p-6 mb-5"
        style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-high))' }}>
        <div className="flex items-center gap-2 mb-3">
          <RiGiftFill style={{ color: 'var(--color-primary)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Your Referral Link</h2>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl mb-4"
          style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border)' }}>
          <span className="flex-1 text-sm font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>
            {referralLink}
          </span>
          <button onClick={handleCopy}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: copied ? 'var(--color-primary)' : 'var(--color-surface-high)',
              color: copied ? 'white' : 'var(--color-text-muted)',
            }}>
            {copied ? <RiCheckLine /> : <RiFileCopyLine />}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RewardMetric label="Successful referrals" value={dashboard.referralCount || 0} />
          <RewardMetric label="Coins per referral" value={rewardPerReferral} suffix="coins" />
          <RewardMetric label="Coin balance" value={dashboard.coinBalance || 0} suffix="coins" />
        </div>
      </div>

      <GoogleAdSlot placement="profile" className="mb-5" />
      <NendPlayAdSlot placement="profile" className="mb-5" />

      <div className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          People You Referred ({dashboard.referrals?.length || 0})
        </h2>
        {dashboard.referrals?.length === 0 ? (
          <div className="text-center py-6">
            <RiUserAddLine className="text-3xl mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No referrals yet. Share your link to start earning coins.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {dashboard.referrals.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between gap-3 py-3"
                style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                    {ref.referredUser?.profileName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {ref.referredUser?.profileName || ref.referredUser?.username || 'User'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Joined {new Date(ref.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.12)' }}>
                  +{ref.coinsEarned || rewardPerReferral} coins
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RewardMetric({ label, value, suffix }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border)' }}>
      <p className="font-black text-3xl gradient-text">{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
        {label}{suffix ? ` (${suffix})` : ''}
      </p>
    </div>
  )
}
