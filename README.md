# gisceporra

Web rápida para una porra del Mundial, preparada para publicar en GitHub Pages y usar Supabase como backend.

## Funcionalidades incluidas

- ✅ Registro/login por email y contraseña
- ✅ Alta de apuestas por partido
- ✅ Visualización de resultados de partidos
- ✅ Clasificación automática por puntos
- ✅ Reglas de puntos implementadas (grupos, eliminatorias y bola de cristal)

## Reglas de puntos

- **Fase de grupos**
  - Acertar un equipo del Top 3: **5 pts**
  - Acertar posición exacta (1/2/3): **+10 pts**
- **Eliminatorias**
  - Setzens y Vuitens: ganador **10** | resultado exacto **20**
  - Quarts: ganador **15** | resultado exacto **30**
  - Semifinals: ganador **20** | resultado exacto **40**
  - Final: ganador **30** | resultado exacto **50**
- Nota: se mantienen algunos términos en catalán para respetar las reglas originales del grupo.
- **Bola de cristal**
  - Campeón acertado: **+100 pts**

## Estructura de datos esperada en Supabase

- `usuarios(email)`
- `partidos(id, home_team, away_team, home_goals, away_goals, round, winner)`
- `apuestas(usuario_email, partido_id, pred_home_goals, pred_away_goals, tie_winner, champion_prediction)`
- `clasificacion(usuario_email, puntos)`

## Configuración Supabase

En `index.html`, antes de cargar `src/main.js`, define:

```html
<script>
  window.__SUPABASE_CONFIG = {
    url: 'https://TU-PROYECTO.supabase.co',
    anonKey: 'TU_SUPABASE_ANON_KEY'
  };
</script>
```

Si no se define, la app funciona en **modo local demo** (sin backend) para pruebas rápidas.

## Desarrollo local

```bash
npm test
npm run start
```

y abrir `http://localhost:4173`.

## Despliegue en GitHub Pages

1. Subir el contenido del repo a la rama que uses para Pages.
2. En GitHub, activar Pages apuntando a la raíz (`/`) de esa rama.
3. Configurar `window.__SUPABASE_CONFIG` en el HTML publicado.

## API de resultados de partidos

La app ya contempla tabla `partidos` como fuente de resultados.
Puedes rellenarla vía integración externa (por ejemplo football-data.org o api-football) desde un proceso aparte.
