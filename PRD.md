# PRD Técnico — Usufruct Protocol

**Fase:** 0 — Hackathon MVP  
**Execução:** aplicação local em Docker/Docker Compose com Node.js; deploy Foundry fora do container app  
**Rede:** Ethereum Sepolia  
**Smart contracts:** Solidity  
**Framework de contratos:** Foundry, executado fora do container da aplicação  
**Frontend:** Next.js local + TypeScript + Tailwind em container Node.js  
**Web3:** wagmi + viem  
**Dados off-chain:** banco local não estruturado via camada server-side em volume Docker  
**Documentos:** mockados  
**Pagamento:** ETH nativo  

---

## 1. Objetivo da Fase 0

A Fase 0 deve demonstrar que uma pessoa proprietária de uma casa consegue tokenizar economicamente esse imóvel, manter o direito de uso e vender parte do valor econômico livre para receber liquidez em ETH.

Fluxo principal:

```text
1. Pessoa A possui uma casa no mundo real.
2. Pessoa A cadastra a casa na aplicação local.
3. Pessoa A informa valor de mercado, endereço e localização.
4. Pessoa A envia documentos mockados.
5. Os dados sensíveis ficam no banco local não estruturado.
6. A aplicação gera hashes dos dados off-chain.
7. Pessoa A registra o imóvel on-chain.
8. Pessoa A executa a verificação mock.
9. Pessoa A tokeniza o imóvel.
10. O sistema gera um NFT de Direito de Usufruto para Pessoa A.
11. O sistema cria uma posição de Direito de Valor Vinculado ao usufruto.
12. O sistema gera um ERC-20 de Direito de Valor Livre para Pessoa A.
13. Pessoa A cria uma oferta primária para vender parte do Direito de Valor Livre.
14. Pessoa B compra a oferta pagando ETH.
15. Pessoa A recebe ETH.
16. Pessoa B recebe tokens de Direito de Valor Livre.
17. Pessoa A mantém o usufruto e o valor vinculado.
```

Mensagem central da demo:

> Tokenize sua casa, mantenha o direito de uso e venda parte do valor livre para captar liquidez.

---

## 2. Decisões técnicas da Fase 0

| Tema | Decisão |
|---|---|
| Execução da aplicação | Local via Docker/Docker Compose com Node.js |
| Frontend | Next.js + TypeScript + Tailwind em container Node.js |
| Blockchain | Ethereum Sepolia |
| Smart contracts | Solidity |
| Testes/deploy | Foundry executado fora do container `app` |
| Web3 client | wagmi + viem |
| Pagamento | ETH nativo |
| Banco off-chain | lowdb ou JSON document store local em volume Docker |
| Escrita no banco local | Apenas via camada server-side local dentro do container Node.js |
| Hashes | `keccak256` |
| Input do hash | JSON estável com chaves ordenadas |
| Documentos | Mockados; hash da metadata mockada, não do binário |
| NFT de usufruto | Contrato único `UsufructRightNFT` |
| `tokenId` do usufruto | Igual ao `propertyId` |
| Valor vinculado | Campo interno da `UsufructPosition` |
| Token de valor livre | Um ERC-20 por imóvel |
| Criação do ERC-20 | Via `PropertyValueTokenFactory` |
| Decimals do ERC-20 | `0` |
| Quantidades | Sempre unidades inteiras |
| Transferência do ERC-20 | Apenas via operador autorizado |
| Operador autorizado do ERC-20 | `PrimaryValueSale` |
| Transferência do NFT | Bloqueada na Fase 0 |
| Venda permitida | Apenas venda primária do Direito de Valor Livre |
| Revenda por compradores | Não permitida na Fase 0 |
| Preço da oferta | Proporcional automático ao valor de mercado |
| Escrow | Saldo do contrato `PrimaryValueSale` |
| Ao listar | Tokens vão do seller para `address(this)` |
| Ao comprar | Listing vira `Filled` antes de transferir ETH |
| Proteção de compra/cancelamento | `nonReentrant` |
| Deploy dos contratos | Executado fora do container `app` |
| Chave privada de deploy | Nunca entra no `.env` do container Next.js |
| Coordenadas | `lat`/`lng` como strings normalizadas com 6 casas decimais |

---

## 3. Modelo econômico

Cada imóvel tokenizado possui um total econômico fixo de unidades.

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

Invariante econômica:

```text
linkedValueUnits + freeValueUnits = totalValueUnits
```

Na tokenização, a proprietária recebe:

```text
1 NFT de Direito de Usufruto
+ UsufructPosition com linkedValueUnits
+ ERC-20 de Direito de Valor Livre com freeValueUnits
```

Exemplo:

```text
Casa avaliada em 10 ETH.
linkedValueBps = 2.000 = 20%.
linkedValueUnits = 200.000.
freeValueUnits = 800.000.

Pessoa A recebe:
- UsufructRightNFT tokenId = propertyId;
- posição de usufruto com 200.000 unidades vinculadas;
- 800.000 tokens ERC-20 de Direito de Valor Livre.
```

---

## 4. Tipos de direito e implementação

### 4.1 Direito de Usufruto

Representa o direito de uso da casa.

Implementação:

```text
Contrato único: UsufructRightNFT
Padrão: ERC-721 restrito
tokenId: propertyId
Titular inicial: proprietária do imóvel
```

Regras:

- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] `tokenId` deve ser igual ao `propertyId`.
- [ ] `approve` deve reverter.
- [ ] `setApprovalForAll` deve reverter.
- [ ] `transferFrom` deve reverter.
- [ ] `safeTransferFrom` deve reverter.
- [ ] `setAuthorizedOperator` só pode ser chamado por owner/admin do contrato.
- [ ] O NFT não é vendido na Fase 0.

---

### 4.2 Direito de Valor Vinculado ao Usufruto

Representa a fração econômica que fica presa ao direito de usufruto.

Implementação:

```text
Não é ERC-20.
Não é token separado.
É campo interno da UsufructPosition.
```

Estrutura:

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

Regras:

- [ ] Não pode ser vendido separadamente.
- [ ] Não pode ser transferido separadamente.
- [ ] Fica associado ao NFT de usufruto.
- [ ] Na Fase 0 permanece com a proprietária.

---

### 4.3 Direito de Valor Livre

Representa a fração econômica negociável do imóvel.

Implementação:

```text
Um ERC-20 restrito por imóvel.
Criado por PropertyValueTokenFactory.
Decimals = 0.
Supply inicial = freeValueUnits.
```

Regras:

- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] `PrimaryValueSale` é operador autorizado.
- [ ] `transfer` deve reverter.
- [ ] `transferFrom` deve reverter.
- [ ] `approve` deve reverter.
- [ ] O token não usa allowance na Fase 0.
- [ ] Toda movimentação ocorre via `platformTransferFrom`.
- [ ] Quantidades são sempre inteiras.

---

## 5. Exemplo após venda primária

Pessoa A vende 300.000 unidades livres por preço proporcional automático.

```text
Valor de mercado: 10 ETH
Total econômico: 1.000.000 unidades
Oferta: 300.000 unidades
Preço calculado: 10 ETH * 300.000 / 1.000.000 = 3 ETH
```

