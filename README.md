# ⚡ Meus Treinos

App pessoal de gerenciamento de treinos, 100% client-side, sem backend, sem cadastro. Hospedado no GitHub Pages e instalável como PWA no celular.

<div align="center">

![Status](https://img.shields.io/badge/status-ativo-brightgreen)
![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)

</div>

---

## 📱 Demo

> **[augusto-dev0.github.io/meus-treinos](https://augusto-dev0.github.io/TreinoSite/)**

---

## ✨ Funcionalidades

### 🏋️ Treinos
- Organize treinos por dia da semana (Segunda a Domingo)
- Crie quantos treinos quiser por dia
- Monte cada treino com exercícios da sua biblioteca pessoal
- Reordene os exercícios com **drag & drop**

### ▶ Modo Treino Ativo
- Tela de foco exercício por exercício
- Barra de progresso e cronômetro em tempo real
- Timer de descanso rápido embutido (30s / 1min / 1m30)
- Ao concluir, salva automaticamente no histórico com duração total

### 📅 Histórico
- Lista de todos os treinos concluídos com data, dia e exercícios
- Edição de registros (nome, data, duração, dia da semana)
- Contador de **sequência de dias consecutivos** 🔥

### 📋 Biblioteca
- Começa vazia — 100% personalizada pelo usuário
- Cadastre nome, grupo muscular, emoji, séries, cor e dica para cada exercício
- Modo de **seleção múltipla** para excluir vários exercícios de uma vez
- Busca por nome, grupo muscular, categoria ou equipamento
- Filtro por grupo muscular

### 🗺️ Explorar Catálogo
- Catálogo com centenas de exercícios organizados por categoria, grupo muscular e equipamento
- Filtros combinados: **Categoria** (Academia, Casa, Calistenia…) + **Músculo** + **Equipamento**
- Modo de **seleção múltipla** para adicionar vários exercícios à biblioteca de uma vez
- Adição individual com um clique, ou edição personalizada antes de importar

### ⏱️ Timer
- Cronômetro regressivo com anel SVG animado
- Presets rápidos: 30s, 1min, 1m30, 2min
- Botão **+1min** para estender sem resetar

### 🗺️ Checklist de primeiros passos
- Card guia o usuário novo pelos 3 passos iniciais
- Some automaticamente após concluir tudo
- Pode ser dispensado manualmente

### 📲 PWA ; Instale no celular
- Funciona **offline** completo após a primeira visita
- Aparece como app nativo na tela inicial (Android e iOS)
- Sem necessidade de loja de aplicativos

---

## 🗂️ Estrutura do projeto

```
meus-treinos/
├── index.html          # Estrutura, seções e todos os modais
├── style.css           # Estilos, variáveis, animações, responsividade
├── script.js           # Lógica completa do app
├── manifest.json       # Configuração PWA
├── sw.js               # Service Worker (cache offline)
└── imagens/
    ├── favicon.ico     # Ícone da aba do browser
    ├── icon-192.png    # Ícone PWA (Android)
    └── icon-512.png    # Ícone PWA (splash screen)
```

---

## 🚀 Como usar

### Opção 1 — GitHub Pages (recomendado)

1. Faça um fork ou clone deste repositório
2. Vá em **Settings → Pages → Source: main / root**
3. Acesse `https://augusto-dev0.github.io/TreinoSite/`

### Opção 2 — Local

```bash
git clone https://github.com/Augusto-dev0/TreinoSite.git
cd meus-treinos
# Abra index.html no browser · nenhuma dependência necessária
```

> ⚠️ O Service Worker (modo offline) exige HTTPS ou `localhost`. Para testar localmente com PWA completa, use uma extensão como **Live Server** no VS Code.

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura, modais, tela de treino ativo |
| CSS3 | Variáveis, animações, layout responsivo, confetti |
| JavaScript ES6+ | Lógica, localStorage, drag & drop, Service Worker |
| Phosphor Icons | Ícones da interface |
| Google Fonts | Bebas Neue (títulos) + DM Sans (corpo) |
| Web App Manifest | Instalação como PWA |
| Service Worker API | Cache offline |

---

## 💾 Armazenamento

Todos os dados ficam no `localStorage` do browser — nenhum dado é enviado a servidores.

| Chave | Conteúdo |
|---|---|
| `mt-library-v1` | Exercícios da biblioteca pessoal |
| `mt-workouts-v1` | Treinos por dia da semana |
| `mt-history-v1` | Histórico de treinos concluídos |
| `mt-checklist-dismissed` | Se o checklist foi dispensado |

---

## 📱 Responsividade

| Breakpoint | Layout |
|---|---|
| `> 540px` | Navegação por abas no topo, grid de biblioteca multi-coluna |
| `≤ 540px` | Bottom navigation bar fixa, modais como bottom sheet, biblioteca em 2 colunas |

---

## 🎨 Design

- Tema **dark** com fundo `#0a0a0a`
- Cor de destaque: `#c8f060` (verde lima)
- Tipografia: **Bebas Neue** (títulos) + **DM Sans** (corpo)
- Ícones: **Phosphor Icons**
- Animações com `cubic-bezier` e `fadeUp`
- Confetti CSS puro na tela de conclusão de treino

---

## 📬 Contato

**Desenvolvido por Luiz Augusto**

[![GitHub](https://img.shields.io/badge/GitHub-Augusto--dev0-f97316?style=flat-square&logo=github)](https://github.com/Augusto-dev0)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-luiz--augusto7x-f97316?style=flat-square&logo=linkedin)](https://linkedin.com/in/luiz-augusto7x)
[![Instagram](https://img.shields.io/badge/Instagram-luiz.augusto7x-f97316?style=flat-square&logo=instagram)](https://www.instagram.com/luiz.augusto7x/)

---

## 📄 Licença

![License: Proprietary](https://img.shields.io/badge/licen%C3%A7a-Propriet%C3%A1ria-red)

Licença proprietária — todos os direitos reservados ao autor.
Nenhuma permissão é concedida para uso, cópia, modificação ou distribuição deste conteúdo sem autorização prévia e por escrito.

Consulte o arquivo [`LICENSE`](./LICENSE) para os termos completos.
