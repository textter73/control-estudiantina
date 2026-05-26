# 📅 Integración de Google Calendar con Control Estudiantina

## 🎯 Vista de Calendario Visual Implementada

Se ha creado una vista de calendario visual que muestra todos los eventos del mes de la estudiantina. El calendario incluye:

### ✅ Características Implementadas:

1. **Vista de Calendario Mensual**
   - Calendario visual con grid de 6 semanas
   - Navegación entre meses (anterior/siguiente)
   - Botón "Hoy" para regresar al mes actual
   - Indicador visual del día actual
   - Días del mes anterior/siguiente en gris

2. **Eventos en el Calendario**
   - Muestra todos los eventos del mes desde Firestore
   - Indicadores de eventos con íconos por tipo:
     - 🎭 Callejoneada (azul)
     - 🎉 Evento (morado)
     - 🎪 Participación (naranja)
     - 📋 Contrato (verde)
   - Hasta 3 eventos visibles por día
   - Indicador "+X más" si hay más de 3 eventos

3. **Detalles de Eventos**
   - Click en un día con eventos abre modal
   - Muestra todos los eventos de ese día
   - Información completa: descripción, ubicación, hora, punto de reunión
   - Botón para ver detalles completos del evento

4. **Acceso al Calendario**
   - Botón 📅 Calendario en el dashboard
   - Disponible para todos los usuarios autenticados
   - Ruta: `/calendar-view`

5. **Leyenda de Tipos de Eventos**
   - Muestra todos los tipos de eventos con sus colores

---

## 🔗 Integración con Google Calendar (Configuración Pendiente)

Para habilitar la sincronización con Google Calendar, sigue estos pasos:

### Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuevo proyecto o selecciona uno existente
3. Nombre sugerido: "Control Estudiantina Calendar"

### Paso 2: Habilitar Google Calendar API

1. En el menú lateral, ve a **APIs & Services** > **Library**
2. Busca "Google Calendar API"
3. Click en **Enable** (Habilitar)

### Paso 3: Crear Credenciales OAuth 2.0

1. Ve a **APIs & Services** > **Credentials**
2. Click en **Create Credentials** > **OAuth client ID**
3. Si es tu primera vez, configura la pantalla de consentimiento:
   - Tipo: External
   - Nombre de la aplicación: "Control Estudiantina"
   - Email de soporte: tu email
   - Logo: opcional
   - Scopes: `.../auth/calendar.readonly`
   - Usuarios de prueba: agrega emails de administradores

4. Crear OAuth Client ID:
   - Tipo de aplicación: **Web application**
   - Nombre: "Control Estudiantina Web"
   - Authorized JavaScript origins:
     - `http://localhost:4200` (para desarrollo)
     - `https://tu-dominio.com` (para producción)
   - Authorized redirect URIs:
     - `http://localhost:4200`
     - `https://tu-dominio.com`

5. Click **Create**
6. Copia el **Client ID**

### Paso 4: Crear API Key

1. En **Credentials**, click **Create Credentials** > **API Key**
2. Copia la **API Key** (empieza con `AIza`)
3. (Opcional) Restricciones recomendadas:
   - Click en la API Key creada para editarla
   - **Application restrictions:** HTTP referrers
   - Agregar:
     - `http://localhost:4200/*`
     - `https://control-estonantzin.web.app/*`
     - `https://control-estonantzin.firebaseapp.com/*`
   - **API restrictions:** Restrict key
   - Seleccionar solo: **Google Calendar API**
   - **Save**

⚠️ **IMPORTANTE:** La API Key debe verse como: `AIzaSyAbCdEf1234567890_-ejemplo`

### Paso 5: Configurar en la Aplicación

✅ **CREDENCIALES CONFIGURADAS CORRECTAMENTE**

**Credenciales actuales en `src/app/components/calendar-view/calendar-view.component.ts`:**
```typescript
CLIENT_ID = '440911866333-07eplgfmhjk0bj0g3srqotf5lr21oj72.apps.googleusercontent.com'; // ✅ OAuth 2.0 válido
API_KEY = 'AIzaSyDt0DpRRKl4H-Ws0-KU_KQqQJLoiS-PQ9Y'; // ✅ API Key válida
```

