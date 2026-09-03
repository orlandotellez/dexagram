# Dexagram — Editor de diagramas entidad-relación

Aplicación de escritorio + web para diseñar y documentar **modelos entidad-relación (ER)**. Permite armar entidades con sus campos (claves primarias/foráneas), conectarlas con relaciones con cardinalidad y etiqueta, y exportar el resultado como **HTML autocontenido** o **JSON** editable.

- **Escritorio**: [Tauri](https://tauri.app/) 2
- **Web**: [React](https://react.dev/) 19 + [Vite](https://vitejs.dev/) 7
- Lienzo: [React Flow](https://reactflow.dev/) (`@xyflow/react` 12)
- Gestor de paquetes: **bun** (existe `bun.lock`)

---

## Funcionalidades

| Área | Qué hace |
| --- | --- |
| **Mis diagramas** | Listado de diagramas agrupados por **proyectos** (grupos). Crear, renombrar, duplicar, mover entre proyectos y eliminar (con confirmación). |
| **Editor ER** | Lienzo infinito con zoom/pan. Agregar **Entidades** y **Entidades focales** (raíz del dominio) desde la paleta, por clic o arrastrando. |
| **Campos** | Cada entidad lista sus campos; marcar `#` (clave primaria) o `→` (clave foránea) desde el inspector. |
| **Relaciones** | Conectar **puntos laterales** de la entidad o **puntos por campo**. Cada relación guarda cardinalidad en ambos extremos (`1`, `N`, …), etiqueta (p. ej. `TIENE`) y campo de origen/destino. Los lados se eligen solos: se toman del punto que agarrás y se recalculan por geometría si faltan. |
| **Inspector** | Al seleccionar una entidad: nombre, tabla, campos, raíz del dominio. Al seleccionar una relación: cardinalidades, etiqueta y campos conectados. |
| **Vista previa** | Botón **Vista previa** en el editor: abre un modal con el diagrama renderizado tal cual saldría exportado, con los colores del tema actual. |
| **Exportar / Importar** | **Exportar HTML**: archivo único, autocontenido (SVG + CSS inline) con leyenda `#`, `→`, `1:1`, `1:N`. **Guardar JSON**: backup editable. **Importar**: acepta JSON o HTML exportado. |
| **Temas** | 8 temas con selector en forma de popover agrupado en *Claros / Oscuros*: `luna`, `slate`, `blanco` (blanco puro + negro), `midnight`, `dark`, `emerald`, `ocean` y `noir` (negro puro + blanco, **tema por defecto**). La preferencia se guarda en `localStorage`. |
| **URLs por slug** | Cada diagrama admite un slug opcional (`/diagrama/slug-o-id`) que se mantiene único contra los demás. |

---

## Requisitos

- [Bun](https://bun.sh/) ≥ 1.0 (usado por los comandos de Tauri y el lockfile)
- Para build nativo de escritorio: dependencias de sistema de [Tauri 2](https://tauri.app/start/prerequisites/)

## Comandos

Desde `frontend-dexagram/`:

```bash
bun install          # instalar dependencias

bun dev              # web en http://localhost:1420 (HMR)
bun run build        # build de producción → dist/
bun run preview      # servir el build
bun run lint         # eslint

bun run tauri dev    # app de escritorio en modo desarrollo
bun run tauri build  # binarios/instaladores (identifier: com.dev-espada.dexagram)
```

Los scripts equivalentes con `npm` también existen en `package.json`.

---

## Uso rápido

1. En **Mis diagramas**, creá un proyecto y/o un diagrama (hay un modelo de ejemplo de salud al primer arranque).
2. Entrá al diagrama y arrastrá una **Entidad** o **Entidad focal** desde la paleta izquierda.
3. En el **inspector derecho**, poné nombre, tabla y campos; marcá `#`/`→` según corresponda.
4. Arrastrá desde un **punto (◦) de un campo o de un costado** hasta el punto de otra entidad para crear la relación.
5. Borrá elementos con `Supr`/`Backspace` o desde el inspector.
6. **Vista previa** para ver el resultado y **Exportar HTML** para compartirlo/documentarlo.

> Los puntos de conexión de cada campo y los laterales de la entidad son los círculos visibles; no hay puntos arriba/abajo.

---

## Persistencia

Todo se guarda **localmente** en el navegador/webview:

| Clave `localStorage` | Contenido |
| --- | --- |
| `dexagram:diagrams` | Lista de diagramas (JSON) |
| `dexagram:groups` | Proyectos/grupos |
| `dexagram:theme` | Tema activo |
| `dexagram:diagram` | (legacy) diagrama único previo; se migra automáticamente a la lista |

No hay backend ni sincronización: los datos viven en el dispositivo. Usá **Guardar JSON** para hacer copias de seguridad y **Importar** para restaurarlas o traer diagramas de otra máquina.

## Estructura del código

```
frontend-dexagram/
├── index.html               # arranque (aplica el tema guardado antes de renderizar)
├── src/
│   ├── main.tsx             # entry point (React + Router)
│   ├── routes/AppRoutes.tsx # rutas: "/" y "/diagrama/:slug"
│   ├── themes.css           # variables CSS de los 8 temas
│   ├── global.css           # estilos de toda la app
│   ├── lib/
│   │   ├── model.ts         # tipos (Entity, Field, Relation, Diagram…) y helpers de ids
│   │   ├── storage.ts       # localStorage, migración legacy, download/upload
│   │   ├── themes.ts        # catálogo THEMES + lectura/aplicación del tema
│   │   ├── exportHtml.ts    # render SVG del diagrama + HTML autocontenido
│   │   └── importHtml.ts    # parser del HTML exportado
│   └── components/
│       ├── HomePage.tsx     # listado por proyectos
│       ├── ErEditor.tsx     # editor (React Flow)
│       ├── EntityNode.tsx   # nodo entidad + handles de conexión
│       ├── RelationEdge.tsx # arista relación
│       ├── Inspector.tsx    # edición de la selección
│       ├── ShapePalette.tsx # paleta de formas
│       ├── ThemeSwitcher.tsx# selector de temas (popover)
│       └── PreviewModal.tsx # vista previa del export
└── src-tauri/               # shell de escritorio Tauri 2
```

## Scripts/estilo

- TypeScript estricto (proyectos `tsconfig.app.json` / `tsconfig.node.json`).
- ESLint con `typescript-eslint` y reglas de React Hooks/Refresh.
- Convenciones: componentes con export default + tipos junto al archivo, SVG inline para íconos, textos de UI en español rioplatense (ej. "hacé clic", "arrastrá").