Após compra por Pessoa B:

| Pessoa | Usufruto | Valor Vinculado | Valor Livre | Total econômico |
|---|---:|---:|---:|---:|
| Pessoa A | Sim | 20% | 50% | 70% |
| Pessoa B | Não | 0% | 30% | 30% |

Interpretação:

```text
Pessoa A continua usando a casa.
Pessoa A mantém o Direito de Valor Vinculado.
Pessoa A mantém 50% em Direito de Valor Livre.
Pessoa B possui 30% em Direito de Valor Livre.
Pessoa B não possui direito de uso.
```

---

## 6. Arquitetura da Fase 0

A aplicação roda localmente em Docker/Docker Compose. O container principal executa apenas a aplicação Node.js/Next.js, expõe a interface web local e executa a camada server-side responsável por gravar no banco local não estruturado. O arquivo `db.json` deve ficar em volume persistente montado no container.

O deploy e os testes de contratos com Foundry rodam **fora do container `app`**. O container da aplicação não deve conter ferramentas de deploy, scripts Foundry operacionais ou chaves privadas.

```text
┌────────────────────────────────────────┐
│ Ambiente local do desenvolvedor        │
│                                        │
│  Foundry                               │
│  forge / cast / scripts de deploy      │
│  .env.deploy com DEPLOYER_PRIVATE_KEY  │
└──────────────────┬─────────────────────┘
                   │ deploy/configuração
                   ▼
┌────────────────────────────────────────┐
│ Smart contracts Sepolia                │
│ Solidity                               │
└──────────────────▲─────────────────────┘
                   │ read/write via wallet
                   │ endereços públicos
┌──────────────────┴─────────────────────┐
│ Docker Compose                         │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ app                              │  │
│  │ Node.js + Next.js                │  │
│  │ TypeScript + Tailwind            │  │
│  │ wagmi + viem                     │  │
│  │ Server Actions / API Routes      │  │
│  └───────────────┬──────────────────┘  │
│                  │                     │
│                  │ volume persistente  │
│                  ▼                     │
│  ┌──────────────────────────────────┐  │
│  │ offchain-db/db.json              │  │
│  │ lowdb / JSON document store      │  │
│  └──────────────────────────────────┘  │
└──────────────────┬─────────────────────┘
                   │
                   │ ETH
                   ▼
┌────────────────────────────────────────┐
│ Wallets                                │
│ vendedora / comprador                  │
└────────────────────────────────────────┘
```

---

## 7. Aplicação local, Docker e banco off-chain

### 7.1 Execução em Docker

A Fase 0 deve rodar localmente por Docker/Docker Compose.

Requisitos:

- a aplicação deve iniciar com `docker compose up`;
- o container principal deve executar Node.js;
- o frontend Next.js e a camada server-side devem rodar no mesmo container `app`;
- o arquivo `offchain-db/db.json` deve ser persistido via volume;
- o browser nunca deve gravar diretamente no `db.json`;
- toda mutação off-chain deve passar por Server Action ou API Route executada no servidor Node.js dentro do container;
- o ambiente do container `app` deve conter apenas variáveis necessárias ao runtime da aplicação;
- o container `app` não deve executar deploy de contratos;
- o container `app` não deve conter `DEPLOYER_PRIVATE_KEY`.

Estrutura mínima esperada:

```text
Dockerfile
docker-compose.yml
.env.app.example
.env.deploy.example
offchain-db/
  db.json
```

### 7.2 Foundry e deploy fora do container app

Foundry deve rodar fora do container `app`, em ambiente local do desenvolvedor ou em ambiente separado de contratos.

O ambiente de deploy pode conter:

```text
forge
cast
script/Deploy.s.sol
.env.deploy
```

O ambiente de deploy pode usar variáveis sensíveis como `DEPLOYER_PRIVATE_KEY`, mas essa chave nunca deve ser copiada para o `.env` do app Next.js, para o `docker-compose.yml` do app ou para a imagem Docker da aplicação.

### 7.3 Regra de acesso ao banco

O browser não grava diretamente no `db.json`.

Toda escrita off-chain deve passar por camada server-side local:

```text
Browser
↓
Next.js Server Action ou API Route
↓
lowdb
↓
db.json
```

### 7.4 Estrutura sugerida

```text
offchain-db/
  db.json
src/
  offchain/
    db.ts
    stableStringify.ts
    hash.ts
    schemas.ts
```

### 7.5 Dados off-chain

Dados armazenados localmente:

- endereço completo;
- localização exata;
- documentos mockados;
- descrição do imóvel;
- metadata de documentos;
- metadata da propriedade;
- timestamps locais de criação.

Esses dados não são escritos em texto aberto on-chain.

---

## 8. Hashing e schemas

### 8.1 Regra de hashing

```text
Algoritmo: keccak256
Encoding: UTF-8
Input: stable JSON
Ordenação: chaves ordenadas alfabeticamente
Documentos mockados: hash da metadata mockada, não do arquivo binário
Coordenadas: strings normalizadas com fixed precision antes do hash
```

A aplicação deve produzir os hashes a partir de JSON estável e determinístico.

### 8.2 Regra de normalização de coordenadas

`lat` e `lng` não devem ser números livres no schema final de hash.

Eles devem ser strings normalizadas com 6 casas decimais.

Exemplo:

```json
{
  "lat": "-23.550500",
  "lng": "-46.633300"
}
```

Regras:

- `lat` e `lng` devem ser convertidos para string antes do `stableStringify`;
- ambos devem ter exatamente 6 casas decimais;
- valores positivos não precisam de sinal `+`;
- valores negativos devem conter `-`;
- separador decimal deve ser ponto `.`;
- a mesma coordenada lógica deve sempre gerar a mesma string.

### 8.3 Schemas fechados

#### `PropertyMetadataV1`

```ts
type PropertyMetadataV1 = {
  version: "1.0";
  localPropertyId: string;
  ownerWallet: string;
  marketValueWei: string;
  linkedValueBps: number;
  description?: string;
  createdAt: string;
};
```

#### `LocationMetadataV1`

```ts
type LocationMetadataV1 = {
  version: "1.0";
  localPropertyId: string;
  address: {
    street: string;
    number: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  location: {
    lat: string; // fixed precision: 6 casas decimais
    lng: string; // fixed precision: 6 casas decimais
  };
};
```

#### `DocumentsMetadataV1`

```ts
type DocumentsMetadataV1 = {
  version: "1.0";
  localPropertyId: string;
  documents: {
    type: "mock_deed" | "mock_owner_id" | "mock_tax_record";
    filename: string;
    mock: true;
    uploadedAt: string;
  }[];
};
```

### 8.4 Exemplo de hash

```ts
const stableJson = stableStringify(metadata);
const hash = keccak256(toUtf8Bytes(stableJson));
```

---

## 9. Contratos da Fase 0

### 9.1 `PropertyRegistry`

Responsável por:

- registrar imóveis;
- manter `nextPropertyId`;
- manter `propertyExists`;
- armazenar hashes e parâmetros econômicos;
- configurar endereços externos;
- executar verificação mock;
- tokenizar imóveis;
- mintar NFT via `UsufructRightNFT`;
- criar ERC-20 via `PropertyValueTokenFactory`;
- mintar `freeValueUnits` no ERC-20;
- criar `UsufructPosition`;
- manter participantes por imóvel;
- atualizar status conforme vendas.

Controle de acesso:

```text
Ownable + AccessControl
```

Roles:

```solidity
bytes32 public constant MOCK_VERIFIER_ROLE = keccak256("MOCK_VERIFIER_ROLE");
```

Regra de verificação mock:

```text
mockVerifyProperty pode ser chamado pelo owner do PropertyRecord ou por conta com MOCK_VERIFIER_ROLE.
```

---

### 9.2 `UsufructRightNFT`

Contrato único ERC-721 restrito.

Responsável por:

- mintar NFT de usufruto;
- usar `tokenId = propertyId`;
- bloquear approvals e transferências diretas;
- permitir configuração de operadores apenas por owner/admin.

---

### 9.3 `PropertyValueTokenFactory`

Responsável por criar um ERC-20 de Direito de Valor Livre por imóvel.

Regra crítica:

```text
createPropertyValueToken só pode ser chamado pelo PropertyRegistry.
```

A factory deve armazenar/configurar explicitamente o registry autorizado.

---

### 9.4 `PropertyValueToken`

ERC-20 restrito por imóvel.

Responsável por:

- representar apenas `freeValueUnits`;
- usar `decimals = 0`;
- permitir mint apenas pelo `PropertyRegistry`;
- autorizar `PrimaryValueSale` como operador;
- bloquear `transfer`, `transferFrom` e `approve`;
- permitir movimentação apenas por `platformTransferFrom`.

---

### 9.5 `PrimaryValueSale`

Marketplace primário de Direito de Valor Livre.

Responsável por:

- criar ofertas primárias apenas pelo owner do `PropertyRecord`;
- impedir revenda por compradores na Fase 0;
- calcular preço proporcional automaticamente;
- mover tokens do seller para `address(this)` ao criar oferta;
- manter escrow no próprio contrato;
- permitir compra total da oferta;
- marcar listing como `Filled` antes de transferir ETH;
- usar `nonReentrant` em compra e cancelamento;
- atualizar participantes;
- atualizar status da propriedade após compra/cancelamento.

---

## 10. Ordem de deploy e configuração

### 10.1 Separação entre deploy e aplicação

O deploy de contratos com Foundry roda fora do container `app`.

O container `app` recebe apenas os endereços já deployados e variáveis públicas/de runtime necessárias para a dApp.

`DEPLOYER_PRIVATE_KEY` nunca deve ser incluída no `.env` do container Next.js.

### 10.2 Ordem de deploy

1. Deploy `UsufructRightNFT`.
2. Deploy `PropertyValueTokenFactory`.
3. Deploy `PropertyRegistry`.
4. Deploy `PrimaryValueSale`.
5. Configurar `PropertyRegistry` com:
   - endereço do `UsufructRightNFT`;
   - endereço do `PropertyValueTokenFactory`;
   - endereço do `PrimaryValueSale`.
6. Configurar `UsufructRightNFT`:
   - `PropertyRegistry` como único minter;
   - operadores autorizados apenas se necessário.
7. Configurar `PropertyValueTokenFactory`:
   - `PropertyRegistry` como caller autorizado.
8. Configurar `PrimaryValueSale`:
   - endereço do `PropertyRegistry`.
9. Durante `tokenizeProperty`, o `PropertyValueToken` criado deve autorizar `PrimaryValueSale` como operador.
10. Copiar os endereços deployados para o `.env.app` usado pelo container `app`.

### 10.3 Variáveis do app local (`.env.app`)

Essas variáveis são usadas pelo container Next.js/Node.js.

```env
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=

NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS=
NEXT_PUBLIC_USUFRUCT_RIGHT_NFT_ADDRESS=
NEXT_PUBLIC_PROPERTY_VALUE_TOKEN_FACTORY_ADDRESS=
NEXT_PUBLIC_PRIMARY_VALUE_SALE_ADDRESS=

MOCK_VERIFIER_ADDRESS=
LOCAL_DB_PATH=/app/offchain-db/db.json
NODE_ENV=development
APP_PORT=3000
```

Proibido no `.env.app`:

```env
DEPLOYER_PRIVATE_KEY=
```

### 10.4 Variáveis de deploy (`.env.deploy`)

Essas variáveis são usadas apenas pelo ambiente de Foundry/deploy, fora do container `app`.

```env
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
MOCK_VERIFIER_ADDRESS=
```

### 10.5 Arquivos Docker mínimos

A implementação deve incluir `Dockerfile` e `docker-compose.yml`.

Exemplo conceitual de serviço:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.app
    volumes:
      - ./offchain-db:/app/offchain-db
```

O volume `./offchain-db:/app/offchain-db` garante que o `db.json` sobreviva ao restart do container.

---

## 11. Enums

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
SoldOut significa que todo o freeValueUnits foi vendido em ofertas primárias.
Não significa venda total do imóvel.
Não afeta o NFT de usufruto nem o Direito de Valor Vinculado.
```

---

## 12. Structs on-chain

### 12.1 `PropertyRecord`

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

Observação:

```text
O endereço do UsufructRightNFT é global, não fica por imóvel.
O usufructTokenId do imóvel é igual ao propertyId.
```

---

### 12.2 `UsufructPosition`

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

---

### 12.3 `PrimarySaleListing`

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

## 13. Storage obrigatório

### 13.1 `PropertyRegistry`

```solidity
uint256 public nextPropertyId = 1;

mapping(uint256 => PropertyRecord) public properties;
mapping(uint256 => bool) public propertyExists;
mapping(uint256 => UsufructPosition) public usufructPositions;

mapping(uint256 => address[]) private participants;
mapping(uint256 => mapping(address => bool)) public isParticipant;

address public usufructRightNFT;
address public propertyValueTokenFactory;
address public primaryValueSale;
```

Toda função que recebe `propertyId` deve validar:

```solidity
require(propertyExists[propertyId], "PROPERTY_NOT_FOUND");
```

---

### 13.2 `PropertyValueTokenFactory`

```solidity
address public propertyRegistry;
mapping(uint256 => address) public valueTokenByProperty;
```

---

### 13.3 `PrimaryValueSale`

```solidity
uint256 public nextListingId = 1;

mapping(uint256 => PrimarySaleListing) public listings;
uint256[] public listingIds;
mapping(uint256 => uint256[]) public listingsByProperty;

mapping(uint256 => uint256) public activeListingsCountByProperty;
mapping(uint256 => uint256) public totalFreeValueSoldByProperty;

address public propertyRegistry;
```

---

## 14. `PropertyRegistry` — funções

### 14.1 Configurar contratos externos

```solidity
function setExternalContracts(
    address usufructRightNFT_,
    address propertyValueTokenFactory_,
    address primaryValueSale_
) external onlyOwner;
```

Validações:

- [ ] Nenhum endereço pode ser `address(0)`.
- [ ] Apenas owner/admin pode chamar.

Efeitos:

- [ ] Salva endereços externos.
- [ ] Emite `ExternalContractsConfigured`.

---

### 14.2 Registrar imóvel

```solidity
function registerProperty(
    uint256 marketValueWei,
    uint16 linkedValueBps,
    bytes32 metadataHash,
    bytes32 documentsHash,
    bytes32 locationHash
) external returns (uint256 propertyId);
```

Validações:

- [ ] `marketValueWei > 0`.
- [ ] `linkedValueBps > 0`.
- [ ] `linkedValueBps < 10_000`.
- [ ] `metadataHash != bytes32(0)`.
- [ ] `documentsHash != bytes32(0)`.
- [ ] `locationHash != bytes32(0)`.

Cálculos:

```solidity
totalValueUnits = 1_000_000;
linkedValueUnits = totalValueUnits * linkedValueBps / 10_000;
freeValueUnits = totalValueUnits - linkedValueUnits;
```

Efeitos:

- [ ] Usa `nextPropertyId`.
- [ ] Incrementa `nextPropertyId`.
- [ ] Define `propertyExists[propertyId] = true`.
- [ ] Cria `PropertyRecord`.
- [ ] Define owner como `msg.sender`.
- [ ] Define status `PendingMockVerification`.
- [ ] Adiciona owner em `participants[propertyId]`.
- [ ] Emite `PropertyRegistered`.

---

### 14.3 Verificação mock

```solidity
function mockVerifyProperty(uint256 propertyId) external;
```

Validações:

- [ ] `propertyExists[propertyId] == true`.
- [ ] Status atual é `PendingMockVerification`.
- [ ] `msg.sender` é owner do imóvel ou possui `MOCK_VERIFIER_ROLE`.

Efeitos:

- [ ] Atualiza status para `MockVerified`.
- [ ] Emite `PropertyMockVerified`.
- [ ] Emite `PropertyStatusUpdated`.

---

### 14.4 Tokenizar imóvel

```solidity
function tokenizeProperty(uint256 propertyId) external;
```

Validações:

- [ ] `propertyExists[propertyId] == true`.
- [ ] `msg.sender == property.owner`.
- [ ] Status é `MockVerified`.
- [ ] Contratos externos estão configurados.
- [ ] Imóvel ainda não foi tokenizado.

Efeitos:

- [ ] Minta `UsufructRightNFT` para owner com `tokenId = propertyId`.
- [ ] Cria `PropertyValueToken` via factory.
- [ ] Minta `freeValueUnits` do ERC-20 para owner.
- [ ] Configura `PrimaryValueSale` como operador autorizado do ERC-20.
- [ ] Cria `UsufructPosition` com `linkedValueUnits`.
- [ ] Salva endereço do `valueToken`.
- [ ] Salva `usufructTokenId = propertyId`.
- [ ] Atualiza status para `Tokenized`.
- [ ] Emite `PropertyValueTokenCreated`.
- [ ] Emite `PropertyTokenized`.
- [ ] Emite `PropertyStatusUpdated`.

---

### 14.5 Atualizar status após listing

```solidity
function updateStatusAfterListingChange(
    uint256 propertyId,
    uint256 activeListingsCount,
    uint256 totalFreeValueSold
) external;
```

Validações:

- [ ] Apenas `PrimaryValueSale` pode chamar.
- [ ] `propertyExists[propertyId] == true`.

Regra:

```text
Se totalFreeValueSold == freeValueUnits:
    status = SoldOut
Senão se activeListingsCount > 0:
    status = ActiveSale
Senão:
    status = Tokenized
```

---

### 14.6 Adicionar participante

```solidity
function addParticipant(uint256 propertyId, address participant) external;
```

Validações:

- [ ] Apenas `PrimaryValueSale` pode chamar.
- [ ] `propertyExists[propertyId] == true`.
- [ ] `participant != address(0)`.

Efeitos:

- [ ] Se ainda não for participante, adiciona ao array.
- [ ] Emite `ParticipantAdded`.

---

### 14.7 Getters

```solidity
function getProperty(uint256 propertyId)
    external
    view
    returns (PropertyRecord memory);

function getUsufructPosition(uint256 propertyId)
    external
    view
    returns (UsufructPosition memory);

function getParticipants(uint256 propertyId)
    external
    view
    returns (address[] memory);

function getPropertiesByOwner(address owner)
    external
    view
    returns (uint256[] memory);

function getEconomicBreakdown(uint256 propertyId, address account)
    external
    view
    returns (
        uint256 freeValueUnits,
        uint256 linkedValueUnits,
        uint256 totalEconomicUnits
    );
```

`getEconomicBreakdown` deve retornar `linkedValueUnits` somente se `account` for titular do NFT de usufruto daquele imóvel.

---

## 15. `UsufructRightNFT` — regras técnicas

### 15.1 Mint

```solidity
function mint(address to, uint256 tokenId) external;
```

Validação:

- [ ] Apenas `PropertyRegistry` pode chamar.

---

### 15.2 Operadores

```solidity
function setAuthorizedOperator(address operator, bool allowed) external onlyOwner;
```

Na Fase 0, transferências do NFT não são usadas, mas a estrutura pode existir para controle administrativo.

---

### 15.3 Funções que devem reverter

- [ ] `approve(address,uint256)`.
- [ ] `setApprovalForAll(address,bool)`.
- [ ] `transferFrom(address,address,uint256)`.
- [ ] `safeTransferFrom(address,address,uint256)`.
- [ ] `safeTransferFrom(address,address,uint256,bytes)`.

Erro sugerido:

```text
TRANSFERS_DISABLED
```

---

## 16. `PropertyValueTokenFactory` — funções

### 16.1 Configurar registry autorizado

```solidity
function setPropertyRegistry(address propertyRegistry_) external onlyOwner;
```

Validação:

- [ ] `propertyRegistry_ != address(0)`.

---

### 16.2 Criar token de valor

```solidity
function createPropertyValueToken(
    uint256 propertyId,
    string memory name,
    string memory symbol,
    address registry,
    address primaryValueSale
) external returns (address valueToken);
```

Validações:

- [ ] Apenas `PropertyRegistry` autorizado pode chamar.
- [ ] `primaryValueSale != address(0)`.
- [ ] Ainda não existe token para `propertyId`.

Efeitos:

- [ ] Cria novo `PropertyValueToken`.
- [ ] Configura `PropertyRegistry` como minter.
- [ ] Configura `PrimaryValueSale` como operador autorizado.
- [ ] Salva `valueTokenByProperty[propertyId]`.
- [ ] Retorna endereço do token.

---

## 17. `PropertyValueToken` — regras técnicas

### 17.1 Decimals

```solidity
function decimals() public pure override returns (uint8) {
    return 0;
}
```

Todas as quantidades são unidades inteiras.

---

### 17.2 Mint

```solidity
function mint(address to, uint256 amount) external;
```

Validação:

- [ ] Apenas `PropertyRegistry` pode chamar.

---

### 17.3 Transferência autorizada

