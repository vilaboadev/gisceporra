# 🏆 Gisceporra Mundial 2026

Porra interna del Mundial 2026 per a l'equip de Gisce. App estàtica (HTML + JS vanilla) publicable a **GitHub Pages** amb **Supabase** com a backend opcional i seguiment de partits en temps real via **football-data.org**.

---

## Funcionalitats

| Mòdul | Estat |
|---|---|
| Registre i login per email | ✅ |
| Aposta per partit (resultat + Bola de Cristal) | ✅ |
| Classificació automàtica per punts | ✅ |
| Seguiment del Mundial 2026 en temps real | ✅ |
| Taula de classificació de grups | ✅ |
| Bracket d'eliminatòries | ✅ |
| Mode demo local (sense backend) | ✅ |

---

## Requisits previs

### 1. Clau football-data.org (seguiment del Mundial — **gratuïta**)

La secció *Seguiment del Mundial 2026* consumeix l'API de [football-data.org](https://www.football-data.org), que inclou el Mundial de forma gratuïta.

**Com aconseguir-la:**

1. Ves a <https://www.football-data.org/client/register>
2. Omple el formulari (nom, email, motiu d'ús)
3. Rebràs el token per email en pocs minuts
4. Afegeix-lo a `index.html` (veure secció *Configuració*)

> El pla gratuït permet **10 peticions/minut** i accés complet al Mundial. Suficient per a la porra.

---

### 2. Supabase (opcional — backend compartit per a tot l'equip)

Sense Supabase l'app funciona en **mode demo local** (les dades es perden en recarregar). Si vols que tots els membres de l'equip vegin les mateixes apestes i classificació, configura Supabase:

1. Crea un projecte gratuït a <https://supabase.com>
2. Executa aquest SQL al **SQL Editor** del projecte per crear les taules:

```sql
-- Usuaris (gestionats per Supabase Auth, aquesta taula és auxiliar)
create table if not exists usuarios (
  email text primary key
);

-- Partits del Mundial (s'omplen manualment o via integració)
create table if not exists partidos (
  id serial primary key,
  home_team text not null,
  away_team text not null,
  home_goals integer,
  away_goals integer,
  round text not null,  -- 'setzens' | 'vuitens' | 'quarts' | 'semifinals' | 'final'
  winner text
);

-- Apestes dels participants
create table if not exists apuestas (
  id serial primary key,
  usuario_email text not null,
  partido_id integer references partidos(id),
  pred_home_goals integer,
  pred_away_goals integer,
  tie_winner text,
  champion_prediction text,
  unique(usuario_email, partido_id)
);

-- Classificació calculada
create table if not exists clasificacion (
  usuario_email text primary key,
  puntos integer default 0
);
```

3. Anota la **URL del projecte** i la **anon key** (a *Project Settings → API*)

---

## Configuració de les claus a `index.html`

Edita `index.html` i descomenta (i omple) les línies del bloc `<script>` a la capçalera:

```html
<script>
  // Seguiment del Mundial en temps real (obligatori per a la secció Mundial)
  window.__FOOTBALL_DATA_TOKEN = 'abc123elTeuToken';

  // Backend compartit (opcional — sense això funciona en mode demo local)
  window.__SUPABASE_CONFIG = {
    url: 'https://xyzxyz.supabase.co',
    anonKey: 'eyJhbGci...'
  };
</script>
```

> ⚠️ Aquestes claus quedaran visibles al codi font públic. Per a una porra interna d'equip això és acceptable (les claus només permeten llegir dades públiques del Mundial i escriure a la teva pròpia instància de Supabase amb les teves regles de seguretat).

---

## Desenvolupament local

```bash
# Clonar el repo
git clone https://github.com/vilaboadev/gisceporra.git
cd gisceporra

# Executar els tests (no cal npm install — només node:test natiu)
npm test

# Cobertura de tests (≥ 80%)
npm run test:coverage

# Servir l'app localment
npm run start
# → Obre http://localhost:4173
```

---

## Desplegament a GitHub Pages

### Opció A — Desplegament manual (recomanat per començar)

1. **Configura les claus** a `index.html` (veure apartat anterior)
2. Fes commit i push a `main`:
   ```bash
   git add index.html
   git commit -m "chore: configure API tokens"
   git push origin main
   ```
3. Al teu repositori de GitHub, ves a **Settings → Pages**
4. A *Source*, selecciona **Deploy from a branch**
5. Selecciona la branca `main` i la carpeta `/` (arrel)
6. Clica **Save**
7. En 1-2 minuts l'app serà accessible a:
   `https://vilaboadev.github.io/gisceporra/`

### Opció B — GitHub Actions (CI/CD automàtic)

Si prefereixes no cometre les claus directament al codi, pots usar **GitHub Secrets** i una Action:

1. Ves a **Settings → Secrets and variables → Actions**
2. Afegeix els secrets:
   - `FOOTBALL_DATA_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Crea `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - name: Inject tokens
        run: |
          sed -i "s|// window.__FOOTBALL_DATA_TOKEN.*|window.__FOOTBALL_DATA_TOKEN = '${{ secrets.FOOTBALL_DATA_TOKEN }}';|" index.html
          sed -i "s|// window.__SUPABASE_CONFIG.*|window.__SUPABASE_CONFIG = { url: '${{ secrets.SUPABASE_URL }}', anonKey: '${{ secrets.SUPABASE_ANON_KEY }}' };|" index.html
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

---

## Regles de puntuació

| Fase | Guanyador | Resultat exacte |
|---|---|---|
| Fase de grups (Top 3) | 5 pts per equip | +10 pts si posició exacta |
| Setzens / Vuitens | 10 pts | 20 pts |
| Quarts | 15 pts | 30 pts |
| Semifinals | 20 pts | 40 pts |
| Final | 30 pts | 50 pts |
| **Bola de Cristal** (campió) | — | **+100 pts** |

---

## Estructura del projecte

```
gisceporra/
├── index.html          # Entrada de l'app (configura les claus aquí)
├── src/
│   ├── main.js         # Lògica porra: auth, apestes, classificació
│   ├── mundial.js      # Seguiment del Mundial: API, renderitzat
│   ├── scoring.js      # Funcions pures de puntuació
│   └── styles.css      # Estils (dark theme)
├── tests/
│   ├── scoring.test.js # Tests de puntuació
│   └── mundial.test.js # Tests del mòdul Mundial (40 tests, ≥80% cobertura)
└── package.json
```

---

## Tests i cobertura

```bash
npm test              # Executa tots els tests (node:test natiu, sense dependencies)
npm run test:coverage # Mostra cobertura de línies, branques i funcions
```

Cobertura actual:

| Fitxer | Línies | Branques | Funcions |
|---|---|---|---|
| `src/mundial.js` | 81% | 87% | 85% |
| `src/scoring.js` | 73% | 56% | 80% |
| **Total** | **91%** | **86%** | **95%** |

---

## Tecnologies

- **Frontend**: HTML5 + JavaScript ES modules (sense bundler)
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL + Auth) — opcional
- **API partits**: [football-data.org](https://www.football-data.org) — gratuïta
- **Hosting**: GitHub Pages
- **Tests**: `node:test` + `node:assert` (Node.js 18+, sense instal·lar res)
