import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './Auth';
import { Chat, Message, subscribeToChats, subscribeToMessages, createChat, sendMessage, updateChatTitle, deleteChat, pinChat } from '../services/db';
import { askKarachiSahulat, generateChatTitle } from '../services/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, PlusCircle, MessageSquare, Send, MapPin, Menu, Check, Clock, Search, X, Edit2, Filter, Loader2, AlertTriangle, Zap, MoreHorizontal, Trash2, Pin, PinOff } from 'lucide-react';
import { auth } from '../services/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Logo } from './Logo';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { format } from 'date-fns';
import { updateUserProfile } from '../services/db';

export function ChatApp() {
  const user = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [senderFilter, setSenderFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameChatVal, setRenameChatVal] = useState('');
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid, (data) => {
      setChats(data);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user || !activeChatId) {
      setMessages([]);
      return;
    }
    const unsub = subscribeToMessages(activeChatId, user.uid, (data) => {
      setMessages(data);
      // scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    });
    return unsub;
  }, [user, activeChatId]);

  const handleNewChat = async () => {
    if (!user) return;
    const chat = await createChat(user.uid, "New Consultation");
    setActiveChatId(chat.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSendMessage = async () => {
    if (!user || !inputVal.trim() || isSending) return;
    let chatId = activeChatId;
    let isNewChat = false;
    if (!chatId) {
      isNewChat = true;
      const chat = await createChat(user.uid, inputVal.trim().slice(0, 30) + '...');
      chatId = chat.id;
      setActiveChatId(chatId);
    }
    
    setIsSending(true);
    const content = inputVal.trim();
    setInputVal('');
    
    // Generate an intelligent title for new chats in the background
    if (isNewChat) {
      generateChatTitle(content).then(title => {
        updateChatTitle(chatId as string, title);
      }).catch(e => console.error("Failed to generate chat title:", e));
    }
    
    // Add user message optimistically (network request runs in background)
    try {
      sendMessage(chatId, user.uid, 'user', content).catch(e => {
        console.error("Failed to send message:", e);
      });
      
      // Get AI response
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })) as {role: 'user'|'model', parts: {text: string}[]}[];
      
      const aiResponse = await askKarachiSahulat(history, content);
      
      // Add AI message
      await sendMessage(chatId, user.uid, 'ai', aiResponse);
    } catch (e) {
      console.error(e);
      // Could show a toast here
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName: editDisplayName });
      await updateUserProfile(user.uid, editDisplayName);
      setProfileDialogOpen(false);
    } catch (error) {
      console.error("Failed to update profile", error);
    }
  };

  if (!user) return null;

  const sortedChats = [...chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const timeA = a.updatedAt && typeof a.updatedAt.toMillis === 'function' ? a.updatedAt.toMillis() : 0;
    const timeB = b.updatedAt && typeof b.updatedAt.toMillis === 'function' ? b.updatedAt.toMillis() : 0;
    return timeB - timeA;
  });

  const filteredChats = sortedChats.filter(chat => chat.title?.toLowerCase().includes(sidebarSearchQuery.toLowerCase()));

  const filteredMessages = messages.filter(msg => {
    if (searchQuery && !msg.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (senderFilter !== 'all' && msg.sender !== senderFilter) return false;
    
    if (startDate || endDate) {
      if (!msg.createdAt || typeof msg.createdAt.toDate !== 'function') return false;
      const msgDate = msg.createdAt.toDate();
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        if (msgDate < s) return false;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        if (msgDate > e) return false;
      }
    }
    return true;
  });

  return (
    <div className="flex h-[100dvh] bg-stone-50 text-stone-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed md:relative z-20 flex-col w-64 h-full bg-stone-100 border-r border-stone-200 transition-transform transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex`}>
        <div className="p-4 flex items-center justify-between border-b border-stone-200">
          <div className="flex items-center gap-2 text-emerald-700">
            <Logo size={24} />
            <span className="font-semibold text-lg tracking-tight text-stone-900">Karachi Sahulat</span>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <Menu size={20} />
          </Button>
        </div>
        <div className="p-3 space-y-3">
          <Button onClick={handleNewChat} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2">
            <PlusCircle size={18} />
            New Update
          </Button>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
            <Input 
              value={sidebarSearchQuery}
              onChange={e => setSidebarSearchQuery(e.target.value)}
              placeholder="Search chat history..." 
              className="pl-7 h-8 bg-white border-stone-300 focus-visible:ring-emerald-500 text-xs shadow-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
            {filteredChats.length === 0 && sidebarSearchQuery ? (
               <div className="text-center text-stone-500 text-xs py-4">No chats found</div>
            ) : filteredChats.map(chat => (
              <div key={chat.id} className={`group flex items-center justify-between p-2 rounded-md text-sm transition-colors ${activeChatId === chat.id ? 'bg-stone-200 font-medium' : 'hover:bg-stone-200/50 text-stone-600'}`}>
                {renameChatId === chat.id ? (
                  <Input 
                    autoFocus
                    className="h-7 text-xs px-2"
                    value={renameChatVal}
                    onChange={e => setRenameChatVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (renameChatVal.trim()) updateChatTitle(chat.id, renameChatVal.trim());
                        setRenameChatId(null);
                      } else if (e.key === 'Escape') {
                        setRenameChatId(null);
                      }
                    }}
                    onBlur={() => setRenameChatId(null)}
                  />
                ) : (
                  <>
                    <button 
                      className="flex-1 flex items-center gap-2 truncate overflow-hidden text-left"
                      onClick={() => {
                        setActiveChatId(chat.id);
                        if (window.innerWidth < 768) setSidebarOpen(false);
                      }}
                    >
                      <MessageSquare size={16} className="shrink-0" />
                      <span className="truncate">{chat.pinned && <Pin size={12} className="inline mr-1 shrink-0" />} {chat.title}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-6 w-6 flex items-center justify-center rounded-md text-stone-500 hover:bg-stone-200/80 opacity-0 group-hover:opacity-100 shrink-0 ml-1">
                        <MoreHorizontal size={14} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          if (chat.pinned) pinChat(chat.id, false);
                          else pinChat(chat.id, true);
                        }}>
                          {chat.pinned ? <><PinOff size={14} className="mr-2" /> Unpin</> : <><Pin size={14} className="mr-2" /> Pin</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setRenameChatId(chat.id);
                          setRenameChatVal(chat.title);
                        }}>
                          <Edit2 size={14} className="mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={(e) => {
                          setTimeout(() => setDeleteChatId(chat.id), 0);
                        }}>
                          <Trash2 size={14} className="mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-stone-200">
          <div className="flex items-center gap-3">
             <Avatar className="h-9 w-9 border border-stone-300">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="bg-emerald-100 text-emerald-800">{user.email?.[0].toUpperCase()}</AvatarFallback>
             </Avatar>
             <div className="flex-1 truncate">
               <div className="text-sm font-medium truncate flex items-center gap-1">
                 {user.displayName}
                 <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                   <DialogTrigger className="text-stone-400 hover:text-emerald-600 transition-colors" onClick={() => setEditDisplayName(user.displayName || '')} title="Edit Profile">
                     <Edit2 size={12} />
                   </DialogTrigger>
                   <DialogContent className="sm:max-w-[425px]">
                     <DialogHeader>
                       <DialogTitle>Edit Profile</DialogTitle>
                     </DialogHeader>
                     <div className="grid gap-4 py-4">
                       <div className="grid gap-2">
                         <Label htmlFor="name">Display Name</Label>
                         <Input 
                           id="name" 
                           value={editDisplayName} 
                           onChange={(e) => setEditDisplayName(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') handleSaveProfile();
                           }}
                         />
                       </div>
                     </div>
                     <div className="flex justify-end gap-2">
                       <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>Cancel</Button>
                       <Button onClick={handleSaveProfile} className="bg-emerald-600 hover:bg-emerald-700 text-white">Save changes</Button>
                     </div>
                   </DialogContent>
                 </Dialog>
               </div>
             </div>
             <Button variant="ghost" size="icon" onClick={() => signOut(auth)} title="Log Out" className="text-stone-500 hover:text-stone-800">
                <LogOut size={16} />
             </Button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        <header className="h-14 border-b border-stone-100 flex items-center justify-between px-4 shrink-0 bg-white z-10 relative">
          <div className="flex items-center gap-2 overflow-hidden flex-1 mr-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0">
              <Menu size={20} />
            </Button>
            {activeChatId ? (
              <Dialog open={titleDialogOpen} onOpenChange={setTitleDialogOpen}>
                <DialogTrigger className="font-semibold text-lg tracking-tight text-stone-900 hover:text-emerald-600 transition-colors flex items-center gap-2 group text-left min-w-0">
                  <span className="truncate">{chats.find(c => c.id === activeChatId)?.title}</span>
                  <Edit2 size={14} className="opacity-0 group-hover:opacity-100 shrink-0 text-stone-400" />
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Chat Title</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Chat Title</Label>
                      <Input 
                        id="title" 
                        defaultValue={chats.find(c => c.id === activeChatId)?.title}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const newTitle = e.currentTarget.value.trim();
                            if (newTitle) {
                              updateChatTitle(activeChatId, newTitle);
                              setTitleDialogOpen(false);
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setTitleDialogOpen(false)}>Cancel</Button>
                    <Button onClick={() => {
                        const input = document.getElementById('title') as HTMLInputElement;
                        const newTitle = input?.value.trim();
                        if (newTitle) {
                           updateChatTitle(activeChatId, newTitle);
                           setTitleDialogOpen(false);
                        }
                    }} className="bg-emerald-600 hover:bg-emerald-700 text-white">Save</Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <div className="font-semibold text-lg tracking-tight text-stone-900 truncate">
                Karachi Sahulat AI
              </div>
            )}
          </div>
          {activeChatId && messages.length > 0 && (
            <div className="flex items-center gap-1">
              <Button 
                variant={isSearchOpen ? "secondary" : "ghost"} 
                size="icon" 
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  if (isSearchOpen) setSearchQuery('');
                }} 
                className="text-stone-500 hover:text-stone-800"
              >
                <Search size={18} />
              </Button>
            </div>
          )}
        </header>

        {isSearchOpen && activeChatId && (
          <div className="bg-stone-50 border-b border-stone-200 p-3 z-10 relative space-y-3">
            <div className="relative max-w-3xl mx-auto flex items-center">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <Input 
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..." 
                className="pl-9 pr-9 bg-white border-stone-300 focus-visible:ring-emerald-500"
              />
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-stone-400 hover:text-stone-600"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
            
            <div className="max-w-3xl mx-auto flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-stone-500 font-medium">Sender:</Label>
                <Select value={senderFilter} onValueChange={setSenderFilter}>
                  <SelectTrigger className="h-8 w-[120px] bg-white text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="user">You</SelectItem>
                    <SelectItem value="ai">Intelligence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-stone-500 font-medium">From:</Label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="h-8 text-xs bg-white w-auto"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-stone-500 font-medium">To:</Label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="h-8 text-xs bg-white w-auto"
                />
              </div>
              {(senderFilter !== 'all' || startDate || endDate) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSenderFilter('all');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="h-8 text-xs text-stone-500 hover:text-stone-800"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6" ref={scrollRef}>
          {!activeChatId || messages.length === 0 ? (
             <div className="h-full flex items-center justify-center p-4">
              <div className="max-w-md w-full flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center space-y-4">
                  <div className="inline-flex flex-col items-center justify-center mb-2">
                    <Logo size={64} className="drop-shadow-md" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                    Karachi Sahulat AI
                  </h1>
                  <p className="text-sm text-stone-500">
                    Your guide to the City of Lights. Ask about real-time conditions or paste utility updates.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
              {filteredMessages.length === 0 && (searchQuery || senderFilter !== 'all' || startDate || endDate) ? (
                <div className="text-center text-stone-500 py-10">No messages match your filters.</div>
              ) : filteredMessages.map((msg, i) => (
                <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  {msg.sender === 'ai' && (
                    <Avatar className="h-8 w-8 mt-1 bg-white shrink-0 shadow-sm border border-stone-200 p-1">
                      <Logo size={24} className="m-auto" />
                    </Avatar>
                  )}
                  <div className={`flex flex-col gap-1 max-w-[85%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl ${
                      msg.sender === 'user' 
                        ? 'bg-stone-900 text-stone-50 rounded-br-none shadow-sm'
                        : 'bg-stone-50 border border-stone-200 text-stone-800 rounded-bl-none shadow-sm prose prose-sm prose-stone max-w-none'
                    }`}>
                      {msg.sender === 'ai' ? (
                         <div className="markdown-body text-[15px] leading-relaxed break-words w-full">
                           <Markdown
                             remarkPlugins={[remarkGfm]}
                             components={{
                               code(props) {
                                 const {children, className, node, ...rest} = props;
                                 const match = /language-(\w+)/.exec(className || '');
                                 return match ? (
                                   <SyntaxHighlighter
                                     {...(rest as any)}
                                     children={String(children).replace(/\n$/, '')}
                                     style={vscDarkPlus as any}
                                     language={match[1]}
                                     PreTag="div"
                                     className="rounded-md my-4 text-xs shadow-sm border border-stone-200/20"
                                   />
                                 ) : (
                                   <code {...rest} className={`${className || ''} bg-stone-200/70 text-stone-800 px-1.5 py-0.5 rounded-sm text-[0.85em] font-mono leading-none`}>
                                     {children}
                                   </code>
                                 )
                               }
                             }}
                           >
                             {msg.content}
                           </Markdown>
                         </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-[15px]">{msg.content}</div>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${msg.sender === 'user' ? 'text-stone-400' : 'text-stone-400 pl-1'}`}>
                      <span>{msg.createdAt && typeof msg.createdAt.toDate === 'function' ? format(msg.createdAt.toDate(), 'h:mm a') : 'Now'}</span>
                      {msg.sender === 'user' && (
                        msg.status === 'sending' ? (
                          <Clock size={10} className="text-stone-400 min-w-3" />
                        ) : (
                          <Check size={12} className="text-emerald-500 min-w-3" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex gap-4">
                  <Avatar className="h-8 w-8 mt-1 border border-emerald-200 bg-emerald-100 text-emerald-700 shrink-0">
                    <MapPin size={16} className="m-auto" />
                  </Avatar>
                  <div className="px-5 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-600 rounded-bl-none shadow-sm flex items-center gap-1">
                    <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-3xl mx-auto relative rounded-2xl shadow-sm border border-stone-200 bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
            <Textarea 
               value={inputVal}
               onChange={e => setInputVal(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder="Paste an update or ask about your neighborhood..."
               className="min-h-[52px] max-h-32 resize-none border-0 shadow-none focus-visible:ring-0 py-3.5 px-4 pr-12 bg-transparent text-[15px]" 
               rows={1}
            />
            <Button 
               onClick={handleSendMessage}
               disabled={!inputVal.trim() || isSending}
               size="icon" 
               className="absolute right-2 bottom-2 h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-transform active:scale-95 disabled:hover:bg-stone-100 disabled:bg-stone-100 disabled:text-stone-400"
            >
              <Send size={16} />
            </Button>
          </div>
          <div className="text-center mt-2 px-2">
            <p className="text-[11px] text-stone-400 font-medium tracking-wide">
              KARACHI SAHULAT AI · INTELLIGENCE FOR THE CITY OF LIGHTS
            </p>
          </div>
        </div>
      </div>
      <AlertDialog open={!!deleteChatId} onOpenChange={(open) => !open && setDeleteChatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat history and remove the data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => {
              if (deleteChatId) {
                 try {
                   await deleteChat(deleteChatId);
                   if (activeChatId === deleteChatId) setActiveChatId(null);
                   setDeleteChatId(null);
                 } catch(err: any) {
                   console.error(err);
                   alert("Failed to delete: " + err.message);
                 }
              }
            }}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
