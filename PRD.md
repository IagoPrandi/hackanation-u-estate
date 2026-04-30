# PRD Técnico — Usufruct Protocol

**Fase:** 0 — Hackathon MVP  
**Versão:** PRD refinado com Docker, OKX, escrow explícito, preço proporcional e mappings de existência  
**Rede:** Ethereum Sepolia  
**Smart contracts:** Solidity  
**Framework de contratos:** Foundry, executado fora do container da aplicação  
**Aplicação:** Next.js + TypeScript + Tailwind rodando localmente em Node.js via Docker  
**Web3:** wagmi + viem  
**Pagamento no MVP:** ETH nativo  
**Dados off-chain:** banco local não estruturado via lowdb  
**Documentos:** mockados  
**Cotação fiduciária:** OKX via API server-side local  

---

## 1. Objetivo da Fase 0

A Fase 0 deve demonstrar o seguinte fluxo:

1. Uma pessoa possui uma casa no mundo real.
2. Essa pessoa tokeniza a casa na plataforma.
3. Ela envia documentos mockados.
4. Ela informa valor de mercado, endereço e localização exata.
5. Os dados sensíveis ficam salvos off-chain em banco local não estruturado.
6. Hashes/referências dos dados são registrados on-chain.
7. O sistema gera:
   - um token de Direito de Usufruto;
   - uma posição de Direito de Valor Vinculado ao usufruto;
   - tokens de Direito de Valor Livre.
8. A proprietária fica com o Direito de Usufruto.
9. A proprietária fica com o Direito de Valor Vinculado.
10. A proprietária recebe os tokens de Direito de Valor Livre.
11. A proprietária escolhe quanto do Direito de Valor Livre quer vender.
12. O contrato calcula automaticamente o preço proporcional da oferta em ETH.
13. Uma pessoa compra esse Direito de Valor Livre.
14. A vendedora recebe ETH na wallet.
15. O comprador recebe tokens de Direito de Valor Livre.
16. A interface exibe valores em ETH e equivalentes fiduciários em BRL e USD.

A tese demonstrada é:

> A proprietária mantém o direito de uso da casa e uma participação econômica vinculada ao usufruto, enquanto vende parte do valor livre do imóvel para captar liquidez.

---

## 2. Decisões técnicas fechadas

| Tema | Decisão |
|---|---|
| Rede | Ethereum Sepolia |
| Smart contracts | Solidity |
| Framework de contratos | Foundry |
| Execução de deploy | Fora do container app |
| Aplicação | Next.js local em Node.js |
| Containerização | Docker / Docker Compose |
| Web3 client | wagmi + viem |
| Pagamento | ETH nativo |
| Cotação fiduciária | OKX via API server-side local |
| Rota principal de cotação | ETH → USDC → BRL |
| USD | Aproximação via ETH/USDC |
| BRL | ETH/USDC × USDC/BRL |
| EUR/JPY | Suporte condicional se houver rota OKX pública configurada |
| Documentos | Mockados |
| Armazenamento off-chain | lowdb em `db.json` |
| Escrita no banco local | Apenas via camada server-side local |
| Token de usufruto | ERC-721 restrito |
| Contrato de usufruto | Contrato único `UsufructRightNFT` |
| `tokenId` do usufruto | Igual ao `propertyId` |
| Direito de Valor Vinculado | Campo interno da posição de usufruto |
| Direito de Valor Livre | ERC-20 restrito por imóvel |
| Criação do ERC-20 | `PropertyValueTokenFactory` |
| `decimals` do ERC-20 | `0` |
| Transferência do Direito de Valor Livre | Apenas dentro da plataforma |
| Marketplace interno | Listing simples |
| Compra parcial da oferta | Não implementada na Fase 0 |
| Compra da oferta | Compra total |
| Preço da oferta | Calculado automaticamente de forma proporcional |
| Verificação documental | Mockada |
| Transferência direta do ERC-20 | Reverte |
| `approve` do ERC-20 | Reverte |
| Transferência direta do ERC-721 | Reverte |
| `approve` / `setApprovalForAll` do ERC-721 | Revertem |
| Compradores podem revender na Fase 0 | Não |
| `Paused` | Não usado na Fase 0 |

---

## 3. Execução local com Docker

A aplicação deve rodar localmente via Docker/Docker Compose.

### 3.1 Container `app`

Responsável por:

- executar a aplicação Next.js;
- expor a interface local;
- executar API routes/server actions;
- gravar e ler o banco local `db.json`;
- consultar OKX via server-side;
- expor dados para o frontend.

O container `app` **não** executa deploy de contratos.

O container `app` **não** contém `DEPLOYER_PRIVATE_KEY`.

### 3.2 Foundry/deploy

Foundry roda fora do container `app`.

O deploy pode ser executado:

- diretamente no host local do desenvolvedor; ou
- em um container separado de contratos, se a equipe desejar.

O ambiente de deploy possui `.env.deploy` próprio.

### 3.3 Persistência local

O banco local deve ser persistido em volume Docker.

Caminho recomendado dentro do container:

```text
/app/offchain-db/db.json
```

Estrutura local recomendada:

```text
offchain-db/
  db.json
```

---

## 4. Variáveis de ambiente

A Fase 0 deve separar variáveis da aplicação e variáveis de deploy.

### 4.1 `.env.app`

Usado pelo container Next.js.

Não deve conter chave privada.

```env
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS=
NEXT_PUBLIC_USUFRUCT_RIGHT_NFT_ADDRESS=
NEXT_PUBLIC_PROPERTY_VALUE_TOKEN_FACTORY_ADDRESS=
NEXT_PUBLIC_PRIMARY_VALUE_SALE_ADDRESS=

LOCAL_DB_PATH=/app/offchain-db/db.json

FIAT_PRICE_PROVIDER=okx
FIAT_SUPPORTED_CURRENCIES=brl,usd
FIAT_OPTIONAL_CURRENCIES=eur,jpy
FIAT_CACHE_TTL_SECONDS=60
FIAT_REQUEST_TIMEOUT_MS=3000
FIAT_MAX_STALENESS_SECONDS=3600
OKX_API_BASE_URL=https://www.okx.com
OKX_ETH_USDC_INST_ID=ETH-USDC
OKX_USDC_BRL_INST_ID=USDC-BRL
OKX_USDC_EUR_INST_ID=
OKX_USDC_JPY_INST_ID=
```

### 4.2 `.env.deploy`

Usado apenas fora do container `app`.

```env
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
MOCK_VERIFIER_ADDRESS=
```

### 4.3 Regra obrigatória

```text
DEPLOYER_PRIVATE_KEY nunca deve entrar no .env.app nem na imagem Docker da aplicação.
```

---

## 5. Ordem de deploy e configuração

### 5.1 Ordem de deploy

1. Deploy `UsufructRightNFT`.
2. Deploy `PropertyValueTokenFactory`.
3. Deploy `PropertyRegistry`.
4. Deploy `PrimaryValueSale`.
5. Configurar `PropertyRegistry` com:
   - endereço de `UsufructRightNFT`;
   - endereço de `PropertyValueTokenFactory`;
   - endereço de `PrimaryValueSale`.
6. Configurar `UsufructRightNFT`:
   - `PropertyRegistry` como único minter;
   - operadores autorizados apenas se necessários.
7. Configurar `PropertyValueTokenFactory`:
   - `PropertyRegistry` como único caller autorizado.
8. Configurar `PrimaryValueSale`:
   - endereço de `PropertyRegistry`.
9. Durante `tokenizeProperty`, cada `PropertyValueToken` criado deve autorizar `PrimaryValueSale` como operador.

### 5.2 Responsabilidades por contrato

| Contrato | Responsabilidade de configuração |
|---|---|
| `PropertyRegistry` | owner/admin configura endereços externos |
| `UsufructRightNFT` | owner/admin configura minter e operadores |
| `PropertyValueTokenFactory` | owner/admin configura registry autorizado |
| `PropertyValueToken` | factory/admin configura operador inicial |
| `PrimaryValueSale` | usa registry para validar imóvel, owner e token |

---

## 6. Modelo econômico da Fase 0

Cada imóvel tokenizado será representado economicamente por um total fixo de unidades inteiras.

```solidity
uint256 constant TOTAL_VALUE_UNITS = 1_000_000;
uint16 constant BPS_DENOMINATOR = 10_000;
```

Exemplo-base:

| Componente | Percentual | Unidades |
|---|---:|---:|
| Valor econômico total | 100% | 1.000.000 |
| Direito de Valor Vinculado ao usufruto | 20% | 200.000 |
| Direito de Valor Livre | 80% | 800.000 |

No MVP:

```text
Total econômico = Direito de Valor Vinculado + Direito de Valor Livre
1.000.000 = 200.000 + 800.000
```

A proprietária recebe:

```text
1 NFT de usufruto
+ 200.000 unidades vinculadas dentro da posição de usufruto
+ 800.000 tokens ERC-20 de Direito de Valor Livre
```

Todas as quantidades são inteiras.

O `PropertyValueToken` usa `decimals = 0`.

---

## 7. Diferença entre os tipos de direito

### 7.1 Direito de Usufruto

O Direito de Usufruto representa o direito de uso da casa.

Na Fase 0:

- é representado por um ERC-721 restrito;
- existe um único contrato `UsufructRightNFT`;
- cada imóvel tokenizado tem `tokenId = propertyId`;
- o NFT é mintado para a proprietária;
- não é vendido;
- não pode ser transferido diretamente pela wallet;
- carrega uma posição interna com o Direito de Valor Vinculado.

---

### 7.2 Direito de Valor Vinculado ao Usufruto

O Direito de Valor Vinculado é a participação econômica que fica presa ao usufruto.

Ele **não é ERC-20**.

Ele **não é um token separado**.

Ele é um campo interno da posição de usufruto associada ao NFT.

```solidity
struct UsufructPosition {
    uint256 propertyId;
    uint256 tokenId;
    address holder;

    uint256 linkedValueUnits;
    uint16 linkedValueBps;

    bool active;
}
```

Regra principal:

```text
O Direito de Valor Vinculado não pode ser vendido separadamente.
Ele só se move junto com o NFT de usufruto.
```

Na Fase 0, como o NFT de usufruto não é vendido, o Direito de Valor Vinculado permanece com a proprietária.

---

### 7.3 Direito de Valor Livre

O Direito de Valor Livre representa a parte econômica negociável do imóvel.

Na Fase 0:

- é representado por ERC-20 restrito;
- cada imóvel tem seu próprio ERC-20;
- o ERC-20 é criado por `PropertyValueTokenFactory`;
- o supply mintado equivale apenas ao Direito de Valor Livre;
- no exemplo-base, o supply é 800.000 unidades;
- `decimals = 0`;
- pode ser vendido dentro da plataforma;
- não dá direito de uso da casa;
- não pode ser transferido diretamente pela wallet;
- compradores não podem revender tokens na Fase 0.

