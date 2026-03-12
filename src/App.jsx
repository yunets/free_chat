import { useState, useEffect, useRef, useCallback, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

const STORAGE_KEYS = {
  API_CONFIGS: 'free_chat_api_configs',
  DEFAULT_CONFIG_ID: 'free_chat_default_config_id',
  SESSIONS: 'free_chat_sessions',
  CURRENT_SESSION: 'free_chat_current_session'
}

function createEmptyConfig() {
  return {
    id: Date.now().toString(),
    name: '',
    url: '',
    key: '',
    model: 'gpt-3.5-turbo'
  }
}

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, ''))
    .replace(/`[^`]+`/g, (match) => match.replace(/`/g, ''))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#]/g, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .trim()
}

function CopyButton({ content, isMarkdown }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const textToCopy = isMarkdown ? content : stripMarkdown(content)
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  return (
    <button className="copy-btn" onClick={handleCopy} title={isMarkdown ? '复制Markdown' : '复制纯文本'}>
      {copied ? '✓' : isMarkdown ? '📋' : '📄'}
    </button>
  )
}

function Message({ role, content, showCopy }) {
  return (
    <div className={`message ${role}`}>
      <div className="message-avatar">{role === 'user' ? '👤' : '🤖'}</div>
      <div className="message-wrapper">
        <div className="message-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {showCopy && role === 'assistant' && (
          <div className="copy-actions">
            <CopyButton content={content} isMarkdown={false} />
            <CopyButton content={content} isMarkdown={true} />
          </div>
        )}
      </div>
    </div>
  )
}

const MessageMemo = memo(Message)

function StreamingMessage({ content }) {
  return (
    <div className="message assistant">
      <div className="message-avatar">🤖</div>
      <div className="message-content streaming">
        <ReactMarkdown>{content}</ReactMarkdown>
        <span className="cursor">▊</span>
      </div>
    </div>
  )
}

const StreamingMessageMemo = memo(StreamingMessage)

function SettingsPanel({ configs, defaultConfigId, onAdd, onUpdate, onDelete, onSetDefault, onClone }) {
  const [editingId, setEditingId] = useState(null)

  const handleAdd = () => {
    const newConfig = createEmptyConfig()
    onAdd(newConfig)
    setEditingId(newConfig.id)
  }

  const handleUpdate = (id, field, value) => {
    onUpdate(id, field, value)
  }

  return (
    <div className="settings-panel">
      <h2>API 配置</h2>
      <p className="setting-hint">可配置多个 API，支持切换使用</p>
      
      <div className="config-list">
        {configs.map((config) => (
          <div key={config.id} className={`config-item ${config.id === defaultConfigId ? 'default' : ''}`}>
            <div className="config-header">
              <span className="config-name">{config.name || '未命名配置'}</span>
              <div className="config-actions">
                <button 
                  className="config-clone-btn"
                  onClick={() => onClone(config)}
                  title="克隆配置"
                >
                  📋 克隆
                </button>
                <button 
                  className="config-default-btn"
                  onClick={() => onSetDefault(config.id)}
                  title="设为默认"
                >
                  {config.id === defaultConfigId ? '⭐ 默认' : '☆ 设为默认'}
                </button>
                <button 
                  className="config-delete-btn"
                  onClick={() => onDelete(config.id)}
                  title="删除"
                >×</button>
              </div>
            </div>
            <div className="config-form">
              <input
                type="text"
                value={config.name}
                onChange={(e) => handleUpdate(config.id, 'name', e.target.value)}
                placeholder="配置名称 (可选)"
                className="config-input"
              />
              <input
                type="text"
                value={config.url}
                onChange={(e) => handleUpdate(config.id, 'url', e.target.value)}
                placeholder="API URL: https://api.openai.com/v1/chat/completions"
                className="config-input"
              />
              <input
                type="password"
                value={config.key}
                onChange={(e) => handleUpdate(config.id, 'key', e.target.value)}
                placeholder="API Key: sk-..."
                className="config-input"
              />
              <input
                type="text"
                value={config.model}
                onChange={(e) => handleUpdate(config.id, 'model', e.target.value)}
                placeholder="模型: gpt-3.5-turbo"
                className="config-input"
              />
            </div>
          </div>
        ))}
      </div>

      <button className="add-config-btn" onClick={handleAdd}>
        + 添加配置
      </button>
    </div>
  )
}