```solidity
function platformTransferFrom(
    address from,
    address to,
    uint256 amount
) external;
```

Validações:

- [ ] Apenas operador autorizado pode chamar.
- [ ] `from != address(0)`.
- [ ] `to != address(0)`.
- [ ] `amount > 0`.

---

### 17.4 Operadores

```solidity
function setAuthorizedOperator(address operator, bool allowed) external;
```

Regra:

- [ ] Apenas admin/factory/registry configurado pode definir operador inicial.
- [ ] `PrimaryValueSale` deve ser operador autorizado.

---

### 17.5 Funções que devem reverter

- [ ] `transfer(address,uint256)`.
- [ ] `transferFrom(address,address,uint256)`.
- [ ] `approve(address,uint256)`.

Erro sugerido:

```text
TRANSFERS_DISABLED
```

Decisão explícita:

```text
approve reverte.
O token não usa allowance na Fase 0.
```

---

## 18. `PrimaryValueSale` — funções

### 18.1 Criar oferta primária

```solidity
function createPrimarySaleListing(
    uint256 propertyId,
    uint256 amount
) external nonReentrant returns (uint256 listingId);
```

Regra de preço:

```solidity
priceWei = property.marketValueWei * amount / property.totalValueUnits;
```

Validações:

- [ ] `propertyExists[propertyId] == true`.
- [ ] Imóvel está `Tokenized` ou `ActiveSale`.
- [ ] `msg.sender == property.owner`.
- [ ] Compradores não podem criar ofertas na Fase 0.
- [ ] `amount > 0`.
- [ ] `amount <= balanceOf(msg.sender)`.
- [ ] `totalFreeValueSoldByProperty[propertyId] + activeEscrowedAmount + amount <= freeValueUnits`.

Efeitos:

- [ ] Calcula `priceWei` automaticamente.
- [ ] Cria `listingId = nextListingId++`.
- [ ] Move tokens do seller para `address(this)` usando `platformTransferFrom`.
- [ ] Salva listing com status `Active`.
- [ ] Adiciona `listingId` em `listingIds`.
- [ ] Adiciona `listingId` em `listingsByProperty[propertyId]`.
- [ ] Incrementa `activeListingsCountByProperty[propertyId]`.
- [ ] Atualiza status do imóvel para `ActiveSale` via registry.
- [ ] Emite `PrimarySaleListed`.
- [ ] Emite `TokensEscrowed`.

---

### 18.2 Comprar oferta

```solidity
function buyPrimarySaleListing(uint256 listingId) external payable nonReentrant;
```

Validações:

- [ ] Listing existe.
- [ ] Listing está `Active`.
- [ ] `msg.value == listing.priceWei`.
- [ ] `msg.sender != listing.seller`.

Ordem obrigatória:

```text
1. Checks.
2. Listing muda para Filled.
3. Contadores são atualizados.
4. Status do imóvel é atualizado.
5. Tokens são transferidos para comprador.
6. ETH é transferido para seller.
7. Eventos são emitidos.
```

Efeitos:

- [ ] Atualiza listing para `Filled` antes de transferir ETH.
- [ ] Decrementa `activeListingsCountByProperty[propertyId]`.
- [ ] Incrementa `totalFreeValueSoldByProperty[propertyId]`.
- [ ] Chama `registry.addParticipant(propertyId, msg.sender)`.
- [ ] Atualiza status via `updateStatusAfterListingChange`.
- [ ] Transfere tokens de `address(this)` para buyer.
- [ ] Transfere ETH para seller com `call`.
- [ ] Emite `ListingStatusUpdated`.
- [ ] Emite `PrimarySalePurchased`.
- [ ] Emite `SellerPaid`.

---

### 18.3 Cancelar oferta

```solidity
function cancelPrimarySaleListing(uint256 listingId) external nonReentrant;
```

Validações:

- [ ] Listing existe.
- [ ] Listing está `Active`.
- [ ] `msg.sender == listing.seller`.

Efeitos:

- [ ] Atualiza listing para `Cancelled`.
- [ ] Decrementa `activeListingsCountByProperty[propertyId]`.
- [ ] Devolve tokens de `address(this)` para seller.
- [ ] Atualiza status via `updateStatusAfterListingChange`.
- [ ] Emite `ListingStatusUpdated`.
- [ ] Emite `PrimarySaleCancelled`.

---

### 18.4 Getters de listings

```solidity
function getListing(uint256 listingId)
    external
    view
    returns (PrimarySaleListing memory);

function getListingIds()
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

Para Fase 0, arrays inteiros são aceitáveis porque haverá poucas ofertas.

---

## 19. Eventos obrigatórios

### 19.1 `PropertyRegistry`

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

event PropertyValueTokenCreated(
    uint256 indexed propertyId,
    address indexed valueToken,
    uint256 freeValueUnits
);

event PropertyTokenized(
    uint256 indexed propertyId,
    address indexed owner,
    address valueToken,
    address usufructNFT,
    uint256 usufructTokenId,
    uint256 linkedValueUnits,
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

---

### 19.2 `PrimaryValueSale`

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

event ListingStatusUpdated(
    uint256 indexed listingId,
    SaleStatus oldStatus,
    SaleStatus newStatus
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
```

---

## 20. Invariantes críticas

- [ ] `propertyExists[propertyId]` deve ser verdadeiro para qualquer operação com imóvel.
- [ ] `nextPropertyId` nunca deve gerar `propertyId = 0`.
- [ ] `linkedValueUnits + freeValueUnits == totalValueUnits`.
- [ ] Cada imóvel tokenizado possui exatamente um NFT de usufruto.
- [ ] `usufructTokenId == propertyId`.
- [ ] O contrato `UsufructRightNFT` é único.
- [ ] O Direito de Valor Vinculado não é ERC-20.
- [ ] O Direito de Valor Vinculado fica em `UsufructPosition`.
- [ ] O Direito de Valor Vinculado não pode ser vendido separadamente.
- [ ] Cada imóvel possui exatamente um `PropertyValueToken`.
- [ ] `PropertyValueToken.decimals() == 0`.
- [ ] O supply inicial do ERC-20 é igual a `freeValueUnits`.
- [ ] `PrimaryValueSale` é operador autorizado do `PropertyValueToken`.
- [ ] `transfer`, `transferFrom` e `approve` do ERC-20 revertem.
- [ ] `approve`, `setApprovalForAll`, `transferFrom` e `safeTransferFrom` do NFT revertem.
- [ ] Apenas owner do `PropertyRecord` pode criar oferta primária.
- [ ] Compradores não podem revender tokens na Fase 0.
- [ ] Ao criar oferta, tokens vão para `address(this)` do `PrimaryValueSale`.
- [ ] Ao comprar, listing muda para `Filled` antes da transferência de ETH.
- [ ] `buyPrimarySaleListing` usa `nonReentrant`.
- [ ] `cancelPrimarySaleListing` usa `nonReentrant`.
- [ ] Se não houver ofertas ativas, status volta para `Tokenized`, exceto se todo `freeValueUnits` tiver sido vendido.
- [ ] `SoldOut` só ocorre quando `totalFreeValueSold == freeValueUnits`.
- [ ] Dados sensíveis não são gravados em texto aberto on-chain.
- [ ] Hashes são gerados com `keccak256` sobre JSON estável.

