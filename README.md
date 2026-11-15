# usage-bars

Um mod para o Claude Code que mostra o seu uso num painel lateral, sempre visível:

```
5h    ████████░░░░   67% · reseta em 2h15
7d    ██░░░░░░░░░░   18% · reseta em 4d 6h
Ctx   ████░░░░░░░░   35% · contexto
⚙
```

- **5h** e **7d**: quanto dos limites de uso da assinatura já foi usado e quando eles zeram.
- **Ctx**: quanto da janela de contexto da conversa atual já está ocupado.
- **⚙**: escolha o que mostrar (cada limite, contexto, tempo até resetar, barras), a opacidade do texto e o tamanho das barras. Os ajustes ficam salvos entre sessões.

O painel abre sozinho no início da sessão; se fechar, digite `/uso`.

## Instalação

No prompt de uma sessão do Claude Code no terminal:

```
/plugin install usage-bars --marketplace gustavordeo/usage-bars
```

Responda `y` para adicionar o marketplace e depois escolha o escopo (Enter para o escopo de usuário).

Pelo shell:

```bash
claude plugin install usage-bars --marketplace gustavordeo/usage-bars
```

No app desktop, onde `/plugin` não funciona: clique em **+** ao lado da caixa de mensagem, depois **Plugins**, **Add marketplace** com `gustavordeo/usage-bars`, e então **Add plugin**.
