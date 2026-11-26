# Todollab Frontend

Aplicação web do **Todollab**, um quadro Kanban colaborativo em tempo real construído com **React 19**, **TypeScript**, **Vite** e **Tailwind CSS v4**.

## Arquitetura

O projeto segue uma estrutura modular orientada a funcionalidades (*feature-based*):

- **`src/App.tsx`**: configuração de rotas (`react-router-dom`) com *code splitting* via `React.lazy` + `Suspense`, `ErrorBoundary` global e provedores (`QueryClientProvider`, notificações `sonner`).
- **`src/features/`**: módulos de domínio isolados com páginas, componentes, hooks e testes:
  - `auth`: login, cadastro, verificação de e-mail, recuperação/redefinição de senha e guardas de rota.
  - `boards`: quadros Kanban e visualização em lista, colunas, drag-and-drop (`@dnd-kit`), sincronização em tempo real via STOMP/WebSocket, filtros e configurações do quadro.
  - `dashboard`: visão *Minhas Tarefas* e cartão de convites pendentes.
  - `invites`: compartilhamento de quadros e aceite de convites.
  - `landing`: página inicial pública.
  - `settings`: preferências da conta e aparência.
  - `shell`: layout autenticado, barra lateral e criação de quadros.
  - `tasks`: painel de detalhes e edição de tarefas, subtarefas e gerenciamento de tags.
- **`src/components/`**: componentes de interface reutilizáveis (primitivos `@radix-ui` estilizados com Tailwind CSS v4 e `ErrorBoundary`).
- **`src/lib/`**: cliente HTTP (`axios`), cliente WebSocket (`@stomp/stompjs`), utilitários de tema, formatação e persistência de convite pendente.
- **`src/stores/`**: estado global de autenticação e tema com `zustand`.
- **`src/types/`**: contratos TypeScript compartilhados com a API.
- **`src/styles/`**: tokens e estilos globais Tailwind CSS v4.

### Principais tecnologias

- **UI e Roteamento:** React 19, React Router 7, Tailwind CSS v4, Radix UI, Lucide Icons, Sonner
- **Estado e Dados:** TanStack React Query, Zustand, Axios, React Hook Form + Zod
- **Interação e Tempo Real:** `@dnd-kit` (Kanban com atualizações otimistas) e `@stomp/stompjs` (sincronização WebSocket)
- **Build e Testes:** Vite, TypeScript 5.8, Vitest, Testing Library (`jsdom`)

## Requisitos

- **Node.js** `20+`
- **npm** `10+`
- Backend do Todollab acessível via HTTP e WebSocket (STOMP)

## Configuração do ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto a partir de `.env.example`:

```bash
cp .env.example .env
```

Variáveis disponíveis:

| Variável | Obrigatória | Exemplo | Descrição |
| --- | --- | --- | --- |
| `VITE_API_URL` | Recomendada | `http://localhost:8080` | URL base da API REST do backend. |
| `VITE_WS_URL` | Opcional | `ws://localhost:8080/ws` | Endpoint WebSocket (STOMP). Quando omitida, é derivada automaticamente de `VITE_API_URL`. |

## Instalação

```bash
npm install
```

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento Vite em `http://localhost:5173`. |
| `npm run build` | Executa a checagem de tipos (`tsconfig.app.json`) e gera o bundle de produção em `dist/`. |
| `npm run preview` | Serve localmente o build gerado em `dist/` para validação. |
| `npm run typecheck` | Executa a verificação de tipos completa (`tsc -p tsconfig.json --noEmit`), incluindo arquivos de teste. |
| `npm run test` | Executa a suíte de testes unitários e de integração com Vitest em modo *watch*. |
| `npm run test:run` | Executa toda a suíte de testes com Vitest uma única vez (ideal para CI). |

## Deploy (Vercel)

O arquivo [`vercel.json`](./vercel.json) configura:

- **Rewrites de SPA** redirecionando todas as rotas para `/index.html`.
- **Headers HTTP de segurança** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`).

Configure `VITE_API_URL` (e `VITE_WS_URL`, se necessário) nas variáveis de ambiente do projeto na Vercel antes do deploy.
