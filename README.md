# Código Postal

Buscador de códigos postales de Argentina. Escribís una dirección, elegís de una
lista de direcciones reales ordenadas por cercanía a tu ubicación, y obtenés su
código postal.

**Demo:** _(pendiente de deploy)_

---

## El problema que resuelve

Una dirección como “Balcarce 50” existe en 85 lugares del país. Y peor: el
geocodificador más obvio para esto, **Nominatim en modo libre, descarta la
altura**.

Buscando `corrientes 1234 caba` devuelve ocho resultados, ninguno con
`house_number`, y la mayoría ni siquiera están sobre Corrientes: aparecen
Avenida Pueyrredón, Juan Bautista Justo y hasta el Metrobus, cada uno con su
propio código postal. No hay forma de saber cuál corresponde al 1234.

Esta app resuelve las dos mitades del problema con dos servicios distintos, cada
uno haciendo lo que hace bien.

## Cómo funciona

1. Mientras escribís, **georef-ar** —el Servicio de Normalización de Datos
   Geográficos del Estado argentino, sobre datos del INDEC— busca direcciones
   reales. Entiende la altura, corrige el nombre de la calle (`balcarse 50`
   devuelve `BALCARCE 50`) y da coordenadas exactas.
2. Si el texto trae una ciudad, se detecta y se manda en su propio parámetro.
   `san lorenzo 2889 san miguel` pasa de 24 resultados de todo el país a **1**,
   el correcto. Sin combos que desplegar: se escribe todo junto.
3. Los candidatos se ordenan **por distancia a tu ubicación** antes de recortar.
   Eso es lo que reemplaza al dato que no querés escribir: entre las 85
   “Balcarce 50” que existen en Argentina, la tuya es la más cercana y queda
   primera.
4. Elegís una y **Nominatim en modo estructurado** resuelve el código postal:
   `street="1234 Corrientes"` + `state="Ciudad Autónoma de Buenos Aires"`
   devuelve un único resultado, `Avenida Corrientes 1234 → C1043AAZ`, en lugar
   de los ocho de antes. La misma consulta, partida en componentes.
5. Si esa dirección no está en OpenStreetMap, se cae a geocodificación inversa
   sobre las coordenadas y el resultado se marca como aproximado.

Sin ubicación no se insiste: la lista de sugerencias se ordena alfabéticamente
por provincia y partido, y cada entrada lleva su provincia al lado, así se puede
recorrer buscando la propia.

## Decisiones técnicas

**Un solo campo, no cuatro.** OCA y Correo Argentino piden Provincia, Localidad,
Calle y Altura por separado, con dos combos que hay que desplegar antes de
escribir nada. Acá se escribe todo junto y la app lo separa: corta por el
**último** número —así `av 9 de julio 1000` no se rompe— y valida el sobrante
contra el catálogo de lugares del INDEC (24 provincias, 529 departamentos, 4037
localidades, ~193 KB que viven solo en el servidor). Validar contra nombres
reales es lo que distingue `san lorenzo 2889 san miguel`, donde San Miguel es la
ciudad, de `san miguel 1234`, donde es la calle. Ver
[`lib/query.ts`](app/lib/query.ts) y [`lib/places.ts`](app/lib/places.ts).

**Dos geocodificadores, una responsabilidad cada uno.** georef resuelve la
dirección, Nominatim resuelve el código postal. Ninguno de los dos hace bien las
dos cosas: georef no tiene códigos postales, y Nominatim no entiende direcciones
argentinas en modo libre. La división está en
[`lib/georef.ts`](app/lib/georef.ts) y [`lib/nominatim.ts`](app/lib/nominatim.ts).

**El nombre que sirve para mostrar no es el que sirve para buscar.** Varios
partidos del conurbano numeran sus calles además de nombrarlas, y el registro
del INDEC guarda las dos cosas juntas: en Tres de Febrero el 73% de las calles
arranca con número (`706 MERMOZ`), en San Miguel el 50% (`4150 SAN LORENZO`).
OSM no conoce esos códigos, así que buscar `2889 4150 San Lorenzo` no devuelve
nada y la dirección termina ubicada por interpolación, **190 metros corrida**.
[`stripStreetCode`](app/lib/georef.ts) lo saca para consultar —nunca para
mostrar— y respeta las fechas, donde el número sí es parte del nombre: 25 de
Mayo y 9 de Julio quedan intactas.

**El modo estructurado no es un detalle.** Es la diferencia entre ocho
resultados ambiguos y uno correcto, y está aislado en
[`buildStructuredSearchUrl`](app/lib/nominatim.ts) con un test que fija el orden
de los componentes: la altura va **antes** del nombre de la calle.

**La geocodificación inversa se usa, pero se declara.** No devuelve el código
postal de un punto: devuelve el del objeto mapeado más cercano, que puede estar
en otra calle. Medido sobre Av. Corrientes, tres puntos separados por 300 metros
dan `Avenida Corrientes 1383 → C1043ABA`, `Paraná → 1017` (código viejo de
cuatro dígitos) y `Sarmiento 1526 → C1037ADA`. Por eso solo entra como último
recurso y el resultado viaja con un campo `precision` que la interfaz muestra.

**El autocompletado va contra georef y no contra Nominatim.** georef responde en
~90 ms y no tiene el límite de 1 req/s de Nominatim, así que banca una consulta
por pausa de tecleo. Nominatim queda reservado para una llamada por selección.