Exemplo:

```text
Imóvel com 1.000.000 unidades econômicas totais

200.000 unidades = valor vinculado ao usufruto
800.000 unidades = valor livre em ERC-20
```

---

## 8. Tabela comparativa dos direitos

| Direito | Implementação | Fungível? | Transferível separadamente? | Fica com quem inicialmente? | Representa |
|---|---|---:|---:|---|---|
| Direito de Usufruto | ERC-721 restrito | Não | Não na Fase 0 | Proprietária | Uso da casa |
| Direito de Valor Vinculado | Campo interno da posição de usufruto | Não como token | Não | Proprietária | Fração econômica presa ao usufruto |
| Direito de Valor Livre | ERC-20 restrito | Sim | Sim, via plataforma | Proprietária | Fração econômica negociável |

---

## 9. Exemplo completo da distribuição inicial

Casa com valor de mercado informado de 10 ETH.

Parâmetros:

```text
Valor econômico total = 1.000.000 unidades
Direito de Valor Vinculado = 200.000 unidades
Direito de Valor Livre = 800.000 unidades
```

Após tokenização:

| Pessoa | Usufruto | Valor Vinculado | Valor Livre | Total econômico |
|---|---:|---:|---:|---:|
| Pessoa A | Sim | 20% | 80% | 100% |

Representação técnica:

```text
Pessoa A recebe:
- UsufructRightNFT tokenId = propertyId
- UsufructPosition.linkedValueUnits = 200.000
- 800.000 PropertyValueToken
```

---

## 10. Exemplo de venda do Direito de Valor Livre

Pessoa A decide vender 300.000 unidades de Direito de Valor Livre.

```text
300.000 unidades = 30% do valor econômico total
```

Casa informada em 10 ETH.

Preço automático:

```text
priceWei = marketValueWei * amount / totalValueUnits
priceWei = 10 ETH * 300.000 / 1.000.000
priceWei = 3 ETH
```

Pessoa B compra a oferta.

Resultado:

| Pessoa | Usufruto | Valor Vinculado | Valor Livre | Total econômico |
|---|---:|---:|---:|---:|
| Pessoa A | Sim | 20% | 50% | 70% |
| Pessoa B | Não | 0% | 30% | 30% |

Interpretação:

```text
Pessoa A continua podendo usar a casa.
Pessoa A mantém 70% do valor econômico total.
Pessoa B possui 30% do valor econômico total.
Pessoa B não tem direito de uso da casa.
```

---

## 11. Arquitetura da Fase 0

```text
┌──────────────────────────────────────┐
│ Browser                              │
│ Interface Next.js                    │
└──────────────────┬───────────────────┘
                   │
                   │ chama server-side local
                   ▼
┌──────────────────────────────────────┐
│ Container app                         │
│ Node.js + Next.js                     │
│ API routes/server actions             │
│ lowdb + OKX client              │
└──────────────────┬───────────────────┘
                   │
                   │ persiste dados mockados
                   ▼
┌──────────────────────────────────────┐
│ Volume Docker                         │
│ /app/offchain-db/db.json              │
└──────────────────┬───────────────────┘
                   │
                   │ hashes/referências
                   ▼
┌──────────────────────────────────────┐
│ Smart Contracts Sepolia               │
│ Solidity                              │
└──────────────────┬───────────────────┘
                   │
                   │ ETH
                   ▼
┌──────────────────────────────────────┐
│ Wallets                               │
│ vendedora / comprador                 │
└──────────────────────────────────────┘
```

---

## 12. Dados off-chain

### 12.1 Dados armazenados localmente

Os seguintes dados ficam off-chain:

- documentos mockados;
- endereço completo;
- localização exata;
- descrição do imóvel;
- imagens mockadas, se usadas;
- dados auxiliares de onboarding.

### 12.2 Escrita server-side

O browser nunca grava diretamente no `db.json`.

Toda escrita deve passar por:

```text
Browser
↓
API route ou server action local
↓
lowdb
↓
db.json
```

### 12.3 Banco local não estruturado

Recomendação:

```text
lowdb + db.json
```

Exemplo:

```json
{
  "properties": [
    {
      "localPropertyId": "local-001",
      "ownerWallet": "0x...",
      "marketValueWei": "10000000000000000000",
      "linkedValueBps": 2000,
      "address": {
        "street": "Rua Exemplo",
        "number": "123",
        "city": "São Paulo",
        "state": "SP",
        "country": "BR",
        "postalCode": "00000-000"
      },
      "location": {
        "lat": "-23.550500",
        "lng": "-46.633300"
      },
      "documents": [
        {
          "type": "mock_deed",
          "filename": "mock_matricula.pdf",
          "mock": true
        },
        {
          "type": "mock_owner_id",
          "filename": "mock_owner_id.pdf",
          "mock": true
        }
      ],
      "documentsHash": "0x...",
      "metadataHash": "0x...",
      "locationHash": "0x...",
      "mockVerificationStatus": "MockVerified",
      "createdAt": "2026-04-28T00:00:00.000Z"
    }
  ],
  "fiatRatesCache": {
    "provider": "okx",
    "base": "ETH",
    "rates": {
      "brl": "0",
      "usd": "0",
      "eur": "0",
      "jpy": "0"
    },
    "updatedAt": null
  }
}
```

---

## 13. Hashing off-chain

### 13.1 Algoritmo

```text
keccak256
```

### 13.2 Input

O input do hash deve ser um JSON estável:

- chaves ordenadas alfabeticamente;
- encoding UTF-8;
- sem campos voláteis não determinísticos;
- strings normalizadas;
- mesma estrutura para frontend e server-side.

### 13.3 Separação dos hashes

O PRD usa três hashes com responsabilidades diferentes:

| Hash | Conteúdo |
|---|---|
| `metadataHash` | dados textuais do imóvel, valor de mercado, percentual vinculado e endereço textual |
| `documentsHash` | metadata mockada dos documentos, sem hash de binário e sem `uploadedAt` |
| `locationHash` | apenas latitude e longitude normalizadas |

### 13.4 Metadata textual do imóvel

`metadataHash` deve incluir o endereço textual.

Schema:

```ts
type PropertyMetadata = {
  version: "1.0";
  propertyLocalId: string;
  ownerWallet: string;
  marketValueWei: string;
  linkedValueBps: number;
  address: {
    street: string;
    number: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
};
```

Cálculo:

```text
metadataHash = keccak256(stableJson(PropertyMetadata))
```

### 13.5 Localização

`locationHash` deve incluir apenas `lat` e `lng`.

`lat` e `lng` devem ser strings normalizadas com 6 casas decimais.

Não usar `number` para `lat`/`lng`.

Schema:

```ts
type LocationMetadata = {
  version: "1.0";
  propertyLocalId: string;
  lat: string;
  lng: string;
};
```

Exemplo:

```json
{
  "version": "1.0",
  "propertyLocalId": "local-001",
  "lat": "-23.550500",
  "lng": "-46.633300"
}
```

Cálculo:

```text
locationHash = keccak256(stableJson(LocationMetadata))
```

### 13.6 Documentos mockados

`documentsHash` deve ser calculado sobre a metadata mockada dos documentos, não sobre o arquivo binário.

`uploadedAt` não entra no `documentsHash`.

`uploadedAt` pode existir no `db.json` para fins de UI/debug, mas deve ficar fora do objeto usado para hashing.

Schema usado para hash:

```ts
type DocumentsHashMetadata = {
  version: "1.0";
  propertyLocalId: string;
  documents: {
    type: "mock_deed" | "mock_owner_id" | "mock_tax_record";
    filename: string;
    mock: true;
  }[];
};
```

Cálculo:

```text
documentsHash = keccak256(stableJson(DocumentsHashMetadata))
```

### 13.7 Exemplo de campo permitido apenas no banco local

O banco local pode armazenar `uploadedAt`, mas esse campo não entra no hash.

```json
{
  "type": "mock_deed",
  "filename": "mock_matricula.pdf",
  "mock": true,
  "uploadedAt": "2026-04-29T12:00:00.000Z"
}
```

---

## 14. Cotação fiduciária com OKX

### 14.1 Objetivo

A interface deve exibir equivalentes fiduciários para valores em ETH.

A Fase 0 deve priorizar:

- BRL;
- USD.

EUR e JPY podem aparecer na UI somente se houver rota pública OKX configurada e funcional no ambiente local. Caso contrário, a UI deve ocultar essas moedas sem quebrar o fluxo principal.

### 14.2 Regra de arquitetura

O frontend não chama a OKX diretamente.

Fluxo:

```text
Frontend
↓
/api/fiat-rates
↓
server-side local
↓
OKX
↓
cache local
↓
frontend
```

A API local é responsável por:

- consultar a OKX;
- aplicar timeout;
- validar a resposta da OKX;
- normalizar a resposta;
- calcular rotas;
- armazenar cache;
- aplicar limite máximo de staleness no fallback;
- retornar erro padronizado;
- nunca usar valores fiduciários para settlement on-chain.

### 14.3 Endpoint OKX obrigatório

A Fase 0 deve usar o endpoint público de ticker da OKX:

```text
GET /api/v5/market/ticker?instId=<instId>
```

Base URL configurável:

```text
OKX_API_BASE_URL=https://www.okx.com
```

Exemplos de `instId`:

```text
ETH-USDC
USDC-BRL
```

### 14.4 Campo usado como preço

A API local deve usar:

```text
data[0].last
```

como preço informativo da rota consultada.

Esse preço é apenas informativo para UI.

Ele não é preço garantido de execução e não é usado pelo contrato.

### 14.5 Validação da resposta OKX

A resposta da OKX só é válida se todas as condições abaixo forem verdadeiras:

- `code == "0"`;
- `data` existe;
- `data` é array não vazio;
- `data[0].last` existe;
- `data[0].last` é decimal válido;
- `data[0].last > 0`.

Se qualquer uma dessas validações falhar, a rota consultada deve ser considerada indisponível.

Função conceitual:

```ts
async function fetchOkxTickerLast(instId: string): Promise<Decimal>;
```

### 14.6 Fonte primária

Provider:

```text
OKX
```

A fonte primária de preço cripto será:

```text
ETH-USDC
```

A rota principal para BRL será:

```text
ETH → USDC → BRL
```

Fórmula:

```text
ETH_BRL = ETH_USDC * USDC_BRL
```

Para USD, a Fase 0 usa:

```text
ETH_USD ≈ ETH_USDC
```

