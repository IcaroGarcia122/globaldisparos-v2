
# Plano: Aquecimento Cloud + Disparador Elite + Centralização de Fontes

## Resumo

Recriar a seção "Aquecimento Cloud" para ficar idêntica à imagem de referência (com Velocidade do Motor e Modo & Instâncias), adicionar a seção "Monitorando Campanhas" no Disparador Elite (visível quando há campanhas rodando), e corrigir a centralização/proporcionalidade das fontes em todas as seções.

---

## 1. Aquecimento Cloud - Interface completa (conforme imagem)

A seção já tem a estrutura base, mas falta completar com os cards de **Velocidade do Motor** e **Modo & Instâncias** que aparecem na imagem de referência. Atualmente eles existem apenas no `VIPDashboard.tsx` (componente de preview) mas estao faltando no `UserDashboard.tsx` (dashboard real).

**Alteracoes no `UserDashboard.tsx` - case 'aquecimento':**
- Adicionar abaixo do card de "Indice de Maturacao" os dois cards lado a lado:
  - **Velocidade do Motor**: 4 botoes (Humano 30-60seg, Veloz 15-30seg, Turbo Elite 5-15seg, Caotico Aleatorio) em grid 2x2
  - **Modo & Instancias**: Toggle Modo Solo / Ping Pong + select de Instancia Principal
- Manter o Monitoramento Realtime na coluna direita como ja esta
- Adicionar o status "CHIP AQUECIDO" com icone de fogo abaixo do titulo "Indice de Maturacao" (quando ativo)

## 2. Disparador Elite - Monitorando Campanhas

Quando houver campanhas rodando, exibir uma seção "MONITORANDO CAMPANHAS" entre o header e o stepper, mostrando:
- Nome da campanha com icone de envio
- Status (DISPARO PAUSADO / EM ANDAMENTO)
- Barra de progresso com contagem (ex: 49/298)
- Botoes de Play/Resume e Delete

**Alteracoes no `UserDashboard.tsx` - case 'disparo':**
- Adicionar verificacao `if (campaigns.length > 0)` para renderizar a seção de monitoramento
- Card com lista de campanhas ativas, cada uma mostrando: nome, badge de status, progress bar, contagem enviados/total, botoes de acao (play/pause, delete)
- Manter o restante do formulario de criacao de campanha abaixo como esta

## 3. Centralização e Proporcionalidade de Fontes

Corrigir em AMBOS os arquivos (`UserDashboard.tsx` e `VIPDashboard.tsx`):
- Cards de metricas: icone centralizado acima, badge centralizado, label e valor centralizados
- Titulos de secao: tamanhos proporcionais (h1 = text-2xl md:text-3xl em vez de text-3xl md:text-5xl)
- Labels em cards pequenos: `text-[8px]` consistente
- Valores em cards pequenos: `text-lg` consistente
- Padronizar padding interno dos dashboard-cards
- Garantir que no mobile todos os textos fiquem visiveis sem overflow

---

## Detalhes Tecnicos

### Arquivos a editar:
1. **`src/pages/UserDashboard.tsx`** - Todas as 3 alteracoes acima
2. **`src/components/VIPDashboard.tsx`** - Somente centralização de fontes (item 3)

### Estrutura do card de campanha monitorada:
```text
+--------------------------------------------------+
| MONITORANDO CAMPANHAS                        [*]  |
| +----------------------------------------------+ |
| | [>] emagrecer                                 | |
| |     [DISPARO PAUSADO] ===---  49/298  [>][X] | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

### Estrutura Aquecimento Cloud (layout final):
```text
+---------------------------+-------------------+
| [Circulo 0%] Indice Mat.  | Monitoramento     |
|   Total | Uptime | Delay  | Realtime [LIVE]   |
+---------------------------+                   |
| Velocidade | Modo &       | (logs em tempo    |
| do Motor   | Instancias   |  real)            |
| [Hu][Ve]   | [Solo][Ping] |                   |
| [Tu][Ca]   | Select inst. | PROTECAO ANTI-BAN |
+---------------------------+-------------------+
```

Nenhuma alteracao de banco de dados e necessaria.
