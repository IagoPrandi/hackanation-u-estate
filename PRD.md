# PRD TÃ©cnico â€” Usufruct Protocol

**Fase:** 0 â€” Hackathon MVP  
**VersÃ£o:** PRD refinado com Docker, OKX, escrow explÃ­cito, preÃ§o proporcional e mappings de existÃªncia  
**Rede:** Ethereum Sepolia  
**Smart contracts:** Solidity  
**Framework de contratos:** Foundry, executado fora do container da aplicaÃ§Ã£o  
**AplicaÃ§Ã£o:** Next.js + TypeScript + Tailwind rodando localmente em Node.js via Docker  
**Web3:** wagmi + viem  
**Pagamento no MVP:** ETH nativo  
**Dados off-chain:** banco local nÃ£o estruturado via lowdb  
**Documentos:** mockados  
**CotaÃ§Ã£o fiduciÃ¡ria:** OKX via API server-side local  

---

## 1. Objetivo da Fase 0

A Fase 0 deve demonstrar o seguinte fluxo:

1. Uma pessoa possui uma casa no mundo real.
2. Essa pessoa tokeniza a casa na plataforma.
3. Ela envia documentos mockados.
4. Ela informa valor de mercado, endereÃ§o e localizaÃ§Ã£o exata.
5. Os dados sensÃ­veis ficam salvos off-chain em banco local nÃ£o estruturado.
6. Hashes/referÃªncias dos dados sÃ£o registrados on-chain.
7. O sistema gera:
   - um token de Direito de Usufruto;
   - uma posiÃ§Ã£o de Direito de Valor Vinculado ao usufruto;
   - tokens de Direito de Valor Livre.
8. A proprietÃ¡ria fica com o Direito de Usufruto.
9. A proprietÃ¡ria fica com o Direito de Valor Vinculado.
10. A proprietÃ¡ria recebe os tokens de Direito de Valor Livre.
11. A proprietÃ¡ria escolhe quanto do Direito de Valor Livre quer vender.
12. O contrato calcula automaticamente o preÃ§o proporcional da oferta em ETH.
13. Uma pessoa compra esse Direito de Valor Livre.
14. A vendedora recebe ETH na wallet.
15. O comprador recebe tokens de Direito de Valor Livre.
16. A interface exibe valores em ETH e equivalentes fiduciÃ¡rios em BRL e USD.

A tese demonstrada Ã©:

> A proprietÃ¡ria mantÃ©m o direito de uso da casa e uma participaÃ§Ã£o econÃ´mica vinculada ao usufruto, enquanto vende parte do valor livre do imÃ³vel para captar liquidez.

---

## 2. DecisÃµes tÃ©cnicas fechadas

| Tema | DecisÃ£o |
|---|---|
| Rede | Ethereum Sepolia |
| Smart contracts | Solidity |
| Framework de contratos | Foundry |
| ExecuÃ§Ã£o de deploy | Fora do container app |
| AplicaÃ§Ã£o | Next.js local em Node.js |
| ContainerizaÃ§Ã£o | Docker / Docker Compose |
| Web3 client | wagmi + viem |
| Pagamento | ETH nativo |
| CotaÃ§Ã£o fiduciÃ¡ria | OKX via API server-side local |
| Rota principal de cotaÃ§Ã£o | ETH â†’ USDC â†’ BRL |
| USD | AproximaÃ§Ã£o via ETH/USDC |
| BRL | ETH/USDC Ã— USDC/BRL |
| EUR/JPY | Suporte condicional se houver rota OKX pÃºblica configurada |
| Documentos | Mockados |
| Armazenamento off-chain | lowdb em `db.json` |
| Escrita no banco local | Apenas via camada server-side local |
| Token de usufruto | ERC-721 restrito |
| Contrato de usufruto | Contrato Ãºnico `UsufructRightNFT` |
| `tokenId` do usufruto | Igual ao `propertyId` |
| Direito de Valor Vinculado | Campo interno da posiÃ§Ã£o de usufruto |
| Direito de Valor Livre | ERC-20 restrito por imÃ³vel |
| CriaÃ§Ã£o do ERC-20 | `PropertyValueTokenFactory` |
| `decimals` do ERC-20 | `0` |
| TransferÃªncia do Direito de Valor Livre | Apenas dentro da plataforma |
| Marketplace interno | Listing simples |
| Compra parcial da oferta | NÃ£o implementada na Fase 0 |
| Compra da oferta | Compra total |
| PreÃ§o da oferta | Calculado automaticamente de forma proporcional |
| VerificaÃ§Ã£o documental | Mockada |
| TransferÃªncia direta do ERC-20 | Reverte |
| `approve` do ERC-20 | Reverte |
| TransferÃªncia direta do ERC-721 | Reverte |
| `approve` / `setApprovalForAll` do ERC-721 | Revertem |
| Compradores podem revender na Fase 0 | NÃ£o |
| `Paused` | NÃ£o usado na Fase 0 |

---

## 3. ExecuÃ§Ã£o local com Docker

A aplicaÃ§Ã£o deve rodar localmente via Docker/Docker Compose.

### 3.1 Container `app`

ResponsÃ¡vel por:

- executar a aplicaÃ§Ã£o Next.js;
- expor a interface local;
- executar API routes/server actions;
- gravar e ler o banco local `db.json`;
- consultar OKX via server-side;
- expor dados para o frontend.

O container `app` **nÃ£o** executa deploy de contratos.

O container `app` **nÃ£o** contÃ©m `DEPLOYER_PRIVATE_KEY`.

### 3.2 Foundry/deploy

Foundry roda fora do container `app`.

O deploy pode ser executado:

- diretamente no host local do desenvolvedor; ou
- em um container separado de contratos, se a equipe desejar.

O ambiente de deploy possui `.env.deploy` prÃ³prio.

### 3.3 PersistÃªncia local

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

## 4. VariÃ¡veis de ambiente

A Fase 0 deve separar variÃ¡veis da aplicaÃ§Ã£o e variÃ¡veis de deploy.

### 4.1 `.env.app`

Usado pelo container Next.js.

NÃ£o deve conter chave privada.

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

### 4.3 Regra obrigatÃ³ria

```text
DEPLOYER_PRIVATE_KEY nunca deve entrar no .env.app nem na imagem Docker da aplicaÃ§Ã£o.
```

---

## 5. Ordem de deploy e configuraÃ§Ã£o

### 5.1 Ordem de deploy

1. Deploy `UsufructRightNFT`.
2. Deploy `PropertyValueTokenFactory`.
3. Deploy `PropertyRegistry`.
4. Deploy `PrimaryValueSale`.
5. Configurar `PropertyRegistry` com:
   - endereÃ§o de `UsufructRightNFT`;
   - endereÃ§o de `PropertyValueTokenFactory`;
   - endereÃ§o de `PrimaryValueSale`.
6. Configurar `UsufructRightNFT`:
   - `PropertyRegistry` como Ãºnico minter;
   - operadores autorizados apenas se necessÃ¡rios.
7. Configurar `PropertyValueTokenFactory`:
   - `PropertyRegistry` como Ãºnico caller autorizado.
8. Configurar `PrimaryValueSale`:
   - endereÃ§o de `PropertyRegistry`.
9. Durante `tokenizeProperty`, cada `PropertyValueToken` criado deve autorizar `PrimaryValueSale` como operador.

### 5.2 Responsabilidades por contrato

| Contrato | Responsabilidade de configuraÃ§Ã£o |
|---|---|
| `PropertyRegistry` | owner/admin configura endereÃ§os externos |
| `UsufructRightNFT` | owner/admin configura minter e operadores |
| `PropertyValueTokenFactory` | owner/admin configura registry autorizado |
| `PropertyValueToken` | factory/admin configura operador inicial |
| `PrimaryValueSale` | usa registry para validar imÃ³vel, owner e token |

---

## 6. Modelo econÃ´mico da Fase 0

Cada imÃ³vel tokenizado serÃ¡ representado economicamente por um total fixo de unidades inteiras.

```solidity
uint256 constant TOTAL_VALUE_UNITS = 1_000_000;
uint16 constant BPS_DENOMINATOR = 10_000;
```

Exemplo-base:

| Componente | Percentual | Unidades |
|---|---:|---:|
| Valor econÃ´mico total | 100% | 1.000.000 |
| Direito de Valor Vinculado ao usufruto | 20% | 200.000 |
| Direito de Valor Livre | 80% | 800.000 |

No MVP:

```text
Total econÃ´mico = Direito de Valor Vinculado + Direito de Valor Livre
1.000.000 = 200.000 + 800.000
```

A proprietÃ¡ria recebe:

```text
1 NFT de usufruto
+ 200.000 unidades vinculadas dentro da posiÃ§Ã£o de usufruto
+ 800.000 tokens ERC-20 de Direito de Valor Livre
```

Todas as quantidades sÃ£o inteiras.

O `PropertyValueToken` usa `decimals = 0`.

---

## 7. DiferenÃ§a entre os tipos de direito

### 7.1 Direito de Usufruto

O Direito de Usufruto representa o direito de uso da casa.

Na Fase 0:

- Ã© representado por um ERC-721 restrito;
- existe um Ãºnico contrato `UsufructRightNFT`;
- cada imÃ³vel tokenizado tem `tokenId = propertyId`;
- o NFT Ã© mintado para a proprietÃ¡ria;
- nÃ£o Ã© vendido;
- nÃ£o pode ser transferido diretamente pela wallet;
- carrega uma posiÃ§Ã£o interna com o Direito de Valor Vinculado.