Essa aproximação é aceitável para a demo, pois USDC é tratado como referência em dólar.

### 14.7 Validação runtime de `USDC-BRL`

A rota `USDC-BRL` deve ser validada em runtime.

A aplicação não deve assumir que `USDC-BRL` estará sempre disponível como ticker público no ambiente usado.

Fluxo obrigatório:

```text
1. Buscar ETH-USDC.
2. Validar ETH-USDC.
3. Tentar buscar USDC-BRL.
4. Validar USDC-BRL.
5. Se USDC-BRL for válido:
   - calcular ETH_BRL.
6. Se USDC-BRL for inválido ou indisponível:
   - marcar BRL como indisponível;
   - manter USD disponível se ETH-USDC for válido;
   - não bloquear o fluxo on-chain em ETH.
```

BRL indisponível não bloqueia:

- registro do imóvel;
- verificação mock;
- tokenização;
- criação de oferta;
- compra da oferta.

Na UI, quando BRL estiver indisponível, exibir:

```text
BRL indisponível no momento
```

### 14.8 Rotas fiduciárias

#### USD

Obrigatório na Fase 0.

```text
ETH_USD ≈ ETH_USDC
```

Se `ETH-USDC` estiver indisponível, toda cotação fiduciária fica indisponível.

#### BRL

Obrigatório tentar na Fase 0, mas não bloqueante.

```text
ETH_BRL = ETH_USDC * USDC_BRL
```

Se `USDC-BRL` estiver indisponível, a API deve retornar USD e marcar BRL como indisponível.

#### EUR

Condicional.

```text
ETH_EUR = ETH_USDC * USDC_EUR
```

A moeda EUR só deve ser exibida se `OKX_USDC_EUR_INST_ID` estiver configurada e a API local conseguir obter cotação válida.

#### JPY

Condicional.

```text
ETH_JPY = ETH_USDC * USDC_JPY
```

A moeda JPY só deve ser exibida se `OKX_USDC_JPY_INST_ID` estiver configurada e a API local conseguir obter cotação válida.

### 14.9 Timeout

A chamada para a OKX deve ter timeout.

Valor padrão:

```text
FIAT_REQUEST_TIMEOUT_MS=3000
```

### 14.10 Cache e fallback

A API local deve usar cache de cotações.

Valor padrão de TTL:

```text
FIAT_CACHE_TTL_SECONDS=60
```

Se a OKX falhar e houver último valor válido em cache, a API pode usar fallback apenas se o cache não ultrapassar o limite máximo de staleness.

Valor padrão de staleness máximo:

```text
FIAT_MAX_STALENESS_SECONDS=3600
```

Regras:

```text
Se cache está dentro do TTL:
    usar cache normal.

Se OKX falha e cache tem idade <= FIAT_MAX_STALENESS_SECONDS:
    usar fallback com warning.

Se OKX falha e cache tem idade > FIAT_MAX_STALENESS_SECONDS:
    retornar erro fiduciário padronizado.
```

### 14.11 Resposta padronizada de sucesso

```json
{
  "ok": true,
  "provider": "okx",
  "base": "ETH",
  "routes": {
    "usd": "ETH-USDC",
    "brl": "ETH-USDC * USDC-BRL"
  },
  "rates": {
    "usd": "2250.10",
    "brl": "11500.25"
  },
  "unavailable": [],
  "optionalRates": {
    "eur": null,
    "jpy": null
  },
  "cached": false,
  "updatedAt": "2026-04-29T12:00:00.000Z"
}
```

### 14.12 Resposta com BRL indisponível

```json
{
  "ok": true,
  "provider": "okx",
  "base": "ETH",
  "routes": {
    "usd": "ETH-USDC"
  },
  "rates": {
    "usd": "2250.10"
  },
  "unavailable": ["brl"],
  "optionalRates": {
    "eur": null,
    "jpy": null
  },
  "cached": false,
  "warning": "BRL_ROUTE_UNAVAILABLE",
  "updatedAt": "2026-04-29T12:00:00.000Z"
}
```

### 14.13 Resposta usando fallback

```json
{
  "ok": true,
  "provider": "okx",
  "base": "ETH",
  "routes": {
    "usd": "ETH-USDC",
    "brl": "ETH-USDC * USDC-BRL"
  },
  "rates": {
    "usd": "2245.00",
    "brl": "11480.00"
  },
  "unavailable": [],
  "optionalRates": {
    "eur": null,
    "jpy": null
  },
  "cached": true,
  "warning": "USING_LAST_KNOWN_RATES",
  "updatedAt": "2026-04-29T11:59:00.000Z"
}
```

### 14.14 Resposta de erro padronizada

Se a OKX falhar e não houver cache válido dentro do limite máximo de staleness:

```json
{
  "ok": false,
  "code": "FIAT_RATES_UNAVAILABLE",
  "message": "Could not fetch ETH fiat rates from OKX and no cached rates are available within max staleness.",
  "provider": "okx"
}
```

### 14.15 Cálculos fiduciários

Cálculos fiduciários não devem usar `Number`.

Regras:

- valores on-chain em `bigint`;
- taxas fiduciárias como string decimal;
- cálculos usando decimal seguro, como `decimal.js` ou biblioteca equivalente;
- formatação apenas na camada de UI.

Exemplo conceitual:

```ts
const ethAmount = new Decimal(wei.toString()).div("1000000000000000000");
const fiatAmount = ethAmount.mul(new Decimal(rateString));
```

### 14.16 Uso na UI

A UI deve exibir valores fiduciários para:

- valor de mercado do imóvel;
- valor total do Direito de Valor Livre;
- quantidade listada;
- preço da oferta;
- valor por unidade;
- total econômico da vendedora;
- total econômico do comprador.

USD deve aparecer quando `ETH-USDC` estiver disponível.

BRL deve aparecer quando `USDC-BRL` estiver disponível.

Se BRL estiver indisponível, a UI deve continuar funcionando em ETH e USD.

EUR e JPY são condicionais e só devem aparecer se houver cotação válida retornada pela API local.

### 14.17 Regra de settlement

Valores fiduciários são apenas informativos.

O contrato continua usando:

- ETH;
- wei;
- unidades inteiras.

Nenhum valor fiduciário é usado para settlement on-chain na Fase 0.

---

## 15. Dados on-chain

A blockchain armazena apenas referências, hashes e parâmetros econômicos.

```solidity
struct PropertyRecord {
    uint256 propertyId;
    address owner;

    uint256 marketValueWei;

    uint256 totalValueUnits;
    uint256 linkedValueUnits;
    uint256 freeValueUnits;
    uint16 linkedValueBps;

    bytes32 metadataHash;
    bytes32 documentsHash;
    bytes32 locationHash;

    address valueToken;
    uint256 usufructTokenId;

    PropertyStatus status;
}
```

Nenhum endereço completo, documento ou localização exata deve ser salvo em texto aberto on-chain.

---

## 16. Contratos da Fase 0

### 16.1 `PropertyRegistry`

Responsável por:

- registrar imóvel;
- manter `nextPropertyId`;
- manter `propertyExists`;
- armazenar hashes e parâmetros econômicos;
- manter `propertiesByOwner`;
- manter lista de participantes por imóvel;
- fazer mock verification;
- tokenizar imóvel;
- chamar `PropertyValueTokenFactory`;
- mintar NFT de usufruto;
- mintar ERC-20 de Direito de Valor Livre;
- armazenar a posição de usufruto com valor vinculado;
- configurar endereços externos;
- atualizar status conforme listings.

### 16.2 `UsufructRightNFT`

ERC-721 restrito.

Responsável por:

- representar o Direito de Usufruto;
- usar contrato único;
- usar `tokenId = propertyId`;
- permitir mint apenas pelo `PropertyRegistry`;
- bloquear `approve`;
- bloquear `setApprovalForAll`;
- bloquear `transferFrom`;
- bloquear `safeTransferFrom`.

### 16.3 `PropertyValueToken`

ERC-20 restrito.

Responsável por:

- representar apenas o Direito de Valor Livre;
- ter `decimals = 0`;
- permitir mint apenas pelo `PropertyRegistry`;
- bloquear `transfer`;
- bloquear `transferFrom`;
- bloquear `approve`;
- permitir `platformTransferFrom` apenas para operadores autorizados;
- autorizar `PrimaryValueSale` como operador.

### 16.4 `PropertyValueTokenFactory`

Responsável por:

- criar um `PropertyValueToken` por imóvel;
- permitir `createPropertyValueToken` apenas pelo `PropertyRegistry`;
- configurar operador inicial do token criado, incluindo `PrimaryValueSale`.

### 16.5 `PrimaryValueSale`

Marketplace primário.

Responsável por:

- criar oferta de venda do Direito de Valor Livre;
- aceitar apenas ofertas criadas pelo owner do `PropertyRecord`;
- calcular automaticamente `priceWei`;
- exigir `priceWei > 0`;
- manter `nextListingId`;
- manter `listingExists`;
- manter listagens enumeráveis;
- travar tokens em escrow;
- usar `address(this)` como escrow;
- permitir compra total da oferta;
- mudar listing para `Filled` antes de transferir ETH;
- transferir ETH para vendedora via `call`;
- reverter se `call` falhar;
- usar `nonReentrant` em compra e cancelamento;
- registrar comprador como participante;
- atualizar status do imóvel.

Esse contrato movimenta apenas o ERC-20 de Direito de Valor Livre.

Ele não movimenta o NFT de usufruto.

Ele não movimenta o Direito de Valor Vinculado.

---

## 17. Modelo de acesso

### 17.1 `PropertyRegistry`

Usa:

- `Ownable`;
- `AccessControl`.

Roles:

```solidity
bytes32 public constant MOCK_VERIFIER_ROLE =
    keccak256("MOCK_VERIFIER_ROLE");
```

Regras:

- owner/admin configura endereços externos;
- `mockVerifyProperty` pode ser chamado pelo owner do `PropertyRecord` ou por conta com `MOCK_VERIFIER_ROLE`;
- status só pode ser atualizado por fluxos autorizados.

### 17.2 `UsufructRightNFT`

Regras:

- apenas `PropertyRegistry` pode mintar;
- `setAuthorizedOperator` apenas owner/admin;
- `approve` reverte;
- `setApprovalForAll` reverte;
- `transferFrom` reverte;
- `safeTransferFrom` reverte.

### 17.3 `PropertyValueToken`

Regras:

- apenas `PropertyRegistry` pode mintar;
- apenas admin/factory configura operador inicial;
- `PrimaryValueSale` é operador autorizado;
- `transfer` reverte;
- `transferFrom` reverte;
- `approve` reverte;
- `allowance` não é usado na Fase 0.

### 17.4 `PropertyValueTokenFactory`

