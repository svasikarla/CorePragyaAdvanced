"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, Sparkles, Newspaper, Rss, MessageSquare, Check } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!email || !password) {
        throw new Error("Email and password are required")
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      window.location.href = "/knowledge-base"
    } catch (error: any) {
      setError("Login failed. Please check your credentials.")
      console.error("Login error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setRegistrationSuccess(false)

    try {
      if (!email || !password) {
        throw new Error("Email and password are required")
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters")
      }

      const { error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) throw error

      setRegistrationSuccess(true)

      window.location.href = "/knowledge-base"
    } catch (error: any) {
      setError("Registration failed. Please try again.")
      console.error("Registration error:", error)
    } finally {
      setLoading(false)
    }
  }

  const highlights = [
    { icon: Newspaper, text: "AI-curated trending news feed personalized to your interests" },
    { icon: Sparkles, text: "Deep AI insights with actionable recommendations" },
    { icon: Rss, text: "Smart RSS subscriptions suggested by AI" },
    { icon: MessageSquare, text: "Ask questions and get instant answers from your knowledge base" },
  ]

  return (
    <div className="flex min-h-screen">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-800 text-white flex-col justify-between p-12 overflow-hidden">
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Decorative blurred circles */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center space-x-2 group">
            <Brain className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
            <span className="font-playfair text-xl font-bold">CorePragya</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="font-playfair text-3xl font-bold leading-tight mb-3">
              Your Personal AI<br />Knowledge Intelligence
            </h2>
            <p className="text-indigo-200 text-sm leading-relaxed max-w-md">
              Transform how you learn, discover, and stay informed. AI does the heavy lifting so you can focus on what matters.
            </p>
          </div>

          <div className="space-y-4">
            {highlights.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10"
              >
                <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-md bg-white/15 flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm text-indigo-100 leading-snug">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-indigo-300">
            &copy; {new Date().getFullYear()} CorePragya. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-slate-50 p-6 sm:p-8">
        {/* Mobile logo (visible only on small screens) */}
        <Link href="/" className="mb-8 flex items-center space-x-2 lg:hidden">
          <Brain className="h-8 w-8 text-indigo-700" />
          <span className="inline-block font-playfair text-2xl font-bold">CorePragya</span>
        </Link>

        <Card className="w-full max-w-md shadow-lg border-0 bg-white">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="font-playfair text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="login-email" className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <div>
                      <label htmlFor="login-password" className="text-xs font-medium text-slate-600 mb-1 block">Password</label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full h-11 bg-indigo-700 hover:bg-indigo-800 transition-colors" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="register">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="register-email" className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                    <div>
                      <label htmlFor="register-password" className="text-xs font-medium text-slate-600 mb-1 block">Password</label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Min. 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  {registrationSuccess && (
                    <div className="rounded-lg bg-green-50 p-3 flex items-center gap-2 border border-green-200">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <p className="text-sm text-green-800">
                        Registration successful! Redirecting...
                      </p>
                    </div>
                  )}
                  <Button type="submit" className="w-full h-11 bg-indigo-700 hover:bg-indigo-800 transition-colors" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 pt-2">
            <div className="text-center text-xs text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link href="#" className="underline underline-offset-4 hover:text-primary">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="#" className="underline underline-offset-4 hover:text-primary">
                Privacy Policy
              </Link>
              .
            </div>
          </CardFooter>
        </Card>

        {/* Mobile feature highlights */}
        <div className="mt-8 w-full max-w-md space-y-2 lg:hidden">
          {highlights.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