**El orden por cercanía se deriva, no se congela.** La ubicación se pide en
silencio apenas hay algo que buscar —no al elegir, o la primera búsqueda de la
sesión saldría sin coordenadas— y nunca se espera: si llega tarde, la lista se
reordena sola. Nada de leer coordenadas desde un closure.

**La distancia se muestra con el margen de error puesto.** El navegador informa
un radio de incertidumbre junto a la posición: decenas de metros con GPS, pero
kilómetros en una desktop que se ubica por WiFi e IP. Si la dirección cae dentro
de ese radio, la app dice "cerca tuyo" en vez de inventar una cifra — con un
techo de 3 km, porque un margen de error enorme no convierte a otra ciudad en tu
cuadra. El **orden** sí sobrevive a un radio grande —alcanza para separar tu
ciudad de una a 300 km—, así que se sigue ordenando igual: lo único que se deja
de afirmar es el número.

**Mapas sin API key.** `pigeon-maps` sobre tiles de OSM: cero claves, cero
tracking. El mapa se monta recién cuando entra al viewport.

**Una sola pantalla, un solo scroll.** La página no scrollea: el buscador arranca
como portada a pantalla completa y, al resolver, el título se retira y la paloma
se achica al lado del campo. Es una transición de layout compartido con `motion`
sobre los mismos nodos, no dos pantallas distintas.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript strict |
| Estilos | Tailwind CSS v4 (config CSS-first con `@theme`) |
| Direcciones | [georef-ar](https://apis.datos.gob.ar/georef/) (INDEC) |
| Códigos postales | Nominatim / OpenStreetMap |
| Mapas | pigeon-maps |
| Animación | motion |
| Tests | Vitest · Testing Library · jsdom |

## Endpoints propios

| Ruta | Qué hace |
|---|---|
| `GET /api/suggest?q&lat&lon` | Sugerencias de georef, ordenadas por cercanía (o alfabéticamente sin ubicación) |
| `GET /api/postcode?street&number&province&lat&lon` | Código postal por búsqueda estructurada, con inversa como respaldo |
| `GET /api/search?q` | Búsqueda libre en Nominatim, para lo que no es una calle con altura |

Los tres validan la entrada, aplican rate limit por IP con token bucket
([`lib/rate-limit.ts`](app/lib/rate-limit.ts)), cachean 24 h en el CDN y traducen
los errores del servicio de origen a mensajes accionables.

## Correrlo local

```bash
npm install
cp .env.example .env.local   # opcional en desarrollo
npm run dev
```

Abrí http://localhost:3000.

### Variables de entorno

| Variable | Para qué |
|---|---|
| `NOMINATIM_USER_AGENT` | Identifica la app ante Nominatim. **Obligatoria en producción** por su política de uso. |
| `NEXT_PUBLIC_SITE_URL` | Se manda como `Referer` junto al User-Agent. |

georef no requiere credenciales.

### Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm test           # suite completa
npm run test:watch # tests en watch
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Tests

110 tests sobre las tres capas:

- **Dominio** — Haversine contra una distancia conocida (Obelisco ↔ Monumento a
  la Bandera), formateo en es-AR, normalización de georef (títulos, alturas como
  string, dedupe por tramo, orden alfabético) y de Nominatim.
- **Texto libre** — el parser separa dirección de ciudad, resuelve alias
  (`caba`, `capital federal`), tolera acentos, y **no** filtra mientras el
  nombre está a medio escribir ni cuando el lugar es en realidad la calle.
- **API** — que la altura viaje delante de la calle, que el filtro de país se
  aplique en el origen, que el orden por cercanía se calcule sobre
  el conjunto completo antes de recortar, que sin ubicación el orden sea
  alfabético y no arbitrario, que la inversa entre solo como respaldo y marque
  `approx`, y que los 429 se traduzcan.
- **Integración** — el caso que originó todo: escribir `balcarce 50` con
  ubicación en CABA ofrece `Balcarce 50, Comuna 1` a 1,1 km, y elegirla da
  `C1064AAB`. Más: tolerancia a errores de tipeo, navegación por teclado, Enter
  sin nada resaltado eligiendo la primera, la provincia al lado de cada
  sugerencia cuando no hay ubicación, cambio a una alternativa, y que no se
  dispare un pedido por tecla.

## Deploy

Pensado para Vercel: importás el repo y listo. Las variables de entorno son
opcionales —el `User-Agent` tiene un valor por defecto que ya identifica la
app— y georef no pide credenciales.

Los route handlers corren en el runtime de Node, fijados a la región `gru1`
(São Paulo): es la más cercana a Argentina, donde están tanto los usuarios como
los dos servicios que se consultan. Por defecto Vercel desplegaría en Estados
Unidos y cada búsqueda pagaría ese viaje de ida y vuelta. El `Cache-Control`
que emiten hace que el CDN absorba las búsquedas repetidas.

La geolocalización del navegador solo funciona sobre HTTPS, que Vercel provee.

## Datos y atribución

Las direcciones vienen del
[Servicio de Normalización de Datos Geográficos](https://apis.datos.gob.ar/georef/)
de la Secretaría de Innovación Pública, sobre datos del INDEC. Los códigos
postales vienen de [OpenStreetMap](https://www.openstreetmap.org/copyright)
(ODbL) a través de [Nominatim](https://nominatim.org/): son los que la comunidad
tiene cargados, pueden faltar, y la interfaz lo dice cuando pasa.