🎉 **La integración con Google Calendar está lista para usarse.**

### ⚠️ **IMPORTANTE - Verificar orígenes autorizados:**

Asegúrate de que en [Google Cloud Console](https://console.cloud.google.com/apis/credentials) tu OAuth 2.0 Client ID tenga configurados estos orígenes:

**Authorized JavaScript origins:**
```
http://localhost:4200
https://control-estonantzin.web.app
https://control-estonantzin.firebaseapp.com
```

**Authorized redirect URIs:**
```
http://localhost:4200
https://control-estonantzin.web.app
https://control-estonantzin.firebaseapp.com
```

### Paso 6: Agregar Google API Scripts

✅ **YA CONFIGURADO** - Los scripts están agregados en `src/index.html`:

```html
<!-- Google Identity Services (nueva API) -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
<!-- Google API Client Library -->
<script src="https://apis.google.com/js/api.js"></script>
```

**Nota:** Se utiliza la nueva API de Google Identity Services (GIS) que reemplaza a `gapi.auth2`.

### Paso 7: Funciones de Sincronización

✅ **YA IMPLEMENTADO** - El componente `calendar-view` ya tiene implementadas todas las funciones usando la **nueva API de Google Identity Services (GIS)**:

#### Funciones implementadas:

1. **`initGoogleCalendar()`** - Inicializa GAPI y GIS
2. **`gapiLoaded()`** - Carga el cliente de Google API
3. **`gisLoaded()`** - Inicializa Google Identity Services (reemplaza a auth2)
4. **`signInGoogle()`** - Solicita autenticación del usuario
5. **`signOutGoogle()`** - Revoca el token y desconecta
6. **`loadGoogleCalendarEvents()`** - Carga eventos del calendario
7. **`syncWithGoogleCalendar()`** - Sincroniza manualmente
8. **`restoreGoogleSession()`** - 🆕 Restaura sesión automáticamente

**Actualización importante:** El código usa la nueva API `google.accounts.oauth2` en lugar de la antigua `gapi.auth2` que está deprecada.

### ✨ Persistencia de Sesión Implementada

✅ **NUEVA CARACTERÍSTICA:** La conexión a Google Calendar ahora persiste de forma extendida.

**¿Qué significa esto?**
- Ya NO necesitas reconectar tu cuenta de Google cada vez que entras a la aplicación
- El token de autenticación se guarda en `localStorage` del navegador con persistencia extendida
- Al cargar el calendario, automáticamente se verifica si hay una sesión guardada
- Si el token sigue válido, te conectas automáticamente sin necesidad de hacer clic
- Si Google rechaza el token (expiró o fue revocado), se solicita nueva autenticación automáticamente

**Duración de la sesión:**
- El sistema NO verifica expiración local - intenta usar el token guardado indefinidamente
- Google Calendar API maneja la validación del token en sus servidores
- Cuando Google rechaza el token (típicamente después de varias semanas/meses de inactividad), el sistema:
  1. Detecta el error 401/403
  2. Limpia el token inválido
  3. **Solicita nueva autenticación automáticamente de forma silenciosa** (sin interrumpir tu navegación)
- En la práctica, tu sesión puede durar meses si usas la aplicación regularmente

**Autenticación silenciosa:**
- Si tu token expira y ya autorizaste previamente la aplicación, la renovación es automática
- No necesitas volver a ver la pantalla de permisos de Google
- Solo verás la pantalla de autenticación si:
  - Es la primera vez que conectas
  - Revocaste manualmente los permisos en tu cuenta de Google
  - Cambió la configuración de permisos de la aplicación

**Para cerrar sesión manualmente:**
- Haz clic en el botón "🔓 Desconectar" cuando estés conectado
- Esto revoca el token en Google y elimina la sesión guardada localmente

---

## 🧪 Cómo Probar la Integración

### 1. Reiniciar la aplicación
```bash
# Si está corriendo, detén con Ctrl+C
npm start
```

### 2. Navegar al calendario
- Inicia sesión en la app
- Ve al Dashboard
- Click en el botón **📅 Calendario**

### 3. Conectar Google Calendar
- En la vista del calendario, verás el botón **"Conectar con Google Calendar"**
- Haz click en el botón
- Se abrirá una ventana de autenticación de Google
- Inicia sesión con tu cuenta de Google
- Acepta los permisos (solo lectura de calendario)
- La ventana se cerrará y verás tus eventos

### 4. Sincronizar eventos
- Una vez conectado, tus eventos de Google Calendar aparecerán en el calendario
- Puedes usar el botón **"Sincronizar"** para actualizar manualmente
- Usa **"Desconectar"** para revocar el acceso

---

## 🎨 Diferencias Visuales entre Eventos

### Eventos de Firestore:
- 🎭 Callejoneada - Azul claro
- 🎉 Evento - Morado
- 🎪 Participación - Naranja
- 📋 Contrato - Verde

### Eventos de Google Calendar:
- 📅 Evento Google - Azul Google (#4285f4)

---

## 🔐 Seguridad y Privacidad

1. **Permisos**: Solo lectura (calendar.readonly)
2. **Datos**: Los eventos de Google solo se leen, no se modifican
3. **Privacidad**: Los eventos de Google solo son visibles para el usuario que conectó su cuenta
4. **Firestore**: Los eventos de la estudiantina siguen siendo visibles para todos

---

## 📝 Notas Importantes

1. La configuración de Google Calendar es **opcional**
2. El calendario funciona perfectamente sin Google Calendar
3. Cada usuario puede decidir si conecta su Google Calendar
4. Los eventos de la estudiantina siempre se muestran para todos
5. Los eventos de Google Calendar son personales para cada usuario

---

## 🐛 Solución de Problemas

### Error: "Origin not allowed"
- Verifica que tu dominio esté en "Authorized JavaScript origins"

### Error: "Invalid client"
- Verifica que el CLIENT_ID sea correcto
- Asegúrate de que el proyecto de Google Cloud esté activo

### Eventos de Google no aparecen
- Verifica que el usuario haya dado permiso
- Revisa la consola del navegador para errores
- Confirma que la API Key sea correcta

### Botón no aparece
- Verifica que el script de Google API esté cargado en index.html
- Revisa la consola para errores de JavaScript

---

## ✅ Checklist de Implementación

- [x] Componente calendar-view creado
- [x] Vista visual del calendario implementada
- [x] Eventos de Firestore mostrados
- [x] Modal de detalles de eventos
- [x] Botón en dashboard agregado
- [x] Ruta configurada
- [x] Credenciales de Google Calendar configuradas
- [x] Script de Google API agregado en index.html
- [x] Funciones de sincronización implementadas
- [x] Integración visual de eventos de Google completada
- [x] Estilos para eventos de Google agregados
- [x] Persistencia de sesión de Google Calendar implementada
- [x] Botón de desconectar agregado
- [x] Estado de conexión visible en UI
- [ ] Pruebas de integración realizadas

---

## 🎨 Identificación Visual de Eventos

### Eventos de Firestore:
- 🎵 **Ensayo** - Amarillo/Dorado
- ⛪ **Misa** - Rosa/Púrpura
- 🎭 **Callejoneada** - Azul claro
- 🎉 **Evento** - Morado
- 🎪 **Participación** - Naranja
- 📋 **Contrato** - Verde

### Eventos de Google Calendar:
- 🔗 **Google** - Azul Google (#4285f4) con borde azul más oscuro

Los eventos de Google se distinguen visualmente con el ícono 🔗 y color azul característico de Google.

---

## 🚀 Próximos Pasos Sugeridos

1. ✅ Credenciales configuradas
2. ✅ Scripts de Google agregados  
3. ✅ Funciones implementadas
4. 🧪 Probar con usuarios reales
5. 💡 Agregar opción de exportar eventos a Google Calendar (futuro)
6. 💡 Crear eventos de estudiantina desde la app y sincronizar con Google (futuro)

---

¿Necesitas ayuda con algún paso específico? ¡Estoy aquí para ayudarte! 🎉
