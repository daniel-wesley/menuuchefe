# MenuChef - Sistema Completo de Gestão de Restaurante

Sistema completo de gestão para restaurantes, hamburguerias, pizzarias e lanchonetes. Controle total de mesas, cardápio digital, monitor de cozinha, caixa operacional, relatórios avançados, delivery, DAV e painel administrativo.

---

## 🛠️ Tecnologias

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 19, Tailwind CSS, Vite, Lucide Icons |
| **Backend** | Node.js, Express, Socket.io (tempo real) |
| **Banco de Dados** | SQLite3 (via `sqlite` + `sqlite3`) |
| **Impressão** | ESC/POS térmica 58mm/80mm, DAV (Documento Auxiliar de Venda) |

---

## 🚀 Instalação

### Pré-requisitos
- [Node.js](https://nodejs.org) v18+

### Instalação e Execução
```bash
# Instalar dependências (raiz, backend e frontend)
npm run setup-all

# Iniciar sistema completo
npm run dev
```

### Credenciais Padrão
| Cargo | Usuário | Senha |
|-------|---------|-------|
| Administrador | `admin` | `admin123` |
| Garçom | `garcom` | `garcom123` |
| Cozinha | `cozinha` | `cozinha123` |
| Caixa | `caixa` | `caixa123` |

### Acesso em Rede Local
O sistema detecta automaticamente o IP local. Acesse de qualquer dispositivo na mesma rede:
- **Frontend**: `http://IP-LOCAL:5173`
- **Backend API**: `http://IP-LOCAL:3001`

---

## ⚙️ Funcionalidades

### 1. 🍽️ Mesas Inteligentes
- Cadastro e gerenciamento de mesas com status visual
- Status: **Livre** (verde), **Ocupada** (amarela), **Aguardando Pagamento** (vermelho)
- QR Code por mesa para auto-atendimento do cliente
- Token de segurança exclusivo por mesa

### 2. 📱 Cardápio Digital (Auto-atendimento)
- Cliente escaneia QR Code e acessa o menu pelo celular
- Adiciona itens com observações personalizadas
- Pedido vai direto para a cozinha sem login
- Categorias dinâmicas organizadas do banco de dados
- Controle de estoque por produto
- Imagens nos produtos

### 3. 👨‍🍳 Monitor da Cozinha
- Visualização em 3 colunas: **Recebidos**, **Preparando**, **Prontos**
- Cronômetro de espera por pedido
- Alertas sonoros para novos pedidos
- Notificações em tempo real via Socket.io
- Status de cada item: Recebido → Preparando → Pronto → Entregue

### 4. 💰 Caixa Operacional
- Abertura e fechamento de caixa com valor inicial
- Visualização integrada do consumo da mesa
- **Divisão de contas** (até N pessoas)
- Múltiplas formas de pagamento (Dinheiro, PIX, Crédito, Débito, Cartão, Voucher)
- Pagamento parcial e split de conta
- **Sangria** (retiradas de caixa com motivo)
- Cálculo automático de troco
- CPF na nota (opcional)

### 5. 🧾 DAV (Documento Auxiliar de Venda)
- Número sequencial automático por mês/ano
- Formato: `001/MM/AAAA - 000001`
- Impressão em layout térmico 58mm
- Dados da loja (CNPJ, IE, endereço, telefone)
- Não tem valor fiscal (aviso no cupom)

### 6. 📊 Relatórios Avançados

#### Financeiro
- **Faturamento por forma de pagamento** com gráfico de pizza SVG
- Ticket médio geral
- Total de transações
- Receita líquida (faturamento - sangrias)
- Resumo de recebimentos por método (PIX, Dinheiro, Crédito, Débito)

#### Cardápio / Vendas
- **Curva ABC de Produtos** (Classe A, B, C com classificação visual)
  - Classe A: Até 70% do faturamento (mais vendidos)
  - Classe B: 70% - 90% (médio giro)
  - Classe C: Acima 90% (baixo giro)
- Cards de resumo por classe
- **Top 5 Produtos** com gráfico de barras horizontal
- Vendas por categoria
- **TMA por Categoria** (tempo médio de preparo)

#### Modalidade (Salão vs Delivery)
- Comparativo de receita: **Salão (Mesas)** vs **Delivery**
- Gráfico de pizza SVG de composição
- **Ticket Médio por Mesa** com tabela detalhada

#### Operacional
- **Mapa de Calor** visual (grid Dia x Hora) com legenda de intensidade
- Horários de pico ("rush")
- Desempenho por garçom
- Tempo médio de preparo/entrega (TMA)

#### Cancelamentos
- Auditoria completa de cancelamentos e estornos
- Motivos, funcionário autorizado, prejuízo

#### Auditoria e Segurança
- **Cortesias e Descontos** autorizados
- **Cancelamentos por Motivo** com total de prejuízo
- Resumo de prejuízos (cancelamentos + cortesias)

#### Garçom (Individual)
- Seletor de garçom individual
- Subtotal, gorjeta (10%), total geral
- Ticket médio e pedidos atendidos
- Top 5 produtos vendidos por garçom

#### Exportação
- **Exportar Excel** (CSV com BOM UTF-8)
- **Imprimir PDF** (layout otimizado para impressão)

### 7. 🚗 Delivery
- Pedidos de delivery com dados do cliente
- Endereço, bairro, telefone
- Status: Pendente → Despachado → Entregue
- Canal: Próprio / iFood / Rappi / Telefone
- Busca automática de cliente por telefone
- Histórico de pedidos

### 8. 🏪 Cadastro de Loja
- Nome fantasia, CNPJ, Inscrição Estadual
- Endereço e telefone
- Dados aparecem nos relatórios e cupons

### 9. 👥 Gestão de Funcionários
- Cadastro de usuários com cargos: Admin, Garçom, Cozinha, Caixa
- Controle de acesso por rôle (JWT + middleware)
- Sessão única por usuário

### 10. 📋 Categorias
- CRUD completo de categorias do cardápio
- Ícone personalizado por categoria
- Ordem de exibição configurável
- Ativar/Desativar categorias

### 11. 🍕 Produtos
- Cadastro com nome, preço, descrição, categoria
- Controle de estoque (ativa/desativa)
- Upload de imagens
- Observações globais (ex: "Sem cebola")
- Organização por categorias

### 12. 🔐 Licenciamento
- Sistema de licença com chave de ativação
- Controle de vencimento
- Emergência mensal (3 dias)
- Módulos: Básico, Geral

### 13. 🖨️ Impressão Térmica
- Layout otimizado para bobina 58mm/80mm
- CSS `@media print` para impressão limpa
- Cupom DAV com dados da loja e itens
- Formatação automática de colunas

---

## 📁 Estrutura do Projeto

```
├── package.json               # Scripts globais
├── README.md                  # Este guia
├── database/                  # SQLite
│   └── restaurante.sqlite     # Banco de dados
├── backend/                   # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── server.js          # Entry point
│   │   ├── config/db.js       # Schema e migrações SQLite
│   │   ├── controllers/       # Lógica de negócio
│   │   ├── middleware/        # Auth JWT, License
│   │   ├── routes/            # Rotas REST
│   │   └── uploads/           # Imagens de produtos
└── frontend/                  # React + Vite + Tailwind
    ├── src/
    │   ├── context/           # Auth, Cart, Sockets
    │   ├── components/        # Navbar, ProtectedRoute
    │   └── pages/             # Telas do sistema
```

---

## 🗄️ Banco de Dados (Tabelas)

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema (admin, garçom, cozinha, caixa) |
| `tables` | Mesas com status e token QR Code |
| `products` | Produtos do cardápio |
| `categories` | Categorias do cardápio |
| `orders` | Pedidos das mesas |
| `order_items` | Itens de cada pedido |
| `transactions` | Transações de pagamento |
| `cancellations` | Auditoria de cancelamentos |
| `cash_registers` | Abertura/fechamento de caixa |
| `cash_withdrawals` | Sangrias do caixa |
| `complimentary_items` | Cortesias e descontos |
| `delivery_orders` | Pedidos de delivery |
| `delivery_order_items` | Itens do delivery |
| `global_observations` | Observações globais (ex: "Sem cebola") |
| `dav_counters` | Contador sequencial de DAVs |

---

## 🔧 Scripts NPM

| Comando | Descrição |
|---------|-----------|
| `npm run setup-all` | Instala dependências (raiz + backend + frontend) |
| `npm run dev` | Inicia backend e frontend juntos |
| `npm run dev:backend` | Inicia apenas o backend |
| `npm run dev:frontend` | Inicia apenas o frontend |

---

## 📡 API REST (Endpoints Principais)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| GET | `/api/tables` | Listar mesas |
| PUT | `/api/tables/:id/status` | Alterar status da mesa |
| GET | `/api/products` | Listar produtos |
| POST | `/api/products` | Cadastrar produto |
| GET | `/api/categories` | Listar categorias |
| POST | `/api/orders` | Criar pedido |
| PUT | `/api/orders/:id/status` | Atualizar status do pedido |
| POST | `/api/reports/checkout` | Fechar mesa (pagamento) |
| GET | `/api/reports/closure` | Fechamento de caixa |
| GET | `/api/reports/detailed` | Relatórios detalhados |
| GET | `/api/reports/waiter-sales` | Vendas por garçom |
| POST | `/api/cash-register/open` | Abrir caixa |
| POST | `/api/cash-register/close` | Fechar caixa |
| POST | `/api/cash-register/withdraw` | Sangria |
| GET | `/api/dav/next-number` | Próximo número DAV |
| POST | `/api/delivery` | Criar pedido delivery |
| GET | `/api/loja` | Dados da loja |
| POST | `/api/loja` | Atualizar dados da loja |

---

## 🌐 Socket.io (Eventos)

| Evento | Descrição |
|--------|-----------|
| `table_status_changed` | Status da mesa alterado |
| `table_paid` | Mesa foi paga |
| `new_order` | Novo pedido para a cozinha |
| `order_status_changed` | Status do pedido atualizado |
| `kitchen_notification` | Notificação para garçom |

---

## 📝 Licença

Sistema proprietário - MenuChef v1.5