Regras:

- `createPropertyValueToken` só pode ser chamado pelo `PropertyRegistry`.

### 17.5 `PrimaryValueSale`

Regras:

- `createPrimarySaleListing` só pode ser chamado pelo owner do `PropertyRecord`;
- compradores não podem revender tokens na Fase 0;
- compras e cancelamentos usam `nonReentrant`.

---

## 18. Enums

```solidity
enum PropertyStatus {
    PendingMockVerification,
    MockVerified,
    Tokenized,
    ActiveSale,
    SoldOut
}

enum SaleStatus {
    Active,
    Filled,
    Cancelled
}
```

Definição de `SoldOut`:

```text
SoldOut significa que 100% do freeValueUnits foi vendido em ofertas primárias.
Não significa venda total do imóvel.
Não afeta o Direito de Usufruto nem o Direito de Valor Vinculado.
```

---

## 19. Structs on-chain

### 19.1 `PropertyRecord`

```solidity
struct PropertyRecord {
    uint256 propertyId;
    address owner;

    uint256 marketValueWei;

    uint256 totalValueUnits;
    uint256 linkedValueUnits;
    uint256 freeValueUnits;
    uint16 linkedValueBps;

    bytes32 metadataHash;
    bytes32 documentsHash;
    bytes32 locationHash;

    address valueToken;
    uint256 usufructTokenId;

    PropertyStatus status;
}
```

### 19.2 `UsufructPosition`

```solidity
struct UsufructPosition {
    uint256 propertyId;
    uint256 tokenId;
    address holder;

    uint256 linkedValueUnits;
    uint16 linkedValueBps;

    bool active;
}
```

### 19.3 `PrimarySaleListing`

```solidity
struct PrimarySaleListing {
    uint256 listingId;
    uint256 propertyId;

    address seller;
    uint256 amount;
    uint256 priceWei;

    SaleStatus status;
}
```

---

## 20. Storage obrigatório

### 20.1 `PropertyRegistry`

```solidity
uint256 public nextPropertyId = 1;

mapping(uint256 => PropertyRecord) public properties;
mapping(uint256 => bool) public propertyExists;

mapping(uint256 => UsufructPosition) public usufructPositions;

mapping(address => uint256[]) private propertiesByOwner;

mapping(uint256 => address[]) private participants;
mapping(uint256 => mapping(address => bool)) public isParticipant;
```

### 20.2 `PrimaryValueSale`

```solidity
uint256 public nextListingId = 1;

mapping(uint256 => PrimarySaleListing) public listings;
mapping(uint256 => bool) public listingExists;

uint256[] private listingIds;
mapping(uint256 => uint256[]) private listingsByProperty;

mapping(uint256 => uint256) public activeListingsCountByProperty;
mapping(uint256 => uint256) public totalFreeValueSoldByProperty;
mapping(uint256 => uint256) public activeEscrowedAmountByProperty;
```

### 20.3 Definições

| Storage | Significado |
|---|---|
| `propertyExists` | evita interpretar imóvel inexistente como struct default |
| `listingExists` | evita interpretar listing inexistente como struct default |
| `activeListingsCountByProperty` | número de ofertas ativas por imóvel |
| `totalFreeValueSoldByProperty` | total de tokens livres vendidos com sucesso |
| `activeEscrowedAmountByProperty` | total de tokens livres atualmente presos em ofertas ativas |
| `propertiesByOwner` | imóveis registrados por owner |
| `participants` | owner e compradores do imóvel |

---

## 21. `PropertyRegistry`

### 21.1 Configurar contratos externos

```solidity
function setExternalContracts(
    address usufructRightNFT,
    address propertyValueTokenFactory,
    address primaryValueSale
) external onlyOwner;
```

#### Validações

- [ ] Nenhum endereço pode ser zero.
- [ ] Apenas owner/admin pode chamar.

#### Evento

```solidity
event ExternalContractsConfigured(
    address usufructRightNFT,
    address propertyValueTokenFactory,
    address primaryValueSale
);
```

---

### 21.2 Registrar imóvel

```solidity
function registerProperty(
    uint256 marketValueWei,
    uint16 linkedValueBps,
    bytes32 metadataHash,
    bytes32 documentsHash,
    bytes32 locationHash
) external returns (uint256 propertyId);
```

#### Validações

- [ ] `marketValueWei > 0`.
- [ ] `linkedValueBps > 0`.
- [ ] `linkedValueBps < 10_000`.
- [ ] `metadataHash != bytes32(0)`.
- [ ] `documentsHash != bytes32(0)`.
- [ ] `locationHash != bytes32(0)`.

#### Cálculos

```solidity
totalValueUnits = 1_000_000;
linkedValueUnits = totalValueUnits * linkedValueBps / 10_000;
freeValueUnits = totalValueUnits - linkedValueUnits;
```

#### Efeitos

- [ ] Usa `propertyId = nextPropertyId++`.
- [ ] Cria `PropertyRecord`.
- [ ] Define `propertyExists[propertyId] = true`.
- [ ] Define `owner = msg.sender`.
- [ ] Define status `PendingMockVerification`.
- [ ] Adiciona `propertyId` em `propertiesByOwner[msg.sender]`.
- [ ] Adiciona owner em `participants[propertyId]`.
- [ ] Emite `PropertyRegistered`.
- [ ] Emite `ParticipantAdded`.

---

### 21.3 Mock verification

```solidity
function mockVerifyProperty(uint256 propertyId) external;
```

#### Validações

- [ ] `propertyExists[propertyId] == true`.
- [ ] Status atual é `PendingMockVerification`.
- [ ] Chamador é owner do `PropertyRecord` ou possui `MOCK_VERIFIER_ROLE`.

#### Efeitos

- [ ] Atualiza status para `MockVerified`.
- [ ] Emite `PropertyMockVerified`.
- [ ] Emite `PropertyStatusUpdated`.

---

### 21.4 Tokenizar imóvel

```solidity
function tokenizeProperty(uint256 propertyId) external;
```

#### Validações

- [ ] `propertyExists[propertyId] == true`.
- [ ] `msg.sender == owner`.
- [ ] Status é `MockVerified`.
- [ ] Imóvel ainda não foi tokenizado.

#### Efeitos

- [ ] Minta `UsufructRightNFT` para owner com `tokenId = propertyId`.
- [ ] Cria `UsufructPosition` com `linkedValueUnits`.
- [ ] Chama `PropertyValueTokenFactory.createPropertyValueToken`.
- [ ] Minta apenas `freeValueUnits` em ERC-20 para owner.
- [ ] Garante que `PrimaryValueSale` seja operador autorizado do token.
- [ ] Atualiza status para `Tokenized`.
- [ ] Emite `PropertyTokenized`.
- [ ] Emite `PropertyValueTokenCreated`.
- [ ] Emite `PropertyStatusUpdated`.

---

### 21.5 Atualizar status após alteração de listing

Função chamada apenas pelo `PrimaryValueSale`.

```solidity
function updateStatusAfterSaleChange(
    uint256 propertyId,
    uint256 activeListingsCount,
    uint256 totalFreeValueSold
) external;
```

#### Regras

- [ ] Se `totalFreeValueSold == freeValueUnits`, status vira `SoldOut`.
- [ ] Senão, se `activeListingsCount > 0`, status vira `ActiveSale`.
- [ ] Senão, status volta para `Tokenized`.

---

### 21.6 Getters

```solidity
function getProperty(uint256 propertyId)
    external
    view
    returns (PropertyRecord memory);

function getUsufructPosition(uint256 propertyId)
    external
    view
    returns (UsufructPosition memory);

function getPropertiesByOwner(address owner)
    external
    view
    returns (uint256[] memory);

function getParticipants(uint256 propertyId)
    external
    view
    returns (address[] memory);

function getEconomicBreakdown(uint256 propertyId, address account)
    external
    view
    returns (
        uint256 freeValueUnits,
        uint256 linkedValueUnits,
        uint256 totalEconomicUnits
    );
```

`getEconomicBreakdown` deve retornar `linkedValueUnits` somente se `account` for titular do NFT de usufruto.

---

## 22. `UsufructRightNFT`

### 22.1 Regras

- [ ] Contrato único.
- [ ] `tokenId = propertyId`.
- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] `approve` reverte.
- [ ] `setApprovalForAll` reverte.
- [ ] `transferFrom` reverte.
- [ ] `safeTransferFrom` reverte.
- [ ] `setAuthorizedOperator` apenas owner/admin.

### 22.2 Interface esperada

```solidity
interface IUsufructRightNFT {
    function mint(address to, uint256 tokenId) external;

    function ownerOf(uint256 tokenId) external view returns (address);

    function setAuthorizedOperator(address operator, bool allowed) external;
}
```

---

## 23. `PropertyValueToken`

### 23.1 Regras

- [ ] Representa apenas o Direito de Valor Livre.
- [ ] `decimals() = 0`.
- [ ] Quantidades são unidades inteiras.
- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] `PrimaryValueSale` é operador autorizado.
- [ ] `transfer` reverte.
- [ ] `transferFrom` reverte.
- [ ] `approve` reverte.
- [ ] `allowance` não é usado.

### 23.2 Interface esperada

```solidity
interface IPropertyValueToken {
    function mint(address to, uint256 amount) external;

    function platformTransferFrom(
        address from,
        address to,
        uint256 amount
    ) external;

    function setAuthorizedOperator(address operator, bool allowed) external;

    function balanceOf(address account) external view returns (uint256);

    function decimals() external pure returns (uint8);
}
```

---

## 24. `PropertyValueTokenFactory`

### 24.1 Regras

- [ ] Apenas `PropertyRegistry` pode chamar `createPropertyValueToken`.
- [ ] Factory cria um ERC-20 por imóvel.
- [ ] Token criado deve ter `decimals = 0`.
- [ ] Token criado deve receber referência ao `PropertyRegistry`.
- [ ] Token criado deve configurar `PrimaryValueSale` como operador autorizado.

### 24.2 Função esperada

```solidity
function createPropertyValueToken(
    uint256 propertyId,
    string memory name,
    string memory symbol,
    address primaryValueSale
) external returns (address valueToken);
```

---

## 25. `PrimaryValueSale`

### 25.1 Criar oferta primária

```solidity
function createPrimarySaleListing(
    uint256 propertyId,
    uint256 amount
) external returns (uint256 listingId);
```

#### Validações

- [ ] `propertyExists[propertyId] == true`.
- [ ] Imóvel está `Tokenized` ou `ActiveSale`.
- [ ] `msg.sender == property.owner`.
- [ ] `amount > 0`.
- [ ] `amount <= balanceOf(msg.sender)`.
- [ ] Compradores não podem criar ofertas na Fase 0.

