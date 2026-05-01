"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Database, RefreshCw, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import AppLayout from "@/components/layout/AppLayout"
import RagChatbot from "@/components/chatbot/RagChatbot"

export default function PersonalRagBotPage() {
  const [user, setUser] = useState<any>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingEmbeddings, setProcessingEmbeddings] = useState(false)
  const [embeddingStats, setEmbeddingStats] = useState<{
    total: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
  }>({ total: 0, withEmbeddings: 0, withoutEmbeddings: 0 })
  const [activeTab, setActiveTab] = useState("chat")
  const router = useRouter()
  const { toast } = useToast()

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
        await fetchEmbeddingStats()
      } catch (error) {
        console.error('Error getting user session:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    
    getUser()
  }, [router])

  const fetchEmbeddingStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const token = session.access_token

      // Fetch total embeddings count
      const response = await fetch('/api/embedding-stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch embedding stats')
      }

      const stats = await response.json()
      setEmbeddingStats(stats)
    } catch (error) {
      console.error('Error fetching embedding stats:', error)
      toast({
        title: "Error",
        description: "Failed to fetch embedding statistics",
        variant: "destructive"
      })
    }
  }

  const generateEmbeddings = async () => {
    try {
      setProcessingEmbeddings(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({
          title: "Error",
          description: "You need to be logged in to generate embeddings",
          variant: "destructive"
        })
        return
      }

      const token = session.access_token

      // Call the embedding generation API
      const response = await fetch('/api/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ limit: 50 }) // Process up to 50 chunks at a time
      })

      if (!response.ok) {
        throw new Error('Failed to generate embeddings')
      }

      const result = await response.json()
      
      toast({
        title: "Success",
        description: `Processed ${result.processed} embeddings. ${result.failed || 0} failed.`,
        variant: "default"
      })

      // Refresh stats
      await fetchEmbeddingStats()
      
      // If there are still embeddings to process, show a message
      if (embeddingStats.withoutEmbeddings > result.processed) {
        toast({
          title: "Information",
          description: `There are still ${embeddingStats.withoutEmbeddings - result.processed} chunks without embeddings. You may need to run the process again.`,
          variant: "default"
        })
      }
      
    } catch (error) {
      console.error('Error generating embeddings:', error)
      toast({
        title: "Error",
        description: "Failed to generate embeddings",
        variant: "destructive"
      })
    } finally {
      setProcessingEmbeddings(false)
    }
  }

  return (
    <AppLayout user={user}>
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="font-playfair text-2xl font-bold tracking-tight md:text-3xl">Personal RAG Bot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your personal AI assistant powered by your knowledge base.
          </p>
        </div>

        {!loading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="manage">Manage Embeddings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="space-y-4">
              <RagChatbot accessToken={accessToken} />
            </TabsContent>
            
            <TabsContent value="manage" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Embeddings Management</CardTitle>
                  <CardDescription>
                    Generate and manage embeddings for your knowledge base.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Chunks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{embeddingStats.total}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">With Embeddings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{embeddingStats.withEmbeddings}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pending Embeddings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{embeddingStats.withoutEmbeddings}</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {embeddingStats.withoutEmbeddings > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Action Required</AlertTitle>
                      <AlertDescription>
                        You have {embeddingStats.withoutEmbeddings} chunks without embeddings. 
                        Generate embeddings to enable AI search capabilities.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex justify-center mt-4">
                    <Button 
                      onClick={generateEmbeddings} 
                      disabled={processingEmbeddings || embeddingStats.withoutEmbeddings === 0}
                      className="bg-indigo-700 hover:bg-indigo-800"
                    >
                      {processingEmbeddings ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing Embeddings
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          Generate Embeddings
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={fetchEmbeddingStats} 
                      className="ml-2"
                      disabled={processingEmbeddings}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Stats
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  )
}
