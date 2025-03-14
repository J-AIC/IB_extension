# 1. Introducción

¡No se requiere registro, configuración sencilla!  
InsightBuddy Chat es un asistente de chat basado en IA que se puede utilizar en sitios web. Simplemente configurando la clave API de tu proveedor de IA preferido —ya sea OpenAI, Anthropic, Google u otro— puedes empezar a usarlo de inmediato.  
Además, también puede conectarse a tu propio entorno autohospedado compatible con OpenAI.

- A partir de febrero de 2025, el Gemini de Google es parcialmente gratuito, por lo que, si lo aprovechas, podrás utilizar la IA generativa de forma gratuita.
- El siguiente artículo resume cómo configurar una cuenta ( https://j-aic.com/techblog/-PSfeaXS ).

## 1.1 Características clave

- Soporta múltiples proveedores de IA
- Permite conversaciones que tienen en cuenta el contenido del sitio web
- Incluye una función para guardar el historial de chat
- Mediante la función de guía, puedes realizar acciones específicas en sitios designados

## 1.2 Manejo de la información

- Las claves API y el historial de chat se almacenan únicamente localmente en tu dispositivo.
- Para más detalles sobre cómo se maneja la información enviada a través de la función de chat, revisa los términos de servicio de cada proveedor de modelos.
- Nuestra empresa no recopila datos de uso ni otra información únicamente a través de esta función.

---

# 2. Configuración inicial

## 2.1 Pasos para configurar el proveedor de API

1. **Abre la pantalla de Configuración de API**  
   - Abre el widget de chat en la esquina inferior derecha de la pantalla  
   - Haz clic en el ícono "Inicio" en el menú inferior  
   - Haz clic en "Configuración de API" en el menú de la izquierda
2. **Selecciona el proveedor y configura la clave API**  
   - Ubica la tarjeta del proveedor de IA deseado  
   - Haz clic en el ícono de engranaje para entrar en el modo de configuración  
   - Ingresa tu clave API  
   - Haz clic en "Guardar"
3. **Selecciona el modelo**  
   - Haz clic en "Seleccionar modelo" en la tarjeta del proveedor  
   - Elige de la lista de modelos disponibles
4. **Habilita el proveedor**  
   - Tras la configuración, activa el interruptor  
   - La visualización del estado se actualizará una vez configurado correctamente

## 2.2 Proveedores soportados

### OpenAI

- Formato de la clave: Una cadena que comienza con `sk-`
- Modelos principales: GPT-4, GPT-3.5-turbo
- Obtención de la clave API: Disponible en el sitio web de OpenAI

### Anthropic

- Formato de la clave: Una cadena que comienza con `sk-ant-api`
- Modelos principales: Claude-3-Opus, Claude-3-Sonnet
- Obtención de la clave API: Disponible en el sitio web de Anthropic

### Google Gemini

- Formato de la clave: Una cadena que comienza con `AIza`
- Modelo principal: gemini-pro
- Obtención de la clave API: Disponible en Google Cloud Console

### Deepseek

- Formato de la clave: Una cadena que comienza con `sk-ds-api`
- Modelos principales: Deepseek-LLM, Deepseek-XL
- Obtención de la clave API: Disponible en el sitio web de Deepseek

### Compatible con OpenAI

- Formato de la clave: Cualquier cadena (de acuerdo con las especificaciones del proveedor)
- Modelos principales: Modelos compatibles con OpenAI proporcionados por el proveedor
- Obtención de la clave API: Disponible en el sitio web de cada proveedor
- Notas especiales:
  - Requiere la configuración de una URL de punto final personalizada
  - Requiere la entrada manual del nombre del modelo
  - Puede usarse con cualquier servicio que ofrezca una API compatible con OpenAI

### API Local

- Esta es la API propietaria de InsightBuddy.
- Disponible para su uso mediante un acuerdo separado.
- Ofrece funciones como la lectura de formularios y una interfaz de entrada de formularios.

---

# 3. Uso básico

## 3.1 Iniciar un chat

1. Haz clic en la pestaña azul en el borde derecho de tu navegador.
2. Se abrirá el widget de chat.
3. Ingresa tu mensaje en el campo de entrada en la parte inferior.
4. Haz clic en el botón de enviar o presiona Enter para enviar el mensaje.

## 3.2 Uso de la función de chat

- **Iniciar un nuevo chat**  
  - Haz clic en el ícono "+" en la parte superior derecha.
- **Revisar el historial de chat**  
  - Haz clic en el ícono de reloj en el menú inferior.  
  - Selecciona una conversación pasada para visualizarla.
- **Utilizar el contenido del sitio web**  
  - Cuando esté activada, la opción "Obtener contenido actual del sitio web" permite al asistente considerar el contenido de la página actual al generar una respuesta.

---

# 4. Solución de problemas

## 4.1 Errores comunes y sus soluciones

### Error de clave API

- **Síntoma**: Se muestra un error que indica "La clave API no es válida."
- **Solución**:
  1. Verifica que el formato de la clave API sea correcto.
  2. Comprueba la fecha de expiración de la clave API.
  3. Obtén una nueva clave API si es necesario.

### Error de conexión

- **Síntoma**: No se puede enviar el mensaje.
- **Solución**:
  1. Verifica tu conexión a internet.
  2. Recarga el navegador.
  3. Revisa el estado del proveedor de API.

### Error en la selección del modelo

- **Síntoma**: No se puede seleccionar un modelo.
- **Solución**:
  1. Verifica los permisos de la clave API.
  2. Revisa las limitaciones de uso del proveedor.
  3. Intenta seleccionar un modelo diferente.

### Error de conexión con servicios compatibles con OpenAI

- **Síntoma**: No se puede conectar o no se recibe una respuesta.
- **Solución**:
  1. Verifica que la URL del punto final sea correcta.
  2. Asegúrate de que el nombre del modelo ingresado cumpla con las especificaciones del proveedor.
  3. Confirma que el formato de la clave API cumpla con los requisitos del proveedor.
  4. Revisa el estado del servicio del proveedor.

## 4.2 Restablecer la configuración

1. Abre la pantalla de configuración de API.
2. Desactiva la configuración de cada proveedor.
3. Vuelve a ingresar las claves API.
4. Selecciona nuevamente los modelos.

---

# 5. Seguridad y privacidad

## 5.1 Manejo de datos

- Las claves API se almacenan de forma encriptada localmente en tu dispositivo.
- El historial de chat se almacena únicamente localmente.
- La información del sitio web se utiliza solo en la medida necesaria.

## 5.2 Medidas de seguridad recomendadas

- Actualiza regularmente las claves API.
- Desactiva los proveedores que no estén en uso.
- Revisa la configuración de privacidad de tu navegador.

## 5.3 Comprobación de actualizaciones

- Asegúrate de que las actualizaciones automáticas de la extensión de Chrome estén activadas.
- Revisa y actualiza tu configuración regularmente.

---

# 6. Especificaciones técnicas

## 6.1 Sistema de diálogo multi-turno

### Diseño básico

- **Número máximo de turnos retenidos:** 4 turnos  
  - Limitado para optimizar el uso de tokens.
  - Un turno = mensaje del usuario + respuesta de la IA.
  - A partir del quinto turno, se eliminan los turnos más antiguos.

### Gestión de la conversación implementada

- **Historial de conversación gestionado en formato Markdown**
  - **Diálogo reciente:** Historial de conversaciones anteriores
  - **Mensaje actual del usuario:** La entrada actual
  - **Contexto de la página:** Información de la página web actual (opcional)
  - **Configuración de Markdown:**

    ```markdown
    # Diálogo reciente
    ## Turno 1
    ### Usuario
    Contenido del mensaje del usuario
    ### Asistente
    Contenido de la respuesta de la IA
    # Mensaje actual del usuario
    Mensaje actual del usuario
    # Contexto de la página (opcional)
    Contenido de la página web
    ```

- **Se añade un mensaje del sistema a cada solicitud**
  - Las respuestas se proporcionan en el idioma del usuario.
  - Existen restricciones en el uso de decoraciones y markdown.
  - Esto asegura la coherencia en toda la conversación.
  - **Configuración del mensaje del sistema:**

    ```text
    Eres un asistente de IA de alto rendimiento. Por favor, responde de acuerdo con las siguientes instrucciones:

    # Comportamiento básico
    - El mensaje enviado por el usuario se almacena en ("Mensaje actual del usuario").
    - Responde en el mismo idioma que utiliza el usuario en ("Mensaje actual del usuario").
    - Mantén tus respuestas concisas y precisas.
    - No utilices decoraciones ni markdown.

    # Procesamiento del historial de conversación
    - Comprende el contexto refiriéndote al historial de conversación formateado en Markdown ("Diálogo reciente").
    - Cada turno se indica como "Turno X" y contiene el diálogo entre el usuario y el asistente.
    - Busca respuestas que sean coherentes con la conversación anterior.

    # Procesamiento de la información web
    - Si existe una sección "Contexto de la página", considera el contenido de esa página al responder.
    - Utiliza la información de la página como complemento, refiriéndote solo a las partes directamente relacionadas con la pregunta del usuario.
    ```

---

## 6.2 Sistema de procesamiento de contexto

### Recuperación de información de la página web

- **Implementación para optimizar el uso de tokens**
  - Se recupera el contenido de la página web en cada consulta (no se guarda en el historial).
  - Se reduce el uso de tokens optimizando el HTML.
  - Se eliminan elementos innecesarios (como `<script>`, `<style>`, `<iframe>`, etc.).
- **Función para alternar el contexto de la página**
  - Permite al usuario activar o desactivar la función.
  - Se habilita automáticamente al usar la API local.

### Funcionalidad de lectura de formularios

- Reconoce automáticamente los elementos del formulario.
- **Integración con la funcionalidad de análisis de PDF**
  - Detección automática de archivos PDF.
  - Proceso de extracción de texto.
  - Integración con el contexto original del formulario.

---

## 6.3 Sistema de gestión de proveedores

### Implementaciones específicas de cada proveedor

- **OpenAI / Deepseek**
  - Utiliza autenticación Bearer.
  - Soporta la recuperación automática de modelos.
- **Anthropic**
  - Utiliza autenticación x-api-key.
  - Requiere especificar la versión (por ejemplo, 2023-06-01).
- **Google Gemini**
  - Se autentica utilizando una clave API.
  - Soporta un formato de respuesta único.
- **Compatible con OpenAI**
  - Soporta la configuración de puntos finales personalizados.
  - Requiere establecer manualmente el nombre del modelo.
  - Permite métodos de autenticación personalizables.
- **API Local**
  - Soporta puntos finales personalizados.
  - Utiliza un sistema de autenticación propietario.

### Funcionalidad para cambiar de proveedor

- Solo se puede habilitar un proveedor a la vez.
- Realiza una verificación de integridad de la configuración:
  - Valida el formato de la clave API.
  - Comprueba que se incluyan los elementos de configuración requeridos.
  - Verifica que se haya seleccionado un modelo.

---

## 6.4 Sistema de gestión de historial

### Funcionalidad de guardado implementada

- Retiene hasta 30 historiales de conversación.
- **Los datos guardados incluyen:**
  - Información del proveedor
  - Modelo seleccionado
  - Marca de tiempo
  - Historial de mensajes
- **Integración con la API de almacenamiento de Chrome:**
  - Permite el intercambio de datos entre extensiones.
  - Utiliza el almacenamiento local como respaldo.

### Funciones del historial

- **Funcionalidad para editar conversaciones**
  - Permite editar mensajes.
  - Regenera respuestas después de las ediciones.
  - Actualiza automáticamente los mensajes siguientes.
- Filtrado del historial.
- **Verificación de compatibilidad del proveedor**
  - Comprueba que el modelo seleccionado coincida con el proveedor.
  - Muestra advertencias de compatibilidad si es necesario.

---

## 6.5 Implementación del widget de chat

### Funciones de UI/UX

- **Implementado utilizando iframes**
  - Aislado de la página principal.
  - Se comunica mediante el envío de mensajes.
- **Diseño responsivo**
  - Ajusta la visualización según el tamaño de la pantalla.
  - Redimensiona automáticamente el área de entrada.

### Funciones especiales

- **Visualización de la información del sitio**
  - Renderiza contenido HTML.
  - Muestra el contenido de formularios.
- **Gestión de mensajes**
  - Crear un nuevo chat.
  - Editar y reenviar chats (nota: no se permite reutilizar la información web).
  - Alternar la visualización del historial de chat.

---

## 6.6 Implementaciones de seguridad

### Gestión de API

- **Almacenamiento seguro de claves API**
  - Utiliza la API de almacenamiento de Chrome.
  - Oculta las claves cuando se muestran.

### Protección de datos

- **Limitación del contexto de la página**
  - Recupera solo la información necesaria.
  - Excluye datos sensibles.
- **Gestión local de datos**
  - Administra los datos de la sesión.

---

## 6.7 Registro de depuración

- Se muestra el siguiente registro de depuración:

  ```javascript
  console.group('Información de depuración de la transmisión de la API externa');
  console.log('Mensaje enviado:', message);
  console.log('Configuración de API:', {
      provider: apiConfig.provider,
      model: apiConfig.model,
      customSettings: apiConfig.customSettings
  });
  console.log('Respuesta de API:', result);
  console.groupEnd();