# Generación de Íconos PWA

Para generar los íconos de la PWA, sigue estos pasos:

## Opción 1: Usar herramienta online (Recomendado)

1. Ve a: https://realfavicongenerator.net/
2. Sube el archivo `estonantzin.jpeg` desde la carpeta `assets`
3. Descarga el paquete de íconos generado
4. Copia los archivos PNG en esta carpeta (`assets/icons/`)
5. Renombra los archivos según los tamaños:
   - icon-72x72.png
   - icon-96x96.png
   - icon-128x128.png
   - icon-144x144.png
   - icon-152x152.png
   - icon-192x192.png
   - icon-384x384.png
   - icon-512x512.png

## Opción 2: Usar PWA Asset Generator (Automático)

Ejecuta este comando en la terminal:

```bash
npx @pwa/asset-generator ../estonantzin.jpeg ./assets/icons --icon-only --favicon --type png
```

## Opción 3: Copiar manualmente

Por ahora, copia `estonantzin.jpeg` en cada tamaño manualmente o usa un editor de imágenes.

Los tamaños necesarios son: 72, 96, 128, 144, 152, 192, 384, 512 píxeles.