#### Cálculo de preço

```solidity
priceWei = property.marketValueWei * amount / property.totalValueUnits;
require(priceWei > 0, "PRICE_ZERO");
```

#### Efeitos

- [ ] Usa `listingId = nextListingId++`.
- [ ] Define `listingExists[listingId] = true`.
- [ ] Move `amount` do seller para `address(this)`.
- [ ] Incrementa `activeEscrowedAmountByProperty[propertyId]`.
- [ ] Incrementa `activeListingsCountByProperty[propertyId]`.
- [ ] Cria listing com status `Active`.
- [ ] Adiciona `listingId` em `listingIds`.
- [ ] Adiciona `listingId` em `listingsByProperty[propertyId]`.
- [ ] Atualiza status do imóvel.
- [ ] Emite `PrimarySaleListed`.
- [ ] Emite `TokensEscrowed`.

---

### 25.2 Comprar oferta primária

```solidity
function buyPrimarySaleListing(uint256 listingId)
    external
    payable
    nonReentrant;
```

#### Validações

- [ ] `listingExists[listingId] == true`.
- [ ] Listing está `Active`.
- [ ] `msg.value == priceWei`.
- [ ] Comprador não é seller.
- [ ] Imóvel está `ActiveSale` ou `Tokenized`.

#### Efeitos antes de interações externas

- [ ] Listing muda para `Filled`.
- [ ] Decrementa `activeListingsCountByProperty[propertyId]`.
- [ ] Decrementa `activeEscrowedAmountByProperty[propertyId]`.
- [ ] Incrementa `totalFreeValueSoldByProperty[propertyId]`.
- [ ] Atualiza status do imóvel:
  - `SoldOut`, se todo `freeValueUnits` foi vendido;
  - `Tokenized`, se não houver ofertas ativas;
  - `ActiveSale`, se ainda houver ofertas ativas.
- [ ] Adiciona comprador em `participants[propertyId]`, se ainda não existir.
- [ ] Emite `ListingStatusUpdated`.

#### Interações externas

- [ ] Transfere tokens livres de `address(this)` para comprador.
- [ ] Transfere ETH para seller usando `call`.
- [ ] Reverte se o `call` falhar.

```solidity
(bool ok, ) = listing.seller.call{value: listing.priceWei}("");
require(ok, "ETH_TRANSFER_FAILED");
```

#### Eventos

- [ ] Emite `PrimarySalePurchased`.
- [ ] Emite `SellerPaid`.
- [ ] Emite `ParticipantAdded`, se comprador for novo participante.

---

### 25.3 Cancelar oferta

```solidity
function cancelPrimarySaleListing(uint256 listingId)
    external
    nonReentrant;
```

#### Validações

- [ ] `listingExists[listingId] == true`.
- [ ] Listing está `Active`.
- [ ] `msg.sender == seller`.

#### Efeitos

- [ ] Listing muda para `Cancelled`.
- [ ] Decrementa `activeListingsCountByProperty[propertyId]`.
- [ ] Decrementa `activeEscrowedAmountByProperty[propertyId]`.
- [ ] Devolve tokens de `address(this)` para seller.
- [ ] Atualiza status do imóvel.
- [ ] Emite `PrimarySaleCancelled`.
- [ ] Emite `ListingStatusUpdated`.

---

### 25.4 Getters

```solidity
function getListing(uint256 listingId)
    external
    view
    returns (PrimarySaleListing memory);

function getAllListingIds()
    external
    view
    returns (uint256[] memory);

function getListingsByProperty(uint256 propertyId)
    external
    view
    returns (PrimarySaleListing[] memory);

function getActiveListingsByProperty(uint256 propertyId)
    external
    view
    returns (PrimarySaleListing[] memory);
```

Para a Fase 0, arrays simples são aceitáveis.

---

## 26. Eventos obrigatórios

### 26.1 `PropertyRegistry`

```solidity
event ExternalContractsConfigured(
    address usufructRightNFT,
    address propertyValueTokenFactory,
    address primaryValueSale
);

event PropertyRegistered(
    uint256 indexed propertyId,
    address indexed owner,
    uint256 marketValueWei,
    uint256 totalValueUnits,
    uint256 linkedValueUnits,
    uint256 freeValueUnits,
    uint16 linkedValueBps,
    bytes32 metadataHash,
    bytes32 documentsHash,
    bytes32 locationHash
);

event PropertyMockVerified(
    uint256 indexed propertyId,
    address indexed verifier
);

event PropertyTokenized(
    uint256 indexed propertyId,
    address indexed owner,
    address valueToken,
    uint256 usufructTokenId,
    uint256 linkedValueUnits,
    uint256 freeValueUnits
);

event PropertyValueTokenCreated(
    uint256 indexed propertyId,
    address indexed valueToken,
    uint256 freeValueUnits
);

event PropertyStatusUpdated(
    uint256 indexed propertyId,
    PropertyStatus oldStatus,
    PropertyStatus newStatus
);

event ParticipantAdded(
    uint256 indexed propertyId,
    address indexed participant
);
```

### 26.2 `PrimaryValueSale`

```solidity
event PrimarySaleListed(
    uint256 indexed listingId,
    uint256 indexed propertyId,
    address indexed seller,
    uint256 amount,
    uint256 priceWei
);

event TokensEscrowed(
    uint256 indexed listingId,
    address indexed seller,
    uint256 amount
);

event PrimarySalePurchased(
    uint256 indexed listingId,
    uint256 indexed propertyId,
    address indexed buyer,
    address seller,
    uint256 amount,
    uint256 priceWei
);

event SellerPaid(
    uint256 indexed listingId,
    address indexed seller,
    uint256 amountWei
);

event PrimarySaleCancelled(
    uint256 indexed listingId,
    uint256 indexed propertyId
);

event ListingStatusUpdated(
    uint256 indexed listingId,
    SaleStatus oldStatus,
    SaleStatus newStatus
);
```

---

## 27. Invariantes críticas

- [ ] `linkedValueUnits + freeValueUnits == totalValueUnits`.
- [ ] `propertyExists[propertyId] == true` para qualquer operação em imóvel.
- [ ] `listingExists[listingId] == true` para qualquer operação em listing.
- [ ] Cada imóvel tokenizado possui exatamente um NFT de Direito de Usufruto.
- [ ] `tokenId` do usufruto é igual ao `propertyId`.
- [ ] Cada imóvel possui exatamente uma posição de usufruto ativa.
- [ ] O Direito de Valor Vinculado não existe como ERC-20.
- [ ] O Direito de Valor Vinculado fica na `UsufructPosition`.
- [ ] O Direito de Valor Vinculado não pode ser vendido separadamente.
- [ ] O ERC-20 representa apenas o Direito de Valor Livre.
- [ ] O supply inicial do ERC-20 é igual a `freeValueUnits`.
- [ ] O ERC-20 usa `decimals = 0`.
- [ ] O NFT de usufruto é mintado para a proprietária.
- [ ] O ERC-20 de Direito de Valor Livre é mintado para a proprietária.
- [ ] Transferências diretas do ERC-20 são bloqueadas.
- [ ] `approve` do ERC-20 reverte.
- [ ] Transferências diretas do NFT são bloqueadas.
- [ ] `approve` e `setApprovalForAll` do NFT revertem.
- [ ] Ofertas travam tokens livres em `address(this)`.
- [ ] `activeEscrowedAmountByProperty` é igual à soma dos amounts das ofertas ativas.
- [ ] `totalFreeValueSoldByProperty` só aumenta em compras concluídas.
- [ ] Comprador só recebe tokens após pagar o preço exato.
- [ ] Listing muda para `Filled` antes de transferir ETH.
- [ ] Transferência de ETH com `call` reverte se falhar.
- [ ] Vendedora recebe ETH após compra bem-sucedida.
- [ ] Dados sensíveis não são gravados em texto aberto on-chain.
- [ ] On-chain armazena apenas hashes/referências.
- [ ] Valores fiduciários não afetam settlement on-chain.

---

## 28. Casos de erro esperados

### Registrar imóvel sem valor

```text
marketValueWei = 0
Resultado: revert INVALID_MARKET_VALUE
```

### Registrar imóvel com percentual vinculado inválido

```text
linkedValueBps = 0 ou >= 10.000
Resultado: revert INVALID_LINKED_VALUE_BPS
```

### Operar imóvel inexistente

```text
propertyExists[propertyId] = false
Resultado: revert PROPERTY_NOT_FOUND
```

### Operar listing inexistente

```text
listingExists[listingId] = false
Resultado: revert LISTING_NOT_FOUND
```

### Registrar imóvel sem hash de documentos

```text
documentsHash = 0x0
Resultado: revert INVALID_DOCUMENTS_HASH
```

### Tokenizar antes da verificação mock

```text
status = PendingMockVerification
Resultado: revert PROPERTY_NOT_MOCK_VERIFIED
```

### Criar oferta com mais tokens livres do que possui

```text
amount > balanceOf(seller)
Resultado: revert INSUFFICIENT_FREE_VALUE_BALANCE
```

### Criar oferta com preço calculado igual a zero

```text
priceWei == 0
Resultado: revert PRICE_ZERO
```

### Comprador tenta criar oferta

```text
msg.sender != property.owner
Resultado: revert ONLY_PROPERTY_OWNER
```

### Comprar oferta com ETH incorreto

```text
msg.value != priceWei
Resultado: revert INVALID_PAYMENT_AMOUNT
```

### ETH transfer falha

```text
seller.call falha
Resultado: revert ETH_TRANSFER_FAILED
```

### Transferir token diretamente

```text
wallet tenta transfer()
Resultado: revert TRANSFERS_DISABLED
```

### Aprovar token ERC-20

```text
wallet tenta approve()
Resultado: revert APPROVALS_DISABLED
```

### Transferir NFT diretamente

```text
wallet tenta transferFrom()
Resultado: revert TRANSFERS_DISABLED
```

### Aprovar NFT

```text
wallet tenta approve() ou setApprovalForAll()
Resultado: revert APPROVALS_DISABLED
```

---

## 29. Testes obrigatórios

### 29.1 `PropertyRegistry`

