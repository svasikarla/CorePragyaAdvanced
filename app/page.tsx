"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight, Brain, Search, MessageSquare, Mail, FileText,
  Globe, Sparkles, TrendingUp, Zap, BookOpen, Database,
  Check, ChevronRight, Star, Shield, Clock, Users,
  Newspaper, Rss, BarChart3, Flame, PenLine, FlaskConical, Cpu
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

// Animation Hook for Scroll Reveal
function useScrollReveal() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// Animated Section Wrapper
function AnimatedSection({
  children,
  className = "",
  delay = 0
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const { ref, isVisible } = useScrollReveal()

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className={`sticky top-0 z-40 w-full border-b transition-all duration-300 ${
        isScrolled
          ? 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm'
          : 'bg-background'
      }`}>
        <div className="container flex h-14 items-center space-x-4 sm:justify-between sm:space-x-0">
          <div className="flex gap-6 md:gap-10">
            <Link href="/" className="flex items-center space-x-2 group">
              <Brain className="h-5 w-5 text-indigo-700 group-hover:scale-110 transition-transform" />
              <span className="inline-block font-playfair text-lg font-bold">CorePragya</span>
            </Link>
            <nav className="hidden gap-6 md:flex">
              <Link
                href="#features"
                className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                How It Works
              </Link>
              <Link
                href="#use-cases"
                className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Use Cases
              </Link>
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" className="bg-indigo-700 hover:bg-indigo-800" asChild>
                <Link href="/login?tab=register">Get Started</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">
          <div className="container relative py-16 md:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Text content */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
                <AnimatedSection delay={0}>
                  <Badge variant="outline" className="text-indigo-700 border-indigo-300 hover:bg-indigo-50 transition-colors">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI-Powered Knowledge Intelligence
                  </Badge>
                </AnimatedSection>

                <AnimatedSection delay={100}>
                  <div className="space-y-3">
                    <h1 className="font-playfair text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                      Your Personal
                      <span className="block text-indigo-700 mt-1">AI Knowledge Assistant</span>
                    </h1>
                    <p className="max-w-[600px] text-base text-muted-foreground md:text-lg">
                      Transform articles, emails, and PDFs into an intelligent knowledge base. Get AI-curated trending news, deep insights, and instant answers — all personalized to your interests.
                    </p>
                  </div>
                </AnimatedSection>

                {/* Key Stats */}
                <AnimatedSection delay={200}>
                  <div className="grid grid-cols-3 gap-4 w-full max-w-md py-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-indigo-700">AI-Curated</div>
                      <div className="text-xs text-muted-foreground">Trending Feed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-indigo-700">Deep</div>
                      <div className="text-xs text-muted-foreground">AI Insights</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-indigo-700">Multi-Model</div>
                      <div className="text-xs text-muted-foreground">Intelligence</div>
                    </div>
                  </div>
                </AnimatedSection>

                <AnimatedSection delay={300}>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button size="lg" className="bg-indigo-700 hover:bg-indigo-800 hover:scale-105 transition-all shadow-lg hover:shadow-xl" asChild>
                      <Link href="/login?tab=register">
                        Start Building Your Knowledge Base <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" className="hover:bg-indigo-50" asChild>
                      <Link href="#how-it-works">
                        See How It Works
                      </Link>
                    </Button>
                  </div>
                </AnimatedSection>

                <AnimatedSection delay={400}>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Free to start • No credit card required
                  </p>
                </AnimatedSection>
              </div>

              {/* Hero Image/Demo */}
              <AnimatedSection delay={200}>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur-2xl opacity-20 animate-pulse"></div>
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-indigo-200 shadow-2xl hover:shadow-indigo-200 transition-shadow duration-500">
                    <Image
                      src="/Hero-image.jpg"
                      width={1200}
                      height={800}
                      alt="CorePragya Dashboard"
                      className="w-full object-cover"
                      priority
                    />
                  </div>

                  {/* Floating Feature Cards */}
                  <div className="absolute -bottom-4 -left-4 hidden lg:block animate-float">
                    <Card className="bg-white shadow-xl hover:shadow-2xl transition-shadow">
                      <CardContent className="p-3 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <Flame className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs">Trending Feed</div>
                          <div className="text-[10px] text-muted-foreground">AI-curated for you</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="absolute -top-4 -right-4 hidden lg:block animate-float-delayed">
                    <Card className="bg-white shadow-xl hover:shadow-2xl transition-shadow">
                      <CardContent className="p-3 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Sparkles className="h-4 w-4 text-indigo-700" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs">Deep Insights</div>
                          <div className="text-[10px] text-muted-foreground">AI-powered analysis</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* Core Features Section */}
        <section id="features" className="py-16 md:py-20 bg-white">
          <div className="container">
            <AnimatedSection>
              <div className="mb-12 text-center">
                <Badge variant="outline" className="mb-3">Features</Badge>
                <h2 className="font-playfair text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-3">
                  Everything You Need to Master Your Knowledge
                </h2>
                <p className="mx-auto max-w-[700px] text-base text-muted-foreground">
                  Built with cutting-edge AI technology to help you organize, discover, research, and create — all from a single platform powered by multi-agent pipelines.
                </p>
              </div>
            </AnimatedSection>

            {/* Primary Features */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-10">
              {/* Trending News Feed - NEW */}
              <AnimatedSection delay={0}>
                <Card className="border-2 border-orange-100 hover:border-orange-300 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 mb-3 group-hover:scale-110 transition-transform">
                      <Newspaper className="h-6 w-6 text-orange-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">AI-Curated Trending Feed</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Stay informed with a personalized news feed. AI scores and ranks articles from your RSS subscriptions based on your unique interest profile.
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      <Flame className="h-3 w-3 mr-1" />
                      Personalized for You
                    </Badge>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Deep AI Insights - NEW */}
              <AnimatedSection delay={100}>
                <Card className="border-2 border-indigo-100 hover:border-indigo-300 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 mb-3 group-hover:scale-110 transition-transform">
                      <Sparkles className="h-6 w-6 text-indigo-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Deep AI Insights</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Get actionable recommendations, detect macro themes across your knowledge, and uncover connections you might have missed — all powered by advanced AI analysis.
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Powered by Multi-Model AI
                    </Badge>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* RSS Intelligence - NEW */}
              <AnimatedSection delay={200}>
                <Card className="border-2 hover:border-indigo-200 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-3 group-hover:scale-110 transition-transform">
                      <Rss className="h-6 w-6 text-emerald-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Smart RSS Intelligence</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI suggests RSS feeds based on your interests. Automatic ingestion scores every article for relevance, so you only see what matters.
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">AI-Suggested</Badge>
                      <Badge variant="outline" className="text-xs">Auto-Scored</Badge>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* RAG Chatbot */}
              <AnimatedSection delay={0}>
                <Card className="border-2 hover:border-indigo-200 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-3 group-hover:scale-110 transition-transform">
                      <MessageSquare className="h-6 w-6 text-blue-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">AI-Powered Q&A Chatbot</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Ask natural language questions and get instant, contextual answers from your knowledge base using advanced RAG technology.
                    </p>
                    <Badge variant="outline" className="text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      Vector Embeddings
                    </Badge>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Multi-source Import */}
              <AnimatedSection delay={100}>
                <Card className="border-2 hover:border-indigo-200 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3 group-hover:scale-110 transition-transform">
                      <Globe className="h-6 w-6 text-green-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Multi-Source Import</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Add content from anywhere: paste URLs, import from Gmail, upload PDFs, or subscribe to RSS feeds. All processed and summarized automatically.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        <Globe className="h-3 w-3 mr-1" />
                        URLs
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        Email
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        PDFs
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Rss className="h-3 w-3 mr-1" />
                        RSS
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Analytics & Interest Profiling */}
              <AnimatedSection delay={200}>
                <Card className="border-2 hover:border-indigo-200 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 mb-3 group-hover:scale-110 transition-transform">
                      <BarChart3 className="h-6 w-6 text-pink-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Interest Profiling & Analytics</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI builds your interest profile automatically. Track knowledge growth, spot trends, and see how your expertise evolves over time.
                    </p>
                    <Badge variant="outline" className="text-xs">Visual Charts & Themes</Badge>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Content Creation Studio */}
              <AnimatedSection delay={0}>
                <Card className="border-2 border-violet-100 hover:border-violet-300 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 mb-3 group-hover:scale-110 transition-transform">
                      <PenLine className="h-6 w-6 text-violet-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Content Creation Studio</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Turn your knowledge into polished content across every platform. A 5-phase multi-agent pipeline drafts, refines, and formats posts for Medium, LinkedIn, Twitter, Substack, Dev.to, and Blog — all in one workflow.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Multi-Agent
                      </Badge>
                      <Badge variant="outline" className="text-xs">6 Platforms</Badge>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Research Intelligence */}
              <AnimatedSection delay={100}>
                <Card className="border-2 border-teal-100 hover:border-teal-300 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 mb-3 group-hover:scale-110 transition-transform">
                      <FlaskConical className="h-6 w-6 text-teal-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Research Intelligence</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Run deep research on any topic with a multi-agent pipeline that searches the web, synthesizes sources, and delivers a structured, exportable report — complete with history tracking.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        <Search className="h-3 w-3 mr-1" />
                        Web Search
                      </Badge>
                      <Badge variant="outline" className="text-xs">Export Report</Badge>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Technical Research */}
              <AnimatedSection delay={200}>
                <Card className="border-2 border-amber-100 hover:border-amber-300 transition-all hover:shadow-lg hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-3 group-hover:scale-110 transition-transform">
                      <Cpu className="h-6 w-6 text-amber-700" />
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Technical Research Agent</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Evaluate technology choices with an AI agent that analyses requirements, scores candidates, builds a trade-off matrix, and produces an architecture blueprint — so you make decisions backed by data, not guesswork.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        <Brain className="h-3 w-3 mr-1" />
                        Architecture Blueprint
                      </Badge>
                      <Badge variant="outline" className="text-xs">Trade-off Matrix</Badge>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            </div>

            {/* Feature Comparison */}
            <AnimatedSection>
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 md:p-8 border border-indigo-100">
                <h3 className="font-playfair text-xl md:text-2xl font-bold text-center mb-6">Why CorePragya Stands Out</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center group">
                    <div className="flex justify-center mb-3">
                      <Flame className="h-8 w-8 text-indigo-700 group-hover:scale-110 transition-transform" />
                    </div>
                    <h4 className="font-semibold mb-2">Proactive Intelligence</h4>
                    <p className="text-sm text-muted-foreground">AI-curated news feed and deep insights keep you ahead — not just organized</p>
                  </div>
                  <div className="text-center group">
                    <div className="flex justify-center mb-3">
                      <Shield className="h-8 w-8 text-indigo-700 group-hover:scale-110 transition-transform" />
                    </div>
                    <h4 className="font-semibold mb-2">Private & Secure</h4>
                    <p className="text-sm text-muted-foreground">Your data stays yours. Encrypted storage with Supabase</p>
                  </div>
                  <div className="text-center group">
                    <div className="flex justify-center mb-3">
                      <Brain className="h-8 w-8 text-indigo-700 group-hover:scale-110 transition-transform" />
                    </div>
                    <h4 className="font-semibold mb-2">Multi-Agent Pipelines</h4>
                    <p className="text-sm text-muted-foreground">Autonomous agents research, write, and evaluate — powered by Claude, GPT, and Groq working in concert</p>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 md:py-20 bg-slate-50">
          <div className="container">
            <AnimatedSection>
              <div className="mb-12 text-center">
                <Badge variant="outline" className="mb-3">Simple Process</Badge>
                <h2 className="font-playfair text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-3">
                  From Content to Intelligence in Minutes
                </h2>
                <p className="mx-auto max-w-[700px] text-base text-muted-foreground">
                  Build your knowledge base, and let AI keep you informed with curated content and deep insights.
                </p>
              </div>
            </AnimatedSection>

            <div className="mx-auto max-w-5xl">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Step 1 */}
                <AnimatedSection delay={0}>
                  <div className="relative group">
                    <div className="mb-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-700 text-white text-xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                        1
                      </div>
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Add Content</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Paste a URL, connect Gmail, upload a PDF, or subscribe to RSS feeds. Multiple sources supported.
                    </p>
                    <div className="flex gap-2">
                      <Globe className="h-5 w-5 text-indigo-600" />
                      <Mail className="h-5 w-5 text-indigo-600" />
                      <FileText className="h-5 w-5 text-indigo-600" />
                      <Rss className="h-5 w-5 text-indigo-600" />
                    </div>
                  </div>
                </AnimatedSection>

                {/* Step 2 */}
                <AnimatedSection delay={100}>
                  <div className="relative group">
                    <div className="mb-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-700 text-white text-xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                        2
                      </div>
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">AI Processes & Profiles</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI extracts key information, generates summaries, builds your interest profile, and creates searchable embeddings.
                    </p>
                    <Badge variant="outline" className="text-xs">Auto-Profiled</Badge>
                  </div>
                </AnimatedSection>

                {/* Step 3 */}
                <AnimatedSection delay={200}>
                  <div className="relative group">
                    <div className="mb-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white text-xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                        3
                      </div>
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Ask & Discover</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Chat with your knowledge base, browse your AI-curated trending feed, and explore deep insights.
                    </p>
                    <div className="flex gap-2">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      <Newspaper className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </AnimatedSection>

                {/* Step 4 */}
                <AnimatedSection delay={300}>
                  <div className="relative group">
                    <div className="mb-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-700 text-white text-xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                        4
                      </div>
                    </div>
                    <h3 className="font-playfair text-lg font-bold mb-2">Stay Ahead</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      AI continuously scores new articles, detects emerging themes, and keeps your feed fresh — automatically.
                    </p>
                    <div className="flex gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <Flame className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </AnimatedSection>
              </div>
            </div>

            {/* Live Demo CTA - Compact */}
            <AnimatedSection>
              <div className="mt-12 text-center">
                <Card className="inline-block bg-white shadow-xl hover:shadow-2xl transition-shadow">
                  <CardContent className="p-6">
                    <BookOpen className="h-10 w-10 text-indigo-700 mx-auto mb-3" />
                    <h3 className="font-playfair text-xl font-bold mb-2">Ready to Try It?</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-md">
                      Start building your knowledge base today. No credit card required.
                    </p>
                    <Button size="lg" className="bg-indigo-700 hover:bg-indigo-800 hover:scale-105 transition-all" asChild>
                      <Link href="/login?tab=register">
                        Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Use Cases Section */}
        <section id="use-cases" className="py-16 md:py-20 bg-white">
          <div className="container">
            <AnimatedSection>
              <div className="mb-12 text-center">
                <Badge variant="outline" className="mb-3">Use Cases</Badge>
                <h2 className="font-playfair text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-3">
                  Who Benefits from CorePragya?
                </h2>
              </div>
            </AnimatedSection>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Students */}
              <AnimatedSection delay={0}>
                <Card className="hover:shadow-lg transition-all hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <BookOpen className="h-6 w-6 text-blue-700" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Students & Researchers</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Organize research papers, lecture notes, and articles. AI detects themes across your materials and keeps you updated on new developments.
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Save research from multiple sources + RSS</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Ask questions across all your materials</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>AI-detected themes and interest profiling</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Professionals */}
              <AnimatedSection delay={100}>
                <Card className="hover:shadow-lg transition-all hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <TrendingUp className="h-6 w-6 text-purple-700" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Professionals</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Stay on top of industry news with AI-curated trending feeds. Build expertise systematically while AI surfaces what matters most.
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>AI-curated news feed tailored to your role</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Deep insights with actionable recommendations</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Smart RSS subscriptions suggested by AI</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Lifelong Learners */}
              <AnimatedSection delay={200}>
                <Card className="hover:shadow-lg transition-all hover:-translate-y-1 h-full group">
                  <CardContent className="p-5">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Brain className="h-6 w-6 text-green-700" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">Lifelong Learners</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Build a second brain for personal growth. AI automatically discovers content aligned with your evolving interests.
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Curate content from web, email, and RSS</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>AI connects related ideas across your KB</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Trending feed keeps learning momentum alive</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* Technology Section - Compact */}
        <section className="py-12 md:py-16 bg-slate-50">
          <div className="container">
            <AnimatedSection>
              <div className="mx-auto max-w-3xl text-center">
                <Badge variant="outline" className="mb-3">Powered By</Badge>
                <h2 className="font-playfair text-2xl font-bold mb-3 sm:text-3xl">
                  Built with Cutting-Edge AI Technology
                </h2>
                <p className="text-sm text-muted-foreground mb-8">
                  CorePragya leverages the latest advancements in artificial intelligence and machine learning.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { icon: Brain, name: "Multi-Model AI", desc: "Claude, GPT, Groq", color: "text-indigo-700" },
                    { icon: Database, name: "Vector DB", desc: "Semantic Search", color: "text-purple-700" },
                    { icon: Sparkles, name: "Cohere", desc: "Embeddings", color: "text-blue-700" },
                    { icon: Shield, name: "Supabase", desc: "Secure Storage", color: "text-green-700" }
                  ].map((tech, i) => (
                    <AnimatedSection key={tech.name} delay={i * 100}>
                      <div className="flex flex-col items-center group">
                        <div className="h-14 w-14 rounded-lg bg-white border shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <tech.icon className={`h-7 w-7 ${tech.color}`} />
                        </div>
                        <p className="font-semibold text-sm">{tech.name}</p>
                        <p className="text-xs text-muted-foreground">{tech.desc}</p>
                      </div>
                    </AnimatedSection>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-800 py-16 md:py-20 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/10"></div>
          <AnimatedSection>
            <div className="container relative text-center">
              <h2 className="font-playfair text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-3">
                Start Building Your Knowledge Base Today
              </h2>
              <p className="mx-auto max-w-[700px] text-base text-indigo-100 mb-6">
                Join researchers, professionals, and learners who are transforming how they organize, discover, and stay ahead with AI-powered knowledge intelligence.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
                <Button size="lg" className="bg-white text-indigo-700 hover:bg-indigo-50 hover:scale-105 transition-all shadow-xl" asChild>
                  <Link href="/login?tab=register">
                    Get Started Free <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
                  <Link href="/dashboard">
                    View Live Demo
                  </Link>
                </Button>
              </div>

              <div className="flex flex-wrap gap-4 justify-center items-center text-sm text-indigo-200">
                <span className="flex items-center">
                  <Check className="h-4 w-4 mr-1" />
                  No credit card required
                </span>
                <span className="flex items-center">
                  <Check className="h-4 w-4 mr-1" />
                  Free forever plan
                </span>
                <span className="flex items-center">
                  <Check className="h-4 w-4 mr-1" />
                  Setup in 2 minutes
                </span>
              </div>
            </div>
          </AnimatedSection>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-slate-50 py-8">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex flex-col items-center gap-3 md:items-start">
              <Link href="/" className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-indigo-700" />
                <span className="inline-block font-playfair text-lg font-bold">CorePragya</span>
              </Link>
              <p className="text-center text-xs text-muted-foreground md:text-left max-w-sm">
                AI-powered knowledge intelligence for the modern learner. Transform information into insight, and stay ahead with curated content.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-sm">
              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-sm">Product</h3>
                <Link href="#features" className="text-xs text-muted-foreground hover:text-foreground">
                  Features
                </Link>
                <Link href="#how-it-works" className="text-xs text-muted-foreground hover:text-foreground">
                  How It Works
                </Link>
                <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-sm">Resources</h3>
                <Link href="/knowledge-base" className="text-xs text-muted-foreground hover:text-foreground">
                  Knowledge Base
                </Link>
                <Link href="/personal-rag-bot" className="text-xs text-muted-foreground hover:text-foreground">
                  AI Chatbot
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-sm">Company</h3>
                <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">
                  About
                </Link>
                <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-bold text-sm">Legal</h3>
                <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">
                  Privacy Policy
                </Link>
                <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} CorePragya. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float 3s ease-in-out infinite;
          animation-delay: 1.5s;
        }

        .bg-grid-white\/10 {
          background-image: linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  )
}
