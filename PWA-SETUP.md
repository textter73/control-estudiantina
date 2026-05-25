# Configuración de PWA - Control Estudiantina

## ✅ Completado

1. ✅ Instalación de @angular/pwa
2. ✅ Creación de manifest.webmanifest
3. ✅ Creación de ngsw-config.json
4. ✅ Configuración de angular.json
5. ✅ Actualización de index.html con meta tags PWA
6. ✅ Importación de ServiceWorkerModule en app.module.ts
7. ✅ Creación de íconos temporales (8 tamaños)
8. ✅ Creación de PwaService para manejar actualizaciones

## 🔄 Pasos Finales

### 1. Instalar @angular/service-worker

Ejecuta en la terminal:

```bash
npm install @angular/service-worker@12.2.0 --save
```

### 2. Optimizar Íconos (Opcional pero recomendado)

Los íconos actuales son copias del logo en formato JPEG. Para mejor rendimiento:

1. Ve a: https://realfavicongenerator.net/
2. Sube `src/assets/estonantzin.jpeg`
3. Descarga los íconos optimizados
4. Reemplaza los archivos en `src/assets/icons/`

### 3. Construir para Producción

```bash
ng build --configuration production
```

### 4. Probar Localmente

Instala un servidor HTTP simple:

```bash
npm install -g http-server
```

Sirve la aplicación:

```bash
cd dist/control-estudiantina
http-server -p 8080
```

Abre en el navegador: http://localhost:8080

### 5. Desplegar a Firebase

```bash
firebase deploy
```

### 6. Probar la Instalación

En un dispositivo móvil o Chrome desktop:
- Abre la aplicación desplegada
- Busca el botón "Instalar" en la barra de navegación
- O en Chrome: Menú → "Instalar Control Estudiantina"

## 📱 Características de la PWA

- **Instalable**: Se puede instalar en dispositivos móviles y desktop
- **Funciona offline**: Cachea recursos estáticos automáticamente
- **Actualizaciones automáticas**: Detecta y notifica nuevas versiones
- **Icono en pantalla de inicio**: Acceso rápido desde el home screen
- **Splash screen**: Pantalla de carga al abrir la app
- **Modo standalone**: Se abre sin la barra de navegación del navegador

## 🎨 Colores de la PWA

- **Color principal**: #189d98 (turquesa)
- **Fondo**: #ffffff (blanco)
- **Display**: standalone

## 🔧 Archivos Modificados

1. `src/manifest.webmanifest` - Configuración de la PWA
2. `ngsw-config.json` - Configuración del Service Worker
3. `angular.json` - Habilitación de PWA en producción
4. `src/index.html` - Meta tags para PWA
5. `src/app/app.module.ts` - Importación de ServiceWorkerModule
6. `src/app/app.component.ts` - Inyección de PwaService
7. `src/app/services/pwa.service.ts` - Servicio para manejar PWA
8. `src/assets/icons/` - Íconos de la aplicación

## 📝 Notas Importantes

- La PWA solo funciona en **modo producción** (environment.production = true)
- Requiere **HTTPS** para funcionar (excepto en localhost)
- Firebase Hosting provee HTTPS automáticamente
- Los Service Workers solo se registran en producción por seguridad

## 🐛 Troubleshooting

### El botón de instalación no aparece
- Verifica que estés en modo producción
- Asegúrate de que la URL sea HTTPS
- Revisa la consola del navegador por errores

### La app no funciona offline
- Verifica que el Service Worker esté registrado (DevTools → Application → Service Workers)
- Asegúrate de que el archivo ngsw-worker.js esté siendo servido

### Errores de compilación
- Ejecuta: `npm install @angular/service-worker@12.2.0`
- Limpia y reconstruye: `rm -rf dist && ng build --configuration production`

## ✨ Próximos Pasos

Una vez desplegada la PWA:
1. Comparte la URL con los usuarios
2. Instrúyelos a instalar la app en sus dispositivos
3. Disfruta de una experiencia de aplicación nativa con tecnología web