---

## 21. Casos de erro esperados

### Imóvel inexistente

```text
propertyExists[propertyId] == false
Resultado: revert PROPERTY_NOT_FOUND
```

### Registro com valor de mercado inválido

```text
marketValueWei = 0
Resultado: revert INVALID_MARKET_VALUE
```

### Registro com percentual vinculado inválido

```text
linkedValueBps = 0 ou >= 10.000
Resultado: revert INVALID_LINKED_VALUE_BPS
```

### Registro sem hash obrigatório

```text
metadataHash, documentsHash ou locationHash = 0x0
Resultado: revert INVALID_HASH
```

### Tokenizar antes da verificação mock

```text
status = PendingMockVerification
Resultado: revert PROPERTY_NOT_MOCK_VERIFIED
```

### Criar oferta por não owner

```text
msg.sender != property.owner
Resultado: revert ONLY_PROPERTY_OWNER
```

### Criar oferta com saldo insuficiente

```text
amount > balanceOf(seller)
Resultado: revert INSUFFICIENT_FREE_VALUE_BALANCE
```

### Comprar com ETH incorreto

```text
msg.value != listing.priceWei
Resultado: revert INVALID_PAYMENT_AMOUNT
```

### Tentar revender como comprador

```text
buyer chama createPrimarySaleListing
Resultado: revert ONLY_PROPERTY_OWNER
```

### Transferir ERC-20 diretamente

```text
wallet chama transfer ou transferFrom
Resultado: revert TRANSFERS_DISABLED
```

### Aprovar ERC-20

```text
wallet chama approve
Resultado: revert TRANSFERS_DISABLED
```

### Transferir NFT diretamente

```text
wallet chama transferFrom ou safeTransferFrom
Resultado: revert TRANSFERS_DISABLED
```

### Aprovar NFT

```text
wallet chama approve ou setApprovalForAll
Resultado: revert TRANSFERS_DISABLED
```

---

## 22. Testes obrigatórios

### 22.1 `PropertyRegistry`

- [ ] `nextPropertyId` inicia em 1.
- [ ] Registra imóvel válido.
- [ ] Define `propertyExists[propertyId] = true`.
- [ ] Reverte para imóvel inexistente.
- [ ] Reverte com valor de mercado zero.
- [ ] Reverte com `linkedValueBps` inválido.
- [ ] Reverte sem `metadataHash`.
- [ ] Reverte sem `documentsHash`.
- [ ] Reverte sem `locationHash`.
- [ ] Calcula `linkedValueUnits` corretamente.
- [ ] Calcula `freeValueUnits` corretamente.
- [ ] Garante `linkedValueUnits + freeValueUnits == totalValueUnits`.
- [ ] Define owner corretamente.
- [ ] Adiciona owner aos participantes.
- [ ] Define status `PendingMockVerification`.
- [ ] Permite mock verification pelo owner do imóvel.
- [ ] Permite mock verification por `MOCK_VERIFIER_ROLE`.
- [ ] Reverte mock verification por conta não autorizada.
- [ ] Reverte tokenização antes de mock verification.
- [ ] Tokeniza após mock verification.
- [ ] Minta NFT com `tokenId = propertyId`.
- [ ] Cria `PropertyValueToken` via factory.
- [ ] Minta apenas `freeValueUnits`.
- [ ] Cria `UsufructPosition`.
- [ ] Retorna participantes com `getParticipants`.

---

### 22.2 `UsufructRightNFT`

- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] Reverte mint por outro caller.
- [ ] Minta `tokenId = propertyId` para proprietária.
- [ ] `approve` reverte.
- [ ] `setApprovalForAll` reverte.
- [ ] `transferFrom` reverte.
- [ ] `safeTransferFrom` reverte.
- [ ] `ownerOf(propertyId)` retorna proprietária.

---

### 22.3 `PropertyValueTokenFactory`

- [ ] Armazena registry autorizado.
- [ ] Apenas registry autorizado cria token.
- [ ] Reverte criação por caller não autorizado.
- [ ] Cria um ERC-20 por imóvel.
- [ ] Reverte criação duplicada para o mesmo `propertyId`.
- [ ] Salva `valueTokenByProperty[propertyId]`.
- [ ] Configura `PrimaryValueSale` como operador autorizado do token.

---

### 22.4 `PropertyValueToken`

- [ ] `decimals()` retorna 0.
- [ ] Apenas `PropertyRegistry` pode mintar.
- [ ] Minta supply igual a `freeValueUnits`.
- [ ] `transfer` reverte.
- [ ] `transferFrom` reverte.
- [ ] `approve` reverte.
- [ ] `platformTransferFrom` funciona para operador autorizado.
- [ ] `platformTransferFrom` reverte para operador não autorizado.

---

### 22.5 `PrimaryValueSale`

- [ ] `nextListingId` inicia em 1.
- [ ] Cria listing apenas pelo owner do imóvel.
- [ ] Reverte listing criado por comprador/não owner.
- [ ] Calcula `priceWei` proporcional automaticamente.
- [ ] Move tokens do seller para `address(this)` ao listar.
- [ ] Incrementa `activeListingsCountByProperty`.
- [ ] Adiciona listing em `listingIds`.
- [ ] Adiciona listing em `listingsByProperty`.
- [ ] `getListingsByProperty` retorna ofertas.
- [ ] `getActiveListingsByProperty` retorna apenas ofertas ativas.
- [ ] Compra listing com ETH correto.
- [ ] Reverte compra com ETH incorreto.
- [ ] Muda status para `Filled` antes de transferir ETH.
- [ ] Transfere tokens de `address(this)` para buyer.
- [ ] Transfere ETH para seller.
- [ ] Adiciona buyer aos participantes.
- [ ] Incrementa `totalFreeValueSoldByProperty`.
- [ ] Atualiza status para `Tokenized` quando não há ofertas ativas e ainda não vendeu tudo.
- [ ] Atualiza status para `SoldOut` quando todo `freeValueUnits` foi vendido.
- [ ] Cancela listing ativa.
- [ ] Devolve tokens do escrow ao seller no cancelamento.
- [ ] Usa `nonReentrant` em compra.
- [ ] Usa `nonReentrant` em cancelamento.

---

### 22.6 Off-chain e hashing

- [ ] Grava dados via server-side local.
- [ ] Browser não escreve diretamente em `db.json`.
- [ ] Gera `metadataHash` com `keccak256`.
- [ ] Gera `documentsHash` com `keccak256`.
- [ ] Gera `locationHash` com `keccak256`.
- [ ] Usa JSON estável com chaves ordenadas.
- [ ] Hash de documentos usa metadata mockada, não binário.
- [ ] Mesmo input gera mesmo hash.
- [ ] Coordenadas equivalentes geram strings normalizadas iguais.
- [ ] Mudança de campo altera o hash.

---

## 23. Milestones da Fase 0

### Milestone 0.1 — Setup técnico

**Objetivo:** preparar base local de desenvolvimento, contratos e aplicação.

