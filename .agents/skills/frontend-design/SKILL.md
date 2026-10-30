---
name: frontend-design
description: >-
  Expert guidance, design system patterns, and UI/UX best practices for this project (Control Estudiantina).
  Use this skill whenever creating, updating, or refactoring components, views, layouts, CSS, or interfaces,
  to ensure modern, accessible, responsive, and visually stunning user experiences without breaking layouts.
---

# Frontend Design & UI/UX Expert Skill

Esta habilidad define las directrices maestras de diseño, arquitectura CSS, sistemas de diseño y mejores prácticas de experiencia de usuario específicas para el proyecto **Control Estudiantina**.

---

## 1. Identidad Visual y Paleta de Colores

El proyecto utiliza una identidad profesional basada en tonos esmeralda/teal con neutros cálidos y acentos semánticos de alta legibilidad:

### Tokens de Color Principales
- **Primary Teal**: `#189d98` (Color principal, botones primarios, enlaces activos)
- **Primary Dark**: `#0f6b68` (Encabezados, gradientes, hover primario)
- **Deep Slate / Dark**: `#1e293b` (Títulos destacados, texto principal de alta jerarquía)
- **Text Body**: `#2d3748` o `#334155` (Texto regular)
- **Text Muted**: `#64748b` (Subtítulos, metadatos, iconos secundarios)
- **Background App**: `#f5f7fa` / `#f8fafc` (Fondos de página limpios y descansados)
- **Surface / Card**: `#ffffff` (Contenedores, tarjetas, modales)
- **Borders & Dividers**: `#e2e8f0` / `#edf2f7` (Bordes sutiles)

### Estados Semánticos
- **Éxito / Aprendido**: Fondo `#f0fdf4`, borde `#bbf7d0`, texto `#15803d`
- **Advertencia / En progreso**: Fondo `#fffbeb`, borde `#fde68a`, texto `#b45309`
- **Peligro / Pendiente**: Fondo `#fff5f5`, borde `#feb2b2`, texto `#c53030`
- **Info / Neutral**: Fondo `#f1f5f9`, borde `#cbd5e0`, texto `#475569`

---

## 2. Principios de Maquetación y Flexbox/Grid

### A. Prevención de Desbordamiento (*Overflow Protection*)
- **Nunca asumir que los textos son cortos**: Títulos de canciones, compositores o nombres de usuarios pueden ser largos.
- Siempre aplicar reglas de elipsis en elementos de texto en listas:
  ```css
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ```
- En flex containers, recordar que los hijos directos con texto necesitan `min-width: 0;` para que `text-overflow: ellipsis` funcione correctamente.

### B. Consistencia de Pestañas y Barras de Herramientas
- Las barras de pestañas (`tabs`) no deben superar el ancho del viewport en pantallas reducidas.
- Usar `gap: 0.5rem;` con `flex-wrap: wrap;` o contenedores scroll horizontal controlado (`overflow-x: auto; scrollbar-width: none;`).
- Máximo 2 o 3 pestañas principales de alto nivel en vistas móviles para evitar apelmazar botones. Las acciones específicas o secundarias deben residir en modales o subsecciones dedicadas.

### C. Espaciado y Ritmo Vertical
- **Padding interior en tarjetas**: Usar `1.25rem` a `1.5rem` en desktop, `1rem` en móvil.
- **Radios de borde (Border Radius)**:
  - Botones y chips: `8px` - `10px`
  - Tarjetas y paneles: `12px` - `16px`
  - Badges circulares y avatars: `9999px` / `50%`

---

## 3. Microinteracciones y Elevación

1. **Hover en elementos clickeables**:
   ```css
   transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
   cursor: pointer;
   ```
2. **Elevación Sutil (Shadows)**:
   - Reposo: `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);`
   - Hover / Focus: `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); transform: translateY(-1px);`
   - Modales / Popups: `box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);`

---

## 4. Diseño Responsivo (Mobile First)

1. **Breakpoints del Proyecto**:
   - Móvil pequeño: `< 480px`
   - Móvil estándar / Tablet vertical: `< 768px`
   - Tablet horizontal / Laptop: `< 1024px`
   - Escritorio: `>= 1024px`

2. **Reglas para Móviles**:
   - Los botones deben tener un área mínima de contacto táctil de `44x44px`.
   - Modales: `width: 95%; max-height: 90vh; overflow-y: auto;`
   - Modificar layouts de grid a una sola columna: `grid-template-columns: 1fr;`

---

## 5. Accesibilidad y Ergonomía (UX)

- **Contraste de texto**: Asegurar siempre una relación de contraste mínima de 4.5:1 (no usar texto gris claro sobre fondo blanco).
- **Feedback inmediato**: Indicar claramente el estado de carga (`loading-spinner`), botones deshabilitados (`opacity: 0.6; cursor: not-allowed;`) y toasts de confirmación no intrusivos.
- **Empty States**: Cuando una lista o búsqueda esté vacía, mostrar siempre un ícono descriptivo, un mensaje claro y, si aplica, un botón de acción para recuperar el estado original.