---

### 7.2 Direito de Valor Vinculado ao Usufruto

O Direito de Valor Vinculado Ã© a participaÃ§Ã£o econÃ´mica que fica presa ao usufruto.

Ele **nÃ£o Ã© ERC-20**.

Ele **nÃ£o Ã© um token separado**.

Ele Ã© um campo interno da posiÃ§Ã£o de usufruto associada ao NFT.

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
O Direito de Valor Vinculado nÃ£o pode ser vendido separadamente.
Ele sÃ³ se move junto com o NFT de usufruto.
```

Na Fase 0, como o NFT de usufruto nÃ£o Ã© vendido, o Direito de Valor Vinculado permanece com a proprietÃ¡ria.

---

### 7.3 Direito de Valor Livre

O Direito de Valor Livre representa a parte econÃ´mica negociÃ¡vel do imÃ³vel.

Na Fase 0:

- Ã© representado por ERC-20 restrito;
- cada imÃ³vel tem seu prÃ³prio ERC-20;
- o ERC-20 Ã© criado por `PropertyValueTokenFactory`;
- o supply mintado equivale apenas ao Direito de Valor Livre;
- no exemplo-base, o supply Ã© 800.000 unidades;
- `decimals = 0`;
- pode ser vendido dentro da plataforma;
- nÃ£o dÃ¡ direito de uso da casa;
- nÃ£o pode ser transferido diretamente pela wallet;
- compradores nÃ£o podem revender tokens na Fase 0.

Exemplo:

```text
ImÃ³vel com 1.000.000 unidades econÃ´micas totais

200.000 unidades = valor vinculado ao usufruto
800.000 unidades = valor livre em ERC-20
```

---

## 8. Tabela comparativa dos direitos

| Direito | ImplementaÃ§Ã£o | FungÃ­vel? | TransferÃ­vel separadamente? | Fica com quem inicialmente? | Representa |
|---|---|---:|---:|---|---|
| Direito de Usufruto | ERC-721 restrito | NÃ£o | NÃ£o na Fase 0 | ProprietÃ¡ria | Uso da casa |
| Direito de Valor Vinculado | Campo interno da posiÃ§Ã£o de usufruto | NÃ£o como token | NÃ£o | ProprietÃ¡ria | FraÃ§Ã£o econÃ´mica presa ao usufruto |
| Direito de Valor Livre | ERC-20 restrito | Sim | Sim, via plataforma | ProprietÃ¡ria | FraÃ§Ã£o econÃ´mica negociÃ¡vel |

---

## 9. Exemplo completo da distribuiÃ§Ã£o inicial

Casa com valor de mercado informado de 10 ETH.

ParÃ¢metros:

```text
Valor econÃ´mico total = 1.000.000 unidades
Direito de Valor Vinculado = 200.000 unidades
Direito de Valor Livre = 800.000 unidades
```

ApÃ³s tokenizaÃ§Ã£o:

| Pessoa | Usufruto | Valor Vinculado | Valor Livre | Total econÃ´mico |
|---|---:|---:|---:|---:|
| Pessoa A | Sim | 20% | 80% | 100% |

RepresentaÃ§Ã£o tÃ©cnica:

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
300.000 unidades = 30% do valor econÃ´mico total
```

Casa informada em 10 ETH.

PreÃ§o automÃ¡tico:

```text
priceWei = marketValueWei * amount / totalValueUnits
priceWei = 10 ETH * 300.000 / 1.000.000
priceWei = 3 ETH
```

Pessoa B compra a oferta.

Resultado:

| Pessoa | Usufruto | Valor Vinculado | Valor Livre | Total econÃ´mico |
|---|---:|---:|---:|---:|
| Pessoa A | Sim | 20% | 50% | 70% |
| Pessoa B | NÃ£o | 0% | 30% | 30% |

InterpretaÃ§Ã£o:

```text
Pessoa A continua podendo usar a casa.
Pessoa A mantÃ©m 70% do valor econÃ´mico total.
Pessoa B possui 30% do valor econÃ´mico total.
Pessoa B nÃ£o tem direito de uso da casa.
```

---

## 11. Arquitetura da Fase 0

```text
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Browser                              â”‚
â”‚ Interface Next.js                    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                   â”‚
                   â”‚ chama server-side local
                   â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Container app                         â”‚
â”‚ Node.js + Next.js                     â”‚
â”‚ API routes/server actions             â”‚
â”‚ lowdb + OKX client              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                   â”‚
                   â”‚ persiste dados mockados
                   â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Volume Docker                         â”‚
â”‚ /app/offchain-db/db.json              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                   â”‚
                   â”‚ hashes/referÃªncias
                   â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Smart Contracts Sepolia               â”‚
â”‚ Solidity                              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                   â”‚
                   â”‚ ETH
                   â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Wallets                               â”‚
â”‚ vendedora / comprador                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 12. Dados off-chain

### 12.1 Dados armazenados localmente

Os seguintes dados ficam off-chain:

- documentos mockados;
- endereÃ§o completo;
- localizaÃ§Ã£o exata;
- descriÃ§Ã£o do imÃ³vel;
- imagens mockadas, se usadas;
- dados auxiliares de onboarding.

### 12.2 Escrita server-side

O browser nunca grava diretamente no `db.json`.

Toda escrita deve passar por:

```text
Browser
â†“
API route ou server action local
â†“
lowdb
â†“
db.json
```

### 12.3 Banco local nÃ£o estruturado

RecomendaÃ§Ã£o:

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
        "city": "SÃ£o Paulo",
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

O input do hash deve ser um JSON estÃ¡vel:

- chaves ordenadas alfabeticamente;
- encoding UTF-8;
- sem campos volÃ¡teis nÃ£o determinÃ­sticos;
- strings normalizadas;
- mesma estrutura para frontend e server-side.

### 13.3 SeparaÃ§Ã£o dos hashes

O PRD usa trÃªs hashes com responsabilidades diferentes:

| Hash | ConteÃºdo |
|---|---|
| `metadataHash` | dados textuais do imÃ³vel, valor de mercado, percentual vinculado e endereÃ§o textual |
| `documentsHash` | metadata mockada dos documentos, sem hash de binÃ¡rio e sem `uploadedAt` |
| `locationHash` | apenas latitude e longitude normalizadas |

### 13.4 Metadata textual do imÃ³vel

`metadataHash` deve incluir o endereÃ§o textual.

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

CÃ¡lculo:

```text
metadataHash = keccak256(stableJson(PropertyMetadata))
```

### 13.5 LocalizaÃ§Ã£o

`locationHash` deve incluir apenas `lat` e `lng`.

`lat` e `lng` devem ser strings normalizadas com 6 casas decimais.

NÃ£o usar `number` para `lat`/`lng`.

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

CÃ¡lculo:

```text
locationHash = keccak256(stableJson(LocationMetadata))
```

### 13.6 Documentos mockados

`documentsHash` deve ser calculado sobre a metadata mockada dos documentos, nÃ£o sobre o arquivo binÃ¡rio.

`uploadedAt` nÃ£o entra no `documentsHash`.

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

CÃ¡lculo:

```text
documentsHash = keccak256(stableJson(DocumentsHashMetadata))
```

### 13.7 Exemplo de campo permitido apenas no banco local

O banco local pode armazenar `uploadedAt`, mas esse campo nÃ£o entra no hash.

```json
{
  "type": "mock_deed",
  "filename": "mock_matricula.pdf",
  "mock": true,
  "uploadedAt": "2026-04-29T12:00:00.000Z"
}
```

---

## 14. CotaÃ§Ã£o fiduciÃ¡ria com OKX

### 14.1 Objetivo

A interface deve exibir equivalentes fiduciÃ¡rios para valores em ETH.

A Fase 0 deve priorizar:

- BRL;
- USD.

EUR e JPY podem aparecer na UI somente se houver rota pÃºblica OKX configurada e funcional no ambiente local. Caso contrÃ¡rio, a UI deve ocultar essas moedas sem quebrar o fluxo principal.

### 14.2 Regra de arquitetura

O frontend nÃ£o chama a OKX diretamente.

Fluxo:

```text
Frontend
â†“
/api/fiat-rates
â†“
server-side local
â†“
OKX
â†“
cache local
â†“
frontend
```

A API local Ã© responsÃ¡vel por:

- consultar a OKX;
- aplicar timeout;
- validar a resposta da OKX;
- normalizar a resposta;
- calcular rotas;
- armazenar cache;
- aplicar limite mÃ¡ximo de staleness no fallback;
- retornar erro padronizado;
- nunca usar valores fiduciÃ¡rios para settlement on-chain.

### 14.3 Endpoint OKX obrigatÃ³rio

A Fase 0 deve usar o endpoint pÃºblico de ticker da OKX:

```text
GET /api/v5/market/ticker?instId=<instId>
```

Base URL configurÃ¡vel:

```text
OKX_API_BASE_URL=https://www.okx.com
```

Exemplos de `instId`:

```text
ETH-USDC
USDC-BRL
```

### 14.4 Campo usado como preÃ§o

A API local deve usar:

```text
data[0].last
```

como preÃ§o informativo da rota consultada.

Esse preÃ§o Ã© apenas informativo para UI.

Ele nÃ£o Ã© preÃ§o garantido de execuÃ§Ã£o e nÃ£o Ã© usado pelo contrato.

### 14.5 ValidaÃ§Ã£o da resposta OKX

A resposta da OKX sÃ³ Ã© vÃ¡lida se todas as condiÃ§Ãµes abaixo forem verdadeiras:

- `code == "0"`;
- `data` existe;
- `data` Ã© array nÃ£o vazio;
- `data[0].last` existe;
- `data[0].last` Ã© decimal vÃ¡lido;
- `data[0].last > 0`.

Se qualquer uma dessas validaÃ§Ãµes falhar, a rota consultada deve ser considerada indisponÃ­vel.

FunÃ§Ã£o conceitual:

```ts
async function fetchOkxTickerLast(instId: string): Promise<Decimal>;
```

### 14.6 Fonte primÃ¡ria

Provider:

```text
OKX
```

A fonte primÃ¡ria de preÃ§o cripto serÃ¡:

```text
ETH-USDC
```

A rota principal para BRL serÃ¡:

```text
ETH â†’ USDC â†’ BRL
```

FÃ³rmula:

```text
ETH_BRL = ETH_USDC * USDC_BRL
```

Para USD, a Fase 0 usa:

```text
ETH_USD â‰ˆ ETH_USDC
```

Essa aproximaÃ§Ã£o Ã© aceitÃ¡vel para a demo, pois USDC Ã© tratado como referÃªncia em dÃ³lar.

### 14.7 ValidaÃ§Ã£o runtime de `USDC-BRL`

A rota `USDC-BRL` deve ser validada em runtime.

A aplicaÃ§Ã£o nÃ£o deve assumir que `USDC-BRL` estarÃ¡ sempre disponÃ­vel como ticker pÃºblico no ambiente usado.

Fluxo obrigatÃ³rio:

```text
1. Buscar ETH-USDC.
2. Validar ETH-USDC.
3. Tentar buscar USDC-BRL.
4. Validar USDC-BRL.
5. Se USDC-BRL for vÃ¡lido:
   - calcular ETH_BRL.