function App() {
  const [configs, setConfigs] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.API_CONFIGS)
    if (stored) {
      return JSON.parse(stored)
    }
    return [createEmptyConfig()]
  })
  const [defaultConfigId, setDefaultConfigId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.DEFAULT_CONFIG_ID) || ''
  })
  const [showSettings, setShowSettings] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [sessions, setSessions] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    return stored ? JSON.parse(stored) : []
  })
  const [currentSessionId, setCurrentSessionId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION) || null
  })
  const messagesEndRef = useRef(null)
  const abortControllerRef = useRef(null)

  const currentSession = sessions.find(s => s.id === currentSessionId) || null
  const defaultConfig = configs.find(c => c.id === defaultConfigId) || configs[0]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.API_CONFIGS, JSON.stringify(configs))
  }, [configs])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEFAULT_CONFIG_ID, defaultConfigId || '')
  }, [defaultConfigId])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, currentSessionId || '')
  }, [currentSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages, streamingContent])

  const addConfig = (config) => {
    setConfigs(prev => [...prev, config])
  }

  const updateConfig = (id, field, value) => {
    setConfigs(prev => prev.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ))
  }

  const deleteConfig = (id) => {
    const newConfigs = configs.filter(c => c.id !== id)
    if (newConfigs.length === 0) {
      newConfigs.push(createEmptyConfig())
    }
    setConfigs(newConfigs)
    if (defaultConfigId === id) {
      setDefaultConfigId(newConfigs[0].id)
    }
  }

  const cloneConfig = (config) => {
    const newConfig = {
      ...config,
      id: Date.now().toString(),
      name: config.name + ' (副本)'
    }
    setConfigs(prev => [...prev, newConfig])
  }

  const setDefaultConfig = (id) => {
    setDefaultConfigId(id)
  }

  const createNewSession = useCallback(() => {
    const newSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date().toISOString()
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setStreamingContent('')
  }, [])

  const selectSession = useCallback((id) => {
    setCurrentSessionId(id)
    setStreamingContent('')
  }, [])

  const deleteSession = (id, e) => {
    e.stopPropagation()
    const newSessions = sessions.filter(s => s.id !== id)
    setSessions(newSessions)
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions[0]?.id || null)
    }
  }

  const updateSessionTitle = (firstMessage, sessionId) => {
    const targetId = sessionId || currentSessionId
    const session = sessions.find(s => s.id === targetId)
    if (session && session.title === '新对话') {
      const title = firstMessage.slice(0, 20) + (firstMessage.length > 20 ? '...' : '')
      setSessions(prev => prev.map(s => 
        s.id === targetId ? { ...s, title } : s
      ))
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    if (!defaultConfig || !defaultConfig.url || !defaultConfig.key || !defaultConfig.model) {
      alert('请先配置 API')
      setShowSettings(true)
      return
    }

    const userMessage = { role: 'user', content: input }
    const newMessages = currentSession 
      ? [...currentSession.messages, userMessage]
      : [userMessage]

    const tempSessionId = Date.now().toString()
    
    if (!currentSession) {
      const newSession = {
        id: tempSessionId,
        title: '新对话',
        messages: newMessages,
        createdAt: new Date().toISOString()
      }
      setSessions(prev => [newSession, ...prev])
      setCurrentSessionId(tempSessionId)
    } else {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, messages: newMessages } : s
      ))
      setCurrentSessionId(currentSessionId || tempSessionId)
    }

    setInput('')
    setLoading(true)

    const targetSessionId = currentSessionId || tempSessionId

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(defaultConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${defaultConfig.key}`
        },
        body: JSON.stringify({
          model: defaultConfig.model,
          messages: newMessages,
          stream: true
        }),
        signal: abortControllerRef.current.signal
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let content = ''

      setStreamingContent('')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim() !== '')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content || ''
              if (delta) {
                content += delta
                setStreamingContent(content)
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }

      const assistantMessage = { role: 'assistant', content }
      
      setSessions(prev => prev.map(s => 
        s.id === targetSessionId 
          ? { ...s, messages: [...newMessages, assistantMessage] } 
          : s
      ))

      updateSessionTitle(input, targetSessionId)
      setStreamingContent('')
    } catch (error) {
      if (error.name === 'AbortError') {
        const assistantMessage = { role: 'assistant', content: content || '[已中断]' }
        setSessions(prev => prev.map(s => 
          s.id === targetSessionId 
            ? { ...s, messages: [...newMessages, assistantMessage] } 
            : s
        ))
      } else {
        const errorMessage = { role: 'assistant', content: `错误: ${error.message}` }
        setSessions(prev => prev.map(s => 
          s.id === targetSessionId 
            ? { ...s, messages: [...newMessages, errorMessage] } 
            : s
        ))
      }
      setStreamingContent('')
    }

    setLoading(false)
    abortControllerRef.current = null
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Free Chat</h2>
          <button className="new-chat-btn" onClick={createNewSession}>+ 新对话</button>
        </div>
        <div className="session-list">
          {sessions.map(session => (
            <div 
              key={session.id} 
              className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => selectSession(session.id)}
            >
              <span className="session-title">{session.title}</span>
              <button 
                className="delete-btn" 
                onClick={(e) => deleteSession(session.id, e)}
              >×</button>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="current-config">
            {defaultConfig?.name || '默认配置'}
          </div>
          <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ 设置
          </button>
        </div>
      </div>

      <div className="main-content">
        {showSettings ? (
          <SettingsPanel 
            configs={configs}
            defaultConfigId={defaultConfigId}
            onAdd={addConfig}
            onUpdate={updateConfig}
            onDelete={deleteConfig}
            onSetDefault={setDefaultConfig}
            onClone={cloneConfig}
          />
        ) : currentSession ? (
          <>
            <div className="chat-messages">
              {currentSession.messages.map((msg, idx) => (
                <MessageMemo key={idx} role={msg.role} content={msg.content} showCopy={true} />
              ))}
              {streamingContent && (
                <StreamingMessageMemo key="streaming" content={streamingContent} />
              )}
              {loading && !streamingContent && (
                <div className="message assistant">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content loading">正在思考...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="input-area">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入消息... (Enter发送, Shift+Enter换行)"
                disabled={loading}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()}>
                {loading ? '发送中...' : '发送'}
              </button>
            </div>
          </>
        ) : (
          <div className="welcome">
            <h1>Free Chat</h1>
            <p>选择一个会话或创建新对话开始</p>
            <button className="new-chat-btn-large" onClick={createNewSession}>开始对话</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
