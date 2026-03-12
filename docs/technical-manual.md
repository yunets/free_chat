# Free Chat 技术手册

## 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [核心模块](#核心模块)
4. [数据流](#数据流)
5. [API 调用](#api-调用)
6. [状态管理](#状态管理)
7. [组件设计](#组件设计)
8. [性能优化](#性能优化)
9. [开发指南](#开发指南)

---

## 项目概述

Free Chat 是一个基于 React 的纯前端 AI 对话应用，使用 Vite 作为构建工具，通过浏览器直接调用 AI 大模型的 API。

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| Vite | 7.x | 构建工具 |
| react-markdown | latest | Markdown 渲染 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    App.jsx                          │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Sidebar    │  │ ChatArea    │  │ Settings   │ │
│  │  (会话列表)  │  │  (对话)      │  │ (API配置)  │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              localStorage                           │
│  - free_chat_api_configs    (API配置列表)          │
│  - free_chat_default_config_id (默认配置ID)        │
│  - free_chat_sessions        (会话列表)            │
│  - free_chat_current_session (当前会话ID)          │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                    AI API                           │
│              (OpenAI 兼容格式)                       │
└─────────────────────────────────────────────────────┘
```

---

## 核心模块

### 1. App.jsx 主组件

主应用组件，负责整体布局和状态管理。

**主要功能：**
- 状态管理（API配置、会话、消息）
- API 调用逻辑
- UI 布局渲染

**关键状态：**
```javascript
// API 配置
const [configs, setConfigs] = useState([])           // API 配置列表
const [defaultConfigId, setDefaultConfigId] = useState('') // 默认配置 ID

// 会话管理
const [sessions, setSessions] = useState([])         // 会话列表
const [currentSessionId, setCurrentSessionId] = useState(null) // 当前会话

// UI 状态
const [showSettings, setShowSettings] = useState(false) // 设置面板显示
const [loading, setLoading] = useState(false)         // 加载状态
const [streamingContent, setStreamingContent] = useState('') // 流式内容
```

### 2. SettingsPanel 组件

API 配置面板组件。

**功能：**
- 渲染配置列表
- 添加/编辑/删除/克隆配置
- 设置默认配置

### 3. Message 组件

消息展示组件。

**功能：**
- 渲染用户/AI 消息
- Markdown 渲染
- 复制功能按钮

### 4. StreamingMessage 组件

流式输出消息组件。

**功能：**
- 实时渲染 AI 回复
- 光标动画
- memo 优化避免闪烁

---

## 数据流

### 1. API 配置数据流

```
用户输入 → onUpdate → setConfigs → localStorage
                    ↓
            configs.map() → SettingsPanel 渲染
```

### 2. 消息发送数据流

```
用户输入 → sendMessage()
    ↓
构建 messages 数组
    ↓
fetch(API URL, { stream: true })
    ↓
reader.read() 循环读取
    ↓
setStreamingContent() 更新实时内容
    ↓
完成后写入 sessions
    ↓
localStorage 持久化
```

### 3. 会话管理数据流

```
点击会话 → selectSession(id)
    ↓
setCurrentSessionId(id)
    ↓
currentSession = sessions.find(s => s.id === id)
    ↓
ChatArea 渲染消息列表
```

---

## API 调用

### 请求格式

```javascript
const response = await fetch(config.url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.key}`
  },
  body: JSON.stringify({
    model: config.model,
    messages: newMessages,
    stream: true
  })
})
```

### 响应处理 (流式)

```javascript
const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  const chunk = decoder.decode(value, { stream: true })
  const lines = chunk.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') continue
      
      const parsed = JSON.parse(data)
      const delta = parsed.choices?.[0]?.delta?.content || ''
      
      if (delta) {
        content += delta
        setStreamingContent(content)
      }
    }
  }
}
```

### 错误处理

- 网络错误: 显示错误消息
- API 错误: 显示 API 返回的错误信息
- 中断: 保存已获取的内容

---

## 状态管理

### useState

用于组件内部状态管理：

```javascript
const [state, setState] = useState(initialValue)
```

### useEffect

用于副作用和 localStorage 同步：

```javascript
// 持久化到 localStorage
useEffect(() => {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
}, [sessions])
```

### useCallback

用于缓存函数，避免子组件不必要渲染：

```javascript
const createNewSession = useCallback(() => {
  // 创建新会话逻辑
}, [])
```

### memo

用于优化子组件：

```javascript
const MessageMemo = memo(Message)
```

---

## 组件设计

### 组件层次

```
App
├── SettingsPanel
│   └── (无子组件)
├── (ChatArea - 内联)
│   ├── Message (memo)
│   │   └── CopyButton
│   ├── StreamingMessage (memo)
│   │   └── ReactMarkdown
│   └── InputArea
└── (Sidebar - 内联)
    ├── SessionList
    │   └── SessionItem
    └── SidebarFooter
```

### 组件通信

- **父 → 子**: Props 传递
- **子 → 父**: 回调函数
- **跨层级**: 状态提升到 App

---

## 性能优化

### 1. React.memo

对纯展示组件使用 memo 避免不必要渲染：

```javascript
const MessageMemo = memo(Message)
const StreamingMessageMemo = memo(StreamingMessage)
```

### 2. useCallback

缓存回调函数：

```javascript
const createNewSession = useCallback(() => {
  // ...
}, [])
```

### 3. 固定 key

流式输出使用固定 key：

```javascript
{streamingContent && (
  <StreamingMessageMemo key="streaming" content={streamingContent} />
)}
```

### 4. 流式解码优化

```javascript
decoder.decode(value, { stream: true })
```

### 5. 样式优化

- 使用 CSS 类而非内联样式
- 避免频繁的 DOM 操作

---

## 开发指南

### 开发环境搭建

```bash
# 克隆项目
git clone https://gitee.com/liuysh/free_chat.git
cd free_chat

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 添加新功能

1. **添加新组件**: 在 src/App.jsx 中添加
2. **添加新样式**: 在 src/App.css 中添加
3. **测试**: npm run dev 启动测试

### 修改 API 调用逻辑

找到 `sendMessage` 函数：

```javascript
const sendMessage = async () => {
  // 修改请求逻辑
}
```

### 添加新的存储键

1. 在 STORAGE_KEYS 中添加键名：
```javascript
const STORAGE_KEYS = {
  // 现有键
  NEW_KEY: 'free_chat_new_key'
}
```

2. 添加对应的 useEffect：
```javascript
useEffect(() => {
  localStorage.setItem(STORAGE_KEYS.NEW_KEY, value)
}, [value])
```

### 代码规范

- 使用函数组件
- 使用 hooks 管理状态
- 避免使用 class 组件
- 合理使用 memo 优化性能

---

## 附录

### localStorage 键说明

| 键名 | 类型 | 说明 |
|------|------|------|
| free_chat_api_configs | JSON Array | API 配置列表 |
| free_chat_default_config_id | String | 默认配置 ID |
| free_chat_sessions | JSON Array | 会话列表 |
| free_chat_current_session | String | 当前会话 ID |

### API 配置结构

```javascript
{
  id: string,        // 唯一标识
  name: string,     // 配置名称
  url: string,      // API URL
  key: string,      // API Key
  model: string     // 模型名称
}
```

### 会话结构

```javascript
{
  id: string,           // 唯一标识
  title: string,        // 会话标题
  messages: Array,      // 消息列表
  createdAt: string     // 创建时间
}
```

### 消息结构

```javascript
{
  role: 'user' | 'assistant',
  content: string
}
```