- [ ] Registra imóvel com parâmetros válidos.
- [ ] Reverte com valor de mercado zero.
- [ ] Reverte com `linkedValueBps` inválido.
- [ ] Reverte sem `metadataHash`.
- [ ] Reverte sem `documentsHash`.
- [ ] Reverte sem `locationHash`.
- [ ] Usa `nextPropertyId`.
- [ ] Define `propertyExists[propertyId] = true`.
- [ ] Reverte operações com property inexistente.
- [ ] Calcula `linkedValueUnits` corretamente.
- [ ] Calcula `freeValueUnits` corretamente.
- [ ] Garante `linkedValueUnits + freeValueUnits == totalValueUnits`.
- [ ] Define owner corretamente.
- [ ] Preenche `propertiesByOwner`.
- [ ] Adiciona owner como participante.
- [ ] Define status `PendingMockVerification`.
- [ ] Permite mock verification pelo owner.
- [ ] Permite mock verification por `MOCK_VERIFIER_ROLE`.
- [ ] Reverte mock verification por conta não autorizada.
- [ ] Reverte tokenização antes de mock verification.
- [ ] Tokeniza após mock verification.
- [ ] Cria `UsufructPosition`.
- [ ] Minta NFT com `tokenId = propertyId`.
- [ ] Cria `PropertyValueToken` via factory.
- [ ] Emite eventos obrigatórios.

---

### 29.2 `UsufructRightNFT`

- [ ] Minta NFT para proprietária.
- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] `tokenId == propertyId`.
- [ ] Bloqueia `transferFrom`.
- [ ] Bloqueia `safeTransferFrom`.
- [ ] Bloqueia `approve`.
- [ ] Bloqueia `setApprovalForAll`.
- [ ] Retorna owner correto.
- [ ] NFT permanece com proprietária após venda de valor livre.

---

### 29.3 `PropertyValueToken`

- [ ] Minta apenas `freeValueUnits` para proprietária.
- [ ] Não minta `totalValueUnits`.
- [ ] `decimals() == 0`.
- [ ] Bloqueia `transfer`.
- [ ] Bloqueia `transferFrom`.
- [ ] Bloqueia `approve`.
- [ ] Permite `platformTransferFrom` por operador autorizado.
- [ ] Reverte movimentação por operador não autorizado.
- [ ] Supply inicial é igual a `freeValueUnits`.
- [ ] `PrimaryValueSale` é operador autorizado.

---

### 29.4 `PropertyValueTokenFactory`

- [ ] Apenas `PropertyRegistry` chama `createPropertyValueToken`.
- [ ] Cria um token por imóvel.
- [ ] Token criado usa `decimals = 0`.
- [ ] Token criado já nasce com `PrimaryValueSale` como operador autorizado.
- [ ] Reverte chamada por conta não autorizada.

---

### 29.5 `PrimaryValueSale`

- [ ] Possui `nextListingId`.
- [ ] Define `listingExists`.
- [ ] Reverte operação com listing inexistente.
- [ ] Cria listing com saldo livre suficiente.
- [ ] Apenas owner do `PropertyRecord` cria listing.
- [ ] Comprador não consegue criar listing.
- [ ] Calcula `priceWei` automaticamente.
- [ ] Reverte se `priceWei == 0`.
- [ ] Trava tokens livres em `address(this)`.
- [ ] Atualiza `activeEscrowedAmountByProperty`.
- [ ] Atualiza `activeListingsCountByProperty`.
- [ ] Compra listing com valor correto.
- [ ] Reverte compra com valor incorreto.
- [ ] Muda listing para `Filled` antes de transferir ETH.
- [ ] Transfere ERC-20 livre para buyer.
- [ ] Transfere ETH para seller com `call`.
- [ ] Reverte se transferência de ETH falhar.
- [ ] Atualiza `totalFreeValueSoldByProperty`.
- [ ] Atualiza status para `Tokenized` quando não houver ofertas ativas.
- [ ] Atualiza status para `SoldOut` quando todo `freeValueUnits` for vendido.
- [ ] Não transfere NFT de usufruto.
- [ ] Não altera `linkedValueUnits`.
- [ ] Cancela listing ativa.
- [ ] Devolve tokens ao seller no cancelamento.
- [ ] Getters retornam listings por property.
- [ ] Getters retornam listings ativas.
- [ ] Emite eventos obrigatórios.

---

### 29.6 API `/api/fiat-rates`

- [ ] Usa OKX como provider.
- [ ] Chama `GET /api/v5/market/ticker?instId=<instId>`.
- [ ] Consulta `ETH-USDC`.
- [ ] Usa `data[0].last` como preço.
- [ ] Valida `code == "0"`.
- [ ] Valida `data` como array não vazio.
- [ ] Valida `data[0].last`.
- [ ] Valida `last > 0`.
- [ ] Consulta `USDC-BRL` em runtime.
- [ ] Calcula `ETH_BRL = ETH_USDC * USDC_BRL` quando `USDC-BRL` estiver disponível.
- [ ] Calcula `ETH_USD ≈ ETH_USDC`.
- [ ] Retorna USD quando `ETH-USDC` estiver válido.
- [ ] Marca BRL como indisponível se `USDC-BRL` falhar.
- [ ] Não bloqueia fluxo ETH quando BRL estiver indisponível.
- [ ] Retorna EUR apenas se rota opcional estiver configurada e funcional.
- [ ] Retorna JPY apenas se rota opcional estiver configurada e funcional.
- [ ] Respeita `FIAT_REQUEST_TIMEOUT_MS`.
- [ ] Respeita `FIAT_CACHE_TTL_SECONDS`.
- [ ] Respeita `FIAT_MAX_STALENESS_SECONDS`.
- [ ] Usa cache quando disponível e válido.
- [ ] Usa fallback de último valor válido se a OKX falhar e o cache estiver dentro do staleness máximo.
- [ ] Retorna erro padronizado se a OKX falhar e não houver cache válido dentro do staleness máximo.
- [ ] Retorna rates como strings decimais.
- [ ] Não usa `Number` para cálculos fiduciários.
- [ ] Usa decimal seguro para conversões.
- [ ] Testa resposta de sucesso.
- [ ] Testa cache hit.
- [ ] Testa fallback.
- [ ] Testa erro sem cache.
- [ ] Testa BRL indisponível sem bloquear USD.
- [ ] Testa ocultação de EUR/JPY quando as rotas opcionais não estiverem disponíveis.

---

### 29.7 Off-chain local e hashing

- [ ] Browser não escreve diretamente no `db.json`.
- [ ] API/server action escreve no lowdb.
- [ ] Hash usa `keccak256`.
- [ ] Hash usa stable JSON com chaves ordenadas.
- [ ] `metadataHash` inclui endereço textual.
- [ ] `locationHash` inclui apenas `lat` e `lng`.
- [ ] `lat` e `lng` são strings com 6 casas decimais.
- [ ] Hash de documentos usa metadata mockada, não binário.
- [ ] `uploadedAt` não entra no `documentsHash`.
- [ ] `uploadedAt` fica apenas no `db.json`.
- [ ] Schemas de metadata são fixos.
- [ ] Hash gerado é determinístico.

---

## 30. Milestones técnicos da Fase 0

---

### Milestone 0.1 — Setup técnico e Docker

**Objetivo:** preparar base de desenvolvimento, Docker, deploy e demo.

#### Checklist

- [x] Criar repositório.
- [x] Configurar Foundry fora do container app.
- [x] Configurar Next.js.
- [x] Configurar TypeScript.
- [x] Configurar Tailwind.
- [x] Configurar wagmi.
- [x] Configurar viem.
- [x] Configurar Sepolia.
- [x] Configurar Dockerfile do app.
- [x] Configurar Docker Compose.
- [x] Configurar volume para `offchain-db/db.json`.
- [x] Criar `.env.app`.
- [x] Criar `.env.deploy`.
- [x] Garantir que `DEPLOYER_PRIVATE_KEY` não entra no container app.
- [x] Criar estrutura de contratos.
- [x] Criar script de deploy Foundry.
- [x] Criar estrutura local de banco não estruturado.
- [x] Criar `db.json` local.
- [x] Criar utilitário de hash.
- [x] Criar utilitário de decimal seguro.
- [x] Conectar wallet no frontend.
- [x] Ler dado do contrato no frontend.

#### Critério de aceite

- [x] App roda via Docker.
- [x] Frontend abre localmente.
- [x] Usuário conecta wallet.
- [x] Frontend detecta Sepolia.
- [x] Frontend lê dado on-chain.
- [x] Frontend salva registro mockado via server-side local.
- [x] Deploy roda fora do container app.

#### Prioridade

P0

---

### Milestone 0.2 — Cotação fiduciária com OKX

**Objetivo:** exibir valores em moedas fiduciárias.

#### Checklist

- [x] Criar API `/api/fiat-rates`.
- [x] Consultar OKX server-side.
- [x] Suportar BRL e USD.
- [x] Implementar timeout.
- [x] Implementar cache de 60 segundos.
- [x] Implementar fallback de último valor válido.
- [x] Implementar erro padronizado.
- [x] Armazenar cache no lowdb.
- [x] Usar string decimal para rates.
- [x] Usar decimal seguro para cálculos.
- [x] Exibir valor da casa em BRL e USD.
- [x] Exibir preço da oferta em BRL e USD.
- [x] Exibir valor por unidade em BRL e USD.
- [x] Exibir aviso quando estiver usando fallback/cache.

#### Critério de aceite

- [x] UI mostra valores em ETH e USD, e BRL quando a rota estiver disponível.
- [x] API funciona com cache.
- [x] API lida com falha da OKX.
- [x] Testes P0 de cotação passam.

#### Prioridade

P0

---

### Milestone 0.3 — Off-chain local e upload mockado

**Objetivo:** permitir cadastro de dados do imóvel fora da blockchain.

#### Checklist

- [ ] Criar formulário de tokenização.
- [ ] Criar mock document upload.
- [ ] Criar schema local de propriedade.
- [ ] Salvar endereço no banco local via server-side.
- [ ] Salvar localização no banco local via server-side.
- [ ] Normalizar `lat` e `lng` como strings de 6 casas.
- [ ] Salvar valor de mercado no banco local.
- [ ] Salvar percentual vinculado ao usufruto.
- [ ] Salvar documentos mockados no banco local.
- [ ] Calcular `metadataHash`.
- [ ] Calcular `documentsHash`.
- [ ] Calcular `locationHash`.
- [ ] Exibir preview dos dados antes do registro on-chain.
- [ ] Exibir aviso de que documentos são mockados.

#### Critério de aceite

- [ ] Pessoa A preenche dados da casa.
- [ ] Pessoa A define percentual vinculado ao usufruto.
- [ ] Pessoa A faz upload mockado de documentos.
- [ ] Dados são salvos localmente via API/server action.
- [ ] Hashes são gerados de forma determinística.

#### Prioridade

P0

---

### Milestone 0.4 — Registro on-chain do imóvel

**Objetivo:** criar o registro on-chain com referências aos dados off-chain e parâmetros econômicos.

#### Checklist

