import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  RiArrowRightLine, RiBookmarkLine, RiCalendarLine,
  RiBriefcase4Line, RiCheckboxCircleFill, RiGlobalLine, RiMapPin2Line,
  RiMoneyDollarCircleLine, RiSearchLine, RiTeamLine, RiTimeLine,
} from 'react-icons/ri'
import { newsService } from '../services'
import { InArticleAd, MultiplexAd } from '../components/ads/GoogleAdSlot'

const NEWS_TABS = [
  { value: 'for-you', label: 'For you' },
  { value: 'headlines', label: 'Headlines' },
  { value: 'local', label: 'Local' },
  { value: 'nigeria', label: 'Nigeria' },
  { value: 'world', label: 'World' },
  { value: 'business', label: 'Business' },
  { value: 'technology', label: 'Technology' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'sports', label: 'Sports' },
  { value: 'science', label: 'Science' },
  { value: 'health', label: 'Health' },
]

const HUB_TABS = [
  { value: 'news', label: 'News' },
  { value: 'career', label: 'Career' },
  { value: 'unspoken', label: 'Unspoken' },
]

const CAREER_JOB_MODE_TABS = [
  { value: 'on-site', label: 'On-Site Jobs' },
  { value: 'remote', label: 'Remote Jobs' },
  { value: 'hybrid', label: 'Hybrid Jobs' },
]

const CAREER_TABS = [
  { value: 'for-you', label: 'All Categories' },
  'Agriculture', 'Arts & Entertainment', 'Business', 'Construction', 'Education',
  'Engineering', 'Finance', 'Government', 'Healthcare', 'Information Technology',
  'Law', 'Manufacturing', 'Media & Communications', 'Military', 'Science',
  'Social Services', 'Sports', 'Transportation', 'Hospitality & Tourism',
  'Skilled Trades', 'Environmental Services', 'Virtual Assistance',
].map((item) => (typeof item === 'string' ? { value: item.toLowerCase(), label: item } : item))