6. Se USDC-BRL for invÃ¡lido ou indisponÃ­vel:
   - marcar BRL como indisponÃ­vel;
   - manter USD disponÃ­vel se ETH-USDC for vÃ¡lido;
   - nÃ£o bloquear o fluxo on-chain em ETH.
```

BRL indisponÃ­vel nÃ£o bloqueia:

- registro do imÃ³vel;
- verificaÃ§Ã£o mock;
- tokenizaÃ§Ã£o;
- criaÃ§Ã£o de oferta;
- compra da oferta.

Na UI, quando BRL estiver indisponÃ­vel, exibir:

```text
BRL indisponÃ­vel no momento
```

### 14.8 Rotas fiduciÃ¡rias

#### USD

ObrigatÃ³rio na Fase 0.

```text
ETH_USD â‰ˆ ETH_USDC
```

Se `ETH-USDC` estiver indisponÃ­vel, toda cotaÃ§Ã£o fiduciÃ¡ria fica indisponÃ­vel.

#### BRL

ObrigatÃ³rio tentar na Fase 0, mas nÃ£o bloqueante.

```text
ETH_BRL = ETH_USDC * USDC_BRL
```

Se `USDC-BRL` estiver indisponÃ­vel, a API deve retornar USD e marcar BRL como indisponÃ­vel.

#### EUR

Condicional.

```text
ETH_EUR = ETH_USDC * USDC_EUR
```

A moeda EUR sÃ³ deve ser exibida se `OKX_USDC_EUR_INST_ID` estiver configurada e a API local conseguir obter cotaÃ§Ã£o vÃ¡lida.

#### JPY

Condicional.

```text
ETH_JPY = ETH_USDC * USDC_JPY
```

A moeda JPY sÃ³ deve ser exibida se `OKX_USDC_JPY_INST_ID` estiver configurada e a API local conseguir obter cotaÃ§Ã£o vÃ¡lida.

### 14.9 Timeout

A chamada para a OKX deve ter timeout.

Valor padrÃ£o:

```text
FIAT_REQUEST_TIMEOUT_MS=3000
```

### 14.10 Cache e fallback

A API local deve usar cache de cotaÃ§Ãµes.

Valor padrÃ£o de TTL:

```text
FIAT_CACHE_TTL_SECONDS=60
```

Se a OKX falhar e houver Ãºltimo valor vÃ¡lido em cache, a API pode usar fallback apenas se o cache nÃ£o ultrapassar o limite mÃ¡ximo de staleness.

Valor padrÃ£o de staleness mÃ¡ximo:

```text
FIAT_MAX_STALENESS_SECONDS=3600
```

Regras:

```text
Se cache estÃ¡ dentro do TTL:
    usar cache normal.

Se OKX falha e cache tem idade <= FIAT_MAX_STALENESS_SECONDS:
    usar fallback com warning.

Se OKX falha e cache tem idade > FIAT_MAX_STALENESS_SECONDS:
    retornar erro fiduciÃ¡rio padronizado.
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

### 14.12 Resposta com BRL indisponÃ­vel

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

Se a OKX falhar e nÃ£o houver cache vÃ¡lido dentro do limite mÃ¡ximo de staleness:

```json
{
  "ok": false,
  "code": "FIAT_RATES_UNAVAILABLE",
  "message": "Could not fetch ETH fiat rates from OKX and no cached rates are available within max staleness.",
  "provider": "okx"
}
```

### 14.15 CÃ¡lculos fiduciÃ¡rios

CÃ¡lculos fiduciÃ¡rios nÃ£o devem usar `Number`.

Regras:

- valores on-chain em `bigint`;
- taxas fiduciÃ¡rias como string decimal;
- cÃ¡lculos usando decimal seguro, como `decimal.js` ou biblioteca equivalente;
- formataÃ§Ã£o apenas na camada de UI.

Exemplo conceitual:

```ts
const ethAmount = new Decimal(wei.toString()).div("1000000000000000000");
const fiatAmount = ethAmount.mul(new Decimal(rateString));
```

### 14.16 Uso na UI

A UI deve exibir valores fiduciÃ¡rios para:

- valor de mercado do imÃ³vel;
- valor total do Direito de Valor Livre;
- quantidade listada;
- preÃ§o da oferta;
- valor por unidade;
- total econÃ´mico da vendedora;
- total econÃ´mico do comprador.

USD deve aparecer quando `ETH-USDC` estiver disponÃ­vel.

BRL deve aparecer quando `USDC-BRL` estiver disponÃ­vel.

Se BRL estiver indisponÃ­vel, a UI deve continuar funcionando em ETH e USD.

EUR e JPY sÃ£o condicionais e sÃ³ devem aparecer se houver cotaÃ§Ã£o vÃ¡lida retornada pela API local.

### 14.17 Regra de settlement

Valores fiduciÃ¡rios sÃ£o apenas informativos.

O contrato continua usando:

- ETH;
- wei;
- unidades inteiras.

Nenhum valor fiduciÃ¡rio Ã© usado para settlement on-chain na Fase 0.

---

## 15. Dados on-chain

A blockchain armazena apenas referÃªncias, hashes e parÃ¢metros econÃ´micos.

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

Nenhum endereÃ§o completo, documento ou localizaÃ§Ã£o exata deve ser salvo em texto aberto on-chain.

---

## 16. Contratos da Fase 0

### 16.1 `PropertyRegistry`

ResponsÃ¡vel por:

- registrar imÃ³vel;
- manter `nextPropertyId`;
- manter `propertyExists`;
- armazenar hashes e parÃ¢metros econÃ´micos;
- manter `propertiesByOwner`;
- manter lista de participantes por imÃ³vel;
- fazer mock verification;
- tokenizar imÃ³vel;
- chamar `PropertyValueTokenFactory`;
- mintar NFT de usufruto;
- mintar ERC-20 de Direito de Valor Livre;
- armazenar a posiÃ§Ã£o de usufruto com valor vinculado;
- configurar endereÃ§os externos;
- atualizar status conforme listings.

### 16.2 `UsufructRightNFT`

ERC-721 restrito.

ResponsÃ¡vel por:

- representar o Direito de Usufruto;
- usar contrato Ãºnico;
- usar `tokenId = propertyId`;
- permitir mint apenas pelo `PropertyRegistry`;
- bloquear `approve`;
- bloquear `setApprovalForAll`;
- bloquear `transferFrom`;
- bloquear `safeTransferFrom`.

### 16.3 `PropertyValueToken`

ERC-20 restrito.

ResponsÃ¡vel por:

- representar apenas o Direito de Valor Livre;
- ter `decimals = 0`;
- permitir mint apenas pelo `PropertyRegistry`;
- bloquear `transfer`;
- bloquear `transferFrom`;
- bloquear `approve`;
- permitir `platformTransferFrom` apenas para operadores autorizados;
- autorizar `PrimaryValueSale` como operador.

### 16.4 `PropertyValueTokenFactory`

ResponsÃ¡vel por:

- criar um `PropertyValueToken` por imÃ³vel;
- permitir `createPropertyValueToken` apenas pelo `PropertyRegistry`;
- configurar operador inicial do token criado, incluindo `PrimaryValueSale`.

### 16.5 `PrimaryValueSale`

Marketplace primÃ¡rio.

ResponsÃ¡vel por:

- criar oferta de venda do Direito de Valor Livre;
- aceitar apenas ofertas criadas pelo owner do `PropertyRecord`;
- calcular automaticamente `priceWei`;
- exigir `priceWei > 0`;
- manter `nextListingId`;
- manter `listingExists`;
- manter listagens enumerÃ¡veis;
- travar tokens em escrow;
- usar `address(this)` como escrow;
- permitir compra total da oferta;
- mudar listing para `Filled` antes de transferir ETH;
- transferir ETH para vendedora via `call`;
- reverter se `call` falhar;
- usar `nonReentrant` em compra e cancelamento;
- registrar comprador como participante;
- atualizar status do imÃ³vel.

Esse contrato movimenta apenas o ERC-20 de Direito de Valor Livre.

Ele nÃ£o movimenta o NFT de usufruto.

Ele nÃ£o movimenta o Direito de Valor Vinculado.

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

- owner/admin configura endereÃ§os externos;
- `mockVerifyProperty` pode ser chamado pelo owner do `PropertyRecord` ou por conta com `MOCK_VERIFIER_ROLE`;
- status sÃ³ pode ser atualizado por fluxos autorizados.

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
- `PrimaryValueSale` Ã© operador autorizado;
- `transfer` reverte;
- `transferFrom` reverte;
- `approve` reverte;
- `allowance` nÃ£o Ã© usado na Fase 0.

### 17.4 `PropertyValueTokenFactory`

Regras:

- `createPropertyValueToken` sÃ³ pode ser chamado pelo `PropertyRegistry`.

### 17.5 `PrimaryValueSale`

Regras:

- `createPrimarySaleListing` sÃ³ pode ser chamado pelo owner do `PropertyRecord`;
- compradores nÃ£o podem revender tokens na Fase 0;
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

DefiniÃ§Ã£o de `SoldOut`:

```text
SoldOut significa que 100% do freeValueUnits foi vendido em ofertas primÃ¡rias.
NÃ£o significa venda total do imÃ³vel.
NÃ£o afeta o Direito de Usufruto nem o Direito de Valor Vinculado.
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

## 20. Storage obrigatÃ³rio

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

### 20.3 DefiniÃ§Ãµes

| Storage | Significado |
|---|---|
| `propertyExists` | evita interpretar imÃ³vel inexistente como struct default |
| `listingExists` | evita interpretar listing inexistente como struct default |
| `activeListingsCountByProperty` | nÃºmero de ofertas ativas por imÃ³vel |
| `totalFreeValueSoldByProperty` | total de tokens livres vendidos com sucesso |
| `activeEscrowedAmountByProperty` | total de tokens livres atualmente presos em ofertas ativas |
| `propertiesByOwner` | imÃ³veis registrados por owner |
| `participants` | owner e compradores do imÃ³vel |

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

#### ValidaÃ§Ãµes

- [ ] Nenhum endereÃ§o pode ser zero.
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

### 21.2 Registrar imÃ³vel

```solidity
function registerProperty(
    uint256 marketValueWei,
    uint16 linkedValueBps,
    bytes32 metadataHash,
    bytes32 documentsHash,
    bytes32 locationHash
) external returns (uint256 propertyId);
```

#### ValidaÃ§Ãµes

- [ ] `marketValueWei > 0`.
- [ ] `linkedValueBps > 0`.
- [ ] `linkedValueBps < 10_000`.
- [ ] `metadataHash != bytes32(0)`.
- [ ] `documentsHash != bytes32(0)`.
- [ ] `locationHash != bytes32(0)`.

#### CÃ¡lculos

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

#### ValidaÃ§Ãµes

- [ ] `propertyExists[propertyId] == true`.
- [ ] Status atual Ã© `PendingMockVerification`.
- [ ] Chamador Ã© owner do `PropertyRecord` ou possui `MOCK_VERIFIER_ROLE`.

#### Efeitos

- [ ] Atualiza status para `MockVerified`.
- [ ] Emite `PropertyMockVerified`.
- [ ] Emite `PropertyStatusUpdated`.

---

### 21.4 Tokenizar imÃ³vel

```solidity
function tokenizeProperty(uint256 propertyId) external;
```

#### ValidaÃ§Ãµes

- [ ] `propertyExists[propertyId] == true`.
- [ ] `msg.sender == owner`.
- [ ] Status Ã© `MockVerified`.
- [ ] ImÃ³vel ainda nÃ£o foi tokenizado.

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

### 21.5 Atualizar status apÃ³s alteraÃ§Ã£o de listing

FunÃ§Ã£o chamada apenas pelo `PrimaryValueSale`.

```solidity
function updateStatusAfterSaleChange(
    uint256 propertyId,
    uint256 activeListingsCount,
    uint256 totalFreeValueSold
) external;
```

#### Regras

- [ ] Se `totalFreeValueSold == freeValueUnits`, status vira `SoldOut`.
- [ ] SenÃ£o, se `activeListingsCount > 0`, status vira `ActiveSale`.
- [ ] SenÃ£o, status volta para `Tokenized`.

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

- [ ] Contrato Ãºnico.
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
- [ ] Quantidades sÃ£o unidades inteiras.
- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] `PrimaryValueSale` Ã© operador autorizado.
- [ ] `transfer` reverte.
- [ ] `transferFrom` reverte.
- [ ] `approve` reverte.
- [ ] `allowance` nÃ£o Ã© usado.

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
- [ ] Factory cria um ERC-20 por imÃ³vel.
- [ ] Token criado deve ter `decimals = 0`.
- [ ] Token criado deve receber referÃªncia ao `PropertyRegistry`.
- [ ] Token criado deve configurar `PrimaryValueSale` como operador autorizado.

### 24.2 FunÃ§Ã£o esperada

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

### 25.1 Criar oferta primÃ¡ria

```solidity
function createPrimarySaleListing(
    uint256 propertyId,
    uint256 amount
) external returns (uint256 listingId);
```

#### ValidaÃ§Ãµes

- [ ] `propertyExists[propertyId] == true`.
- [ ] ImÃ³vel estÃ¡ `Tokenized` ou `ActiveSale`.
- [ ] `msg.sender == property.owner`.
- [ ] `amount > 0`.
- [ ] `amount <= balanceOf(msg.sender)`.
- [ ] Compradores nÃ£o podem criar ofertas na Fase 0.

#### CÃ¡lculo de preÃ§o

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
- [ ] Atualiza status do imÃ³vel.
- [ ] Emite `PrimarySaleListed`.
- [ ] Emite `TokensEscrowed`.

---

### 25.2 Comprar oferta primÃ¡ria

```solidity
function buyPrimarySaleListing(uint256 listingId)
    external
    payable
    nonReentrant;