#### Checklist

- [ ] Criar repositório.
- [ ] Configurar Foundry fora do container `app`.
- [ ] Configurar Next.js local em container Node.js.
- [ ] Configurar TypeScript.
- [ ] Configurar Tailwind.
- [ ] Configurar wagmi.
- [ ] Configurar viem.
- [ ] Configurar Sepolia.
- [ ] Criar `Dockerfile`.
- [ ] Criar `docker-compose.yml`.
- [ ] Criar `.env.app.example`.
- [ ] Criar `.env.deploy.example`.
- [ ] Garantir que `DEPLOYER_PRIVATE_KEY` não entra no `.env.app`.
- [ ] Criar estrutura de contratos.
- [ ] Criar estrutura `offchain-db/db.json` persistida por volume Docker.
- [ ] Criar camada server-side local para escrita no lowdb dentro do container.
- [ ] Criar utilitário de stable JSON.
- [ ] Criar utilitário de hash `keccak256`.
- [ ] Conectar wallet no frontend.
- [ ] Ler dado on-chain no frontend.
- [ ] Validar persistência do `db.json` após restart do container.

#### Critério de aceite

- [ ] Aplicação roda localmente via `docker compose up`.
- [ ] Wallet conecta.
- [ ] Rede Sepolia é detectada.
- [ ] Dados off-chain são salvos via server-side local no volume Docker.
- [ ] Hashes são gerados de forma determinística.
- [ ] `lat`/`lng` são strings normalizadas com 6 casas decimais.

#### Prioridade

P0

---

### Milestone 0.2 — Deploy e configuração

**Objetivo:** publicar contratos e configurar dependências.

#### Checklist

- [ ] Deploy `UsufructRightNFT`.
- [ ] Deploy `PropertyValueTokenFactory`.
- [ ] Deploy `PropertyRegistry`.
- [ ] Deploy `PrimaryValueSale`.
- [ ] Configurar endereços externos no `PropertyRegistry`.
- [ ] Configurar registry autorizado na factory.
- [ ] Configurar `MOCK_VERIFIER_ROLE`.
- [ ] Garantir que `PrimaryValueSale` será operador dos tokens criados.
- [ ] Salvar endereços no `.env.app`.
- [ ] Manter `DEPLOYER_PRIVATE_KEY` apenas no `.env.deploy`.

#### Critério de aceite

- [ ] Contratos estão deployados na Sepolia.
- [ ] `PropertyRegistry` conhece os contratos externos.
- [ ] Factory aceita chamadas apenas do registry.
- [ ] Aplicação local lê endereços do `.env.app`.

#### Prioridade

P0

---

### Milestone 0.3 — Cadastro off-chain e hashes

**Objetivo:** capturar dados do imóvel e gerar hashes determinísticos.

#### Checklist

- [ ] Criar formulário de tokenização.
- [ ] Criar mock upload de documentos.
- [ ] Implementar schemas fechados.
- [ ] Salvar metadata da propriedade.
- [ ] Salvar metadata de localização.
- [ ] Salvar metadata de documentos mockados.
- [ ] Normalizar `lat`/`lng` como strings com 6 casas decimais.
- [ ] Gerar `metadataHash`.
- [ ] Gerar `locationHash`.
- [ ] Gerar `documentsHash`.
- [ ] Mostrar preview antes do registro on-chain.

#### Critério de aceite

- [ ] Pessoa A preenche dados do imóvel.
- [ ] Dados são persistidos localmente.
- [ ] Hashes são exibidos.
- [ ] Mesmo input gera mesmo hash.
- [ ] Coordenadas equivalentes geram strings normalizadas iguais.

#### Prioridade

P0

---

### Milestone 0.4 — Registro e verificação mock

**Objetivo:** registrar o imóvel on-chain e simular verificação.

#### Checklist

- [ ] Implementar `nextPropertyId`.
- [ ] Implementar `propertyExists`.
- [ ] Implementar `registerProperty`.
- [ ] Implementar `mockVerifyProperty`.
- [ ] Validar hashes obrigatórios.
- [ ] Calcular `linkedValueUnits`.
- [ ] Calcular `freeValueUnits`.
- [ ] Adicionar owner aos participantes.
- [ ] Emitir eventos.
- [ ] Criar tela de status.

#### Critério de aceite

- [ ] Pessoa A registra imóvel on-chain.
- [ ] Status inicial é `PendingMockVerification`.
- [ ] Verificação mock muda status para `MockVerified`.
- [ ] Imóvel inexistente é rejeitado.

#### Prioridade

P0

---

### Milestone 0.5 — Tokenização

**Objetivo:** gerar NFT de usufruto, posição vinculada e ERC-20 livre.

#### Checklist

- [ ] Implementar `UsufructRightNFT` único.
- [ ] Implementar `PropertyValueTokenFactory`.
- [ ] Implementar `PropertyValueToken` com `decimals = 0`.
- [ ] Implementar `tokenizeProperty`.
- [ ] Mintar NFT com `tokenId = propertyId`.
- [ ] Criar `PropertyValueToken` via factory.
- [ ] Mintar `freeValueUnits` para owner.
- [ ] Criar `UsufructPosition` com `linkedValueUnits`.
- [ ] Bloquear approvals e transferências diretas.
- [ ] Emitir eventos de tokenização.

#### Critério de aceite

- [ ] Pessoa A recebe NFT de usufruto.
- [ ] NFT tem `tokenId = propertyId`.
- [ ] Pessoa A recebe apenas `freeValueUnits` em ERC-20.
- [ ] Valor vinculado fica na `UsufructPosition`.
- [ ] Transferências diretas revertem.

#### Prioridade

P0

---

### Milestone 0.6 — Oferta primária

**Objetivo:** permitir venda primária de Direito de Valor Livre.

#### Checklist

- [ ] Implementar `SaleStatus`.
- [ ] Implementar `nextListingId`.
- [ ] Implementar storage de listings.
- [ ] Implementar getters de listings.
- [ ] Implementar `createPrimarySaleListing`.
- [ ] Restringir criação ao owner do imóvel.
- [ ] Bloquear revenda por compradores.
- [ ] Calcular preço proporcional automaticamente.
- [ ] Mover tokens para `address(this)`.
- [ ] Incrementar contador de ofertas ativas.
- [ ] Atualizar status para `ActiveSale`.
- [ ] Emitir eventos.

#### Critério de aceite

- [ ] Pessoa A cria oferta de 300.000 unidades.
- [ ] Preço é calculado como 3 ETH para imóvel de 10 ETH.
- [ ] Tokens ficam em escrow no `PrimaryValueSale`.
- [ ] Oferta aparece no frontend via getter.

#### Prioridade

P0

---

### Milestone 0.7 — Compra da oferta

**Objetivo:** comprador paga ETH e recebe Direito de Valor Livre.

#### Checklist

