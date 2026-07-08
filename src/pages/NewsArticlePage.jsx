import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RiArrowLeftLine, RiBookmarkLine, RiBookOpenLine, RiBriefcase4Line, RiCalendarLine,
  RiChat3Line, RiCheckboxCircleFill, RiHeadphoneLine, RiHeartLine, RiMapPin2Line,
  RiMoneyDollarCircleLine, RiMore2Fill, RiPlayFill, RiSearchLine, RiSendPlaneFill,
  RiShareForwardLine, RiTeamLine, RiTimeLine,
} from 'react-icons/ri'
import ReactPlayer from 'react-player'
import { newsService } from '../services'
import useAuthStore from '../stores/authStore'
import { InArticleAd, MultiplexAd } from '../components/ads/GoogleAdSlot'

function timeAgo(value) {
  if (!value) return 'Today'
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff) || diff < 0) return 'Today'
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${Math.max(hours, 1)} hour${hours <= 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function formatDate(value) {
  if (!value) return 'Today'
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  } catch {
    return 'Today'
  }
}

function estimateReadTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 220))} min read`
}

function getCategory(post) {
  const value = post?.categories?.[0] || post?.category || post?.section || 'News'
  return String(value).replace(/[-_]/g, ' ')
}

function getJobRequirements(post = {}) {
  const lines = String(post.body || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length) return lines
  return [post.subHeader || 'Relevant experience and strong communication skills required.']
}

function getJobMeta(post = {}) {
  return {
    company: post.company || post.source || 'NendPlay Media',
    tagline: post.tagline || 'Empowering Jobs. Inspiring Futures.',
    title: post.header || post.title || 'Job Position / Title',
    location: post.location || post.jobLocation || 'Lagos, Nigeria',
    salary: post.salary || post.salaryRange || 'Salary disclosed during application',
    experience: post.experience || post.yearsExperience || post.subHeader || '2 - 4 years',
    deadline: formatDate(post.deadline || post.applicationDeadline || post.publishedAt || post.createdAt),
    appliedCount: post.appliedCount || post.applicationCount || 120,
    requirements: getJobRequirements(post),
  }
}

function isQuoteParagraph(text) {
  const trimmed = String(text || '').trim()
  return trimmed.startsWith('"') || trimmed.startsWith('“') || trimmed.startsWith("'") || trimmed.startsWith('‘')
}

function Avatar({ user, size = 42 }) {
  const name = user?.profileName || user?.username || 'User'
  if (user?.profilePic) {
    return <img src={user.profilePic} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-black text-white"
      style={{ width: size, height: size, background: 'var(--color-primary)' }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function Comment({ item, onReply, onLike }) {
  const name = item.user?.profileName || item.user?.username || 'NendPlay user'
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex gap-3">
        <Avatar user={item.user} />
        <div className="min-w-0 flex-1">
          <p className="font-black text-slate-950">{name}</p>
          <p className="mt-1 text-sm leading-6 text-slate-900">{item.text}</p>
          <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-500">
            <span>{timeAgo(item.createdAt)}</span>
            <button type="button" onClick={() => onReply(item)}>Reply</button>
            <button type="button" onClick={() => onLike(item)} className="inline-flex items-center gap-1">
              <RiHeartLine /> {item.likeCount || 0}
            </button>
          </div>
          {item.replies?.length > 0 && (
            <div className="mt-4 space-y-3 border-l border-slate-200 pl-4">
              {item.replies.map((reply) => (
                <div key={reply._id} className="flex gap-3">
                  <Avatar user={reply.user} size={30} />
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {reply.user?.profileName || reply.user?.username || 'NendPlay user'}
                    </p>
                    <p className="text-sm text-slate-900">{reply.text}</p>
                    <p className="mt-1 text-xs text-slate-500">{timeAgo(reply.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewsArticlePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)

  const videos = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'video'), [post])
  const audios = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'audio'), [post])
  const images = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'image'), [post])
  const paragraphs = useMemo(() => String(post?.body || '').split(/\n{2,}/).filter(Boolean), [post])
  const articleAdPlacement = post?.section === 'news' ? 'news' : 'all'
  const shouldShowInArticleAd = (index) => post?.adsEnabled && (index === 0 || (index + 1) % 4 === 0)

  useEffect(() => {
    loadPost()
  }, [id])

  const loadPost = async () => {
    setLoading(true)
    try {
      const res = await newsService.getPost(id)
      setPost(res.data.data.post)
    } catch {
      toast.error('News post could not be loaded')
      navigate('/news')
    } finally {
      setLoading(false)
    }
  }

  const submitComment = async (event) => {
    event.preventDefault()
    if (!isAuthenticated) {
      toast.error('Please sign in to comment')
      return
    }
    if (!comment.trim()) return
    try {
      const res = replyTarget
        ? await newsService.reply(id, replyTarget._id, { text: comment.trim() })
        : await newsService.comment(id, { text: comment.trim() })
      setPost(res.data.data.post)
      setComment('')
      setReplyTarget(null)
    } catch {
      toast.error('Could not send comment')
    }
  }

  const likePost = async () => {
    if (!isAuthenticated) return toast.error('Please sign in to like news')
    try {
      const res = await newsService.like(id)
      const data = res.data?.data || {}
      setPost((current) => current ? { ...current, likeCount: data.likeCount ?? current.likeCount } : current)
    } catch {
      toast.error('Could not like post')
    }
  }

  const likeComment = async (item) => {
    if (!isAuthenticated) return toast.error('Please sign in to like comments')
    try {
      const res = await newsService.likeComment(id, item._id)
      setPost(res.data.data.post)
    } catch {
      toast.error('Could not like comment')
    }
  }

  const sharePost = async () => {
    const url = `${window.location.origin}/news/${id}`
    try {
      await newsService.share(id)
      if (navigator.share) await navigator.share({ title: post?.header || post?.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('News link copied')
      }
      setPost((current) => current ? { ...current, shareCount: (current.shareCount || 0) + 1 } : current)
    } catch {}
  }

  if (loading) return <div className="h-96 skeleton rounded-2xl" />
  if (!post) return null

  const category = getCategory(post)
  const heroVideo = videos[0]
  const heroImage = images[0]
  const remainingVideos = videos.slice(1)
  const remainingImages = images.slice(heroImage ? 1 : 0)
  const readTime = estimateReadTime(post.body)

  if (post.section === 'career') {
    const job = getJobMeta(post)

    return (
      <div className="mx-auto max-w-5xl animate-fade-in pb-24">
        <article className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-purple-950/10 ring-1 ring-purple-100">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-8">
            <button type="button" onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-full text-slate-950 hover:bg-slate-100">
              <RiArrowLeftLine size={26} />
            </button>
            <h1 className="text-xl font-black text-slate-950 md:text-3xl">
              <span className="text-purple-700">NendPlay</span> Career
            </h1>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => toast.success('Saved for later')} className="grid h-11 w-11 place-items-center rounded-full text-slate-950 hover:bg-slate-100">
                <RiBookmarkLine size={24} />
              </button>
              <button type="button" onClick={sharePost} className="grid h-11 w-11 place-items-center rounded-full text-slate-950 hover:bg-slate-100">
                <RiShareForwardLine size={24} />
              </button>
            </div>
          </header>

          <div className="px-5 py-7 md:px-10 md:py-9">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-5">
                <div className="grid h-24 w-24 place-items-center rounded-full border border-purple-100 bg-white shadow-inner">
                  <div className="text-center">
                    <p className="text-5xl font-black text-purple-700">N</p>
                    <p className="text-sm font-black text-purple-700">NendPlay</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-black text-slate-950">{job.company}</p>
                    <RiCheckboxCircleFill className="text-2xl text-purple-700" />
                  </div>
                  <p className="mt-1 text-lg font-semibold text-slate-600">{job.tagline}</p>
                </div>
              </div>
              <span className="w-fit rounded-xl bg-purple-700 px-5 py-2 text-lg font-black text-white">New</span>
            </div>

            <h2 className="mt-10 border-b border-slate-200 pb-8 text-5xl font-black leading-tight tracking-tight text-slate-950 md:text-7xl">
              {job.title}
            </h2>

            <div className="mt-8 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="flex items-center gap-5">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-purple-50 text-purple-700">
                    <RiMapPin2Line size={34} />
                  </span>
                  <div className="grid gap-1 md:grid-cols-[160px_1fr]">
                    <p className="text-xl font-black">Location</p>
                    <p className="text-xl font-semibold text-slate-700">{job.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-purple-50 text-purple-700">
                    <RiMoneyDollarCircleLine size={34} />
                  </span>
                  <div className="grid gap-1 md:grid-cols-[120px_1fr]">
                    <p className="text-xl font-black">Salary</p>
                    <p className="text-xl font-semibold text-purple-700">{job.salary}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-8 rounded-2xl border border-purple-100 bg-purple-50/70 px-6 py-5 text-xl font-semibold text-slate-900">
                <span className="inline-flex items-center gap-3"><RiBriefcase4Line className="text-purple-700" /> {job.experience}</span>
                <span className="text-3xl font-black text-purple-700">//</span>
                <span className="inline-flex items-center gap-3"><RiCalendarLine className="text-purple-700" /> {job.deadline}</span>
              </div>
            </div>

            <div className="mt-9 border-t border-slate-100 pt-8">
              <div className="mb-5 flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-purple-50 text-purple-700">
                  <RiBookOpenLine size={28} />
                </span>
                <h3 className="text-2xl font-black text-purple-700">Requirements</h3>
              </div>
              <ul className="space-y-4 text-xl leading-8 text-slate-900">
                {job.requirements.map((requirement, index) => (
                  <li key={`${requirement}-${index}`} className="flex gap-4">
                    <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-purple-700" />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-9 flex items-center gap-5 rounded-2xl border border-dashed border-purple-400 bg-purple-50/50 p-6">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-purple-700 text-white">
                <RiCheckboxCircleFill size={34} />
              </span>
              <div>
                <p className="text-xl font-black text-slate-950">Be part of a growing team making impact every day.</p>
                <p className="mt-1 text-lg text-slate-700">Apply now and take the next step in your career.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 bg-purple-50/50 p-5 md:grid-cols-[1fr_1fr] md:p-8">
            <div className="inline-flex items-center justify-center gap-3 rounded-2xl border border-purple-100 bg-white px-6 py-5 text-xl font-bold text-purple-700">
              <RiTeamLine size={30} /> {job.appliedCount}+ people applied
            </div>
            <button type="button" onClick={sharePost} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-purple-700 px-6 py-5 text-2xl font-black text-white shadow-xl shadow-purple-700/25">
              <RiSendPlaneFill /> Apply Now
            </button>
          </div>
        </article>

        <section className="mt-8 rounded-[2rem] bg-white p-5 shadow-xl shadow-black/5 ring-1 ring-black/5 md:p-8">
          <h2 className="mb-4 text-2xl font-black text-slate-950">Comments</h2>
          <form onSubmit={submitComment} className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            {replyTarget && (
              <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-500">
                Replying to {replyTarget.user?.profileName || replyTarget.user?.username || 'comment'}
                <button type="button" onClick={() => setReplyTarget(null)}>Cancel</button>
              </div>
            )}
            <div className="flex gap-3">
              <input
                className="input-base flex-1"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={replyTarget ? 'Write a reply...' : "Let's talk about it"}
              />
              <button type="submit" className="btn-primary px-4"><RiSendPlaneFill /></button>
            </div>
          </form>

          <div className="space-y-4">
            {(post.comments || []).length === 0 ? (
              <p className="text-center text-sm text-slate-500">No comments yet.</p>
            ) : post.comments.map((item) => (
              <Comment key={item._id} item={item} onReply={setReplyTarget} onLike={likeComment} />
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in pb-24">
      <article className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/10 ring-1 ring-black/5">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-8">
          <button type="button" onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-full text-slate-950 hover:bg-slate-100">
            <RiArrowLeftLine size={26} />
          </button>
          <h1 className="text-xl font-black text-slate-950 md:text-3xl">
            <span className="text-purple-700">NendPlay</span> News
          </h1>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => navigate('/news')} className="grid h-11 w-11 place-items-center rounded-full text-slate-950 hover:bg-slate-100">
              <RiSearchLine size={24} />
            </button>
            <button type="button" onClick={sharePost} className="grid h-11 w-11 place-items-center rounded-full text-slate-950 hover:bg-slate-100">
              <RiMore2Fill size={24} />
            </button>
          </div>
        </header>

        <div className="px-5 py-7 md:px-10 md:py-9">
          <span className="inline-flex rounded-xl bg-purple-700 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">
            {category}
          </span>

          <h2 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-6xl">
            {post.header || post.title}
          </h2>
          {post.subHeader && (
            <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-slate-500 md:text-2xl">
              {post.subHeader}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-purple-700 text-3xl font-black text-white">N</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-slate-950">{post.source || 'NendPlay News'}</span>
                <RiCheckboxCircleFill className="text-purple-700" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1"><RiCalendarLine /> {formatDate(post.publishedAt || post.createdAt)}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1"><RiTimeLine /> {timeAgo(post.publishedAt || post.createdAt)}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1"><RiBookOpenLine /> {readTime}</span>
              </div>
            </div>
          </div>

          <div className="relative mt-8 aspect-video overflow-hidden rounded-3xl bg-slate-100">
            <span className="absolute left-5 top-5 z-10 rounded-xl bg-purple-700 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">
              {category}
            </span>
            {heroVideo ? (
              <>
                <ReactPlayer url={heroVideo.url} width="100%" height="100%" controls playsinline />
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-white/95 text-purple-700 shadow-xl">
                    <RiPlayFill size={34} />
                  </div>
                </div>
              </>
            ) : heroImage ? (
              <img src={heroImage.url} alt="" className="h-full w-full object-cover object-center" />
            ) : (
              <div className="grid h-full place-items-center text-purple-700">
                <RiBookOpenLine size={64} />
              </div>
            )}
          </div>

          <div className="mt-8 space-y-5">
            {remainingVideos.map((item, index) => (
              <div key={`${item.url}-${index}`} className="aspect-video overflow-hidden rounded-2xl bg-black">
                <ReactPlayer url={item.url} width="100%" height="100%" controls playsinline />
              </div>
            ))}
            {audios.map((item, index) => (
              <div key={`${item.url}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <p className="mb-3 text-sm font-bold text-slate-500">Audio report</p>
                <audio src={item.url} controls className="w-full" />
              </div>
            ))}
            {remainingImages.map((item, index) => (
              <div key={`${item.url}-${index}`} className="aspect-video overflow-hidden rounded-2xl bg-slate-100">
                <img src={item.url} alt="" className="h-full w-full object-cover object-center" />
              </div>
            ))}
          </div>

          <div className="relative mt-8 space-y-7">
            {paragraphs.map((text, index) => (
              <React.Fragment key={index}>
                {isQuoteParagraph(text) ? (
                  <blockquote className="border-l-4 border-purple-700 py-1 pl-5 text-xl italic leading-9 text-slate-950">
                    {text}
                  </blockquote>
                ) : (
                  <p className="max-w-3xl text-xl leading-9 text-slate-950">{text}</p>
                )}
                {shouldShowInArticleAd(index) && <InArticleAd placement={articleAdPlacement} />}
              </React.Fragment>
            ))}
            <button
              type="button"
              onClick={() => toast('Audio narration will be available soon')}
              className="fixed bottom-28 right-6 z-20 grid h-24 w-24 place-items-center rounded-full bg-purple-700 text-white shadow-2xl shadow-purple-700/30 md:absolute md:bottom-0 md:right-4"
            >
              <span className="flex flex-col items-center text-sm font-black"><RiHeadphoneLine size={28} /> Listen</span>
            </button>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100 md:grid-cols-4">
            <button type="button" className="flex items-center justify-center gap-3 text-slate-950 md:border-r md:border-slate-100">
              <RiChat3Line className="text-2xl text-purple-700" />
              <span><b>{post.commentCount || post.comments?.length || 0}</b><br /><small>Comments</small></span>
            </button>
            <button type="button" onClick={likePost} className="flex items-center justify-center gap-3 text-slate-950 md:border-r md:border-slate-100">
              <RiHeartLine className="text-3xl text-purple-700" />
              <span><b>{post.likeCount || 0}</b><br /><small>Likes</small></span>
            </button>
            <button type="button" onClick={() => toast.success('Saved for later')} className="flex items-center justify-center gap-3 text-slate-950 md:border-r md:border-slate-100">
              <RiBookmarkLine className="text-3xl" />
              <span className="font-bold">Save</span>
            </button>
            <button type="button" onClick={sharePost} className="flex items-center justify-center gap-3 text-slate-950">
              <RiShareForwardLine className="text-3xl text-purple-700" />
              <span className="font-bold">Share</span>
            </button>
          </div>

          {post.adsEnabled && <MultiplexAd placement={articleAdPlacement} className="mt-8" />}
        </div>
      </article>

      <section className="mt-8 rounded-[2rem] bg-white p-5 shadow-xl shadow-black/5 ring-1 ring-black/5 md:p-8">
        <h2 className="mb-4 text-2xl font-black text-slate-950">Comments</h2>
        <form onSubmit={submitComment} className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          {replyTarget && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-500">
              Replying to {replyTarget.user?.profileName || replyTarget.user?.username || 'comment'}
              <button type="button" onClick={() => setReplyTarget(null)}>Cancel</button>
            </div>
          )}
          <div className="flex gap-3">
            <input
              className="input-base flex-1"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={replyTarget ? 'Write a reply...' : "Let's talk about it"}
            />
            <button type="submit" className="btn-primary px-4"><RiSendPlaneFill /></button>
          </div>
        </form>

        <div className="space-y-4">
          {(post.comments || []).length === 0 ? (
            <p className="text-center text-sm text-slate-500">No comments yet.</p>
          ) : post.comments.map((item) => (
            <Comment key={item._id} item={item} onReply={setReplyTarget} onLike={likeComment} />
          ))}
        </div>
      </section>
    </div>
  )
}
