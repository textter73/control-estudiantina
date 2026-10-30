# Guía de Estilo y Reglas de Frontend (Control Estudiantina)

Este proyecto debe cumplir siempre con los más altos estándares de diseño, ergonomía y rendimiento frontend:

1. **Jerarquía Visual y Tipografía**:
   - Usar tamaños y pesos consistentes (`font-weight: 500/600/700` para títulos, `400` para texto corrido).
   - Aplicar elipsis (`text-overflow: ellipsis`) en títulos y nombres largos dentro de filas, listas y tarjetas.

2. **Paleta de Identidad**:
   - Primario: `#189d98` (hover: `#0f6b68`).
   - Fondos: `#f5f7fa` para páginas, `#ffffff` para tarjetas/modales.
   - Textos: `#1e293b` (títulos principales), `#334155` (texto general), `#64748b` (metadatos/subtítulos).

3. **Prevención de Desbordamiento (Responsive)**:
   - Toda barra de herramientas (`tabs`, filtros, botones de acción) debe adaptarse limpiamente en pantallas pequeñas (`< 768px`) sin desbordar el viewport horizontal ni ocultar contenido esencial.
   - Mantener las listas y modales limpios y sin sobrecargar de botones repetitivos.

4. **Micro-interacciones y Estados**:
   - Todo elemento interactivo debe tener `:hover` suave (`transition: all 0.2s ease`).
   - Siempre proveer estados de carga claros (*spinners* o *skeletons*) y estados vacíos (*empty states*) descriptivos cuando una lista o filtro no devuelva resultados.