- [ ] Implementar `buyPrimarySaleListing` com `nonReentrant`.
- [ ] Validar status `Active`.
- [ ] Validar `msg.value`.
- [ ] Mudar status para `Filled` antes de transferir ETH.
- [ ] Atualizar contadores.
- [ ] Atualizar status da propriedade.
- [ ] Transferir tokens para comprador.
- [ ] Transferir ETH para seller.
- [ ] Adicionar comprador aos participantes.
- [ ] Emitir eventos de compra e pagamento.

#### Critério de aceite

- [ ] Pessoa B compra a oferta por 3 ETH.
- [ ] Listing vira `Filled`.
- [ ] Pessoa A recebe 3 ETH.
- [ ] Pessoa B recebe 300.000 tokens.
- [ ] Pessoa B aparece em `getParticipants`.
- [ ] Status volta para `Tokenized` ou vira `SoldOut` conforme o caso.

#### Prioridade

P0

---

### Milestone 0.8 — Cancelamento de oferta

**Objetivo:** permitir cancelamento seguro de oferta ativa.

#### Checklist

- [ ] Implementar `cancelPrimarySaleListing` com `nonReentrant`.
- [ ] Validar seller.
- [ ] Validar listing ativa.
- [ ] Mudar status para `Cancelled`.
- [ ] Devolver tokens do escrow ao seller.
- [ ] Atualizar contador de ofertas ativas.
- [ ] Atualizar status da propriedade.
- [ ] Emitir eventos.

#### Critério de aceite

- [ ] Pessoa A cancela oferta ativa.
- [ ] Tokens retornam para Pessoa A.
- [ ] Status volta para `Tokenized` se não houver ofertas ativas.

#### Prioridade

P0

---

### Milestone 0.9 — Dashboard e demo guiada

**Objetivo:** apresentar a diferença entre usufruto, valor vinculado e valor livre.

#### Checklist

- [ ] Mostrar dados off-chain do imóvel.
- [ ] Mostrar hashes on-chain.
- [ ] Mostrar status do imóvel.
- [ ] Mostrar titular do NFT de usufruto.
- [ ] Mostrar `linkedValueUnits`.
- [ ] Mostrar token ERC-20 de valor livre.
- [ ] Mostrar `freeValueUnits`.
- [ ] Mostrar participantes.
- [ ] Mostrar breakdown econômico por participante.
- [ ] Mostrar ofertas ativas.
- [ ] Mostrar ofertas preenchidas/canceladas.
- [ ] Mostrar mensagens explicando que comprador não tem direito de uso.

#### Critério de aceite

- [ ] Demo pode ser apresentada em até 5 minutos.
- [ ] Banca entende que Pessoa A mantém usufruto.
- [ ] Banca entende que Pessoa A mantém valor vinculado.
- [ ] Banca entende que Pessoa B compra apenas valor livre.

#### Prioridade

P0

---

### Milestone 0.10 — Testes e preparação

**Objetivo:** garantir estabilidade da demo.

#### Checklist

- [ ] Criar testes unitários Foundry.
- [ ] Criar testes de integração Foundry.
- [ ] Testar deploy e configuração.
- [ ] Testar registro de propriedade.
- [ ] Testar verificação mock.
- [ ] Testar tokenização.
- [ ] Testar restrições do NFT.
- [ ] Testar restrições do ERC-20.
- [ ] Testar factory autorizada.
- [ ] Testar criação de oferta.
- [ ] Testar compra.
- [ ] Testar cancelamento.
- [ ] Testar getters de listings.
- [ ] Testar `getParticipants`.
- [ ] Testar status `Tokenized`, `ActiveSale` e `SoldOut`.
- [ ] Preparar wallets.
- [ ] Preparar ETH de Sepolia.
- [ ] Preparar roteiro da demo.

#### Critério de aceite

- [ ] Testes críticos passam.
- [ ] Contratos estão deployados.
- [ ] App local funciona.
- [ ] Demo roda sem intervenção manual complexa.

#### Prioridade

P0

---

## 24. Sequência final da demo

1. Pessoa A conecta wallet.
2. Pessoa A abre “Tokenizar minha casa”.
3. Pessoa A informa valor de mercado: 10 ETH.
4. Pessoa A define valor vinculado ao usufruto: 20%.
5. Pessoa A informa endereço e localização.
6. Pessoa A adiciona documentos mockados.
7. Aplicação salva dados no banco local via server-side.
8. Aplicação gera hashes com `keccak256` sobre JSON estável.
9. Pessoa A registra imóvel on-chain.
10. Pessoa A executa verificação mock.
11. Pessoa A tokeniza imóvel.
12. Sistema minta NFT de usufruto com `tokenId = propertyId` para Pessoa A.
13. Sistema cria `UsufructPosition` com 200.000 unidades vinculadas.
14. Sistema cria ERC-20 de valor livre via factory.
15. Sistema minta 800.000 tokens de valor livre para Pessoa A.
16. Pessoa A cria oferta de 300.000 unidades.
17. Contrato calcula preço automaticamente: 3 ETH.
18. Tokens vão para escrow em `PrimaryValueSale`.
19. Pessoa B compra a oferta pagando 3 ETH.
20. Listing muda para `Filled`.
21. Tokens vão para Pessoa B.
22. ETH vai para Pessoa A.
23. Dashboard mostra:
    - Pessoa A mantém usufruto;
    - Pessoa A mantém 20% vinculado;
    - Pessoa A mantém 50% livre;
    - Pessoa A possui 70% econômico total;
    - Pessoa B possui 30% econômico total;
    - Pessoa B não possui direito de uso.

---

## 25. Definição de pronto da Fase 0

- [ ] Aplicação local roda via Docker/Docker Compose.
- [ ] `docker compose up` inicia a aplicação.
- [ ] `offchain-db/db.json` é persistido em volume Docker.
- [ ] Banco local não estruturado funciona via server-side.
- [ ] Hashes são determinísticos.
- [ ] Contratos estão deployados na Sepolia.
- [ ] Endereços estão configurados no `.env`.
- [ ] Imóvel pode ser registrado.
- [ ] `propertyExists` impede uso de imóvel inexistente.
- [ ] Verificação mock funciona.
- [ ] Tokenização funciona.
- [ ] NFT único de usufruto funciona com `tokenId = propertyId`.
- [ ] `PropertyValueTokenFactory` cria ERC-20 por imóvel.
- [ ] ERC-20 tem `decimals = 0`.
- [ ] ERC-20 minta apenas `freeValueUnits`.
- [ ] `PrimaryValueSale` é operador autorizado.
- [ ] Transferências e approvals diretos revertem.
- [ ] Oferta primária é criada apenas pelo owner do imóvel.
- [ ] Preço é calculado proporcionalmente pelo contrato.
- [ ] Tokens são travados em `address(this)`.
- [ ] Compra altera listing para `Filled` antes de transferir ETH.
- [ ] Compra usa `nonReentrant`.
- [ ] Cancelamento usa `nonReentrant`.
- [ ] Participantes são enumeráveis.
- [ ] Listings são enumeráveis.
- [ ] Status volta corretamente para `Tokenized`.
- [ ] Status vira `SoldOut` quando todo `freeValueUnits` for vendido.
- [ ] Dashboard mostra separação entre usufruto, valor vinculado e valor livre.
- [ ] Testes críticos passam.
