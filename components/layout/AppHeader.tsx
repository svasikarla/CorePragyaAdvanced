"use client"

import { useState } from "react"
import Link from "next/link"
import { Brain, LogOut, User, Settings, Menu, X } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import NotificationPanel from "@/components/ui/NotificationPanel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"

interface AppHeaderProps {
  user: any;
}

export default function AppHeader({ user }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const navItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Knowledge Base", href: "/knowledge-base" },
    { name: "Personal RAG Bot", href: "/personal-rag-bot" },
    { name: "Subscriptions", href: "/knowledge-base/subscriptions" },
    { name: "Research", href: "/research" },
    { name: "Tech Research", href: "/tech-research" },
    { name: "Content Studio", href: "/content-creation" },
    { name: "Automations", href: "/automations" },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2 mr-6">
            <Brain className="h-6 w-6 text-indigo-700" />
            <span className="inline-block font-playfair text-xl font-bold tracking-tight">CorePragya</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium px-4 py-2 rounded-full transition-all duration-200 ${
                  pathname === item.href
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          {user && (
            <>
              <NotificationPanel userId={user.id} />

              {/* Mobile hamburger menu */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 p-0">
                  <div className="flex flex-col h-full">
                    {/* Mobile nav header */}
                    <div className="flex items-center justify-between p-4 border-b">
                      <Link href="/" className="flex items-center space-x-2" onClick={() => setMobileOpen(false)}>
                        <Brain className="h-5 w-5 text-indigo-700" />
                        <span className="font-playfair text-lg font-bold">CorePragya</span>
                      </Link>
                    </div>

                    {/* User info */}
                    <div className="p-4 border-b bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border shadow-sm">
                          <AvatarImage
                            src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                            alt={user.user_metadata?.full_name || user.email || "User"}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-semibold">
                            {user.email?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{user.user_metadata?.full_name || "User"}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation links */}
                    <nav className="flex-1 p-3 space-y-1">
                      {navItems.map((item) => (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`block text-sm font-medium px-3 py-2.5 rounded-lg transition-colors ${
                            pathname === item.href
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                          }`}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </nav>

                    {/* Sign out */}
                    <div className="p-3 border-t">
                      <button
                        onClick={() => { setMobileOpen(false); handleSignOut(); }}
                        className="flex items-center w-full text-sm font-medium px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Desktop avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hidden md:inline-flex">
                    <Avatar className="h-10 w-10 border border-border shadow-sm cursor-pointer transition-transform hover:scale-105 duration-200">
                      <AvatarImage
                        src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                        alt={user.user_metadata?.full_name || user.email || "User avatar"}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold shadow-inner">
                        {user.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 mt-2 p-2 shadow-lg rounded-xl" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">
                        {user.user_metadata?.full_name || "User Account"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem className="cursor-pointer py-2 px-3 rounded-md transition-colors hover:bg-slate-100">
                    <User className="mr-3 h-4 w-4 text-slate-500" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer py-2 px-3 rounded-md transition-colors hover:bg-slate-100">
                    <Settings className="mr-3 h-4 w-4 text-slate-500" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer py-2 px-3 rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:text-red-700"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
