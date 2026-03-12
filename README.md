# Free Chat

一个简洁的 AI 大模型对话前端应用，支持流式输出、Markdown 渲染、多 API 配置。

## 功能特性

- 💬 流式输出 - 实时显示 AI 回复
- 📝 Markdown 渲染 - 支持代码高亮、列表、引用等
- 📋 复制功能 - 支持复制纯文本和 Markdown 源码
- 🔧 多 API 配置 - 支持配置多个 API 并快速切换
- 💾 本地存储 - 数据保存在浏览器 localStorage
- 🎨 简洁 UI - 仿 ChatGPT 风格界面
- 📱 响应式设计 - 支持手机端使用
- 🔄 侧边栏折叠 - 可隐藏/显示侧边栏

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:8888

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist` 目录

## 使用指南

详见 [用户手册](./docs/user-manual.md)

## API 配置

应用支持配置多个 API 端点，包括：

- API URL: 如 `https://api.openai.com/v1/chat/completions`
- API Key: 你的 API 密钥
- 模型名称: 如 `gpt-3.5-turbo`、`gpt-4` 等

### 支持的 API

- OpenAI API
- Azure OpenAI Service
- Anthropic Claude
- 其他兼容 OpenAI 格式的 API

## 技术栈

- React 18
- Vite
- React Markdown

## 项目结构

```
free_chat/
├── src/
│   ├── App.jsx      # 主应用组件
│   ├── App.css     # 样式文件
│   ├── main.jsx    # 入口文件
│   └── index.css   # 全局样式
├── docs/           # 文档
├── index.html      # HTML 模板
├── vite.config.js  # Vite 配置
└── package.json    # 依赖配置
```

## 许可证

MIT