- [ ] Implementar `PropertyRegistry`.
- [ ] Implementar `PropertyRecord`.
- [ ] Implementar `UsufructPosition`.
- [ ] Implementar `nextPropertyId`.
- [ ] Implementar `propertyExists`.
- [ ] Implementar `propertiesByOwner`.
- [ ] Implementar `participants`.
- [ ] Implementar `registerProperty`.
- [ ] Validar `marketValueWei`.
- [ ] Validar `linkedValueBps`.
- [ ] Validar `metadataHash`.
- [ ] Validar `documentsHash`.
- [ ] Validar `locationHash`.
- [ ] Calcular `linkedValueUnits`.
- [ ] Calcular `freeValueUnits`.
- [ ] Salvar owner.
- [ ] Salvar status `PendingMockVerification`.
- [ ] Adicionar owner em `propertiesByOwner`.
- [ ] Adicionar owner em `participants`.
- [ ] Emitir `PropertyRegistered`.
- [ ] Emitir `ParticipantAdded`.
- [ ] Criar chamada no frontend.
- [ ] Exibir `propertyId` criado.

#### Critério de aceite

- [ ] Pessoa A registra imóvel on-chain.
- [ ] Contrato armazena valor de mercado e hashes.
- [ ] Contrato calcula 20% vinculado e 80% livre no exemplo-base.
- [ ] `propertyExists[propertyId] == true`.
- [ ] Status inicial é `PendingMockVerification`.
- [ ] Dashboard mostra imóvel registrado.

#### Prioridade

P0

---

### Milestone 0.5 — Verificação mock

**Objetivo:** simular aprovação documental antes da tokenização.

#### Checklist

- [ ] Implementar `Ownable`.
- [ ] Implementar `AccessControl`.
- [ ] Implementar `MOCK_VERIFIER_ROLE`.
- [ ] Implementar `mockVerifyProperty`.
- [ ] Validar existência do imóvel.
- [ ] Validar status `PendingMockVerification`.
- [ ] Permitir mock verification pelo owner do imóvel.
- [ ] Permitir mock verification por `MOCK_VERIFIER_ROLE`.
- [ ] Reverter mock verification por conta não autorizada.
- [ ] Atualizar status para `MockVerified`.
- [ ] Emitir `PropertyMockVerified`.
- [ ] Emitir `PropertyStatusUpdated`.
- [ ] Criar botão “Aprovar documentos mock”.
- [ ] Exibir status no dashboard.

#### Critério de aceite

- [ ] Pessoa A registra imóvel.
- [ ] Pessoa A clica em “Aprovar documentos mock”.
- [ ] Status muda para `MockVerified`.
- [ ] Tokenização fica liberada.

#### Prioridade

P0

---

### Milestone 0.6 — Tokenização do imóvel

**Objetivo:** gerar NFT de usufruto, posição de valor vinculado e ERC-20 de valor livre.

#### Checklist

- [ ] Implementar `UsufructRightNFT`.
- [ ] Implementar `PropertyValueToken`.
- [ ] Implementar `PropertyValueTokenFactory`.
- [ ] Configurar factory com registry autorizado.
- [ ] Implementar `tokenizeProperty`.
- [ ] Validar status `MockVerified`.
- [ ] Mintar NFT de usufruto para Pessoa A.
- [ ] Garantir `tokenId = propertyId`.
- [ ] Criar `UsufructPosition` com `linkedValueUnits`.
- [ ] Criar ERC-20 via factory.
- [ ] Mintar apenas `freeValueUnits` em ERC-20 para Pessoa A.
- [ ] Garantir que o ERC-20 já nasce com `PrimaryValueSale` como operador autorizado.
- [ ] Garantir `decimals = 0`.
- [ ] Bloquear transferência direta do NFT.
- [ ] Bloquear aprovação e transferência direta do ERC-20.
- [ ] Atualizar status para `Tokenized`.
- [ ] Salvar endereço do token no `PropertyRecord`.
- [ ] Emitir `PropertyTokenized`.
- [ ] Emitir `PropertyValueTokenCreated`.
- [ ] Atualizar dashboard.

#### Critério de aceite

- [ ] Pessoa A tokeniza a casa.
- [ ] Pessoa A recebe NFT de Direito de Usufruto.
- [ ] Posição de usufruto mostra 200.000 unidades vinculadas no exemplo-base.
- [ ] Pessoa A recebe 800.000 tokens de Direito de Valor Livre no exemplo-base.
- [ ] Token de valor tem `decimals = 0`.
- [ ] Dashboard mostra tokenização concluída.

#### Prioridade

P0

---

### Milestone 0.7 — Dashboard da propriedade tokenizada

**Objetivo:** mostrar de forma clara a diferença entre usufruto, valor vinculado e valor livre.

#### Checklist

- [ ] Mostrar valor de mercado em ETH.
- [ ] Mostrar valor de mercado em BRL/USD.
- [ ] Mostrar owner.
- [ ] Mostrar status.
- [ ] Mostrar endereço off-chain.
- [ ] Mostrar localização off-chain.
- [ ] Mostrar `metadataHash`.
- [ ] Mostrar `documentsHash`.
- [ ] Mostrar `locationHash`.
- [ ] Mostrar NFT de usufruto.
- [ ] Mostrar titular do NFT.
- [ ] Mostrar unidades vinculadas ao usufruto.
- [ ] Mostrar percentual vinculado.
- [ ] Mostrar token de valor livre.
- [ ] Mostrar supply livre.
- [ ] Mostrar saldo livre da proprietária.
- [ ] Mostrar total econômico da proprietária.
- [ ] Mostrar participantes.
- [ ] Mostrar saldos de compradores após venda.
- [ ] Mostrar ofertas ativas.
- [ ] Mostrar tokens em escrow ativo.
- [ ] Mostrar explicação “Direito de Valor Livre não dá direito de uso”.

#### Critério de aceite

- [ ] Dashboard permite entender quem tem o usufruto.
- [ ] Dashboard permite entender quem tem valor vinculado.
- [ ] Dashboard permite entender quem tem valor livre.
- [ ] Dashboard mostra total econômico por pessoa.
- [ ] Dashboard mostra valores em ETH e fiduciário.

#### Prioridade

P0

---

### Milestone 0.8 — Criar oferta primária de Direito de Valor Livre

**Objetivo:** permitir que a proprietária defina quanto quer vender do valor livre.

#### Checklist

- [ ] Implementar `PrimaryValueSale`.
- [ ] Implementar `nextListingId`.
- [ ] Implementar `listingExists`.
- [ ] Implementar `listingIds`.
- [ ] Implementar `listingsByProperty`.
- [ ] Implementar `activeListingsCountByProperty`.
- [ ] Implementar `activeEscrowedAmountByProperty`.
- [ ] Implementar `totalFreeValueSoldByProperty`.
- [ ] Implementar `createPrimarySaleListing`.
- [ ] Validar imóvel `Tokenized` ou `ActiveSale`.
- [ ] Validar `msg.sender == property.owner`.
- [ ] Validar saldo livre suficiente.
- [ ] Validar `amount > 0`.
- [ ] Calcular `priceWei` automaticamente.
- [ ] Validar `priceWei > 0`.
- [ ] Travar tokens livres em `address(this)`.
- [ ] Criar listing.
- [ ] Atualizar status para `Active`.
- [ ] Atualizar status do imóvel.
- [ ] Emitir `PrimarySaleListed`.
- [ ] Emitir `TokensEscrowed`.
- [ ] Criar formulário no frontend.
- [ ] Mostrar percentual equivalente do valor econômico total.
- [ ] Mostrar preço calculado em ETH.
- [ ] Mostrar preço calculado em fiduciário.
- [ ] Mostrar preview da venda.
- [ ] Mostrar que NFT de usufruto não será transferido.
- [ ] Mostrar que valor vinculado não será transferido.

#### Critério de aceite

- [ ] Pessoa A define vender 300.000 tokens livres.
- [ ] Sistema mostra que isso equivale a 30% do valor econômico total.
- [ ] Contrato calcula preço de 3 ETH para casa de 10 ETH.
- [ ] UI mostra equivalente em BRL/USD.
- [ ] Tokens livres são travados em escrow.
- [ ] Oferta aparece no marketplace.

#### Prioridade

P0

---

### Milestone 0.9 — Comprar Direito de Valor Livre

**Objetivo:** permitir que comprador compre a oferta e vendedora receba ETH.

#### Checklist

- [ ] Implementar `buyPrimarySaleListing`.
- [ ] Usar `nonReentrant`.
- [ ] Validar `listingExists`.
- [ ] Validar listing ativo.
- [ ] Validar `msg.value == priceWei`.
- [ ] Validar comprador diferente do seller.
- [ ] Mudar listing para `Filled` antes de transferir ETH.
- [ ] Atualizar `activeListingsCountByProperty`.
- [ ] Atualizar `activeEscrowedAmountByProperty`.
- [ ] Atualizar `totalFreeValueSoldByProperty`.
- [ ] Atualizar status do imóvel.
- [ ] Transferir tokens livres de `address(this)` para comprador.
- [ ] Transferir ETH para seller com `call`.
- [ ] Reverter se `call` falhar.
- [ ] Registrar comprador em `participants`.
- [ ] Emitir `ListingStatusUpdated`.
- [ ] Emitir `PrimarySalePurchased`.
- [ ] Emitir `SellerPaid`.
- [ ] Emitir `ParticipantAdded` se aplicável.
- [ ] Atualizar dashboard.
- [ ] Mostrar saldo do comprador.
- [ ] Mostrar ETH recebido pela vendedora.
- [ ] Bloquear compra duplicada.

#### Critério de aceite

- [ ] Pessoa B compra 300.000 tokens por 3 ETH.
- [ ] Pessoa A recebe 3 ETH na wallet.
- [ ] Pessoa B recebe 300.000 tokens de Direito de Valor Livre.
- [ ] Pessoa A continua com NFT de usufruto.
- [ ] Pessoa A continua com 200.000 unidades vinculadas.
- [ ] Dashboard mostra A com 70% econômico total e B com 30%.
- [ ] Status volta para `Tokenized` se não houver ofertas ativas.
- [ ] Status vira `SoldOut` se todo valor livre foi vendido.

#### Prioridade

P0

---

### Milestone 0.10 — Cancelar oferta

**Objetivo:** permitir cancelamento seguro de oferta ativa.

#### Checklist

- [ ] Implementar `cancelPrimarySaleListing`.
- [ ] Usar `nonReentrant`.
- [ ] Validar `listingExists`.
- [ ] Validar listing ativo.
- [ ] Validar `msg.sender == seller`.
- [ ] Mudar listing para `Cancelled`.
- [ ] Atualizar `activeListingsCountByProperty`.
- [ ] Atualizar `activeEscrowedAmountByProperty`.
- [ ] Devolver tokens livres para seller.
- [ ] Atualizar status do imóvel.
- [ ] Emitir `PrimarySaleCancelled`.
- [ ] Emitir `ListingStatusUpdated`.
- [ ] Atualizar marketplace no frontend.

