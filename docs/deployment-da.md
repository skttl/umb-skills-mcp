# Første deployment til Cloudflare

Koden og workflowet er klar. Denne opsætning foretages én gang. Derefter deployer
GitHub Actions efter pushes til main og opdaterer skillindholdet dagligt.

## 1. Find Cloudflare-kontoen

1. Log ind på [Cloudflare](https://dash.cloudflare.com/).
2. Vælg kontoen, der indeholder den aktive zone `skttl.dev`.
3. Kopiér kontoens **Account ID** fra dashboardet. Det verificerede ID for denne
   zone under opsætningen var `d660ee8846260c11020ea5be416134c7`.
   Kontrollér det mod dashboardet, hvis kontoen senere er flyttet.

Account ID er ikke zone-ID. Worker og domæne skal ligge på samme konto.

## 2. Opret et API-token til GitHub

1. Åbn kontoens **API Tokens**. Cloudflares
   [officielle GitHub Actions-guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
   linker til den aktuelle placering.
2. Vælg **Create Token** og skabelonen **Edit Cloudflare Workers**.
3. Giv tokenet navnet `umb-skills-mcp GitHub Actions`.
4. Begræns account resources til kontoen ovenfor og zone resources til `skttl.dev`.
5. Behold de nødvendige rettigheder til oprettelse og deployment af Workers.
   Til oprettelse af custom domain kræves desuden **Zone → Workers Routes → Write**
   for `skttl.dev`. Sørg også for zone read/lookup, som Wrangler bruger til at
   finde zonen. Cloudflare kan vise Write som Edit i token-editoren.
6. Opret tokenet, og kopiér værdien. Gem den direkte som GitHub-secret nedenfor.
   Værdien skal ikke ind i kildekoden eller chatten.

Ingen KV-, R2- eller databaser skal oprettes. Hvis dashboardet tilbyder finere
Worker-adgang, kan tokenet efter første deployment begrænses til den oprettede
Worker. Se [Workers-rettigheder](https://developers.cloudflare.com/workers/authorization/workers/).

## 3. Tilføj de to GitHub-secrets

1. Åbn [repoets Actions secrets](https://github.com/skttl/umb-skills-mcp/settings/secrets/actions).
2. Vælg **New repository secret**.
3. Opret `CLOUDFLARE_ACCOUNT_ID` med konto-ID'et fra trin 1.
4. Opret `CLOUDFLARE_API_TOKEN` med tokenet fra trin 2.

Begge skal oprettes under **Secrets**, ikke Variables. Workflowet læser secrets.

## 4. Start første deployment

1. Åbn [Actions](https://github.com/skttl/umb-skills-mcp/actions).
2. Vælg **CI and deploy**.
3. Vælg **Run workflow**, vælg branchen `main`, og start.
4. Vent på, at test, kildesynkronisering, build, lokal smoke-test og deployment passerer.
5. Kontrollér, at **Deploy to Cloudflare** faktisk blev kørt. Hvis secrets mangler,
   kan resten af workflowet være grønt, mens deployment bliver sprunget over.

Wrangler opretter Worker `umb-skills-mcp` og tilknytter `umb-skills.skttl.dev` som
custom domain via `wrangler.jsonc`. Cloudflare håndterer DNS og TLS for dette
custom domain. Opret ikke en særskilt A- eller CNAME-record først. Hvis navnet
allerede har en DNS-record eller bruges af en anden service, afklar konflikten
før deployment; slet ikke eksisterende records ukritisk.

## 5. Kontrollér endpointet

1. Åbn [serviceoversigten](https://umb-skills.skttl.dev/) efter deployment.
   Den skal vise navn, kilder og antal skills som JSON.
2. Workflowets **Verify production MCP** tester selve MCP-forbindelsen, søgning,
   instruktioner og referencefiler. En browservisning af `/mcp` er ikke en MCP-test.
3. Hvis custom domain eller certifikat stadig klargøres, vent til Cloudflare viser
   domænet som aktivt og kør workflowet igen.

## 6. Tilslut din AI-klient

1. Tilføj HTTP MCP `umb-skills` med URL `https://umb-skills.skttl.dev/mcp`.
2. Tilføj HTTP MCP `umbraco-docs` med URL `https://docs.umbraco.com/~gitbook/mcp`.
3. Installer `skills/umb-skills/SKILL.md` i klientens skillmappe; se README for
   installation gennem Skills CLI.
4. Prøv en konkret opgave med kendt version, eksempelvis et dashboard til Umbraco 18.

## Hvis noget fejler

- **Deployment skipped:** kontrollér de to secrets og deres præcise navne.
- **Authentication/403:** kontrollér tokenets scope, konto og zone. Brug et API-token,
  ikke en Global API Key.
- **Source major mismatch:** upstream har flyttet versionslinjen. Gennemgå
  `sources.json`; fjern ikke versionskontrollen for at få grønt build.
- **Custom domain conflict:** kontrollér Cloudflare DNS og eksisterende Worker-domæner.
- **Error 1102:** mål CPU-forbruget og sammenhold det med Workers-planens grænser.

Der er ikke valgt eller købt en betalt plan. Lokale tests dokumenterer funktion,
men garanterer ikke gratisplanens CPU-budget. Rate limiting er ikke et globalt
omkostningsloft.
