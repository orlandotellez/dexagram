# Dexagram

Editor visual de diagramas entidad-relación (ER). Creá, editá y exportá modelos de base de datos como HTML con SVG.

## Funcionalidades

- **Editor ER interactivo** — canvas con React Flow para arrastrar y conectar entidades
- **6 temas** — Luna, Dark, Midnight, Slate, Emerald, Ocean
- **Exportar a HTML** — genera un archivo HTML autónomo con SVG del diagrama
- **Importar desde HTML** — re-importa diagramas exportados previamente
- **Guardado automático** — persiste en localStorage del navegador
- **Proyectos** — organizá diagramas en grupos/proyectos
- **Slug para URLs** — compartí diagramas con enlaces amigables

## Estructura del proyecto

```text
/
├── public/
├── src/
│   ├── components/
│   │   ├── ErEditor.tsx        # Editor principal con React Flow
│   │   ├── EntityNode.tsx      # Nodo custom de entidad
│   │   ├── RelationEdge.tsx    # Arista custom de relación
│   │   ├── Inspector.tsx       # Panel lateral de propiedades
│   │   ├── ShapePalette.tsx    # Paleta de formas arrastrables
│   │   ├── ThemeSwitcher.tsx   # Selector de temas
│   │   └── HomePage.tsx        # Página principal con listado
│   ├── lib/
│   │   ├── model.ts            # Modelo de datos (Entity, Field, Relation, Diagram)
│   │   ├── storage.ts          # Persistencia en localStorage
│   │   ├── themes.ts           # Sistema de temas y colores
│   │   ├── exportHtml.ts       # Exportación a HTML/SVG
│   │   └── importHtml.ts       # Importación desde HTML
│   ├── layouts/
│   │   └── Base.astro          # Layout base
│   ├── pages/
│   │   ├── index.astro         # Home — listado de diagramas
│   │   └── diagrama/
│   │       └── [slug].astro    # Editor de diagrama (on-demand)
│   └── styles/
│       ├── themes.css          # Variables CSS de los 6 temas
│       └── global.css          # Estilos globales
├── scripts/
│   ├── verify-export.mjs       # Verificación de exportación
│   └── verify-import.mjs       # Verificación de importación
└── package.json
```

## Comandos

| Comando                   | Acción                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`            | Instala dependencias                             |
| `pnpm dev`                | Inicia el servidor de desarrollo en `localhost:4321` |
| `pnpm build`              | Genera el build de producción en `./dist/`       |
| `pnpm preview`            | Previsualiza el build localmente                 |
| `pnpm astro ...`          | Ejecuta comandos CLI de Astro                    |

## Stack

- **Astro 7** — framework estático con rendering híbrido
- **React 19** — componentes interactivos
- **@xyflow/react** — canvas de diagramas con nodos y aristas
- **TypeScript** — tipado estricto

## Desarrollo

```sh
pnpm install
pnpm dev
```

Abrí `localhost:4321` en el navegador.