function timeAgo(value) {
  if (!value) return 'Today'
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff) || diff < 0) return 'Today'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return 'Today'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function estimateReadTime(article = {}) {
  const text = [article.header, article.title, article.subHeader, article.summary, article.body]
    .filter(Boolean)
    .join(' ')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 220))} min read`
}

function getArticleCategory(article = {}) {
  const categories = article.categories || article.category || article.tab
  const value = Array.isArray(categories) ? categories[0] : categories
  return String(value || article.section || 'News').replace(/-/g, ' ')
}

function formatCategoryLabel(value) {
  return String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getJobRequirements(article = {}) {
  const lines = String(article.body || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length) return lines.slice(0, 4)
  const fallback = article.subHeader || article.summary || 'Relevant experience and strong communication skills required.'
  return [fallback]
}

function getJobMeta(article = {}) {
  const deadlineValue = article.deadline || article.applicationDeadline || article.publishedAt || article.createdAt
  return {
    company: article.company || article.source || 'NendPlay Media',
    tagline: article.tagline || 'Empowering Jobs. Inspiring Futures.',
    title: article.header || article.title || 'Job Position / Title',
    location: article.location || article.jobLocation || 'Lagos, Nigeria',
    salary: article.salary || article.salaryRange || 'Salary disclosed during application',
    experience: article.experience || article.yearsExperience || article.subHeader || '2 - 4 years',
    deadline: formatDate(deadlineValue),
    category: formatCategoryLabel(getArticleCategory(article)),
    requirements: getJobRequirements(article),
    appliedCount: article.appliedCount || article.applicationCount || 120,
  }
}

function NewsCard({ article, featured = false, onOpen }) {
  const imageUrl = article.imageUrl || article.coverImage || article.thumbnailUrl
  const title = article.header || article.title || 'Untitled story'
  const excerpt = article.subHeader || article.summary || article.body || ''
  const category = getArticleCategory(article)

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(article)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(article)
      }}
      className={`group cursor-pointer overflow-hidden rounded-2xl bg-white text-slate-950 shadow-[0_14px_42px_rgba(15,23,42,0.14)] transition-transform hover:-translate-y-1 ${featured ? 'max-w-4xl' : ''}`}
    >
      <div className={`relative overflow-hidden bg-slate-100 ${featured ? 'aspect-[16/8]' : 'aspect-[16/9]'}`}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-100 via-white to-purple-100">
            <RiGlobalLine className="text-5xl text-sky-600" />
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
          {category}
        </span>
      </div>

      <div className={featured ? 'p-5 md:p-7' : 'p-4'}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-2">
            <RiCalendarLine className="text-base" />
            {formatDate(article.publishedAt || article.createdAt)}
          </span>
          <span aria-hidden="true">&bull;</span>
          <span className="inline-flex items-center gap-2">
            <RiTimeLine className="text-base" />
            {estimateReadTime(article)}
          </span>
        </div>

        <h2
          className={`${featured ? 'text-2xl md:text-4xl' : 'text-lg md:text-xl'} font-black leading-tight text-slate-950`}
          style={{ fontFamily: 'Georgia, Cambria, serif' }}
        >
          {title}
        </h2>

        {excerpt && (
          <p className={`${featured ? 'mt-4 text-base leading-7' : 'mt-3 text-sm leading-5'} line-clamp-2 text-slate-500`}>
            {excerpt}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="inline-flex items-center gap-2 text-sm font-black text-blue-700">
            Read more <RiArrowRightLine className="text-xl" />
          </span>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Bookmark story"
          >
            <RiBookmarkLine className="text-xl" />
          </button>
        </div>
      </div>
    </article>
  )
}

function JobCard({ article, onOpen }) {
  const job = getJobMeta(article)

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(article)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(article)
      }}
      className="group cursor-pointer rounded-[1.75rem] bg-white p-5 text-slate-950 shadow-[0_18px_48px_rgba(88,28,135,0.16)] ring-1 ring-purple-100 transition-transform hover:-translate-y-1 md:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-purple-100 bg-white">
            <span className="text-3xl font-black text-purple-700">N</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-black">{job.company}</p>
              <RiCheckboxCircleFill className="shrink-0 text-purple-700" />
            </div>
            <p className="line-clamp-1 text-sm font-semibold text-slate-500">{job.tagline}</p>
          </div>
        </div>
        <span className="rounded-xl bg-purple-700 px-3 py-1.5 text-sm font-black text-white">New</span>
      </div>

      <h2 className="mt-6 line-clamp-2 text-3xl font-black leading-tight tracking-tight md:text-4xl">
        {job.title}
      </h2>

      <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-purple-700">
              <RiMapPin2Line size={24} />
            </span>
            <div>
              <p className="text-sm font-black">Location</p>
              <p className="text-sm font-semibold text-slate-600">{job.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-purple-700">
              <RiMoneyDollarCircleLine size={24} />
            </span>
            <div>
              <p className="text-sm font-black">Salary</p>
              <p className="text-sm font-semibold text-purple-700">{job.salary}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-purple-100 bg-purple-50/60 px-4 py-3 text-sm font-bold text-slate-800">
          <span className="inline-flex items-center gap-2"><RiBriefcase4Line className="text-purple-700" /> {job.experience}</span>
          <span className="text-purple-700">//</span>
          <span className="inline-flex items-center gap-2"><RiCalendarLine className="text-purple-700" /> {job.deadline}</span>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-purple-700">Requirements</p>
          <ul className="space-y-2 text-sm font-medium text-slate-700">
            {job.requirements.slice(0, 3).map((requirement, index) => (
              <li key={`${requirement}-${index}`} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-700" />
                <span className="line-clamp-1">{requirement}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-dashed border-purple-300 bg-purple-50/50 p-4">
          <p className="font-black">Be part of a growing team making impact every day.</p>
          <p className="mt-1 text-sm text-slate-600">Apply now and take the next step in your career.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold text-purple-700">
          <RiTeamLine size={20} /> {job.appliedCount}+ people applied
        </div>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-700 px-4 py-3 text-sm font-black text-white">
          Apply Now <RiArrowRightLine size={20} />
        </button>
      </div>
    </article>
  )
}
export default function DailyNewsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [articles, setArticles] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const loadingMoreRef = useRef(false)
  const sentinelRef = useRef(null)
  const activeSection = searchParams.get('section') || 'news'
  const activeTab = searchParams.get('tab') || 'for-you'
  const activeJobMode = searchParams.get('jobMode') || 'on-site'

  const params = useMemo(() => ({
    section: activeSection,
    tab: activeTab,
    jobMode: activeSection === 'career' ? activeJobMode : undefined,
    search: searchParams.get('search') || undefined,
    country: 'Nigeria',
    page: Number(searchParams.get('page') || 1),
    limit: 18,
  }), [activeSection, activeTab, activeJobMode, searchParams])

  useEffect(() => {
    loadNews(1, false)
  }, [activeSection, activeTab, activeJobMode, searchParams.get('search')])

  const loadNews = async (page = 1, append = false) => {
    if (append && loadingMoreRef.current) return
    loadingMoreRef.current = append
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const res = await newsService.getDailyNews({ ...params, page })
      const payload = res.data?.data?.data || res.data?.data || {}
      setArticles((current) => append ? [...current, ...(payload.articles || [])] : (payload.articles || []))
      setPagination(payload.pagination || null)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }

  const loadNextPage = useCallback(() => {
    if (!pagination || loading || loadingMore || pagination.page >= pagination.pages) return
    loadNews((pagination.page || 1) + 1, true)
  }, [pagination, loading, loadingMore, params])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !pagination || pagination.page >= pagination.pages) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadNextPage()
    }, { rootMargin: '450px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadNextPage, pagination])

  const openArticle = (article) => {
    if (article.kind === 'nendplay' || article._id) {
      navigate(`/news/${article._id || article.id}`)
      return
    }
    if (article.url) window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  const submitSearch = (event) => {
    event.preventDefault()
    setSearchParams({
      section: activeSection,
      tab: activeTab,
      ...(activeSection === 'career' ? { jobMode: activeJobMode } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    })
  }

  const featured = articles[0]
  const rest = articles.slice(1)
  const categoryTabs = activeSection === 'career' ? CAREER_TABS : NEWS_TABS
  const feedAdPlacement = activeSection === 'news' ? 'news' : 'all'

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <RiGlobalLine className="text-xl" />
          </div>
          <h1 className="font-display text-3xl font-black" style={{ color: 'var(--color-text)' }}>
            {HUB_TABS.find((tab) => tab.value === activeSection)?.label || 'News'} Globe
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {activeSection === 'news'
              ? 'For you mixes every category, with NendPlay editorials shown first.'
              : activeSection === 'career'
                ? 'Browse NendPlay career opportunities by job type and category.'
                : 'Fresh NendPlay posts from the admin desk.'}
          </p>
        </div>
        <form onSubmit={submitSearch} className="relative w-full max-w-md">
          <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            className="input-base py-2.5 pl-11 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search news..."
          />
        </form>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {HUB_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSearchParams({
              section: tab.value,
              tab: 'for-you',
              ...(tab.value === 'career' ? { jobMode: 'on-site' } : {}),
              ...(search.trim() ? { search: search.trim() } : {}),
            })}
            className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black"
            style={{
              background: activeSection === tab.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeSection === tab.value ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === 'career' && (
        <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {CAREER_JOB_MODE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSearchParams({
                section: 'career',
                jobMode: tab.value,
                tab: activeTab,
                ...(search.trim() ? { search: search.trim() } : {}),
              })}
              className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black"
              style={{
                background: activeJobMode === tab.value ? 'var(--color-primary)' : 'var(--color-surface)',
                color: activeJobMode === tab.value ? '#fff' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSearchParams({
              section: activeSection,
              tab: tab.value,
              ...(activeSection === 'career' ? { jobMode: activeJobMode } : {}),
              ...(search.trim() ? { search: search.trim() } : {}),
            })}
            className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black"
            style={{
              background: activeTab === tab.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === tab.value ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">
          <div className="h-80 skeleton rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 skeleton rounded-2xl" />
            <div className="h-56 skeleton rounded-2xl" />
          </div>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
          No news found.
        </div>
      ) : (
        <>
          {featured && (
            <div className="mb-4">
              {activeSection === 'career'
                ? <JobCard article={featured} onOpen={openArticle} />
                : <NewsCard article={featured} featured onOpen={openArticle} />}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rest.map((article, index) => (
              <React.Fragment key={article._id || article.id || index}>
                {activeSection === 'career'
                  ? <JobCard article={article} onOpen={openArticle} />
                  : <NewsCard article={article} onOpen={openArticle} />}
                {(index + (featured ? 2 : 1)) % 4 === 0 && (
                  <div className="md:col-span-2 xl:col-span-3">
                    <InArticleAd placement={feedAdPlacement} />
                  </div>
                )}
              </React.Fragment>
            ))}
            <div className="md:col-span-2 xl:col-span-3">
              <MultiplexAd placement={feedAdPlacement} />
            </div>
          </div>
          <div ref={sentinelRef} className="mt-8 flex min-h-12 justify-center">
            {loadingMore && <span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>Loading more news...</span>}
          </div>
        </>
      )}
    </div>
  )
}