#### Critério de aceite

- [ ] Pessoa A cancela oferta ativa.
- [ ] Tokens em escrow voltam para Pessoa A.
- [ ] Listing vira `Cancelled`.
- [ ] Status volta para `Tokenized` se não houver ofertas ativas.

#### Prioridade

P0

---

### Milestone 0.11 — Restrições de transferência

**Objetivo:** garantir que os ativos só sejam transferidos pela plataforma.

#### Checklist

- [ ] Bloquear `transfer` direto do ERC-20.
- [ ] Bloquear `transferFrom` direto do ERC-20.
- [ ] Bloquear `approve` do ERC-20.
- [ ] Bloquear `transferFrom` direto do NFT.
- [ ] Bloquear `safeTransferFrom` direto do NFT.
- [ ] Bloquear `approve` do NFT.
- [ ] Bloquear `setApprovalForAll` do NFT.
- [ ] Permitir transferência do ERC-20 por `PrimaryValueSale`.
- [ ] Testar operador autorizado.
- [ ] Testar operador não autorizado.
- [ ] Exibir mensagem na UI explicando restrição.

#### Critério de aceite

- [ ] Transferência direta do token reverte.
- [ ] Aprovação do token reverte.
- [ ] Transferência direta do NFT reverte.
- [ ] Aprovação do NFT reverte.
- [ ] Compra via marketplace funciona.

#### Prioridade

P0

---

### Milestone 0.12 — Frontend e demo guiada

**Objetivo:** garantir que a banca entenda o fluxo rapidamente.

#### Checklist

- [ ] Criar home com explicação da tese.
- [ ] Criar tela “Tokenizar minha casa”.
- [ ] Criar mock upload.
- [ ] Criar tela de status de verificação mock.
- [ ] Criar tela de tokenização.
- [ ] Criar seção explicando os três direitos.
- [ ] Criar dashboard do imóvel.
- [ ] Criar formulário de venda de Direito de Valor Livre.
- [ ] Criar marketplace de Direito de Valor Livre.
- [ ] Criar visual de distribuição econômica.
- [ ] Criar visual de valores fiduciários.
- [ ] Criar modo demo guiado.
- [ ] Criar personagens: Pessoa A e Pessoa B.
- [ ] Criar feedback de transação enviada.
- [ ] Criar feedback de transação confirmada.
- [ ] Criar estados de erro.
- [ ] Criar estados de loading.
- [ ] Criar estado de falha de cotação fiduciária.
- [ ] Criar estado de fallback de cotação fiduciária.

#### Critério de aceite

- [ ] Demo completa pode ser apresentada em até 5 minutos.
- [ ] Fluxo de tokenização é compreensível.
- [ ] Fluxo de venda de valor livre é compreensível.
- [ ] Banca entende que A mantém usufruto e valor vinculado.
- [ ] Banca entende que B compra apenas Direito de Valor Livre.
- [ ] Banca entende valores em ETH e moedas fiduciárias.

#### Prioridade

P0

---

### Milestone 0.13 — Testes e preparação da apresentação

**Objetivo:** reduzir risco de falha durante a demo.

#### Checklist

- [ ] Criar testes unitários.
- [ ] Criar testes de integração.
- [ ] Testar registro do imóvel.
- [ ] Testar `propertyExists`.
- [ ] Testar cálculo de `linkedValueUnits`.
- [ ] Testar cálculo de `freeValueUnits`.
- [ ] Testar mock verification.
- [ ] Testar tokenização.
- [ ] Testar mint do NFT.
- [ ] Testar criação da `UsufructPosition`.
- [ ] Testar mint do ERC-20 livre.
- [ ] Testar `decimals = 0`.
- [ ] Testar bloqueio de transferência direta.
- [ ] Testar factory autorizada.
- [ ] Testar criação de oferta.
- [ ] Testar `listingExists`.
- [ ] Testar preço proporcional.
- [ ] Testar `priceWei > 0`.
- [ ] Testar escrow em `address(this)`.
- [ ] Testar compra da oferta.
- [ ] Testar mudança para `Filled` antes de interações.
- [ ] Testar pagamento para seller.
- [ ] Testar revert em falha de ETH transfer.
- [ ] Testar recebimento de tokens pelo comprador.
- [ ] Testar participantes.
- [ ] Testar status `Tokenized`, `ActiveSale` e `SoldOut`.
- [ ] Testar cancelamento de oferta.
- [ ] Testar API `/api/fiat-rates`.
- [ ] Testar cache de cotação.
- [ ] Testar fallback de cotação.
- [ ] Testar erro sem cache.
- [ ] Testar hashing determinístico.
- [ ] Testar deploy na Sepolia.
- [ ] Testar app via Docker.
- [ ] Preparar wallets de demo.
- [ ] Preparar ETH de Sepolia nas wallets.
- [ ] Preparar roteiro de apresentação.
- [ ] Preparar fallback de demo.

#### Critério de aceite

- [ ] Testes críticos passam.
- [ ] Contratos estão deployados na Sepolia.
- [ ] App roda via Docker.
- [ ] Banco local está preparado.
- [ ] OKX/cache está funcional.
- [ ] Wallets de demo têm ETH de Sepolia.
- [ ] Roteiro da demo foi validado.

#### Prioridade

P0

---

## 31. Priorização da Fase 0

### P0 — Obrigatório

- [ ] Docker/local Node.js.
- [ ] Deploy Foundry fora do container app.
- [ ] `.env.app` sem chave privada.
- [ ] Banco local não estruturado via server-side.
- [ ] OKX com cache, timeout e fallback.
- [ ] Hashing determinístico.
- [ ] Upload mockado de documentos.
- [ ] Registro on-chain do imóvel.
- [ ] `propertyExists`.
- [ ] Verificação mock.
- [ ] Tokenização.
- [ ] NFT de usufruto único.
- [ ] Posição de valor vinculado.
- [ ] ERC-20 de Direito de Valor Livre via factory.
- [ ] `decimals = 0`.
- [ ] Dashboard com separação clara dos direitos.
- [ ] Oferta primária de Direito de Valor Livre.
- [ ] Preço proporcional automático.
- [ ] `listingExists`.
- [ ] Listagens enumeráveis.
- [ ] Escrow em `address(this)`.
- [ ] Compra da oferta.
- [ ] Pagamento em ETH para vendedora.
- [ ] Revert em falha de ETH transfer.
- [ ] Restrições de transferência e approve.
- [ ] Status `Tokenized`, `ActiveSale`, `SoldOut`.
- [ ] Demo guiada.
- [ ] Testes críticos.

---

## 32. Sequência final da demo

1. Pessoa A inicia a aplicação local via Docker.
2. Pessoa A conecta wallet.
3. Pessoa A acessa “Tokenizar minha casa”.
4. Pessoa A insere valor de mercado: 10 ETH.
5. UI mostra valor aproximado em USD e, se disponível, BRL.
6. Pessoa A define valor vinculado ao usufruto: 20%.
7. Pessoa A insere endereço e localização.
8. Pessoa A envia documentos mockados.
9. Dados são salvos no banco local via server-side.
10. Hashes são gerados com `keccak256` sobre JSON estável.
11. Pessoa A registra imóvel on-chain.
12. `propertyExists[propertyId]` é definido.
13. Pessoa A aprova mock verification.
14. Pessoa A tokeniza imóvel.
15. Sistema gera NFT de usufruto para Pessoa A com `tokenId = propertyId`.
16. Sistema cria posição de usufruto com 200.000 unidades vinculadas.
17. Sistema gera 800.000 tokens de Direito de Valor Livre para Pessoa A.
18. Pessoa A define venda de 300.000 tokens livres.
19. Contrato calcula preço automático de 3 ETH.
20. UI mostra preço equivalente em USD e, se disponível, BRL.
21. Tokens livres são movidos para escrow em `PrimaryValueSale`.
22. Pessoa B compra a oferta pagando 3 ETH.
23. Listing muda para `Filled`.
24. Pessoa B recebe 300.000 tokens livres.
25. Pessoa A recebe 3 ETH.
26. Pessoa B é adicionada como participante.
27. Dashboard mostra:
    - Pessoa A mantém usufruto;
    - Pessoa A mantém 20% vinculado;
    - Pessoa A mantém 50% livre;
    - Pessoa A tem 70% econômico total;
    - Pessoa B possui 30% econômico total;
    - Pessoa B não possui direito de uso;
    - valores aparecem em ETH, USD e, quando disponível, BRL.

---

## 33. Definição de pronto da Fase 0

A Fase 0 está pronta quando:

- [ ] App roda localmente via Docker.
- [ ] Foundry/deploy roda fora do container app.
- [ ] `.env.app` não contém chave privada.
- [ ] Wallet conecta.
- [ ] Dados mockados são salvos localmente via server-side.
- [ ] Hashes são gerados de forma determinística.
- [ ] API OKX funciona com cache, timeout e fallback.
- [ ] Valores fiduciários aparecem na UI em USD e, quando disponível, BRL.
- [ ] Imóvel é registrado on-chain.
- [ ] `propertyExists` funciona.
- [ ] Verificação mock funciona.
- [ ] Imóvel é tokenizado.
- [ ] NFT de usufruto é mintado para a proprietária.
- [ ] `tokenId = propertyId`.
- [ ] Posição de valor vinculado é criada.
- [ ] ERC-20 de Direito de Valor Livre é criado via factory.
- [ ] ERC-20 usa `decimals = 0`.
- [ ] ERC-20 minta apenas `freeValueUnits`.
- [ ] Proprietária cria oferta de venda de valor livre.
- [ ] Preço da oferta é calculado automaticamente.
- [ ] `priceWei > 0` é validado.
- [ ] `listingExists` funciona.
- [ ] Tokens livres são travados em `address(this)`.
- [ ] Comprador compra oferta.
- [ ] Listing muda para `Filled` antes de transferir ETH.
- [ ] Vendedora recebe ETH.
- [ ] Falha de ETH transfer reverte.
- [ ] Comprador recebe Direito de Valor Livre.
- [ ] Participantes são listáveis.
- [ ] NFT de usufruto não é transferido.
- [ ] Valor vinculado não é transferido.
- [ ] Status do imóvel atualiza corretamente.
- [ ] Dashboard mostra distribuição correta.
- [ ] Transferências diretas são bloqueadas.
- [ ] `approve` reverte nos tokens restritos.
- [ ] Testes críticos passam.
- [ ] Demo guiada funciona.