```

#### ValidaÃ§Ãµes

- [ ] `listingExists[listingId] == true`.
- [ ] Listing estÃ¡ `Active`.
- [ ] `msg.value == priceWei`.
- [ ] Comprador nÃ£o Ã© seller.
- [ ] ImÃ³vel estÃ¡ `ActiveSale` ou `Tokenized`.

#### Efeitos antes de interaÃ§Ãµes externas

- [ ] Listing muda para `Filled`.
- [ ] Decrementa `activeListingsCountByProperty[propertyId]`.
- [ ] Decrementa `activeEscrowedAmountByProperty[propertyId]`.
- [ ] Incrementa `totalFreeValueSoldByProperty[propertyId]`.
- [ ] Atualiza status do imÃ³vel:
  - `SoldOut`, se todo `freeValueUnits` foi vendido;
  - `Tokenized`, se nÃ£o houver ofertas ativas;
  - `ActiveSale`, se ainda houver ofertas ativas.
- [ ] Adiciona comprador em `participants[propertyId]`, se ainda nÃ£o existir.
- [ ] Emite `ListingStatusUpdated`.

#### InteraÃ§Ãµes externas

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

#### ValidaÃ§Ãµes

- [ ] `listingExists[listingId] == true`.
- [ ] Listing estÃ¡ `Active`.
- [ ] `msg.sender == seller`.

#### Efeitos

- [ ] Listing muda para `Cancelled`.
- [ ] Decrementa `activeListingsCountByProperty[propertyId]`.
- [ ] Decrementa `activeEscrowedAmountByProperty[propertyId]`.
- [ ] Devolve tokens de `address(this)` para seller.
- [ ] Atualiza status do imÃ³vel.
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

Para a Fase 0, arrays simples sÃ£o aceitÃ¡veis.

---

## 26. Eventos obrigatÃ³rios

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

## 27. Invariantes crÃ­ticas

- [ ] `linkedValueUnits + freeValueUnits == totalValueUnits`.
- [ ] `propertyExists[propertyId] == true` para qualquer operaÃ§Ã£o em imÃ³vel.
- [ ] `listingExists[listingId] == true` para qualquer operaÃ§Ã£o em listing.
- [ ] Cada imÃ³vel tokenizado possui exatamente um NFT de Direito de Usufruto.
- [ ] `tokenId` do usufruto Ã© igual ao `propertyId`.
- [ ] Cada imÃ³vel possui exatamente uma posiÃ§Ã£o de usufruto ativa.
- [ ] O Direito de Valor Vinculado nÃ£o existe como ERC-20.
- [ ] O Direito de Valor Vinculado fica na `UsufructPosition`.
- [ ] O Direito de Valor Vinculado nÃ£o pode ser vendido separadamente.
- [ ] O ERC-20 representa apenas o Direito de Valor Livre.
- [ ] O supply inicial do ERC-20 Ã© igual a `freeValueUnits`.
- [ ] O ERC-20 usa `decimals = 0`.
- [ ] O NFT de usufruto Ã© mintado para a proprietÃ¡ria.
- [ ] O ERC-20 de Direito de Valor Livre Ã© mintado para a proprietÃ¡ria.
- [ ] TransferÃªncias diretas do ERC-20 sÃ£o bloqueadas.
- [ ] `approve` do ERC-20 reverte.
- [ ] TransferÃªncias diretas do NFT sÃ£o bloqueadas.
- [ ] `approve` e `setApprovalForAll` do NFT revertem.
- [ ] Ofertas travam tokens livres em `address(this)`.
- [ ] `activeEscrowedAmountByProperty` Ã© igual Ã  soma dos amounts das ofertas ativas.
- [ ] `totalFreeValueSoldByProperty` sÃ³ aumenta em compras concluÃ­das.
- [ ] Comprador sÃ³ recebe tokens apÃ³s pagar o preÃ§o exato.
- [ ] Listing muda para `Filled` antes de transferir ETH.
- [ ] TransferÃªncia de ETH com `call` reverte se falhar.
- [ ] Vendedora recebe ETH apÃ³s compra bem-sucedida.
- [ ] Dados sensÃ­veis nÃ£o sÃ£o gravados em texto aberto on-chain.
- [ ] On-chain armazena apenas hashes/referÃªncias.
- [ ] Valores fiduciÃ¡rios nÃ£o afetam settlement on-chain.

---

## 28. Casos de erro esperados

### Registrar imÃ³vel sem valor

```text
marketValueWei = 0
Resultado: revert INVALID_MARKET_VALUE
```

### Registrar imÃ³vel com percentual vinculado invÃ¡lido

```text
linkedValueBps = 0 ou >= 10.000
Resultado: revert INVALID_LINKED_VALUE_BPS
```

### Operar imÃ³vel inexistente

```text
propertyExists[propertyId] = false
Resultado: revert PROPERTY_NOT_FOUND
```

### Operar listing inexistente

```text
listingExists[listingId] = false
Resultado: revert LISTING_NOT_FOUND
```

### Registrar imÃ³vel sem hash de documentos

```text
documentsHash = 0x0
Resultado: revert INVALID_DOCUMENTS_HASH
```

### Tokenizar antes da verificaÃ§Ã£o mock

```text
status = PendingMockVerification
Resultado: revert PROPERTY_NOT_MOCK_VERIFIED
```

### Criar oferta com mais tokens livres do que possui

```text
amount > balanceOf(seller)
Resultado: revert INSUFFICIENT_FREE_VALUE_BALANCE
```

### Criar oferta com preÃ§o calculado igual a zero

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

## 29. Testes obrigatÃ³rios

### 29.1 `PropertyRegistry`

- [ ] Registra imÃ³vel com parÃ¢metros vÃ¡lidos.
- [ ] Reverte com valor de mercado zero.
- [ ] Reverte com `linkedValueBps` invÃ¡lido.
- [ ] Reverte sem `metadataHash`.
- [ ] Reverte sem `documentsHash`.
- [ ] Reverte sem `locationHash`.
- [ ] Usa `nextPropertyId`.
- [ ] Define `propertyExists[propertyId] = true`.
- [ ] Reverte operaÃ§Ãµes com property inexistente.
- [ ] Calcula `linkedValueUnits` corretamente.
- [ ] Calcula `freeValueUnits` corretamente.
- [ ] Garante `linkedValueUnits + freeValueUnits == totalValueUnits`.
- [ ] Define owner corretamente.
- [ ] Preenche `propertiesByOwner`.
- [ ] Adiciona owner como participante.
- [ ] Define status `PendingMockVerification`.
- [ ] Permite mock verification pelo owner.
- [ ] Permite mock verification por `MOCK_VERIFIER_ROLE`.
- [ ] Reverte mock verification por conta nÃ£o autorizada.
- [ ] Reverte tokenizaÃ§Ã£o antes de mock verification.
- [ ] Tokeniza apÃ³s mock verification.
- [ ] Cria `UsufructPosition`.
- [ ] Minta NFT com `tokenId = propertyId`.
- [ ] Cria `PropertyValueToken` via factory.
- [ ] Emite eventos obrigatÃ³rios.

---

### 29.2 `UsufructRightNFT`

- [ ] Minta NFT para proprietÃ¡ria.
- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] `tokenId == propertyId`.
- [ ] Bloqueia `transferFrom`.
- [ ] Bloqueia `safeTransferFrom`.
- [ ] Bloqueia `approve`.
- [ ] Bloqueia `setApprovalForAll`.
- [ ] Retorna owner correto.
- [ ] NFT permanece com proprietÃ¡ria apÃ³s venda de valor livre.

---

### 29.3 `PropertyValueToken`

- [ ] Minta apenas `freeValueUnits` para proprietÃ¡ria.
- [ ] NÃ£o minta `totalValueUnits`.
- [ ] `decimals() == 0`.
- [ ] Bloqueia `transfer`.
- [ ] Bloqueia `transferFrom`.
- [ ] Bloqueia `approve`.
- [ ] Permite `platformTransferFrom` por operador autorizado.
- [ ] Reverte movimentaÃ§Ã£o por operador nÃ£o autorizado.
- [ ] Supply inicial Ã© igual a `freeValueUnits`.
- [ ] `PrimaryValueSale` Ã© operador autorizado.

---

### 29.4 `PropertyValueTokenFactory`

- [ ] Apenas `PropertyRegistry` chama `createPropertyValueToken`.
- [ ] Cria um token por imÃ³vel.
- [ ] Token criado usa `decimals = 0`.
- [ ] Token criado jÃ¡ nasce com `PrimaryValueSale` como operador autorizado.
- [ ] Reverte chamada por conta nÃ£o autorizada.

---

### 29.5 `PrimaryValueSale`

- [ ] Possui `nextListingId`.
- [ ] Define `listingExists`.
- [ ] Reverte operaÃ§Ã£o com listing inexistente.
- [ ] Cria listing com saldo livre suficiente.
- [ ] Apenas owner do `PropertyRecord` cria listing.
- [ ] Comprador nÃ£o consegue criar listing.
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
- [ ] Reverte se transferÃªncia de ETH falhar.
- [ ] Atualiza `totalFreeValueSoldByProperty`.
- [ ] Atualiza status para `Tokenized` quando nÃ£o houver ofertas ativas.
- [ ] Atualiza status para `SoldOut` quando todo `freeValueUnits` for vendido.
- [ ] NÃ£o transfere NFT de usufruto.
- [ ] NÃ£o altera `linkedValueUnits`.
- [ ] Cancela listing ativa.
- [ ] Devolve tokens ao seller no cancelamento.
- [ ] Getters retornam listings por property.
- [ ] Getters retornam listings ativas.
- [ ] Emite eventos obrigatÃ³rios.

---

### 29.6 API `/api/fiat-rates`

- [ ] Usa OKX como provider.
- [ ] Chama `GET /api/v5/market/ticker?instId=<instId>`.
- [ ] Consulta `ETH-USDC`.
- [ ] Usa `data[0].last` como preÃ§o.
- [ ] Valida `code == "0"`.
- [ ] Valida `data` como array nÃ£o vazio.
- [ ] Valida `data[0].last`.
- [ ] Valida `last > 0`.
- [ ] Consulta `USDC-BRL` em runtime.
- [ ] Calcula `ETH_BRL = ETH_USDC * USDC_BRL` quando `USDC-BRL` estiver disponÃ­vel.
- [ ] Calcula `ETH_USD â‰ˆ ETH_USDC`.
- [ ] Retorna USD quando `ETH-USDC` estiver vÃ¡lido.
- [ ] Marca BRL como indisponÃ­vel se `USDC-BRL` falhar.
- [ ] NÃ£o bloqueia fluxo ETH quando BRL estiver indisponÃ­vel.
- [ ] Retorna EUR apenas se rota opcional estiver configurada e funcional.
- [ ] Retorna JPY apenas se rota opcional estiver configurada e funcional.
- [ ] Respeita `FIAT_REQUEST_TIMEOUT_MS`.
- [ ] Respeita `FIAT_CACHE_TTL_SECONDS`.
- [ ] Respeita `FIAT_MAX_STALENESS_SECONDS`.
- [ ] Usa cache quando disponÃ­vel e vÃ¡lido.
- [ ] Usa fallback de Ãºltimo valor vÃ¡lido se a OKX falhar e o cache estiver dentro do staleness mÃ¡ximo.
- [ ] Retorna erro padronizado se a OKX falhar e nÃ£o houver cache vÃ¡lido dentro do staleness mÃ¡ximo.
- [ ] Retorna rates como strings decimais.
- [ ] NÃ£o usa `Number` para cÃ¡lculos fiduciÃ¡rios.
- [ ] Usa decimal seguro para conversÃµes.
- [ ] Testa resposta de sucesso.
- [ ] Testa cache hit.
- [ ] Testa fallback.
- [ ] Testa erro sem cache.
- [ ] Testa BRL indisponÃ­vel sem bloquear USD.
- [ ] Testa ocultaÃ§Ã£o de EUR/JPY quando as rotas opcionais nÃ£o estiverem disponÃ­veis.

---

### 29.7 Off-chain local e hashing

- [ ] Browser nÃ£o escreve diretamente no `db.json`.
- [ ] API/server action escreve no lowdb.
- [ ] Hash usa `keccak256`.
- [ ] Hash usa stable JSON com chaves ordenadas.
- [ ] `metadataHash` inclui endereÃ§o textual.
- [ ] `locationHash` inclui apenas `lat` e `lng`.
- [ ] `lat` e `lng` sÃ£o strings com 6 casas decimais.
- [ ] Hash de documentos usa metadata mockada, nÃ£o binÃ¡rio.
- [ ] `uploadedAt` nÃ£o entra no `documentsHash`.
- [ ] `uploadedAt` fica apenas no `db.json`.
- [ ] Schemas de metadata sÃ£o fixos.
- [ ] Hash gerado Ã© determinÃ­stico.

---

## 30. Milestones tÃ©cnicos da Fase 0

---

### Milestone 0.1 â€” Setup tÃ©cnico e Docker

**Objetivo:** preparar base de desenvolvimento, Docker, deploy e demo.

#### Checklist

- [x] Criar repositÃ³rio.
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
- [x] Garantir que `DEPLOYER_PRIVATE_KEY` nÃ£o entra no container app.
- [x] Criar estrutura de contratos.
- [x] Criar script de deploy Foundry.
- [x] Criar estrutura local de banco nÃ£o estruturado.
- [x] Criar `db.json` local.
- [x] Criar utilitÃ¡rio de hash.
- [x] Criar utilitÃ¡rio de decimal seguro.
- [x] Conectar wallet no frontend.
- [x] Ler dado do contrato no frontend.

#### CritÃ©rio de aceite

- [x] App roda via Docker.
- [x] Frontend abre localmente.
- [x] UsuÃ¡rio conecta wallet.
- [x] Frontend detecta Sepolia.
- [x] Frontend lÃª dado on-chain.
- [x] Frontend salva registro mockado via server-side local.
- [x] Deploy roda fora do container app.

#### Prioridade

P0

---

### Milestone 0.2 â€” CotaÃ§Ã£o fiduciÃ¡ria com OKX

**Objetivo:** exibir valores em moedas fiduciÃ¡rias.

#### Checklist

- [x] Criar API `/api/fiat-rates`.
- [x] Consultar OKX server-side.
- [x] Suportar BRL e USD.
- [x] Implementar timeout.
- [x] Implementar cache de 60 segundos.
- [x] Implementar fallback de Ãºltimo valor vÃ¡lido.
- [x] Implementar erro padronizado.
- [x] Armazenar cache no lowdb.
- [x] Usar string decimal para rates.
- [x] Usar decimal seguro para cÃ¡lculos.
- [x] Exibir valor da casa em BRL e USD.
- [x] Exibir preÃ§o da oferta em BRL e USD.
- [x] Exibir valor por unidade em BRL e USD.
- [x] Exibir aviso quando estiver usando fallback/cache.

#### CritÃ©rio de aceite

- [x] UI mostra valores em ETH e USD, e BRL quando a rota estiver disponÃ­vel.
- [x] API funciona com cache.
- [x] API lida com falha da OKX.
- [x] Testes P0 de cotaÃ§Ã£o passam.

#### Prioridade

P0

---

### Milestone 0.3 â€” Off-chain local e upload mockado

**Objetivo:** permitir cadastro de dados do imÃ³vel fora da blockchain.

#### Checklist

- [x] Criar formulÃ¡rio de tokenizaÃ§Ã£o.
- [x] Criar mock document upload.
- [x] Criar schema local de propriedade.
- [x] Salvar endereÃ§o no banco local via server-side.
- [x] Salvar localizaÃ§Ã£o no banco local via server-side.
- [x] Normalizar `lat` e `lng` como strings de 6 casas.
- [x] Salvar valor de mercado no banco local.
- [x] Salvar percentual vinculado ao usufruto.
- [x] Salvar documentos mockados no banco local.
- [x] Calcular `metadataHash`.
- [x] Calcular `documentsHash`.
- [x] Calcular `locationHash`.
- [x] Exibir preview dos dados antes do registro on-chain.
- [x] Exibir aviso de que documentos sÃ£o mockados.

#### CritÃ©rio de aceite

- [x] Pessoa A preenche dados da casa.
- [x] Pessoa A define percentual vinculado ao usufruto.
- [x] Pessoa A faz upload mockado de documentos.
- [x] Dados sÃ£o salvos localmente via API/server action.
- [x] Hashes sÃ£o gerados de forma determinÃ­stica.

#### Prioridade

P0

---

### Milestone 0.4 â€” Registro on-chain do imÃ³vel

**Objetivo:** criar o registro on-chain com referÃªncias aos dados off-chain e parÃ¢metros econÃ´micos.

#### Checklist

- [x] Implementar `PropertyRegistry`.
- [x] Implementar `PropertyRecord`.
- [x] Implementar `UsufructPosition`.
- [x] Implementar `nextPropertyId`.
- [x] Implementar `propertyExists`.
- [x] Implementar `propertiesByOwner`.
- [x] Implementar `participants`.
- [x] Implementar `registerProperty`.
- [x] Validar `marketValueWei`.
- [x] Validar `linkedValueBps`.
- [x] Validar `metadataHash`.
- [x] Validar `documentsHash`.
- [x] Validar `locationHash`.
- [x] Calcular `linkedValueUnits`.
- [x] Calcular `freeValueUnits`.
- [x] Salvar owner.
- [x] Salvar status `PendingMockVerification`.
- [x] Adicionar owner em `propertiesByOwner`.
- [x] Adicionar owner em `participants`.
- [x] Emitir `PropertyRegistered`.
- [x] Emitir `ParticipantAdded`.
- [x] Criar chamada no frontend.
- [x] Exibir `propertyId` criado.

#### CritÃ©rio de aceite

- [x] Pessoa A registra imÃ³vel on-chain.
- [x] Contrato armazena valor de mercado e hashes.
- [x] Contrato calcula 20% vinculado e 80% livre no exemplo-base.
- [x] `propertyExists[propertyId] == true`.
- [x] Status inicial Ã© `PendingMockVerification`.
- [x] Dashboard mostra imÃ³vel registrado.

#### Prioridade

P0

---

### Milestone 0.5 â€” VerificaÃ§Ã£o mock

**Objetivo:** simular aprovaÃ§Ã£o documental antes da tokenizaÃ§Ã£o.

#### Checklist

- [x] Implementar `Ownable`.
- [x] Implementar `AccessControl`.
- [x] Implementar `MOCK_VERIFIER_ROLE`.
- [x] Implementar `mockVerifyProperty`.
- [x] Validar existÃªncia do imÃ³vel.
- [x] Validar status `PendingMockVerification`.
- [x] Permitir mock verification pelo owner do imÃ³vel.
- [x] Permitir mock verification por `MOCK_VERIFIER_ROLE`.
- [x] Reverter mock verification por conta nÃ£o autorizada.
- [x] Atualizar status para `MockVerified`.
- [x] Emitir `PropertyMockVerified`.
- [x] Emitir `PropertyStatusUpdated`.
- [x] Criar botÃ£o â€œAprovar documentos mockâ€.
- [x] Exibir status no dashboard.

#### CritÃ©rio de aceite

- [x] Pessoa A registra imÃ³vel.
- [x] Pessoa A clica em â€œAprovar documentos mockâ€.
- [x] Status muda para `MockVerified`.
- [x] TokenizaÃ§Ã£o fica liberada.

#### Prioridade

P0

---

### Milestone 0.6 â€” TokenizaÃ§Ã£o do imÃ³vel

**Objetivo:** gerar NFT de usufruto, posiÃ§Ã£o de valor vinculado e ERC-20 de valor livre.

#### Checklist

- [x] Implementar `UsufructRightNFT`.
- [x] Implementar `PropertyValueToken`.
- [x] Implementar `PropertyValueTokenFactory`.
- [x] Configurar factory com registry autorizado.
- [x] Implementar `tokenizeProperty`.
- [x] Validar status `MockVerified`.
- [x] Mintar NFT de usufruto para Pessoa A.
- [x] Garantir `tokenId = propertyId`.
- [x] Criar `UsufructPosition` com `linkedValueUnits`.
- [x] Criar ERC-20 via factory.
- [x] Mintar apenas `freeValueUnits` em ERC-20 para Pessoa A.
- [x] Garantir que o ERC-20 jÃ¡ nasce com `PrimaryValueSale` como operador autorizado.
- [x] Garantir `decimals = 0`.
- [x] Bloquear transferÃªncia direta do NFT.
- [x] Bloquear aprovaÃ§Ã£o e transferÃªncia direta do ERC-20.
- [x] Atualizar status para `Tokenized`.
- [x] Salvar endereÃ§o do token no `PropertyRecord`.
- [x] Emitir `PropertyTokenized`.
- [x] Emitir `PropertyValueTokenCreated`.
- [x] Atualizar dashboard.

#### CritÃ©rio de aceite

- [x] Pessoa A tokeniza a casa.
- [x] Pessoa A recebe NFT de Direito de Usufruto.
- [x] PosiÃ§Ã£o de usufruto mostra 200.000 unidades vinculadas no exemplo-base.
- [x] Pessoa A recebe 800.000 tokens de Direito de Valor Livre no exemplo-base.
- [x] Token de valor tem `decimals = 0`.
- [x] Dashboard mostra tokenizaÃ§Ã£o concluÃ­da.

#### Prioridade

P0

---

### Milestone 0.7 â€” Dashboard da propriedade tokenizada

**Objetivo:** mostrar de forma clara a diferenÃ§a entre usufruto, valor vinculado e valor livre.

#### Checklist

- [x] Mostrar valor de mercado em ETH.
- [x] Mostrar valor de mercado em BRL/USD.
- [x] Mostrar owner.
- [x] Mostrar status.
- [x] Mostrar endereÃ§o off-chain.
- [x] Mostrar localizaÃ§Ã£o off-chain.
- [x] Mostrar `metadataHash`.
- [x] Mostrar `documentsHash`.
- [x] Mostrar `locationHash`.
- [x] Mostrar NFT de usufruto.
- [x] Mostrar titular do NFT.
- [x] Mostrar unidades vinculadas ao usufruto.
- [x] Mostrar percentual vinculado.
- [x] Mostrar token de valor livre.
- [x] Mostrar supply livre.
- [x] Mostrar saldo livre da proprietÃ¡ria.
- [x] Mostrar total econÃ´mico da proprietÃ¡ria.
- [x] Mostrar participantes.
- [x] Mostrar saldos de compradores apÃ³s venda.
- [x] Mostrar ofertas ativas.
- [x] Mostrar tokens em escrow ativo.
- [x] Mostrar explicaÃ§Ã£o â€œDireito de Valor Livre nÃ£o dÃ¡ direito de usoâ€.

#### CritÃ©rio de aceite

- [x] Dashboard permite entender quem tem o usufruto.
- [x] Dashboard permite entender quem tem valor vinculado.
- [x] Dashboard permite entender quem tem valor livre.
- [x] Dashboard mostra total econÃ´mico por pessoa.
- [x] Dashboard mostra valores em ETH e fiduciÃ¡rio.

#### Prioridade

P0

---

### Milestone 0.8 â€” Criar oferta primÃ¡ria de Direito de Valor Livre

**Objetivo:** permitir que a proprietÃ¡ria defina quanto quer vender do valor livre.

#### Checklist

- [x] Implementar `PrimaryValueSale`.
- [x] Implementar `nextListingId`.
- [x] Implementar `listingExists`.
- [x] Implementar `listingIds`.
- [x] Implementar `listingsByProperty`.
- [x] Implementar `activeListingsCountByProperty`.
- [x] Implementar `activeEscrowedAmountByProperty`.
- [x] Implementar `totalFreeValueSoldByProperty`.
- [x] Implementar `createPrimarySaleListing`.
- [x] Validar imÃ³vel `Tokenized` ou `ActiveSale`.
- [x] Validar `msg.sender == property.owner`.
- [x] Validar saldo livre suficiente.
- [x] Validar `amount > 0`.
- [x] Calcular `priceWei` automaticamente.
- [x] Validar `priceWei > 0`.
- [x] Travar tokens livres em `address(this)`.
- [x] Criar listing.
- [x] Atualizar status para `Active`.
- [x] Atualizar status do imÃ³vel.
- [x] Emitir `PrimarySaleListed`.
- [x] Emitir `TokensEscrowed`.
- [x] Criar formulÃ¡rio no frontend.
- [x] Mostrar percentual equivalente do valor econÃ´mico total.
- [x] Mostrar preÃ§o calculado em ETH.
- [x] Mostrar preÃ§o calculado em fiduciÃ¡rio.
- [x] Mostrar preview da venda.
- [x] Mostrar que NFT de usufruto nÃ£o serÃ¡ transferido.
- [x] Mostrar que valor vinculado nÃ£o serÃ¡ transferido.

#### CritÃ©rio de aceite

- [x] Pessoa A define vender 300.000 tokens livres.
- [x] Sistema mostra que isso equivale a 30% do valor econÃ´mico total.
- [x] Contrato calcula preÃ§o de 3 ETH para casa de 10 ETH.
- [x] UI mostra equivalente em BRL/USD.
- [x] Tokens livres sÃ£o travados em escrow.
- [x] Oferta aparece no marketplace.

#### Prioridade

P0

---

### Milestone 0.9 â€” Comprar Direito de Valor Livre

**Objetivo:** permitir que comprador compre a oferta e vendedora receba ETH.

#### Checklist

- [x] Implementar `buyPrimarySaleListing`.
- [x] Usar `nonReentrant`.
- [x] Validar `listingExists`.
- [x] Validar listing ativo.
- [x] Validar `msg.value == priceWei`.
- [x] Validar comprador diferente do seller.
- [x] Mudar listing para `Filled` antes de transferir ETH.
- [x] Atualizar `activeListingsCountByProperty`.
- [x] Atualizar `activeEscrowedAmountByProperty`.
- [x] Atualizar `totalFreeValueSoldByProperty`.
- [x] Atualizar status do imÃ³vel.
- [x] Transferir tokens livres de `address(this)` para comprador.
- [x] Transferir ETH para seller com `call`.
- [x] Reverter se `call` falhar.
- [x] Registrar comprador em `participants`.
- [x] Emitir `ListingStatusUpdated`.
- [x] Emitir `PrimarySalePurchased`.
- [x] Emitir `SellerPaid`.
- [x] Emitir `ParticipantAdded` se aplicÃ¡vel.
- [x] Atualizar dashboard.
- [x] Mostrar saldo do comprador.
- [x] Mostrar ETH recebido pela vendedora.
- [x] Bloquear compra duplicada.

#### CritÃ©rio de aceite

- [x] Pessoa B compra 300.000 tokens por 3 ETH.
- [x] Pessoa A recebe 3 ETH na wallet.
- [x] Pessoa B recebe 300.000 tokens de Direito de Valor Livre.
- [x] Pessoa A continua com NFT de usufruto.
- [x] Pessoa A continua com 200.000 unidades vinculadas.
- [x] Dashboard mostra A com 70% econÃ´mico total e B com 30%.
- [x] Status volta para `Tokenized` se nÃ£o houver ofertas ativas.
- [x] Status vira `SoldOut` se todo valor livre foi vendido.

#### Prioridade

P0

---

### Milestone 0.10 â€” Cancelar oferta

**Objetivo:** permitir cancelamento seguro de oferta ativa.

#### Checklist

- [x] Implementar `cancelPrimarySaleListing`.
- [x] Usar `nonReentrant`.
- [x] Validar `listingExists`.
- [x] Validar listing ativo.
- [x] Validar `msg.sender == seller`.
- [x] Mudar listing para `Cancelled`.
- [x] Atualizar `activeListingsCountByProperty`.
- [x] Atualizar `activeEscrowedAmountByProperty`.
- [x] Devolver tokens livres para seller.
- [x] Atualizar status do imÃ³vel.
- [x] Emitir `PrimarySaleCancelled`.
- [x] Emitir `ListingStatusUpdated`.
- [x] Atualizar marketplace no frontend.

#### CritÃ©rio de aceite

- [x] Pessoa A cancela oferta ativa.
- [x] Tokens em escrow voltam para Pessoa A.
- [x] Listing vira `Cancelled`.
- [x] Status volta para `Tokenized` se nÃ£o houver ofertas ativas.

#### Prioridade

P0

---

### Milestone 0.11 â€” RestriÃ§Ãµes de transferÃªncia

**Objetivo:** garantir que os ativos sÃ³ sejam transferidos pela plataforma.

#### Checklist

- [x] Bloquear `transfer` direto do ERC-20.
- [x] Bloquear `transferFrom` direto do ERC-20.
- [x] Bloquear `approve` do ERC-20.
- [x] Bloquear `transferFrom` direto do NFT.
- [x] Bloquear `safeTransferFrom` direto do NFT.
- [x] Bloquear `approve` do NFT.
- [x] Bloquear `setApprovalForAll` do NFT.
- [x] Permitir transferÃªncia do ERC-20 por `PrimaryValueSale`.
- [x] Testar operador autorizado.
- [x] Testar operador nÃ£o autorizado.
- [x] Exibir mensagem na UI explicando restriÃ§Ã£o.

#### CritÃ©rio de aceite

- [x] TransferÃªncia direta do token reverte.
- [x] AprovaÃ§Ã£o do token reverte.
- [x] TransferÃªncia direta do NFT reverte.
- [x] AprovaÃ§Ã£o do NFT reverte.
- [x] Compra via marketplace funciona.

#### Prioridade

P0

---

### Milestone 0.12 â€” Frontend e demo guiada

**Objetivo:** garantir que a banca entenda o fluxo rapidamente.

#### Checklist

- [x] Criar home com explicaÃ§Ã£o da tese.
- [x] Criar tela â€œTokenizar minha casaâ€.
- [x] Criar mock upload.
- [x] Criar tela de status de verificaÃ§Ã£o mock.
- [x] Criar tela de tokenizaÃ§Ã£o.
- [x] Criar seÃ§Ã£o explicando os trÃªs direitos.
- [x] Criar dashboard do imÃ³vel.
- [x] Criar formulÃ¡rio de venda de Direito de Valor Livre.
- [x] Criar marketplace de Direito de Valor Livre.
- [x] Criar visual de distribuiÃ§Ã£o econÃ´mica.
- [x] Criar visual de valores fiduciÃ¡rios.
- [x] Criar modo demo guiado.
- [x] Criar personagens: Pessoa A e Pessoa B.
- [x] Criar feedback de transaÃ§Ã£o enviada.
- [x] Criar feedback de transaÃ§Ã£o confirmada.
- [x] Criar estados de erro.
- [x] Criar estados de loading.
- [x] Criar estado de falha de cotaÃ§Ã£o fiduciÃ¡ria.
- [x] Criar estado de fallback de cotaÃ§Ã£o fiduciÃ¡ria.

#### CritÃ©rio de aceite

- [x] Demo completa pode ser apresentada em atÃ© 5 minutos.
- [x] Fluxo de tokenizaÃ§Ã£o Ã© compreensÃ­vel.
- [x] Fluxo de venda de valor livre Ã© compreensÃ­vel.
- [x] Banca entende que A mantÃ©m usufruto e valor vinculado.
- [x] Banca entende que B compra apenas Direito de Valor Livre.
- [x] Banca entende valores em ETH e moedas fiduciÃ¡rias.

#### Prioridade

P0

---

### Milestone 0.13 â€” Testes e preparaÃ§Ã£o da apresentaÃ§Ã£o

**Objetivo:** reduzir risco de falha durante a demo.

#### Checklist

- [x] Criar testes unitÃ¡rios.
- [x] Criar testes de integraÃ§Ã£o.
- [x] Testar registro do imÃ³vel.
- [x] Testar `propertyExists`.
- [x] Testar cÃ¡lculo de `linkedValueUnits`.
- [x] Testar cÃ¡lculo de `freeValueUnits`.
- [x] Testar mock verification.
- [x] Testar tokenizaÃ§Ã£o.
- [x] Testar mint do NFT.
- [x] Testar criaÃ§Ã£o da `UsufructPosition`.
- [x] Testar mint do ERC-20 livre.
- [x] Testar `decimals = 0`.
- [x] Testar bloqueio de transferÃªncia direta.
- [x] Testar factory autorizada.
- [x] Testar criaÃ§Ã£o de oferta.
- [x] Testar `listingExists`.
- [x] Testar preÃ§o proporcional.
- [x] Testar `priceWei > 0`.
- [x] Testar escrow em `address(this)`.
- [x] Testar compra da oferta.
- [x] Testar mudanÃ§a para `Filled` antes de interaÃ§Ãµes.
- [x] Testar pagamento para seller.
- [x] Testar revert em falha de ETH transfer.
- [x] Testar recebimento de tokens pelo comprador.
- [x] Testar participantes.
- [x] Testar status `Tokenized`, `ActiveSale` e `SoldOut`.
- [x] Testar cancelamento de oferta.
- [x] Testar API `/api/fiat-rates`.
- [x] Testar cache de cotaÃ§Ã£o.
- [x] Testar fallback de cotaÃ§Ã£o.
- [x] Testar erro sem cache.
- [x] Testar hashing determinÃ­stico.
- [x] Testar deploy na Sepolia.
- [x] Testar app via Docker.
- [x] Preparar wallets de demo.
- [x] Preparar ETH de Sepolia nas wallets.
- [x] Preparar roteiro de apresentaÃ§Ã£o.
- [x] Preparar fallback de demo.

#### CritÃ©rio de aceite

- [x] Testes crÃ­ticos passam.
- [x] Contratos estÃ£o deployados na Sepolia.
- [x] App roda via Docker.
- [x] Banco local estÃ¡ preparado.
- [x] OKX/cache estÃ¡ funcional.
- [x] Wallets de demo tÃªm ETH de Sepolia.
- [x] Roteiro da demo foi validado.

#### Prioridade

P0

---

## 31. PriorizaÃ§Ã£o da Fase 0

### P0 â€” ObrigatÃ³rio

- [ ] Docker/local Node.js.
- [ ] Deploy Foundry fora do container app.
- [ ] `.env.app` sem chave privada.
- [ ] Banco local nÃ£o estruturado via server-side.
- [ ] OKX com cache, timeout e fallback.
- [ ] Hashing determinÃ­stico.
- [ ] Upload mockado de documentos.
- [ ] Registro on-chain do imÃ³vel.
- [ ] `propertyExists`.
- [ ] VerificaÃ§Ã£o mock.
- [ ] TokenizaÃ§Ã£o.
- [ ] NFT de usufruto Ãºnico.
- [ ] PosiÃ§Ã£o de valor vinculado.
- [ ] ERC-20 de Direito de Valor Livre via factory.
- [ ] `decimals = 0`.
- [ ] Dashboard com separaÃ§Ã£o clara dos direitos.
- [ ] Oferta primÃ¡ria de Direito de Valor Livre.
- [ ] PreÃ§o proporcional automÃ¡tico.
- [ ] `listingExists`.
- [ ] Listagens enumerÃ¡veis.
- [ ] Escrow em `address(this)`.
- [ ] Compra da oferta.
- [ ] Pagamento em ETH para vendedora.
- [ ] Revert em falha de ETH transfer.
- [ ] RestriÃ§Ãµes de transferÃªncia e approve.
- [ ] Status `Tokenized`, `ActiveSale`, `SoldOut`.
- [ ] Demo guiada.
- [ ] Testes crÃ­ticos.

---

## 32. SequÃªncia final da demo

1. Pessoa A inicia a aplicaÃ§Ã£o local via Docker.
2. Pessoa A conecta wallet.
3. Pessoa A acessa â€œTokenizar minha casaâ€.
4. Pessoa A insere valor de mercado: 0.2 ETH.
5. UI mostra valor aproximado em USD e, se disponÃ­vel, BRL.
6. Pessoa A define valor vinculado ao usufruto: 20%.
7. Pessoa A insere endereÃ§o e localizaÃ§Ã£o.
8. Pessoa A envia documentos mockados (utilizar para teste documentos em ./mock_docs).
9. Dados sÃ£o salvos no banco local via server-side.
10. Hashes sÃ£o gerados com `keccak256` sobre JSON estÃ¡vel.
11. Pessoa A registra imÃ³vel on-chain.
12. `propertyExists[propertyId]` Ã© definido.
13. Pessoa A aprova mock verification.
14. Pessoa A tokeniza imÃ³vel.
15. Sistema gera NFT de usufruto para Pessoa A com `tokenId = propertyId`.
16. Sistema cria posiÃ§Ã£o de usufruto com 200.000 unidades vinculadas.
17. Sistema gera 800.000 tokens de Direito de Valor Livre para Pessoa A.
18. Pessoa A define venda de 300.000 tokens livres.
19. Contrato calcula preÃ§o automÃ¡tico de 3 ETH.
20. UI mostra preÃ§o equivalente em USD e, se disponÃ­vel, BRL.
21. Tokens livres sÃ£o movidos para escrow em `PrimaryValueSale`.
22. Pessoa B compra a oferta pagando 3 ETH.
23. Listing muda para `Filled`.
24. Pessoa B recebe 300.000 tokens livres.
25. Pessoa A recebe 3 ETH.
26. Pessoa B Ã© adicionada como participante.
27. Dashboard mostra:
    - Pessoa A mantÃ©m usufruto;
    - Pessoa A mantÃ©m 20% vinculado;
    - Pessoa A mantÃ©m 50% livre;
    - Pessoa A tem 70% econÃ´mico total;
    - Pessoa B possui 30% econÃ´mico total;
    - Pessoa B nÃ£o possui direito de uso;
    - valores aparecem em ETH, USD e, quando disponÃ­vel, BRL.

---

## 33. DefiniÃ§Ã£o de pronto da Fase 0

A Fase 0 estÃ¡ pronta quando:

- [ ] App roda localmente via Docker.
- [ ] Foundry/deploy roda fora do container app.
- [ ] `.env.app` nÃ£o contÃ©m chave privada.
- [ ] Wallet conecta.
- [ ] Dados mockados sÃ£o salvos localmente via server-side.
- [ ] Hashes sÃ£o gerados de forma determinÃ­stica.
- [ ] API OKX funciona com cache, timeout e fallback.
- [ ] Valores fiduciÃ¡rios aparecem na UI em USD e, quando disponÃ­vel, BRL.
- [ ] ImÃ³vel Ã© registrado on-chain.
- [ ] `propertyExists` funciona.
- [ ] VerificaÃ§Ã£o mock funciona.
- [ ] ImÃ³vel Ã© tokenizado.
- [ ] NFT de usufruto Ã© mintado para a proprietÃ¡ria.
- [ ] `tokenId = propertyId`.
- [ ] PosiÃ§Ã£o de valor vinculado Ã© criada.
- [ ] ERC-20 de Direito de Valor Livre Ã© criado via factory.
- [ ] ERC-20 usa `decimals = 0`.
- [ ] ERC-20 minta apenas `freeValueUnits`.
- [ ] ProprietÃ¡ria cria oferta de venda de valor livre.
- [ ] PreÃ§o da oferta Ã© calculado automaticamente.
- [ ] `priceWei > 0` Ã© validado.
- [ ] `listingExists` funciona.
- [ ] Tokens livres sÃ£o travados em `address(this)`.
- [ ] Comprador compra oferta.
- [ ] Listing muda para `Filled` antes de transferir ETH.
- [ ] Vendedora recebe ETH.
- [ ] Falha de ETH transfer reverte.
- [ ] Comprador recebe Direito de Valor Livre.
- [ ] Participantes sÃ£o listÃ¡veis.
- [ ] NFT de usufruto nÃ£o Ã© transferido.
- [ ] Valor vinculado nÃ£o Ã© transferido.
- [ ] Status do imÃ³vel atualiza corretamente.
- [ ] Dashboard mostra distribuiÃ§Ã£o correta.
- [ ] TransferÃªncias diretas sÃ£o bloqueadas.
- [ ] `approve` reverte nos tokens restritos.
- [ ] Testes crÃ­ticos passam.
- [ ] Demo guiada funciona.
