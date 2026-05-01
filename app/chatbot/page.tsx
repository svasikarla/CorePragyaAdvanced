"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import RagChatbot from "@/components/chatbot/RagChatbot"

export default function ChatbotPage() {
  const [user, setUser] = useState<any>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/login')
          return
        }
        
        setUser(session.user)
        setAccessToken(session.access_token)
      } catch (error) {
        console.error('Error getting user session:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    
    getUser()
  }, [router])

  return (
    <AppLayout user={user}>
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="font-playfair text-2xl font-bold tracking-tight md:text-3xl">Knowledge Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions about your knowledge base and get AI-powered answers.
          </p>
        </div>

        {!loading && (
          <div className="mt-8">
            <RagChatbot accessToken={accessToken} />
          </div>
        )}
      </div>
    </AppLayout>
  )
}
